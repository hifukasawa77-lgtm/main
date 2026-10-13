#!/usr/bin/env node
import readline from "node:readline/promises";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chat, chatStream, ping, getRunning, formatStats, formatVram, listModels, supportsTools, DEFAULT_HOST, DEFAULT_MODEL_OPTIONS } from "./lib/ollama.js";
import { buildIndex, search, formatContext } from "./lib/rag.js";
import { composeSystem, extractSummary, compactIfNeeded, estimateTokens } from "./lib/memory.js";
import { chooseModel } from "./lib/router.js";
import { runDiagnosis, formatDiagnosis, hasFailure } from "./lib/diagnose.js";
import { tryLocalTool } from "./lib/localtools.js";
import { TOOL_DEFS, READ_ONLY_TOOLS, makeToolImpls } from "./lib/tools.js";
import { assessShellCommand } from "./lib/sandbox.js";
import { formatDiff } from "./lib/diff.js";

const MAX_TURN_ITERATIONS = 25;
const AGENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SESSIONS_DIR = path.join(AGENT_DIR, ".sessions");
const PROJECT_CONTEXT_FILES = ["AGENTS.md", "CLAUDE.md"];
const PROJECT_CONTEXT_MAX_CHARS = 4000;

function parseArgs(argv) {
  const opts = {
    model: "qwen2.5",
    root: process.cwd(),
    task: null,
    temperature: undefined,
    numCtx: undefined,
    session: null,
    skipToolCheck: false,
    diagnose: false,
    stream: true,
    rag: [],
    maxModelGB: 10,
  };
  const rest = [];
  for (const arg of argv) {
    if (arg.startsWith("--model=")) opts.model = arg.slice("--model=".length);
    else if (arg.startsWith("--root=")) opts.root = path.resolve(arg.slice("--root=".length));
    else if (arg.startsWith("--temperature=")) opts.temperature = Number(arg.slice("--temperature=".length));
    else if (arg.startsWith("--num-ctx=")) opts.numCtx = Number(arg.slice("--num-ctx=".length));
    else if (arg.startsWith("--session=")) opts.session = arg.slice("--session=".length);
    else if (arg === "--skip-tool-check") opts.skipToolCheck = true;
    else if (arg === "--diagnose") opts.diagnose = true;
    else if (arg === "--no-stream") opts.stream = false;
    else if (arg.startsWith("--rag=")) opts.rag.push(...arg.slice("--rag=".length).split(",").filter(Boolean).map((d) => path.resolve(d)));
    else if (arg.startsWith("--max-model-gb=")) opts.maxModelGB = Number(arg.slice("--max-model-gb=".length));
    else rest.push(arg);
  }
  if (rest.length) opts.task = rest.join(" ");
  return opts;
}

// root直下に AGENTS.md / CLAUDE.md のようなプロジェクト規約ファイルがあれば読み込み、
// システムプロンプトへ混ぜる。無闇な推測実装を減らすための追加コンテキスト。
async function loadProjectContext(root) {
  for (const name of PROJECT_CONTEXT_FILES) {
    try {
      let text = await fs.readFile(path.join(root, name), "utf8");
      let truncated = false;
      if (text.length > PROJECT_CONTEXT_MAX_CHARS) {
        text = text.slice(0, PROJECT_CONTEXT_MAX_CHARS);
        truncated = true;
      }
      return { file: name, text, truncated };
    } catch {
      // 次の候補へ
    }
  }
  return null;
}

function buildSystemPrompt(root, projectContext) {
  const base = `あなたはローカルで動くコーディングタスク実行エージェントです。
作業ディレクトリ（root）は ${root} に固定されています。ファイル操作はすべてこの配下の相対パスで行ってください。
道具（tools）を使って調べ物・ファイル編集・コマンド実行を行い、完了したら簡潔に日本語で結果を報告してください。

コード生成の精度を落とさないための必須ルール:
- 存在しないAPI・関数名・ライブラリ名を推測で書かない。使う前に read_file / grep / list_dir で実在を確認する。
- 既存ファイルを直す場合は write_file（全文上書き）ではなく、まず read_file で現状を読んでから edit_file で最小差分の変更を行う。old_string はファイル内で一意になる十分な長さ（前後の文脈を含める）で指定する。
- 新規ファイル作成のとき以外は write_file を使わない。既存コードの書き直しに write_file を使うと、確認していない箇所まで無言で消える。
- edit_file / write_file の直後にツール応答へ構文チェック結果（JS: node --check, JSON: パース結果）が付く場合がある。エラーが出ていたら「完了」と報告せず、その場で修正してから再度書き込むこと。
- 複数ファイルにまたがる変更は、着手前に grep で影響範囲（呼び出し元・参照箇所）を洗い出してから進める。
- 迷ったら止まって確認ツールで調べる。存在確認なしの推測実装は不合格とみなす。

write_file・edit_file・run_shell はユーザーの確認を経てから実行されます。拒否された場合は代替案を考えてください。`;

  if (!projectContext) return base;

  return `${base}

--- プロジェクト固有の規約（${projectContext.file}${projectContext.truncated ? "・先頭のみ抜粋" : ""}） ---
${projectContext.text}`;
}

