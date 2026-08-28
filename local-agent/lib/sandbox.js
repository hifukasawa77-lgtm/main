import path from "node:path";

// ツールがrootの外へ出るのを防ぐ。相対パスも絶対パスもrootに正規化してから境界チェックする。
export function resolveSafe(root, relPath) {
  const rootResolved = path.resolve(root);
  const resolved = path.resolve(rootResolved, relPath);
  if (resolved !== rootResolved && !resolved.startsWith(rootResolved + path.sep)) {
    throw new Error(`パスがサンドボックス外を指しています: ${relPath}`);
  }
  return resolved;
}

// --- run_shell 向けの簡易危険度チェック ---
// read_file/write_file/edit_file はresolveSafeでroot外を機械的に弾けるが、
// run_shellは任意の文字列をシェルへ渡すため文字列解析での完全なサンドボックス化はできない
// （`&&` 連結・エイリアス・環境変数展開などを考慮した正確なパース器が必要になるため）。
// ここでは「危険そうな兆候をユーザーの確認画面で目立たせる」ヒューリスティックに限定する。
// 最終判断は必ず人間の確認に委ねる（ブロックはしない）。
const DANGEROUS_COMMAND_PATTERNS = [
  { re: /\brm\s+(-\w*r\w*f\w*|-\w*f\w*r\w*)\s+\/(\s|$)/i, why: "ルート直下を再帰削除しようとしています" },
  { re: /\brm\s+-\w*r\w*f\w*\s+[a-zA-Z]:[\\/]?\s*$/i, why: "ドライブ直下を再帰削除しようとしています" },
  { re: /\b(del|erase)\s+\/[sS]\b.*\/[qQ]\b/i, why: "サブフォルダごと確認なしで削除しようとしています" },
  { re: /\brd\s+\/[sS]\b.*\/[qQ]\b/i, why: "フォルダをサブツリーごと削除しようとしています" },
  { re: /\bformat\s+[a-zA-Z]:/i, why: "ドライブのフォーマットを実行しようとしています" },
  { re: /\bmkfs(\.\w+)?\b/i, why: "ファイルシステムの作成（既存データ破壊）を実行しようとしています" },
  { re: />\s*\/dev\/(sd|nvme|hd)/i, why: "ブロックデバイスへ直接書き込もうとしています" },
  { re: /\bshutdown\b|\brestart-computer\b/i, why: "システムのシャットダウン/再起動を実行しようとしています" },
];

// コマンド文字列からパスらしきトークンを拾い、rootの外を指していないか粗く確認する。
// フラグや通常の文字列も誤検出しうるため「警告」用であり、遮断はしない。
function findPathEscapes(command, root) {
  const rootResolved = path.resolve(root);
  const tokens = command.match(/(?:[a-zA-Z]:[\\/][^\s"']*|\/[^\s"']+|\.\.[\\/][^\s"']*)/g) || [];
  const escapes = [];
  for (const token of tokens) {
    const resolved = path.resolve(rootResolved, token);
    if (resolved !== rootResolved && !resolved.startsWith(rootResolved + path.sep)) {
      escapes.push(token);
    }
  }
  return [...new Set(escapes)];
}

// run_shellの実行前チェック。{ dangerous, reasons } を返す。reasonsが空でもdangerousはfalse。
export function assessShellCommand(command, root) {
  const reasons = [];
  for (const { re, why } of DANGEROUS_COMMAND_PATTERNS) {
    if (re.test(command)) reasons.push(why);
  }
  const escapes = findPathEscapes(command, root);
  if (escapes.length) {
    reasons.push(`root(${root})の外を指す可能性のあるパスを含んでいます: ${escapes.join(", ")}`);
  }
  return { dangerous: reasons.length > 0, reasons };
}
