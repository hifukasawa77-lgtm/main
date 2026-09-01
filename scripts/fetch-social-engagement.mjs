#!/usr/bin/env node
/*
 * fetch-social-engagement.mjs — marketing/post-log.json に記録された過去の投稿について、
 * 各SNSの公開反応（いいね数・リポスト数・返信数など）を取得し、履歴として書き戻す。
 *
 * marketer-evolve（週次の学習ループ）が「どの文面・どのゲームが効いたか」を判断する
 * 材料にする。認証情報が無いプラットフォームは黙ってスキップする（post-social.js と同じ方針）。
 *
 * 使い方: node scripts/fetch-social-engagement.mjs [--since=YYYY-MM-DD]
 *   --since … このISO日付以降に投稿されたログのみ対象にする（省略時は全件）
 *
 * 副作用: marketing/post-log.json の各エントリに `metricsHistory`（スナップショット配列）を追記する。
 * 集計結果（ゲーム別・パターン別の反応サマリー）を標準出力にも表示する。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { oauth1Header } from './post-social.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOG_PATH = path.join(ROOT, 'marketing', 'post-log.json');

const sinceArg = process.argv.find(a => a.startsWith('--since='));
const SINCE = sinceArg ? new Date(sinceArg.split('=')[1]) : null;

function loadLog() {
  if (!existsSync(LOG_PATH)) return [];
  try { return JSON.parse(readFileSync(LOG_PATH, 'utf8')); } catch (e) { return []; }
}

function saveLog(log) {
  writeFileSync(LOG_PATH, JSON.stringify(log, null, 2) + '\n');
}

async function fetchX(entry) {
  const consumerKey = process.env.X_API_KEY, consumerSecret = process.env.X_API_SECRET;
  const token = process.env.X_ACCESS_TOKEN, tokenSecret = process.env.X_ACCESS_TOKEN_SECRET;
  if (!consumerKey || !consumerSecret || !token || !tokenSecret || !entry.tweetId) return null;
  const url = `https://api.x.com/2/tweets/${entry.tweetId}?tweet.fields=public_metrics`;
  const res = await fetch(url, {
    headers: { Authorization: oauth1Header({ method: 'GET', url, consumerKey, consumerSecret, token, tokenSecret }) },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const m = data.data?.public_metrics;
  if (!m) return null;
  return { likes: m.like_count, reposts: m.retweet_count, replies: m.reply_count, impressions: m.impression_count };
}

async function fetchBluesky(entry) {
  if (!entry.uri) return null;
  // 公開読み取りAPI。投稿者本人の認証は不要（誰でも閲覧できる公開情報のため）
  const res = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts?uris=${encodeURIComponent(entry.uri)}`);
  if (!res.ok) return null;
  const data = await res.json();
  const post = data.posts?.[0];
  if (!post) return null;
  return { likes: post.likeCount ?? 0, reposts: post.repostCount ?? 0, replies: post.replyCount ?? 0 };
}

async function fetchReddit(entry) {
  if (!entry.redditName) return null;
  // 公開読み取りAPI（api/info はOAuth不要で閲覧できる）
  const res = await fetch(`https://api.reddit.com/api/info?id=${entry.redditName}`, {
    headers: { 'User-Agent': 'hide-room-bot/1.0' },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const post = data.data?.children?.[0]?.data;
  if (!post) return null;
  return { score: post.score, comments: post.num_comments, upvoteRatio: post.upvote_ratio };
}

async function fetchInstagram(entry) {
  const token = process.env.IG_ACCESS_TOKEN;
  if (!token || !entry.mediaId) return null;
  const res = await fetch(`https://graph.facebook.com/v21.0/${entry.mediaId}?fields=like_count,comments_count&access_token=${token}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.error) return null;
  return { likes: data.like_count ?? 0, comments: data.comments_count ?? 0 };
}

const FETCHERS = { x: fetchX, bluesky: fetchBluesky, reddit: fetchReddit, instagram: fetchInstagram };

function engagementScore(metrics) {
  if (!metrics) return null;
  return (metrics.likes ?? 0) + (metrics.reposts ?? 0) * 2 + (metrics.replies ?? 0) * 2
    + (metrics.score ?? 0) + (metrics.comments ?? 0) * 2;
}

async function main() {
  const log = loadLog();
  const targets = log.filter(e => !SINCE || new Date(e.postedAt) >= SINCE);
  if (targets.length === 0) {
    console.log('対象の投稿ログが無い（まだ何も投稿していないか、--since で絞りすぎ）');
    return;
  }

  let fetched = 0, skipped = 0;
  for (const entry of targets) {
    const fetcher = FETCHERS[entry.platform];
    if (!fetcher) continue;
    let metrics;
    try {
      metrics = await fetcher(entry);
    } catch (e) {
      console.log(`⚠️  ${entry.platform}/${entry.contentId}: 取得失敗（${e.message}）`);
      continue;
    }
    if (!metrics) { skipped++; continue; }
    entry.metricsHistory = entry.metricsHistory || [];
    entry.metricsHistory.push({ fetchedAt: new Date().toISOString(), ...metrics });
    fetched++;
  }
  saveLog(log);
  console.log(`✅ ${fetched}件の反応を取得（認証情報/ID不足でスキップ: ${skipped}件）`);

  // ── サマリー（marketer-evolve が読む想定の簡易ランキング）─────
  const withScore = log
    .filter(e => e.metricsHistory?.length > 0)
    .map(e => ({
      contentId: e.contentId, platform: e.platform, gameSlug: e.gameSlug,
      latest: e.metricsHistory[e.metricsHistory.length - 1],
      score: engagementScore(e.metricsHistory[e.metricsHistory.length - 1]),
    }))
    .sort((a, b) => b.score - a.score);

  if (withScore.length > 0) {
    console.log('\n== 反応スコア上位5件 ==');
    for (const e of withScore.slice(0, 5)) console.log(`  ${e.score.toFixed(1)}  ${e.platform}/${e.contentId}${e.gameSlug ? ` (${e.gameSlug})` : ''}`);
    console.log('== 反応スコア下位5件 ==');
    for (const e of withScore.slice(-5)) console.log(`  ${e.score.toFixed(1)}  ${e.platform}/${e.contentId}${e.gameSlug ? ` (${e.gameSlug})` : ''}`);
  }
}

main();