function formatToolCallForConfirm(name, args) {
  if (name === "run_shell") return `$ ${args.command}`;
  if (name === "write_file") return `${args.path} へ書き込み (${(args.content ?? "").length}文字)`;
  if (name === "edit_file") return `${args.path} を編集\n${formatDiff(args.old_string ?? "", args.new_string ?? "")}`;
  return JSON.stringify(args);
}

async function confirm(rl, name, args, root) {
  console.log(`\n\x1b[33m[確認] ${name}\x1b[0m`);

  let requireFullYes = false;
  if (name === "run_shell") {
    const { dangerous, reasons } = assessShellCommand(args.command, root);
    if (dangerous) {
      requireFullYes = true;
      console.log("\x1b[41m\x1b[97m⚠ 危険な可能性のあるコマンドです\x1b[0m");
      for (const reason of reasons) console.log(`  - ${reason}`);
      console.log(
        "  ※ これは文字列パターンによる簡易警告であり、コマンドを実際にサンドボックス内へ" +
          "閉じ込めているわけではありません。最終判断は内容をよく読んで行ってください。"
      );
    }
  }

  console.log(formatToolCallForConfirm(name, args));
  const question = requireFullYes
    ? '本当に実行しますか？ 続行するには "yes" と入力してください: '
    : "実行しますか？ [y/N]: ";
  const ans = await rl.question(question);
  const normalized = ans.replace(/^﻿/, "").trim();
  return requireFullYes ? /^yes$/i.test(normalized) : /^y(es)?$/i.test(normalized);
}

// 生成中の Ctrl+C は「アプリを終了」ではなく「この返答を止める」。
// それまでに書けた分は捨てない（捨てると止める＝やり直しになり、結局みんな待つ）。
async function generate({ model, messages, modelOptions, rl, stream }) {
  if (!stream) {
    const message = await chat({ model, messages, tools: TOOL_DEFS, options: modelOptions });
    console.log(`\n${message.content}`);
    return { message, aborted: false, stats: null };
  }
  const ac = new AbortController();
  const onSigint = () => ac.abort();
  rl.on("SIGINT", onSigint);
  console.log("\x1b[2m（Ctrl+C でこの返答を止められます）\x1b[0m");
  try {
    return await chatStream({
      model,
      messages,
      tools: TOOL_DEFS,
      options: modelOptions,
      signal: ac.signal,
      onToken: (t) => process.stdout.write(t),
    });
  } finally {
    rl.off("SIGINT", onSigint);
  }
}

// 端末内ツールで確定できるものは、モデルを呼ばずに答える（GPUを回さない＝即答・電池を食わない・言い間違えない）。
// 会話履歴には残す。残さないと「さっきの計算の答えに2を足して」が繋がらない。
// 画面でも「ツールが答えた」と分かるようにする（AIが時計を読めた、と誤解されないため）。
async function answerLocally(text, messages, onSave) {
  const hit = tryLocalTool(text);
  if (!hit) return false;
  console.log(`\n\x1b[36m[端末内ツール: ${hit.label}]\x1b[0m ${hit.text}\n`);
  messages.push({ role: "user", content: text });
  messages.push({ role: "assistant", content: `[端末内ツール: ${hit.label}] ${hit.text}` });
  if (onSave) await onSave(messages);
  return true;
}

