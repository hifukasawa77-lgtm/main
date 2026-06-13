/**
 * AI Agent Proxy — Cloudflare Worker
 *
 * 役割: Workers AI を呼び出すプロキシ ＋ KV共有学習メモリ
 * APIキー不要 — Workers AI バインディングを使用（最もセキュアな構成）
 *
 * バインディング:
 *   AI — Workers AI（必須）
 *   KV — KV namespace（任意。未設定なら学習機能をスキップして動作）
 *
 * 設定方法: README.md を参照
 */

const ALLOWED_ORIGINS = [
  'https://hifukasawa77-lgtm.github.io',
  'http://localhost',
  'http://127.0.0.1',
];

// 上から順に試行（先頭が利用不可・エラーの場合は次へフォールバック）
const MODELS = [
  '@cf/google/gemma-3-12b-it',
  '@cf/meta/llama-3.1-8b-instruct-fast',
  '@cf/meta/llama-3.1-8b-instruct',
];

const SYSTEM_PROMPT = `あなたは「ヒデのポートフォリオサイト」の案内エージェントです。
サイトオーナーの名前は「ヒデ」です。絶対に「ハイド」と呼ばないでください。「hide」と書かれていても必ず「ヒデ」と読んでください。
ヒデは埼玉県三郷市在住のシステムエンジニアで、Claude AIと共同で23本のブラウザゲーム・AIツールを開発しています。
このサイトではゲーム紹介・三郷市情報・AI開発の話題を扱っています。
返答は日本語で2〜3文以内に簡潔にまとめてください。雑談や一般的な質問にも気軽に答えてください。ゲームの遊び方・おすすめ・AIについての質問が多いです。`;

// ── 共有学習メモリ（KV） ─────────────────────────────────
const LEARN_INDEX_KEY = 'learn:index';
const LEARN_MAX_ENTRIES = 300;
const SIMILARITY_THRESHOLD = 0.85;
const REMOVE_SCORE = -2; // 👎が積み重なってこの値以下になったら削除

function normalizeQ(s) {
  return (s || '').toLowerCase()
    .replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[\s、。！？!?.,]+/g, '')
    .trim();
}

function bigrams(s) {
  const set = new Set();
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
  if (s.length === 1) set.add(s);
  return set;
}

