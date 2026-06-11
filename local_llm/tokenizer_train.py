# tokenizer_train.py — SentencePiece BPE トークナイザの学習
#
# LLMは文字をそのまま扱えないため、テキストを「トークン」（部分文字列）の列に変換する。
# ここでは日本語に強い SentencePiece の BPE モードを使い、コーパスから語彙を学習する。
#
# 使い方:
#   python tokenizer_train.py --vocab-size 16000
#   （事前に data_prepare.py --download で data/corpus/ にテキストを用意しておく）

import argparse
import glob
import os

import sentencepiece as spm

# チャット形式で使う特殊トークン。語彙の先頭に固定で割り当てる
SPECIAL_TOKENS = ["<|pad|>", "<|bos|>", "<|eos|>", "<|user|>", "<|assistant|>"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus-dir", default="data/corpus", help="学習テキスト(.txt)のディレクトリ")
    ap.add_argument("--out-prefix", default="tokenizer/sp", help="出力先プレフィックス")
    ap.add_argument("--vocab-size", type=int, default=16000)
    ap.add_argument("--max-sentences", type=int, default=4_000_000,
                    help="学習に使う最大行数（メモリ節約。16GB機なら既定値で安全）")
    args = ap.parse_args()

    files = sorted(glob.glob(os.path.join(args.corpus_dir, "*.txt")))
    if not files:
        raise SystemExit(
            f"{args.corpus_dir} に .txt がありません。先に data_prepare.py --download を実行してください")

    os.makedirs(os.path.dirname(args.out_prefix), exist_ok=True)
    print(f"コーパス: {files}")

    spm.SentencePieceTrainer.train(
        input=",".join(files),
        model_prefix=args.out_prefix,
        vocab_size=args.vocab_size,
        model_type="bpe",
        # 日本語は文字種が多いのでカバレッジを高めに設定（SentencePieceの日本語推奨値）
        character_coverage=0.9995,
        # 未知語を文字→バイト単位に分解して必ず表現できるようにする
        byte_fallback=True,
        # 特殊トークンを通常の語彙として固定登録（分割されない）
        user_defined_symbols=SPECIAL_TOKENS,
        pad_id=-1, unk_id=0, bos_id=-1, eos_id=-1,  # 制御IDはuser_defined側で管理する
        # コーパスが小さく指定語彙数に届かない場合は自動で切り詰める（サンプル実行用）
        hard_vocab_limit=False,
        input_sentence_size=args.max_sentences,
        shuffle_input_sentence=True,
        num_threads=os.cpu_count(),
        train_extremely_large_corpus=False,
    )
    sp = spm.SentencePieceProcessor(model_file=args.out_prefix + ".model")
    print(f"完了: {args.out_prefix}.model （語彙数 {sp.vocab_size()}）")
    demo = "こんにちは、私は自作のローカルLLMです。Hello, world!"
    print("動作確認:", sp.encode(demo, out_type=str))


if __name__ == "__main__":
    main()
