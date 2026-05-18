/**
 * AI Agent Proxy — Cloudflare Worker
 *
 * 役割: Workers AI (Gemma 2) を呼び出すプロキシ
 * APIキー不要 — Workers AI バインディングを使用（最もセキュアな構成）
 *
 * 設定方法: README.md を参照
 */

const ALLOWED_ORIGINS = [
  'https://hifukasawa77-lgtm.github.io',
  'http://localhost',
  'http://127.0.0.1',
];

const MODEL = '@cf/google/gemma-4-26b-a4b-it';

const SYSTEM_PROMPT = `あなたは「ヒデのポートフォリオサイト」の案内エージェントです。
サイトオーナーの名前は「ヒデ」です。絶対に「ハイド」と呼ばないでください。「hide」と書かれていても必ず「ヒデ」と読んでください。
ヒデは埼玉県三郷市在住のシステムエンジニアで、Claude AIと共同で23本のブラウザゲーム・AIツールを開発しています。
このサイトではゲーム紹介・三郷市情報・AI開発の話題を扱っています。
返答は日本語で2〜3文以内に簡潔にまとめてください。雑談や一般的な質問にも気軽に答えてください。ゲームの遊び方・おすすめ・AIについての質問が多いです。`;

export default {
  async fetch(request, env) {
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

    const { message, history } = body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response('Bad Request: empty message', { status: 400 });
    }
    if (message.length > 500) {
      return new Response('Bad Request: message too long', { status: 400 });
    }

    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

    for (const m of (Array.isArray(history) ? history : []).slice(-4)) {
      if (m.role && typeof m.text === 'string') {
        messages.push({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.text.slice(0, 500),
        });
      }
    }
    messages.push({ role: 'user', content: message.trim() });

    try {
      const result = await env.AI.run(MODEL, { messages });
      const text = result?.choices?.[0]?.message?.content || result?.response || '';
      return new Response(JSON.stringify({ text }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    } catch (e) {
      return new Response('AI error: ' + e.message, { status: 502 });
    }
  },
};

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
