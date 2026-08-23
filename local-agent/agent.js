#!/usr/bin/env node
import readline from "node:readline/promises";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chat, ping } from "./lib/ollama.js";
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
  };
  const rest = [];
  for (const arg of argv) {
    if (arg.startsWith("--model=")) opts.model = arg.slice("--model=".length);
    else if (arg.startsWith("--root=")) opts.root = path.resolve(arg.slice("--root=".length));
    else if (arg.startsWith("--temperature=")) opts.temperature = Number(arg.slice("--temperature=".length));
    else if (arg.startsWith("--num-ctx=")) opts.numCtx = Number(arg.slice("--num-ctx=".length));
    else if (arg.startsWith("--session=")) opts.session = arg.slice("--session=".length);
    else if (arg === "--skip-tool-check") opts.skipToolCheck = true;
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

async function runTurn({ messages, model, root, tools, rl, modelOptions, onSave }) {
  for (let i = 0; i < MAX_TURN_ITERATIONS; i++) {
    const message = await chat({ model, messages, tools: TOOL_DEFS, options: modelOptions });
    messages.push(message);
    if (onSave) await onSave(messages);

    if (!message.tool_calls || message.tool_calls.length === 0) {
      console.log(`\n${message.content}\n`);
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

  if (!(await ping())) {
    console.error(
      "Ollamaに接続できません。'ollama serve' が起動しているか確認してください（既定: http://localhost:11434）。"
    );
    process.exit(1);
  }

  const tools = makeToolImpls(opts.root);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const modelOptions = {
    ...(opts.temperature !== undefined && { temperature: opts.temperature }),
    ...(opts.numCtx !== undefined && { num_ctx: opts.numCtx }),
  };

  console.log(`local-agent — model: ${opts.model} / root: ${opts.root}`);

  if (opts.session && /[\\/]/.test(opts.session)) {
    console.error("--session の名前にパス区切り文字は使えません。");
    rl.close();
    process.exit(1);
  }

  if (!opts.skipToolCheck) {
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
  const systemPrompt = buildSystemPrompt(opts.root, projectContext);

  let messages;
  const onSave = opts.session ? (msgs) => saveSession(opts.session, msgs) : null;
  if (opts.session) {
    const loaded = await loadSession(opts.session);
    if (loaded && loaded.length) {
      messages = loaded;
      if (messages[0]?.role === "system") messages[0].content = systemPrompt;
      else messages.unshift({ role: "system", content: systemPrompt });
      console.log(`セッション "${opts.session}" を再開します（${messages.length}件のメッセージ）`);
    } else {
      messages = [{ role: "system", content: systemPrompt }];
    }
    console.log(`セッション保存先: ${sessionPath(opts.session)}`);
  } else {
    messages = [{ role: "system", content: systemPrompt }];
  }

  console.log(`終了するには exit または Ctrl+C\n`);

  if (opts.task) {
    messages.push({ role: "user", content: opts.task });
    if (onSave) await onSave(messages);
    await runTurn({ messages, model: opts.model, root: opts.root, tools, rl, modelOptions, onSave });
    rl.close();
    return;
  }

  while (true) {
    const input = await rl.question("> ");
    if (["exit", "quit"].includes(input.trim().toLowerCase())) break;
    if (!input.trim()) continue;
    messages.push({ role: "user", content: input });
    if (onSave) await onSave(messages);
    await runTurn({ messages, model: opts.model, root: opts.root, tools, rl, modelOptions, onSave });
  }
  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
