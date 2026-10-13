#!/usr/bin/env node
/*
 * legal-scan.mjs — リポジトリを「法務の目」で機械的に洗い出す（リーガルチェッカーの一次インベントリ）。
 *
 * これは判定器ではなく**論点の候補を事実つきで出す**道具。出力の severity は「候補」で、
 * 最終評価（RED/YELLOW/GREEN）は legal-checker が条文に当てて行う。
 * 誤検知が多い検査は無視されるので、規則は「文脈を絞る」方針（タイトル・h1・メタ記述・ファイル名・URL等）。
 *
 * 使い方:
 *   node scripts/legal-scan.mjs                    全規則・全対象（人が読む形）
 *   node scripts/legal-scan.mjs --only mark,external-send
 *   node scripts/legal-scan.mjs --files zelda_like.html,gradius-1.html
 *   node scripts/legal-scan.mjs --changed          git diff HEAD の変更ファイルのみ
 *   node scripts/legal-scan.mjs --json             機械可読（全件）
 *   node scripts/legal-scan.mjs --all              規則ごとの表示上限を外す
 * 規則一覧: mark / external-send / pii-collection / sensitive-category / claims / gambling-gacha /
 *           affiliate-ad / provenance / oss-libs / ai-models / legal-pages / privacy-consistency /
 *           rom-emulator / security-tools
 * 終了コード: 常に0（候補の列挙であって合否ではない）。実行不能（読めない）だけ1。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const DATA_DIR = path.join(REPO, 'legal', 'knowledge', 'data');

export const loadData = (name) => JSON.parse(readFileSync(path.join(DATA_DIR, name), 'utf8'));

/** 規則のメタ。cites の引用は verify-legal-knowledge.mjs が実条文と照合する。 */
export const RULES = {
  mark: { title: '他社標章（タイトル・見出し・メタ記述・ファイル名・カタログ）', cites: ['【商標法37条｜侵害とみなす行為】', '【不正競争防止法2条｜他人の著名な商品等表示】', '【商標法26条｜普通に用いられる方法で表示する商標】'],
    next: 'J-PlatPat で登録の有無・区分・有効性を人が確認。高→名称/URL/ファイル名の置換案。playbook: 02' },
  'external-send': { title: '外部送信（利用者の端末から外部へ要求・情報が出る先）', cites: ['【電気通信事業法27条の12｜情報送信指令通信】', '【個人情報保護法27条｜本人の同意】', '【個人情報保護法28条｜外国にある第三者】'],
    next: 'privacy.html に送信先・情報・目的が列挙されているか照合。未分類ホストは data/external-hosts.json へ分類を追記。playbook: 03' },
  'pii-collection': { title: '個人情報の取得（フォーム・カメラ・マイク・位置・ファイル入力）', cites: ['【個人情報保護法17条｜できる限り特定】', '【個人情報保護法21条｜本人に通知し、又は公表】', '【個人情報保護法20条｜偽りその他不正の手段】'],
    next: '端末内で完結か送信か（network呼び出しの有無）を確認。利用目的の表示・同意UI。playbook: 03' },
  'sensitive-category': { title: '要配慮個人情報に近い語（健康・病歴・障害 等）', cites: ['【個人情報保護法2条｜病歴】', '【個人情報保護法20条｜要配慮個人情報】'],
    next: '端末内完結で外部送信しないことの実測と明記。playbook: 03' },
  claims: { title: '景表法の観点で根拠が要る表現（最強・No.1・業界初・絶対 等）', cites: ['【不当景品類及び不当表示防止法5条｜不当な表示】', '【不当景品類及び不当表示防止法7条｜合理的な根拠】'],
    next: '広告・メタ記述・SNS文面は客観的根拠（調査時点・対象・出典）を用意するか表現を弱める。playbook: 04' },
  'gambling-gacha': { title: '賭博・ガチャ・懸賞・課金・換金に関わる語', cites: ['【刑法185条｜賭博をした者】', '【刑法187条｜富くじ】', '【不当景品類及び不当表示防止法4条｜景品類の価額の最高額】', '【資金決済に関する法律3条｜前払式支払手段】'],
    next: '現実の金銭・景品と交換できないことの明記、対価性のある抽選が無いこと。playbook: 04・05' },
  'affiliate-ad': { title: '広告・アフィリエイト・PR表記（ステマ規制）', cites: ['【不当景品類及び不当表示防止法5条｜不当な表示】', '【特定商取引に関する法律12条｜誇大広告等の禁止】'],
    next: '広告であることの明示、特商法・景表法。playbook: 04' },
  provenance: { title: '素材の出自記録（assets 配下）', cites: ['【著作権法2条｜思想又は感情を創作的に表現したもの】', '【著作権法21条｜複製権】'],
    next: '出自記録の追加（assets/<dir>/PROVENANCE.md）。生成AI名のファイルはツール規約・商用可否・日付も。playbook: 01' },
  'oss-libs': { title: 'OSS・CDNライブラリとライセンス', cites: ['【著作権法63条｜利用の許諾】'],
    next: '不明は原典確認して data/oss-licenses.json へ。帰属表示が要るものはクレジット。playbook: 06' },
  'ai-models': { title: 'AIモデルIDとライセンス', cites: ['【著作権法63条｜利用の許諾】'],
    next: 'モデルカードで商用可否・表示・禁止用途を確認し data/ai-model-licenses.json を更新。playbook: 06' },
  'legal-pages': { title: '法務ページ（プライバシー・規約・特商法表記）の有無', cites: ['【民法548条の2｜定型約款】', '【特定商取引に関する法律11条｜通信販売についての広告】'],
    next: '収益化の信号があるのに表示ページが無ければ作る。playbook: 04' },
  'privacy-consistency': { title: 'プライバシーポリシーと実装の整合（送信先・AI事業者）', cites: ['【個人情報保護法21条｜本人に通知し、又は公表】', '【電気通信事業法27条の12｜情報送信指令通信】'],
    next: '実装が送る先がポリシーに書かれているか。書かれていなければ ポリシー修正（または実装修正）。playbook: 03' },
  'rom-emulator': { title: 'エミュレータ・ROM・BIOS', cites: ['【著作権法21条｜複製権】', '【不正競争防止法2条｜技術的制限手段】'],
    next: 'ROM・BIOSの同梱/配布が無いこと、入手経路を案内しないこと。playbook: 01・05' },
  'security-tools': { title: 'セキュリティ/ネットワーク系の語（デュアルユース）', cites: ['【刑法168条の2｜不正指令電磁的記録作成】', '【不正アクセス禁止法3条｜不正アクセス行為】'],
    next: '自己の管理下・同意のある対象に限る旨の明記、攻撃的実装が無いこと。playbook: 05' },
};

