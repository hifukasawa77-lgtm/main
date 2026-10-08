// Security gate for the Workers: block → record (RFC 5424 syslog line) → notify.
//
// 1. Block before the handler runs:
//    - attack-shaped requests (path traversal, scanner probes, injected markup/SQL in the URL)
//    - IPs that kept getting rejected (ABUSE_LIMITER counts rejections; past the limit the IP
//      is refused for BAN_SECONDS, cached per Cloudflare location — no KV writes an attacker
//      could use to run up usage)
// 2. Record every rejection (the handler's own 401/403/413/415/429 too) as one RFC 5424 line on
//    the Worker log. View with `npx wrangler tail` or the dashboard's Workers Logs
//    ([observability] in wrangler.toml).
// 3. Notify the owner through SECURITY_ALERT_WEBHOOK_URL (a Slack Incoming Webhook secret).
//    At most one message per event kind per ALERT_THROTTLE_SECONDS and location, so a flood
//    cannot turn into a flood of messages; the log still keeps every event.
//
// Pages also report what only the browser can see (a CSP-blocked script, being framed by
// another site) to POST /security/report — see assets/js/frame-guard.js.
import { SITE_ORIGIN, hardenResponse } from './request-security.js';

export const BAN_SECONDS = 900;
export const ALERT_THROTTLE_SECONDS = 600;
const REPORT_MAX_BYTES = 2048;

// RFC 5424 severities and the authpriv facility (10): security/authorization messages.
export const SEVERITY = { alert: 1, crit: 2, err: 3, warning: 4, notice: 5, info: 6 };
const FACILITY_AUTHPRIV = 10;

