# chat.py — 自作LLMとのCLIチャット
#
# 使い方:
#   python chat.py                          # checkpoints/chat.pt と対話
#   python chat.py --ckpt checkpoints/latest.pt --raw   # 事前学習モデルで文章の続き生成
#   python chat.py --prompt "こんにちは"     # 一回だけ生成して終了（テスト用）
#
# コマンド: /reset で会話履歴をクリア、/quit で終了

import argparse

import torch

from runtime import DEFAULT_CKPT, DEFAULT_TOKENIZER, build_chat_prompt, generate_text, load_model


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", default=DEFAULT_CKPT)
    ap.add_argument("--tokenizer", default=DEFAULT_TOKENIZER)
    ap.add_argument("--max-new-tokens", type=int, default=200)
    ap.add_argument("--temperature", type=float, default=0.8)
    ap.add_argument("--top-p", type=float, default=0.95)
    ap.add_argument("--raw", action="store_true",
                    help="チャットテンプレートを使わず素の続き生成（事前学習モデルの確認用）")
    ap.add_argument("--prompt", default=None, help="一回だけ生成して終了（非対話モード）")
    args = ap.parse_args()

    model, sp = load_model(args.ckpt, args.tokenizer)
    print(f"モデル読み込み完了（パラメータ数 {model.num_params():,}）")

    def respond(messages_or_text):
        if args.raw:
            ids = sp.encode(messages_or_text)
        else:
            ids = build_chat_prompt(sp, messages_or_text)
        return generate_text(model, sp, ids, args.max_new_tokens, args.temperature, args.top_p)

    if args.prompt is not None:
        text = respond(args.prompt if args.raw else [{"role": "user", "content": args.prompt}])
        print(text)
        return

    print("チャットを開始します（/reset で履歴クリア、/quit で終了）")
    history: list[dict] = []
    while True:
        try:
            user = input("\nあなた> ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if not user:
            continue
        if user == "/quit":
            break
        if user == "/reset":
            history = []
            print("（履歴をクリアしました）")
            continue

        if args.raw:
            reply = respond(user)
        else:
            history.append({"role": "user", "content": user})
            with torch.no_grad():
                reply = respond(history)
            history.append({"role": "assistant", "content": reply})
        print(f"LLM> {reply}")

    print("終了します。")


if __name__ == "__main__":
    main()
