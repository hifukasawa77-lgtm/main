/**
 * AI Agent Proxy — Cloudflare Worker
 *
 * 役割: Workers AI プロキシ ＋ 旧KVデータの管理（会話の共有・自動保存は停止）
 * APIキーをブラウザへ渡さず Workers AI バインディングを使用
 *
 * バインディング:
 *   AI — Workers AI（必須）
 *   KV — 旧学習データの管理用（任意）
 *   RATE_LIMITER — リクエスト回数制限（必須）
 *
 * シークレット（任意）:
 *   ADMIN_TOKEN — /admin/* エンドポイントの認証トークン。未設定ならadminは404
 *
 * 設定方法: README.md を参照
 */
import { buildSystemPrompt } from './site-knowledge.js';
import { allowedOrigin, publicHeaders, securityHeaders, errorResponse, readJson, limitRequest } from './request-security.js';
import { withSecurityGate } from './security-monitor.js';
import { researchOshi } from './oshi-research.js';
import { handleVocalSong, handleVocalPortrait } from './vocalis-ai.js';

// 上から順に試行（先頭が利用不可・エラーの場合は次へフォールバック）
const MODELS = [
  '@cf/google/gemma-3-12b-it',
  '@cf/meta/llama-3.1-8b-instruct-fast',
  '@cf/meta/llama-3.1-8b-instruct',
];

// SYSTEM_PROMPT はサイト実データから自動生成される（site-knowledge.js）。
// ゲーム本数等の更新は assets/js/agent-data.js → node scripts/gen-agent-knowledge.mjs で反映する。
const SYSTEM_PROMPT = buildSystemPrompt();

// ── 共有学習メモリ（KV） ─────────────────────────────────
const LEARN_INDEX_KEY = 'learn:index';
async function loadIndex(env) {
  try {
    const raw = await env.KV.get(LEARN_INDEX_KEY);
    const idx = raw ? JSON.parse(raw) : [];
    return Array.isArray(idx) ? idx : [];
  } catch {
    return [];
  }
}

async function saveIndex(env, index) {
  await env.KV.put(LEARN_INDEX_KEY, JSON.stringify(index));
}

