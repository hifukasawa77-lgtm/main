#!/usr/bin/env node
// ローカルPC（自宅ネットワーク）で一度だけ実行し、Garmin ConnectのOAuthトークンを取得して
// GitHub Secrets（GARMIN_TOKENS）に貼り付けるための文字列を出力するヘルパー。
//
// 背景: GitHub Actionsの共有IPはGarminにレート制限(429)されやすく、Actions上からの
// パスワードログインが通らないことがある。自宅IPで取得したトークンをSecretsで注入すれば、
// Actions上ではログイン不要になる（scripts/fetch-garmin.js が GARMIN_TOKENS を自動展開する）。
//
// 使い方（Node.jsが必要。https://nodejs.org からLTS版をインストール）:
//   1) このリポジトリのフォルダで:  npm install garmin-connect@1.6.2
//   2) 実行:
//      - Windows (PowerShell):
//          $env:GARMIN_EMAIL="メールアドレス"; $env:GARMIN_PASSWORD="パスワード"; node scripts/garmin-login-local.js
//      - macOS / Linux:
//          GARMIN_EMAIL=メールアドレス GARMIN_PASSWORD=パスワード node scripts/garmin-login-local.js
//   3) 出力された1行を GitHub → Settings → Secrets and variables → Actions →
//      New repository secret で Name: GARMIN_TOKENS として登録する。
//
// 注意: 出力はGarminアカウントへのアクセストークンそのもの。チャットやメモに残さず、
// Secretsへ登録したらターミナルの履歴・画面から消すこと。

const { GarminConnect } = require('garmin-connect');

async function main() {
  const email = process.env.GARMIN_EMAIL;
  const password = process.env.GARMIN_PASSWORD;
  if (!email || !password) {
    console.error('GARMIN_EMAIL / GARMIN_PASSWORD を環境変数で指定してください（ファイル冒頭の使い方参照）');
    process.exit(1);
  }

  const client = new GarminConnect({ username: email, password });
  await client.login();
  console.log('ログイン成功。トークンを生成します…');

  const t = client.exportToken();
  const blob = Buffer.from(
    JSON.stringify({ oauth1: t.oauth1, oauth2: t.oauth2 })
  ).toString('base64');

  console.log('');
  console.log('=== 以下の1行をコピーして GitHub Secrets の GARMIN_TOKENS に登録してください ===');
  console.log('');
  console.log(blob);
  console.log('');
  console.log('登録先: https://github.com/hifukasawa77-lgtm/main/settings/secrets/actions');
}

main().catch((err) => {
  console.error('エラー:', err.message);
  process.exit(1);
});
