#!/usr/bin/env node
/*
 * verify-known-bug-patterns.mjs — 複数ゲームで実際に踏んだ「無言で壊れる」既知パターンを機械検査する
 *
 * 背景: 「肖像スロットのindexずれ」「source-rectの解像度直書き」はどちらも例外もエラーも出さずに
 * 絵だけが無言でずれる/消えるバグで、sengoku/sanguo/taihei で複数回踏んできた（CLAUDE.md参照）。
 * 知見としては書いてあるが、実際の検査は人間+LLMが思い出して目視する運用のままだった。
 *
 * 検査A（✗ブロッキング）: 肖像アトラスのindex割り当てに使う配列は「末尾追加のみ」が不変条件。
 *   途中挿入・削除・並べ替えが起きると、その位置より後ろの全員の肖像が無言でずれる
 *   （例外もエラーも出ない）。登録済みの配列について、比較対象（既定HEAD）時点の並びが
 *   現在の並びの先頭一致（prefix）になっているかを機械確認する。
 * 検査B（△警告・情報提供のみ）: drawImageの9引数呼び出しでsource-rect（sx,sy,sWidth,sHeight）
 *   が数値リテラル直書きになっている箇所を横断的に検出する。アセットを再エンコード/縮小した瞬間、
 *   矩形が画像外へ出て無言で絵が消える既知の失敗パターン。scaleSrcRect等の解像度非依存化
 *   ヘルパーを使っているか、あるいは解像度が絶対に変わらない前提かを目視で確認すること。
 *
 * 新しいゲームで肖像アトラス等のindex依存割り当てを足したら、下の KNOWN_INDEX_SENSITIVE_ARRAYS
 * に登録すること（登録し忘れると検査Aがすり抜ける）。
 *
 * 使い方:
 *   node scripts/verify-known-bug-patterns.mjs
 *   node scripts/verify-known-bug-patterns.mjs --base origin/main   # 比較対象refを変更（既定: HEAD）
 *
 * 終了コード: 検査Aの✗が1件でもあれば1。検査Bは警告のみ（exit codeに影響しない）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const baseIdx = args.indexOf('--base');
const BASE = baseIdx >= 0 ? args[baseIdx + 1] : 'HEAD';

// ---- 検査A: index依存配列の登録簿 ----------------------------------------
const KNOWN_INDEX_SENSITIVE_ARRAYS = [
  {
    label: '戦国風雲記: assets/sengoku/generals.json（buildPortraitSlots の肖像アトラス割り当て順）',
    file: 'assets/sengoku/generals.json',
    extract: (text) => {
      const data = JSON.parse(text);
      return data.generals.map(g => g.id);
    },
  },
  {
    label: '三国志・天下三分: sanguo.html の GENERAL_IDS（肖像アトラスの通しスロット番号）',
    file: 'sanguo.html',
    extract: (text) => {
      const m = /const\s+GENERAL_IDS\s*=\s*\[([\s\S]*?)\];/.exec(text);
      if (!m) return null;
      return [...m[1].matchAll(/'([^'\\]*)'/g)].map(x => x[1]);
    },
  },
];

function gitShow(ref, file) {
  try {
    return execFileSync('git', ['show', `${ref}:${file}`], { cwd: ROOT, encoding: 'utf8' });
  } catch {
    return null; // base側に存在しない（新規ファイル）
  }
}

function checkPrefix(oldIds, newIds) {
  for (let i = 0; i < oldIds.length; i++) {
    if (newIds[i] !== oldIds[i]) {
      return { ok: false, index: i, oldVal: oldIds[i], newVal: newIds[i] ?? '(欠落)' };
    }
  }
  return { ok: true };
}

function runCheckA() {
  console.log(`\n[検査A] index依存配列の末尾追加のみ不変条件（比較対象: ${BASE}）`);
  let fail = false;
  for (const entry of KNOWN_INDEX_SENSITIVE_ARRAYS) {
    const abs = path.join(ROOT, entry.file);
    if (!fs.existsSync(abs)) {
      console.log(`  ⚠ ${entry.label}: ファイルが見つからず検査スキップ（${entry.file}）`);
      continue;
    }
    const newText = fs.readFileSync(abs, 'utf8');
    const oldText = gitShow(BASE, entry.file);
    let newIds, oldIds;
    try {
      newIds = entry.extract(newText);
    } catch (e) {
      console.log(`  ⚠ ${entry.label}: 現在の内容を解析できず検査スキップ（${e.message}）`);
      continue;
    }
    if (newIds == null) {
      console.log(`  ⚠ ${entry.label}: 配列を抽出できず検査スキップ（表記が変わった可能性）`);
      continue;
    }
    if (oldText == null) {
      console.log(`  ✓ ${entry.label}: 比較対象(${BASE})に無し（新規追加のため対象外）`);
      continue;
    }
    try {
      oldIds = entry.extract(oldText);
    } catch {
      oldIds = null;
    }
    if (oldIds == null) {
      console.log(`  ⚠ ${entry.label}: 比較対象(${BASE})側を解析できず検査スキップ`);
      continue;
    }
    const result = checkPrefix(oldIds, newIds);
    if (result.ok) {
      console.log(`  ✓ ${entry.label}: 先頭 ${oldIds.length}件は不変（末尾追加${newIds.length - oldIds.length}件のみ）`);
    } else {
      fail = true;
      console.log(`  ✗ ${entry.label}`);
      console.log(`    index ${result.index} で不一致: ${BASE}側="${result.oldVal}" → 現在="${result.newVal}"`);
      console.log(`    末尾追加以外の変更（挿入/削除/並べ替え）を検出。意図的なら影響範囲（noAtlas付与・indexOf参照箇所）を目視確認したうえで許容すること。`);
    }
  }
  return !fail;
}

// ---- 検査B: drawImage source-rect の数値リテラル直書き検出 -----------------
function extractCallArgs(text, openParenIndex) {
  // openParenIndex は '(' の位置。対応する ')' までを、文字列リテラルを跨がずに
  // 深さ0のカンマで分割して返す。ネストした()/[]/{}は1トークンとして扱う。
  let depth = 0;
  let i = openParenIndex;
  let inStr = null;
  const args = [];
  let cur = '';
  for (; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      cur += c;
      if (c === '\\') { i++; cur += text[i] ?? ''; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; cur += c; continue; }
    if (c === '(' || c === '[' || c === '{') { depth++; if (depth > 1) cur += c; continue; }
    if (c === ')' || c === ']' || c === '}') {
      depth--;
      if (depth === 0) { args.push(cur); return { args, end: i }; }
      cur += c; continue;
    }
    if (c === ',' && depth === 1) { args.push(cur); cur = ''; continue; }
    cur += c;
  }
  return { args, end: -1 }; // 対応する閉じ括弧が見つからない（不正/検出漏れ）
}

const NUMERIC_LITERAL = /^-?\d+(\.\d+)?$/;

function runCheckB() {
  console.log(`\n[検査B] drawImage source-rect の数値リテラル直書き（横断監査・情報提供のみ）`);
  const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
  const hits = [];
  for (const file of files) {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    let idx = 0;
    while ((idx = text.indexOf('.drawImage(', idx)) !== -1) {
      const openParen = idx + '.drawImage'.length;
      const { args, end } = extractCallArgs(text, openParen);
      if (end !== -1 && args.length === 9) {
        const srcRect = args.slice(1, 5).map(a => a.trim());
        if (srcRect.every(a => NUMERIC_LITERAL.test(a))) {
          const line = text.slice(0, idx).split('\n').length;
          hits.push(`  ${file}:${line}  drawImage(img, ${srcRect.join(', ')}, ...) — source-rectが数値直書き`);
        }
      }
      idx = openParen;
    }
  }
  if (hits.length === 0) {
    console.log('  ✓ 該当なし');
  } else {
    hits.forEach(h => console.log(h));
    console.log(`  △ ${hits.length}件検出。アセット再エンコード/解像度変更時に無言で絵が消える既知パターン。`);
    console.log(`    scaleSrcRect等で実解像度へスケールしているか、対象アセットの解像度が変わらない前提かを目視確認すること。`);
  }
  return true; // 警告のみ・exit codeに影響しない
}

const okA = runCheckA();
runCheckB();
console.log(`\n${okA ? '✅ 検査A: PASS' : '❌ 検査A: FAIL'}（検査Bは警告のみ・exit codeに影響しません）`);
process.exit(okA ? 0 : 1);