async function runAI(env, messages, opts) {
  let lastError = null;
  for (const model of MODELS) {
    try {
      const result = await env.AI.run(model, { messages, ...(opts || {}) });
      const text = result?.choices?.[0]?.message?.content || result?.response || '';
      if (text) return text;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error('all models failed');
}

// ── AI Video Studio 用エンドポイント ──────────────────────
// 画像生成（text-to-image）。flux-1-schnell は { image: base64(jpeg) } を返す。
const IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';
// 音声合成（text-to-speech）。melotts は { audio: base64(mp3) } を返す。
const TTS_MODEL = '@cf/myshell-ai/melotts';

// LLM出力からJSON部分だけを安全に取り出す
function extractJson(text) {
  if (!text) return null;
  let t = String(text).trim();
  // ```json ... ``` のコードフェンスを除去
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s === -1 || e === -1 || e <= s) return null;
  try { return JSON.parse(t.slice(s, e + 1)); } catch { return null; }
}

const VIDEO_SYSTEM = `あなたはプロの動画ディレクター兼脚本家です。
与えられたテーマから、ナレーション付きショート動画の絵コンテをJSONのみで出力します。
制約:
- 出力はJSONオブジェクトのみ。前後の説明文・コードフェンスは禁止。
- "theme" は次から最も近いものを1つ選ぶ: space, nature, tech, city, business, energy, aurora
- "scenes" は4〜6個。各シーンは {"heading","narration","subtitle","visual"}。
- heading: 画面に出す短い見出し(全角12文字程度まで・日本語)
- narration: 読み上げる文(日本語・1〜2文・自然な話し言葉)
- subtitle: 字幕(narrationを短くまとめた日本語・1行)
- visual: 画像生成用プロンプト(英語・具体的な情景描写・cinematic, high detail を含める)
- "youtube" は {"title","description","tags"(配列)} で日本語中心。
- 参考情報(調べた事実)が与えられた場合は、その事実を要約してnarrationに正確に反映し、創作・誤情報を避ける。プロンプトのオウム返しは禁止。
- product（商品情報）が与えられた場合、narrationは商品の魅力を伝える説得力のある宣伝トーンにし、商品名・特徴を自然に織り込む。価格・購入導線はoutro系シーンのみで触れる。記載のない仕様・効果を創作しない。`;

// 業種テンプレート（クライアント側 ai-video-studio.html の INDUSTRY_NOTES と文言を一致させる）
const INDUSTRY_NOTES = {
  general: '',
  ec: 'EC商品・物販紹介のトーン。購買意欲を高める言葉で、使用シーン・素材・ベネフィットを具体的に伝える。',
  app: 'アプリ・SaaS紹介のトーン。課題→解決→主要機能の順に簡潔でテンポ良く伝える。',
  restaurant: '飲食店紹介のトーン。雰囲気・看板メニュー・味の魅力を食欲が出る言葉で伝える。',
  service: 'サービス・士業紹介のトーン。信頼感を重視し、悩み→解決→相談導線の順に伝える。',
};

// 主題（トピック）を抽出
function extractTopic(prompt) {
  let p = String(prompt || '').split(/\n/)[0].trim();
  const m = p.match(/(.{2,40}?)(について|を紹介|を解説|の魅力|のメリット|入門|とは|を作りたい|を作って|の作り方|の歴史)/);
  if (m) return m[1].replace(/^(初心者向けに|わかりやすく|やさしく|ざっくり)/, '').trim();
  return p.slice(0, 40);
}

// インターネット(Wikipedia)から事実情報を取得して要約材料にする
async function webResearch(topic) {
  try {
    const sRes = await fetch('https://ja.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&format=json&srsearch=' + encodeURIComponent(topic), { headers: { 'User-Agent': 'AIVideoStudio/1.0 (portfolio)' } });
    const sj = await sRes.json();
    const hit = sj && sj.query && sj.query.search && sj.query.search[0];
    if (!hit) return null;
    const title = hit.title;
    const rRes = await fetch('https://ja.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title), { headers: { 'User-Agent': 'AIVideoStudio/1.0 (portfolio)' } });
    const rj = await rRes.json();
    const extract = rj && rj.extract ? String(rj.extract) : '';
    if (!extract) return null;
    const url = (rj.content_urls && rj.content_urls.desktop && rj.content_urls.desktop.page) || ('https://ja.wikipedia.org/wiki/' + encodeURIComponent(title));
    return { title, extract: extract.slice(0, 1500), url };
  } catch (e) {
    return null;
  }
}

async function handleVideoScript(env, body, origin) {
  const prompt = String(body.prompt || '').slice(0, 600).trim();
  if (!prompt) return new Response('Bad Request: empty prompt', { status: 400 });
  const aspect = String(body.aspect || '16:9');
  const platform = String(body.platform || 'youtube');
  const shortForm = ['shorts', 'tiktok', 'reels'].includes(platform);
  // ① インターネットから事実情報を取得（任意・失敗してもLLM知識で続行）
  const research = (body.research === false) ? null : await webResearch(extractTopic(prompt));
  const factBlock = research
    ? `\n\n# 参考情報（Wikipedia「${research.title}」より。これを要約して各シーンのnarration/subtitleに正確に反映すること）:\n${research.extract}`
    : '';
  const platformNote = shortForm
    ? `配信先: ${platform}（縦型ショート動画 15〜40秒）。
- 1つ目のシーンは視聴者を一瞬で掴む強いフック(問いかけ・意外な事実・結論先出し)にする。
- シーンは3〜4個に絞り、テンポ良く・話し言葉でキャッチーに。
- narration/subtitleは短く歯切れよく。最後は行動喚起(フォロー/いいね)。
- visualは縦構図(vertical 9:16 composition)を意識した英語プロンプト。`
    : `配信先: ${platform}（横型・通常尺）。落ち着いた分かりやすい構成で4〜6シーン。`;
  // ② 商品情報（任意・商品紹介動画モード）と業種テンプレート
  const product = body.product || null;
  const productBlock = (product && product.name)
    ? `\n\n# 商品情報（narrationに自然に織り込み、価格/購入導線は最後のシーンのみで触れる。記載外の仕様は創作しない）:\n商品名: ${product.name}\n特徴: ${product.description || '(なし)'}\n価格/CTA: ${product.price || '(なし)'}\nURL: ${product.url || '(なし)'}`
    : '';
  const industryNote = (product && INDUSTRY_NOTES[product.industry])
    ? `\n業種テンプレート: ${INDUSTRY_NOTES[product.industry]}`
    : '';
  const messages = [
    { role: 'system', content: VIDEO_SYSTEM },
    { role: 'user', content: `テーマ:「${prompt}」\nアスペクト比: ${aspect}\n${platformNote}${industryNote}${factBlock}${productBlock}\n上記の絵コンテJSONを出力してください。` },
  ];
  try {
    const text = await runAI(env, messages, { max_tokens: 1536 });
    const json = extractJson(text);
    if (!json || !Array.isArray(json.scenes) || json.scenes.length === 0) {
      return jsonResponse({ error: 'parse_failed', raw: String(text).slice(0, 400) }, origin, 200);
    }
    return jsonResponse({ storyboard: json, research: research ? { title: research.title, url: research.url } : null, source: 'ai' }, origin);
  } catch (e) {
    return jsonResponse({ error: 'ai_error' }, origin, 502);
  }
}

async function handleVideoImage(env, body, origin) {
  const prompt = String(body.prompt || '').slice(0, 1500).trim();
  if (!prompt) return new Response('Bad Request: empty prompt', { status: 400 });
  const steps = Math.min(Math.max(parseInt(body.steps) || 4, 1), 8);
  try {
    const r = await env.AI.run(IMAGE_MODEL, { prompt, steps });
    const image = r && (r.image || r);
    if (!image || typeof image !== 'string') {
      return jsonResponse({ error: 'no_image' }, origin, 200);
    }
    return jsonResponse({ image, mime: 'image/jpeg' }, origin);
  } catch (e) {
    return jsonResponse({ error: 'image_error' }, origin, 502);
  }
}

async function handleVideoTts(env, body, origin) {
  const text = String(body.text || '').slice(0, 900).trim();
  if (!text) return new Response('Bad Request: empty text', { status: 400 });
  const lang = String(body.lang || 'ja');
  try {
    const r = await env.AI.run(TTS_MODEL, { prompt: text, lang });
    const audio = r && (r.audio || r);
    if (!audio || typeof audio !== 'string') {
      return jsonResponse({ error: 'no_audio' }, origin, 200);
    }
    return jsonResponse({ audio, mime: 'audio/mpeg' }, origin);
  } catch (e) {
    return jsonResponse({ error: 'tts_error' }, origin, 502);
  }
}

export default withSecurityGate('ai-proxy', {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const isAllowed = allowedOrigin(origin, env);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      if (url.pathname.startsWith('/admin/')) {
        return new Response(null, { status: 204, headers: adminCorsHeaders() });
      }
      if (!isAllowed) return errorResponse(403, 'Forbidden');
      return new Response(null, {
        status: 204,
        headers: corsHeaders(isAllowed ? origin : ''),
      });
    }

    // ── 管理エンドポイント（ADMIN_TOKENトークンで認可、Origin制限なし） ──
    if (url.pathname.startsWith('/admin/')) {
      return handleAdmin(request, env, url);
    }

    // ── 公開統計（集計のみ・回答個票は返さない）──
    // 日次自己進化（/agent-evolve）が弱点発見の入力に使う。Origin制限なし（curl可）。
    if (url.pathname === '/stats' && request.method === 'GET') {
      return handleStats(env, isAllowed ? origin : '');
    }

    if (request.method === 'GET' && url.pathname === '/vocal/usage') {
      if (!isAllowed) return errorResponse(403, 'Forbidden');
      return getVocalUsage(request, env, origin);
    }
    if (!isAllowed) return errorResponse(403, 'Forbidden');
    if (request.method !== 'POST') return errorResponse(405, 'Method Not Allowed', corsHeaders(origin));
    if (!['/', '/feedback', '/video/script', '/video/image', '/video/tts', '/oshi/research', '/vocal/song', '/vocal/portrait', '/vocal/budget'].includes(url.pathname)) {
      return errorResponse(404, 'Not Found', corsHeaders(origin));
    }
    const limited = await limitRequest(request, env, corsHeaders(origin));
    if (limited) return limited;

    let body;
    try {
      body = await readJson(request, 16384);
    } catch (error) {
      return errorResponse(error.status || 400, error.status ? error.message : 'Invalid request', corsHeaders(origin));
    }


    if (url.pathname === '/vocal/budget') {
      const adminPin = env.VOCALIS_ADMIN_PIN;
      if (!env.VOCALIS_BUDGET) return jsonResponse({ error: 'VOCALIS budget service is unavailable.' }, origin, 503);
      if (!adminPin) return jsonResponse({ error: 'VOCALIS_ADMIN_PIN is not configured.' }, origin, 503);
      if (!secureEqual(request.headers.get('X-Vocalis-Admin') || '', adminPin)) return jsonResponse({ error: '管理者コードが正しくありません。' }, origin, 401);
      const ceiling = Number(body.ceilingUsd);
      if (![0.10, 0.25, 0.50, 1, 2, 5].includes(ceiling)) return jsonResponse({ error: '上限額は指定された候補から選択してください。' }, origin, 400);
      const id = env.VOCALIS_BUDGET.idFromName('vocalis-global');
      const response = await env.VOCALIS_BUDGET.get(id).fetch('https://budget/configure', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ceilingUsd: ceiling }),
      });
      return jsonResponse(await response.json(), origin, response.status);
    }

    if (url.pathname === '/vocal/song' || url.pathname === '/vocal/portrait') {
      const operation = url.pathname === '/vocal/song' ? 'song' : 'portrait';
      const valid = operation === 'song'
        ? (typeof body.theme === 'string' && body.theme.trim().length > 0 && body.theme.length <= 500 && Number.isFinite(body.minutes) && body.minutes >= 0.5 && body.minutes <= 10 && ['male', 'female'].includes(body.voice) && ['J-POP', 'バラード', 'ロック', 'エレクトロ'].includes(body.genre))
        : (body.profile && typeof body.profile.name === 'string' && body.profile.name.trim().length > 0 && body.profile.name.length <= 40 && ['male', 'female'].includes(body.profile.voice) && typeof body.profile.appearance === 'string' && body.profile.appearance.length <= 1000 && ['アニメ', '3D', 'イラスト'].includes(body.profile.style));
      if (!valid) return jsonResponse({ error: '入力内容を確認してください。' }, origin, 400);
      const pin = env.VOCALIS_ACCESS_PIN;
      if (!pin) return jsonResponse({ error: 'VOCALIS_ACCESS_PIN is not configured; generation is disabled.' }, origin, 503);
      if (!secureEqual(request.headers.get('X-Vocalis-Code') || '', pin)) return jsonResponse({ error: 'アクセスコードが正しくありません。' }, origin, 401);
      if (!env.VOCALIS_BUDGET) return jsonResponse({ error: 'VOCALIS budget service is unavailable.' }, origin, 503);
      const ceiling = Number(env.VOCALIS_MONTHLY_BUDGET_USD) || 0.50;
      const reservation = await reserveVocalisBudget(env.VOCALIS_BUDGET, operation, ceiling);
      if (!reservation.ok) return jsonResponse({ error: '今月のVOCALIS AI利用上限に達しました。来月まで生成を停止します。', usage: reservation.usage }, origin, 429);
      const result = operation === 'song' ? await handleVocalSong(env, body) : await handleVocalPortrait(env, body);
      const { usage, ...payload } = result.body || {};
      const actual = result.status >= 400 ? reservation.reservedUsd : (usage?.estimatedUsd || reservation.reservedUsd);
      const settled = await settleVocalisBudget(env.VOCALIS_BUDGET, reservation.id, actual);
      return jsonResponse({ ...(payload || {}), usage: settled }, origin, result.status);
    }

    // ── 推し活ログ: イベントリサーチ（ニュースRSS・AI不使用・キー不要）──
    if (url.pathname === '/oshi/research') {
      const r = await researchOshi(body);
      return jsonResponse(r.body, origin, r.status);
    }

    // ── AI Video Studio エンドポイント ──
    if (url.pathname === '/video/script') return handleVideoScript(env, body, origin);
    if (url.pathname === '/video/image')  return handleVideoImage(env, body, origin);
    if (url.pathname === '/video/tts')    return handleVideoTts(env, body, origin);

    // ── フィードバック受付（👍/👎 → 共有メモリのスコア更新） ──
    if (url.pathname === '/feedback') {
      // Legacy public feedback must not mutate shared knowledge anonymously.
      return jsonResponse({ ok: false, reason: 'shared_learning_disabled' }, origin);
    }

    // ── チャット ──
    const { message, history } = body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response('Bad Request: empty message', { status: 400 });
    }
    if (message.length > 500) {
      return new Response('Bad Request: message too long', { status: 400 });
    }

    const userText = message.trim();

    // Do not reuse private conversations across visitors. Legacy KV entries
    // remain accessible only to authenticated administrators for review/removal.

    // ② AIで回答生成
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    for (const m of (Array.isArray(history) ? history : []).slice(-6)) {
      if (m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string') {
        messages.push({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.text.slice(0, 500),
        });
      }
    }
    messages.push({ role: 'user', content: userText });

    try {
      const text = await runAI(env, messages);
      // No automatic persistence of user questions or history-derived answers.
      return jsonResponse({ text, source: 'ai', key: null }, origin);
    } catch (e) {
      return errorResponse(502, 'AI service unavailable', corsHeaders(origin));
    }
  },
});

