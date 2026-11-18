---
title: "全ページが同じ公開オリジンに乗っている、という話 — 共有リンクのXSSで家計簿まで読めた"
slug: same-origin-xss-sengoku-share-link
kind: paid
price: 500
topic_id: t009
hashtags: [セキュリティ, XSS, GitHubPages, 個人開発]
status: ready
published_at: null
note_url: null
---

ブラウザゲームを1本ずつ別のアプリだと思って作っていると、
見落としやすい前提があります。**GitHub Pagesで同じリポジトリから公開している以上、
全ページが同じオリジンに乗っている。**

1ページのXSSは、そのページだけの問題ではありません。
戦国シミュレーションの「共有リンク」機能に、
**家計簿アプリの保存データまで読み書きできる穴**がありました。

## この記事で分かること

- 1つのページの入力検証の穴が、全く無関係な別アプリの保存データに届く理由
- GitHub Pagesでは`<meta>`に書いたクリックジャッキング対策が実際には無視される理由
- サーバ側の防御を「遮断して終わり」にしない、遮断→記録→通知の3段構成
- 攻撃者に送られてくる文字列を、そのまま通知に転記してはいけない理由

## 先に結論

- **同一オリジン上の複数アプリは、1つのXSSで運命を共にする。** 片方の入力検証の甘さが、
  全く無関係な別アプリの保存データ（家計簿・ログ等）への読み書き経路になる
- **`<meta>`で書くX-Frame-OptionsやCSPのframe-ancestorsは、静的ホスティングでは効かない。**
  ブラウザはHTTPヘッダでしか見ない。JS側で「埋め込まれたら抜け出す」実装が必要になる
- **サーバ側の防御は、遮断しただけでは終わらない。** 記録（あとで追える形）と通知（いま気づける形）
  を両方持たせ、かつ**通知は種別ごとに間隔を空ける**。空けないと、攻撃者が安い事件を定期的に
  起こすだけで本物の通知を黙らせられる
- **通知文面に攻撃者が決められる文字列をそのまま載せない。** 通報の中身は誰でも偽れるので、
  そのまま転記すると通知を見る側への攻撃に変わる

ここから先は、この一連の防御が実際にどう組まれているかをコードで見ていきます。
入力検証・クリックジャッキング対策・サーバ側の遮断と通知という3つの層を1つずつ見ていくと、
「どこか1つを直せば終わり」ではなく、**層それぞれに別の種類の罠がある**ことが分かります。

<!-- 有料ライン -->

## 1. 「忠誠の欄」に仕込んだタグが、全ページの保存データへ届いた

戦国シミュレーション（`sengoku.html`）には、プレイ中の陣容をURLの文字列として
端末間で共有する機能があります。受け取った側は、そのデータの一部を画面に
`innerHTML`で組んで表示します。

ここに検証が無いと何が起きるか、実装側のコメントがそのまま記録しています。

```js
// ★共有リンクの中身は「他人が書いた物」。画面の一部は innerHTML で組むので、文字列にタグやスクリプトの形が
//   混ざっていたら丸ごと受け取らない（2026-10-19 の点検: 忠誠の欄に <img onerror=…> を入れたリンクで、
//   武将一覧を開いた瞬間に同じサイトの全ページの保存データを読み書きできた）。ゲームの正当なデータには現れない形だけを見る
```

受け取った文字列に`<img onerror=…>`のようなタグの形を混ぜておくと、
武将一覧を開いた瞬間にコードが動きます。そしてこのページが動いているのは
`localStorage`も`https://hifukasawa77-lgtm.github.io`という**1つのオリジンの中**です。
`localStorage`はオリジン単位で区切られるので、**同じオリジンの別ページ（レシート家計簿や
推し活ログ）が保存しているデータへも、このコードから読み書きできる**ことになります。
1つのゲームの入力検証の甘さが、無関係な別アプリの保存データの安全性を決めてしまいます。

## 2. 防御は「タグの形だけを見る」正規表現と、受け取り全体の拒否

対策のコードは、受け取った文字列やオブジェクトのキーに、ゲームの正当なデータには
現れないはずの形が混ざっていないかを再帰的に調べ、1箇所でも見つかれば**全体を丸ごと
受け取らない**という作りです。

