import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { tryLocalTool, evaluateExpression } from "../lib/localtools.js";
import { runDiagnosis, formatDiagnosis, hasFailure, classifyNetworkError } from "../lib/diagnose.js";
import { chatStream, computeStats, formatStats, formatVram } from "../lib/ollama.js";

const NOW = new Date(2026, 9, 10, 14, 5); // 2026-10-10(土) 14:05

// ---------- 端末内ツール ----------

test("計算: 優先順位・括弧・単項マイナス・べき乗の結合", () => {
  assert.equal(evaluateExpression("1+2*3"), 7);
  assert.equal(evaluateExpression("(1+2)*3"), 9);
  assert.equal(evaluateExpression("-2^2"), -4);
  assert.equal(evaluateExpression("2^3^2"), 512);
  assert.equal(evaluateExpression("10-4-3"), 3);
  assert.equal(evaluateExpression("7%4"), 3);
});

test("計算: 壊れた式は例外（eval的に通さない）", () => {
  for (const bad of ["1+", "(1+2", "1+2)", "*3", "1 2", "abc", ""]) assert.throws(() => evaluateExpression(bad), bad);
});

test("計算: 自然な入力を拾い、浮動小数の端数を丸める", () => {
  assert.equal(tryLocalTool("123*45は？", NOW).text, "123*45 = 5,535");
  assert.equal(tryLocalTool("計算 (1+2)×3", NOW).text, "(1+2)*3 = 9");
  assert.equal(tryLocalTool("０．１＋０．２", NOW).text, "0.1+0.2 = 0.3");
  assert.match(tryLocalTool("1/0", NOW).text, /計算できません/);
});

test("計算: 誤爆しない（電話番号・年号・文章・演算子なし）", () => {
  for (const s of ["2026", "090-1234-5678はどこの番号？", "1+1の意味を教えて", "JavaScriptで 1+1 を書いて", "こんにちは"]) {
    assert.equal(tryLocalTool(s, NOW), null, s);
  }
});

test("時計: 時刻・日付・曜日", () => {
  assert.equal(tryLocalTool("今何時？", NOW).text, "いまは 14:05 です。");
  assert.match(tryLocalTool("今日の日付", NOW).text, /2026年10月10日（土曜日）/);
  assert.match(tryLocalTool("今日は何曜日", NOW).text, /土曜日/);
});

test("時計: 長い文や別の意味は拾わない", () => {
  assert.equal(tryLocalTool("今何時に寝るのが健康にいいですか？", NOW), null);
  assert.equal(tryLocalTool("時間管理のコツを教えて", NOW), null);
});

test("単位換算: 長さ・重さ・温度・データ", () => {
  assert.equal(tryLocalTool("5kmは何マイル？", NOW).text, "5km = 3.106856マイル");
  assert.equal(tryLocalTool("100℃は何℉", NOW).text, "100℃ = 212℉");
  assert.equal(tryLocalTool("1GBは何MB", NOW).text, "1GB = 1,024MB");
  assert.equal(tryLocalTool("1kgは何ポンド", NOW).text, "1kg = 2.204623ポンド");
});

test("単位換算: 行き先が無い／換算できない組／文章中は拾わない", () => {
  assert.equal(tryLocalTool("100メートル走のコツ", NOW), null);
  assert.equal(tryLocalTool("5kmは何kg", NOW), null);
  assert.equal(tryLocalTool("5kmは何km", NOW), null);
  assert.equal(tryLocalTool("100mを何秒で走れる？", NOW), null);
});

// ---------- 診断 ----------

function fakeFetch(routes) {
  return async (url) => {
    const path = new URL(url).pathname;
    const r = routes[path];
    if (r instanceof Error) throw r;
    if (!r) return new Response("not found", { status: 404 });
    return new Response(typeof r.body === "string" ? r.body : JSON.stringify(r.body), { status: r.status ?? 200 });
  };
}
const refused = Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } });

test("診断: 未起動 → 起動手順を出し、以降の検査は打ち切る", async () => {
  const r = await runDiagnosis({ fetchFn: fakeFetch({ "/api/version": refused }) });
  assert.equal(r.length, 1);
  assert.equal(r[0].status, "fail");
  assert.match(r[0].next, /ollama serve/);
  assert.ok(hasFailure(r));
});

test("診断: 別のソフトがポートを占有（Ollamaでない応答）", async () => {
  const r = await runDiagnosis({ fetchFn: fakeFetch({ "/api/version": { body: "<html>hello</html>" } }) });
  assert.equal(r[0].status, "fail");
  assert.match(r[0].next, /別のソフト/);
});

test("診断: モデル未導入 → pull コマンドと入っているモデルを案内", async () => {
  const r = await runDiagnosis({
    model: "qwen2.5",
    fetchFn: fakeFetch({
      "/api/version": { body: { version: "0.9.0" } },
      "/api/tags": { body: { models: [{ name: "llama3.2:latest" }] } },
      "/api/ps": { body: { models: [] } },
    }),
  });
  const m = r.find((x) => x.id === "model");
  assert.equal(m.status, "fail");
  assert.match(m.next, /ollama pull qwen2.5/);
  assert.match(m.detail, /llama3.2/);
  assert.equal(r.find((x) => x.id === "tools"), undefined, "入っていないモデルの tools は調べない");
});

