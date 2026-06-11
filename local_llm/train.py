# train.py — 事前学習ループ（CPU向け・中断/再開対応）
#
# ノートPCでの夜間学習を想定し、以下を備える:
#   - チェックポイント保存と --resume による再開
#   - 検証損失の定期評価（過学習・学習進行の確認）
#   - loss履歴のCSV出力（logs/train_log.csv）
#   - トークン/秒 と 完了予想時刻の表示
#
# 使い方（例）:
#   python train.py --preset micro --max-steps 2000
#   python train.py --preset base --max-steps 60000 --resume   # 翌晩に続きから
#
# 学習の中身はシンプルな次トークン予測:
#   コーパスからランダムな位置の連続トークン列 x を取り出し、
#   1つ右にずらした y を正解として交差エントロピーを最小化する。

import argparse
import csv
import math
import os
import time

import numpy as np
import torch

from config import get_config
from model import MiniLLM

BASE = os.path.dirname(os.path.abspath(__file__))


def get_batch(data: np.memmap, batch_size: int, seq_len: int, device: str):
    """memmapからランダム位置のシーケンスを切り出す（コーパス全体をRAMに載せない）。"""
    ix = torch.randint(len(data) - seq_len - 1, (batch_size,))
    x = torch.stack([torch.from_numpy(data[i: i + seq_len].astype(np.int64)) for i in ix])
    y = torch.stack([torch.from_numpy(data[i + 1: i + 1 + seq_len].astype(np.int64)) for i in ix])
    return x.to(device), y.to(device)


def lr_schedule(step: int, max_steps: int, max_lr: float, warmup: int) -> float:
    """ウォームアップ付きコサイン減衰。学習初期の発散を防ぎ、終盤は小さく刻む。"""
    if step < warmup:
        return max_lr * (step + 1) / warmup
    progress = (step - warmup) / max(1, max_steps - warmup)
    return 0.1 * max_lr + 0.9 * max_lr * 0.5 * (1 + math.cos(math.pi * min(progress, 1.0)))


