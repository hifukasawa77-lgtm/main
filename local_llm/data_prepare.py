# data_prepare.py — 学習コーパスの取得とトークン化
#
# 2段階で使う:
#   1) --download : 公開コーパスをダウンロードして data/corpus/*.txt に保存
#   2) --encode   : 学習済みトークナイザで全テキストをID列に変換し、
#                   data/train.bin / data/val.bin（uint16のmemmap形式）に保存
#
# コーパス（すべて再配布可能なライセンスのもの。リポジトリにはコミットしない）:
#   aozora      : 青空文庫（パブリックドメイン中心） globis-university/aozorabunko-clean
#   wiki        : Wikipedia日本語版（CC BY-SA）      wikimedia/wikipedia 20231101.ja
#   tinystories : 英語の児童向け短編（CDLA-Sharing） roneneldan/TinyStories
#
# 日本語:英語 ≒ 8:2 になるよう既定の取得量を設定している。
# ネットワークなしで動作確認したい場合は --sample で内蔵サンプルテキストを生成する。

import argparse
import os

import numpy as np

CORPUS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "corpus")
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

# (HFデータセット名, 設定名, テキスト列, 既定の取得上限MB)
SOURCES = {
    "aozora": ("globis-university/aozorabunko-clean", None, "text", 150),
    "wiki": ("wikimedia/wikipedia", "20231101.ja", "text", 200),
    "tinystories": ("roneneldan/TinyStories", None, "text", 80),
}


def download(source: str, max_mb: int | None):
    """HuggingFace datasets からストリーミング取得してプレーンテキスト化する。"""
    from datasets import load_dataset  # 遅延import（--sample時は不要なため）

    name, config, text_col, default_mb = SOURCES[source]
    limit = (max_mb or default_mb) * 1024 * 1024
    os.makedirs(CORPUS_DIR, exist_ok=True)
    out_path = os.path.join(CORPUS_DIR, f"{source}.txt")

    print(f"[{source}] {name} をストリーミング取得中（上限 {limit // 1024 // 1024}MB）...")
    ds = load_dataset(name, config, split="train", streaming=True)
    written = 0
    with open(out_path, "w", encoding="utf-8") as f:
        for row in ds:
            text = (row.get(text_col) or "").strip()
            if len(text) < 50:  # 極端に短い断片はノイズなので捨てる
                continue
            f.write(text + "\n\n")
            written += len(text.encode("utf-8"))
            if written >= limit:
                break
    print(f"[{source}] 完了: {out_path} （{written / 1024 / 1024:.1f}MB）")


# ネットワーク不要の動作確認用サンプル（自作の平易な日本語・英語文）
SAMPLE_JA = """\
むかしむかし、ある山のふもとに小さな村がありました。村の人々は朝早く起きて畑を耕し、夕方には囲炉裏を囲んで話をしました。
春になると桜が咲き、子どもたちは川辺で遊びました。夏には祭りがあり、太鼓の音が夜遅くまで響きました。
秋は収穫の季節です。米や栗や柿がたくさん採れて、村はにぎやかになりました。冬には雪が降り、世界は静かな白に包まれました。
ある日、村に一人の旅人がやってきました。旅人は遠い国の話をしてくれました。海の向こうには大きな都があり、そこでは人々が機械を使って暮らしているというのです。
子どもたちは目を輝かせて聞きました。「いつかその都を見てみたい」と少年は思いました。
プログラミングとは、計算機に手順を伝えるための方法です。手順を順番に書き、条件によって分岐させ、同じ処理を繰り返すことができます。
言語モデルは、文章の続きを予測する仕組みです。たくさんの文章を読むことで、言葉のつながりを学びます。
将棋は二人で行うボードゲームです。王将を詰ませた方が勝ちとなります。歩兵は前に一マスずつ進みます。
ゲームを作るときは、まず画面に絵を描き、次にキーボードの入力を受け取り、最後に当たり判定を作ります。
雨の日は本を読むのに良い日です。窓の外の音を聞きながら、物語の世界に入っていきます。
"""

SAMPLE_EN = """\
Once upon a time, there was a little robot who wanted to learn words. Every day it read many books and listened to many stories.
The sun rises in the east and sets in the west. Birds sing in the morning and the wind blows through the trees.
To write a program, you give the computer a list of steps. The computer follows the steps one by one, very fast.
A language model learns to guess the next word in a sentence. The more it reads, the better it guesses.
The little robot practiced every day. One day, it wrote its own story, and everyone smiled.
"""


