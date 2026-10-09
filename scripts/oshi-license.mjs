#!/usr/bin/env node
/*
 * oshi-license.mjs — 推し活ログ Pro のライセンスキー発行ツール（深澤のPCで使う）
 *
 *   node scripts/oshi-license.mjs init                 # 鍵ペアを作る（最初の1回だけ）。公開鍵を assets/js/oshi-pro.js へ書き込む
 *   node scripts/oshi-license.mjs issue --lot 2026-10   # キーを1本発行して表示
 *   node scripts/oshi-license.mjs issue --lot 2026-10 --booth   # BOOTHでダウンロード配布する説明書き（txt）も作る
 *   node scripts/oshi-license.mjs verify <キー>          # キーが正しいか確かめる（ページと同じ検証コードを通す）
 *   node scripts/oshi-license.mjs revoke <ID>           # キーを無効化する（oshi-pro.js の REVOKED_IDS に足す→コミットして公開）
 *
 * ■ 秘密鍵はリポジトリに置かない
 *   既定の保存先は ~/.oshikatsu-pro/private.jwk（--keydir で変更可）。**これを失うと新しいキーを発行できない**。
 *   USBメモリやパスワード管理ソフトへ控えを取ること。漏れたら誰でもキーを作れるので、init --force で作り直す
 *   （そのときは既に売ったキーが全部無効になる。購入者へ新しいキーを配り直す必要がある）。
 *
 * ■ 鍵を作り直すと、販売済みのキーが全部効かなくなる
 *   init は公開鍵が既に入っていると止まる。--force を付けたときだけ上書きする。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODULE = path.join(ROOT, 'assets/js/oshi-pro.js');
const OshiPro = require(MODULE);
const subtle = webcrypto.subtle;

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def; };
const flag = (name) => args.includes(name);
const KEYDIR = opt('--keydir', path.join(os.homedir(), '.oshikatsu-pro'));
const PRIV = path.join(KEYDIR, 'private.jwk');

function die(msg) { console.error('✗ ' + msg); process.exit(1); }
function currentPubkey() {
  const m = /\/\/ @@PUBKEY_BEGIN@@\n\s*var PUBLIC_KEY_JWK = (.*);\n\s*\/\/ @@PUBKEY_END@@/.exec(fs.readFileSync(MODULE, 'utf8'));
  if (!m) die('assets/js/oshi-pro.js に @@PUBKEY 行が見つかりません');
  return m[1].trim() === 'null' ? null : JSON.parse(m[1]);
}
function writePubkey(jwk) {
  const src = fs.readFileSync(MODULE, 'utf8');
  const out = src.replace(/(\/\/ @@PUBKEY_BEGIN@@\n\s*var PUBLIC_KEY_JWK = ).*(;\n)/, (_, a, b) => a + JSON.stringify(jwk) + b);
  if (out === src && jwk) die('公開鍵の書き込みに失敗しました');
  fs.writeFileSync(MODULE, out);
}
function randomId() { return OshiPro.bytesToB64u(webcrypto.getRandomValues(new Uint8Array(9))); }
async function loadPrivate() {
  if (!fs.existsSync(PRIV)) die(`秘密鍵がありません: ${PRIV}\n  最初に node scripts/oshi-license.mjs init を実行してください`);
  const jwk = JSON.parse(fs.readFileSync(PRIV, 'utf8'));
  return subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}
export async function signKey(privateKey, payload) {
  const body = OshiPro.KEY_PREFIX + OshiPro.bytesToB64u(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, new TextEncoder().encode(body)));
  return body + '.' + OshiPro.bytesToB64u(sig);
}

async function init() {
  if (currentPubkey() && !flag('--force')) {
    die('公開鍵はすでに設定されています。作り直すと販売済みのキーが全部無効になります。\n  本当に作り直すときだけ --force を付けてください');
  }
  if (fs.existsSync(PRIV) && !flag('--force')) die(`秘密鍵がすでにあります: ${PRIV}（上書きするなら --force）`);
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const priv = await subtle.exportKey('jwk', pair.privateKey);
  const pub = await subtle.exportKey('jwk', pair.publicKey);
  fs.mkdirSync(KEYDIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(PRIV, JSON.stringify(priv), { mode: 0o600 });
  writePubkey({ kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y });
  console.log(`✓ 秘密鍵を保存しました: ${PRIV}   ← 絶対にコミット・共有しない。控えを別の場所へ`);
  console.log('✓ 公開鍵を assets/js/oshi-pro.js へ書き込みました → コミットして公開してください');
  console.log('  （oshikatsu.html の oshi-pro.js?v= を上げるのを忘れずに。sw.js が古い版を返します）');
}

const DELIVERY = (key, lot) => `推し活ログ Pro — ライセンスキー
==================================================

ご購入ありがとうございます！

■ ライセンスキー（全部コピーしてください）
${key}

■ 有効にする方法（30秒）
1. 推し活ログを開く  https://hifukasawa77-lgtm.github.io/main/oshikatsu.html#settings
2. 「設定」タブの「💎 推し活ログ Pro」にキーを貼り付ける
3. 「有効にする」を押す

・キーの確認は端末の中だけで行います。キーや記録がどこかへ送信されることはありません
・機種変更・ブラウザを変えたときは、同じキーをもう一度貼り付けてください（台数制限はありません。ご自身の端末でお使いください）
・キーの再配布・転売・公開はご遠慮ください。公開されたキーは無効化することがあります

■ Pro でできること
・推し活レポート画像のテンプレート全種（メンカラ／ペンライトの夜／チェキ風／モノクロ上品）
・年間まとめ・累計の画像
・画像の「推し活ログ」透かしを消せる
・アプリ全体を推しのメンバーカラーに染める（メンカラテーマ）

■ 困ったとき
BOOTH の購入履歴からメッセージでご連絡ください（ロット: ${lot}）。

■ ご利用条件（要約）
・買い切りです。今後追加される Pro 機能も追加料金なしで使えます
・デジタル商品のため、キーが正しく動かない場合を除き返金はお受けしていません
・記録データは端末内にのみ保存されます。データの消失に備え、定期的に「JSON書き出し」でバックアップしてください
`;

async function issue() {
  const lot = opt('--lot', new Date().toISOString().slice(0, 7));
  const count = Math.max(1, Math.min(100, Number(opt('--count', '1')) || 1));
  if (!/^[A-Za-z0-9_.-]{1,24}$/.test(lot)) die('--lot は英数字・ハイフン・ドット24文字以内');
  const pub = currentPubkey();
  if (!pub) die('公開鍵が未設定です。先に init を実行してください');
  const key = await loadPrivate();
  const logFile = path.join(KEYDIR, 'issued.csv');
  if (!fs.existsSync(logFile)) fs.writeFileSync(logFile, 'issued_at,lot,id\n', { mode: 0o600 });
  for (let i = 0; i < count; i++) {
    const id = randomId();
    const k = await signKey(key, { p: OshiPro.PRODUCT, v: 1, lot, id });
    const res = await OshiPro.verifyKey(k, { jwk: pub, subtle });
    if (!res.ok) die('発行したキーが公開鍵で検証できません（秘密鍵と公開鍵が対になっていない）: ' + res.reason);
    fs.appendFileSync(logFile, `${new Date().toISOString()},${lot},${id}\n`);
    console.log(k);
    if (flag('--booth')) {
      const dir = path.join(KEYDIR, 'dist');
      fs.mkdirSync(dir, { recursive: true });
      const f = path.join(dir, `oshikatsu-pro-license-${lot}${count > 1 ? '-' + (i + 1) : ''}.txt`);
      fs.writeFileSync(f, DELIVERY(k, lot));
      console.error(`  → BOOTH配布用: ${f}`);
    }
  }
}

async function verify() {
  const k = args[1];
  const res = await OshiPro.verifyKey(k, { subtle });
  console.log(res.ok ? `✓ 有効なキーです（lot=${res.lot} id=${res.id}）` : `✗ ${OshiPro.reasonText(res.reason)}（${res.reason}）`);
  process.exit(res.ok ? 0 : 1);
}

function revoke() {
  const id = args[1];
  if (!id || !/^[A-Za-z0-9_-]{6,40}$/.test(id)) die('無効化するキーの ID を指定してください（issued.csv の id 列）');
  const src = fs.readFileSync(MODULE, 'utf8');
  const out = src.replace(/var REVOKED_IDS = \[(.*)\];/, (_, list) => {
    const ids = list.split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.includes(JSON.stringify(id))) die('すでに無効化されています');
    ids.push(JSON.stringify(id));
    return `var REVOKED_IDS = [${ids.join(', ')}];`;
  });
  fs.writeFileSync(MODULE, out);
  console.log(`✓ ${id} を無効化しました → oshi-pro.js をコミット・公開し、oshikatsu.html の ?v= を上げてください`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const run = { init, issue, verify, revoke }[cmd];
  if (!run) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 9).join('\n')); process.exit(cmd ? 1 : 0); }
  await run();
}
