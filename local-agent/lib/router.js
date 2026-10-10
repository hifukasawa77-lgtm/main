// モデル自動切替：質問の種類と、いま載っているモデルを見て、入っているモデルから選ぶ。
//
// 守ること:
// - **tools に対応しないモデルは候補に入れない**。選んだ先でファイル編集が一切動かなくなる。
// - **コード特化(coder)系は tools を名乗っても発火しないことがある**（README に実測あり）。
//   だから候補の判定は純粋関数に任せ、切替先の「実際に tool_calls を返すか」は呼び出し側が
//   一度だけ確かめ、ダメなら excluded に入れて選び直す。
// - **載っているモデルを優先して切り替えない**。読み込み直しは数十秒かかり、頻繁に切り替えると
//   全体が遅くなる。切り替えるのは「いまのモデルでは明らかに不向き」なときだけ。
// - 上限サイズ（maxGB）を超えるものは選ばない。VRAM は Ollama から取れないので、人が決める。

export const EMBED_RE = /embed|bge-|nomic|minilm|e5-|rerank/i;
export const CODER_RE = /coder|codestral|codellama|starcoder|deepseek-coder/i;

const CODE_WORDS =
  /コード|関数|バグ|実装|エラー|デバッグ|リファクタ|テスト|コンパイル|スタックトレース|正規表現|クラス|変数|\.(js|mjs|ts|tsx|py|java|go|rs|cpp|c|cs|html|css|json|sh|ps1)\b|```|\bfunction\b|\bconst\b|\bimport\b|\bdef\b|\bclass\b|\bbug\b|\berror\b|\bexception\b|\bAPI\b/i;

// 'short' | 'code' | 'long' | 'general'
export function classifyPrompt(text, { contextChars = 0 } = {}) {
  const t = String(text ?? "").trim();
  if (CODE_WORDS.test(t)) return "code";
  if (t.length + contextChars > 1500) return "long";
  if (t.length <= 40) return "short";
  return "general";
}

// candidates: [{ name, sizeGB, tools }]（tools は capabilities に tools を含むか）
// opts: { maxGB, current, loaded: モデル名の配列, excluded: Set }
// 返り値: { model, reason, kind }
export function chooseModel(prompt, candidates, { maxGB = 10, current, loaded = [], excluded = new Set(), contextChars = 0 } = {}) {
  const kind = classifyPrompt(prompt, { contextChars });
  const eligible = candidates.filter((c) => c.tools && !EMBED_RE.test(c.name) && c.sizeGB <= maxGB && !excluded.has(c.name));
  const keep = (reason) => ({ model: current, reason, kind });
  const cur = eligible.find((c) => c.name === current);

  if (!eligible.length) return keep("切替候補がありません（tools対応・上限サイズ内のモデルが無い）");

  const bySize = [...eligible].sort((a, b) => a.sizeGB - b.sizeGB);
  const coders = eligible.filter((c) => CODER_RE.test(c.name));
  const loadedOk = (set) => set.find((c) => loaded.includes(c.name));

  let set;
  let pick;
  let why;
  if (kind === "code" && coders.length) {
    set = coders;
    pick = [...coders].sort((a, b) => b.sizeGB - a.sizeGB)[0];
    why = "コードの質問なのでコード特化モデル";
  } else if (kind === "long") {
    // 長い入力は大きいモデルの方が崩れにくい。ただし中央値以上ならどれでもよい
    const median = bySize[Math.floor(bySize.length / 2)].sizeGB;
    set = eligible.filter((c) => c.sizeGB >= median);
    pick = bySize[bySize.length - 1];
    why = "長い入力なので大きめのモデル";
  } else if (kind === "short") {
    set = eligible;
    pick = bySize[0];
    why = "短い質問なので軽いモデル";
  } else {
    // general / コード特化が無いコード質問: 切り替える理由が無い
    return cur ? keep("いまのモデルのまま") : { model: bySize[bySize.length - 1].name, reason: "いまのモデルが使えないため", kind };
  }

  // いまのモデルがその種類に許容できるなら動かない（読み込み直しのコストを避ける）
  if (cur && set.some((c) => c.name === cur.name)) return keep("いまのモデルのまま");
  const warm = loadedOk(set);
  if (warm) return { model: warm.name, reason: `${why}（読み込み済みのものを使用）`, kind };
  return { model: pick.name, reason: why, kind };
}