// ── ファイル探索 ──────────────────────────────────────────
const SKIP_DIRS = new Set(['node_modules', '.git', 'legal', 'obsidian-vault', 'claudechord-vault', 'FamicomEmulatorWin', 'UnityShogiRPG', 'HorrorWalkKit', 'SakuraLikeEditor', 'backend', 'tests', '.edge-test-profile', '.claude']);

function walk(dir, filter, depth, maxDepth, out) {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') && e.name !== '.well-known') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && depth < maxDepth) walk(p, filter, depth + 1, maxDepth, out); }
    else if (filter(e.name, p)) out.push(p);
  }
}

export function discover(root) {
  const pages = [], code = [], docs = [];
  for (const e of existsSync(root) ? readdirSync(root, { withFileTypes: true }) : []) {
    if (!e.isFile()) continue;
    const p = path.join(root, e.name);
    if (/\.html$/i.test(e.name)) pages.push(p);
    else if (/\.(js|mjs|cjs|css|jsx|tsx|ts)$/i.test(e.name)) code.push(p);
    else if (/\.(webmanifest)$/i.test(e.name) || e.name === 'manifest.json') code.push(p);
    else if (e.name === 'README.md') docs.push(p);
  }
  walk(path.join(root, 'assets', 'js'), n => /\.(js|jsx)$/.test(n), 0, 2, code);
  walk(path.join(root, 'assets', 'css'), n => /\.css$/.test(n), 0, 2, code);
  walk(path.join(root, 'gamekit'), n => /\.js$/.test(n), 0, 1, code);
  walk(path.join(root, 'cloudflare-worker'), n => /\.(js|html)$/.test(n), 0, 1, code);
  walk(path.join(root, 'marketing'), n => /\.(md|js)$/.test(n), 0, 2, docs);
  walk(path.join(root, 'note'), n => /\.md$/.test(n), 0, 2, docs);
  return { pages, code, docs };
}