async function runTurn({ messages, model, root, tools, rl, modelOptions, onSave, stream = true }) {
  for (let i = 0; i < MAX_TURN_ITERATIONS; i++) {
    const { message, aborted, stats } = await generate({ model, messages, modelOptions, rl, stream });

    if (aborted) {
      console.log("\n\x1b[33m（止めました）\x1b[0m\n");
      if (message.content.trim()) {
        messages.push({ role: "assistant", content: message.content });
        if (onSave) await onSave(messages);
      }
      return;
    }

    messages.push(message);
    if (onSave) await onSave(messages);

    if (!message.tool_calls || message.tool_calls.length === 0) {
      console.log("");
      const line = [formatStats(stats), formatVram(await getRunning(), model)].filter(Boolean).join(" ｜ ");
      if (line) console.log(`\x1b[2m${line}\x1b[0m`);
      console.log("");
      return;
    }

    for (const call of message.tool_calls) {
      const name = call.function.name;
      let result;
      try {
        // 引数のJSONパースもtry内で行う。ここが外にあると、モデルが壊れたJSONを
        // 返しただけでエージェント全体が例外で落ちてしまう。
        const args =
          typeof call.function.arguments === "string"
            ? JSON.parse(call.function.arguments)
            : call.function.arguments;

        if (!READ_ONLY_TOOLS.has(name)) {
          const ok = await confirm(rl, name, args, root);
          if (!ok) {
            result = "ユーザーが実行を拒否しました。別の方法を検討してください。";
            messages.push({ role: "tool", tool_call_id: call.id, name, content: result });
            if (onSave) await onSave(messages);
            continue;
          }
        }
        result = await tools[name](args);
      } catch (err) {
        result = `エラー: ${err.message}`;
      }
      messages.push({ role: "tool", tool_call_id: call.id, name, content: String(result) });
      if (onSave) await onSave(messages);
    }
  }
  console.log("\n（最大反復回数に達したため中断しました）\n");
}

// モデルが実際にOllamaの tool_calls 形式で応答するかを起動時に軽く確認する。
// 「ollama show の capabilities に tools と出ていても、実際は関数呼び出しをJSON文字列
// として content に書くだけ」というモデルが実在する（qwen2.5-coder:3b で確認済み）。
// そのまま気づかず使うとツール実行ループが一切発火せず、ただの雑談になる。
async function verifyToolCalling(model, modelOptions) {
  try {
    const message = await chat({
      model,
      messages: [
        { role: "system", content: "You must respond only by calling the provided tool." },
        { role: "user", content: "Call the `ping` tool now, with no arguments." },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "ping",
            description: "Call this to confirm tool calling works.",
            parameters: { type: "object", properties: {}, required: [] },
          },
        },
      ],
      options: modelOptions,
    });
    return { ok: Array.isArray(message.tool_calls) && message.tool_calls.length > 0, inconclusive: false };
  } catch (err) {
    return { ok: false, inconclusive: true, error: err.message };
  }
}

function sessionPath(name) {
  return path.join(SESSIONS_DIR, `${name}.json`);
}

async function loadSession(name) {
  try {
    return JSON.parse(await fs.readFile(sessionPath(name), "utf8"));
  } catch {
    return null;
  }
}

