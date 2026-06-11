# serve.py — ゲーム組み込み用のローカルAPIサーバー（FastAPI）
#
# ポートフォリオのゲームHTML（ZELDA QUEST等）からNPC会話などに使うための
# ローカル専用エンドポイント。外部公開はしない前提（127.0.0.1にバインド）。
#
# 起動:
#   python serve.py                          # checkpoints/chat.pt を使用
#   python serve.py --ckpt checkpoints/latest.pt --port 8765
#
# ゲーム側からの呼び出し例（JavaScript）:
#   const res = await fetch("http://127.0.0.1:8765/chat", {
#     method: "POST", headers: {"Content-Type": "application/json"},
#     body: JSON.stringify({messages: [{role: "user", content: "こんにちは、旅の人"}]})
#   });
#   const data = await res.json();  // data.text に応答

import argparse

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from runtime import DEFAULT_CKPT, DEFAULT_TOKENIZER, build_chat_prompt, generate_text, load_model

app = FastAPI(title="hide local LLM", description="自作ミニLLMのローカル推論API")

# ローカルのHTMLファイル（file:// や localhost）から呼べるようCORSを全許可。
# 127.0.0.1バインドなので外部ネットワークからはアクセスできない
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

model = None
sp = None


class GenerateRequest(BaseModel):
    prompt: str
    max_new_tokens: int = Field(default=120, le=512)
    temperature: float = Field(default=0.8, gt=0.0, le=2.0)
    top_p: float = Field(default=0.95, gt=0.0, le=1.0)


class ChatMessage(BaseModel):
    role: str  # "user" または "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    max_new_tokens: int = Field(default=120, le=512)
    temperature: float = Field(default=0.8, gt=0.0, le=2.0)
    top_p: float = Field(default=0.95, gt=0.0, le=1.0)


@app.get("/health")
def health():
    return {"status": "ok", "params": model.num_params() if model else 0}


@app.post("/generate")
def generate(req: GenerateRequest):
    """素の続き生成（事前学習モデル向け / フレーバーテキスト生成など）。"""
    ids = sp.encode(req.prompt)
    text = generate_text(model, sp, ids, req.max_new_tokens, req.temperature, req.top_p)
    return {"text": text}


@app.post("/chat")
def chat(req: ChatRequest):
    """チャット形式の応答（NPC会話など）。"""
    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    ids = build_chat_prompt(sp, messages)
    text = generate_text(model, sp, ids, req.max_new_tokens, req.temperature, req.top_p)
    return {"text": text}


def main():
    global model, sp
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", default=DEFAULT_CKPT)
    ap.add_argument("--tokenizer", default=DEFAULT_TOKENIZER)
    ap.add_argument("--port", type=int, default=8765)
    args = ap.parse_args()

    model, sp = load_model(args.ckpt, args.tokenizer)
    print(f"モデル読み込み完了（パラメータ数 {model.num_params():,}）")

    import uvicorn
    # ローカル専用: 127.0.0.1 以外からはアクセス不可
    uvicorn.run(app, host="127.0.0.1", port=args.port)


if __name__ == "__main__":
    main()
