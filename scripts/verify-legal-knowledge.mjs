#!/usr/bin/env node
/*
 * verify-legal-knowledge.mjs — リーガルチェッカーの知識ベースが「実在の条文」に当たっているかの機械検査。
 *
 * 守るもの:
 *   法律知識は「覚えている条文」で書くと、番号の取り違え・改正による内容の変化が**例外もエラーも出さずに**混ざる。
 *   しかも読み手（AI・人）は条文番号が付いているだけで正しいと受け取る。そこで知識ベース内の引用
 *   【法令名 条番号｜キーワード】を、取得済みの法令コーパス（legal/corpus）の実条文に必ず当てる。
 *
 * 検査:
 *   A. コーパスの完全性   登録簿の全法令が在る／sha256一致／条数一致／アンカー条文（憲法21条の「通信の秘密」等）
 *   B. コーパスの鮮度     施行日を過ぎた改正が未取込なら ✗（30日超）／△（30日以内）。取得から60日超は △
 *   C. 引用の実在         知識ベース内の全引用が実在の条に当たり、キーワードが条文に含まれる
 *   D. 引用の改正リスク   引用した条が、現行の直近改正または施行予定の改正の対象なら △（日付つき）
 *   E. 網羅               六法ノートが最低限の引用数を持つ（中身の無いノートを通さない）
 *   F. 知識ベースの構造   INDEX と実ファイルの一致・データ表（外部送信先/OSS/モデル/他社標章）の形・スキャナの自己検査
 *   G. エージェント定義   legal-checker が必要な道具を持ち、道具が実在する
 *
 * 使い方:
 *   node scripts/verify-legal-knowledge.mjs            全検査
 *   node scripts/verify-legal-knowledge.mjs --inject   故障を仕込んで ✗ が出ることを確かめる（偽の緑の防止）
 * 終了コード: ✗あり=1 / △のみ・問題なし=0
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { scan, RULES, loadData } from './legal-scan.mjs';
import { doCheckOnline, doAmendments } from './legal-corpus.mjs';
import {
  ROOT, CORPUS_DIR, LAWS, norm, lawByName, loadLaw, clearCache, loadManifest,
  extractCitations, checkCitation, displayArticleNum, allLawNames,
} from './legal-lib.mjs';

const JST_TODAY = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const DAY = 86400e3;
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

/** 検査対象の知識ファイル（引用を機械照合する範囲）。新しい置き場を作ったらここへ足す。 */
function knowledgeFiles() {
  const out = [];
  const walk = (dir, filter) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, filter);
      else if (filter(e.name)) out.push(p);
    }
  };
  walk(path.join(ROOT, 'obsidian-vault', '04-Knowledge'), n => /^rokuho-.*\.md$/.test(n));
  walk(path.join(ROOT, 'legal', 'knowledge'), n => n.endsWith('.md'));
  const agent = path.join(ROOT, '.claude', 'agents', 'legal-checker.md');
  if (existsSync(agent)) out.push(agent);
  const skill = path.join(ROOT, '.claude', 'skills', 'legal-review', 'SKILL.md');
  if (existsSync(skill)) out.push(skill);
  return out;
}

const P = (level, msg) => ({ level, msg });

// ── A. コーパスの完全性 ────────────────────────────────────
/** 条文の取り違え（パーサの崩れ・番号ずれ）を検出するためのアンカー。実在の条文の一節が含まれること。 */
export const ANCHORS = [
  ['kenpo', '21', ['通信の秘密', '検閲']], ['kenpo', '13', ['幸福追求']], ['kenpo', '35', ['令状']],
  ['minpo', '709', ['故意又は過失']], ['minpo', '548_2', ['定型約款']], ['minpo', '5', ['未成年者']],
  ['keiho', '168_2', ['不正指令電磁的記録']], ['keiho', '230', ['名誉を毀損']], ['keiho', '185', ['賭博']],
  ['shoho', '4', ['商人']], ['minso', '3_3', ['不法行為']], ['keiso', '235', ['六箇月']],
  ['chosakuken', '32', ['引用']], ['chosakuken', '30_4', ['享受']], ['chosakuken', '112', ['差止']],
  ['shohyo', '37', ['侵害']], ['fukyo', '3', ['差止']], ['kojinjoho', '27', ['第三者']],
  ['denki', '27_12', ['送信']], ['keihyo', '5', ['不当な表示']], ['tokushoho', '11', ['表示']],
];
/** 条数の下限（取得が途中で切れた／構造が変わって条が拾えなくなった、を検出）。 */
export const FLOORS = { kenpo: 103, minpo: 1000, keiho: 250, shoho: 200, minso: 400, keiso: 600, chosakuken: 200 };

