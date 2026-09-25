#!/usr/bin/env node
/*
 * verify-routine-delivery.mjs — 定期実行（Routine）が本当に成果物を出しているかの検査。
 *
 * Routineは「起動した」ことしか報告しない。実際には2026-07以降、
 * note-post / marketer-evolve / site-proposal / agent-evolve / self-improve の5本すべてが
 * SUCCEEDED を返しながら成果物ゼロで、**2か月以上誰も気づかなかった**。
 * 原因はトリガーの保存設定が `sources: []`（＝git リポジトリが紐づいていない）ため。
 *
 * 各Routineのプロンプトは「harness-lint 検査#13 が痕跡マーカーの鮮度を見張っている」と
 * 書いていたが、**検査#13は別物（エージェント定義の整合）で、見張り役は存在しなかった**。
 * ここがその見張り役。
 *
 * 判定の考え方:
 *   CLAUDE.md の「定期実行（Routine）一覧」に載っているなら、動いている証跡があること。
 *   動かないなら表から外して停止する。**どちらかをやるまで赤いままにする**のが目的
 *   （「起動はしている」を成功と呼ばせない）。
 *
 * 証跡は2つ見る:
 *   A. Daily の実行痕跡マーカー `<!-- routine:<skill> -->` の鮮度（オフラインで見られる）
 *   B. 成果物ブランチが実在し、最近進んだか（ネットワークがある時だけ）
 *
 * 使い方: node scripts/verify-routine-delivery.mjs
 * 終了コード: 問題なし=0 / 問題あり=1
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DAILY = path.join(ROOT, 'obsidian-vault', '01-Daily');

let fail = 0;
const ok   = (m) => console.log(`  ✓ ${m}`);
const bad  = (m) => { console.log(`  ✗ ${m}`); fail = 1; };
const warn = (m) => console.log(`  △ ${m}`);

/** CLAUDE.md の「定期実行（Routine）一覧」表を読む。スケジュールの正はこの表（検査#11と同じ前提）。 */
export function parseRoutineTable(md) {
  const sec = md.split('## 定期実行（Routine）一覧')[1];
  if (!sec) return null;
  const rows = [];
  for (const line of sec.split('\n')) {
    if (!line.startsWith('|')) { if (rows.length) break; continue; }
    const c = line.split('|').map(s => s.trim());
    // | スキル | スケジュール | 成果物 | mainへの直接push |
    const m = /^`\/([a-z0-9-]+)`$/.exec(c[1] || '');
    if (!m) continue;                                   // ヘッダ行・区切り行
    rows.push({ skill: m[1], schedule: c[2] || '', artifact: c[3] || '' });
  }
  return rows;
}

/** 「毎週水曜 06:00」→ 7日周期。周期の2倍を許容幅にする（1回の取りこぼしは許すが2回は許さない）。 */
export function toleranceDays(schedule) {
  if (/毎週/.test(schedule)) return 14;
  if (/毎日|平日/.test(schedule)) return 3;
  if (/毎月/.test(schedule)) return 62;
  return 14;                                            // 不明なら週次扱い
}

/** 成果物の欄からブランチ名を取り出す（`claude/xxx` のバッククォート表記）。無ければ null。 */
export function artifactBranch(artifact) {
  const m = /`(claude\/[A-Za-z0-9._\/-]+)`/.exec(artifact);
  return m ? m[1] : null;
}

/** Daily 内の `<!-- routine:<skill> -->` のうち最も新しい日付を返す（ファイル名の日付を使う）。 */
function newestMarkerDate(skill) {
  if (!existsSync(DAILY)) return null;
  const re = new RegExp(`<!--\\s*routine:${skill}\\s*-->`);
  let newest = null;
  for (const f of readdirSync(DAILY).filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))) {
    if (!re.test(readFileSync(path.join(DAILY, f), 'utf8'))) continue;
    const d = f.slice(0, 10);
    if (!newest || d > newest) newest = d;
  }
  return newest;
}

const daysAgo = (ymd) => Math.floor((Date.now() - new Date(`${ymd}T00:00:00Z`).getTime()) / 86400000);

