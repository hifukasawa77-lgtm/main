# runtime.py — 推論用の共通処理（chat.py / serve.py / export_onnx.py から利用）

import os

import sentencepiece as spm
import torch

from config import ModelConfig
from model import MiniLLM

BASE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CKPT = os.path.join(BASE, "checkpoints", "chat.pt")
DEFAULT_TOKENIZER = os.path.join(BASE, "tokenizer", "sp.model")


def load_model(ckpt_path: str, tokenizer_path: str) -> tuple[MiniLLM, spm.SentencePieceProcessor]:
    """チェックポイントに保存された設定からモデルを復元する。"""
    sp = spm.SentencePieceProcessor(model_file=tokenizer_path)
    ckpt = torch.load(ckpt_path, map_location="cpu", weights_only=False)
    cfg = ModelConfig(**ckpt["config"])
    cfg.dropout = 0.0  # 推論時はドロップアウト無効
    model = MiniLLM(cfg)
    model.load_state_dict(ckpt["model"])
    model.eval()
    torch.set_num_threads(os.cpu_count() or 4)
    return model, sp


def build_chat_prompt(sp, messages: list[dict]) -> list[int]:
    """会話履歴をチャットテンプレートのID列に変換する。

    messages: [{"role": "user"|"assistant", "content": str}, ...]
    形式: <|user|>発話<|assistant|>応答<|eos|><|user|>... 最後は <|assistant|> で終わる
    """
    user_id = sp.piece_to_id("<|user|>")
    asst_id = sp.piece_to_id("<|assistant|>")
    eos_id = sp.piece_to_id("<|eos|>")
    ids: list[int] = []
    for m in messages:
        if m["role"] == "user":
            ids += [user_id] + sp.encode(m["content"])
        else:
            ids += [asst_id] + sp.encode(m["content"]) + [eos_id]
    ids.append(asst_id)  # ここから先をモデルに生成させる
    return ids


def generate_text(model, sp, prompt_ids: list[int], max_new_tokens=200,
                  temperature=0.8, top_p=0.95, repetition_penalty=1.2) -> str:
    """ID列から生成し、新規生成部分だけをテキストで返す。"""
    eos_id = sp.piece_to_id("<|eos|>")
    x = torch.tensor([prompt_ids], dtype=torch.long)
    out = model.generate(x, max_new_tokens=max_new_tokens,
                         temperature=temperature, top_p=top_p, eos_id=eos_id,
                         repetition_penalty=repetition_penalty)
    new_ids = out[0, len(prompt_ids):].tolist()
    if eos_id in new_ids:
        new_ids = new_ids[: new_ids.index(eos_id)]
    return sp.decode(new_ids)