/**
 * ハッシュは改行を LF に正規化して計算する。
 * MANIFEST の sha256 は LF の本文で計算してある。git の autocrlf=true（このPCの設定）では
 * チェックアウトで JSON が CRLF に変換されるため、生バイトで比べると**全法令が偽の赤**になる
 * （ブランチを切り替えた瞬間に全件落ちた）。内容の改ざん検出は LF 正規化後でも変わらない。
 */
export const normEolBuf = (buf) => Buffer.from(Buffer.from(buf).toString('utf8').replace(/\r\n/g, '\n'));

export function checkCorpus({ manifest, readFile = (p) => readFileSync(p), exists = existsSync, loadLawFn = loadLaw } = {}) {
  const out = [];
  if (!manifest) return [P('fail', 'legal/corpus/MANIFEST.json が無い。node scripts/legal-corpus.mjs --fetch')];
  const bySlug = new Map(manifest.laws.map(l => [l.slug, l]));
  for (const e of LAWS) {
    const m = bySlug.get(e.slug);
    const file = path.join(CORPUS_DIR, `${e.slug}.json`);
    if (!m) { out.push(P('fail', `登録簿の ${e.title} が MANIFEST に無い（--fetch）`)); continue; }
    if (!exists(file)) { out.push(P('fail', `${e.title} のコーパスファイルが無い: ${path.relative(ROOT, file)}`)); continue; }
    const sha = createHash('sha256').update(normEolBuf(readFile(file))).digest('hex');
    if (sha !== m.sha256) out.push(P('fail', `${e.title}: sha256 が MANIFEST と一致しない（手で編集された／壊れた。--fetch --only ${e.slug}）`));
    const L = loadLawFn(e);
    if (!L) { out.push(P('fail', `${e.title}: 読めない`)); continue; }
    if (L.articles.length !== m.articles) out.push(P('fail', `${e.title}: 条数が MANIFEST と違う（${L.articles.length} ≠ ${m.articles}）`));
    if (FLOORS[e.slug] && L.articles.length < FLOORS[e.slug]) out.push(P('fail', `${e.title}: 条数が少なすぎる（${L.articles.length} < ${FLOORS[e.slug]}）。取得が途中で切れた可能性`));
  }
  for (const [slug, n, words] of ANCHORS) {
    const L = loadLawFn(slug);
    const a = L?.byNum.get(n);
    if (!a) { out.push(P('fail', `アンカー: ${slug} ${displayArticleNum(n)} が無い（番号ずれ/パーサ崩れの疑い）`)); continue; }
    const hay = norm((a.t || '') + a.p.join(''));
    const miss = words.filter(w => !hay.includes(norm(w)));
    if (miss.length) out.push(P('fail', `アンカー: ${L.title} ${displayArticleNum(n)} に「${miss.join('・')}」が無い（条の取り違え/パーサ崩れの疑い）`));
  }
  return out;
}

// ── B. 鮮度 ──────────────────────────────────────────────
export function checkFreshness(manifest, today = JST_TODAY()) {
  const out = [];
  if (!manifest) return out;
  // 法令ごとの取得日で見る（--fetch --only の部分取得で全体の日付が新しくなっても、古い法令を隠さない）
  const stale = manifest.laws
    .map(l => ({ l, age: daysBetween(String(l.fetched_at || manifest.fetched_at).slice(0, 10), today) }))
    .filter(x => x.age > 60);
  if (stale.length) out.push(P('warn', `${stale.length}法令の取得から60日超（${stale.slice(0, 5).map(x => `${x.l.title} ${x.age}日`).join('・')}${stale.length > 5 ? ' ほか' : ''}）。node scripts/legal-corpus.mjs --check-online で最新か確認（改正は黙って入る）`));
  for (const l of manifest.laws) {
    for (const u of l.upcoming || []) {
      if (u.date <= today) {
        const over = daysBetween(u.date, today);
        out.push(P(over > 30 ? 'fail' : 'warn',
          `${l.title}: ${u.date} 施行の改正（${u.title}）が取込後に施行済み（${over}日経過）。コーパスは古い → node scripts/legal-corpus.mjs --fetch --only ${l.slug}`));
      }
    }
  }
  return out;
}

