/**
 * 食べ物の写真 → 料理名・量・カロリー・PFC の推定（ヘルスログ用）。純粋ロジック＋Workers AI 呼び出し。
 *
 * ★モデルの出力は信用しない。小さな視覚モデルは「もっともらしい数字」を平気で作る。
 *   - 形（JSON）が壊れる・文章が混ざる → 取り出せなければ失敗として返す（空の成功にしない）
 *   - kcal が PFC（4P+9F+4C）と大きく食い違う → PFC から計算し直し、直したことを印で返す
 *   - 数値は範囲に丸め、料理名は制御文字を落として長さを切る（画面側も textContent で描く）
 * ★写真はここで保存も記録もしない（ログに入れない）。画像の中身は先頭バイトで種類を確かめてから渡す。
 */

// 上から順に試す。先頭が使えない（未提供・同意未了・エラー）ときは次へ。
// llama-3.2-vision は Meta の利用同意が一度だけ必要（README 参照）。
export const FOOD_PHOTO_MODELS = [
  '@cf/meta/llama-4-scout-17b-16e-instruct',
  '@cf/meta/llama-3.2-11b-vision-instruct',
  '@cf/mistralai/mistral-small-3.1-24b-instruct',
];

/** 受け付ける画像（base64文字列）の最大長。ブラウザ側で 1024px・JPEG に縮めてから送る前提。 */
export const MAX_IMAGE_BASE64 = 1_200_000;
/** この経路だけ本文の上限を大きくする（他の経路は 16KB のまま）。画像＋JSONの枠で 1.4MB。 */
export const PHOTO_BODY_LIMIT = 1_400_000;

const DATA_URL = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

const SYSTEM_PROMPT = [
  'あなたは日本の食事の栄養士です。写真に写っている食べ物・飲み物を見て、料理ごとに量とカロリーを推定します。',
  '出力は次のJSONだけ。説明文・コードブロック・前置きは書かない。',
  '{"notFood":false,"items":[{"name":"料理名(日本語)","grams":数値,"kcal":数値,"p":数値,"f":数値,"c":数値}]}',
  '決まり:',
  '- 料理（皿・器）ごとに1行。ごはん・おかず・汁物・飲み物は別々の行にする。最大8行。',
  '- grams は写っている1人前の重さ(g)。kcal は p(たんぱく質g)・f(脂質g)・c(炭水化物g) と矛盾しない値にする。',
  '- 見えない油・調味料・ドレッシングは、その料理で一般的な量を含めて見積もる。',
  '- 食べ物が写っていない・判別できない写真は {"notFood":true,"items":[]} を返す。',
].join('\n');

/** 画像の先頭バイトで、宣言された種類と中身が合っているかを見る（任意のデータをAIへ流さない）。 */
function magicOk(kind, b64) {
  let head;
  try { head = atob(b64.slice(0, 24)); } catch { return false; }
  const bytes = Array.from(head, c => c.charCodeAt(0));
  if (kind === 'jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (kind === 'png') return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (kind === 'webp') return head.slice(0, 4) === 'RIFF' && head.slice(8, 12) === 'WEBP';
  return false;
}

/** 本文の image（data URL）を検査して返す。不正なら { error, status }。 */
export function validateImage(body) {
  const image = body && body.image;
  if (typeof image !== 'string' || !image) return { status: 400, error: 'image_required' };
  if (image.length > MAX_IMAGE_BASE64 + 40) return { status: 413, error: 'image_too_large' };
  const m = DATA_URL.exec(image);
  if (!m) return { status: 400, error: 'image_format' };
  if (!magicOk(m[1], m[2])) return { status: 400, error: 'image_mismatch' };
  return { image };
}

function clampNum(v, min, max, dec) {
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  const c = Math.min(max, Math.max(min, n));
  const p = Math.pow(10, dec || 0);
  return Math.round(c * p) / p;
}

/** モデルの文章から最初のJSONオブジェクトを取り出す（コードブロック・前置きが付いても拾う）。 */
export function extractJson(text) {
  if (typeof text !== 'string') return null;
  const s = text.replace(/```(?:json)?/gi, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

/** 推定結果の検疫。kcal が PFC と食い違えば PFC から計算し直す（adjusted: true）。 */
export function sanitizeResult(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const list = Array.isArray(raw.items) ? raw.items : [];
  const items = [];
  for (const it of list.slice(0, 8)) {
    if (!it || typeof it !== 'object') continue;
    const name = typeof it.name === 'string' ? it.name.replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) : '';
    let kcal = clampNum(it.kcal, 0, 3000, 0);
    const p = clampNum(it.p, 0, 300, 1) || 0, f = clampNum(it.f, 0, 300, 1) || 0, c = clampNum(it.c, 0, 500, 1) || 0;
    if (!name || kcal === null) continue;
    const grams = clampNum(it.grams, 1, 2000, 0);
    let adjusted = false;
    const derived = Math.round(4 * p + 9 * f + 4 * c);
    if (derived > 0 && Math.abs(kcal - derived) / derived > 0.35) { kcal = Math.min(3000, derived); adjusted = true; }
    items.push({ name, grams, kcal, p, f, c, adjusted });
  }
  const notFood = raw.notFood === true && !items.length;
  if (!items.length && !notFood) return null;
  return { notFood, items };
}

function messageText(result) {
  return result?.choices?.[0]?.message?.content || result?.response || '';
}

/**
 * 写真を推定して { status, body } を返す。
 * 成功: { items, notFood, model }  失敗: { error }（理由の種類だけ。モデルの生の出力は返さない）
 */
export async function estimateFoodPhoto(env, body) {
  const v = validateImage(body);
  if (v.error) return { status: v.status, body: { error: v.error } };
  if (!env || !env.AI) return { status: 503, body: { error: 'ai_unavailable' } };
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: [
      { type: 'text', text: 'この写真の食べ物を推定してください。JSONだけを返してください。' },
      { type: 'image_url', image_url: { url: v.image } },
    ] },
  ];
  let sawAnswer = false;
  for (const model of FOOD_PHOTO_MODELS) {
    try {
      const out = await env.AI.run(model, { messages, max_tokens: 700, temperature: 0.2 });
      const text = messageText(out);
      if (!text) continue;
      sawAnswer = true;
      const res = sanitizeResult(extractJson(text));
      if (res) return { status: 200, body: { ...res, model } };
    } catch {
      // 次のモデルへ（理由は画像を含みうるので記録しない）
    }
  }
  return { status: 502, body: { error: sawAnswer ? 'unreadable' : 'model_unavailable' } };
}