test("診断: GPU分割・CPUのみは警告、全GPUはOK、tools非対応は警告", async () => {
  const base = {
    "/api/version": { body: { version: "0.9.0" } },
    "/api/tags": { body: { models: [{ name: "qwen2.5:latest" }] } },
    "/api/show": { body: { capabilities: ["completion"] } },
  };
  const run = (ps) =>
    runDiagnosis({ model: "qwen2.5", fetchFn: fakeFetch({ ...base, "/api/ps": { body: { models: ps } } }) });

  const half = await run([{ name: "qwen2.5:latest", size: 100, size_vram: 40 }]);
  assert.equal(half.find((x) => x.id === "vram").status, "warn");
  assert.match(half.find((x) => x.id === "vram").detail, /40%/);

  const cpu = await run([{ name: "qwen2.5:latest", size: 100, size_vram: 0 }]);
  assert.match(cpu.find((x) => x.id === "vram").detail, /CPUだけ/);

  const full = await run([{ name: "qwen2.5:latest", size: 100, size_vram: 100 }]);
  assert.equal(full.find((x) => x.id === "vram").status, "ok");

  assert.equal(full.find((x) => x.id === "tools").status, "warn");
  assert.ok(!hasFailure(full));
  assert.match(formatDiagnosis(full), /注意点/);
});

test("診断: 不正な OLLAMA_HOST を検出", async () => {
  const r = await runDiagnosis({ host: "localhost11434", fetchFn: fakeFetch({}) });
  assert.equal(r[0].id, "host");
  assert.equal(r[0].status, "fail");
});

test("診断: ネットワークエラーの分類", () => {
  assert.equal(classifyNetworkError(refused), "refused");
  assert.equal(classifyNetworkError(Object.assign(new Error("x"), { name: "TimeoutError" })), "timeout");
  assert.equal(classifyNetworkError(Object.assign(new Error("x"), { cause: { code: "ENOTFOUND" } })), "dns");
  assert.equal(classifyNetworkError(new Error("???")), "other");
});

// ---------- 速さの表示 ----------

test("速さ: 標本が1つ以下なら tok/秒を出さない／VRAM表示", () => {
  const one = computeStats({ eval_count: 1, eval_duration: 1e9 }, 0, 100);
  assert.equal(one.tokPerSec, null);
  const s = computeStats({ eval_count: 20, eval_duration: 2e9, load_duration: 3e9 }, 0, 1500);
  assert.equal(s.tokPerSec, 10);
  assert.equal(formatStats(s), "最初の返事まで1.5秒 · 約10.0 tok/秒 · 20トークン · モデル読込3.0秒");
  assert.equal(formatStats(null), "");
  const gb = 1024 ** 3;
  assert.match(formatVram([{ name: "q:latest", model: "q:latest", size: 4 * gb, size_vram: 4 * gb }], "q:latest"), /GPU）/);
  assert.match(formatVram([{ name: "q:latest", size: 4 * gb, size_vram: 0 }], "q"), /CPUのみ/);
  assert.equal(formatVram([], "q"), "");
});

// ---------- ストリーミング・中断（実HTTP） ----------

function serve(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => resolve({ server, host: `http://127.0.0.1:${server.address().port}` }));
  });
}
const nd = (o) => JSON.stringify(o) + "\n";

test("ストリーム: 本文を連結し、チャンク境界が行の途中でも壊れない／統計を返す", async () => {
  const { server, host } = await serve((req, res) => {
    res.write(nd({ message: { content: "こん" } }).slice(0, 10)); // 行の途中で切れる
    setTimeout(() => {
      res.write(nd({ message: { content: "こん" } }).slice(10));
      res.write(nd({ message: { content: "にちは" } }));
      res.end(nd({ done: true, eval_count: 5, eval_duration: 1e9, load_duration: 0, total_duration: 2e9, message: { content: "" } }));
    }, 20);
  });
  try {
    const seen = [];
    const r = await chatStream({ model: "m", messages: [], host, onToken: (t) => seen.push(t) });
    assert.equal(r.message.content, "こんにちは");
    assert.deepEqual(seen, ["こん", "にちは"]);
    assert.equal(r.aborted, false);
    assert.equal(r.stats.tokPerSec, 5);
  } finally {
    server.close();
  }
});

test("ストリーム: tool_calls をストリーム越しに受け取る", async () => {
  const call = { function: { name: "read_file", arguments: { path: "a.txt" } } };
  const { server, host } = await serve((req, res) => {
    res.write(nd({ message: { content: "", tool_calls: [call] } }));
    res.end(nd({ done: true, eval_count: 3, eval_duration: 1e9, message: { content: "" } }));
  });
  try {
    const r = await chatStream({ model: "m", messages: [], host });
    assert.deepEqual(r.message.tool_calls, [call]);
  } finally {
    server.close();
  }
});

test("ストリーム: 中断しても、それまでに書けた分を捨てない", async () => {
  let sockets = [];
  const { server, host } = await serve((req, res) => {
    sockets.push(res);
    res.write(nd({ message: { content: "途中まで" } }));
    // 終わらせない（暴走した長文生成のつもり）
  });
  try {
    const ac = new AbortController();
    const p = chatStream({ model: "m", messages: [], host, signal: ac.signal, onToken: () => setTimeout(() => ac.abort(), 10) });
    const r = await p;
    assert.equal(r.aborted, true);
    assert.equal(r.message.content, "途中まで");
    assert.equal(r.stats, null);
  } finally {
    sockets.forEach((s) => s.destroy());
    server.close();
  }
});

test("ストリーム: HTTPエラーと途中のerrorチャンクは理由つきで投げる（黙って空にしない）", async () => {
  const a = await serve((req, res) => {
    res.statusCode = 404;
    res.end("model 'm' not found");
  });
  try {
    await assert.rejects(chatStream({ model: "m", messages: [], host: a.host }), /404.*not found/s);
  } finally {
    a.server.close();
  }
  const b = await serve((req, res) => res.end(nd({ error: "out of memory" })));
  try {
    await assert.rejects(chatStream({ model: "m", messages: [], host: b.host }), /out of memory/);
  } finally {
    b.server.close();
  }
});