async function saveSession(name, messages) {
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
  await fs.writeFile(sessionPath(name), JSON.stringify(messages, null, 2), "utf8");
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.diagnose) {
    const results = await runDiagnosis({ host: DEFAULT_HOST, model: opts.model === "auto" ? "qwen2.5" : opts.model });
    console.log(formatDiagnosis(results));
    process.exit(hasFailure(results) ? 1 : 0);
  }

  if (!(await ping())) {
    // 「接続できません」だけで終わらせず、どこで止まっているかと次の一手まで出す
    console.error(formatDiagnosis(await runDiagnosis({ host: DEFAULT_HOST, model: opts.model === "auto" ? "qwen2.5" : opts.model })));
    process.exit(1);
  }

  const tools = makeToolImpls(opts.root);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const modelOptions = {
    ...(opts.temperature !== undefined && { temperature: opts.temperature }),
    ...(opts.numCtx !== undefined && { num_ctx: opts.numCtx }),
  };

  console.log(`local-agent — model: ${opts.model === "auto" ? "auto（自動切替）" : opts.model} / root: ${opts.root}`);

  if (opts.session && /[\\/]/.test(opts.session)) {
    console.error("--session の名前にパス区切り文字は使えません。");
    rl.close();
    process.exit(1);
  }

  // auto のときは切替先ごとに実挙動を確かめる（routeModel）ので、ここでは確かめない
  if (!opts.skipToolCheck && opts.model !== "auto") {
    process.stdout.write("モデルのtool calling対応を確認中...");
    const check = await verifyToolCalling(opts.model, modelOptions);
    if (check.inconclusive) {
      console.log(` 確認できませんでした（続行します: ${check.error}）`);
    } else if (!check.ok) {
      console.log(" NG");
      console.log(
        `\x1b[31m警告: モデル "${opts.model}" はOllamaの tool_calls 形式で応答しませんでした。\n` +
          "ollama show の capabilities に tools と出ていても、実際は関数呼び出しをJSON文字列として\n" +
          "content に書くだけのモデルがあります。その場合このエージェントのツール実行ループは\n" +
          "一切発火せず、ただの雑談になります。\x1b[0m"
      );
      const ans = await rl.question("それでも続行しますか？ [y/N]: ");
      if (!/^y(es)?$/i.test(ans.trim())) {
        rl.close();
        process.exit(1);
      }
    } else {
      console.log(" OK");
    }
  }

  const projectContext = await loadProjectContext(opts.root);
  if (projectContext) {
    const suffix = projectContext.truncated ? `（先頭${PROJECT_CONTEXT_MAX_CHARS}文字のみ）` : "";
    console.log(`プロジェクト規約を読み込みました: ${projectContext.file}${suffix}`);
  }
  const baseSystem = buildSystemPrompt(opts.root, projectContext);
  const numCtx = modelOptions.num_ctx ?? DEFAULT_MODEL_OPTIONS.num_ctx;

  // 会話の状態。system は「基本＋要約＋参考資料」を毎ターン組み直す（会話の途中に system を挟まない）。
  const state = { summary: "", ragIndex: null, ragSources: [], model: opts.model === "auto" ? null : opts.model };

  let messages;
  const onSave = opts.session ? (msgs) => saveSession(opts.session, msgs) : null;
  if (opts.session) {
    const loaded = await loadSession(opts.session);
    if (loaded && loaded.length) {
      messages = loaded;
      // systemPrompt は毎回作り直すので、上書きする前に要約だけ取り戻す（取り戻さないと再開のたびに忘れる）
      if (messages[0]?.role === "system") state.summary = extractSummary(messages[0].content);
      const sys = composeSystem(baseSystem, state.summary, "");
      if (messages[0]?.role === "system") messages[0].content = sys;
      else messages.unshift({ role: "system", content: sys });
      console.log(`セッション "${opts.session}" を再開します（${messages.length}件のメッセージ${state.summary ? "・要約あり" : ""}）`);
    } else {
      messages = [{ role: "system", content: baseSystem }];
    }
    console.log(`セッション保存先: ${sessionPath(opts.session)}`);
  } else {
    messages = [{ role: "system", content: baseSystem }];
  }

  if (opts.rag.length) {
    process.stdout.write(`資料を索引化中: ${opts.rag.join(", ")} ...`);
    const { index, stats } = await buildIndex(opts.rag);
    state.ragIndex = index;
    console.log(` ${stats.files}ファイル・${stats.chunks}抜粋`);
    const notes = [];
    if (stats.truncated) notes.push("上限に達したため一部のみ");
    if (stats.skippedBig) notes.push(`1MB超 ${stats.skippedBig}件を除外`);
    if (stats.skippedSecret) notes.push(`秘密っぽい名前 ${stats.skippedSecret}件を除外`);
    if (stats.unreadable) notes.push(`読めない ${stats.unreadable}件`);
    if (notes.length) console.log(`  ※ ${notes.join(" / ")}`);
    if (!stats.chunks) console.log("  ※ 索引が空です。フォルダのパスと拡張子（.md .txt .js など）を確認してください。");
  }

  // ---- モデル自動切替 ----
  const routing = { candidates: null, excluded: new Set(), verified: new Set() };
  async function routeModel(userText, ragChars) {
    if (opts.model !== "auto") return;
    if (!routing.candidates) {
      const all = await listModels();
      routing.candidates = await Promise.all(all.map(async (m) => ({ ...m, tools: await supportsTools(m.name) })));
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const running = (await getRunning()).map((r) => r.name);
      const pick = chooseModel(userText, routing.candidates, {
        maxGB: opts.maxModelGB,
        current: state.model,
        loaded: running,
        excluded: routing.excluded,
        contextChars: ragChars,
      });
      if (!pick.model) throw new Error("使えるモデルがありません。--diagnose で確認するか、--model= で指定してください。");
      // 切替先は実際に tool_calls を返すかを一度だけ確かめる（capabilities は嘘をつくことがある）
      if (!opts.skipToolCheck && !routing.verified.has(pick.model)) {
        process.stdout.write(`モデル ${pick.model} のtool calling対応を確認中...`);
        const check = await verifyToolCalling(pick.model, modelOptions);
        if (!check.ok && !check.inconclusive) {
          console.log(" NG（候補から外します）");
          routing.excluded.add(pick.model);
          if (state.model === pick.model) state.model = null;
          continue;
        }
        console.log(check.inconclusive ? " 確認できませんでした（続行）" : " OK");
        routing.verified.add(pick.model);
      }
      if (pick.model !== state.model) console.log(`\x1b[36m[モデル: ${pick.model}]\x1b[0m ${pick.reason}`);
      state.model = pick.model;
      return;
    }
    throw new Error("tool calling に対応するモデルが見つかりませんでした。--model= で指定してください。");
  }

  // ---- 1ターンの準備: 資料検索 → モデル選択 → 要約 → system 組み直し ----
  async function prepareTurn(userText) {
    let ragText = "";
    if (state.ragIndex) {
      const { text, sources } = formatContext(search(state.ragIndex, userText));
      ragText = text;
      state.ragSources = sources;
      if (sources.length) console.log(`\x1b[2m参照: ${sources.map((x, i) => `[${i + 1}] ${x.path}:${x.line}`).join("  ")}\x1b[0m`);
    }
    await routeModel(userText, ragText.length);

    const result = await compactIfNeeded(
      messages,
      state.summary,
      async (msgs) => {
        process.stdout.write("\x1b[2m古い会話を要約中...\x1b[0m");
        const reply = await chat({ model: state.model, messages: msgs, options: { ...modelOptions, temperature: 0.1, num_predict: 500 } });
        console.log("");
        return reply;
      },
      { numCtx, systemChars: composeSystem(baseSystem, state.summary, ragText).length }
    );
    if (result) {
      state.summary = result.summary;
      console.log(
        `\x1b[33m── 古い会話${result.folded}件を要約に置き換えました。ここより前の細部は覚えていません${result.fallback ? "（要約に失敗したため、発言の要点だけ残しました）" : ""} ──\x1b[0m`
      );
    }
    messages[0].content = composeSystem(baseSystem, state.summary, ragText);
    if (onSave) await onSave(messages);
  }

  async function submit(text) {
    if (await answerLocally(text, messages, onSave)) return;
    messages.push({ role: "user", content: text });
    if (onSave) await onSave(messages);
    await prepareTurn(text);
    await runTurn({ messages, model: state.model, root: opts.root, tools, rl, modelOptions, onSave, stream: opts.stream });
  }

  function slashCommand(input) {
    const cmd = input.trim().split(/\s+/)[0];
    if (cmd === "/memory") {
      const used = estimateTokens(messages.reduce((n, m) => n + (m.content?.length ?? 0), 0));
      console.log(`\n会話: ${messages.length - 1}件（約${used}トークン / 窓 ${numCtx}）`);
      console.log(state.summary ? `要約:\n${state.summary}\n` : "要約はまだありません（窓に余裕があるうちは全文を覚えています）。\n");
    } else if (cmd === "/rag") {
      console.log(
        state.ragIndex
          ? `\n資料: ${state.ragIndex.n}抜粋（${opts.rag.join(", ")}）\n直近の参照: ${state.ragSources.map((x) => `${x.path}:${x.line}`).join(", ") || "なし"}\n`
          : "\n資料は指定されていません（--rag=フォルダ で指定）。\n"
      );
    } else if (cmd === "/model") {
      console.log(`\nモデル: ${state.model ?? "（未選択・自動切替）"}${opts.model === "auto" ? `（自動切替・上限 ${opts.maxModelGB}GB）` : ""}\n`);
    } else return false;
    return true;
  }

  console.log(`終了するには exit または Ctrl+C（/memory /rag /model で状態を確認）\n`);

  if (opts.task) {
    await submit(opts.task);
    rl.close();
    return;
  }

  while (true) {
    let input;
    try {
      input = await rl.question("> ");
    } catch (err) {
      // 入力が閉じた（パイプ入力の終端・端末が閉じた）。例外で落とさず、静かに終わる
      if (err?.code === "ERR_USE_AFTER_CLOSE") break;
      throw err;
    }
    if (["exit", "quit"].includes(input.trim().toLowerCase())) break;
    if (!input.trim()) continue;
    if (slashCommand(input)) continue;
    await submit(input);
  }
  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
