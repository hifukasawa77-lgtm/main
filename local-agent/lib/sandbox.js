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