/** リモートにブランチが在るか。ネットワークが無ければ undefined（＝判定不能）を返す。 */
function remoteBranch(branch) {
  try {
    const out = execFileSync('git', ['ls-remote', '--heads', 'origin', branch],
      { cwd: ROOT, encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'ignore'] });
    return out.trim() ? out.trim().split('\t')[0] : null;
  } catch { return undefined; }
}

/** そのコミットの日付（取得できなければ null）。 */
function commitDate(sha) {
  try {
    execFileSync('git', ['fetch', '-q', 'origin', sha], { cwd: ROOT, timeout: 30000, stdio: 'ignore' });
    return execFileSync('git', ['log', '-1', '--format=%cs', sha],
      { cwd: ROOT, encoding: 'utf8', timeout: 10000 }).trim();
  } catch { return null; }
}

// ── 本体 ───────────────────────────────────────────────────
const rows = parseRoutineTable(readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8'));
if (!rows) { console.log('CLAUDE.md に「定期実行（Routine）一覧」が無い'); process.exit(1); }
if (rows.length === 0) { console.log('Routine一覧の表から行を抽出できない（表形式が変わった可能性）'); process.exit(1); }

console.log(`CLAUDE.md の Routine ${rows.length}本の成果物を検査する`);
console.log('（表に載っているなら動いている証跡があること。動かないなら表から外して停止する）\n');

console.log('== A. Daily の実行痕跡マーカーの鮮度 ==');
for (const r of rows) {
  const tol = toleranceDays(r.schedule);
  const d = newestMarkerDate(r.skill);
  if (!d) {
    bad(`/${r.skill}: 実行痕跡マーカー <!-- routine:${r.skill} --> がDailyに一度も無い（起動しても何も出していない／マーカーを書かせていない）`);
  } else if (daysAgo(d) > tol) {
    bad(`/${r.skill}: 最後の痕跡が ${d}（${daysAgo(d)}日前、許容 ${tol}日）。${r.schedule} のはずが動いていない`);
  } else {
    ok(`/${r.skill}: 痕跡 ${d}（${daysAgo(d)}日前 ≤ ${tol}日）`);
  }
}

console.log('== B. 成果物ブランチの実在と鮮度 ==');
let offline = false;
for (const r of rows) {
  const br = artifactBranch(r.artifact);
  if (!br) { ok(`/${r.skill}: 成果物がブランチではない（${r.artifact.slice(0, 32)}…）— Aの痕跡で判定`); continue; }
  const sha = remoteBranch(br);
  if (sha === undefined) { offline = true; warn(`/${r.skill}: origin に問い合わせできない（ネットワーク無し）— 判定を保留`); continue; }
  if (sha === null) { bad(`/${r.skill}: 成果物ブランチ ${br} が origin に存在しない`); continue; }
  const cd = commitDate(sha);
  const tol = toleranceDays(r.schedule);
  if (!cd) { warn(`/${r.skill}: ${br} は在るが日付を取得できない`); continue; }
  if (daysAgo(cd) > tol) bad(`/${r.skill}: ${br} の最終コミットが ${cd}（${daysAgo(cd)}日前、許容 ${tol}日）`);
  else ok(`/${r.skill}: ${br} は ${cd}（${daysAgo(cd)}日前）`);
}

if (offline) console.log('  ※ ネットワークが無い環境では B は保留になる。A（痕跡）だけでも故障は捕まる');

console.log('');
if (fail) {
  console.log('==> verify-routine-delivery: 問題あり ❌');
  console.log('    直し方は2つ。どちらかを必ずやる（放置すると「起動はしている」が成功として通り続ける）:');
  console.log('      1) Routineを直す — トリガーの sources にリポジトリが入っているかを確認する');
  console.log('         （create_trigger には source 指定が無いので、claude.ai の Routines 画面で作り直すか');
  console.log('          persistent_session_id でリポジトリを持つセッションへ紐づける）');
  console.log('      2) 直せないなら停止して CLAUDE.md の表から外す（動かないものを載せ続けない）');
} else {
  console.log('==> verify-routine-delivery: 問題なし ✅');
}
process.exit(fail);
