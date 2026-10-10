export const DEFAULT_HOST =process.env.OLLAMA_HOST || "http://localhost:11434";

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

// ストリーミング版 /api/chat。生成中に signal で止められ、止めた時点までの本文を捨てずに返す。
// 返り値: { message, aborted, stats }
//   stats = { evalCount, tokPerSec, firstTokenMs, loadMs, totalMs }（完走時のみ。中断時は null）
// Ollamaは0.8以降、ストリーム中でも tool_calls を返す。古い版で失敗するなら chat() へ戻せる（--no-stream）。
export async function chatStream({ model, messages, tools, options, host = DEFAULT_HOST, signal, onToken }) {
  const startedAt = Date.now();
  let firstTokenAt = null;
  let content = "";
  const toolCalls = [];
  let finalChunk = null;

  try {
    const res = await fetch(`${host}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        tools,
        stream: true,
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

    const decoder = new TextDecoder();
    let buffer = "";
    const handleLine = (line) => {
      if (!line.trim()) return;
      const chunk = JSON.parse(line);
      if (chunk.error) throw new Error(`Ollamaエラー: ${chunk.error}`);
      const piece = chunk.message?.content ?? "";
      if (piece) {
        if (firstTokenAt === null) firstTokenAt = Date.now();
        content += piece;
        if (onToken) onToken(piece);
      }
      if (chunk.message?.tool_calls) toolCalls.push(...chunk.message.tool_calls);
      if (chunk.done) finalChunk = chunk;
    };

    for await (const part of res.body) {
      buffer += decoder.decode(part, { stream: true });
      let nl;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        handleLine(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
      }
    }
    handleLine(buffer);
  } catch (err) {
    if (signal?.aborted || err?.name === "AbortError") {
      return { message: { role: "assistant", content }, aborted: true, stats: null };
    }
    throw err;
  }

  const message = { role: "assistant", content };
  if (toolCalls.length) message.tool_calls = toolCalls;
  return { message, aborted: false, stats: computeStats(finalChunk, startedAt, firstTokenAt) };
}

// Ollamaの時間はナノ秒。eval_duration は生成だけの時間なので、読み込みや入力処理を含まない純粋な速さになる。
export function computeStats(finalChunk, startedAt, firstTokenAt) {
  if (!finalChunk) return null;
  const evalCount = finalChunk.eval_count ?? 0;
  const evalSec = (finalChunk.eval_duration ?? 0) / 1e9;
  return {
    evalCount,
    // 標本が1つ以下のときは速さを出さない（0除算と「∞ tok/秒」の表示を避ける）
    tokPerSec: evalCount > 1 && evalSec > 0 ? evalCount / evalSec : null,
    firstTokenMs: firstTokenAt === null ? null : firstTokenAt - startedAt,
    loadMs: Math.round((finalChunk.load_duration ?? 0) / 1e6),
    totalMs: Math.round((finalChunk.total_duration ?? 0) / 1e6),
  };
}

export function formatStats(stats) {
  if (!stats) return "";
  const parts = [];
  if (stats.firstTokenMs !== null) parts.push(`最初の返事まで${(stats.firstTokenMs / 1000).toFixed(1)}秒`);
  if (stats.tokPerSec !== null) parts.push(`約${stats.tokPerSec.toFixed(1)} tok/秒`);
  parts.push(`${stats.evalCount}トークン`);
  if (stats.loadMs > 1000) parts.push(`モデル読込${(stats.loadMs / 1000).toFixed(1)}秒`);
  return parts.join(" · ");
}

// /api/ps: いまメモリに載っているモデル。size_vram / size でGPUに載っている割合が分かる。
export async function getRunning(host = DEFAULT_HOST) {
  try {
    const res = await fetch(`${host}/api/ps`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    return (await res.json()).models ?? [];
  } catch {
    return [];
  }
}

export function formatVram(running, model) {
  const m = running.find((r) => r.name === model || r.model === model || r.name?.split(":")[0] === model);
  if (!m || !m.size) return "";
  const gb = (n) => (n / 1024 ** 3).toFixed(1);
  const ratio = m.size_vram / m.size;
  const where = ratio >= 0.99 ? "GPU" : ratio <= 0.01 ? "CPUのみ" : `GPU ${Math.round(ratio * 100)}%・残りCPU`;
  return `メモリ ${gb(m.size)}GB（${where}）`;
}

// インストール済みモデルの一覧（名前とサイズ）。
export async function listModels(host = DEFAULT_HOST) {
  const res = await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return ((await res.json()).models ?? []).map((m) => ({ name: m.name, sizeGB: (m.size ?? 0) / 1024 ** 3 }));
}

// capabilities に tools を含むか。取れない版・失敗時は false（切替の候補に入れない＝安全側）。
export async function supportsTools(model, host = DEFAULT_HOST) {
  try {
    const res = await fetch(`${host}/api/show`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return false;
    const caps = (await res.json()).capabilities;
    return Array.isArray(caps) && caps.includes("tools");
  } catch {
    return false;
  }
}

export async function ping(host = DEFAULT_HOST) {
  try {
    const res = await fetch(`${host}/api/tags`);
    return res.ok;
  } catch {
    return false;
  }
}
