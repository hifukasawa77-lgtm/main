# 推し活ログ Android アプリ（Google Play）— 公開手順

Web版の `oshikatsu.html` をそのまま Android アプリとして包む（Trusted Web Activity / Bubblewrap）。
**アプリの中身は Web版と同じファイル**なので、Web版を直してプッシュすればアプリも直る（ストアの再審査は要らない）。

| ファイル | 役割 |
|---|---|
| `twa-manifest.json` | Bubblewrap の設定（パッケージ名・起動URL・色・Play課金）。**正本**。生成される Android プロジェクトはコミットしない |
| `user-site/` | 別リポジトリ `hifukasawa77-lgtm.github.io` に置く3ファイル（アプリとサイトの紐づけ確認） |
| `store/` | Play ストア用のアイコン（512）とフィーチャーグラフィック（1024×500）。`node scripts/gen-oshikatsu-app-icons.mjs` で再生成 |
| ストア掲載文・データ安全性・テスター募集文 | `marketing/oshikatsu-android_play.md` |

検査: `node scripts/verify-oshikatsu.mjs`（節15: Play課金の購入・復元・返金・取消、manifest、事前キャッシュ、圏外起動、TWA設定の突き合わせ）

## 全体の流れ（初回は合計2〜3週間。うち14日はテスト期間の待ち）

```
1. Play Console 登録（25ドル・初回のみ）            ← 深澤（要承認：課金ゼロ方針の例外）
2. PC に Bubblewrap を入れて .aab を作る（30分）      ← 深澤のPC
3. 内部テストで自分の端末に入れて確認（購入テスト含む）
4. assetlinks.json を公開（URLバーを消す）
5. クローズドテスト：12人以上 × 14日間                ← テスター集め
6. 本番公開を申請 → 審査（数日）
```

## 1. Play Console 登録

1. <https://play.google.com/console/signup> → 「個人」→ 本人確認（身分証）→ 登録料 25ドル
2. **お支払いプロファイル**（売上の振込先）を設定する。これが無いと有料アイテムを作れない
3. 「アプリを作成」→ 名前「推し活ログ」・既定の言語 日本語・アプリ（ゲームではない）・無料

## 2. アプリ本体（.aab）を作る（深澤のPC）

Node.js が入っていれば、残り（JDK・Android SDK）は Bubblewrap が初回に自動で取ってくる（数GB）。

```bash
npm install -g @bubblewrap/cli
cd android
bubblewrap update          # twa-manifest.json から Android プロジェクトを生成（初回は JDK/SDK の場所を聞かれる→「自動で入れる」を選ぶ）
bubblewrap build           # 署名鍵が無ければ作る → app-release-bundle.aab ができる
```

- 署名鍵 `oshikatsu-upload.keystore` とパスワードは**絶対に失くさない・コミットしない**（`.gitignore` 済み）。
  Play App Signing を使うので、失くしても Google に「アップロード鍵のリセット」を頼めるが、数日かかる
- 版を上げるとき（アイコンや色を変えたときだけ。中身の修正は Web へのプッシュだけでよい）は
  `twa-manifest.json` の `appVersionCode` を +1 して `bubblewrap update && bubblewrap build`

## 3. 内部テスト（まず自分の端末で）

1. Play Console → テスト → 内部テスト → リリースを作成 → `.aab` をアップロード
2. テスターに自分の Gmail を入れ、表示されるリンクから自分の Android に入れる
3. **アプリ内アイテムを作る**: 収益化 → 商品 → アプリ内アイテム → 作成
   - アイテムID: **`oshikatsu_pro`**（コードと一字一句同じ。違うと購入ボタンを押しても何も出ない）
   - 名前「推し活ログ Pro」・価格 ¥980・有効にする
4. ライセンステスト: 設定 → ライセンステスト に自分の Gmail を入れる（**テスト用カードで、実際には請求されない**）
5. 端末で確認すること:
   - 設定タブの「💎 Pro を購入する ￥980」→ 購入 → Pro になる
   - アプリを消して入れ直す →「購入を復元」で戻る
   - **3日後も Pro のままか**（購入の「確認済み」処理が効いているかの確認。効いていないと Google が自動返金する。
     ここだけはヘッドレスの検査では確かめられない）
   - 機内モードで起動しても開けるか

## 4. URLバーを消す（assetlinks.json）

このままだとアプリの上に Chrome のURLバーが出る（審査で「ただのブラウザ」と見なされやすい）。

1. Play Console → 設定 → **アプリの署名** → 「アプリ署名鍵の証明書」と「アップロード鍵の証明書」の **SHA-256** をコピー
2. `user-site/.well-known/assetlinks.json` の `REPLACE_WITH_…` 2か所を置き換える
3. GitHub に**新しい公開リポジトリ `hifukasawa77-lgtm.github.io`** を作り、`user-site/` の中身（`.nojekyll` `.well-known/` `index.html`）を置く
   → Settings → Pages → main ブランチを公開
4. <https://hifukasawa77-lgtm.github.io/.well-known/assetlinks.json> が開けることを確認
   - **`.nojekyll` を忘れると `.well-known` が Jekyll に消されて404になる**（例外もエラーも出ず、URLバーが消えないだけ）
   - `index.html` はトップへの転送。無いと `hifukasawa77-lgtm.github.io/` が404のままになる

## 5. クローズドテスト（12人 × 14日）

`marketing/oshikatsu-android_play.md` の「テスター募集」を参照。

## 6. 本番公開の申請

テスト期間を満たすと、ダッシュボードに「製品版へのアクセスを申請」が出る。テストで得た感想・直した点を書く欄があるので、
テスト中にもらった声と直したことをメモしておく（`marketing/oshikatsu-android_play.md` に記入欄あり）。
