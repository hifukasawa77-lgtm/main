/*
 * legal-lib.mjs — 法令コーパス（legal/corpus/）を引くための共通部品。
 *
 * 使うのは次の4本。どれも「条文の実物に当たる」ために共有する。
 *   scripts/legal-corpus.mjs         e-Gov 法令API v2 から取得・状態確認
 *   scripts/legal-lookup.mjs         条文を引く・語で探す（エージェントが手で使う）
 *   scripts/legal-scan.mjs           リポジトリを法務リスクの目で走査
 *   scripts/verify-legal-knowledge.mjs  知識ベースの引用が実在の条文に当たるかの機械検査
 *
 * なぜ登録簿（LAWS）をここに置くか:
 *   取得側・検索側・検査側が別々に法令名を持つと、1つだけ古くなる。ここが唯一の正。
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CORPUS_DIR = path.join(ROOT, 'legal', 'corpus');
export const MANIFEST_PATH = path.join(CORPUS_DIR, 'MANIFEST.json');

/**
 * 取り込む法令の登録簿。group:
 *   six   六法（憲法・民法・刑法・商法・民事訴訟法・刑事訴訟法）
 *   ip    知的財産
 *   data  情報・通信・個人情報
 *   trade 取引・表示・決済
 *   crime 刑事・サイバー・有害コンテンツ
 *   proc  手続・資格
 * aliases は知識ベースの引用（【著作権法32条】）や検索で通称を許すためのもの。
 */
