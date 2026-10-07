#!/usr/bin/env node
// AI最新ニュースをRSSから取得して data/ai-news.json に書く（毎朝7:00 JST の GitHub Actions から実行）。
// ブラウザ側の無料CORSプロキシは落ちやすく「取得できませんでした」になるため、サーバ側で取って静的配信する。
// 1つでも取れれば成功。全滅したときは既存のJSONを上書きせず exit 1（古い記事を空で潰さない）。
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../data/ai-news.json');
const SOURCES = [
  { name: 'ITmedia AI+', url: 'https://rss.itmedia.co.jp/rss/2.0/ait.xml' },
  { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/' },
  { name: 'The Verge AI', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
];
const PER_SOURCE = 5;
const MAX_ITEMS = 8;

const decode = s => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#0?39;|&apos;/g, "'").replace(/&#8217;/g, '’').replace(/&amp;/g, '&')
  .replace(/<[^>]+>/g, '').trim();

const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decode(m[1]) : '';
};

function parse(xml, source) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return blocks.slice(0, PER_SOURCE).map(b => {
    let link = tag(b, 'link');
    if (!link) link = (b.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || '';
    const date = tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated');
    const t = Date.parse(date);
    return { title: tag(b, 'title'), link, pubDate: Number.isNaN(t) ? '' : new Date(t).toISOString(), source };
  }).filter(i => i.title && /^https?:\/\//i.test(i.link));
}

async function fetchSource({ name, url }) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (hide-portfolio ai-news bot)', Accept: 'application/rss+xml, application/xml, text/xml, */*' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const items = parse(await res.text(), name);
    if (!items.length) throw new Error('記事0件');
    console.log(`✅ ${name}: ${items.length}件`);
    return items;
  } catch (e) {
    console.log(`⚠ ${name}: ${e.message}`);
    return [];
  }
}

const all = (await Promise.all(SOURCES.map(fetchSource))).flat();
all.sort((a, b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0));
const seen = new Set();
const items = all.filter(i => { const k = i.title.slice(0, 40); return seen.has(k) ? false : (seen.add(k), true); }).slice(0, MAX_ITEMS);

if (!items.length) { console.error('❌ 全ソース取得失敗。既存のJSONは変更しません'); process.exit(1); }

const next = { updated: new Date().toISOString(), items };
let prev = null;
try { prev = JSON.parse(await readFile(OUT, 'utf8')); } catch {}
if (prev && JSON.stringify(prev.items) === JSON.stringify(items)) { console.log('変更なし'); process.exit(0); }
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(next, null, 2) + '\n');
console.log(`書き出し: ${items.length}件 → data/ai-news.json`);