// ── 管理API: 学習エントリの閲覧・削除（ADMIN_TOKEN必須） ──
// ── 公開統計エンドポイント ─────────────────────────────────
// 共有学習メモリの「集計」だけを返す。回答本文・質問全文は返さない（プライバシー/汚染対策）。
// negatives / topHits expose numeric legacy metrics only; never questions or keys.
async function handleStats(env, origin) {
  const now = new Date().toISOString();
  if (!env.KV) {
    return jsonResponseWithHeaders({ total: 0, avgScore: 0, negatives: [], topHits: [], updatedAt: now }, corsHeaders(origin), 200);
  }
  const index = await loadIndex(env);
  const total = index.length;
  const sum = index.reduce((a, e) => a + (e.score || 0), 0);
  const avgScore = total ? Math.round((sum / total) * 100) / 100 : 0;
  const brief = (e) => ({ score: e.score || 0, hits: e.hits || 0 });
  const negatives = index.filter(e => (e.score || 0) < 0)
    .sort((a, b) => (a.score || 0) - (b.score || 0)).slice(0, 10).map(brief);
  const topHits = index.slice()
    .sort((a, b) => (b.hits || 0) - (a.hits || 0)).slice(0, 10).map(brief);
  return jsonResponseWithHeaders({ total, avgScore, negatives, topHits, updatedAt: now }, corsHeaders(origin), 200);
}

