#!/usr/bin/env node
/*
 * verify-social-posts.mjs — SNS自動投稿の事前検査。
 *
 * X/Instagramへの投稿は認証情報が無いと実行できず、本番で初めて失敗が分かる。
 * 「認証情報なしでも確かめられること」はすべてここで機械検査する。
 *
 *   1. OAuth 1.0a 署名アルゴリズムが正しいか（X公式ドキュメントのテストベクタと突き合わせ）
 *   2. X投稿が280文字以内か（URLは23文字換算）
 *   3. Instagramキャプションが2200文字以内か
 *   4. Instagram投稿が参照する画像が実在するか（Metaは公開URLから取りに来るので実体が必須）
 *   5. 投稿文がゲーム本数の実データと矛盾していないか（古い件数の焼き付き防止）
 *
 * 使い方: node scripts/verify-social-posts.mjs
 * 終了コード: 問題なし=0 / 問題あり=1
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const social = require(path.join(ROOT, 'scripts', 'post-social.js'));

let fail = 0;
const ok   = (m) => console.log(`  ✓ ${m}`);
const bad  = (m) => { console.log(`  ✗ ${m}`); fail = 1; };

// ── 1. OAuth 1.0a 署名 ─────────────────────────────────────
// X（Twitter）公式ドキュメントの署名例。パラメータと期待値が公開されているので突き合わせられる。
console.log('== 1. OAuth 1.0a 署名アルゴリズム ==');
{
  const params = {
    include_entities: 'true',
    oauth_consumer_key: 'xvz1evFS4wEEPTGEFPHBog',
    oauth_nonce: 'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg',
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: '1318622958',
    oauth_token: '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb',
    oauth_version: '1.0',
    status: 'Hello Ladies + Gentlemen, a signed OAuth request!',
  };
  const enc = social.percentEncode;
  const paramString = Object.keys(params).sort()
    .map(k => `${enc(k)}=${enc(params[k])}`).join('&');
  const base = ['POST', enc('https://api.twitter.com/1.1/statuses/update.json'), enc(paramString)].join('&');
  const key = `${enc('kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw')}&${enc('LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE')}`;
  const sig = crypto.createHmac('sha1', key).update(base).digest('base64');
  const expected = 'hCtSmYh+iHYCEqBWrE7C7hYmtUk=';
  if (sig === expected) ok('署名がX公式のテストベクタと一致');
  else bad(`署名不一致: ${sig} ≠ ${expected}（percentEncode か署名ベース文字列の組み立てが誤り）`);

  // ヘッダ生成が例外なく通り、必須項目を含むか
  const header = social.oauth1Header({
    method: 'POST', url: 'https://api.x.com/2/tweets',
    consumerKey: 'k', consumerSecret: 's', token: 't', tokenSecret: 'ts',
  });
  const missing = ['oauth_consumer_key', 'oauth_nonce', 'oauth_signature_method',
                   'oauth_timestamp', 'oauth_token', 'oauth_version', 'oauth_signature']
    .filter(k => !header.includes(k));
  if (missing.length === 0) ok('Authorizationヘッダに必須項目が揃っている');
  else bad(`Authorizationヘッダに不足: ${missing.join(', ')}`);
}

// ── 2. X の文字数 ────────────────────────────────────────
console.log('== 2. X投稿の文字数（280・URLは23文字換算）==');
for (const [i, text] of social.X_POSTS.entries()) {
  const weighted = text.replace(/https?:\/\/\S+/g, 'x'.repeat(23)).length;
  if (weighted <= 280) ok(`X-${i + 1}: ${weighted}/280`);
  else bad(`X-${i + 1}: ${weighted}/280 超過`);
}

// ── 3〜4. Instagram ──────────────────────────────────────
console.log('== 3. Instagramキャプションの文字数（2200）==');
for (const [i, p] of social.INSTAGRAM_POSTS.entries()) {
  if (p.caption.length <= 2200) ok(`IG-${i + 1}: ${p.caption.length}/2200`);
  else bad(`IG-${i + 1}: ${p.caption.length}/2200 超過`);
}

console.log('== 4. Instagram画像の実在（Metaは公開URLから取得する）==');
for (const [i, p] of social.INSTAGRAM_POSTS.entries()) {
  for (const img of p.images) {
    const abs = path.join(ROOT, 'assets', 'marketing', img);
    if (existsSync(abs)) {
      if (img.toLowerCase().endsWith('.jpg') || img.toLowerCase().endsWith('.jpeg')) ok(`IG-${i + 1}: ${img}`);
      else bad(`IG-${i + 1}: ${img} はJPEGでない（Graph APIはJPEGのみ受け付ける）`);
    } else {
      bad(`IG-${i + 1}: ${img} が assets/marketing/ に無い（投稿時にMetaが取得できず失敗する）`);
    }
  }
}

// ── 5. 件数の焼き付き ────────────────────────────────────
console.log('== 5. 投稿文のゲーム本数が実データと一致するか ==');
{
  const { GAMES } = require(path.join(ROOT, 'assets', 'js', 'agent-data.js'));
  const actual = GAMES.length;
  const all = [...social.X_POSTS, ...social.BLUESKY_POSTS,
               ...social.INSTAGRAM_POSTS.map(p => p.caption),
               ...social.REDDIT_POSTS.map(p => p.title)].join('\n');
  // 「総数」を名乗っている書き方だけを対象にする。
  // 「ボードゲーム20本」「歴史シミュレーション4本」のようなカテゴリ件数は総数ではないので拾わない。
  const TOTAL_CLAIM_PATTERNS = [
    /本格ゲームを\s*(\d+)\s*本/g,
    /ゲームを\s*(\d+)\s*本\s*作りました/g,
    /ゲームを\s*(\d+)\s*本[、,]?\s*無料公開/g,
    /(\d+)\s*本収録/g,
    /(\d+)\+?\s*(?:free\s+)?browser games/gi,
  ];
  const claims = TOTAL_CLAIM_PATTERNS.flatMap(re => [...all.matchAll(re)].map(m => Number(m[1])));
  if (claims.length === 0) bad('総数を名乗る記載が1つも見つからない（検査が空振りしている可能性）');
  const wrong = [...new Set(claims.filter(n => n !== actual))];
  if (wrong.length === 0) ok(`本数の記載はすべて実データ（${actual}本）と一致`);
  else bad(`実データ ${actual}本 と食い違う記載: ${wrong.join(', ')}（marketing/social_*.md も併せて直す）`);
}

console.log('');
console.log(fail ? '==> verify-social-posts: 問題あり ❌' : '==> verify-social-posts: 問題なし ✅');
process.exit(fail);
