// 更新内容に応じたURLにする。通常は検査、--writeでHTMLの参照を更新する。
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'koma_ken.html'), html = fs.readFileSync(file, 'utf8');
const hash = text => createHash('sha256').update(text).digest('hex').slice(0, 12);
const versions = [];
let updated = html.replace(/(<script\b[^>]*\bsrc=")(assets\/koma-ken\/js\/[^"?]+\.js)(?:\?[^" ]*)?(")/g, (_, start, src, end) => {
  const version = hash(fs.readFileSync(path.join(root, src)));
  versions.push(src + ':' + version);
  return start + src + '?v=' + version + end;
});
if (!versions.length) throw new Error('Game script references not found');
const release = hash(versions.join('\n'));
updated = updated.replace(/<html lang="ja"(?: data-koma-release="[^"]*")?>/, '<html lang="ja" data-koma-release="' + release + '">');
if (process.argv.includes('--write')) fs.writeFileSync(file, updated);
else if (updated !== html) { console.error('Game asset versions are stale: node scripts/version-koma-assets.mjs --write'); process.exit(1); }
console.log(`Game asset versions: ${versions.length} scripts, release ${release}`);
