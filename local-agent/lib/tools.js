import fs from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { resolveSafe } from "./sandbox.js";

const execAsync = promisify(exec);

const SKIP_DIRS = new Set([".git", "node_modules", ".venv", "__pycache__", "checkpoints"]);

// モデルに見せるツール定義（Ollama/OpenAI互換のfunction calling形式）
export const TOOL_DEFS = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "指定したファイルの中身を読む。テキストファイル専用。",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "root からの相対パス" },
          offset: { type: "number", description: "読み始める行番号（1始まり、省略可）" },
          limit: { type: "number", description: "最大読み込み行数（省略可、既定2000）" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_dir",
      description: "指定したディレクトリ直下のファイル・フォルダ一覧を返す。",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "root からの相対パス（省略時はroot直下）" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "grep",
      description: "root配下のテキストファイルを正規表現で再帰検索し、マッチした行を返す。",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "JavaScript正規表現（文字列）" },
          path: { type: "string", description: "検索対象のサブディレクトリ（省略時はroot全体）" },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "指定したファイルへ内容を書き込む（新規作成 or 上書き）。実行前にユーザー確認が入る。",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "root からの相対パス" },
          content: { type: "string", description: "書き込む内容全体" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_file",
      description: "既存ファイル内の文字列を置換する。old_stringはファイル内で一意である必要がある。実行前にユーザー確認が入る。",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "root からの相対パス" },
          old_string: { type: "string", description: "置換対象の文字列（一意になる十分な長さで指定）" },
          new_string: { type: "string", description: "置換後の文字列" },
        },
        required: ["path", "old_string", "new_string"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_shell",
      description: "rootをカレントディレクトリとしてシェルコマンドを実行する。実行前にユーザー確認が入る。",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "実行するシェルコマンド" },
        },
        required: ["command"],
      },
    },
  },
];

// 確認なしで実行してよい読み取り専用ツール
export const READ_ONLY_TOOLS = new Set(["read_file", "list_dir", "grep"]);

// 書き込み直後にできる範囲で構文チェックし、結果をツール応答へ付記する。
// モデルは例外もエラーも出ないまま「完了」と報告しがちなので、同じターン内で
// フィードバックを返し自己修正させる（実行はしない・パースのみで安全）。
async function verifySyntax(full, relPath) {
  const ext = path.extname(relPath).toLowerCase();
  try {
    if (ext === ".js" || ext === ".mjs" || ext === ".cjs") {
      await execAsync(`node --check "${full}"`, { timeout: 10_000 });
      return "\n[構文チェック] OK（node --check）";
    }
    if (ext === ".json") {
      JSON.parse(await fs.readFile(full, "utf8"));
      return "\n[構文チェック] OK（JSONパース）";
    }
  } catch (err) {
    const detail = err.stderr || err.message;
    return `\n[構文チェック] エラーあり。修正してから再度書き込んでください:\n${detail}`;
  }
  return "";
}

async function walk(dir, root, onFile) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, root, onFile);
    } else if (entry.isFile()) {
      await onFile(full);
    }
  }
}

export function makeToolImpls(root) {
  return {
    async read_file({ path: relPath, offset, limit }) {
      const full = resolveSafe(root, relPath);
      const text = await fs.readFile(full, "utf8");
      const lines = text.split("\n");
      const start = Math.max(0, (offset ?? 1) - 1);
      const end = Math.min(lines.length, start + (limit ?? 2000));
      return lines
        .slice(start, end)
        .map((l, i) => `${start + i + 1}\t${l}`)
        .join("\n");
    },

    async list_dir({ path: relPath }) {
      const full = resolveSafe(root, relPath ?? ".");
      const entries = await fs.readdir(full, { withFileTypes: true });
      return entries
        .filter((e) => !SKIP_DIRS.has(e.name))
        .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
        .sort()
        .join("\n");
    },

    async grep({ pattern, path: relPath }) {
      const searchRoot = resolveSafe(root, relPath ?? ".");
      const re = new RegExp(pattern);
      const hits = [];
      const MAX_HITS = 200;
      await walk(searchRoot, root, async (file) => {
        if (hits.length >= MAX_HITS) return;
        let text;
        try {
          text = await fs.readFile(file, "utf8");
        } catch {
          return; // バイナリ等は無視
        }
        const rel = path.relative(root, file);
        text.split("\n").forEach((line, i) => {
          if (hits.length >= MAX_HITS) return;
          if (re.test(line)) hits.push(`${rel}:${i + 1}:${line}`);
        });
      });
      return hits.length ? hits.join("\n") : "(マッチなし)";
    },

    async write_file({ path: relPath, content }) {
      const full = resolveSafe(root, relPath);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, content, "utf8");
      return `書き込み完了: ${relPath} (${content.length}文字)` + (await verifySyntax(full, relPath));
    },

    async edit_file({ path: relPath, old_string, new_string }) {
      const full = resolveSafe(root, relPath);
      const text = await fs.readFile(full, "utf8");
      const count = text.split(old_string).length - 1;
      if (count === 0) throw new Error("old_string がファイル内に見つかりません");
      if (count > 1) throw new Error(`old_string がファイル内に${count}箇所あり一意ではありません`);
      await fs.writeFile(full, text.replace(old_string, new_string), "utf8");
      return `編集完了: ${relPath}` + (await verifySyntax(full, relPath));
    },

    async run_shell({ command }) {
      const { stdout, stderr } = await execAsync(command, {
        cwd: root,
        timeout: 60_000,
        maxBuffer: 10 * 1024 * 1024,
      });
      return [stdout, stderr].filter(Boolean).join("\n---stderr---\n") || "(出力なし)";
    },
  };
}