// Requests nobody legitimate sends to these Workers. Matched against the decoded path+query.
const ATTACK_PATTERNS = [
  ['path-traversal', /(?:\.\.[\/\\]|%2e%2e|\/etc\/passwd|\\windows\\|\/proc\/self)/i],
  ['scanner-probe', /\/(?:wp-(?:admin|login|content|includes)|xmlrpc\.php|phpmyadmin|\.env|\.git\/|\.aws\/|cgi-bin\/|actuator\/|server-status|vendor\/phpunit|boaform|HNAP1)/i],
  ['markup-injection', /<\s*(?:script|iframe|svg|img)\b|javascript:|on(?:error|load)\s*=/i],
  ['sql-injection', /(?:\bunion\b[\s\S]{0,20}\bselect\b|\bor\b\s+['"]?1['"]?\s*=\s*['"]?1|;\s*drop\s+table|sleep\s*\(\s*\d+\s*\))/i],
  ['template-injection', /\$\{jndi:|\{\{[\s\S]{0,40}\}\}|<%[\s\S]*%>/i],
];

// Which rejections count as hostile and how loud they are.
// Notified: err and worse. warning/notice are logged and count as strikes (bans catch floods)
// but do not page the owner — bots without an Origin header hit 403 all day.
const STATUS_EVENTS = {
  401: ['auth-failure', 'alert'],      // wrong admin token = someone guessing
  403: ['forbidden-origin', 'notice'],
  413: ['oversized-body', 'warning'],
  415: ['bad-content-type', 'notice'],
  429: ['rate-limited', 'warning'],
};
export const NOTIFY_AT_OR_ABOVE = SEVERITY.err;

const now = () => new Date().toISOString();

export function clientIp(request) {
  // Cloudflare sets CF-Connecting-IP; never trust X-Forwarded-For from the client.
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

export function detectAttack(url) {
  let target = url.pathname + url.search;
  try { target += ' ' + decodeURIComponent(target); } catch { target += ' (undecodable)'; }
  for (const [kind, re] of ATTACK_PATTERNS) if (re.test(target)) return kind;
  return null;
}

function sdEscape(value) {
  return String(value ?? '').replace(/[\\"\]]/g, c => '\\' + c).replace(/[\r\n]/g, ' ').slice(0, 300);
}

/** One RFC 5424 line: <PRI>1 TIMESTAMP HOST APP PROCID MSGID [SD] MSG */
export function syslogLine(event) {
  const severity = SEVERITY[event.severity] ?? SEVERITY.warning;
  const pri = FACILITY_AUTHPRIV * 8 + severity;
  const params = ['kind', 'ip', 'method', 'path', 'status', 'origin', 'ua', 'country', 'detail']
    .filter(k => event[k] !== undefined && event[k] !== '')
    .map(k => `${k}="${sdEscape(event[k])}"`).join(' ');
  return `<${pri}>1 ${event.time || now()} ${sdEscape(event.host || '-').replace(/\s/g, '') || '-'} ` +
    `${event.service || 'worker'} - SECURITY [sec@32473 ${params}] ${sdEscape(event.message || event.kind)}`;
}

function emit(event) {
  const line = syslogLine(event);
  const sev = SEVERITY[event.severity] ?? SEVERITY.warning;
  (sev <= SEVERITY.err ? console.error : console.warn)(line);
  return line;
}

function baseEvent(request, service, url) {
  return {
    service, time: now(), host: url.host, ip: clientIp(request), method: request.method,
    path: url.pathname.slice(0, 200), origin: request.headers.get('Origin') || '',
    ua: (request.headers.get('User-Agent') || '').slice(0, 160),
    country: request.cf?.country || '',
  };
}

// ── Ban list (per location, Cache API: free, no write quota to exhaust) ───────────────────
const banKey = ip => `https://security-gate.invalid/ban/${encodeURIComponent(ip)}`;
const throttleKey = kind => `https://security-gate.invalid/alert/${encodeURIComponent(kind)}`;
function edgeCache() {
  try { return globalThis.caches?.default || null; } catch { return null; }
}
async function isBanned(ip) {
  const cache = edgeCache();
  if (!cache || ip === 'unknown') return false;
  try { return !!(await cache.match(banKey(ip))); } catch { return false; }
}
async function ban(ip) {
  const cache = edgeCache();
  if (!cache || ip === 'unknown') return;
  try {
    await cache.put(banKey(ip), new Response('1', { headers: { 'Cache-Control': `max-age=${BAN_SECONDS}` } }));
  } catch { /* banning is best effort; the request itself is already rejected */ }
}

/** Counts one rejection for this IP; true when the IP crossed the abuse limit. */
async function countStrike(env, ip) {
  if (!env.ABUSE_LIMITER || ip === 'unknown') return false;
  try { return !(await env.ABUSE_LIMITER.limit({ key: ip })).success; } catch { return false; }
}

// ── Notification ─────────────────────────────────────────────────────────────────────────
export function maskIp(ip) {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip.replace(/\.\d+$/, '.x');
  if (ip.includes(':')) return ip.split(':').slice(0, 3).join(':') + ':…';
  return ip;
}

export function alertText(event) {
  return [
    `🚨 hideの部屋: 攻撃を検知して遮断しました / Attack blocked (${event.severity})`,
    `種別 kind: ${event.kind}`,
    `対象 target: ${event.method} ${event.host}${event.path}${event.status ? ' → ' + event.status : ''}`,
    `送信元 source: ${maskIp(event.ip)}${event.country ? ' (' + event.country + ')' : ''}`,
    event.detail ? `詳細 detail: ${String(event.detail).slice(0, 200)}` : '',
    `同じ種別の通知は${ALERT_THROTTLE_SECONDS / 60}分間まとめます（ログには全件）`,
  ].filter(Boolean).join('\n');
}

function webhookUrl(env) {
  const raw = env.SECURITY_ALERT_WEBHOOK_URL || '';
  try {
    const u = new URL(raw);
    // Only real webhook hosts: a mistyped secret must not make the Worker POST anywhere.
    if (u.protocol === 'https:' && (u.hostname === 'hooks.slack.com' ||
        (u.hostname === 'discord.com' && u.pathname.startsWith('/api/webhooks/')))) return u.href;
  } catch { /* not configured */ }
  return '';
}

async function notify(env, event) {
  const url = webhookUrl(env);
  if (!url) return false;
  const cache = edgeCache();
  const key = throttleKey(event.kind);
  try { if (cache && await cache.match(key)) return false; } catch { /* fall through and notify */ }
  try {
    if (cache) await cache.put(key, new Response('1', { headers: { 'Cache-Control': `max-age=${ALERT_THROTTLE_SECONDS}` } }));
  } catch { /* ignore */ }
  const text = alertText(event);
  const body = url.includes('discord.com') ? { content: text } : { text };
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(5000) });
    if (!res.ok) emit({ ...event, severity: 'err', kind: 'alert-delivery-failed', detail: `webhook HTTP ${res.status}` });
    return res.ok;
  } catch (e) {
    emit({ ...event, severity: 'err', kind: 'alert-delivery-failed', detail: String(e?.message || e) });
    return false;
  }
}

/** Log, count a strike, maybe ban, maybe notify. Never throws. */
export async function recordEvent(env, ctx, event) {
  emit(event);
  if (event.strike !== false && await countStrike(env, event.ip)) {
    await ban(event.ip);
    const banned = { ...event, kind: 'ip-banned', severity: 'alert',
      detail: `rejected repeatedly; refused for ${BAN_SECONDS / 60} min (last: ${event.kind})` };
    emit(banned);
    schedule(ctx, notify(env, banned));
  }
  const sev = SEVERITY[event.severity] ?? SEVERITY.warning;
  if (sev <= NOTIFY_AT_OR_ABOVE && webhookUrl(env)) schedule(ctx, notify(env, event));
}

function schedule(ctx, promise) {
  if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(promise.catch(() => {}));
  else promise.catch(() => {});
}

function plain(status, message) {
  return new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}

// ── Reports from the site's pages (CSP violations, framing) ─────────────────────────────
const REPORT_KINDS = {
  'csp-violation': 'err',   // a script/frame/object the page did not allow tried to load (XSS attempt)
  'framed': 'err',          // another site put our page in a frame (clickjacking attempt)
};

async function readSmallText(request, maxBytes) {
  if (Number(request.headers.get('Content-Length')) > maxBytes) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let off = 0;
  for (const c of chunks) { bytes.set(c, off); off += c.byteLength; }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return null; }
}

