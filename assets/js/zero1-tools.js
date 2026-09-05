/**
 * zero1-tools.js — ZERO-1 Mobile の「端末内ツール層」と「サイト知識の検索層」
 *
 * ★モデルに tool_calls を書かせない。
 *   スマホで動く 0.5〜3B 級は指示を守り切れない。`local-agent/README.md` に実測がある通り、
 *   tools capability を持つモデルでも `{"name":"read_file","arguments":{…}}` という
 *   **JSON文字列をそのまま本文に書いてしまう**ことがある。そうなるとツール実行は一度も
 *   発火せず、例外もエラーも出ないまま「変な文字列を喋るAI」になる。
 *   だからここは決定的（正規表現＋語の重み）に判定し、**モデルの手前で確定させる**。
 *   確実に答えられるものはGPUを回さない＝即答・電池を食わない・失敗しない。
 *
 * ★曖昧なものは必ず null を返してモデルへ流す。
 *   誤爆すると利用者からは「AIが答えてくれなくなった」に見える。拾うのは
 *   「これ以外の意味が無い」形だけにする。判断に迷ったら拾わないのが正解。
 *
 * ★作用（localStorage・setTimeout・DOM・端末時計）はここに持たない。
 *   すべて ctx 経由で外から渡す。ヘッドレスには時計もストレージもGPUも無いので、
 *   この分離が無いと一行も機械検査できない（gesture-pointer.js の
 *   推定層／判定層／作用層の分け方と同じ考え方）。
 *
 * ★eval / Function は使わない。計算は自前のトークナイザ＋操車場アルゴリズム。
 *   利用者が打った文字列をそのまま評価する道を、ページ内に1本も作らない。
 */

export const TOOL_LABELS = {
  clock:   '時計 / Clock',
  timer:   'タイマー / Timer',
  memo:    'メモ / Memo',
  convert: '単位換算 / Units',
  calc:    '計算 / Calculator',
  search:  'サイト内検索 / Site search',
};

// ---------------------------------------------------------------------------
// 共通のちいさな道具
// ---------------------------------------------------------------------------