function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const sa = bigrams(a), sb = bigrams(b);
  let inter = 0;
  for (const g of sa) if (sb.has(g)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

async function qHash(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).slice(0, 12)
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

async function loadIndex(env) {
  try {
    const raw = await env.KV.get(LEARN_INDEX_KEY);
    const idx = raw ? JSON.parse(raw) : [];
    return Array.isArray(idx) ? idx : [];
  } catch {
    return [];
  }
}

async function findLearned(env, qNorm) {
  const index = await loadIndex(env);
  let best = null, bestSim = 0;
  for (const entry of index) {
    const sim = similarity(qNorm, entry.q);
    if (sim > bestSim) { bestSim = sim; best = entry; }
  }
  if (!best || bestSim < SIMILARITY_THRESHOLD) return null;
  try {
    const raw = await env.KV.get('learn:' + best.k);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function saveLearned(env, question, answer) {
  const qNorm = normalizeQ(question);
  if (qNorm.length < 2 || !answer) return;
  const key = await qHash(qNorm);
  const index = await loadIndex(env);
  const filtered = index.filter(e => e.k !== key);
  filtered.push({ q: qNorm, k: key, ts: Date.now() });
  // LRU: 古い順に上限を超えた分を削除
  filtered.sort((a, b) => a.ts - b.ts);
  const removed = filtered.splice(0, Math.max(0, filtered.length - LEARN_MAX_ENTRIES));
  await Promise.all([
    env.KV.put('learn:' + key, JSON.stringify({ q: question.slice(0, 200), a: answer.slice(0, 1000), score: 0, ts: Date.now() })),
    env.KV.put(LEARN_INDEX_KEY, JSON.stringify(filtered)),
    ...removed.map(e => env.KV.delete('learn:' + e.k)),
  ]);
}

async function applyFeedback(env, question, vote) {
  const qNorm = normalizeQ(question);
  const index = await loadIndex(env);
  let best = null, bestSim = 0;
  for (const entry of index) {
    const sim = similarity(qNorm, entry.q);
    if (sim > bestSim) { bestSim = sim; best = entry; }
  }
  if (!best || bestSim < SIMILARITY_THRESHOLD) return { ok: false };
  const raw = await env.KV.get('learn:' + best.k);
  if (!raw) return { ok: false };
  const item = JSON.parse(raw);
  item.score = (item.score || 0) + (vote === 'up' ? 1 : -1);
  if (item.score <= REMOVE_SCORE) {
    await Promise.all([
      env.KV.delete('learn:' + best.k),
      env.KV.put(LEARN_INDEX_KEY, JSON.stringify(index.filter(e => e.k !== best.k))),
    ]);
    return { ok: true, removed: true };
  }
  await env.KV.put('learn:' + best.k, JSON.stringify(item));
  return { ok: true };
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
- "youtube" は {"title","description","tags"(配列)} で日本語中心。`;

async function handleVideoScript(env, body, origin) {
  const prompt = String(body.prompt || '').slice(0, 600).trim();
  if (!prompt) return new Response('Bad Request: empty prompt', { status: 400 });
  const aspect = String(body.aspect || '16:9');
  const platform = String(body.platform || 'youtube');
  const shortForm = ['shorts', 'tiktok', 'reels'].includes(platform);
  const platformNote = shortForm
    ? `配信先: ${platform}（縦型ショート動画 15〜40秒）。
- 1つ目のシーンは視聴者を一瞬で掴む強いフック(問いかけ・意外な事実・結論先出し)にする。
- シーンは3〜4個に絞り、テンポ良く・話し言葉でキャッチーに。
- narration/subtitleは短く歯切れよく。最後は行動喚起(フォロー/いいね)。
- visualは縦構図(vertical 9:16 composition)を意識した英語プロンプト。`
    : `配信先: ${platform}（横型・通常尺）。落ち着いた分かりやすい構成で4〜6シーン。`;
  const messages = [
    { role: 'system', content: VIDEO_SYSTEM },
    { role: 'user', content: `テーマ:「${prompt}」\nアスペクト比: ${aspect}\n${platformNote}\n上記の絵コンテJSONを出力してください。` },
  ];
  try {
    const text = await runAI(env, messages, { max_tokens: 1536 });
    const json = extractJson(text);
    if (!json || !Array.isArray(json.scenes) || json.scenes.length === 0) {
      return jsonResponse({ error: 'parse_failed', raw: String(text).slice(0, 400) }, origin, 200);
    }
    return jsonResponse({ storyboard: json, source: 'ai' }, origin);
  } catch (e) {
    return jsonResponse({ error: 'ai_error', message: String(e && e.message || e) }, origin, 200);
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
    return jsonResponse({ error: 'image_error', message: String(e && e.message || e) }, origin, 200);
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
    return jsonResponse({ error: 'tts_error', message: String(e && e.message || e) }, origin, 200);
  }
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const isAllowed = ALLOWED_ORIGINS.some(o => origin.startsWith(o));

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(isAllowed ? origin : ''),
      });
    }

    if (!isAllowed) return new Response('Forbidden', { status: 403 });
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    const url = new URL(request.url);
    const hasKV = !!env.KV;

    // ── AI Video Studio エンドポイント ──
    if (url.pathname === '/video/script') return handleVideoScript(env, body, origin);
    if (url.pathname === '/video/image')  return handleVideoImage(env, body, origin);
    if (url.pathname === '/video/tts')    return handleVideoTts(env, body, origin);

    // ── フィードバック受付（👍/👎 → 共有メモリのスコア更新） ──
    if (url.pathname === '/feedback') {
      const { q, vote } = body;
      if (!hasKV || !q || (vote !== 'up' && vote !== 'down')) {
        return jsonResponse({ ok: false }, origin);
      }
      const result = await applyFeedback(env, String(q).slice(0, 500), vote);
      return jsonResponse(result, origin);
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

    // ① 共有学習メモリから類似質問の回答を検索（AI消費ゼロで即答）
    if (hasKV) {
      const learned = await findLearned(env, normalizeQ(userText));
      if (learned && learned.a) {
        return jsonResponse({ text: learned.a, source: 'learned' }, origin);
      }
    }

    // ② AIで回答生成
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    for (const m of (Array.isArray(history) ? history : []).slice(-4)) {
      if (m.role && typeof m.text === 'string') {
        messages.push({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.text.slice(0, 500),
        });
      }
    }
    messages.push({ role: 'user', content: userText });

    try {
      const text = await runAI(env, messages);
      // ③ 回答を共有メモリへ保存（AI生成回答のみ保存＝汚染対策）
      if (hasKV && text) {
        ctx.waitUntil(saveLearned(env, userText, text.trim()).catch(() => {}));
      }
      return jsonResponse({ text, source: 'ai' }, origin);
    } catch (e) {
      return new Response('AI error: ' + e.message, { status: 502 });
    }
  },
};

function jsonResponse(obj, origin, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
