// Regenerate with: node scripts/security-csp.mjs --write
// Hashes use HTML-parser newline normalization, independent of Git CRLF settings.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
export const pages = ['index.html', 'blog.html', 'blog-post.html', 'dashboard.html', 'cloudflare-worker/admin.html'];
export function securePage(html, page) {
  const hashes = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .filter(m => !/\bsrc\s*=/i.test(m[1]) && m[2].trim())
    .map(m => "'sha256-" + createHash('sha256').update(m[2].replace(/\r\n?/g, '\n')).digest('base64') + "'");
  const external = page === 'index.html'
    ? ' https://accounts.google.com/gsi/client https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js' : '';
  // Public data widgets retain HTTPS data providers; script execution is restricted
  // separately. CORS proxies remain a documented trust dependency.
  const policy = ["default-src 'self'", "base-uri 'none'", "object-src 'none'", "form-action 'none'",
    "script-src 'self' " + hashes.join(' ') + external, "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'" + (page === 'index.html' ? ' https://fonts.googleapis.com https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css https://accounts.google.com/gsi/style' : ''),
    "font-src 'self' https://fonts.gstatic.com", "img-src 'self' data: https:",
    (page === 'blog.html' || page === 'blog-post.html') ? "connect-src 'self'" : "connect-src 'self' https:",
    page === 'index.html' ? 'frame-src https://accounts.google.com https://www.gstatic.com https://embed.windy.com' : "frame-src 'none'",
    "worker-src 'self'", 'upgrade-insecure-requests'].join('; ') + ';';
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
  if (/\s*<meta\b[^>]*http-equiv="Content-Security-Policy"[^>]*>/i.test(html)) {
    html = html.replace(/<meta\b[^>]*http-equiv="Content-Security-Policy"[^>]*>/i, meta);
  } else {
    html = html.replace(/(<meta charset="UTF-8"\s*\/?>)/i, '$1\n' + meta);
  }
  if (!/<meta name="referrer"/i.test(html)) html = html.replace(meta, meta + '\n<meta name="referrer" content="no-referrer">');
  return html;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let failed = false;
  for (const page of pages) {
    const file = new URL(page, root);
    const original = fs.readFileSync(file, 'utf8');
    const expected = securePage(original, page);
    if (original !== expected) {
      if (process.argv.includes('--write')) fs.writeFileSync(file, expected);
      else { console.error(`${page}: CSP stale; run node scripts/security-csp.mjs --write`); failed = true; }
    }
  }
  if (failed) process.exitCode = 1;
  else console.log(`CSP verified: ${pages.length} pages`);
}