```js
const SHARE_MARKUP_RE=/<\s*[a-zA-Z!\/?]|javascript:|\bon[a-z]+\s*=/i;
function shareStateHasMarkup(value, depth){
  if (depth>40) return true;
  if (typeof value==='string') return SHARE_MARKUP_RE.test(value);
  if (!value || typeof value!=='object') return false;
  for (const key of Object.keys(value)){
    if (SHARE_MARKUP_RE.test(key) || shareStateHasMarkup(value[key], depth+1)) return true;
  }
  return false;
}
function decodeShareState(input){
  try{
    let c=(input||'').trim(); if(!c) return null;
    const i=c.indexOf('scn='); if(i>=0) c=c.slice(i+4);
    c=c.split('&')[0].trim();
    const st=JSON.parse(b64DecodeUtf8(c));
    if(!st || typeof st!=='object' || st.version!==SAVE_VERSION) return null;
    if (shareStateHasMarkup(st, 0)) return null;
    return st;
  }catch(_){ return null; }
}
```

ここで**値だけでなくキーの名前も検査している**のがポイントです。タグの形は
値の中だけでなく、キーの名前として埋め込まれる可能性もあるため、両方を見る必要があります。
また再帰の深さに上限（40）を設けているのは、極端に深い入れ子を作って検査自体を
詰まらせるような入力への備えです。

## 3. `<meta>`に書いたクリックジャッキング対策は、実際には効かない

もう1つ別の防御層として、クリックジャッキング（透明な枠で画面を覆って意図しない操作を
誘発する手口）への対策があります。ここで踏みやすい罠があります。
GitHub PagesはHTTPヘッダを設定できないので、`X-Frame-Options`や`frame-ancestors`を
**`<meta>`タグに書いても、ブラウザは無視します。**

対策は、別オリジンの枠に入れられたことをJavaScript側で検知して、最上位への脱出を
試みつつ、画面を全面遮断するという形です。

```js
if (w.self === w.top) return;
var sameOrigin = false;
try { sameOrigin = w.top.location.origin === w.location.origin; } catch (_) { sameOrigin = false; }
if (sameOrigin) return;
// ...
try { w.top.location.replace(w.location.href); } catch (_) { /* sandbox 等 */ }
```

ここでさらに注意が必要なのは、**脱出が成功したかどうかはページ側から判定できない**
ということです。Chromeには「ユーザー操作の無い別オリジンの枠から最上位を遷移させない」
制限があり、この場合は例外も出さずに黙って無視されます。そのため、脱出を試みた上で
**常に操作を全面で遮る**という二重の作りになっています。同じオリジンの親（例えば
プレビュー用ページが本体を枠で開く場合）だけは許可されます。

## 4. サーバ側は「遮断して終わり」にしない — 記録と通知を分ける

Worker側の防御は、攻撃パターンに該当するリクエストをハンドラの前で403にするだけでなく、
**全ての拒否をRFC 5424形式のシスログ行として記録し、重大度に応じてSlackへ通知する**
という3段構成です。

```js
export function syslogLine(event) {
  const severity = SEVERITY[event.severity] ?? SEVERITY.warning;
  const pri = FACILITY_AUTHPRIV * 8 + severity;
  const params = ['kind', 'ip', 'method', 'path', 'status', 'origin', 'ua', 'country', 'detail']
    .filter(k => event[k] !== undefined && event[k] !== '')
    .map(k => `${k}="${sdEscape(event[k])}"`).join(' ');
  return `<${pri}>1 ${event.time || now()} ${sdEscape(event.host || '-').replace(/\s/g, '') || '-'} ` +
    `${event.service || 'worker'} - SECURITY [sec@32473 ${params}] ${sdEscape(event.message || event.kind)}`;
}
```

ログの値をそのまま埋め込むと、攻撃者がURLの中に改行文字を仕込むだけで、
**偽のログ行をもう1行作られてしまいます。** これを防ぐためのエスケープ関数には、
順序に関する注意書きが残っています。

```js
function sdEscape(value) {
  // ★切ってから逃がす。逃がしてから切ると、末尾の \ だけが残って閉じの " を逃がし、行の構造が壊れる
  return String(value ?? '').slice(0, 300).replace(/[\\"\]]/g, c => '\\' + c).replace(/[\r\n]/g, ' ');
}
```

