#!/usr/bin/env node
/*
 * gen-agent-knowledge.mjs — assets/js/agent-data.js から cloudflare-worker/site-knowledge.js を生成する。
 *
 * Worker の SYSTEM_PROMPT がサイトの実データ（ゲーム本数・ジャンル等）から自動導出されるため、
 * 「23本」ハードコードのような鮮度切れが構造的に起きなくなる。
 *
 * 使い方:
 *   node scripts/gen-agent-knowledge.mjs          # 生成（上書き）
 *   node scripts/gen-agent-knowledge.mjs --check  # drift検査（差分があれば exit 1）
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'cloudflare-worker', 'site-knowledge.js');

const data = require(path.join(ROOT, 'assets', 'js', 'agent-data.js'));
const { GAMES, KB, SECTIONS } = data;

const CAT_JA = { action: 'アクション', puzzle: 'パズル', rpg: 'RPG', board: 'ボード', card: 'カード', sim: 'シミュレーション', other: 'その他' };

const cats = {};
for (const g of GAMES) {
  if (!cats[g.cat]) cats[g.cat] = { count: 0, examples: [] };
  cats[g.cat].count++;
  if (cats[g.cat].examples.length < 2) cats[g.cat].examples.push(g.title.ja);
}
const genreLines = Object.entries(cats)
  .sort((a, b) => b[1].count - a[1].count)
  .map(([cat, v]) => `${CAT_JA[cat] || cat}${v.count}本（例: ${v.examples.join('、')}）`);

const aboutJa = String((KB.about && KB.about.ja) || '').replace(/\{GAME_COUNT\}/g, String(GAMES.length));
const sectionNames = Object.values(SECTIONS).map(s => s.ja).join('・');

const facts = {
  gameCount: GAMES.length,
  genres: genreLines,
  sections: sectionNames,
  about: aboutJa,
  generatedAt: new Date().toISOString().slice(0, 10),
};

const content = `// 自動生成ファイル — 手で編集しないこと。
// 生成元: assets/js/agent-data.js / 生成コマンド: node scripts/gen-agent-knowledge.mjs
// drift検査: node scripts/gen-agent-knowledge.mjs --check（deploy-worker.yml と harness-lint が実行）
export const SITE_FACTS = ${JSON.stringify(facts, null, 2)};

export function buildSystemPrompt() {
  return \`あなたは「ヒデのポートフォリオサイト」の案内エージェントです。
サイトオーナーの名前は「ヒデ」です。絶対に「ハイド」と呼ばないでください。「hide」と書かれていても必ず「ヒデ」と読んでください。
\${SITE_FACTS.about}
公開中のブラウザゲームは全\${SITE_FACTS.gameCount}本: \${SITE_FACTS.genres.join('、')}。
サイトのセクション: \${SITE_FACTS.sections}。
このサイトではゲーム紹介・三郷市情報・AI開発の話題を扱っています。
返答は日本語で2〜3文以内に簡潔にまとめてください。雑談や一般的な質問にも気軽に答えてください。ゲームの遊び方・おすすめ・AIについての質問が多いです。\`;
}
`;

const check = process.argv.includes('--check');
if (check) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  // generatedAt（日付）だけの差は drift とみなさない
  const strip = (s) => s.replace(/"generatedAt": "[^"]*"/, '"generatedAt": ""');
  if (strip(current) !== strip(content)) {
    console.error('❌ site-knowledge.js が agent-data.js と乖離しています。再生成してください:');
    console.error('   node scripts/gen-agent-knowledge.mjs');
    process.exit(1);
  }
  console.log('✅ site-knowledge.js は agent-data.js と一致（drift なし）');
} else {
  writeFileSync(OUT, content);
  console.log(`✅ 生成しました: ${path.relative(ROOT, OUT)}（ゲーム${facts.gameCount}本 / ${Object.keys(cats).length}ジャンル）`);
}
