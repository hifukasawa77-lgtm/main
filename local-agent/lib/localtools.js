// 端末内ツール層：モデルの手前で決定的に答える（時計・計算・単位換算）。
//
// 方針（zero-1-mobile の zero1-tools.js と同じ）:
// - モデルに tool_calls を書かせない。小型モデルは指示を守り切れず JSON を本文に書くので、
//   ツールが一度も発火せず「変な文字列を喋るAI」になる。判定は正規表現で先に確定させる。
// - 曖昧なら null を返してモデルへ流す。誤爆は利用者から「AIが答えてくれない」に見える。
//   拾うのは「これ以外の意味が無い」形だけ。
// - 式の評価に eval / new Function は使わない。自前のトークナイザ＋操車場アルゴリズム。
// - 作用を持たない純粋ロジック（時刻は引数 now で受ける）。

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

// ---------- 時計 ----------

function tryClock(text, now) {
  const t = text.replace(/[\s　？?！!。]/g, "");
  if (t.length > 16) return null;
  const date = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  const week = `${WEEKDAYS[now.getDay()]}曜日`;
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");

  if (/^(今|いま|現在)(の)?(何時|時間|時刻)(です)?(か)?$/.test(t) || /^whattimeisit$/i.test(t))
    return `いまは ${hh}:${mm} です。`;
  if (/^(今日|きょう|本日)(の)?(日付|何日|は何日)(です)?(か)?$/.test(t) || /^(今日は)?何日(です)?(か)?$/.test(t))
    return `今日は ${date}（${week}）です。`;
  if (/^(今日|きょう|本日)(は)?(何曜日|なんようび)(です)?(か)?$/.test(t) || /^何曜日(です)?(か)?$/.test(t))
    return `今日は${week}です（${date}）。`;
  return null;
}

// ---------- 計算 ----------

const OP = {
  "+": { prec: 1, right: false, fn: (a, b) => a + b },
  "-": { prec: 1, right: false, fn: (a, b) => a - b },
  "*": { prec: 2, right: false, fn: (a, b) => a * b },
  "/": { prec: 2, right: false, fn: (a, b) => a / b },
  "%": { prec: 2, right: false, fn: (a, b) => a % b },
  "^": { prec: 4, right: true, fn: (a, b) => a ** b },
};
const UNARY_MINUS_PREC = 3; // ^ より低く、* より高い（-2^2 = -4）

function tokenize(expr) {
  const tokens = [];
  const re = /\s*(\d+(?:\.\d+)?|\.\d+|[-+*/%^()])/y;
  let pos = 0;
  while (pos < expr.length) {
    re.lastIndex = pos;
    const m = re.exec(expr);
    if (!m) {
      if (/^\s*$/.test(expr.slice(pos))) break;
      throw new Error("式を読み取れません");
    }
    pos = re.lastIndex;
    tokens.push(m[1]);
  }
  return tokens;
}

export function evaluateExpression(expr) {
  const tokens = tokenize(expr);
  if (!tokens.length) throw new Error("式が空です");
  const out = [];
  const ops = [];
  let prevIsValue = false;

  const applyTop = () => {
    const op = ops.pop();
    if (op === "neg") {
      if (out.length < 1) throw new Error("式が不正です");
      out.push(-out.pop());
      return;
    }
    if (out.length < 2) throw new Error("式が不正です");
    const b = out.pop();
    const a = out.pop();
    out.push(OP[op].fn(a, b));
  };
  const precOf = (op) => (op === "neg" ? UNARY_MINUS_PREC : OP[op].prec);

  for (const tok of tokens) {
    if (/^[\d.]/.test(tok)) {
      out.push(Number(tok));
      prevIsValue = true;
    } else if (tok === "(") {
      ops.push("(");
      prevIsValue = false;
    } else if (tok === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") applyTop();
      if (!ops.length) throw new Error("括弧が対応していません");
      ops.pop();
      prevIsValue = true;
    } else if (tok === "-" && !prevIsValue) {
      ops.push("neg");
    } else if (tok === "+" && !prevIsValue) {
      // 単項プラスは無視
    } else {
      if (!prevIsValue) throw new Error("式が不正です");
      while (ops.length) {
        const top = ops[ops.length - 1];
        if (top === "(") break;
        const higher = precOf(top) > OP[tok].prec || (precOf(top) === OP[tok].prec && !OP[tok].right);
        if (!higher) break;
        applyTop();
      }
      ops.push(tok);
      prevIsValue = false;
    }
  }
  if (!prevIsValue) throw new Error("式が途中で終わっています");
  while (ops.length) {
    if (ops[ops.length - 1] === "(") throw new Error("括弧が対応していません");
    applyTop();
  }
  if (out.length !== 1) throw new Error("式が不正です");
  return out[0];
}

function formatNumber(n) {
  if (!Number.isFinite(n)) return null;
  if (Number.isInteger(n) && Math.abs(n) < 1e21) return n.toLocaleString("en-US");
  // 0.1+0.2 のような浮動小数の端数を丸める
  return String(Number(n.toPrecision(12)));
}