文字数を切り詰める処理とエスケープ処理の順番を逆にすると、エスケープ済みの`\`の
直後で切られて孤立し、その後に続くはずの閉じ引用符がエスケープされたままログの
構造そのものが壊れます。小さな関数ですが、順序を変えるだけで無言で壊れる典型です。

同じIPから拒否が続く場合は、Cache APIを使って15分間（`BAN_SECONDS=900`）その場所からの
リクエストを遮断します。KVではなくCache APIを使っているのは、書き込みのたびに消費される
KVの書き込み枠を、攻撃者自身の行動で使い切らせないようにするためです。

## 5. 通知は「種別＋送信元のおおよそ」ごとに間隔を空ける

重大度が一定以上の拒否だけをSlackへ通知しますが、ここにも間隔の制御があります。

```js
// ★通知のまとめは「種別＋送信元のおおよそ」ごと。種別だけだと、攻撃者が安い事件を10分ごとに1つ起こすだけで
//   同じ種別の本物の通知を黙らせられた
const throttleKey = (kind, ip) => `https://security-gate.invalid/alert/${encodeURIComponent(kind)}/${encodeURIComponent(maskIp(ip || ''))}`;
```

`ALERT_THROTTLE_SECONDS`は600秒（10分）です。種別だけで間隔を管理すると、
攻撃者が安価な種類の拒否を10分おきに1件起こすだけで、**その種別の通知が永久に
抑止され続ける**ことになります。種別と送信元の組み合わせで管理することで、
この抑止の悪用を防いでいます。

## 6. 通知に載せる文字列は、攻撃者が決められる

通報の内容（通報元のパス・ホスト名・UAなど）は、送信者が自由に書ける文字列です。
これをそのままSlackの通知文に転記すると、**通知を受け取る側への新たな攻撃**になります。

```js
/**
 * 通知へ載せる、相手が決められる文字（URL・通報の中身・UA 等）を無害にする。
 * ★Slack は <!channel> で全員を呼び出し、<https://偽|もっともらしい文> で行き先を隠したリンクを作れる。
 *   Discord は @everyone と [文](URL)。通報の中身は誰でも偽れるので、そのまま載せると
 *   持ち主の Slack に全員宛ての偽の「ログイン確認」リンクを流し込めた（2026-10-19 の点検）。
 *   記号を全角へ置き換え、URL は https → hxxps（押せない形）にする
 */
export function defang(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/&/g, '＆').replace(/</g, '＜').replace(/>/g, '＞')
    .replace(/@/g, '＠').replace(/\[/g, '［').replace(/\]/g, '］').replace(/`/g, '｀').replace(/\|/g, '｜')
    .replace(/\b(h)(ttps?):\/\//gi, (_, h, rest) => `${h}x${rest.slice(1).replace(/^t/, 'x')}://`)
```

`<!channel>`での全員呼び出しや、リンクの表示文字と実際の行き先をずらす記法は、
**通報内容という「外部から来た文字列」をそのまま信頼した場合にだけ成立します。**
記号を全角へ置き換え、URLのスキームを押せない形に変えることで、通知そのものが
別の攻撃の運び手になることを防いでいます。

## まとめ

- **GitHub Pagesの1リポジトリから公開している複数のアプリは、同じオリジンを共有する。**
  1ページのXSSは、そのページだけの被害で終わらない
- **共有データの検証は「値」と「キー」の両方を見る。** タグの形はどちらにも紛れ込む
- **`<meta>`のクリックジャッキング対策は静的ホスティングでは無効。** JS側で検知し、
  脱出の成否が分からない前提で、常に操作を遮断する
- **防御は遮断で終わらせず、記録と通知を分ける。** 記録はあとで追えるように、
  通知はいま気づけるように、それぞれ別の設計が要る
- **ログへの書き込みは、切り詰めとエスケープの順序を間違えると構造が壊れる**
- **通知は種別と送信元の組み合わせで間隔を空ける。** 種別だけだと安価な攻撃で
  本物の通知を黙らせられる
- **通知に載せる外部由来の文字列は無害化する。** 通報の中身は誰でも偽れる

実装（`sengoku.html`の共有リンク部分・`assets/js/frame-guard.js`・
`cloudflare-worker/security-monitor.js`）は公開リポジトリにそのまま置いてあります。

- [hide_0001 ポートフォリオ](https://hifukasawa77-lgtm.github.io/main/)

同じオリジンに複数のアプリを乗せている方がいたら、
入力検証をどこまで横断で見ているか、コメントで教えてください。
