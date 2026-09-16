// CORS restricts browser callers; it is not authentication for a public API.
export const SITE_ORIGIN = 'https://hifukasawa77-lgtm.github.io';
export function allowedOrigin(origin, env = {}) {
  if (origin === SITE_ORIGIN) return true;
  if (env.ALLOW_LOCAL_DEV !== 'true') return false;
  try {
    const url = new URL(origin);
    return origin === url.origin && url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch { return false; }
}

export const securityHeaders = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Vary': 'Origin',
};

export function publicHeaders(origin) {
  return { ...securityHeaders,
    ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export function errorResponse(status, error, headers = {}) {
  return new Response(JSON.stringify({ error }), {
    status, headers: { ...securityHeaders, ...headers, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

// Bound streamed bytes before parsing, including chunked bodies without a length.
export async function readJson(request, maxBytes) {
  const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') fail(415, 'JSON content type required');
  if (Number(request.headers.get('Content-Length')) > maxBytes) fail(413, 'Request too large');
  if (!request.body) fail(400, 'Invalid JSON');
  const reader = request.body.getReader();
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); fail(413, 'Request too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let body;
  try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { fail(400, 'Invalid JSON'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'JSON object required');
  return body;
}

// Cloudflare overwrites CF-Connecting-IP. Never use client-provided X-Forwarded-For.
// Missing bindings fail closed so a deployment cannot silently remove the limit.
export async function limitRequest(request, env, headers) {
  if (!env.RATE_LIMITER) return errorResponse(503, 'Rate limiter unavailable', headers);
  try {
    const key = request.headers.get('CF-Connecting-IP') || 'unknown';
    const { success } = await env.RATE_LIMITER.limit({ key });
    if (!success) return errorResponse(429, 'Too many requests', { ...headers, 'Retry-After': '60' });
  } catch { return errorResponse(503, 'Rate limiter unavailable', headers); }
  return null;
}
