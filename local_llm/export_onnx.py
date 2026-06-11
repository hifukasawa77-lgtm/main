# export_onnx.py — ブラウザ実行（onnxruntime-web）用のONNXエクスポート
#
# 将来ポートフォリオサイト上でブラウザ内推論デモを作るための準備スクリプト。
# KVキャッシュなしのシンプルなforwardをエクスポートする（ブラウザ側で全系列を
# 毎回渡す方式。ミニモデルなのでこれでも実用的な速度が出る）。
#
# 使い方:
#   pip install onnx
#   python export_onnx.py --ckpt checkpoints/chat.pt --out llm.onnx
#
# ブラウザ側は onnxruntime-web（CDN: cdn.jsdelivr.net/npm/onnxruntime-web）で読み込む。
# トークナイザはSentencePieceのため、ブラウザでは語彙テーブルをJSON化して
# 簡易BPEデコーダを実装するか、sentencepiece-wasm系のライブラリを使う（次タスク）。

import argparse

import torch

from runtime import DEFAULT_CKPT, DEFAULT_TOKENIZER, load_model


class ExportWrapper(torch.nn.Module):
    """ONNXに不要なtargets/KVキャッシュ引数を隠し、全位置のロジットを返す。"""

    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, idx):
        B, T = idx.shape
        cos = self.model.rope_cos[:T]
        sin = self.model.rope_sin[:T]
        x = self.model.tok_emb(idx)
        for block in self.model.blocks:
            x, _ = block(x, cos, sin, None)
        x = self.model.norm_f(x)
        return self.model.lm_head(x)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", default=DEFAULT_CKPT)
    ap.add_argument("--tokenizer", default=DEFAULT_TOKENIZER)
    ap.add_argument("--out", default="llm.onnx")
    args = ap.parse_args()

    model, sp = load_model(args.ckpt, args.tokenizer)
    wrapper = ExportWrapper(model).eval()

    dummy = torch.randint(0, sp.vocab_size(), (1, 16), dtype=torch.long)
    torch.onnx.export(
        wrapper, (dummy,), args.out,
        input_names=["input_ids"],
        output_names=["logits"],
        dynamic_axes={"input_ids": {0: "batch", 1: "seq"}, "logits": {0: "batch", 1: "seq"}},
        opset_version=17,
    )
    import os
    size_mb = os.path.getsize(args.out) / 1024 / 1024
    print(f"エクスポート完了: {args.out} （{size_mb:.1f}MB）")
    print("ブラウザでは onnxruntime-web で読み込めます（CDN経由・ビルドツール不要）")


if __name__ == "__main__":
    main()