async function handleReport(request, env, ctx, base) {
  // sendBeacon posts text/plain (a CORS "simple" request: no preflight). Only our site may report.
  if (request.method !== 'POST') return plain(405, 'Method Not Allowed');
  if ((request.headers.get('Origin') || '') !== SITE_ORIGIN) {
    await recordEvent(env, ctx, { ...base, kind: 'forged-report', severity: 'notice', status: 403 });
    return plain(403, 'Forbidden');
  }
  const text = await readSmallText(request, REPORT_MAX_BYTES);
  let report = null;
  try { report = text ? JSON.parse(text) : null; } catch { report = null; }
  if (!report || typeof report !== 'object' || !REPORT_KINDS[report.kind]) {
    await recordEvent(env, ctx, { ...base, kind: 'malformed-report', severity: 'notice', status: 400 });
    return plain(400, 'Bad Request');
  }
  const detail = ['page', 'directive', 'blocked', 'source', 'framer']
    .filter(k => typeof report[k] === 'string' && report[k])
    .map(k => `${k}=${report[k].slice(0, 120)}`).join(' ');
  // A report is evidence about someone else, not a strike against the reporting visitor.
  await recordEvent(env, ctx, { ...base, kind: report.kind, severity: REPORT_KINDS[report.kind],
    status: 204, detail, strike: false });
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': SITE_ORIGIN, 'Cache-Control': 'no-store' } });
}

/**
 * Wraps a Worker's default export: ban check → attack filter → handler → log/notify
 * rejections → hardening headers on every reply.
 */
export function withSecurityGate(service, handler) {
  return {
    ...handler,
    async fetch(request, env = {}, ctx) {
      const url = new URL(request.url);
      const base = baseEvent(request, service, url);
      if (await isBanned(base.ip)) {
        // Already logged and notified when the ban started; logging every retry of a flood
        // would only multiply log volume.
        return hardenResponse(plain(403, 'Forbidden'));
      }
      const attack = detectAttack(url);
      if (attack) {
        await recordEvent(env, ctx, { ...base, kind: attack, severity: 'err', status: 403,
          detail: (url.pathname + url.search).slice(0, 200) });
        return hardenResponse(plain(403, 'Forbidden'));
      }
      if (url.pathname === '/security/report') return hardenResponse(await handleReport(request, env, ctx, base));
      let response;
      try {
        response = await handler.fetch(request, env, ctx);
      } catch (e) {
        // Fail closed: an exception must not leak a stack trace or fall through to anything.
        emit({ ...base, kind: 'handler-exception', severity: 'err', status: 500, detail: String(e?.message || e) });
        response = plain(500, 'Internal Server Error');
      }
      const mapped = STATUS_EVENTS[response.status];
      if (mapped) {
        const [kind, severity] = mapped;
        await recordEvent(env, ctx, { ...base, kind: url.pathname.startsWith('/admin/') && response.status === 401 ? 'admin-auth-failure' : kind,
          severity, status: response.status });
      }
      return hardenResponse(response);
    },
  };
}