async function handleAdmin(request, env, url) {
  if (!env.ADMIN_TOKEN) return new Response('Not Found', { status: 404 });
  const token = request.headers.get('X-Admin-Token') || '';
  if (!secureEqual(token, env.ADMIN_TOKEN)) {
    return new Response('Unauthorized', { status: 401, headers: adminCorsHeaders() });
  }

  const hasKV = !!env.KV;

  if (url.pathname === '/admin/learned') {
    if (request.method === 'GET') {
      const index = hasKV ? await loadIndex(env) : [];
      const entries = index
        .map(e => ({
          key: e.k, q: e.q,
          score: e.score || 0, hits: e.hits || 0,
          ts: e.ts, lastUsed: e.lastUsed || e.ts,
        }))
        .sort((a, b) => (b.score * 10 + b.hits) - (a.score * 10 + a.hits));
      return jsonResponseWithHeaders({ entries }, adminCorsHeaders());
    }
    if (request.method === 'DELETE') {
      const key = url.searchParams.get('key') || '';
      if (!hasKV || !key) return jsonResponseWithHeaders({ ok: false }, adminCorsHeaders());
      const index = await loadIndex(env);
      const filtered = index.filter(e => e.k !== key);
      if (filtered.length === index.length) {
        return jsonResponseWithHeaders({ ok: false, error: 'not-found' }, adminCorsHeaders());
      }
      await Promise.all([
        env.KV.delete('learn:' + key),
        saveIndex(env, filtered),
      ]);
      return jsonResponseWithHeaders({ ok: true }, adminCorsHeaders());
    }
  }

  return new Response('Not Found', { status: 404, headers: adminCorsHeaders() });
}

