const ALLOWED_ORIGIN = 'https://hifukasawa77-lgtm.github.io';
const MAX_SOURCE_CHARS = 8000;
const MAX_SOURCES = 5;
const MAX_TOTAL_CHARS = 20000;
const MODEL = '@cf/qwen/qwen2.5-72b-instruct';

function corsHeaders(origin) {
  const allowed = origin === ALLOWED_ORIGIN || origin === 'http://127.0.0.1:5500' || origin?.startsWith('http://localhost');
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function buildPrompt(text, mode) {
  if (mode === 'summary') {
    return `以下のソース文書を日本語で要約してください。
・文書の主要な内容を3〜5段落で簡潔にまとめる
・重要な事実・データ・主張を含める
・読みやすく自然な文章で記述する

【ソース文書】
${text}`;
  }
  return `以下のソース文書のアウトラインをマークダウン形式で作成してください。
・## 見出し で主要チャプターを示す
・各チャプター下に - 箇条書きで要点を列挙する
・重要な概念・定義・データは明示する

【ソース文書】
${text}`;
}

async function runAI(env, prompt) {
  const res = await env.AI.run(MODEL, {
    messages: [{ role: 'user', content: prompt }],
  });
  return res?.response ?? '';
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? '';
    const headers = { ...corsHeaders(origin), 'Content-Type': 'application/json' };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
    }

    const { sources, mode } = body ?? {};
    if (!Array.isArray(sources) || sources.length === 0) {
      return new Response(JSON.stringify({ error: 'sources must be a non-empty array' }), { status: 400, headers });
    }
    if (!['summary', 'outline', 'both'].includes(mode)) {
      return new Response(JSON.stringify({ error: 'mode must be summary, outline, or both' }), { status: 400, headers });
    }
    if (sources.length > MAX_SOURCES) {
      return new Response(JSON.stringify({ error: `Max ${MAX_SOURCES} sources allowed` }), { status: 400, headers });
    }

    const truncated = sources.map(s => (typeof s === 'string' ? s : '').slice(0, MAX_SOURCE_CHARS));
    const combined = truncated.join('\n\n---\n\n').slice(0, MAX_TOTAL_CHARS);

    try {
      const result = {};
      if (mode === 'summary' || mode === 'both') {
        result.summary = await runAI(env, buildPrompt(combined, 'summary'));
      }
      if (mode === 'outline' || mode === 'both') {
        result.outline = await runAI(env, buildPrompt(combined, 'outline'));
      }
      return new Response(JSON.stringify(result), { status: 200, headers });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'AI generation failed', detail: String(err) }), { status: 500, headers });
    }
  },
};