export const LAWS = [
  { slug: 'kenpo',    title: '日本国憲法', id: '321CONSTITUTION',  group: 'six',
    aliases: ['憲法'], why: '表現の自由・通信の秘密・プライバシー・財産権。私人間は間接適用' },
  { slug: 'minpo',    title: '民法', id: '129AC0000000089', group: 'six',
    aliases: [], why: '不法行為・契約・定型約款（利用規約）・時効・未成年者の取消' },
  { slug: 'keiho',    title: '刑法', id: '140AC0000000045', group: 'six',
    aliases: [], why: '不正指令電磁的記録・名誉毀損・業務妨害・わいせつ・賭博' },
  { slug: 'shoho',    title: '商法', id: '132AC0000000048', group: 'six',
    aliases: [], why: '商行為・商号・運送・仲立。事業化したときの前提' },
  { slug: 'minso',    title: '民事訴訟法', id: '408AC0000000109', group: 'six',
    aliases: ['民訴法'], why: '管轄・国際裁判管轄・証拠・訴訟になったときの見通し' },
  { slug: 'keiso',    title: '刑事訴訟法', id: '323AC0000000131', group: 'six',
    aliases: ['刑訴法'], why: '告訴・告訴期間・公訴時効・捜査（親告罪かどうかの判断）' },

  { slug: 'chosakuken', title: '著作権法', id: '345AC0000000048', group: 'ip',
    aliases: [], why: '素材・生成AI・フォント・引用・ゲーム・OSS の中心' },
  { slug: 'shohyo',   title: '商標法', id: '334AC0000000127', group: 'ip',
    aliases: [], why: 'ゲーム名・キャラ名・ドメイン/ファイル名の他社商標' },
  { slug: 'tokkyo',   title: '特許法', id: '334AC0000000121', group: 'ip',
    aliases: [], why: 'アルゴリズム・UI・ゲームシステムの特許リスク' },
  { slug: 'ishou',    title: '意匠法', id: '334AC0000000125', group: 'ip',
    aliases: [], why: '画面デザイン・UI意匠' },
  { slug: 'fukyo',    title: '不正競争防止法', id: '405AC0000000047', group: 'ip',
    aliases: ['不競法'], why: '周知・著名表示の混同／冒用・形態模倣・技術的制限手段' },

  { slug: 'kojinjoho', title: '個人情報の保護に関する法律', id: '415AC0000000057', group: 'data',
    aliases: ['個人情報保護法', '個情法'], why: 'フォーム・アクセス解析・カメラ/位置情報・外部送信' },
  { slug: 'denki',    title: '電気通信事業法', id: '359AC0000000086', group: 'data',
    aliases: ['電通事業法'], why: '通信の秘密・外部送信規律（27条の12）' },
  { slug: 'tokutei-mail', title: '特定電子メールの送信の適正化等に関する法律', id: '414AC0100000026', group: 'data',
    aliases: ['特定電子メール法', '迷惑メール防止法'], why: 'メール配信・SNS DM での広告' },
  { slug: 'johoryutsu', title: '特定電気通信による情報の流通によって発生する権利侵害等への対処に関する法律', id: '413AC0000000137', group: 'data',
    aliases: ['情報流通プラットフォーム対処法', '情プラ法', 'プロバイダ責任制限法'], why: '削除請求・発信者情報開示・サイト運営者の責任' },
  { slug: 'ai-suishin', title: '人工知能関連技術の研究開発及び活用の推進に関する法律', id: '507AC0000000053', group: 'data',
    aliases: ['AI推進法'], why: 'AI利用の基本理念・事業者の責務（努力義務）' },

  { slug: 'keihyo',   title: '不当景品類及び不当表示防止法', id: '337AC0000000134', group: 'trade',
    aliases: ['景表法', '景品表示法'], why: '優良誤認・有利誤認・ステマ・景品（ガチャ・懸賞）' },
  { slug: 'tokushoho', title: '特定商取引に関する法律', id: '351AC0000000057', group: 'trade',
    aliases: ['特商法'], why: '通信販売の表示（有料記事・課金）・誇大広告' },
  { slug: 'shohisha', title: '消費者契約法', id: '412AC0000000061', group: 'trade',
    aliases: ['消契法'], why: '免責条項・解除/損害賠償の制限が無効になる範囲' },
  { slug: 'denshi-shohisha', title: '電子消費者契約に関する民法の特例に関する法律', id: '413AC0000000095', group: 'trade',
    aliases: ['電子消費者契約法'], why: 'ボタン誤操作・確認画面（課金UI）' },
  { slug: 'shikin',   title: '資金決済に関する法律', id: '421AC0000000059', group: 'trade',
    aliases: ['資金決済法'], why: '前払式支払手段（ゲーム内通貨）・暗号資産' },
  { slug: 'torihiki-dpf', title: '取引デジタルプラットフォームを利用する消費者の利益の保護に関する法律', id: '503AC0000000032', group: 'trade',
    aliases: ['取引DPF法', '取引DPF消費者保護法'], why: '場を提供する側になる場合の義務' },

  { slug: 'fusei-access', title: '不正アクセス行為の禁止等に関する法律', id: '411AC0000000128', group: 'crime',
    aliases: ['不正アクセス禁止法'], why: 'ID・パスワード・認証回避。ツール公開の線引き' },
  { slug: 'jido-porno', title: '児童買春、児童ポルノに係る行為等の規制及び処罰並びに児童の保護等に関する法律', id: '411AC0100000052', group: 'crime',
    aliases: ['児童ポルノ禁止法'], why: '画像生成・イラストの性的表現（実在児童／描写）' },

  { slug: 'tsusoku',  title: '法の適用に関する通則法', id: '418AC0000000078', group: 'trade',
    aliases: ['通則法'], why: '準拠法（海外の相手・利用者との契約・不法行為にどの国の法が適用されるか）' },
  { slug: 'freelance', title: '特定受託事業者に係る取引の適正化等に関する法律', id: '505AC0000000025', group: 'trade',
    aliases: ['フリーランス法', 'フリーランス・事業者間取引適正化等法'], why: '外注（個人への業務委託）の取引条件の明示・報酬支払・ハラスメント対策' },
  { slug: 'torisoku', title: '製造委託等に係る中小受託事業者に対する代金の支払の遅延等の防止に関する法律', id: '331AC0000000120', group: 'trade',
    aliases: ['取適法', '中小受託取引適正化法', '下請法'], why: '資本金区分のある発注（旧下請法）。法人化・外注が増えたとき' },

  { slug: 'minpo-hozen', title: '民事保全法', id: '401AC0000000091', group: 'proc',
    aliases: ['民保法'], why: '差止の仮処分。警告書を受けたあとの現実的な展開' },
  { slug: 'kensatsu-shinsakai', title: '検察審査会法', id: '323AC0000000147', group: 'proc',
    aliases: [], why: '不起訴処分への不服（告訴人・被害者の救済ルート）' },
  { slug: 'bengoshi', title: '弁護士法', id: '324AC1000000205', group: 'proc',
    aliases: [], why: '72条（非弁行為）。AIが何をしてよく、何を弁護士へ回すかの線引き' },
];