@torch.no_grad()
def estimate_val_loss(model, val_data, batch_size, seq_len, device, iters=20):
    model.eval()
    losses = []
    for _ in range(iters):
        x, y = get_batch(val_data, batch_size, seq_len, device)
        _, loss, _ = model(x, targets=y)
        losses.append(loss.item())
    model.train()
    return sum(losses) / len(losses)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preset", default="micro", choices=["micro", "small", "base"])
    ap.add_argument("--data-dir", default=os.path.join(BASE, "data"))
    ap.add_argument("--tokenizer", default=os.path.join(BASE, "tokenizer", "sp.model"))
    ap.add_argument("--out-dir", default=os.path.join(BASE, "checkpoints"))
    ap.add_argument("--max-steps", type=int, default=2000)
    ap.add_argument("--batch-size", type=int, default=8)
    ap.add_argument("--accum", type=int, default=4, help="勾配累積。実効バッチ = batch_size × accum")
    ap.add_argument("--lr", type=float, default=6e-4)
    ap.add_argument("--warmup", type=int, default=200)
    ap.add_argument("--eval-interval", type=int, default=250)
    ap.add_argument("--ckpt-interval", type=int, default=500)
    ap.add_argument("--resume", action="store_true", help="checkpoints/latest.pt から再開")
    ap.add_argument("--seed", type=int, default=1337)
    args = ap.parse_args()

    torch.manual_seed(args.seed)
    # CPU学習の要: 物理コアをフル活用する
    torch.set_num_threads(os.cpu_count() or 4)
    device = "cpu"

    # 語彙数はトークナイザの実際の値で上書きする
    import sentencepiece as spm
    sp = spm.SentencePieceProcessor(model_file=args.tokenizer)
    cfg = get_config(args.preset, vocab_size=sp.vocab_size())

    train_data = np.memmap(os.path.join(args.data_dir, "train.bin"), dtype=np.uint16, mode="r")
    val_data = np.memmap(os.path.join(args.data_dir, "val.bin"), dtype=np.uint16, mode="r")
    print(f"学習データ: {len(train_data):,} トークン / 検証: {len(val_data):,} トークン")

    model = MiniLLM(cfg).to(device)
    print(f"モデル: preset={args.preset} パラメータ数 {model.num_params():,}")

    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, betas=(0.9, 0.95), weight_decay=0.1)

    os.makedirs(args.out_dir, exist_ok=True)
    log_dir = os.path.join(BASE, "logs")
    os.makedirs(log_dir, exist_ok=True)
    log_path = os.path.join(log_dir, "train_log.csv")

    start_step = 0
    latest = os.path.join(args.out_dir, "latest.pt")
    if args.resume and os.path.exists(latest):
        ckpt = torch.load(latest, map_location=device, weights_only=False)
        model.load_state_dict(ckpt["model"])
        optimizer.load_state_dict(ckpt["optimizer"])
        start_step = ckpt["step"]
        print(f"チェックポイントから再開: step {start_step}")
    elif args.resume:
        print("latest.pt が見つからないため最初から学習します")

    if start_step == 0 and not os.path.exists(log_path):
        with open(log_path, "w", newline="") as f:
            csv.writer(f).writerow(["step", "train_loss", "val_loss", "lr", "tokens_per_sec"])

    def save_ckpt(step):
        torch.save({
            "model": model.state_dict(),
            "optimizer": optimizer.state_dict(),
            "step": step,
            "preset": args.preset,
            "config": vars(cfg),
        }, latest)
        # 安全のため一定間隔の番号付きスナップショットも残す
        if step % (args.ckpt_interval * 4) == 0:
            torch.save({"model": model.state_dict(), "step": step, "preset": args.preset,
                        "config": vars(cfg)}, os.path.join(args.out_dir, f"step{step}.pt"))

    model.train()
    tokens_per_step = args.batch_size * args.accum * cfg.max_seq_len
    t0 = time.time()
    running_loss = 0.0

    for step in range(start_step, args.max_steps):
        lr = lr_schedule(step, args.max_steps, args.lr, args.warmup)
        for g in optimizer.param_groups:
            g["lr"] = lr

        optimizer.zero_grad(set_to_none=True)
        loss_acc = 0.0
        for _ in range(args.accum):
            x, y = get_batch(train_data, args.batch_size, cfg.max_seq_len, device)
            _, loss, _ = model(x, targets=y)
            (loss / args.accum).backward()  # 勾配を累積して大きな実効バッチを再現
            loss_acc += loss.item() / args.accum
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)  # 勾配爆発の保険
        optimizer.step()
        running_loss = loss_acc if step == start_step else 0.9 * running_loss + 0.1 * loss_acc

        if (step + 1) % 10 == 0:
            dt = time.time() - t0
            tps = tokens_per_step * 10 / dt
            remain = (args.max_steps - step - 1) * dt / 10
            print(f"step {step + 1}/{args.max_steps}  loss {running_loss:.4f}  "
                  f"lr {lr:.2e}  {tps:,.0f} tok/s  残り目安 {remain / 3600:.1f}h")
            t0 = time.time()

        if (step + 1) % args.eval_interval == 0:
            val_loss = estimate_val_loss(model, val_data, args.batch_size, cfg.max_seq_len, device)
            print(f"  >> 検証損失 {val_loss:.4f}（perplexity {math.exp(val_loss):.1f}）")
            with open(log_path, "a", newline="") as f:
                csv.writer(f).writerow([step + 1, f"{running_loss:.4f}", f"{val_loss:.4f}",
                                        f"{lr:.2e}", f"{tokens_per_step * 10 / max(dt, 1e-9):.0f}"])

        if (step + 1) % args.ckpt_interval == 0:
            save_ckpt(step + 1)
            print(f"  >> チェックポイント保存（step {step + 1}）")

    save_ckpt(args.max_steps)
    print(f"学習完了。チェックポイント: {latest}")


if __name__ == "__main__":
    main()