/** 比較用に正規化する。全角英数と空白の揺れでマッチを落とさないため */
export function normalize(text) {
  return String(text ?? '')
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** 桁を落としすぎず、増やしすぎない。0.6213712 も 3.0 も同じ関数で読ませる */
export function trimNumber(value) {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const digits = abs === 0 ? 0 : abs >= 100 ? 1 : abs >= 1 ? 2 : 4;
  return Number(value.toFixed(digits)).toLocaleString('ja-JP');
}

/** 秒を「1時間5分」に。数字だけだと長さの実感が湧かない（elapsedText と同じ方針） */
export function durationText(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (h) parts.push(`${h}時間`);
  if (m) parts.push(`${m}分`);
  if (s || !parts.length) parts.push(`${s}秒`);
  return parts.join('');
}

// ---------------------------------------------------------------------------
// 時計
// ---------------------------------------------------------------------------

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export function clockAnswer(now = new Date(), want = 'all') {
  const time = `${now.getHours()}時${String(now.getMinutes()).padStart(2, '0')}分`;
  const date = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  const week = `${WEEKDAYS[now.getDay()]}曜日`;
  if (want === 'time') return `いま ${time} です。`;
  if (want === 'date') return `今日は ${date}（${week}）です。`;
  if (want === 'week') return `今日は ${week} です。`;
  return `${date}（${week}） ${time} です。`;
}

// ---------------------------------------------------------------------------
// 単位換算
//
// ★為替・天気は入れない。レートを取るには外部APIが要り、CLAUDE.md の
//   「有料・従量課金サービス禁止」と「端末内で完結」の両方に反する。
//   ここに置くのは、値が未来にも変わらない物理単位だけ。
// ---------------------------------------------------------------------------

/** 単位の綴りゆれ → 正規名。長い綴りを先に並べる（「キロ」が「キログラム」を食わないように） */
const UNIT_WORDS = [
  ['キロメートル', 'km'], ['きろめーとる', 'km'], ['km', 'km'],
  ['キログラム', 'kg'], ['きろぐらむ', 'kg'], ['kg', 'kg'],
  ['センチメートル', 'cm'], ['センチ', 'cm'], ['cm', 'cm'],
  ['ミリリットル', 'ml'], ['ml', 'ml'],
  ['メートル', 'm'], ['めーとる', 'm'],
  ['グラム', 'g'], ['ぐらむ', 'g'],
  ['リットル', 'l'], ['りっとる', 'l'],
  ['マイル', 'mile'], ['miles', 'mile'], ['mile', 'mile'],
  ['フィート', 'ft'], ['feet', 'ft'], ['ft', 'ft'],
  ['インチ', 'inch'], ['inches', 'inch'], ['inch', 'inch'],
  ['ポンド', 'lb'], ['lbs', 'lb'], ['lb', 'lb'],
  ['オンス', 'oz'], ['oz', 'oz'],
  ['ガロン', 'gal'], ['gallon', 'gal'],
  ['ヤード', 'yd'], ['yard', 'yd'],
  ['摂氏', 'c'], ['℃', 'c'], ['°c', 'c'],
  ['華氏', 'f'], ['℉', 'f'], ['°f', 'f'],
];

/** 対になる単位と換算係数。value(from) × factor = value(to) */
const UNIT_PAIRS = {
  km: { to:'mile', factor:0.621371 }, mile: { to:'km', factor:1.609344 },
  m:  { to:'ft',   factor:3.280840 }, ft:   { to:'m',  factor:0.304800 },
  cm: { to:'inch', factor:0.393701 }, inch: { to:'cm', factor:2.540000 },
  kg: { to:'lb',   factor:2.204623 }, lb:   { to:'kg', factor:0.453592 },
  g:  { to:'oz',   factor:0.035274 }, oz:   { to:'g',  factor:28.34952 },
  l:  { to:'gal',  factor:0.264172 }, gal:  { to:'l',  factor:3.785412 },
  ml: { to:'oz',   factor:0.033814 },
  yd: { to:'m',    factor:0.914400 },
};

const UNIT_NAMES = {
  km:'km', mile:'マイル', m:'m', ft:'フィート', cm:'cm', inch:'インチ',
  kg:'kg', lb:'ポンド', g:'g', oz:'オンス', l:'L', gal:'ガロン', ml:'mL', yd:'ヤード',
  c:'℃', f:'℉',
};

/** 文字列の pos 以降から最初の単位語を拾う。長い綴り優先で走査する */
function findUnit(text, from = 0) {
  let best = null;
  for (const [word, unit] of UNIT_WORDS) {
    const at = text.indexOf(word, from);
    if (at < 0) continue;
    // 同じ位置なら長い綴りを採る（「キロ」より「キログラム」）
    if (!best || at < best.at || (at === best.at && word.length > best.word.length)) {
      best = { at, word, unit, end: at + word.length };
    }
  }
  return best;
}

function convertValue(value, from, to) {
  if (from === 'c' && to === 'f') return value * 9 / 5 + 32;
  if (from === 'f' && to === 'c') return (value - 32) * 5 / 9;
  if (from === to) return value;
  const direct = UNIT_PAIRS[from];
  if (direct && direct.to === to) return value * direct.factor;
  const back = UNIT_PAIRS[to];
  if (back && back.to === from) return value / back.factor;
  return null;
}

/**
 * 「10kmは何マイル」を解く。
 *
 * ★行き先の単位が文中に無いものは拾わない。「100メートル走のコツ」を
 *   換算だと思い込むと、走り方を聞いた人に "100m = 328フィート" が返る。
 *   温度だけは例外で、対（℃⇄℉）が一意なので行き先が無くても返す。
 */
export function parseConvert(input) {
  const text = normalize(input);
  const number = /(-?\d+(?:\.\d+)?)/.exec(text);
  if (!number) return null;
  const source = findUnit(text, number.index + number[0].length);
  // 数値の直後（多少の助詞は挟んでよい）にある単位だけを起点にする
  if (!source || source.at > number.index + number[0].length + 3) return null;
  const target = findUnit(text, source.end);
  const from = source.unit;
  let to = target?.unit ?? null;
  if (!to) {
    if (from === 'c') to = 'f';
    else if (from === 'f') to = 'c';
    else return null;              // 行き先不明はモデルへ渡す
  }
  if (to === from) return null;
  const value = Number(number[1]);
  const result = convertValue(value, from, to);
  if (result === null || !Number.isFinite(result)) return null;
  return { value, from, to, result };
}

export function convertAnswer(parsed) {
  const { value, from, to, result } = parsed;
  return `${trimNumber(value)}${UNIT_NAMES[from]} = ${trimNumber(result)}${UNIT_NAMES[to]}`;
}

// ---------------------------------------------------------------------------
// 計算（eval を使わない）
//
// ★小さいモデルは算数を平気で間違える。しかも自信たっぷりに間違えるので、
//   例外もエラーも出ないまま誤った数字だけが残る。ここは必ず横取りする。
// ---------------------------------------------------------------------------

/** 式を数・演算子・括弧へ分ける。読めない文字が1つでもあれば諦める（null） */
export function tokenizeExpression(input) {
  const text = normalize(input).replace(/[×✕]/g, '*').replace(/[÷]/g, '/').replace(/[，,]/g, '');
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === ' ') { i += 1; continue; }
    if (/[0-9.]/.test(c)) {
      const start = i;
      while (i < text.length && /[0-9.]/.test(text[i])) i += 1;
      const value = Number(text.slice(start, i));
      if (!Number.isFinite(value)) return null;
      tokens.push({ kind:'number', value });
      continue;
    }
    if ('+-*/%'.includes(c)) { tokens.push({ kind:'op', op:c }); i += 1; continue; }
    if (c === '(' || c === ')') { tokens.push({ kind:c }); i += 1; continue; }
    // 末尾の「は」「=」「？」だけは読み飛ばす（「12*34は？」と打つ人がいる）
    if ('は=？?　'.includes(c) && i >= text.length - 3) { i += 1; continue; }
    return null;
  }
  return tokens;
}