def make_sample():
    """内蔵サンプルでパイプライン全体を試すための小コーパスを生成する。"""
    import random
    rng = random.Random(42)
    os.makedirs(CORPUS_DIR, exist_ok=True)
    ja_lines = [l for l in SAMPLE_JA.splitlines() if l.strip()]
    en_lines = [l for l in SAMPLE_EN.splitlines() if l.strip()]
    with open(os.path.join(CORPUS_DIR, "sample.txt"), "w", encoding="utf-8") as f:
        # 行をシャッフルしながら繰り返し書き、約2MBの擬似コーパスにする
        size = 0
        while size < 2 * 1024 * 1024:
            lines = ja_lines * 4 + en_lines  # 日本語多めの比率
            rng.shuffle(lines)
            chunk = "\n".join(lines) + "\n"
            f.write(chunk)
            size += len(chunk.encode("utf-8"))
    print(f"サンプルコーパスを生成しました: {CORPUS_DIR}/sample.txt （約{size // 1024 // 1024}MB）")


def encode(tokenizer_path: str, val_ratio: float):
    """全テキストをトークンIDに変換し、train.bin / val.bin に保存する。

    uint16で保存するため語彙数は65535以下であること（本プロジェクトは最大16000なのでOK）。
    学習時は numpy の memmap で読むので、コーパスがRAMに乗り切らなくても学習できる。
    """
    import glob

    import sentencepiece as spm

    sp = spm.SentencePieceProcessor(model_file=tokenizer_path)
    assert sp.vocab_size() <= 65535, "uint16の上限を超える語彙数です"
    eos_id = sp.piece_to_id("<|eos|>")

    files = sorted(glob.glob(os.path.join(CORPUS_DIR, "*.txt")))
    if not files:
        raise SystemExit("data/corpus/ にテキストがありません")

    all_ids: list[np.ndarray] = []
    total = 0
    for path in files:
        print(f"トークン化中: {path}")
        # errors="ignore": ダウンロード中断等で末尾が不完全なUTF-8でも処理を続行
        with open(path, encoding="utf-8", errors="ignore") as f:
            buf = []
            for line in f:
                buf.append(line)
                # 1MBごとにまとめてエンコード（1行ずつより圧倒的に速い）
                if sum(len(s) for s in buf) > 1024 * 1024:
                    ids = sp.encode("".join(buf))
                    all_ids.append(np.array(ids, dtype=np.uint16))
                    total += len(ids)
                    buf = []
            if buf:
                ids = sp.encode("".join(buf))
                all_ids.append(np.array(ids, dtype=np.uint16))
                total += len(ids)
        # ファイル（ソース）の境界に文書区切りとしてEOSを挟む
        all_ids.append(np.array([eos_id], dtype=np.uint16))
        total += 1

    data = np.concatenate(all_ids)
    n_val = max(1024, int(len(data) * val_ratio))
    train, val = data[:-n_val], data[-n_val:]
    train.tofile(os.path.join(DATA_DIR, "train.bin"))
    val.tofile(os.path.join(DATA_DIR, "val.bin"))
    print(f"完了: train {len(train):,} トークン / val {len(val):,} トークン")
    print(f"保存先: {DATA_DIR}/train.bin, val.bin")


def main():
    ap = argparse.ArgumentParser(description="学習コーパスの取得・トークン化")
    ap.add_argument("--download", nargs="*", choices=list(SOURCES) + ["all"],
                    help="取得するソース（例: --download all / --download aozora wiki）")
    ap.add_argument("--max-mb", type=int, default=None, help="各ソースの取得上限MB（省略時は既定値）")
    ap.add_argument("--sample", action="store_true", help="ネットワーク不要の内蔵サンプルを生成")
    ap.add_argument("--encode", action="store_true", help="トークン化して train.bin / val.bin を作る")
    ap.add_argument("--tokenizer", default="tokenizer/sp.model")
    ap.add_argument("--val-ratio", type=float, default=0.005)
    args = ap.parse_args()

    if args.sample:
        make_sample()
    if args.download is not None:
        sources = list(SOURCES) if (not args.download or "all" in args.download) else args.download
        for s in sources:
            download(s, args.max_mb)
    if args.encode:
        encode(args.tokenizer, args.val_ratio)
    if not (args.sample or args.download is not None or args.encode):
        ap.print_help()


if __name__ == "__main__":
    main()
