# 市場調査レポート: 売上を伸ばせるアプリの市場機会（2026年6月）

- 調査日: 2026-06-10
- 調査依頼者: PM（深澤）
- 調査担当: Researcherエージェント×3（ゲーム市場 / 実用ツール市場 / AI活用＋配信戦略）
- 前提条件:
  - 個人開発者（日本）。Web技術（HTML/CSS/JS + Canvas API）が得意。将棋パズル・将棋RPG・Canvas製RPGの制作実績あり
  - プラットフォーム: Android（Google Play）または Windows（Microsoft Store / Steam / itch.io）
  - 技術方針: Web技術＋ラッパー（Capacitor / Tauri等）でパッケージング
  - 収益化: 広告収入（AdMob等）または買い切り
  - 制約: 有料APIキー（ANTHROPIC_API_KEY等）のアプリ組み込み禁止 → AI機能はオンデバイス推論に限定

本レポートでは出典のある記述を「事実」、推論による記述を「推測」と明記して区別する。

---

## 第1部: ゲームアプリ市場

### 1-1. Androidカジュアル/パズル市場と収益の現実

**事実**
- ハイパーカジュアル単体の時代は終わり、広告+IAP併用のハイブリッドカジュアルが主流（2025年調査で併用モデルが81%、前年68%）（[LIVEOPSIS](https://note.com/liveopsis/n/n2ef736f5b996)、[Confidence Creator](https://confidence-creator.jp/column/24739/)）
- 日本のeCPM相場（2025年、複数ベンチマーク統合値）:
  - バナー: $0.5〜1.5（日本は世界上位）
  - インタースティシャル: 約$10超（日本が世界トップ、ピークで$10.78の記録）
  - リワード: Tier1で$15〜30
  （[Playwire](https://www.playwire.com/blog/admob-ecpm-benchmarks-what-publishers-should-expect)、[Bidlogic](https://bidlogic.io/2026/01/30/what-happened-to-mobile-app-ecpms-in-q4-2025/)、[MonetizeMore](https://www.monetizemore.com/blog/ecpm-insights/)、[maf.ad](https://maf.ad/en/blog/mobile-ads-ecpm/)）
- 個人開発の実収益例: 累計3万DLで月1万円超（[週末のアプリ作成](https://www.tfsappsone.com/entry/2025/08/16/103050)）、AdMobで月10万円達成例（[わかなお氏 note](https://note.com/wakanao_banana/n/n58c1fc7af929)）。一方「10万DLでも数万円」のケースもある（[マネーフォワード](https://biz.moneyforward.com/tax_return/basic/81242/)、[ITプロマガジン](https://itpropartners.com/blog/1657/)）

**示唆**
- 月収 ≒ DAU × セッション数 × 広告表示数 × eCPM ÷ 1000。（推測）日本ユーザー中心のパズルでDAU1,000・1日3インタースティシャル（eCPM $10）なら月約7〜9万円。リワード併用で上振れ
- 個人向きはUA予算不要で長期リテンションが取れる**デイリーパズル・放置系・詰め系**。ハイパーカジュアル（大量UA前提）は個人に不向き
- 日本の広告単価が世界トップである以上、日本語ユーザー向けの習慣性パズルは個人開発と相性が非常に良い

### 1-2. 将棋・ボードゲーム系の競合状況

**事実**
- 対局系は飽和かつ強豪揃い: 将棋ウォーズ（800万人超・日産30万対局）、[ぴよ将棋](https://play.google.com/store/apps/details?id=net.studiok_i.shogi)（40段階AI）、[将皇](https://play.google.com/store/apps/details?id=jp.ken1shogi)（個人開発・連盟公認）、[将棋クエスト](https://play.google.com/store/apps/details?id=fm.wars.shogiquest)等
- 詰将棋も[みんなの詰将棋](https://play.google.com/store/apps/details?id=jp.co.unbalance.android.tumesyominna)（1200問・解説つき）等の定番が存在（[Good!Apps](https://good-apps.jp/media/column/8784)）

**示唆（推測を含む）**
- 「普通の対局将棋」「普通の詰将棋集」での新規参入は勝ち目なし
- 空いているニッチ:
  - **将棋×別ジャンル融合**（ローグライト、デッキ構築）: 和洋ともほぼ空白。チェス×ローグライト（Shotgun King等）のヒットが需要の傍証（推測）
  - **変則将棋・ミニ将棋**: 専用アプリは少ない
  - **「1日1問」型の習慣化詰将棋**（Wordle型デイリー+ストリーク+シェア）: 既存アプリは問題集型で習慣設計が弱い（推測。Planner段階で実機確認推奨）

### 1-3. Windows向けインディー市場（Steam / itch.io / MS Store）

**事実**
- Steam 2025年: インディー総売上44億ドル（全体の25%）。ただし年間約2万本の新作のうち**売上中央値は総額$249**。$100K超えは約8.5%（[Game World Observer](https://gameworldobserver.com/2025/12/22/indie-projects-generated-a-quarter-of-the-total-game-revenue-on-steam-by-the-end-of-2025-analytics)、[Ziva](https://ziva.sh/blogs/indie-game-revenue)、[Notebookcheck](https://www.notebookcheck.net/Indie-games-accounted-for-25-of-Steam-s-revenue-in-2025.1189429.0.html)）
- Steam登録料はタイトルごと$100（総売上$1,000で回収可）。月2,000本リリース時代（[4Gamer/CEDEC 2025](https://www.4gamer.net/games/991/G999104/20250806001/)）
- 日本市場の特性: 「Steam売上の4割が日本」という開発者報告あり。日本人はレビューを書かない傾向があり日本需要は過小評価されやすい（[mutyun](https://www.mutyun.com/archives/248963.html)）
- itch.io: デフォルト90/10と良心的。販路というよりデモ公開・コミュニティ形成の場（[itch.io公式](https://itch.io/blog/1137874/2025-finances)、[Fungies](https://fungies.io/steam-vs-itch-io-indie-developers/)）
- Microsoft Store: 個人開発者の登録料が無料化。自前決済なら手数料0%、MS決済でもゲーム12%（[Windows Central](https://www.windowscentral.com/microsoft/windows-11/microsoft-store-drops-fees-for-individual-developers-apple-still-charges-usd99-per-year)、[Microsoft Learn](https://learn.microsoft.com/en-us/windows/apps/publish/)）
- **Vampire SurvivorsはPhaser（HTML5/JS）製**。itch.io（2021年）→Steamで100万本超・BAFTA 2部門（[Gamedev.js](https://gamedevjs.com/games/vampire-survivors/)、[Barclays](https://games.creative.barclays/resource-hub/games/industry-insights/how-vampire-survivors-became-a-hit-when-creator-poncle-was-ready-to-give-up/)）

**示唆**
- Web技術（Canvas/JS）製はSteamで一切ハンデにならない（Vampire Survivorsで実証済み）。配布はElectron/Tauriラップで問題なし
- 日英対応・明確なフック付きの数百円ゲームなら期待値はプラスに乗せられる（推測）
- itch.io→反応を見てSteamへ、が個人開発の定石

### 1-4. 個人開発ゲームの成功事例（2024-2026）

**事実**
- **Schedule I**（2025年・Steam）: 実質1人開発で$151M。2025年インディー首位
- **8番出口**: 個人開発。推定25〜42万本・売上12〜19億円規模。「短時間・強烈なコンセプト・実況映え」の代表例（[みやこ出版 note](https://note.com/akutaba/n/n1b2d68a6222a)）
- **Vampire Survivors**: 個人開発・HTML5製・数百万本

**示唆**
- 大ヒットの共通項は「**一文で説明でき、実況・SNSで拡散するフック**」。技術力よりコンセプトの鋭さ
- 現実的な期待値: (a) Steam買い切りで数十万〜数百万円（当たれば桁違い）、(b) Android広告で月1〜10万円の積み上げ。（推測）同一ゲームのマルチ販路展開がリスクヘッジとして最適

### 1-5. Web技術製ゲームのストア審査・制約

**事実**
- Google Play: 単なるWebView/ラッパーアプリは「minimum functionality」ポリシーで却下・削除対象。2025年以降取り締まり強化（[Webvify](https://blog.webvify.app/blogs/google-play-store-policy-update-2026-webview-guide/)、[Median.co](https://median.co/blog/will-google-play-approve-my-webview-app)）
- Capacitorでアセットをローカル同梱したアプリは通常のネイティブアプリ扱い。ゲーム用途（WebGL/Canvas）も公式サポート（[Capacitor: Games](https://capacitorjs.com/docs/guides/games)、[Deploying to Google Play](https://capacitorjs.com/docs/android/deploying-to-google-play)）
- 2025年8月31日以降、新規アプリはAndroid 15（API 35）ターゲット必須（[OpenForge](https://openforge.io/google-play-developer-policy-changes-that-matter-in-2026/)）

**示唆**
- **TWA（リモート配信）ではなくCapacitorでアセット完全同梱**が正解。オフライン動作する「本物のゲーム」ならポリシー抵触リスクはほぼない（推測。Capacitor公式ゲームガイドの存在が傍証）

---

## 第2部: 実用ツール・ユーティリティ市場

### 2-1. Androidで個人が収益を出しているカテゴリと飽和度

**事実**
- 個人のAdMob収益は「日に数十円〜数百円」が大半。ニッチ特化の成功例として「熊鈴アプリ」（累計3万DL）で月1万円超（[週末のアプリ作成](https://www.tfsappsone.com/entry/2025/08/16/103050)）
- App Storeユーティリティ1位獲得アプリはサブスク＋広告で月250万円だが上位0.1%級の外れ値（[けい氏 note](https://note.com/keitaaaan/n/n6b4ff16d9835)）
- AdMobクリック単価は概ね1〜3円（[クラウドワークス](https://crowdworks.jp/p-journal/archives/3195/)）。レッドオーシャン化で広告単価は低下傾向（[ソウサクカツドウ！](https://teammoko.jp/app_redocean)）
- **2023年11月13日以降に作成された個人デベロッパーアカウントは「12人以上のテスター×14日間連続のクローズドテスト」が本番公開前に必須**（当初20人から緩和）（[Play Consoleヘルプ](https://support.google.com/googleplay/android-developer/answer/14151465?hl=ja)、[ゲームメーカーズ](https://gamemakers.jp/article/2023_11_13_54780/)、[Zenn](https://zenn.dev/closedtest/articles/2025-09-29-overcome-android-closed-test)）

**カテゴリ別飽和度（判定は推測）**

| カテゴリ | 飽和度 | 備考 |
|---|---|---|
| メモ・ToDo・習慣化 | 極高 | 差別化困難 |
| 家計簿 | 極高 | 大手が支配 |
| QR・スキャナ | 極高 | プリインストール化で需要縮小 |
| 汎用タイマー | 高 | 「用途特化タイマー」には空白あり |
| ファイル管理 | 高 | 権限要件の厳格化で個人に不利 |
| ウィジェット | 中 | Web技術ラッパーでは実装不可 |
| 用途特化ツール（熊鈴型） | 低〜中 | 検索流入が見込め成功実績あり |

**示唆**
- 「汎用ツール」は避け「特定の状況・職業・趣味でしか使わないツール」を狙う
- TWA/Capacitorで作れるのは「画面内で完結するツール」まで。ウィジェット・常駐・ファイル管理深部は不向き（技術的事実）

### 2-2. 日本市場特有のニッチ

**事実**
- 業種特化用途は「価格感度が低く継続利用されやすく、最も収益性の高いジャンルの一つ」との分析（[モリサキブログ](https://www.morisakiblog.com/app-monetization-realistic-guide-individual-dev/)、[ログミーBusiness](https://logmi.jp/main/technology/330120)）
- シニアの「タップ・スワイプ操作自体が困難」「練習アプリが見つからない」という生の声を確認（[Amebaブログ](https://ameblo.jp/henyo2/entry-12864286817.html)）。個人開発の成功事例は確認できず、供給が薄い可能性（推測）

**示唆（候補は推測を含む）**
- 建設・電気・配管など現場職人向け計算ツール（日本の規格・単位準拠のものは少ない）
- 日本の制度に紐づく計算機（社会保険料、介護保険自己負担、車検リマインダー等）
- シニア向け「機能を削った」超シンプルツール
- 日本語・日本制度が参入障壁になる領域ほど個人でも検索上位を取りやすい

### 2-3. Windows（Microsoft Store）の有料ユーティリティ市場

**事実**
- 2025年、個人開発者の登録料が世界約200市場で完全無料化（[窓の杜](https://forest.watch.impress.co.jp/docs/news/2046485.html)、[Microsoft Learn](https://learn.microsoft.com/ja-jp/windows/apps/publish/whats-new-individual-developer)）
- 手数料: MS決済で非ゲーム15%・ゲーム12%。**非ゲームは独自決済なら0%**（[Gizmodo Japan](https://www.gizmodo.jp/2021/06/microsoft-change-revenue-share-policy.html)、[Microsoft Learn](https://learn.microsoft.com/ja-jp/windows/apps/publish/partner-center/account-types-locations-and-fees)）
- MSIXならホスティング・コード署名・自動アップデート無料（[Zenn: shinta0806](https://zenn.dev/shinta0806/articles/microsoft-store-benefits)）
- 集客力の実例: 公開1ヶ月で435PV・28インストール・3購入という個人報告（[Zenn](https://zenn.dev/k_dev/articles/4f7b55712d5252)）

**示唆**
- 条件（手数料・審査・運用コスト）は3大ストアで最良だが「置けば売れる」市場ではない。窓の杜・SEO・SNS等の外部集客が前提で、ストアは決済・配布インフラとして使う
- Google Playのテスター要件のような障壁がなくリリースサイクルを速く回せる

### 2-4. 個人開発ユーティリティの成功事例（2024-2026）

**事実**
- Kengo KOSAKAI氏: 個人開発の2025年度損益391万円（[note](https://note.com/kantagon/n/n046def008515)）
- nakapon9517氏: フィットネス系アプリ群8年継続で月売上20万円超（[Qiita](https://qiita.com/nakapon9517/items/14bf412fe169824cc824)）
- 共通パターン: (1) 複数アプリのポートフォリオ運営、(2) 年単位の継続、(3) 広告＋課金ハイブリッド、(4) ニッチ特化

**示唆**
- 現実的な目標は「1本目で月1万円、複数本の積み上げで月5〜20万円」。月100万円級は外れ値として計画に入れない

### 2-5. 広告型 vs 買い切り型の収益性比較

**事実**
- 広告型LTVは「ARPDAU × 継続日数」で継続率が支配的変数（[note](https://note.com/ad_venturemedia/n/nc478080e4241)）。DAU/MAU比40%以上が優秀の目安
- 課金率（PUR）平均2-5%。買い切りは「ツール系・オフライン寄り・単発完結」向き（[micro exits](https://micro-exits.dev/blog/0194bc38-ff83-74c8-bd6d-7374a67793f6)）
- 2025年はハイブリッド収益化が主流（[MobileAction](https://www.mobileaction.co/blog/how-to-create-an-app-and-make-money/)）

**示唆**
- **最適解は「無料＋広告、買い切りで広告除去＋機能解放」のハイブリッド**。ライトユーザーから広告収益、ヘビーユーザーから買い切り収益の二段構え

---

## 第3部: AI活用アプリとオンデバイスAI

### 3-1. オンデバイスAIの実用性（プラットフォーム別）

**Android: ML Kit GenAI API（Gemini Nano）— 事実**
- 要約・校正・リライト・画像説明・音声認識・自由プロンプト（Prompt API、2025年10月Alpha）が端末内で実行可能。オフライン動作（[Android Developers Blog](https://android-developers.googleblog.com/2025/05/on-device-gen-ai-apis-ml-kit-gemini-nano.html)、[Prompt API Alpha](https://android-developers.googleblog.com/2025/10/ml-kit-genai-prompt-api-alpha-release.html)）
- **重大な制約**: Gemini Nano対応端末はPixel 8以降等のNPU搭載フラッグシップ限定。フォールバック設計必須（[Local AI Master](https://localaimaster.com/blog/gemini-nano-android-guide)）
- 従来型ML Kit（翻訳・OCR・画像ラベリング）は幅広い端末で動作

**ブラウザ/Windows: transformers.js + WebGPU — 事実**
- transformers.js v3（2024年10月）でWebGPU対応（WASM比最大100倍）、1,200以上の変換済みモデル。v4（2026年2月）でさらに高速化（[Hugging Face](https://huggingface.co/blog/transformersjs-v3)）
- 実用タスク: 翻訳、Whisper音声認識、テキスト分類、画像分類。2Bパラメータ未満が実用ライン
- **CDN経由で導入でき、ビルドツール不使用方針と整合**

**Windowsネイティブ: Phi Silica — 事実**
- Windows App SDK 1.7.2で要約・リライト・OCR等が安定版API化（[Microsoft Learn](https://learn.microsoft.com/en-us/windows/ai/apis/phi-silica)）
- **重大な制約**: NPU搭載Copilot+ PC専用。市場狙いならtransformers.js/ONNX Runtimeの方が広い

### 3-2. オンデバイス/買い切り型AIアプリの収益事例

**事実**
- 買い切り個人開発の成功例: CARROT Weather（月商約$200k・1人開発）、Xnapper（$29買い切り・ピークMRR約$6K）（[Market Clarity](https://mktclarity.com/blogs/news/indie-apps-top)）
- 日本の将棋カテゴリに**オンデバイス推論×個人開発の実例が既に存在**: 「きふみAI」（オフライン棋譜解析）、「将棋Lab」（2025年11月・個人開発）（[きふみAI](https://kifumiai.com/)、[将棋Lab開発記](https://moai510.hatenablog.com/entry/20260404/1775264079)）

**示唆**
- 限界費用ゼロのため広告/買い切りと構造的に相性が良い。「プライバシー」「オフライン動作」「サブスク疲れへの買い切り訴求」が差別化軸
- 「オンデバイスAIであること自体」は売りにならず、解決するペインの強さが収益を決める（推測・確度高）

### 3-3. 「既存スキル×AI」の市場機会

**AI将棋解析 — 事実**
- 評価値解析ツール（ぴよ将棋・ShogiGUI・将棋メイト等）は存在するが、大手の銀星将棋10が「局面の日本語解説」機能を開発中と発表（2025年6月）＝**「AIによる日本語解説」は業界的に次のフロンティア**（[シルバースタージャパン](https://www.silverstar.co.jp/2025/06/18205.html)、[note: ブラウザ将棋AI](https://note.com/ryosuke_kubo/n/n59a904aec989)）
- WebAssembly版将棋エンジン（やねうら王系）はブラウザ動作実績あり＝サーバー不要で成立

**AI英語学習 — 事実＋推測**
- Speak、スピークバディ（累計500万DL）などクラウドAI英会話を資本力のある企業が支配。正面勝負は不可能（推測・確度高）
- 勝ち筋はニッチ特化×オフライン（例: Whisperオンデバイス発音チェック・買い切り）

---

## 第4部: 配信戦略の比較

### 4-1. ストア比較（個人開発者視点）

| 項目 | Google Play | Microsoft Store | Steam | itch.io |
|---|---|---|---|---|
| 登録料 | $25（一回） | **個人は無料** | $100/タイトル（売上$1,000で回収可） | 無料 |
| 手数料 | 15%（年$1M以下） | ゲーム12%/非ゲーム15%。非ゲーム独自決済なら0% | 30% | デフォルト10%・変更可 |
| 審査/参入障壁 | **個人は12テスター×14日のクローズドテスト必須** | 比較的緩い | 緩いが可視性に5,000〜10,000ウィッシュリスト必要 | 審査なし・即日公開 |
| オーガニック流入 | 大（新規個人には険しい） | 中〜小 | 大（閾値あり） | 小 |
| 広告収益化 | **AdMob本命・最も成熟** | 弱い | 不向き | 不向き |

出典: [Google Play公式](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)、[PrimeTestLab](https://primetestlab.com/blog/google-play-changed-20-to-12-testers)、[Windows Forum](https://windowsforum.com/threads/microsoft-store-waives-individual-developer-fee-to-boost-indie-windows-apps.380495/)、[Fungies](https://fungies.io/steam-revenue-share-explained/)、[itch.io FAQ](https://itch.io/docs/creators/faq)

### 4-2. Web技術ラッパー比較

| 技術 | 対象ストア | AdMob統合 | 審査実績・注意点 |
|---|---|---|---|
| TWA | Google Play | △ 実質不可（Web広告依存） | 「薄いラッパー」却下リスク（[PWABuilder Issue #1752](https://github.com/pwa-builder/PWABuilder/issues/1752)） |
| **Capacitor** | Google Play | **◎ コミュニティ製プラグインあり** | 使用自体は却下理由にならない（[Capacitor Adsガイド](https://capacitorjs.com/docs/guides/ads)、[Capgo](https://capgo.app/blog/how-easy-is-it-to-make-web-app-into-mobile-app-with-capacitor/)） |
| **Tauri** | Microsoft Store | －（買い切り向き） | 公式MS Store配布ガイドあり。Electron比でRAM約半分（[Tauri公式](https://v2.tauri.app/distribute/microsoft-store/)、[DoltHub](https://www.dolthub.com/blog/2025-11-13-electron-vs-tauri/)） |
| Electron | MS Store / Steam | － | 公式配布可。サイズ・メモリが重いがSteamでは枯れていて安全 |

### 4-3. Android vs Windows の結論

**結論: 「Android（Capacitor + AdMob）を主戦場、Windows（Tauri + 買い切り）を低コスト併売」のハイブリッド。単一選択ならAndroid。**

根拠:
1. 広告収益エコシステムはGoogle Play/AdMobが圧倒的に成熟（事実）
2. Windowsの参入障壁は低い（登録無料）が集客力も弱い（事実＋推測）
3. Google Playの「12テスター×14日」の壁があるため、開発初期はitch.io/Webで即日公開して需要検証→検証が取れたものだけPlayへ、がリスク最小（推測）

---

## Plannerへの申し送り事項

1. **収益モデル**: 最初から「無料＋広告＋買い切りで広告除去/機能解放」のハイブリッドで要件定義する
2. **パッケージング**: Google PlayはTWAでなくCapacitor（アセット完全同梱・オフライン動作）。API 35ターゲット。個人アカウントのクローズドテスト（12人×14日）をスケジュールに組み込む
3. **広告設計**: 日本はインタースティシャル/リワード単価が世界最高水準。リワード（ヒント解放等）を中核に、UXを壊さない頻度設計を要件化
4. **オンデバイスAI採用時**: 対応端末フォールバック設計とモデル初回ダウンロード（数十〜数百MB）のUXを必ず仕様化
5. **法務**: 詰将棋問題・棋譜には著作権上の論点がある。問題は自動生成または完全自作とし、Legal-Checkerを必須工程とする
6. **避けるべき失敗パターン**:
   - 通常対局将棋・汎用メモ/ToDo/家計簿/QRへの正面参入（極度の飽和）
   - 薄いWebラッパーによるストア却下
   - Gemini Nano/Phi Silica等フラッグシップ専用APIへの全面依存
   - Steamへの無告知サイレントローンチ（中央値$249の世界）
   - 月100万円級の外れ値事例を基準にした計画