// ── 小道具 ────────────────────────────────────────────────
const readSafe = (p) => { try { return statSync(p).size > 4e6 ? '' : readFileSync(p, 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const nfkc = (s) => String(s).normalize('NFKC');
/** 位置（行番号）を保ったまま、HTMLコメントとCSPのmetaを空白にする。コメントアウトされた雛形や許可リストを「使用」と誤検知しない。 */
const blankInert = (t) => t.replace(/<!--[\s\S]*?-->|<meta\b[^>]*http-equiv\s*=\s*["']?Content-Security-Policy[^>]*>/gi, (m) => m.replace(/[^\n]/g, ' '));
function lineIndex(text) {
  const nl = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) nl.push(i + 1);
  return (idx) => { let lo = 0, hi = nl.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (nl[m] <= idx) lo = m; else hi = m - 1; } return lo + 1; };
}
const rel = (root, p) => path.relative(root, p).replace(/\\/g, '/');
function attrs(tag) {
  const o = {};
  for (const m of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) o[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? '';
  return o;
}
const OWN_HOSTS = ['hifukasawa77-lgtm.github.io'];
const IGNORE_HOST = (h) => !h.includes('.') || /(^|\.)(w3\.org|schema\.org|example\.(com|org|net)|purl\.org|xmlns\.com|ogp\.me)$/.test(h) || /\.(test|invalid|example|localhost)$/.test(h) || OWN_HOSTS.includes(h) || /^\d+\.\d+\.\d+\.\d+$/.test(h) || /^(localhost|127\.0\.0\.1)$/.test(h) || /\.example\.workers\.dev$/.test(h);
const hostOf = (url) => { try { return new URL(url.startsWith('//') ? 'https:' + url : url).hostname.toLowerCase(); } catch { return null; } };

// ── 規則 ──────────────────────────────────────────────────
function makeCtx(root, selection, override = null) {
  const data = {};
  const lazy = (k, f) => () => (data[k] ??= f());
  return {
    root, selection,
    marks: lazy('marks', () => override?.marks ?? loadData('third-party-marks.json').marks),
    hosts: lazy('hosts', () => override?.hosts ?? loadData('external-hosts.json').hosts),
    oss: lazy('oss', () => override?.oss ?? loadData('oss-licenses.json').packages),
    models: lazy('models', () => override?.models ?? loadData('ai-model-licenses.json').models),
    privacy: lazy('privacy', () => { const p = path.join(root, 'privacy.html'); return existsSync(p) ? nfkc(strip(readSafe(p).replace(/<script[\s\S]*?<\/script>/gi, ''))).toLowerCase() : null; }),
  };
}
const F = (rule, severity, file, line, text, detail = {}) => ({ rule, severity, file, line, text, ...detail });

/** ASCII語は語境界、日本語は部分一致で標章を探す。 */
function termRegex(term) {
  const t = nfkc(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return /^[\x20-\x7e]+$/.test(nfkc(term)) ? new RegExp(`(?<![A-Za-z0-9])${t}(?![A-Za-z0-9])`, 'i') : new RegExp(t, 'i');
}

function ruleMark(ctx, f) {
  const out = [];
  const marks = ctx.marks();
  const base = path.basename(f.path);
  const stem = base.replace(/\.[^.]+$/, '').toLowerCase();
  const tokens = stem.split(/[^a-z0-9]+/).filter(Boolean);
  const contexts = [];                                          // {ctx, text, line}
  if (f.kind === 'page') {
    const L = lineIndex(f.text);
    const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(f.text);
    if (t) contexts.push({ ctx: 'title', text: strip(t[1]), line: L(t.index) });
    for (const m of f.text.matchAll(/<meta\b[^>]*>/gi)) {
      const a = attrs(m[0]); const key = (a.property || a.name || '').toLowerCase();
      if (['og:title', 'twitter:title', 'apple-mobile-web-app-title', 'application-name', 'og:site_name'].includes(key)) contexts.push({ ctx: 'title', text: a.content || '', line: L(m.index) });
      else if (['description', 'og:description', 'twitter:description', 'keywords'].includes(key)) contexts.push({ ctx: 'description', text: a.content || '', line: L(m.index) });
    }
    for (const m of f.text.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)) contexts.push({ ctx: 'h1', text: strip(m[1]), line: L(m.index) });
    if (base === 'index.html') for (const m of f.text.matchAll(/<(h2|h3|strong)\b[^>]*>([\s\S]*?)<\/\1>/gi)) contexts.push({ ctx: 'catalog', text: strip(m[2]), line: L(m.index) });
  }
  if (base === 'agent-data.js') for (const m of f.text.matchAll(/\bname\s*:\s*['"`]([^'"`]+)['"`]/g)) contexts.push({ ctx: 'catalog', text: m[1], line: lineIndex(f.text)(m.index) });
  if (f.kind === 'manifest') { try { const j = JSON.parse(f.text); for (const k of ['name', 'short_name']) if (j[k]) contexts.push({ ctx: 'title', text: String(j[k]), line: 1 }); } catch { /* 読めないものは対象外 */ } }

  for (const mk of marks) {
    const res = mk.terms.map(termRegex);
    const startOnly = !!mk.startOnly;
    // ファイル名（トークン完全一致のみ。generic な英単語を拾わない）
    if (f.kind === 'page') {
      const hit = (mk.files || []).find(w => tokens.includes(w) || (w.length >= 5 && stem.replace(/[^a-z0-9]/g, '').includes(w)));
      if (hit) out.push(F('mark', mk.confidence === 'high' ? 'RED候補' : 'YELLOW候補', f.rel, 0, `ファイル名/URL に「${hit}」（${base}）`, { mark: mk.id, owner: mk.owner, confidence: mk.confidence, ctx: 'filename', note: mk.note, alt: mk.alt }));
    }
    for (const c of contexts) {
      const text = nfkc(c.text);
      const idxs = res.map(r => { const m = r.exec(text); return m ? m.index : -1; }).filter(i => i >= 0);
      if (!idxs.length) continue;
      const first = Math.min(...idxs);
      if (startOnly && first > 12) continue;                    // 技術ブランドは先頭使用だけ（説明的言及は自由）
      let sev = mk.confidence === 'high' ? (c.ctx === 'description' || c.ctx === 'catalog' ? 'YELLOW候補' : 'RED候補') : 'YELLOW候補';
      if (mk.kind === 'tech') sev = '要確認';
      const style = /(風|ライク|クローン|inspired|like|style|互換)/i.test(text.slice(Math.max(0, first - 12), first + 20));
      out.push(F('mark', sev, f.rel, c.line, `${c.ctx}:「${c.text.slice(0, 60)}」`, { mark: mk.id, owner: mk.owner, confidence: mk.confidence, ctx: c.ctx, styleClaim: style, note: mk.note, alt: mk.alt }));
    }
  }
  return out;
}

const LOAD_PRE = /(fetch|import|importScripts|WebSocket|sendBeacon|Worker|\.open|\.src\s*=|src\s*:|API|ENDPOINT|BASE_?URL|WORKER|PROXY|WASM|MODEL|CDN|ORIGIN|[Uu]rl\s*=|URL\s*=)[^\n]{0,60}$/;

/** ページ・コードが「読み込む／通信する」外部URLを (host, kind, line) で返す。リンク（<a>）は含めない。 */
export function extractExternal(f) {
  const found = [];
  const text = f.text;
  const L = lineIndex(text);
  const add = (url, kind, idx) => { const h = hostOf(url); if (h && !IGNORE_HOST(h)) found.push({ host: h, url, kind, line: L(idx) }); };
  if (f.kind === 'page') {
    for (const m of text.matchAll(/<(script|link|img|iframe|source|video|audio|embed|object|track)\b[^>]*>/gi)) {
      const tag = m[1].toLowerCase(); const a = attrs(m[0]);
      if (tag === 'link') {
        const relv = (a.rel || '').toLowerCase();
        if (!/(stylesheet|preload|prefetch|modulepreload|icon|manifest|preconnect|dns-prefetch)/.test(relv)) continue;
        if (a.href && /^(https?:)?\/\//.test(a.href)) add(a.href, /preconnect|dns-prefetch/.test(relv) ? 'preconnect' : 'link', m.index);
      } else {
        for (const k of ['src', 'data', 'poster']) if (a[k] && /^(https?:)?\/\//.test(a[k])) add(a[k], tag, m.index);
        if (a.srcset) for (const part of a.srcset.split(',')) { const u = part.trim().split(/\s+/)[0]; if (/^(https?:)?\/\//.test(u)) add(u, tag, m.index); }
      }
    }
  }
  for (const m of text.matchAll(/url\(\s*['"]?((?:https?:)?\/\/[^'")\s]+)/gi)) add(m[1], 'css-url', m.index);
  for (const m of text.matchAll(/@import\s+(?:url\()?\s*['"]((?:https?:)?\/\/[^'"]+)/gi)) add(m[1], 'css-import', m.index);
  if (f.kind === 'page' || f.kind === 'code') {
    for (const m of text.matchAll(/(["'`])(https?:\/\/[^\s"'`<>\\)]+)\1?/g)) {
      const pre = text.slice(Math.max(0, m.index - 80), m.index);
      if (/<a\b[^>]*$/i.test(pre) || /href\s*=\s*$/i.test(pre)) continue;       // リンクは外部送信ではない
      if (LOAD_PRE.test(pre)) add(m[2], 'script-call', m.index);
    }
  }
  return found;
}

function ruleExternal(ctx, f, acc) {
  for (const x of extractExternal(f)) {
    const key = x.host;
    const e = (acc.hosts[key] ??= { host: key, kinds: new Set(), files: new Map() });
    e.kinds.add(x.kind);
    if (!e.files.has(f.rel)) e.files.set(f.rel, x.line);
  }
  if (f.kind === 'page' || f.kind === 'code') {
    const L = lineIndex(f.text);
    const re = /(googletagmanager\.com|google-analytics\.com|gtag\s*\(|clarity\.ms|hotjar|plausible\.io|umami|matomo|connect\.facebook\.net|fbq\s*\(|adsbygoogle|googlesyndication|doubleclick)/gi;
    for (const m of blankInert(f.text).matchAll(re)) acc.analytics.push(F('external-send', 'RED候補', f.rel, L(m.index), `解析・広告タグの痕跡: ${m[0]}`, { detail: '外部送信規律の通知・公表、同意、プライバシーポリシー記載が要る' }));
  }
}

function ruleOnText(ctx, f, rule, specs) {
  // specs: [{re, label, sev, detail}]
  const out = [];
  const L = lineIndex(f.text);
  for (const s of specs) {
    let n = 0;
    for (const m of f.text.matchAll(s.re)) {
      out.push(F(rule, s.sev || '要確認', f.rel, L(m.index), `${s.label}: ${m[0].slice(0, 70).replace(/\s+/g, ' ')}`, { detail: s.detail }));
      if (++n >= (s.max ?? 3)) break;
    }
  }
  return out;
}

const PII = [
  { re: /<input\b[^>]*type\s*=\s*["']?(email|tel|password)\b[^>]*>/gi, label: '入力欄(email/tel/password)', sev: '要確認', detail: '利用目的の表示・送信先' },
  { re: /<input\b[^>]*(?:name|id|autocomplete)\s*=\s*["'][^"']*(?:full-?name|first-?name|last-?name|address|postal|zip|birth)[^"']*["'][^>]*>/gi, label: '個人属性らしい入力欄', sev: '要確認' },
  { re: /<form\b[^>]*action\s*=\s*["']https?:\/\/[^"']+["'][^>]*>/gi, label: '外部へ送信するフォーム', sev: 'YELLOW候補', detail: '送信先の事業者・目的・同意' },
  { re: /getUserMedia\s*\(/g, label: 'カメラ/マイクの利用', sev: '要確認', detail: '開始の同意・端末内完結か・停止手段' },
  { re: /navigator\.geolocation|getCurrentPosition\s*\(|watchPosition\s*\(/g, label: '位置情報の利用', sev: '要確認', detail: '本人同意・送信有無・保存有無' },
  { re: /Notification\.requestPermission|navigator\.share\s*\(|DeviceMotionEvent|BarcodeDetector/g, label: '端末機能の許可要求', sev: '情報' },
  { re: /<input\b[^>]*type\s*=\s*["']?file\b[^>]*>/gi, label: 'ファイル入力（画像等のアップロード）', sev: '要確認', detail: '端末内処理か送信か' },
];
const SENSITIVE = [{ re: /(心拍|血圧|体温|体重|病歴|既往歴|服薬|疾患|妊娠|うつ病|障害者手帳|健康診断|通院)/g, label: '健康・医療に近い語', sev: '要確認', detail: '要配慮個人情報に近づく。端末内完結の実測と明記', max: 2 }];
const CLAIMS = [{ re: /(最強|最高の|最大級|最安|日本一|世界一|世界初|業界初|業界最|No\.?\s?1|ナンバーワン|唯一の|完全無料|100\s?%|史上最|圧倒的|誰でも簡単)/g, label: '根拠が要る断定表現', sev: '要確認', detail: '客観的根拠（調査時点・対象・出典）か表現の緩和', max: 4 }];
const GAMBLING = [
  { re: /(ガチャ|gacha|ジェム|有償|プレミアム通貨|換金|賞金|賞品|景品|懸賞|当せん金|当選金)/gi, label: '景品・ガチャ・換金に関わる語', sev: '要確認', detail: '実際の金銭の流れの有無・景表法・資金決済法', max: 3 },
  { re: /(カジノ|casino|baccarat|バカラ|ルーレット|ブラックジャック|blackjack|poker|ポーカー|競馬|ロト6|スロットマシン|賭け)/gi, label: '賭博類似ゲームの語', sev: '要確認', detail: '現実の金銭・景品と交換できない旨の明記', max: 2 },
];
const AFFIL = [
  { re: /(adsbygoogle|googlesyndication|amazon\.co\.jp\/(?:dp|gp)|[?&]tag=[a-z0-9-]+-22|a8\.net|valuecommerce|afl\.rakuten|アフィリエイト|スポンサー提供)/gi, label: '広告/アフィリエイトの痕跡', sev: '要確認', detail: '広告であることの明示（ステマ告示）', max: 3 },
  { re: /(?:[【\[（(]PR[】\]）)]|#PR\b|\bPR[:：]|提供[:：]\s*\S+)/g, label: 'PR表記', sev: '情報', detail: '広告表示の様式の確認', max: 2 },
];
const ROM = [{ re: /(\.(?:nes|sfc|smc|gbc?|gba|nds|z64|n64|iso|cue)\b|\bBIOS\b|\bROM\b|ファミコン|ファミリーコンピュータ)/g, label: 'ROM/BIOS/エミュレータ関連', sev: '要確認', detail: 'ROM・BIOSの同梱/配布が無いこと', max: 4 }];
const SECTOOLS = [
  { re: /(keylogger|キーロガー|port\s?scan|ポートスキャン|\bexploit(?:s|ation)?\b|brute[- ]?force|ブルートフォース|sniff|スニッフ|packet\s?capture|arp\s?spoof|reverse\s?shell|metasploit)/gi, label: 'デュアルユースの語', sev: '要確認', detail: '自己環境・同意のある対象に限る旨、攻撃的実装が無いこと', max: 3 },
  { re: /\b(?:nmap|Nmap|NMAP)\b/g, label: 'デュアルユースの語', sev: '要確認', detail: '自己環境・同意のある対象に限る旨', max: 2 },
];

/** assets の出自記録。ディレクトリごとに「出自文書・AI名ファイル・媒体数」を数える。 */
function ruleProvenance(root) {
  const out = [];
  const assets = path.join(root, 'assets');
  if (!existsSync(assets)) return out;
  const MEDIA = /\.(png|jpe?g|webp|gif|svg|mp3|ogg|wav|m4a|mp4|webm)$/i;
  const PROV = /^(readme|provenance|licen[sc]e|credits?|attribution|notice|manifest|sources?|assets?)(\.[a-z]+)?$/i;
  const AI = /(gpt-?image|dall-?e|midjourney|firefly|stable-?diffusion|sdxl|canva|gemini|imagen|nano-?banana|flux|ideogram|leonardo|suno|udio|elevenlabs|voicevox)/i;
  for (const d of readdirSync(assets, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    let media = 0, ai = 0, prov = false; const aiNames = new Set();
    const stack = [path.join(assets, d.name)];
    while (stack.length) {
      const cur = stack.pop();
      for (const e of readdirSync(cur, { withFileTypes: true })) {
        const p = path.join(cur, e.name);
        if (e.isDirectory()) stack.push(p);
        else {
          if (PROV.test(e.name) || /\.md$/i.test(e.name)) prov = true;
          if (MEDIA.test(e.name)) { media++; const m = AI.exec(e.name); if (m) { ai++; aiNames.add(m[1].toLowerCase()); } }
        }
      }
    }
    if (media === 0) continue;
    if (!prov) out.push(F('provenance', ai ? 'YELLOW候補' : '要確認', `assets/${d.name}/`, 0, `出自記録なし（媒体 ${media} 点${ai ? `・生成AI名のファイル ${ai} 点: ${[...aiNames].join(',')}` : ''}）`, { media, ai, detail: '生成元・日付・ツール・規約・商用可否の記録（PROVENANCE.md）' }));
    else if (ai) out.push(F('provenance', '情報', `assets/${d.name}/`, 0, `出自文書あり。生成AI名のファイル ${ai} 点（${[...aiNames].join(',')}）— 文書にツール規約・商用可否・日付があるか確認`, { media, ai }));
  }
  return out;
}

function pkgFromUrl(url) {
  let m;
  if ((m = /cdn\.jsdelivr\.net\/npm\/((?:@[^/@]+\/)?[^/@]+)(?:@([^/]+))?/.exec(url))) return { name: m[1], version: m[2] || null };
  if ((m = /cdn\.jsdelivr\.net\/gh\/([^/]+\/[^/@]+)(?:@([^/]+))?/.exec(url))) return { name: 'gh:' + m[1], version: m[2] || null };
  if ((m = /unpkg\.com\/((?:@[^/@]+\/)?[^/@]+)(?:@([^/]+))?/.exec(url))) return { name: m[1], version: m[2] || null };
  if ((m = /cdnjs\.cloudflare\.com\/ajax\/libs\/([^/]+)\/([^/]+)/.exec(url))) return { name: m[1], version: m[2] };
  if ((m = /esm\.sh\/((?:@[^/@]+\/)?[^/@]+)(?:@([^/]+))?/.exec(url))) return { name: m[1], version: m[2] || null };
  return null;
}

// ── 本体 ──────────────────────────────────────────────────
export function scan({ root = REPO, files = null, only = null, data = null } = {}) {
  const want = (r) => !only || only.includes(r);
  const ctx = makeCtx(root, only, data);
  const disc = discover(root);
  let list = [
    ...disc.pages.map(p => ({ path: p, kind: 'page' })),
    ...disc.code.map(p => ({ path: p, kind: /manifest|\.webmanifest$/.test(path.basename(p)) ? 'manifest' : 'code' })),
    ...disc.docs.map(p => ({ path: p, kind: 'doc' })),
  ];
  if (files) { const set = new Set(files.map(s => s.replace(/\\/g, '/'))); list = list.filter(f => set.has(rel(root, f.path))); }
  const findings = [];
  const acc = { hosts: {}, analytics: [] };
  const pkgs = {};                                              // name → {version, files, sri}
  const models = new Map();                                    // id → files
  let salesSignal = null;

  for (const f of list) {
    f.text = readSafe(f.path); f.rel = rel(root, f.path);
    if (!f.text) continue;
    const isMarkup = f.kind === 'page';
    if (want('mark')) findings.push(...ruleMark(ctx, f));
    if (want('external-send') || want('oss-libs')) ruleExternal(ctx, f, acc);
    if (want('oss-libs') && (f.kind === 'page' || f.kind === 'code')) {
      for (const x of extractExternal(f)) {
        const p = pkgFromUrl(x.url); if (!p) continue;
        const e = (pkgs[p.name] ??= { versions: new Set(), files: new Set() });
        e.versions.add(p.version || '未固定'); e.files.add(f.rel);
      }
    }
    if (isMarkup || f.kind === 'code') {
      if (want('pii-collection') && isMarkup) findings.push(...ruleOnText(ctx, f, 'pii-collection', PII));
      if (want('pii-collection') && f.kind === 'code' && !/^(sw|gamekit)/.test(path.basename(f.path))) findings.push(...ruleOnText(ctx, f, 'pii-collection', PII.slice(3, 6)));
      if (want('sensitive-category') && isMarkup) findings.push(...ruleOnText(ctx, f, 'sensitive-category', SENSITIVE.map(s => ({ ...s, re: new RegExp(s.re.source, 'g') }))));
      if (want('gambling-gacha') && isMarkup) findings.push(...ruleOnText(ctx, f, 'gambling-gacha', GAMBLING));
      if (want('rom-emulator') && isMarkup && /(emulator|エミュレータ|nes)/i.test(f.rel + f.text.slice(0, 4000))) findings.push(...ruleOnText(ctx, f, 'rom-emulator', ROM));
      if (want('security-tools') && isMarkup) findings.push(...ruleOnText(ctx, f, 'security-tools', SECTOOLS));
    }
    if (want('affiliate-ad') && (isMarkup || f.kind === 'doc')) {
      const live = { ...f, text: isMarkup ? blankInert(f.text) : f.text };
      findings.push(...ruleOnText(ctx, live, 'affiliate-ad', AFFIL));
      if (isMarkup && /adsbygoogle|googlesyndication|pagead/i.test(f.text) && !/adsbygoogle|googlesyndication|pagead/i.test(live.text)) {
        const at = f.text.search(/adsbygoogle|googlesyndication|pagead/i);
        findings.push(F('affiliate-ad', '要確認', f.rel, lineIndex(f.text)(at), 'AdSense の雛形（コメント/CSP許可）あり — 有効化する時点で privacy.html の「広告なし」記載・外部送信規律・広告表示の要件が変わる', { detail: '有効化前に法務再確認' }));
      }
    }
    if (want('claims') && (f.kind === 'doc' || isMarkup)) {
      // 広告・メタ記述・告知文面に限る（ゲーム内の演出語を拾わない）
      const L = lineIndex(f.text);
      const targets = [];
      if (isMarkup) for (const m of f.text.matchAll(/<meta\b[^>]*>/gi)) { const a = attrs(m[0]); if (/description/i.test(a.name || a.property || '')) targets.push({ text: a.content || '', line: L(m.index) }); }
      else if (!/_strategy.md$/.test(f.rel)) targets.push({ text: f.text, line: 1, whole: true });
      for (const t of targets) for (const m of t.text.matchAll(CLAIMS[0].re)) {
        const ln = t.whole ? t.text.slice(0, m.index).split('\n').length : t.line;
        findings.push(F('claims', '要確認', f.rel, ln, `根拠が要る断定表現: ${m[0]}（…${t.text.slice(Math.max(0, m.index - 14), m.index + 18).replace(/\s+/g, ' ')}…）`, { detail: CLAIMS[0].detail }));
        if (findings.filter(x => x.rule === 'claims' && x.file === f.rel).length >= 4) break;
      }
    }
    if (want('ai-models') && (isMarkup || f.kind === 'code')) {
      for (const m of f.text.matchAll(/\b((?:Qwen|gemma|Llama|Phi|SmolLM|Mistral|DeepSeek|TinyLlama)[A-Za-z0-9._-]*)/g)) {
        if (!/[0-9]/.test(m[1]) || m[1].length < 6) continue;
        (models.get(m[1]) ?? models.set(m[1], new Set()).get(m[1])).add(f.rel);
      }
    }
    if (!salesSignal && isMarkup && /(js\.stripe\.com|buy\.stripe\.com|checkout\.stripe\.com|paypal\.com\/(?:sdk|cgi)|booth\.pm|gumroad\.com|pay\.jp)/i.test(f.text)) salesSignal = f.rel + '（決済SDK/外部販売ページ）';
    if (!salesSignal && f.kind === 'doc' && /^note\/articles\//.test(f.rel) && /^price:\s*[1-9]/m.test(f.text)) salesSignal = 'note有料記事（' + f.rel + '）';
  }

  // ── 集約型の規則 ──
  if (want('external-send')) {
    const hosts = ctx.hosts();
    const privacy = ctx.privacy();
    for (const e of Object.values(acc.hosts).sort((a, b) => b.files.size - a.files.size)) {
      const known = hosts[e.host] || Object.entries(hosts).find(([h]) => e.host.endsWith('.' + h))?.[1] || (/(^|\.)hf\.co$/.test(e.host) ? hosts['huggingface.co'] : null);
      if (known && known.sends === 'none') continue;
      const tokens = known ? [e.host, ...(known.privacy || []), String(known.name).toLowerCase().split(/[（(／]/)[0].trim()] : [e.host];
      const mentioned = privacy ? tokens.some(t => privacy.includes(nfkc(t).toLowerCase())) : null;
      const sample = [...e.files.entries()].slice(0, 3).map(([f, l]) => `${f}:${l}`).join(', ');
      const sev = !known ? 'YELLOW候補' : (known.sends === 'loads' && !mentioned ? 'YELLOW候補' : '情報');
      findings.push(F('external-send', sev, sample.split(',')[0].split(':')[0], Number(sample.split(',')[0].split(':')[1]) || 0,
        `${e.host}${known ? `（${known.name}／${known.sends}）` : '（未分類）'} ×${e.files.size}ファイル [${[...e.kinds].join(',')}]${mentioned === false ? ' ※privacy.html に記載なし' : ''}`,
        { host: e.host, known: !!known, sends: known?.sends, info: known?.info, note: known?.note, mentioned, filesCount: e.files.size, sample }));
    }
    findings.push(...acc.analytics.slice(0, 20));
  }
  if (want('oss-libs')) {
    const oss = ctx.oss();
    for (const [name, e] of Object.entries(pkgs)) {
      const k = oss[name];
      findings.push(F('oss-libs', k ? (k.copyleft || !k.confirmed ? '要確認' : '情報') : 'YELLOW候補', [...e.files][0], 0,
        `${name}@${[...e.versions].join('|')} → ${k ? k.license : '台帳に無い（不明→要確認）'}${k && !k.confirmed ? '（記憶ベース・原典未確認）' : ''}${[...e.versions].includes('未固定') ? ' ※版未固定' : ''}`,
        { pkg: name, license: k?.license, copyleft: k?.copyleft, attribution: k?.attribution, files: e.files.size, note: k?.note }));
    }
  }
  if (want('ai-models')) {
    const defs = ctx.models();
    const seen = new Map();
    for (const [id, fs] of models) {
      const d = defs.find(x => new RegExp(x.match, 'i').test(id));
      const key = d ? d.id : '台帳に無い:' + id;
      if (!seen.has(key)) seen.set(key, { d, ids: new Set(), files: new Set() });
      seen.get(key).ids.add(id); fs.forEach(x => seen.get(key).files.add(x));
    }
    for (const [key, v] of seen) {
      const d = v.d;
      findings.push(F('ai-models', !d ? 'YELLOW候補' : (d.commercial === false ? 'YELLOW候補' : '要確認'), [...v.files][0], 0,
        `${[...v.ids].slice(0, 4).join(', ')}${v.ids.size > 4 ? ' ほか' : ''} → ${d ? `${d.license}${d.commercial === false ? '【非商用限定】' : ''}${d.confirmed ? `（確認済 ${d.checked}）` : '（記憶ベース）'}` : '台帳に無い（要確認）'}`,
        { model: key, obligations: d?.obligations, note: d?.note, source: d?.source }));
    }
  }
  if (want('provenance')) findings.push(...ruleProvenance(root));
  if (want('legal-pages')) {
    const has = (re) => readdirSync(root).some(n => re.test(n));
    const lp = [
      ['privacy.html', has(/^privacy\.html$/i)],
      ['利用規約（terms/kiyaku）', has(/^(terms|tos|kiyaku|rules)[-_.]/i)],
      ['特定商取引法表記（tokushoho）', has(/(tokushoho|tokusho|tokutei)/i)],
    ];
    const idx = readSafe(path.join(root, 'index.html'));
    for (const [name, ok] of lp) {
      const needed = name.startsWith('特定') ? !!salesSignal : name.startsWith('利用規約') ? !!salesSignal : true;
      if (!ok && needed) findings.push(F('legal-pages', name.startsWith('privacy') ? 'YELLOW候補' : '要確認', '(site)', 0, `${name} が見当たらない${salesSignal ? `（収益化の信号: ${salesSignal}）` : ''}`, {}));
    }
    if (has(/^privacy\.html$/i) && idx && !/privacy\.html/i.test(idx)) findings.push(F('legal-pages', '要確認', 'index.html', 0, 'index.html から privacy.html へのリンクが見当たらない', {}));
    if (!salesSignal) findings.push(F('legal-pages', '情報', '(site)', 0, '収益化（有料記事・課金・決済）の信号は検出されず → 特商法表記・利用規約は現時点で必須でない可能性（始めたら要対応）', {}));
  }
  if (want('privacy-consistency')) {
    const privacy = ctx.privacy();
    if (privacy) {
      const wdir = path.join(root, 'cloudflare-worker');
      const vendors = [
        { re: /generativelanguage\.googleapis\.com|GEMINI_API_KEY|gemini-[0-9]/i, label: 'Google Gemini API', tokens: ['gemini', 'google'] },
        { re: /api\.openai\.com/i, label: 'OpenAI API', tokens: ['openai'] },
        { re: /api\.anthropic\.com/i, label: 'Anthropic API', tokens: ['anthropic'] },
        { re: /env\.AI\.run|@cf\/|workers[- ]?ai/i, label: 'Cloudflare Workers AI', tokens: ['workers ai', 'cloudflare'] },
      ];
      if (existsSync(wdir)) for (const n of readdirSync(wdir)) {
        if (!/\.js$/.test(n)) continue;
        const t = readSafe(path.join(wdir, n));
        for (const v of vendors) {
          const m = v.re.exec(t);
          if (m && !v.tokens.some(tok => privacy.includes(tok))) findings.push(F('privacy-consistency', 'YELLOW候補', `cloudflare-worker/${n}`, lineIndex(t)(m.index), `実装が ${v.label} を使うが privacy.html に記載がない`, { vendor: v.label }));
          else if (m) findings.push(F('privacy-consistency', '情報', `cloudflare-worker/${n}`, lineIndex(t)(m.index), `${v.label} を使用 → privacy.html に言及あり`, { vendor: v.label }));
        }
        const claimsWorkersAI = privacy.includes('workers ai');
        if (claimsWorkersAI && /generativelanguage\.googleapis\.com|GEMINI_API_KEY/i.test(t) && !/env\.AI\.run|@cf\//.test(t)) findings.push(F('privacy-consistency', 'YELLOW候補', `cloudflare-worker/${n}`, 1, 'privacy.html は Cloudflare Workers AI と記載するが、実装は Gemini API を呼ぶ（事実と不一致の可能性）', {}));
      }
    }
  }
  const order = { 'RED候補': 0, 'YELLOW候補': 1, '要確認': 2, '情報': 3 };
  findings.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9) || a.rule.localeCompare(b.rule) || a.file.localeCompare(b.file));
  return { findings, scanned: list.length };
}

// ── CLI ──────────────────────────────────────────────────
function printHuman(res, all) {
  const byRule = new Map();
  for (const f of res.findings) (byRule.get(f.rule) ?? byRule.set(f.rule, []).get(f.rule)).push(f);
  console.log(`法務スキャン — ${res.scanned} ファイル／候補 ${res.findings.length} 件（RED候補 ${res.findings.filter(f => f.severity === 'RED候補').length}・YELLOW候補 ${res.findings.filter(f => f.severity === 'YELLOW候補').length}・要確認 ${res.findings.filter(f => f.severity === '要確認').length}・情報 ${res.findings.filter(f => f.severity === '情報').length}）`);
  console.log('※ 候補の列挙であって判定ではない。評価は legal-checker が条文に当てて行う。\n');
  for (const [rule, list] of byRule) {
    const meta = RULES[rule];
    console.log(`■ ${rule} — ${meta?.title ?? ''}（${list.length}件）`);
    if (meta) console.log(`   条文: ${meta.cites.join(' ')}\n   次の一手: ${meta.next}`);
    for (const f of list.slice(0, all ? Infinity : 14)) console.log(`   [${f.severity}] ${f.file}${f.line ? ':' + f.line : ''}  ${f.text}${f.owner ? `  〈${f.owner}〉` : ''}${f.styleClaim ? ' ※風/ライク表現あり' : ''}`);
    if (!all && list.length > 14) console.log(`   …ほか ${list.length - 14} 件（--all）`);
    console.log('');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  let files = arg('--files') ? arg('--files').split(',') : null;
  if (args.includes('--changed')) {
    try {
      files = execFileSync('git', ['diff', 'HEAD', '--name-only'], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);
      if (!files.length) { console.log('変更ファイルなし（git diff HEAD）'); process.exit(0); }
    } catch (e) { console.log('git diff に失敗: ' + e.message); process.exit(1); }
  }
  const res = scan({ files, only: arg('--only') ? arg('--only').split(',') : null });
  if (args.includes('--json')) console.log(JSON.stringify(res, null, 1));
  else printHuman(res, args.includes('--all'));
}
