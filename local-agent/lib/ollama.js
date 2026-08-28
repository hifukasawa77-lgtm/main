const DEFAULT_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";

// コード生成タスク向けの既定値。
// num_ctx: Ollamaの既定(2048)はツール実行でファイル内容やgrep結果を積むとすぐ溢れ、
//   古いメッセージ（システムプロンプト含む）が黙って切り詰められてモデルが指示を見失う。
// temperature: コード生成は決定的な方が壊れにくいので既定(0.8前後)より下げる。
export const DEFAULT_MODEL_OPTIONS = { temperature: 0.2, num_ctx: 8192 };

// Ollamaの /api/chat を叩く。tool_callsが返る前提でstream:falseに固定する
// （ストリーミング中はtool_callsが末尾チャンクまで確定しないため、まずは非ストリームで確実に動かす）。
export async function chat({ model, messages, tools, options, host = DEFAULT_HOST, signal }) {
  const res = await fetch(`${host}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      tools,
      stream: false,
      options: { ...DEFAULT_MODEL_OPTIONS, ...options },
    }),
    signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Ollama呼び出し失敗 (${res.status}): ${body || res.statusText}\n` +
        `→ 'ollama serve' が起動しているか、モデル "${model}" を 'ollama pull ${model}' 済みか確認してください。`
    );
  }

  const data = await res.json();
  return data.message; // { role, content, tool_calls? }
}

export async function ping(host = DEFAULT_HOST) {
  try {
    const res = await fetch(`${host}/api/tags`);
    return res.ok;
  } catch {
    return false;
  }
}
