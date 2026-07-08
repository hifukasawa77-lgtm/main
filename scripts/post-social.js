// Node.js 18+ required (uses native fetch + TextEncoder)

const SITE_URL = 'https://hifukasawa77-lgtm.github.io/main/';

const BLUESKY_POSTS = [
  `将棋・麻雀・バックギャモン・ベルトスクロールアクション・シューティング…\nブラウザだけで遊べる本格ゲームを35本以上無料公開中。インストール不要で今すぐプレイ！\n${SITE_URL}\n#ブラウザゲーム #無料ゲーム #個人開発`,
  `Claude AIとのペアプログラミングだけでブラウザゲームを35本以上作りました。素のHTML/CSS/JavaScript（Canvas API）のみ。フレームワーク・ビルドツール一切なし。\n${SITE_URL}\n#Claude #AI駆動開発 #JavaScript #CanvasAPI`,
  `アプリのインストール不要！ブラウザを開くだけで将棋・麻雀・ポーカー・アクションゲームが全部タダで遊べます。35本以上収録、随時追加中。\n${SITE_URL}\n#暇つぶし #無料ゲーム #ブラウザゲーム #将棋`,
];

const REDDIT_POSTS = [
  { subreddit: 'webgames',   title: '35+ free browser games (shogi, mahjong, backgammon, beat-em-up, shooting) – built with Claude AI + vanilla JS, no install needed' },
  { subreddit: 'javascript', title: 'I built 35+ browser games using only vanilla JS and Canvas API with Claude AI pair programming – no frameworks, no bundlers' },
  { subreddit: 'gamedev',    title: 'Made 35+ browser games with Claude AI as my pair programmer – zero frameworks, pure Canvas API' },
  { subreddit: 'ClaudeAI',  title: 'Built 35+ browser games through Claude AI pair programming – a year of vanilla JS + Canvas API projects' },
];

// Compute UTF-8 byte range for Bluesky richtext facets
function byteRange(text, substr) {
  const enc = new TextEncoder();
  const fullBytes = enc.encode(text);
  const subBytes  = enc.encode(substr);
  outer: for (let i = 0; i <= fullBytes.length - subBytes.length; i++) {
    for (let j = 0; j < subBytes.length; j++) {
      if (fullBytes[i + j] !== subBytes[j]) continue outer;
    }
    return { byteStart: i, byteEnd: i + subBytes.length };
  }
  return null;
}

function buildFacets(text) {
  const facets = [];
  for (const m of text.matchAll(/https?:\/\/\S+/g)) {
    const r = byteRange(text, m[0]);
    if (r) facets.push({ index: r, features: [{ $type: 'app.bsky.richtext.facet#link', uri: m[0] }] });
  }
  for (const m of text.matchAll(/#[^\s#]+/g)) {
    const r = byteRange(text, m[0]);
    if (r) facets.push({ index: r, features: [{ $type: 'app.bsky.richtext.facet#tag', tag: m[0].slice(1) }] });
  }
  return facets;
}

async function postToBluesky(text) {
  const handle   = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_APP_PASSWORD;
  if (!handle || !password) throw new Error('BLUESKY_HANDLE / BLUESKY_APP_PASSWORD not set');

  const authRes = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: handle, password }),
  });
  if (!authRes.ok) throw new Error(`Bluesky auth failed: ${await authRes.text()}`);
  const { accessJwt, did } = await authRes.json();

  const postRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessJwt}` },
    body: JSON.stringify({
      repo: did,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text,
        facets: buildFacets(text),
        createdAt: new Date().toISOString(),
      },
    }),
  });
  if (!postRes.ok) throw new Error(`Bluesky post failed: ${await postRes.text()}`);
  console.log(`✅ Bluesky posted: ${(await postRes.json()).uri}`);
}

async function postToReddit({ subreddit, title }) {
  const clientId     = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const username     = process.env.REDDIT_USERNAME;
  const password     = process.env.REDDIT_PASSWORD;
  if (!clientId || !clientSecret) throw new Error('Reddit credentials not set');

  const tokenRes = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'hide-room-bot/1.0',
    },
    body: `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
  });
  if (!tokenRes.ok) throw new Error(`Reddit auth failed: ${await tokenRes.text()}`);
  const { access_token } = await tokenRes.json();

  const submitRes = await fetch('https://oauth.reddit.com/api/submit', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${access_token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'hide-room-bot/1.0',
    },
    body: new URLSearchParams({ kind: 'link', sr: subreddit, title, url: SITE_URL, resubmit: 'false' }).toString(),
  });
  const data = await submitRes.json();
  if (data.json?.errors?.length) throw new Error(`Reddit error: ${JSON.stringify(data.json.errors)}`);
  console.log(`✅ Reddit r/${subreddit}: posted`);
}

async function main() {
  const platform  = process.argv[2];
  const weekIndex = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)) % BLUESKY_POSTS.length;
  const monthIndex = new Date().getMonth() % REDDIT_POSTS.length;

  if (platform === 'bluesky') {
    console.log(`Posting to Bluesky (pattern ${weekIndex + 1}/${BLUESKY_POSTS.length})...`);
    await postToBluesky(BLUESKY_POSTS[weekIndex]);
  } else if (platform === 'reddit') {
    const target = REDDIT_POSTS[monthIndex];
    console.log(`Posting to Reddit r/${target.subreddit}...`);
    await postToReddit(target);
  } else {
    console.error('Usage: node scripts/post-social.js <bluesky|reddit>');
    process.exit(1);
  }
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