const PRECEDENCE = { '+':1, '-':1, '*':2, '/':2, '%':2 };

/** 操車場アルゴリズム。壊れた式では例外を投げず null を返す */
export function evaluateExpression(input) {
  const tokens = tokenizeExpression(input);
  if (!tokens || !tokens.length) return null;
  if (!tokens.some((t) => t.kind === 'op')) return null;       // 演算子が無いなら式ではない
  const output = [];
  const ops = [];
  let expectValue = true;
  for (const token of tokens) {
    if (token.kind === 'number') {
      if (!expectValue) return null;
      output.push(token.value); expectValue = false; continue;
    }
    if (token.kind === 'op') {
      // 単項マイナス（-5+3）は 0-5+3 として扱う
      if (expectValue) {
        if (token.op !== '-') return null;
        output.push(0);
      }
      while (ops.length && ops[ops.length - 1] !== '(' && PRECEDENCE[ops[ops.length - 1]] >= PRECEDENCE[token.op]) {
        output.push({ op: ops.pop() });
      }
      ops.push(token.op); expectValue = true; continue;
    }
    if (token.kind === '(') {
      if (!expectValue) return null;
      ops.push('('); continue;
    }
    if (token.kind === ')') {
      if (expectValue) return null;
      while (ops.length && ops[ops.length - 1] !== '(') output.push({ op: ops.pop() });
      if (ops.pop() !== '(') return null;
      expectValue = false;
    }
  }
  if (expectValue) return null;
  while (ops.length) { const op = ops.pop(); if (op === '(') return null; output.push({ op }); }

  const stack = [];
  for (const item of output) {
    if (typeof item === 'number') { stack.push(item); continue; }
    const b = stack.pop(); const a = stack.pop();
    if (a === undefined || b === undefined) return null;
    if ((item.op === '/' || item.op === '%') && b === 0) return null;  // 0除算は答えない
    stack.push(item.op === '+' ? a + b : item.op === '-' ? a - b
      : item.op === '*' ? a * b : item.op === '/' ? a / b : a % b);
  }
  if (stack.length !== 1 || !Number.isFinite(stack[0])) return null;
  return stack[0];
}

