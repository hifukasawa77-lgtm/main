// 長期メモリ：窓に収まらなくなった古い会話を、捨てずに要約へ置き換える。
//
// 「直近N件だけ渡す」方式だと、全部覚えているように見えて実際は覚えておらず、
// 例外もエラーも出ないまま「さっき言ったのに」が起きる。だから:
// - 古い分は**要約にして持ち越す**（細部は失われるが、決めたこと・ファイル名・結論は残す）
// - **境目を画面に出す**（どこから先は細部を覚えていないかを利用者に見せる）
// - 要約に失敗しても**黙って消さない**（機械的な要約へ落とし、そうしたと伝える）
//
// 要約は system に1つに畳んで持つ。会話の途中に2つ目の system を挟むと、
// チャットテンプレートによっては先頭の1つしか描かず、要約だけが無言で届かない。

const SUMMARY_OPEN = "\n\n--- これまでの会話の要約（古いやり取りは細部を覚えていません） ---\n";
const SUMMARY_CLOSE = "\n--- 要約ここまで ---";

// 日本語は1トークン≒1〜1.5字、英語は≒4字。混在を前提に安全側（多めに見積もる）へ倒す。
export const CHARS_PER_TOKEN = 1.5;
export const estimateTokens = (chars) => Math.ceil(chars / CHARS_PER_TOKEN);

const msgChars = (m) =>
  (m.content?.length ?? 0) + (m.tool_calls ? JSON.stringify(m.tool_calls).length : 0);

// ---------- system への出し入れ ----------

export function composeSystem(base, summary, ragText) {
  let s = base;
  if (summary) s += `${SUMMARY_OPEN}${summary}${SUMMARY_CLOSE}`;
  if (ragText) s += `\n\n${ragText}`;
  return s;
}

// 再開時に、保存済みの system から要約だけを取り戻す（systemPrompt は毎回作り直すので、そのままだと消える）。
export function extractSummary(systemContent) {
  if (typeof systemContent !== "string") return "";
  const a = systemContent.indexOf(SUMMARY_OPEN);
  if (a < 0) return "";
  const from = a + SUMMARY_OPEN.length;
  const b = systemContent.indexOf(SUMMARY_CLOSE, from);
  return b < 0 ? "" : systemContent.slice(from, b).trim();
}

// ---------- 切り分け ----------

// 「ユーザー発言から始まる1ターン」の境で切る。ここで切らないと、assistant の tool_calls と
// その結果（role:"tool"）が泣き別れになり、次の呼び出しがテンプレートエラーで落ちる。
export function planCompaction(messages, { numCtx, systemChars = 0, keepTurns = 3, triggerRatio = 0.65 } = {}) {
  const body = messages.filter((m) => m.role !== "system");
  const total = estimateTokens(body.reduce((s, m) => s + msgChars(m), 0) + systemChars);
  if (total <= numCtx * triggerRatio) return null;

  const userIdx = [];
  body.forEach((m, i) => m.role === "user" && userIdx.push(i));
  if (userIdx.length <= keepTurns) return null; // 直近だけで窓を使い切っている＝要約しても救えない
  const cut = userIdx[userIdx.length - keepTurns];
  return { old: body.slice(0, cut), recent: body.slice(cut), tokensBefore: total };
}

// ---------- 要約 ----------

function render(msgs, perMsg = 400) {
  return msgs
    .map((m) => {
      const label = { user: "利用者", assistant: "AI", tool: `ツール結果(${m.name ?? "?"})` }[m.role] ?? m.role;
      let text = (m.content ?? "").trim();
      if (m.tool_calls) text += ` [ツール呼び出し: ${m.tool_calls.map((c) => c.function?.name).join(", ")}]`;
      if (text.length > perMsg) text = text.slice(0, perMsg) + "…";
      return `${label}: ${text}`;
    })
    .join("\n");
}

// モデルが使えないとき・空を返したときの最後の砦。細部は落ちるが「何を聞かれたか」は残る。
export function mechanicalSummary(prevSummary, msgs) {
  const asked = msgs.filter((m) => m.role === "user").map((m) => `・${(m.content ?? "").replace(/\s+/g, " ").slice(0, 80)}`);
  const parts = [];
  if (prevSummary) parts.push(prevSummary);
  if (asked.length) parts.push(`（自動要約に失敗したため、利用者の発言だけを残します）\n${asked.join("\n")}`);
  return parts.join("\n");
}

const MAX_SUMMARY_CHARS = 1200;

// chatFn: (messages) => Promise<{content}>。差し替え可能にして、モデル無しで検査できるようにする。
export async function summarize(prevSummary, msgs, chatFn) {
  const prompt =
    "次の会話を、後で続きを話すための覚え書きに要約してください。\n" +
    "- 決まったこと・利用者の好みや前提・出てきたファイル名や数値・未解決の課題を優先する\n" +
    "- 雑談や挨拶、ツールの長い出力は省く。推測や創作は足さない\n" +
    "- 日本語の箇条書きで、400字以内\n\n" +
    (prevSummary ? `【これまでの要約】\n${prevSummary}\n\n` : "") +
    `【新しく加わった会話】\n${render(msgs)}`;
  try {
    const reply = await chatFn([
      { role: "system", content: "あなたは会話の要約係です。要約だけを出力します。" },
      { role: "user", content: prompt.slice(-8000) },
    ]);
    const text = (reply?.content ?? "").trim();
    if (text.length < 10) return { text: mechanicalSummary(prevSummary, msgs), fallback: true };
    return { text: text.length > MAX_SUMMARY_CHARS ? text.slice(0, MAX_SUMMARY_CHARS) + "…" : text, fallback: false };
  } catch {
    return { text: mechanicalSummary(prevSummary, msgs), fallback: true };
  }
}

// 一連の処理。messages を破壊的に置き換える（system は触らない）。
// 返り値: null（何もしなかった）| { summary, folded, fallback }
export async function compactIfNeeded(messages, prevSummary, chatFn, opts) {
  const plan = planCompaction(messages, opts);
  if (!plan) return null;
  const { text, fallback } = await summarize(prevSummary, plan.old, chatFn);
  const system = messages.filter((m) => m.role === "system");
  messages.length = 0;
  messages.push(...system, ...plan.recent);
  return { summary: text, folded: plan.old.length, fallback };
}