// ── C/D. 引用 ────────────────────────────────────────────
/** 法令名らしいのに登録簿に無い／番号を解釈できない括弧書きを拾う（誤記が素通りしないように）。 */
function looseBrackets(text) {
  const re = /【([^【】｜\n]{2,60}?)\s*(第?[0-9〇一二三四五六七八九十百千]+条[^｜】]*)(?:｜[^】]*)?】/g;
  const found = [];
  let m;
  while ((m = re.exec(text))) found.push({ raw: m[0], name: m[1].trim(), index: m.index });
  return found;
}

export function checkCitations(text, label, amend) {
  const out = [];
  const cites = extractCitations(text);
  const okRaw = new Set(cites.map(c => c.raw));
  const amendHits = new Map();
  for (const b of looseBrackets(text)) {
    if (okRaw.has(b.raw)) continue;
    if (!lawByName(b.name)) out.push(P('fail', `${label}: 未登録の法令名または解釈できない引用 ${b.raw}（legal-lib.mjs の LAWS に無い）`));
    else out.push(P('fail', `${label}: 引用の書式が不正で検証されない ${b.raw}（条は「32条」「30条の4」、項は半角数字の「第N項」。全角数字・漢数字の項や誤記は解釈されず、検証をすり抜ける）`));
  }
  for (const c of cites) {
    if (!c.article) { out.push(P('fail', `${label}: 条番号を解釈できない ${c.raw}`)); continue; }
    const r = checkCitation(c);
    if (!r.ok) { out.push(P('fail', `${label}: ${c.raw} → ${r.reason}`)); continue; }
    // 改正リスク（D）— (法令, 改正) 単位に集約して件数を抑える
    const a = amend?.laws?.[c.law];
    if (a) {
      const hits = [];
      if (a.current && daysBetween(a.current.date, JST_TODAY()) <= 365 && [...a.current.changed, ...a.current.added].includes(c.article)) hits.push(`直近1年内に改正済み（${a.current.date}）`);
      for (const u of a.upcoming || []) if ([...u.changed, ...u.added, ...u.removed].includes(c.article)) hits.push(`${u.date} 施行予定の改正`);
      for (const h of hits) {
        const key = c.law + '|' + h;
        const e = (amendHits.get(key) ?? amendHits.set(key, { lawTitle: c.lawTitle, law: c.law, h, arts: new Set() }).get(key));
        e.arts.add(displayArticleNum(c.article));
      }
    }
  }
  for (const e of amendHits.values()) out.push(P('warn', `${label}: ${e.lawTitle} の引用 ${[...e.arts].join('・')} は ${e.h} の対象。施行日以降の文言を確認（--diff ${e.law}）`));
  return out;
}

/** 【】なしの条文言及（検証されない引用）の数。△で件数だけ知らせ、書き方の改善を促す。 */
export function countUnverifiedMentions(text) {
  const names = allLawNames().map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(`(?<!【)(?:${names})第?[0-9]+条`, 'g');
  const stripped = text.replace(/【[^】]*】/g, '');
  return (stripped.match(re) || []).length;
}

// ── E. 網羅 ──────────────────────────────────────────────
const MIN_CITES = { 'rokuho-overview.md': 3, '00-method.md': 6, '08-this-repo-ledger.md': 5, default: 12 };
export function checkCoverage(file, text) {
  const base = path.basename(file);
  if (!/^rokuho-/.test(base) && !/legal[\\/]knowledge[\\/]\d\d-/.test(file)) return [];
  const min = MIN_CITES[base] ?? MIN_CITES.default;
  const n = extractCitations(text).length;
  return n < min ? [P('fail', `${path.relative(ROOT, file)}: 検証できる引用が ${n} 件しかない（最低 ${min}）。【法令名 条｜語】で条文に結び付ける`)] : [];
}

// ── 実行 ─────────────────────────────────────────────────
function loadAmend() {
  const f = path.join(CORPUS_DIR, 'AMENDMENTS.json');
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
}

/** 追加の検査（F/G）は別モジュール化しやすいよう配列で受ける。 */
export const EXTRA_CHECKS = [];

// ── F/G. 知識ベースの構造・データ台帳・走査器の自己検査・エージェント定義 ─────────────
const KNOW = path.join(ROOT, 'legal', 'knowledge');

