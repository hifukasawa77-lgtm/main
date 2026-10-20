// 1日の Workers AI 利用の上限（全訪問者で共有）。ai-proxy と notebook-proxy の両方が使う。
//
// ★Origin のヘッダは curl で名乗れる。サイトの Origin を名乗るだけで誰でも AI を呼べ、IP ごとの制限
//   （ai-proxy 30回/分・notebook 10回/分）しか止める物が無かったため、無料枠（1日分）を数分で使い切られ、
//   サイトの案内チャットまで止まり得た（2026-10-19 の点検）。全体の1日の上限を Durable Object で数える。
// ★数えられないときは止める（fail closed）。数えずに通すと、上限が上限でなくなる。
// ★数えるのは VocalisBudget クラスの 'ai-daily' という別の実体（Vocalis の月の予算とは混ざらない）。
//   notebook-proxy からは wrangler-notebook.toml の AI_QUOTA（script_name = "ai-proxy"）で同じ実体を使う。

/** How many daily units one request uses (roughly proportional to Workers AI cost). 0 = not an AI call. */
export function aiUnitsFor(pathname, body = {}) {
  if (pathname === '/') return 1;                          // chat (8B model, short history)
  if (pathname === '/video/script') return 3;              // up to 1536 tokens + retries
  if (pathname === '/video/tts') return 1;
  if (pathname === '/video/image') {                       // image cost grows with steps
    const steps = Math.min(Math.max(parseInt(body.steps) || 4, 1), 8);
    return 2 + steps;
  }
  return 0;
}

export const DEFAULT_AI_DAILY_UNITS = 1500;

/**
 * Takes units from the shared daily budget (Durable Object 'ai-daily'). Fails closed: if the budget
 * cannot be read, the AI call is refused instead of running uncounted.
 */
export async function takeAiQuota(env, units) {
  const namespace = env.AI_QUOTA || env.VOCALIS_BUDGET;
  if (!namespace) return { ok: false, status: 503, error: 'AI の利用上限を確かめられないため、止めています。' };
  const limit = Math.max(1, Math.floor(Number(env.AI_DAILY_UNITS)) || DEFAULT_AI_DAILY_UNITS);
  try {
    const response = await namespace.get(namespace.idFromName('ai-daily')).fetch('https://budget/quota', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ units, limit }),
    });
    const result = await response.json();
    if (result && result.ok) return { ok: true };
    return { ok: false, status: 429, error: '本日の AI 利用上限に達しました。明日（日本時間 9:00）に再開します。' };
  } catch {
    return { ok: false, status: 503, error: 'AI の利用上限を確かめられないため、止めています。' };
  }
}
