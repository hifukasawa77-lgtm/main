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

async function runAI(env, messages) {
  let lastError = null;
  for (const model of MODELS) {
    try {
      const result = await env.AI.run(model, { messages });
      const text = result?.choices?.[0]?.message?.content || result?.response || '';
      if (text) return text;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error('all models failed');
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

function jsonResponse(obj, origin) {
  return new Response(JSON.stringify(obj), {
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