/** INDEX が全ノートを案内し、リンク先が実在すること。 */
export function checkIndex({ indexText, files, exists = existsSync }) {
  const out = [];
  if (indexText == null) return [P('fail', 'legal/knowledge/INDEX.md が無い（知識ベースの入口）')];
  for (const f of files) if (!indexText.includes(f)) out.push(P('fail', `INDEX.md に ${f} への案内が無い（読まれない知識になる）`));
  for (const m of indexText.matchAll(/\]\((?!https?:)([^)#]+)\)/g)) {
    const target = path.resolve(KNOW, m[1]);
    if (!exists(target)) out.push(P('fail', `INDEX.md のリンク先が実在しない: ${m[1]}`));
  }
  return out;
}

/** データ台帳の形。壊れた台帳はスキャナが黙って何も拾わなくなる原因になる。 */
export function checkData({ marks, hosts, oss, models }) {
  const out = [];
  const seen = new Set();
  for (const m of marks) {
    if (!m.id || seen.has(m.id)) out.push(P('fail', `third-party-marks: id が空か重複: ${m.id}`));
    seen.add(m.id);
    if (!Array.isArray(m.terms) || !m.terms.length || m.terms.some(t => typeof t !== 'string' || !t.trim())) out.push(P('fail', `third-party-marks[${m.id}]: terms が不正`));
    if (!['high', 'verify'].includes(m.confidence)) out.push(P('fail', `third-party-marks[${m.id}]: confidence は high/verify のみ（${m.confidence}）。登録の有無を断定する語彙を増やさない`));
    if (!['game', 'toy', 'media', 'tech'].includes(m.kind)) out.push(P('fail', `third-party-marks[${m.id}]: kind が不正（${m.kind}）`));
    if (!m.owner) out.push(P('fail', `third-party-marks[${m.id}]: owner が空`));
    if (/登録番号|第\d{6,}号/.test(JSON.stringify(m))) out.push(P('fail', `third-party-marks[${m.id}]: 登録番号の断定は台帳に書かない（確認結果は検査日つきで報告書へ）`));
    for (const f of m.files || []) if (f !== f.toLowerCase() || /[^a-z0-9_-]/.test(f)) out.push(P('fail', `third-party-marks[${m.id}]: files は小文字ASCIIのトークン（${f}）`));
  }
  for (const [h, v] of Object.entries(hosts)) {
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(h)) out.push(P('fail', `external-hosts: ホスト名が不正: ${h}`));
    if (!['loads', 'user-input', 'none'].includes(v.sends)) out.push(P('fail', `external-hosts[${h}]: sends は loads/user-input/none（${v.sends}）`));
    if (!v.name || !v.kind) out.push(P('fail', `external-hosts[${h}]: name/kind が空`));
  }
  for (const [k, v] of Object.entries(oss)) {
    if (!v.license || typeof v.confirmed !== 'boolean') out.push(P('fail', `oss-licenses[${k}]: license/confirmed が不正`));
  }
  for (const m of models) {
    try { new RegExp(m.match, 'i'); } catch { out.push(P('fail', `ai-model-licenses[${m.id}]: match が正規表現として不正`)); }
    if (typeof m.commercial !== 'boolean' || typeof m.confirmed !== 'boolean') out.push(P('fail', `ai-model-licenses[${m.id}]: commercial/confirmed は真偽値`));
    if (m.confirmed && (!/^\d{4}-\d{2}-\d{2}$/.test(m.checked || '') || !/^https?:\/\//.test(m.source || ''))) out.push(P('fail', `ai-model-licenses[${m.id}]: confirmed=true には checked(日付) と source(URL) が要る（一次情報で確認した証跡）`));
  }
  return out;
}

/** 走査器の自己検査。合成データで「拾うべきものを拾い、拾ってはいけないものを拾わない」を確かめる。 */
export function selfTestScanner(data = null) {
  const out = [];
  const tmp = mkdtempSync(path.join(tmpdir(), 'legal-scan-'));
  try {
    const w = (name, text) => { const p = path.join(tmp, name); mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, text); };
    // 拾うべきもの（bad）
    w('zelda_like.html', '<!doctype html><title>ゼルダ風RPG</title><meta name="description" content="世界一の最強アクションRPG No.1"><h1>ゼルダ風RPG</h1><a href="https://example.org/x">link</a>');
    w('tracker.html', '<!doctype html><title>独自ゲーム</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP"><script async src="https://www.googletagmanager.com/gtag/js?id=G-TEST"></script><script src="https://cdn.jsdelivr.net/npm/three@0.150.0/build/three.min.js"></script>');
    w('camera.html', '<!doctype html><title>独自カメラ</title><input type="email" name="mail"><script>navigator.mediaDevices.getUserMedia({video:true});</script>');
    w('casino.html', '<!doctype html><title>独自カード</title><p>ブラックジャックの景品ガチャ</p>');
    w('assets/foo/img-gpt-image-1.png', 'x');
    w('app.jsx', 'import "https://unpkg.com/howler@2.2.4/dist/howler.min.js";\nexport default function App() { return null; }');
    w('model.html', '<!doctype html><title>独自モデル</title><script>const M = { id: "Qwen2.5-3B-Instruct-q4f16_1-MLC" };</script>');
    // 拾ってはいけないもの（clean）— 誤検知の防止
    w('clean.html', '<!doctype html><!-- <ins class="adsbygoogle"></ins> --><title>オリジナル戦略ゲーム</title><meta name="description" content="自作の戦略ゲーム"><script>const nMap = new Map(); const pr = 1; const payload = {};</script><a href="https://www.youtube.com/watch?v=x">link</a><p>三国志の時代を舞台にした説明</p><script>const LINKS = [{ name: "yt", url: "https://www.youtube.com/" }, { name: "gh", url: "https://github.com/" }];</script>');
    w('privacy.html', '<!doctype html><title>privacy</title><p>外部送信はありません。</p>');
    w('index.html', '<!doctype html><a href="privacy.html">privacy</a>');
    const r = scan({ root: tmp, data });
    const has = (rule, pred) => r.findings.some(f => f.rule === rule && pred(f));
    const need = (label, ok) => { if (!ok) out.push(P('fail', `走査器の自己検査: ${label} を検出できない`)); };
    need('他社標章（ゼルダ）をファイル名/タイトルで', has('mark', f => f.mark === 'nintendo-zelda' && f.severity === 'RED候補'));
    need('解析タグ（googletagmanager）', has('external-send', f => /googletagmanager/.test(f.text) && f.severity === 'RED候補'));
    need('privacy未記載の外部送信（Google Fonts）を台帳で分類して', has('external-send', f => f.host === 'fonts.googleapis.com' && f.severity === 'YELLOW候補' && f.known === true && /Google Fonts/.test(f.text)));
    need('CDNライブラリ（three）をライセンス台帳へ突合して（MIT）', has('oss-libs', f => f.pkg === 'three' && /MIT/.test(f.license || '')));
    need('JSXファイルのCDN読込（howler）', has('oss-libs', f => f.pkg === 'howler' && /app\.jsx/.test(f.file)));
    need('AIモデル（Qwen2.5-3B）を非商用限定として', has('ai-models', f => f.model === 'qwen2.5-3b' && /非商用/.test(f.text)));
    need('カメラ利用', has('pii-collection', f => /カメラ/.test(f.text)));
    need('email入力欄', has('pii-collection', f => /email/.test(f.text)));
    need('根拠が要る断定表現', has('claims', f => /世界一|No/.test(f.text)));
    need('ガチャ・景品の語', has('gambling-gacha', f => /ガチャ|景品/.test(f.text)));
    need('賭博類似の語', has('gambling-gacha', f => /ブラックジャック/.test(f.text)));
    need('出自記録の無い生成AI素材', has('provenance', f => f.file.startsWith('assets/foo') && f.severity === 'YELLOW候補'));
    // 誤検知の防止
    const noise = (label, bad) => { if (bad) out.push(P('fail', `走査器の誤検知: ${label}`)); };
    noise('コメントアウトされた AdSense を解析タグとして RED にした', r.findings.some(f => f.rule === 'external-send' && f.file === 'clean.html' && f.severity === 'RED候補'));
    noise('変数名 nMap をセキュリティ語として拾った', r.findings.some(f => f.rule === 'security-tools' && f.file === 'clean.html'));
    noise('一般の <a href> リンク先（youtube）を外部送信として拾った', r.findings.some(f => f.rule === 'external-send' && /youtube/.test(f.text)));
    noise('リンク集の url: プロパティ（<a href>へ流れるだけ）を外部送信として拾った', r.findings.some(f => f.rule === 'external-send' && /(youtube|github)\.com/.test(f.text)));
    noise('説明的言及（三国志）を RED にした', r.findings.some(f => f.rule === 'mark' && f.file === 'clean.html' && f.severity === 'RED候補'));
  } finally { rmSync(tmp, { recursive: true, force: true }); }
  return out;
}

/** コーパスCLI（--check-online / --amendments）が障害時に黙って成功しないこと。API は偽の取得関数で差し替える。 */
export async function selfTestCorpusCli() {
  const out = [];
  const offline = async () => { throw new Error('offline'); };
  const logs = [];
  const code1 = await doCheckOnline(['kenpo'], { getJson: offline, log: (x) => logs.push(String(x)) });
  if (code1 === 0) out.push(P('fail', '--check-online: 1法令も確認できなかったのに終了コード0（障害時に「最新」と誤認させる）'));
  if (logs.some(l => l.includes('全件最新'))) out.push(P('fail', '--check-online: 確認できなかったのに「全件最新」と表示した'));
  // 陽性対照: 現行版が MANIFEST と一致するなら「全件最新」で成功する（厳しすぎて常に落ちる検査にしない）
  const m = loadManifest().laws.find(l => l.slug === 'kenpo');
  const okLogs = [];
  const okCode = await doCheckOnline(['kenpo'], {
    getJson: async () => ({ revisions: [{ law_revision_id: m.revision_id, amendment_enforcement_date: m.enforcement_date, amendment_law_title: '', current_revision_status: 'CurrentEnforced' }] }),
    log: (x) => okLogs.push(String(x)),
  });
  if (okCode !== 0 || !okLogs.some(l => l.includes('全件最新'))) out.push(P('fail', '--check-online: 版が一致しているのに成功と表示されない（検査が厳しすぎる）'));
  const tmp = mkdtempSync(path.join(tmpdir(), 'legal-amend-'));
  try {
    const code2 = await doAmendments(['kenpo'], tmp, { getJson: offline, log: () => {} });
    if (code2 === 0) out.push(P('fail', '--amendments: 取得に失敗したのに終了コード0'));
    if (existsSync(path.join(tmp, 'AMENDMENTS.json')) || existsSync(path.join(tmp, 'AMENDMENTS.md'))) out.push(P('fail', '--amendments: 失敗したのに不完全な AMENDMENTS を書き出した（改正の警告が黙って消える）'));
    const code3 = await doAmendments(['kenpo'], null, { getJson: offline, log: () => {} });
    if (code3 === 0) out.push(P('fail', '--amendments: --only を --out 無しで受け付けた（既定の出力を部分的な内容で壊しうる）'));
  } finally { rmSync(tmp, { recursive: true, force: true }); }
  return out;
}

export function checkRuleCites(amend) {
  const out = [];
  for (const [id, r] of Object.entries(RULES)) out.push(...checkCitations((r.cites || []).join(' '), `legal-scan RULES.${id}`, amend));
  return out;
}

/** エージェント定義が必要な道具・知識を持ち、参照先が実在すること。 */
export function checkAgent({ text, exists = (p) => existsSync(path.join(ROOT, p)) }) {
  const out = [];
  if (text == null) return [P('fail', '.claude/agents/legal-checker.md が無い')];
  const tools = /^tools:\s*(.+)$/m.exec(text)?.[1] || '';
  for (const t of ['Bash', 'WebFetch', 'WebSearch', 'Read', 'Grep']) if (!tools.includes(t)) out.push(P('fail', `legal-checker の tools に ${t} が無い（条文検索・原典確認ができない）`));
  if (/\bEdit\b/.test(tools)) out.push(P('fail', 'legal-checker に Edit がある（判断と修正を同じ手で行わない。規約§2）'));
  for (const s of ['scripts/legal-lookup.mjs', 'scripts/legal-scan.mjs', 'scripts/legal-corpus.mjs', 'scripts/verify-legal-knowledge.mjs', 'legal/knowledge/INDEX.md', 'legal/knowledge/00-method.md']) {
    if (!text.includes(s)) out.push(P('fail', `legal-checker 定義が ${s} に触れていない（道具・知識が使われない）`));
  }
  for (const m of text.matchAll(/(legal\/knowledge\/[A-Za-z0-9_./-]+\.(?:md|json)|scripts\/legal-[a-z-]+\.mjs|scripts\/verify-legal-knowledge\.mjs)/g)) {
    if (!exists(m[1])) out.push(P('fail', `legal-checker 定義が実在しないパスを参照: ${m[1]}`));
  }
  for (const k of ['## 契約', '停止条件', 'agent-conventions.md', '弁護士法72条']) if (!text.includes(k)) out.push(P('fail', `legal-checker 定義に「${k}」が無い`));
  return out;
}

const AGENT_TEXT = () => readFileSync(path.join(ROOT, '.claude', 'agents', 'legal-checker.md'), 'utf8');
EXTRA_CHECKS.push(async () => {
  const out = [];
  const files = existsSync(KNOW) ? readdirSync(KNOW).filter(n => n.endsWith('.md') && n !== 'INDEX.md') : [];
  const idx = path.join(KNOW, 'INDEX.md');
  out.push(...checkIndex({ indexText: existsSync(idx) ? readFileSync(idx, 'utf8') : null, files }));
  try {
    out.push(...checkData({ marks: loadData('third-party-marks.json').marks, hosts: loadData('external-hosts.json').hosts, oss: loadData('oss-licenses.json').packages, models: loadData('ai-model-licenses.json').models }));
  } catch (e) { out.push(P('fail', `データ台帳を読めない: ${e.message}`)); }
  out.push(...selfTestScanner());
  out.push(...await selfTestCorpusCli());
  out.push(...checkRuleCites(loadAmend()));
  const ag = path.join(ROOT, '.claude', 'agents', 'legal-checker.md');
  out.push(...checkAgent({ text: existsSync(ag) ? readFileSync(ag, 'utf8') : null }));
  return out;
});

// F/G の故障注入ケース（inject() が参照する）
export const EXTRA_INJECT = [
  ['引用の項が全角数字（検証をすり抜ける書式）', () => checkCitations('【著作権法32条第１項｜引用】', 'inj', null)],
  ['引用の項が漢数字（検証をすり抜ける書式）', () => checkCitations('【著作権法第三十二条第一項｜引用】', 'inj', null)],
  ['部分取得で全体の取得日だけ新しい（古い法令を隠さない）', () => {
    const m = JSON.parse(JSON.stringify(loadManifest()));
    m.fetched_at = new Date().toISOString();
    m.laws[0].fetched_at = '2000-01-01T00:00:00.000Z';
    return checkFreshness(m);
  }, 'warn'],
  ['INDEX が新しいノートを案内していない', () => checkIndex({ indexText: '# index', files: ['99-new.md'] })],
  ['INDEX のリンク先が実在しない', () => checkIndex({ indexText: '[x](nonexistent-file.md)', files: [] })],
  ['台帳: 不明な confidence（登録有無の断定語彙）', () => { const m = JSON.parse(JSON.stringify(loadData('third-party-marks.json').marks)); m[0].confidence = 'registered'; return checkData({ marks: m, hosts: {}, oss: {}, models: [] }); }],
  ['台帳: 確認済みモデルに証跡（日付・URL）が無い', () => checkData({ marks: [], hosts: {}, oss: {}, models: [{ id: 'x', match: 'x', commercial: true, confirmed: true }] })],
  ['台帳: 不正なホストの sends 値', () => checkData({ marks: [], hosts: { 'a.example.com': { name: 'a', kind: 'cdn', sends: 'maybe' } }, oss: {}, models: [] })],
  ['走査器が目隠しされる（標章台帳が空）', () => selfTestScanner({ marks: [], hosts: loadData('external-hosts.json').hosts, oss: loadData('oss-licenses.json').packages, models: loadData('ai-model-licenses.json').models })],
  ['走査器が外部送信の分類を失う（ホスト・OSS台帳が空）', () => selfTestScanner({ marks: loadData('third-party-marks.json').marks, hosts: {}, oss: {}, models: [] })],
  ['エージェント定義から Bash が消える', () => checkAgent({ text: AGENT_TEXT().replace(/^tools:.*$/m, 'tools: Read, Grep, Glob, Write, WebFetch, WebSearch') })],
  ['エージェント定義が Edit を持つ', () => checkAgent({ text: AGENT_TEXT().replace(/^tools:.*$/m, 'tools: Read, Grep, Glob, Write, WebFetch, WebSearch, Bash, Edit') })],
  ['エージェント定義が実在しない知識ファイルを参照', () => checkAgent({ text: AGENT_TEXT() + '\nlegal/knowledge/99-missing.md' })],
];

export async function runAll() {
  const out = [];
  const manifest = loadManifest();
  out.push(...checkCorpus({ manifest }));
  out.push(...checkFreshness(manifest));
  const amend = loadAmend();
  if (!amend) out.push(P('warn', 'AMENDMENTS.json が無い（node scripts/legal-corpus.mjs --amendments）。改正リスクの照合ができない'));
  let totalCites = 0, unverified = 0;
  for (const f of knowledgeFiles()) {
    const text = readFileSync(f, 'utf8');
    const rel = path.relative(ROOT, f);
    totalCites += extractCitations(text).length;
    unverified += countUnverifiedMentions(text);
    out.push(...checkCitations(text, rel, amend));
    out.push(...checkCoverage(f, text));
  }
  if (unverified) out.push(P('warn', `【】なしの条文言及が ${unverified} 件（検証されない書き方）。重要な主張の根拠は【法令名 条｜語】にする`));
  for (const fn of EXTRA_CHECKS) out.push(...await fn());
  return { problems: out, totalCites };
}

// ── 故障注入 ─────────────────────────────────────────────
async function inject() {
  const manifest = loadManifest();
  const amend = loadAmend();
  const cases = [];
  const sample = '【著作権法32条｜引用】と【民法548条の2｜定型約款】と【刑法168条の2｜不正指令電磁的記録】';

  cases.push(['引用の条番号を取り違える（著作権法32条→33条）', () => checkCitations(sample.replace('32条', '33条'), 'inj', amend)]);
  cases.push(['引用のキーワードを条文に無い語にする', () => checkCitations(sample.replace('定型約款', '全く関係のない語'), 'inj', amend)]);
  cases.push(['実在しない条（民法99999条）', () => checkCitations('【民法99999条｜契約】', 'inj', amend)]);
  cases.push(['存在しない項（著作権法32条第9項）', () => checkCitations('【著作権法32条第9項｜引用】', 'inj', amend)]);
  cases.push(['法令名の誤記（著作件法）', () => checkCitations('【著作件法32条｜引用】', 'inj', amend)]);
  cases.push(['コーパスの1バイト改ざん（sha256不一致）', () => checkCorpus({
    manifest,
    readFile: (p) => { const b = Buffer.from(readFileSync(p)); if (p.endsWith('kenpo.json')) b[b.length >> 1] ^= 1; return b; },
  })]);
  cases.push(['法令ファイルの欠落', () => checkCorpus({ manifest, exists: (p) => !p.endsWith('minpo.json') && existsSync(p) })]);
  cases.push(['条文の取り違え（憲法21条の本文を差し替え）', () => checkCorpus({
    manifest,
    loadLawFn: (e) => {
      const L = loadLaw(e);
      const slug = typeof e === 'string' ? e : e.slug;
      if (slug !== 'kenpo' || !L) return L;
      const copy = { ...L, byNum: new Map(L.byNum) };
      copy.byNum.set('21', { ...L.byNum.get('21'), p: ['差し替え'] });
      return copy;
    },
  })]);
  cases.push(['施行日を過ぎた改正が未取込（40日超過）', () => {
    const m = JSON.parse(JSON.stringify(manifest));
    m.laws[0].upcoming = [{ date: '2000-01-01', title: '架空の改正', revision_id: 'x' }];
    return checkFreshness(m, '2000-03-01');
  }]);
  cases.push(['中身の無い六法ノート（引用ゼロ）', () => checkCoverage(path.join(ROOT, 'obsidian-vault', '04-Knowledge', 'rokuho-minpo.md'), '引用が1件も無い本文')]);

  for (const c of EXTRA_INJECT) cases.push(c);
  let bad = 0;
  console.log('\n故障注入（すべて ✗ が出れば検査は生きている）:');
  for (const [name, fn, expect = 'fail'] of cases) {
    clearCache();
    const r = await fn();
    const hit = r.some(p => p.level === expect);
    console.log(`  ${hit ? '✓' : '✗ 素通り'} ${name}${expect === 'warn' ? '（△が出ること）' : ''}`);
    if (!hit) bad++;
  }
  // 陽性対照（これは ✗ になってはいけない）: 全ファイルが CRLF の作業コピーでも偽の赤にならない
  clearCache();
  const crlfOk = checkCorpus({ manifest, readFile: (p) => Buffer.from(readFileSync(p, 'utf8').replace(/\r?\n/g, '\r\n')) });
  const crlfFail = crlfOk.some(p => p.level === 'fail');
  console.log(`  ${crlfFail ? '✗ 偽の赤' : '✓'} 陽性対照: CRLF の作業コピー（autocrlf=true）でも sha256 検査が通る`);
  if (crlfFail) bad++;
  clearCache();
  return bad;
}

// ── main ─────────────────────────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const injectMode = process.argv.includes('--inject');
  const { problems, totalCites } = await runAll();
  const fails = problems.filter(p => p.level === 'fail');
  const warns = problems.filter(p => p.level === 'warn');
  console.log(`法令知識の検査 — 検証した引用 ${totalCites} 件／法令 ${LAWS.length} 本`);
  if (!fails.length) console.log('  ✓ コーパス完全性・引用の実在・網羅 すべて通過');
  for (const p of fails) console.log(`  ✗ ${p.msg}`);
  for (const p of warns.slice(0, 40)) console.log(`  △ ${p.msg}`);
  if (warns.length > 40) console.log(`  △ …ほか ${warns.length - 40} 件`);
  let code = fails.length ? 1 : 0;
  if (injectMode) { if (await inject() > 0) code = 1; }
  process.exit(code);
}