function jsonResponse(obj, origin, status) {
  return jsonResponseWithHeaders(obj, corsHeaders(origin), status);
}

function jsonResponseWithHeaders(obj, headers, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { ...securityHeaders, 'Content-Type': 'application/json', ...headers },
  });
}

function corsHeaders(origin) {
  return publicHeaders(origin);
}

function adminCorsHeaders() {
  return {
    ...securityHeaders,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
  };
}

async function getVocalUsage(request, env, origin) {
  const pin = env.VOCALIS_ACCESS_PIN;
  if (!pin) return jsonResponse({ error: 'VOCALIS_ACCESS_PIN is not configured; generation is disabled.' }, origin, 503);
  if (!secureEqual(request.headers.get('X-Vocalis-Code') || '', pin)) return jsonResponse({ error: 'アクセスコードが正しくありません。' }, origin, 401);
  if (!env.VOCALIS_BUDGET) return jsonResponse({ error: 'VOCALIS budget service is unavailable.' }, origin, 503);
  const limited = await limitRequest(request, env, corsHeaders(origin));
  if (limited) return limited;
  const id = env.VOCALIS_BUDGET.idFromName('vocalis-global');
  const response = await env.VOCALIS_BUDGET.get(id).fetch('https://budget/state');
  return jsonResponse(await response.json(), origin);
}