/** 全角→半角・空白除去。キーワード照合はこの形に揃えてから行う。 */
export function norm(s) {
  return String(s ?? '').normalize('NFKC').replace(/[\s　]+/g, '');
}

export function lawByName(name) {
  const n = norm(name);
  return LAWS.find(l => norm(l.title) === n || l.slug === name || l.aliases.some(a => norm(a) === n)) || null;
}

/** 長い名前から先に当てるための法令名の一覧（引用の正規表現に使う）。 */
export function allLawNames() {
  const names = [];
  for (const l of LAWS) { names.push(l.title, ...l.aliases); }
  return names.sort((a, b) => b.length - a.length);
}

// ── 漢数字 ─────────────────────────────────────────────
const KD = { 〇: 0, 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
export function kanjiToInt(s) {
  if (/^[0-9]+$/.test(s)) return Number(s);
  let total = 0, cur = 0, seen = false;
  for (const ch of s) {
    if (ch in KD) { cur = cur * 10 + KD[ch]; seen = true; }
    else if (ch === '十') { total += (cur || 1) * 10; cur = 0; seen = true; }
    else if (ch === '百') { total += (cur || 1) * 100; cur = 0; seen = true; }
    else if (ch === '千') { total += (cur || 1) * 1000; cur = 0; seen = true; }
    else return NaN;
  }
  return seen ? total + cur : NaN;
}

/**
 * 条番号の表記ゆれ → e-Gov の内部表記（"30_4" 形式）。
 *   "32" "32条" "第32条" "30条の4" "30の4" "30_4" "第三十条の四" をすべて受ける。
 * 解釈できなければ null。
 */
export function parseArticleNum(input) {
  let s = norm(input).replace(/^第/, '').replace(/条$/, '');
  if (!s) return null;
  const parts = s.split(/条の|の|_/).map(p => p.replace(/^第/, '').replace(/条$/, ''));
  const nums = parts.map(kanjiToInt);
  if (nums.some(n => !Number.isFinite(n))) return null;
  return nums.join('_');
}

/** "30_4" → "30条の4" */
export function displayArticleNum(n) {
  const [head, ...rest] = String(n).split('_');
  return `${head}条` + rest.map(r => `の${r}`).join('');
}

// ── コーパスの読み込み ──────────────────────────────────
const cache = new Map();
export function loadLaw(entryOrName) {
  const e = typeof entryOrName === 'string' ? lawByName(entryOrName) : entryOrName;
  if (!e) return null;
  if (cache.has(e.slug)) return cache.get(e.slug);
  const file = path.join(CORPUS_DIR, `${e.slug}.json`);
  if (!existsSync(file)) { cache.set(e.slug, null); return null; }
  const j = JSON.parse(readFileSync(file, 'utf8'));
  j.entry = e;
  j.byNum = new Map(j.articles.map(a => [a.n, a]));
  // 削除された連番は e-Gov では1つの条（Num="517:520"）で表される。範囲内のどの番号でも引けるようにする
  // （引けないと「その条は実在しない」と誤報告され、削除済みの条を“無い”と“消えた”が区別できない）
  for (const a of j.articles) {
    const m = /^(\d+):(\d+)$/.exec(a.n);
    if (m) for (let i = Number(m[1]); i <= Number(m[2]); i++) if (!j.byNum.has(String(i))) j.byNum.set(String(i), a);
  }
  cache.set(e.slug, j);
  return j;
}
export function clearCache() { cache.clear(); }

export function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) return null;
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
}

