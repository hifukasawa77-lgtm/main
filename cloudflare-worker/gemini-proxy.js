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
 * シークレット（任意）:
 *   ADMIN_TOKEN — /admin/* エンドポイントの認証トークン。未設定ならadminは404
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
const LEARN_MAX_ENTRIES = 400;
const SIMILARITY_THRESHOLD = 0.75;
const REMOVE_SCORE = -2; // 👎が積み重なってこの値以下になったら削除
const MIN_QUERY_LEN = 2; // 短すぎる質問は誤マッチを防ぐため学習メモリ対象外

function normalizeQ(s) {
  return (s || '').toLowerCase()
    .replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[\s、。！？!?.,]+/g, '')
    .trim();
}

// 表記ゆれ吸収: 文末の決まり文句（教えて/ください/ですか等）や末尾助詞を除去してから比較する。
// 「ドル円教えて」と「今日のドル円のレートを教えてください」のような言い換えでもヒットしやすくする。
const TRAILING_PHRASES = [
  '教えてください', '教えてくれる', '教えてもらえる', '教えて',
  'お願いします', 'おねがいします', 'ください', 'でしょうか',
  'ですか', 'かな', 'かしら', 'です', 'ます',
];

function canonicalizeQ(qNorm) {
  let s = qNorm;
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 5) {
    changed = false;
    for (const p of TRAILING_PHRASES) {
      if (s.length > p.length && s.endsWith(p)) {
        s = s.slice(0, -p.length).replace(/[をのはがにでもと]+$/g, '');
        changed = true;
        break;
      }
    }
  }
  return s.length >= 1 ? s : qNorm;
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
  if (sa.size === 0 || sb.size === 0) return 0;
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

async function saveIndex(env, index) {
  await env.KV.put(LEARN_INDEX_KEY, JSON.stringify(index));
}

// インデックス内から最も似ている質問を探す（正規化＋表記ゆれ吸収後の文字列で比較）
function findBestMatch(index, qCanon) {
  if (qCanon.length < MIN_QUERY_LEN) return null;
  let best = null, bestSim = 0;
  for (const entry of index) {
    const sim = similarity(qCanon, entry.q);
    if (sim > bestSim) { bestSim = sim; best = entry; }
  }
  if (!best || bestSim < SIMILARITY_THRESHOLD) return null;
  return best;
}

async function findLearned(env, ctx, qCanon) {
  const index = await loadIndex(env);
  const best = findBestMatch(index, qCanon);
  if (!best) return null;
  const raw = await env.KV.get('learn:' + best.k);
  if (!raw) return null;
  const item = JSON.parse(raw);
  if (!item.a) return null;
  // 利用統計（ヒット数・最終利用時刻）の更新はレスポンスをブロックしない
  ctx.waitUntil(touchLearned(env, index, best.k, item));
  return { key: best.k, text: item.a };
}

async function touchLearned(env, index, key, item) {
  const now = Date.now();
  item.hits = (item.hits || 0) + 1;
  item.lastUsed = now;
  const entry = index.find(e => e.k === key);
  if (entry) { entry.hits = item.hits; entry.lastUsed = now; }
  await Promise.all([
    env.KV.put('learn:' + key, JSON.stringify(item)),
    saveIndex(env, index),
  ]);
}

// AIが生成した回答を学習メモリへ保存。容量超過時は「価値（評価×10＋利用回数）が低く
// 最近使われていない」エントリから削除する（鮮度・有用性ベースの入れ替え）。
async function saveLearned(env, key, qCanon, question, answer) {
  const index = await loadIndex(env);
  const now = Date.now();
  const filtered = index.filter(e => e.k !== key);
  filtered.push({ q: qCanon, k: key, ts: now, score: 0, hits: 0, lastUsed: now });

  let removedKeys = [];
  if (filtered.length > LEARN_MAX_ENTRIES) {
    const overflow = filtered.length - LEARN_MAX_ENTRIES;
    const sorted = [...filtered].sort((a, b) => {
      const va = (a.score || 0) * 10 + (a.hits || 0);
      const vb = (b.score || 0) * 10 + (b.hits || 0);
      if (va !== vb) return va - vb;
      return (a.lastUsed || a.ts || 0) - (b.lastUsed || b.ts || 0);
    });
    removedKeys = sorted.filter(e => e.k !== key).slice(0, overflow).map(e => e.k);
    const removeSet = new Set(removedKeys);
    for (let i = filtered.length - 1; i >= 0; i--) {
      if (removeSet.has(filtered[i].k)) filtered.splice(i, 1);
    }
  }

  await Promise.all([
    env.KV.put('learn:' + key, JSON.stringify({
      q: question.slice(0, 200), a: answer.slice(0, 1000),
      score: 0, hits: 0, ts: now, lastUsed: now,
    })),
    saveIndex(env, filtered),
    ...removedKeys.map(k => env.KV.delete('learn:' + k)),
  ]);
}

// 👍/👎 フィードバック。response の key を使って直接エントリを更新する（精度優先）。
// key 不明（旧クライアント）の場合のみ質問文の類似検索でフォールバックする。
async function applyFeedback(env, key, qFallback, vote) {
  const index = await loadIndex(env);
  let entry = key ? index.find(e => e.k === key) : null;
  if (!entry && qFallback) {
    entry = findBestMatch(index, canonicalizeQ(normalizeQ(qFallback)));
  }
  if (!entry) return { ok: false };

  const raw = await env.KV.get('learn:' + entry.k);
  if (!raw) return { ok: false };
  const item = JSON.parse(raw);
  item.score = (item.score || 0) + (vote === 'up' ? 1 : -1);
  entry.score = item.score;

  if (item.score <= REMOVE_SCORE) {
    const filtered = index.filter(e => e.k !== entry.k);
    await Promise.all([
      env.KV.delete('learn:' + entry.k),
      saveIndex(env, filtered),
    ]);
    return { ok: true, removed: true };
  }
  await Promise.all([
    env.KV.put('learn:' + entry.k, JSON.stringify(item)),
    saveIndex(env, index),
  ]);
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
- "youtube" は {"title","description","tags"(配列)} で日本語中心。
- 参考情報(調べた事実)が与えられた場合は、その事実を要約してnarrationに正確に反映し、創作・誤情報を避ける。プロンプトのオウム返しは禁止。`;

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
  const messages = [
    { role: 'system', content: VIDEO_SYSTEM },
    { role: 'user', content: `テーマ:「${prompt}」\nアスペクト比: ${aspect}\n${platformNote}${factBlock}\n上記の絵コンテJSONを出力してください。` },
  ];
  try {
    const text = await runAI(env, messages, { max_tokens: 1536 });
    const json = extractJson(text);
    if (!json || !Array.isArray(json.scenes) || json.scenes.length === 0) {
      return jsonResponse({ error: 'parse_failed', raw: String(text).slice(0, 400) }, origin, 200);
    }
    return jsonResponse({ storyboard: json, research: research ? { title: research.title, url: research.url } : null, source: 'ai' }, origin);
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
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      if (url.pathname.startsWith('/admin/')) {
        return new Response(null, { status: 204, headers: adminCorsHeaders() });
      }
      return new Response(null, {
        status: 204,
        headers: corsHeaders(isAllowed ? origin : ''),
      });
    }

    // ── 管理エンドポイント（ADMIN_TOKENトークンで認可、Origin制限なし） ──
    if (url.pathname.startsWith('/admin/')) {
      return handleAdmin(request, env, url);
    }

    if (!isAllowed) return new Response('Forbidden', { status: 403 });
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    const hasKV = !!env.KV;

    // ── AI Video Studio エンドポイント ──
    if (url.pathname === '/video/script') return handleVideoScript(env, body, origin);
    if (url.pathname === '/video/image')  return handleVideoImage(env, body, origin);
    if (url.pathname === '/video/tts')    return handleVideoTts(env, body, origin);

    // ── フィードバック受付（👍/👎 → 共有メモリのスコア更新） ──
    if (url.pathname === '/feedback') {
      const { q, vote, key } = body;
      if (!hasKV || (vote !== 'up' && vote !== 'down') || (!key && !q)) {
        return jsonResponse({ ok: false }, origin);
      }
      const result = await applyFeedback(
        env,
        typeof key === 'string' ? key : null,
        q ? String(q).slice(0, 500) : null,
        vote,
      );
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
    const qCanon = canonicalizeQ(normalizeQ(userText));

    // ① 共有学習メモリから類似質問の回答を検索（AI消費ゼロで即答）
    if (hasKV) {
      const learned = await findLearned(env, ctx, qCanon);
      if (learned) {
        return jsonResponse({ text: learned.text, source: 'learned', key: learned.key }, origin);
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
      // ③ 回答を共有メモリへ保存（AI生成回答のみ保存＝汚染対策）。レスポンスはブロックしない
      let key = null;
      if (hasKV && text && qCanon.length >= MIN_QUERY_LEN) {
        key = await qHash(qCanon);
        ctx.waitUntil(saveLearned(env, key, qCanon, userText, text.trim()).catch(() => {}));
      }
      return jsonResponse({ text, source: 'ai', key }, origin);
    } catch (e) {
      return new Response('AI error: ' + e.message, { status: 502 });
    }
  },
};

// ── 管理API: 学習エントリの閲覧・削除（ADMIN_TOKEN必須） ──
async function handleAdmin(request, env, url) {
  if (!env.ADMIN_TOKEN) return new Response('Not Found', { status: 404 });
  const token = request.headers.get('X-Admin-Token') || url.searchParams.get('token') || '';
  if (token !== env.ADMIN_TOKEN) {
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
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function adminCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
  };
}