function secureEqual(a, b) {
  let diff = a.length ^ b.length;
  const size = Math.max(a.length, b.length);
  for (let i = 0; i < size; i++) diff |= (a.charCodeAt(i % (a.length || 1)) || 0) ^ (b.charCodeAt(i % (b.length || 1)) || 0);
  return diff === 0;
}

async function reserveVocalisBudget(namespace, operation, ceiling) {
  const id = namespace.idFromName('vocalis-global');
  const response = await namespace.get(id).fetch('https://budget/reserve', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation, ceiling }),
  });
  return response.json();
}

async function settleVocalisBudget(namespace, reservationId, actualUsd) {
  const id = namespace.idFromName('vocalis-global');
  const response = await namespace.get(id).fetch('https://budget/settle', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reservationId, actualUsd }),
  });
  return response.json();
}

export class VocalisBudget {
  constructor(state, env) { this.state = state; this.env = env;  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/state' && request.method === 'GET') return Response.json(await this.read());
    if (url.pathname === '/reserve' && request.method === 'POST') return this.reserve(await request.json());
    if (url.pathname === '/configure' && request.method === 'POST') return this.configure(await request.json());
    if (url.pathname === '/settle' && request.method === 'POST') return this.settle(await request.json());
    return new Response('Not Found', { status: 404 });
  }
  month() { return new Date().toISOString().slice(0, 7); }
  async configuredCeiling() { return Number(await this.state.storage.get('ceilingUsd')) || Number(this.env.VOCALIS_MONTHLY_BUDGET_USD) || 0.50; }
  async read() {
    let value = await this.state.storage.get('usage') || { month: this.month(), spentUsd: 0, reservedUsd: 0, songs: 0, portraits: 0 };
    if (value.month !== this.month()) value = { month: this.month(), spentUsd: 0, reservedUsd: 0, songs: 0, portraits: 0 };
    return { ...value, ceilingUsd: await this.configuredCeiling() };
  }
  async configure(body) {
    const ceilingUsd = Number(body.ceilingUsd);
    if (![0.10, 0.25, 0.50, 1, 2, 5].includes(ceilingUsd)) return Response.json({ error: 'invalid ceiling' }, { status: 400 });
    await this.state.storage.put('ceilingUsd', ceilingUsd);
    return Response.json({ ...(await this.read()), saved: true });
  }
  async reserve(body) {
    const operation = ['song', 'portrait'].includes(body.operation) ? body.operation : null;
    if (!operation) return Response.json({ ok: false, error: 'invalid operation' }, { status: 400 });
    const id = crypto.randomUUID(), reserve = operation === 'song' ? 0.02 : 0.01;
    const ceiling = await this.configuredCeiling();
    const result = await this.state.storage.transaction(async tx => {
      let value = await tx.get('usage') || { month: this.month(), spentUsd: 0, reservedUsd: 0, songs: 0, portraits: 0 };
      if (value.month !== this.month()) value = { month: this.month(), spentUsd: 0, reservedUsd: 0, songs: 0, portraits: 0 };
      if (value.spentUsd + value.reservedUsd + reserve > ceiling + 1e-9) return { ok: false, usage: { ...value, ceilingUsd: ceiling } };
      value.reservedUsd += reserve; value[operation === 'song' ? 'songs' : 'portraits'] += 1;
      await tx.put('usage', value);
      return { ok: true, usage: { ...value, ceilingUsd: ceiling } };
    });
    if (result.ok) await this.state.storage.put('reservation:' + id, { month: result.usage.month, reserve, operation });
    return Response.json({ ...result, ...(result.ok ? { id, reservedUsd: reserve } : {}) });
  }
  async settle(body) {
    const pending = await this.state.storage.get('reservation:' + body.reservationId);
    if (!pending) return Response.json(await this.read());
    await this.state.storage.delete('reservation:' + body.reservationId);
    const actual = Math.max(0, Math.min(pending.reserve, Number(body.actualUsd) || 0));
    const value = await this.state.storage.transaction(async tx => {
      let usage = await tx.get('usage') || { month: this.month(), spentUsd: 0, reservedUsd: 0, songs: 0, portraits: 0 };
      if (usage.month !== pending.month) return usage;
      usage.reservedUsd = Math.max(0, usage.reservedUsd - pending.reserve); usage.spentUsd += actual;
      await tx.put('usage', usage); return usage;
    });
    return Response.json({ ...value, ceilingUsd: await this.configuredCeiling() });
  }
}
