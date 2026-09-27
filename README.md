# hideの部屋

**[hideの部屋](https://hifukasawa77-lgtm.github.io/main/)** は、埼玉県三郷市に住む個人開発者 hide のWebサイトです。
Claude AI（Claude Code）とペアプログラミングで作った **無料ブラウザゲーム40本以上** と便利ツールを公開しています。
インストールも会員登録も不要で、ブラウザを開けばすぐに遊べます。

👉 **サイトを開く: https://hifukasawa77-lgtm.github.io/main/**

*hide's room — free browser games and handy tools co-developed with Claude AI by an indie developer in Misato, Saitama, Japan.*

## 遊べるもの（一部）

| ジャンル | 作品 |
|---|---|
| 歴史シミュレーション | [戦国風雲記](https://hifukasawa77-lgtm.github.io/main/sengoku.html) / [三国志・天下三分](https://hifukasawa77-lgtm.github.io/main/sanguo.html) / [幕末風雲記](https://hifukasawa77-lgtm.github.io/main/bakumatsu.html) |
| ボードゲーム・和の遊び | [AI将棋](https://hifukasawa77-lgtm.github.io/main/shogi.html) / [AI麻雀](https://hifukasawa77-lgtm.github.io/main/mahjong.html) / [百人一首かるた](https://hifukasawa77-lgtm.github.io/main/hyakunin_isshu.html) |
| アクション | [GLASS PINBALL](https://hifukasawa77-lgtm.github.io/main/pinball.html) |
| 便利ツール | [レシートOCR家計簿](https://hifukasawa77-lgtm.github.io/main/receipt-ocr.html) / [ZERO-1 Mobile（スマホ内で動くAI）](https://hifukasawa77-lgtm.github.io/main/zero-1-mobile.html) / [グラフィックEQ＆シンセサイザー](https://hifukasawa77-lgtm.github.io/main/synth-eq.html) |

全作品の一覧は [hideの部屋のトップページ](https://hifukasawa77-lgtm.github.io/main/#works) にあります。

## 作り方

- フレームワークを使わず、素の HTML / CSS / JavaScript（Canvas API・Web Audio API）で作っています
- 仕様・実装・法務・セキュリティ・日英表記・動作テスト・採点を AI エージェントで分業しています（[制作を支えるAIチーム](https://hifukasawa77-lgtm.github.io/main/agents.html) / [Claude Code × ハーネス設計の解説スライド](https://hifukasawa77-lgtm.github.io/main/slides.html)）
- 「例外もエラーも出ないのに壊れる」不具合は、再発しないよう `scripts/verify-*.mjs` の自動検査にしています
- 開発メモや失敗談は [ブログ](https://hifukasawa77-lgtm.github.io/main/blog.html)、学習資料は [学習リソース](https://hifukasawa77-lgtm.github.io/main/learn.html) にまとめています

## リポジトリの構成

- `index.html` — hideの部屋のトップページ（GitHub Pages で公開）
- `*.html` — 各ゲーム・ツール（1ファイル1作品）
- `assets/` — 画像・スクリプト・スタイル（画像は原則WebP）
- `gamekit/` — ゲーム制作用の自作マイクロエンジン
- `scripts/` — 自動検査・生成スクリプト
- `FamicomEmulatorWin/` — ファミコン/NESエミュレータ Windows版（.NET 8 + WPF）。`dotnet run --project FamicomEmulatorWin/FamicomEmulatorWin.csproj`
- `SakuraLikeEditor/` — Windows向けテキストエディター（サクラエディター風・.NET 8 + WPF）。`dotnet run --project SakuraLikeEditor/SakuraLikeEditor.csproj`

## ローカルで動かす

ビルドは不要です。リポジトリ直下で簡易サーバーを立ててブラウザで開きます（`file://` で直接開くと一部の機能が動きません）。

```bash
python3 -m http.server 8000
# → http://localhost:8000/index.html
```

## ライセンス

MIT

## Author

hide — [hideの部屋](https://hifukasawa77-lgtm.github.io/main/) / [GitHub](https://github.com/hifukasawa77-lgtm)
