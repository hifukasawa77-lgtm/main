# finetune_chat.py — チャット形式への指示チューニング（SFT）
#
# 事前学習済みモデルは「文章の続きを書く」ことしかできない。
# 「質問→応答」の形式で振る舞わせるため、指示応答データで追加学習する。
#
# チャットテンプレート（chat.py / serve.py と共通）:
#   <|user|>ユーザーの発話<|assistant|>モデルの応答<|eos|>
#
# 損失はアシスタント応答部分のみに掛ける（ユーザー発話の再現を学習させない）。
#
# 使い方:
#   python finetune_chat.py --preset micro --sample            # 内蔵データで動作確認
#   python finetune_chat.py --preset base                      # dolly-15k-ja で本番SFT

import argparse
import os
import random

import torch

from config import get_config
from model import MiniLLM

BASE = os.path.dirname(os.path.abspath(__file__))

# ネットワークなしでパイプラインを検証するための最小データ
SAMPLE_PAIRS = [
    ("こんにちは", "こんにちは！今日はどんなお手伝いをしましょうか？"),
    ("あなたは誰？", "私はhideが自作したローカルLLMです。小さいですが頑張ります。"),
    ("春の季語を教えて", "春の季語には、桜、菜の花、うぐいす、霞などがあります。"),
    ("将棋の歩兵の動きは？", "歩兵は前に一マスだけ進めます。成ると「と金」になります。"),
    ("プログラミングとは何？", "計算機に手順を伝えて、仕事を自動で行わせるための方法です。"),
    ("おやすみ", "おやすみなさい。良い夢を！"),
    ("好きな季節は？", "秋が好きです。収穫の季節で、空気が澄んでいます。"),
    ("1たす1は？", "1たす1は2です。"),
    ("ゲームを作るコツは？", "まず小さく作って動かし、少しずつ機能を足していくことです。"),
    ("ありがとう", "どういたしまして！またいつでも聞いてください。"),
]


def load_dolly_ja(max_examples: int):
    """日本語指示データ databricks-dolly-15k-ja（CC BY-SA 3.0）を取得する。

    data/dolly_ja.json があればそれを優先（HuggingFaceに接続できない環境向け。
    GitHubミラー raw.githubusercontent.com/kunishou/databricks-dolly-15k-ja から取得可能）。
    """
    local_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "dolly_ja.json")
    if os.path.exists(local_path):
        import json
        with open(local_path, encoding="utf-8") as f:
            ds = json.load(f)
    else:
        from datasets import load_dataset
        ds = load_dataset("kunishou/databricks-dolly-15k-ja", split="train")
    pairs = []
    for row in ds:
        instr = (row.get("instruction") or "").strip()
        ctx = (row.get("input") or "").strip()
        out = (row.get("output") or "").strip()
        if not instr or not out:
            continue
        user = f"{instr}\n{ctx}" if ctx else instr
        pairs.append((user, out))
        if len(pairs) >= max_examples:
            break
    return pairs


def build_examples(pairs, sp, max_seq_len):
    """各ペアをトークン化し、(input_ids, labels) のリストを作る。

    labels はアシスタント応答部分のみ実IDを持ち、それ以外は -1（損失計算から除外）。
    """
    user_id = sp.piece_to_id("<|user|>")
    asst_id = sp.piece_to_id("<|assistant|>")
    eos_id = sp.piece_to_id("<|eos|>")

    examples = []
    for user, assistant in pairs:
        prompt_ids = [user_id] + sp.encode(user) + [asst_id]
        answer_ids = sp.encode(assistant) + [eos_id]
        ids = (prompt_ids + answer_ids)[:max_seq_len + 1]
        if len(ids) < 8:
            continue
        x = ids[:-1]
        y = ids[1:]
        # プロンプト部分（answer開始前）は -1 にして損失から除外
        boundary = len(prompt_ids) - 1  # xの中でanswer先頭トークンを予測する位置
        y = [-1] * boundary + y[boundary:]
        examples.append((x, y))
    return examples


def pad_batch(batch, pad_id):
    max_len = max(len(x) for x, _ in batch)
    xs, ys = [], []
    for x, y in batch:
        pad = max_len - len(x)
        xs.append(x + [pad_id] * pad)
        ys.append(y + [-1] * pad)  # パディング位置も損失から除外
    return torch.tensor(xs, dtype=torch.long), torch.tensor(ys, dtype=torch.long)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preset", default="micro", choices=["micro", "small", "base"])
    ap.add_argument("--ckpt", default=os.path.join(BASE, "checkpoints", "latest.pt"),
                    help="事前学習済みチェックポイント")
    ap.add_argument("--out", default=os.path.join(BASE, "checkpoints", "chat.pt"))
    ap.add_argument("--tokenizer", default=os.path.join(BASE, "tokenizer", "sp.model"))
    ap.add_argument("--sample", action="store_true", help="内蔵ミニデータで動作確認")
    ap.add_argument("--max-examples", type=int, default=15000)
    ap.add_argument("--epochs", type=int, default=3)
    ap.add_argument("--batch-size", type=int, default=8)
    ap.add_argument("--lr", type=float, default=1e-4, help="事前学習より低めのLRで上書きを防ぐ")
    args = ap.parse_args()

    import sentencepiece as spm
    sp = spm.SentencePieceProcessor(model_file=args.tokenizer)
    cfg = get_config(args.preset, vocab_size=sp.vocab_size())
    cfg.dropout = 0.1  # 小データでの過学習をやわらげる

    model = MiniLLM(cfg)
    ckpt = torch.load(args.ckpt, map_location="cpu", weights_only=False)
    model.load_state_dict(ckpt["model"])
    print(f"事前学習済みモデルを読み込み（step {ckpt.get('step', '?')}）")

    pairs = SAMPLE_PAIRS if args.sample else load_dolly_ja(args.max_examples)
    examples = build_examples(pairs, sp, cfg.max_seq_len)
    print(f"学習サンプル数: {len(examples)}")

    pad_id = sp.piece_to_id("<|pad|>")
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)
    torch.set_num_threads(os.cpu_count() or 4)
    model.train()

    rng = random.Random(42)
    step = 0
    for epoch in range(args.epochs):
        rng.shuffle(examples)
        for i in range(0, len(examples), args.batch_size):
            batch = examples[i: i + args.batch_size]
            x, y = pad_batch(batch, pad_id)
            _, loss, _ = model(x, targets=y)
            optimizer.zero_grad(set_to_none=True)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            step += 1
            if step % 10 == 0:
                print(f"epoch {epoch + 1}/{args.epochs}  step {step}  loss {loss.item():.4f}")

    torch.save({"model": model.state_dict(), "step": step, "preset": args.preset,
                "config": vars(cfg), "chat": True}, args.out)
    print(f"チャットモデルを保存: {args.out}")


if __name__ == "__main__":
    main()