function tryCalc(text) {
  let t = text.normalize("NFKC").replace(/×/g, "*").replace(/÷/g, "/").replace(/[xX＊]/g, "*");
  t = t.replace(/^\s*計算(して|してください)?\s*[:：]?/, "").trim();
  t = t.replace(/\s*(は|って|を計算して|を計算|＝|=)?\s*[?？]?\s*$/u, "").trim();
  t = t.replace(/(\d),(\d{3})/g, "$1$2");
  // 数字・演算子・括弧だけで、かつ演算子を1つ以上含むときだけ拾う（電話番号や年号の誤爆を防ぐ）
  if (!/^[\d\s+\-*/().^%]+$/.test(t)) return null;
  if (!/[+\-*/^%]/.test(t.replace(/^\s*-/, ""))) return null;
  if (!/\d/.test(t)) return null;
  let value;
  try {
    value = evaluateExpression(t);
  } catch {
    return null;
  }
  const shown = formatNumber(value);
  if (shown === null) return "計算できません（0で割った、または大きすぎます）。";
  return `${t.replace(/\s+/g, "")} = ${shown}`;
}

// ---------- 単位換算 ----------

// 基準単位への倍率。温度は関数で別扱い。
const UNITS = {
  length: { base: "m", items: { mm: 0.001, cm: 0.01, m: 1, km: 1000, inch: 0.0254, ft: 0.3048, mile: 1609.344 } },
  mass: { base: "g", items: { mg: 0.001, g: 1, kg: 1000, lb: 453.59237, oz: 28.349523125 } },
  volume: { base: "ml", items: { ml: 1, l: 1000, gal: 3785.411784 } },
  data: { base: "B", items: { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4 } },
};
const ALIASES = {
  mm: "mm", ミリメートル: "mm", ミリ: "mm",
  cm: "cm", センチメートル: "cm", センチ: "cm",
  m: "m", メートル: "m", km: "km", キロメートル: "km", キロ: "km",
  inch: "inch", インチ: "inch", ft: "ft", フィート: "ft", mile: "mile", miles: "mile", マイル: "mile",
  mg: "mg", g: "g", グラム: "g", kg: "kg", キログラム: "kg",
  lb: "lb", lbs: "lb", ポンド: "lb", oz: "oz", オンス: "oz",
  ml: "ml", ミリリットル: "ml", l: "l", リットル: "l", gal: "gal", ガロン: "gal",
  b: "b", kb: "kb", mb: "mb", gb: "gb", tb: "tb",
  "°c": "C", 度c: "C", c: "C", "°f": "F", 度f: "F", f: "F", k: "K", ケルビン: "K", // ℃/℉ は NFKC で °C/°F になる
};
const UNIT_CATEGORY = {};
for (const [cat, def] of Object.entries(UNITS)) for (const u of Object.keys(def.items)) UNIT_CATEGORY[u] = cat;
for (const u of ["C", "F", "K"]) UNIT_CATEGORY[u] = "temp";
const DISPLAY = { inch: "インチ", ft: "フィート", mile: "マイル", lb: "ポンド", oz: "オンス", gal: "ガロン", kb: "KB", mb: "MB", gb: "GB", tb: "TB", b: "B", ml: "mL", l: "L", C: "℃", F: "℉", K: "K" };

const aliasAlt = Object.keys(ALIASES).sort((a, b) => b.length - a.length).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
const UNIT_RE = new RegExp(
  `^(-?\\d+(?:\\.\\d+)?)\\s*(${aliasAlt})\\s*(?:は|を|って|＝|=|->|→|to)?\\s*(?:何|いくつ|なに)?\\s*(${aliasAlt})\\s*(?:に換算|です|ですか|か|で|に|になる|になりますか)?\\s*[?？]?$`,
  "i"
);

function toTemp(value, from, to) {
  const c = from === "C" ? value : from === "F" ? ((value - 32) * 5) / 9 : value - 273.15;
  return to === "C" ? c : to === "F" ? (c * 9) / 5 + 32 : c + 273.15;
}

export function convertUnit(value, fromKey, toKey) {
  const cat = UNIT_CATEGORY[fromKey];
  if (!cat || cat !== UNIT_CATEGORY[toKey]) return null;
  if (cat === "temp") return toTemp(value, fromKey, toKey);
  const items = UNITS[cat].items;
  return (value * items[fromKey]) / items[toKey];
}

function tryUnit(text) {
  const t = text.normalize("NFKC").trim();
  const m = UNIT_RE.exec(t);
  if (!m) return null;
  // 別名表のキーは全て小文字。MB/mb のようにデータ量は大小を区別しない（Mb=メガビットは扱わない）
  const look = (s) => ALIASES[s.toLowerCase()];
  const from = look(m[2]);
  const to = look(m[3]);
  if (!from || !to || from === to) return null;
  const value = Number(m[1]);
  const result = convertUnit(value, from, to);
  if (result === null) return null; // 長さ→重さのように換算できない組は、モデルへ流す
  const shown = formatNumber(Number(result.toPrecision(7)));
  const name = (k) => DISPLAY[k] ?? k;
  return `${m[1]}${name(from)} = ${shown}${name(to)}`;
}

// ---------- 入口 ----------

// 確定できたら { label, text }、できなければ null（モデルへ流す）。
export function tryLocalTool(input, now = new Date()) {
  const text = String(input ?? "").trim();
  if (!text || text.length > 80) return null;
  for (const [label, fn] of [
    ["時計", () => tryClock(text, now)],
    ["計算", () => tryCalc(text)],
    ["単位換算", () => tryUnit(text)],
  ]) {
    const answer = fn();
    if (answer) return { label, text: answer };
  }
  return null;
}