export function articleText(art) { return (art.p || []).join('\n'); }

export function formatArticle(law, art, { para } = {}) {
  const head = `${law.title} ${displayArticleNum(art.n)}${art.t ? `（${art.t}）` : ''}`;
  const sec = law.sections?.[art.s] ? `〔${law.sections[art.s]}〕\n` : '';
  const body = para ? (art.p[para - 1] ?? `（第${para}項は存在しません。項数: ${art.p.length}）`) : articleText(art);
  return `■ ${head}\n${sec}${body}`;
}

/**
 * 引用の照合。条文が実在し、指定語が条文（見出しを含む）に全て含まれるかを返す。
 * { ok, reason, article } — 失敗理由は人間が直せる文面にする。
 */
export function checkCitation({ law, article, para, keywords }) {
  const L = loadLaw(law);
  if (!L) return { ok: false, reason: `法令コーパスに ${law} が無い（node scripts/legal-corpus.mjs --fetch）` };
  const art = L.byNum.get(article);
  if (!art) return { ok: false, reason: `${L.title} に ${displayArticleNum(article)} が実在しない` };
  if (para && !art.p[para - 1]) return { ok: false, reason: `${L.title} ${displayArticleNum(article)} に第${para}項が無い（項数 ${art.p.length}）` };
  const hay = norm((art.t || '') + (para ? art.p[para - 1] : articleText(art)));
  const miss = (keywords || []).filter(k => !hay.includes(norm(k)));
  if (miss.length) return { ok: false, reason: `${L.title} ${displayArticleNum(article)}${para ? `第${para}項` : ''} に語が無い: ${miss.join('・')}（番号の取り違えか、条文の改正の可能性）`, article: art };
  return { ok: true, article: art };
}

/**
 * 文章中の引用記法を取り出す。記法: 【法令名 条番号(項)｜キーワード・キーワード】
 *   【著作権法32条｜引用】 【著作権法30条の4｜享受】 【民法548条の2第1項｜定型約款】
 * キーワードは省略できるが、**付けるほど「言っていること」が条文に結び付く**。
 */
export function extractCitations(text) {
  const names = allLawNames().map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(`【\\s*(${names})\\s*(第?[0-9〇一二三四五六七八九十百千]+条(?:の[0-9〇一二三四五六七八九十百千]+)*)(?:第?([0-9]+)項)?(?:\\s*｜\\s*([^】]+))?】`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    const entry = lawByName(m[1]);
    out.push({
      raw: m[0], index: m.index,
      law: entry.slug, lawTitle: entry.title,
      article: parseArticleNum(m[2]),
      para: m[3] ? Number(m[3]) : null,
      keywords: m[4] ? m[4].split('・').map(s => s.trim()).filter(Boolean) : [],
    });
  }
  return out;
}

/** 語で全法令（または1法令）を探す。見出し一致を先に出す。 */
export function searchCorpus(query, { law, captionsOnly = false, limit = 40 } = {}) {
  const q = norm(query);
  const hits = [];
  const targets = law ? [lawByName(law)].filter(Boolean) : LAWS;
  for (const e of targets) {
    const L = loadLaw(e);
    if (!L) continue;
    for (const a of L.articles) {
      const inCap = norm(a.t || '').includes(q);
      const body = articleText(a);
      const inBody = !captionsOnly && norm(body).includes(q);
      if (!inCap && !inBody) continue;
      let snippet = '';
      if (inBody) {
        const flat = body.replace(/\s+/g, ' ');
        const i = flat.indexOf(query.normalize('NFKC')) >= 0 ? flat.indexOf(query.normalize('NFKC')) : 0;
        snippet = flat.slice(Math.max(0, i - 24), i + 60);
      }
      hits.push({ law: L.title, n: a.n, t: a.t, inCap, snippet });
    }
  }
  hits.sort((x, y) => Number(y.inCap) - Number(x.inCap));
  return { total: hits.length, hits: hits.slice(0, limit) };
}
