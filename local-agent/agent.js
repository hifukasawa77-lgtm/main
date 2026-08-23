#!/usr/bin/env node
import readline from "node:readline/promises";
import path from "node:path";
import { chat, ping } from "./lib/ollama.js";
import { TOOL_DEFS, READ_ONLY_TOOLS, makeToolImpls } from "./lib/tools.js";

const MAX_TURN_ITERATIONS = 25;

function parseArgs(argv) {
  const opts = { model: "qwen2.5", root: process.cwd(), task: null, temperature: undefined, numCtx: undefined };
  const rest = [];
  for (const arg of argv) {
    if (arg.startsWith("--model=")) opts.model = arg.slice("--model=".length);
    else if (arg.startsWith("--root=")) opts.root = path.resolve(arg.slice("--root=".length));
    else if (arg.startsWith("--temperature=")) opts.temperature = Number(arg.slice("--temperature=".length));
    else if (arg.startsWith("--num-ctx=")) opts.numCtx = Number(arg.slice("--num-ctx=".length));
    else rest.push(arg);
  }
  if (rest.length) opts.task = rest.join(" ");
  return opts;
}

const SYSTEM_PROMPT = (root) => `あなたはローカルで動くコーディングタスク実行エージェントです。
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

function formatToolCallForConfirm(name, args) {
  if (name === "run_shell") return `$ ${args.command}`;
  if (name === "write_file") return `${args.path} へ書き込み (${(args.content ?? "").length}文字)`;
  if (name === "edit_file") return `${args.path} を編集\n  - ${args.old_string}\n  + ${args.new_string}`;
  return JSON.stringify(args);
}

async function confirm(rl, name, args) {
  console.log(`\n\x1b[33m[確認] ${name}\x1b[0m`);
  console.log(formatToolCallForConfirm(name, args));
  const ans = await rl.question("実行しますか？ [y/N]: ");
  return /^y(es)?$/i.test(ans.replace(/^﻿/, "").trim());
}

async function runTurn({ messages, model, root, tools, rl, modelOptions }) {
  for (let i = 0; i < MAX_TURN_ITERATIONS; i++) {
    const message = await chat({ model, messages, tools: TOOL_DEFS, options: modelOptions });
    messages.push(message);

    if (!message.tool_calls || message.tool_calls.length === 0) {
      console.log(`\n${message.content}\n`);
      return;
    }

    for (const call of message.tool_calls) {
      const name = call.function.name;
      const args =
        typeof call.function.arguments === "string"
          ? JSON.parse(call.function.arguments)
          : call.function.arguments;

      let result;
      try {
        if (!READ_ONLY_TOOLS.has(name)) {
          const ok = await confirm(rl, name, args);
          if (!ok) {
            result = "ユーザーが実行を拒否しました。別の方法を検討してください。";
            messages.push({ role: "tool", tool_call_id: call.id, name, content: result });
            continue;
          }
        }
        result = await tools[name](args);
      } catch (err) {
        result = `エラー: ${err.message}`;
      }
      messages.push({ role: "tool", tool_call_id: call.id, name, content: String(result) });
    }
  }
  console.log("\n（最大反復回数に達したため中断しました）\n");
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
  const messages = [{ role: "system", content: SYSTEM_PROMPT(opts.root) }];
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const modelOptions = {
    ...(opts.temperature !== undefined && { temperature: opts.temperature }),
    ...(opts.numCtx !== undefined && { num_ctx: opts.numCtx }),
  };

  console.log(`local-agent — model: ${opts.model} / root: ${opts.root}`);
  console.log(`終了するには exit または Ctrl+C\n`);

  if (opts.task) {
    messages.push({ role: "user", content: opts.task });
    await runTurn({ messages, model: opts.model, root: opts.root, tools, rl, modelOptions });
    rl.close();
    return;
  }

  while (true) {
    const input = await rl.question("> ");
    if (["exit", "quit"].includes(input.trim().toLowerCase())) break;
    if (!input.trim()) continue;
    messages.push({ role: "user", content: input });
    await runTurn({ messages, model: opts.model, root: opts.root, tools, rl, modelOptions });
  }
  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