// ---------------------------------------------------------------------------
// タイマーの読み取り
// ---------------------------------------------------------------------------

const DURATION_RE = /(\d+(?:\.\d+)?)\s*(時間|分間|分|秒間|秒)/;

export function parseDuration(input) {
  const found = DURATION_RE.exec(normalize(input));
  if (!found) return null;
  const value = Number(found[1]);
  const unit = found[2];
  const seconds = unit === '時間' ? value * 3600 : unit.startsWith('分') ? value * 60 : value;
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 12 * 3600) return null;
  return Math.round(seconds);
}

// ---------------------------------------------------------------------------
// サイト内検索とサイト知識の取り出し（ローカルRAG）
// ---------------------------------------------------------------------------

/** 語が長いほど、偶然の一致ではない。2文字の「将棋」と6文字の「ベルトスクロール」を同じ重みにしない */
function aliasWeight(word) { return Math.min(3, 1 + word.length / 4); }

/**
 * 質問に関係のあるゲームを、点数の高い順に返す。
 *
 * 照合は「質問文が別名を含むか」の向き。逆向き（別名が質問を含む）にすると
 * 1文字の質問が全ゲームに当たる。
 */
export function searchGames(query, games = [], { limit = 4, lang = 'ja' } = {}) {
  const text = normalize(query);
  if (!text) return [];
  const scored = [];
  for (const game of games) {
    const words = [
      game.title?.[lang], game.title?.en, game.slug,
      ...(game.aliases?.[lang] ?? []), ...(game.aliases?.en ?? []),
    ].filter(Boolean).map(normalize);
    let score = 0;
    const hits = new Set();
    for (const word of words) {
      if (word.length < 2 || hits.has(word)) continue;
      if (text.includes(word)) { score += aliasWeight(word); hits.add(word); }
    }
    if (score > 0) scored.push({ game, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.game);
}

/** ジャンルの言い方 → GAMES の cat。ゲーム名を1つも知らなくても「アクションある？」に答えるため */
const CATEGORY_WORDS = [
  [/(アクション|action|格闘|シューティング)/, 'action', 'アクション'],
  [/(ボード|board|盤面|盤上)/, 'board', 'ボード'],
  [/(カード|card|トランプ)/, 'card', 'カード'],
  [/(パズル|puzzle|頭の体操)/, 'puzzle', 'パズル'],
  [/(rpg|ロールプレイング|冒険)/, 'rpg', 'RPG'],
  [/(シミュレーション|シミュ|戦略|ストラテジー|sim)/, 'sim', 'シミュレーション'],
];

/**
 * サイト内検索の本体。「名前で当てる → ジャンル → おすすめ → 一覧」の順に降りる。
 *
 * ★名前一致だけにすると「アクションある？」「おすすめは？」が丸ごと空振りする。
 *   空振りをモデルへ流すと、モデルはゲーム名を知らないので**平気で存在しない
 *   タイトルを作る**（例外もエラーも出ない）。降り口を用意して必ず実物で答える。
 */
export function pickGames(query, data, { limit = 4, lang = 'ja' } = {}) {
  const games = data?.GAMES ?? [];
  if (!games.length) return null;
  const text = normalize(query);

  const byName = searchGames(query, games, { limit, lang });
  if (byName.length) return { games: byName, how: 'name' };

  for (const [pattern, cat, name] of CATEGORY_WORDS) {
    if (!pattern.test(text)) continue;
    const hits = games.filter((g) => g.cat === cat);
    if (hits.length) return { games: hits.slice(0, limit), how: 'category', name, total: hits.length };
  }

  if (/(おすすめ|お勧め|人気|面白い|何から|なにから|一番|初めて|はじめて)/.test(text)) {
    const slugs = data?.RECOMMENDS ?? [];
    const hits = slugs.map((slug) => games.find((g) => g.slug === slug)).filter(Boolean);
    if (hits.length) return { games: hits.slice(0, limit), how: 'recommend' };
  }

  if (/(一覧|全部|ぜんぶ|すべて|何本|なんぼん|どんな|何が|なにが|list)/.test(text)) {
    return { games: (data?.RECOMMENDS ?? []).map((s) => games.find((g) => g.slug === s)).filter(Boolean).slice(0, limit),
      how: 'all', total: games.length };
  }
  return null;
}

/** intent辞書の重み付きキーワードで、FAQ知識（KB）のどれが効くかを採点する */
export function scoreIntents(query, dict = {}, { lang = 'ja' } = {}) {
  const text = normalize(query);
  const table = dict[lang] ?? {};
  const scored = [];
  for (const [intent, pairs] of Object.entries(table)) {
    let score = 0;
    for (const [word, weight] of pairs) if (text.includes(normalize(word))) score += weight;
    if (score > 0) scored.push({ intent, score });
  }
  return scored.sort((a, b) => b.score - a.score);
}

/** 事実ではなく決まり文句のintent。RAGには入れない */
const CHITCHAT_INTENTS = new Set(['greet', 'thanks']);

/** 弱い1語だけの一致（重み1.0以下）は偶然のことが多いので採らない */
const MIN_INTENT_SCORE = 1.5;

/** agent.js と同じ差し込み。KBの本文は {GAME_COUNT} を含む（agent.js:1318 と対） */
function fillPlaceholders(text, data) {
  return String(text ?? '').replace(/\{GAME_COUNT\}/g, String((data?.GAMES ?? []).length));
}

/** 改行と装飾を落として1行にする（プロンプトの窓は狭い。絵文字1つもトークンを食う） */
function flatten(text, max = 160) {
  const line = String(text ?? '').replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

/**
 * サイトの知識から、この質問に効く分だけを取り出してモデルへ渡す文脈を作る。
 *
 * ★関係が無ければ**1文字も返さない**（''）。
 *   agent-data.js は29KB＝1.5万トークン級で、丸ごと入れると窓が埋まり、
 *   buildMessages のコメントにある事故——**いま聞かれた質問が押し出されて
 *   見当違いの答えが返る**——がそのまま起きる。入れるのは当たった数件だけ。
 * ★budget で必ず頭打ちにする。当たりが増えたぶんだけ膨らむと、
 *   「たくさん知っているときほど質問を忘れる」という一番たちの悪い壊れ方をする。
 */
export function buildSiteContext(query, data, { budget = 700, lang = 'ja', limit = 3 } = {}) {
  if (!data || !normalize(query)) return '';
  const lines = [];
  for (const game of searchGames(query, data.GAMES ?? [], { limit, lang })) {
    lines.push(`・${game.title?.[lang] ?? game.slug}（${game.href}）: ${flatten(game.desc?.[lang], 90)}`);
  }
  for (const { intent, score } of scoreIntents(query, data.INTENT_DICT ?? {}, { lang })) {
    if (lines.length >= limit * 2) break;
    // 「こんにちは」「ありがとう」は案内ウィジェットの決まり文句であって、事実ではない。
    // 足すと挨拶のたびに窓を食い、モデルにはその文をなぞる圧が掛かる
    if (CHITCHAT_INTENTS.has(intent)) continue;
    if (score < MIN_INTENT_SCORE) continue;      // 弱い1語だけの一致は偶然のことが多い
    const entry = data.KB?.[intent]?.[lang];
    // ★{GAME_COUNT} のような差し込み記号を、そのままモデルへ渡さない。
    //   渡すとモデルはその文字列を答えにも書き写す（例外もエラーも出ない）
    if (entry) lines.push(`・${flatten(fillPlaceholders(entry, data), 140)}`);
  }
  if (!lines.length) return '';

  let context = '';
  for (const line of lines) {
    if (context.length + line.length + 1 > budget) break;
    context += (context ? '\n' : '') + line;
  }
  if (!context) return '';
  return `【このサイト（hideのポートフォリオ）について、端末内に持っている事実】\n${context}\n`
    + 'この事実に反することを書いてはいけません。ここに無いことを聞かれたら「分かりません」と答えてください。';
}

// ---------------------------------------------------------------------------
// 意図ルーティング（ここが唯一の入口）
// ---------------------------------------------------------------------------

const SEARCH_CUE = /(ゲーム|げーむ|game|遊べ|あそべ|プレイ)/;
const SEARCH_ASK = /(ある|ありま|探|さが|おすすめ|お勧め|人気|一覧|何が|なにが|どんな|やりたい|遊びたい|教えて|ない\?|ない？)/;

/**
 * 端末内ツールで答えられる質問かを決める。答えられないなら null（＝モデルへ）。
 *
 * 判定の順番には意味がある。「タイマーを止めて」は止める指示であって
 * 新しいタイマーではない——取り消し・一覧を、必ず作成より先に見る。
 */
export function matchTool(input, { hasData = false } = {}) {
  const text = normalize(input);
  if (!text) return null;

  // --- メモ（取り消し・一覧 → 作成の順）---
  if (/メモ/.test(text)) {
    if (/(全部|すべて|ぜんぶ)?(消して|削除|クリア|けして)/.test(text)) return { kind:'memo', action:'clear' };
    if (/(見せて|見たい|一覧|確認|教えて|読んで|なんだっけ|何だっけ)/.test(text)) return { kind:'memo', action:'list' };
    const body = /^メモ[:：]\s*(.+)$/.exec(input.trim())?.[1]
      ?? /^(.+?)\s*(?:を|って)?\s*メモ(?:して|しといて|しておいて)$/.exec(input.trim())?.[1];
    if (body?.trim()) return { kind:'memo', action:'add', text: body.trim() };
  }

  // --- タイマー（取り消し・残り → 作成の順）---
  const timerWord = /(タイマー|たいまー|アラーム|alarm|timer)/.test(text);
  if (timerWord && /(止め|停止|キャンセル|やめ|消して|解除)/.test(text)) return { kind:'timer', action:'cancel' };
  if (timerWord && /(残り|あと何|確認|見せて|どれくらい|どれぐらい)/.test(text)) return { kind:'timer', action:'list' };
  const seconds = parseDuration(text);
  if (seconds && (timerWord || /(後に|たったら|経ったら|たっ たら)?\s*(教えて|知らせて|呼んで|鳴らして)/.test(text))) {
    if (timerWord || /(教えて|知らせて|呼んで|鳴らして)/.test(text)) return { kind:'timer', action:'start', seconds };
  }

  // --- 時計 ---
  if (/(何時|なんじ|いま何時)/.test(text) && !/何時間/.test(text)) return { kind:'clock', want:'time' };
  if (/(今日|きょう|本日).*(何日|なんにち|日付)/.test(text) || /(何日|日付).*(今日|きょう)/.test(text)) return { kind:'clock', want:'date' };
  if (/(何曜日|なんようび)/.test(text)) return { kind:'clock', want:'week' };
  if (/^(今日|きょう|本日)は[?？]?$/.test(text)) return { kind:'clock', want:'all' };

  // --- 単位換算（計算より先。「10kmは何マイル」に数字と単位が両方ある）---
  const convert = parseConvert(input);
  if (convert) return { kind:'convert', convert };

  // --- 計算 ---
  const calc = evaluateExpression(input);
  if (calc !== null) return { kind:'calc', value: calc, expression: normalize(input).replace(/[はは=？?]+$/, '') };

  // --- サイト内検索（データが読めているときだけ）---
  if (hasData && SEARCH_CUE.test(text) && SEARCH_ASK.test(text)) return { kind:'search' };

  return null;
}

/**
 * ツールを実行して、画面へ出すものを返す。
 *
 * ctx = { now, memo:{list,add,clear}, timer:{start,cancel,list}, data }
 * すべて外から渡す（この関数自身は端末に触らない）。
 * 返り値の links は「押せる一手」用。文字でURLを見せて打たせない。
 */
export function runTool(input, ctx = {}) {
  const matched = matchTool(input, { hasData: Boolean(ctx.data) });
  if (!matched) return null;
  const label = TOOL_LABELS[matched.kind];

  if (matched.kind === 'clock') {
    return { kind:matched.kind, label, answer: clockAnswer(ctx.now ?? new Date(), matched.want) };
  }

  if (matched.kind === 'convert') return { kind:matched.kind, label, answer: convertAnswer(matched.convert) };

  if (matched.kind === 'calc') {
    return { kind:matched.kind, label, answer: `${matched.expression} = ${trimNumber(matched.value)}` };
  }

  if (matched.kind === 'memo') {
    if (matched.action === 'add') {
      const count = ctx.memo?.add?.(matched.text) ?? 0;
      return { kind:matched.kind, label, answer: `メモしました（${count}件目）。\n・${matched.text}` };
    }
    if (matched.action === 'clear') {
      const removed = ctx.memo?.clear?.() ?? 0;
      return { kind:matched.kind, label, answer: removed ? `メモを${removed}件消しました。` : 'メモはありません。' };
    }
    const items = ctx.memo?.list?.() ?? [];
    return {
      kind: matched.kind, label,
      answer: items.length ? `メモは${items.length}件です。\n${items.map((m) => `・${m}`).join('\n')}` : 'メモはまだありません。',
    };
  }

  if (matched.kind === 'timer') {
    if (matched.action === 'cancel') {
      const stopped = ctx.timer?.cancel?.() ?? 0;
      return { kind:matched.kind, label, answer: stopped ? `タイマーを${stopped}件止めました。` : '動いているタイマーはありません。' };
    }
    if (matched.action === 'list') {
      const running = ctx.timer?.list?.() ?? [];
      return {
        kind: matched.kind, label,
        answer: running.length
          ? running.map((t) => `残り ${durationText(t.remainSec)}（${durationText(t.totalSec)}のタイマー）`).join('\n')
          : '動いているタイマーはありません。',
      };
    }
    ctx.timer?.start?.(matched.seconds);
    // ★スマホでは画面を消すとタイマーが遅れる。黙って遅れるより先に言う
    return {
      kind: matched.kind, label,
      answer: `${durationText(matched.seconds)}のタイマーを始めました。\nこの画面を開いたままにしてください（閉じると鳴りません）。`,
    };
  }

  if (matched.kind === 'search') {
    const found = pickGames(input, ctx.data, { limit: 4 });
    if (!found) return null;             // 心当たりが無いなら黙ってモデルへ渡す
    const { games, how, name, total } = found;
    const lead = how === 'category' ? `${name}系は${total}本あります。`
      : how === 'recommend' ? 'まずはこの3本がおすすめです。'
      : how === 'all' ? `このサイトには全部で${total}本あります。代表はこの3本です。`
      : `${games.length}本見つかりました。`;
    return {
      kind: matched.kind, label,
      answer: `${lead}\n` + games.map((g) => `・${g.title?.ja ?? g.slug} — ${flatten(g.desc?.ja, 70)}`).join('\n'),
      links: games.map((g) => ({ label: `${g.title?.ja ?? g.slug} を開く`, href: g.href })),
    };
  }

  return null;
}
