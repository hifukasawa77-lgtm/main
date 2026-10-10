// ワンクリック診断：起動できない原因を順に確かめ、日本語で「次の一手」を出す。
//
// 「接続できません」だけで終わらせない。段階を分けて、どこで止まっているかを1行で言う：
//   1. Ollama に届くか（未起動／ポート違い／別のソフトが占有）
//   2. 使うモデルが入っているか
//   3. モデルがGPUに載るか（CPU分割だと極端に遅い）
//   4. tool calling に対応しているか
// fetchFn を差し替えられるので、Ollama 無しで機械検査できる。

import { DEFAULT_HOST } from "./ollama.js";

const TIMEOUT_MS = 4000;

export function classifyNetworkError(err) {
  const code = err?.cause?.code ?? err?.code;
  if (code === "ECONNREFUSED") return "refused";
  if (err?.name === "TimeoutError" || err?.name === "AbortError" || code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT")
    return "timeout";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "dns";
  return "other";
}

function portOf(host) {
  try {
    return new URL(host).port || "11434";
  } catch {
    return null;
  }
}

async function getJson(fetchFn, url, init) {
  const res = await fetchFn(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // JSONでない＝Ollama以外が応答している可能性
  }
  return { res, json, text };
}

// 各検査は { id, title, status: 'ok'|'warn'|'fail'|'skip', detail, next? } を返す。
export async function runDiagnosis({ host = DEFAULT_HOST, model = "qwen2.5", fetchFn = fetch } = {}) {
  const results = [];
  const add = (r) => results.push(r);

  // 0. ホスト指定の形
  if (portOf(host) === null) {
    add({
      id: "host",
      title: "接続先の指定",
      status: "fail",
      detail: `OLLAMA_HOST が URL として読めません: ${host}`,
      next: "例: set OLLAMA_HOST=http://localhost:11434（http:// から始めてください）",
    });
    return results;
  }

  // 1. 届くか
  let version = null;
  try {
    const { res, json } = await getJson(fetchFn, `${host}/api/version`);
    if (res.ok && json && typeof json.version === "string") {
      version = json.version;
      add({ id: "reach", title: "Ollamaへの接続", status: "ok", detail: `${host}（バージョン ${version}）` });
    } else {
      add({
        id: "reach",
        title: "Ollamaへの接続",
        status: "fail",
        detail: `${host} は応答しましたが Ollama ではないようです（HTTP ${res.status}）`,
        next: `ポート${portOf(host)}を別のソフトが使っている可能性があります。Ollama を別ポートで起動する（OLLAMA_HOST=127.0.0.1:11435 ollama serve）か、使っているソフトを止めてください`,
      });
    }
  } catch (err) {
    const kind = classifyNetworkError(err);
    const next = {
      refused: "Ollama が起動していません。別の端末で `ollama serve` を実行してください（インストール済みならタスクトレイのアイコンからも起動できます）",
      timeout: "接続がタイムアウトしました。Ollama が起動途中か、ファイアウォール・VPNが止めている可能性があります",
      dns: "ホスト名が解決できません。OLLAMA_HOST のつづりを確認してください",
      other: `原因を特定できませんでした（${err?.message ?? err}）。OLLAMA_HOST と Ollama の起動を確認してください`,
    }[kind];
    add({ id: "reach", title: "Ollamaへの接続", status: "fail", detail: `${host} に届きません`, next });
    return results; // 届かないなら以降は検査できない
  }
  if (!version) return results;

  // 2. モデルが入っているか
  let installed = [];
  try {
    const { res, json } = await getJson(fetchFn, `${host}/api/tags`);
    if (!res.ok || !json) throw new Error(`HTTP ${res.status}`);
    installed = (json.models ?? []).map((m) => m.name);
    const wanted = model.includes(":") ? model : `${model}:latest`;
    const hit = installed.find((n) => n === model || n === wanted);
    if (hit) {
      add({ id: "model", title: `モデル「${model}」`, status: "ok", detail: "インストール済み" });
    } else {
      const sample = installed.slice(0, 5).join(", ");
      add({
        id: "model",
        title: `モデル「${model}」`,
        status: "fail",
        detail: installed.length ? `入っていません（入っているもの: ${sample}）` : "モデルが1つも入っていません",
        next: `ollama pull ${model}（または --model= で入っているモデルを指定）`,
      });
    }
  } catch (err) {
    add({ id: "model", title: `モデル「${model}」`, status: "warn", detail: `一覧を取れませんでした（${err.message}）` });
  }

  // 3. GPUに載っているか（読み込み済みのときだけ分かる）
  try {
    const { json } = await getJson(fetchFn, `${host}/api/ps`);
    const loaded = (json?.models ?? []).find((m) => m.name === model || m.model === model || m.name?.split(":")[0] === model);
    if (!loaded) {
      add({ id: "vram", title: "GPUへの載り方", status: "skip", detail: "モデルが未読込のため判定できません（最初の質問で読み込まれます。大きいモデルは数十秒かかります）" });
    } else if (loaded.size && loaded.size_vram / loaded.size < 0.99) {
      const pct = Math.round((loaded.size_vram / loaded.size) * 100);
      add({
        id: "vram",
        title: "GPUへの載り方",
        status: "warn",
        detail: pct === 0 ? "GPUに載らず、CPUだけで動いています" : `GPUに載っているのは ${pct}%（残りはCPU）です`,
        next: "かなり遅くなります。より小さいモデル（例: 3B級）か、量子化の細かいものへ変えるか、他のアプリのVRAM使用を減らしてください",
      });
    } else {
      add({ id: "vram", title: "GPUへの載り方", status: "ok", detail: "全てGPUに載っています" });
    }
  } catch {
    add({ id: "vram", title: "GPUへの載り方", status: "skip", detail: "取得できませんでした" });
  }

  // 4. tool calling に対応しているか（capabilities の有無だけ。実挙動は起動時の自己診断が見る）
  const modelResult = results.find((r) => r.id === "model");
  if (modelResult?.status === "ok") {
    try {
      const { res, json } = await getJson(fetchFn, `${host}/api/show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });
      if (!res.ok || !json) throw new Error(`HTTP ${res.status}`);
      const caps = json.capabilities;
      if (Array.isArray(caps) && !caps.includes("tools")) {
        add({
          id: "tools",
          title: "ツール呼び出し対応",
          status: "warn",
          detail: "このモデルは tools に対応していません",
          next: "ファイル編集などのツールは動きません。qwen2.5 などへ変えてください",
        });
      } else {
        add({
          id: "tools",
          title: "ツール呼び出し対応",
          status: "ok",
          detail: Array.isArray(caps) ? "対応（ただし実際の挙動は起動時の自己診断で確かめます）" : "この版のOllamaは対応情報を返しません",
        });
      }
    } catch {
      add({ id: "tools", title: "ツール呼び出し対応", status: "skip", detail: "取得できませんでした" });
    }
  }

  return results;
}

const ICON = { ok: "✅", warn: "⚠️ ", fail: "❌", skip: "－ " };

export function formatDiagnosis(results) {
  const lines = ["ZERO-1 診断", ""];
  for (const r of results) {
    lines.push(`${ICON[r.status]} ${r.title}: ${r.detail}`);
    if (r.next) lines.push(`    → ${r.next}`);
  }
  const fails = results.filter((r) => r.status === "fail").length;
  const warns = results.filter((r) => r.status === "warn").length;
  lines.push("", fails ? `問題が${fails}件あります。上の「→」を上から順に直してください。` : warns ? "動きますが注意点があります。" : "問題は見つかりませんでした。");
  return lines.join("\n");
}

export const hasFailure = (results) => results.some((r) => r.status === "fail");
