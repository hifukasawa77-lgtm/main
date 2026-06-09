# 法務リスクレポート（追加調査）
作成日: 2026-06-09
対象: /home/user/main/ 配下のゲーム系HTMLファイル（前回チェック済みを除く40ファイル）
調査者: Legal-Checker エージェント

---

## エグゼクティブサマリー

- **RED（即時対応必須）**: 6件
- **YELLOW（要対応）**: 6件
- **GREEN（問題なし）**: 28件

高リスク候補として指定された6ファイル（catan / blokus / blokus_trigon / corridor / flip_seven / indigo）は
いずれも **登録商標名をタイトルまたはゲーム内テキストにそのまま使用** しており、RED判定となった。
farlan.html の「Dragon Quest Style」表記も商標・著作権の両面でリスクがあり RED に分類した。

---

## RED（即時対応必須）

| # | ファイル | 問題内容 | 修正アクション |
|---|---|---|---|
| 1 | `catan.html` | タイトル「Catan AI」、ゲーム内テキスト「カタン」を使用。「Catan」は Catan GmbH（Asmodee グループ）の国際登録商標。ゲームシステムを模倣した実装に商標名を付けての公開はブランド混同を招く可能性が高い。GPT-image-2 生成アセット（地形・スプライト・ダイス）もファイル名に「catan」を含んでおり連動リスクあり | タイトルを独自名に変更（例: 「開拓島 FRONTIER ISLE」）。`<title>`・`<h1>`・ゲーム内テキスト・`カタン` 表記・アセットパス参照名を全て置換。`assets/catan/` フォルダも改名 |
| 2 | `blokus.html` | タイトル「ブロックス」、ルール説明文に「ブロックスルール」と明記。「Blokus」は Mattel（旧 Spin Master）の登録商標。ポリオミノ配置ゲーム自体は特許切れだが商標名の使用は問題 | タイトルを独自名に変更（例: 「カラーオミノ / COLOROMINO」）。`<title>`・`<h2>` ルール見出し・OGP メタ等を全て置換 |
| 3 | `blokus_trigon.html` | タイトル「ブロックストライゴン」、OGP タイトル・description・Twitter Card にも同名を明記。「Blokus Trigon」は Mattel の登録商標ファミリー | タイトル・OGP・Twitter Card・ルール見出しを全て独自名に変更（例: 「トライオミノ六角陣 / TRI-HEX ARENA」）。`assets/blokus-trigon-thumb.svg` のファイル名も変更を検討 |
| 4 | `corridor.html` | タイトル「コリドール / Corridor Strategy」、OGP タイトル「コリドール」。「Quoridor」は Gigamic の登録商標。ゲームファイル名自体が `corridor.html`（Quoridor の日本語発音「コリドール」と同一）であり、商標権者から見て混同を招くリスクが高い | タイトルを独自名に変更（例: 「迷路陣取り MAZE SIEGE」）。`<title>`・`<h1>`・OGP タグを全て置換 |
| 5 | `flip_seven.html` | タイトル「Flip Seven」、ゲーム内テキスト「FLIP SEVEN」「フリップスリー」等を頻出使用。「Flip Seven」は 999 Games（オランダ）が 2024年にリリースした商標製品名。欧州・国際市場での商標登録状況の確認が必要だが、同一名称の公開は直接的な混同リスクを生じる | タイトルを独自名に変更（例: 「セブンブレイク / SEVEN BREAK」）。ゲーム内の「FLIP SEVEN」「フリップスリー」等の固有テキストをゲームルール説明に書き直す |
| 6 | `farlan.html` | `<title>` に「Dragon Quest Style Prototype」、OGP description に「ドラクエ風ブラウザRPG試作」、ゲーム内パネルに「Dragon Quest Style Vertical Slice」と明記。「Dragon Quest」「ドラゴンクエスト」「ドラクエ」は Square Enix の登録商標。「ドラクエ風」という説明語としての使用はグレーだが、HTML タイトルや公開ページの OGP に商標名を記載することは商標の無断使用にあたる可能性が高い | `<title>` と OGP から「Dragon Quest」「ドラクエ風」を削除。「ファンタジーRPGプロトタイプ」「トップダウンRPG試作」など商標に依存しない表現へ変更 |

---

## YELLOW（要対応）

| # | ファイル | 問題内容 | 推奨対応 |
|---|---|---|---|
| 1 | `indigo.html` | タイトル「Indigo（インディゴ）」、OGP タイトル・description・meta description に同名を明記。description には「ラインナー・クニツィアのヘックスタイル配置ボードゲーム」と著者名も記載。「Indigo」は Ravensburger の登録商標。ただし、「Indigo」という単語は色名として一般的であり純粋な商標侵害の立証難度はやや低いと推測される。また著者名（クニツィア）の言及はゲーム系解説サイトでの一般慣行だが、著者名とタイトルを合わせて商標名として使用している点は注意が必要 | タイトル・OGP を独自名に変更することを推奨（例: 「宝石の道 / INDIGO PATH」）。どうしても「インディゴ」を維持する場合は、description から「ラインナー・クニツィアの」という商標製品の説明文言を削除し、独自の説明文に書き換える |
| 2 | `train-collection.html` | 実在する列車の愛称・型式名（のぞみ N700S、はやぶさ E5系、ドクターイエロー 923形 等）を多数使用。これらはゲームの「キャラクター」として登場する。各鉄道会社（JR 各社、東京メトロ、小田急等）は列車デザイン・愛称について商標登録をしているケースがある。「ドクターイエロー（923形）」は JR 東海・JR 西日本が所有しており、2024年に運行終了が発表されて注目度が高い。SVG アセットは自作・GPT 生成と manifest に記載されており著作権侵害リスクは低いが、実在の列車の「型番・愛称・カラーリング」を組み合わせた実装はパブリシティ的リスクが残る。Google Fonts（M PLUS Rounded 1c / OFL ライセンス）の使用はライセンス上問題ないが、Google サーバーへのアクセスが発生する点は個人情報保護の観点で言及が必要 | 列車データを「架空名称（実物に着想を得た独自列車）」に変更するか、各鉄道会社に対して教育的・非商業的ファンサイトである旨を示す免責事項をフッターに追加することを検討。Google Fonts のプライバシーリスクが気になる場合はフォントをセルフホストに変更 |
| 3 | `corridor.html`（追加指摘） | アセット `assets/corridor/gpt-image-2-corridor-atlas-source.png` / `pawn-blue.png` / `pawn-red.png` / `wall-h.png` / `wall-v.png` が存在するが、README も manifest.json も存在せずライセンス情報の記録がない。ファイル名から GPT-image-2 生成と推測されるが未文書化 | `assets/corridor/README.md` または `manifest.json` を作成し、生成方法・利用条件を記録する |
| 4 | `catan.html`（追加指摘） | `assets/catan/` の全 PNG ファイルがファイル名から GPT-image-2 生成と推測されるが、`manifest.json` や `README.md` が存在せず license 情報が未記録 | `assets/catan/manifest.json` を作成し、生成方法・利用条件を記録する（RED 対応で名称変更後に実施） |
| 5 | `conhex.html` | 「ConHex」は Niek Neuwahl が 1998 年頃考案した抽象ボードゲーム。現時点では広く知られた商標登録は確認されていないが、作者の知的財産として道義的配慮が必要。`assets/conhex/` に GPT-image-2 生成と推測される画像があるが README・manifest がなくライセンス情報未記録 | `assets/conhex/README.md` または `manifest.json` にアセット生成情報を記録する。可能であればゲームページに「ConHex は Niek Neuwahl 氏考案のゲームです」等のクレジットを追加する |
| 6 | `hyakki.html` | Google Analytics タグが `id=G-XXXXXXXXXX`（プレースホルダー値）のまま残っている。このまま公開されている場合、Google Tag Manager の実際の計測は行われていないが、外部スクリプト（`googletagmanager.com/gtag/js`）を読み込んでいるため訪問者の IP アドレス等が Google に送信される可能性がある（無効なIDでもリクエスト自体は発生する）。また実際の GA 計測 ID が後で設定された場合、プライバシーポリシーなしでの個人情報収集となるリスクがある | プレースホルダータグを削除するか、正しい計測 ID に置き換えた上でプライバシーポリシーを整備する。使用しないのであればタグを削除する |

---

## GREEN（問題なし）

| ファイル | 判定根拠 |
|---|---|
| `babanuki.html` | 「ばば抜き」は伝統的カードゲームで著作権・商標なし。外部ライブラリ・外部アセット参照なし。Canvas API のみ。問題なし |
| `blackjack.html` | 「ブラックジャック」はカジノゲームの一般名称。漫画「ブラック・ジャック」（手塚プロダクション）との混同リスクを念のため確認したが、タイトルは「BLACKJACK | hide の部屋」でカードゲームの文脈が明確。外部ライブラリ・アセット参照なし。問題なし |
| `carrom.html` | 「カロム（Carrom）」は伝統的テーブルゲームの一般名称。外部ライブラリ不使用。OGP 画像は自サイトドメイン参照。問題なし |
| `checkers.html` | 「チェッカーズ」はパブリックドメインのゲーム（歌手グループ「チェッカーズ」との混同なし、ゲーム文脈が明確）。外部ライブラリ・外部アセット参照なし。問題なし |
| `chinese_checkers.html` | ボード SVG は Wikimedia Commons のパブリックドメイン素材（`assets/chinese-checkers/README.md` に出典・ライセンス記録済み）。ゲーム名は一般名称。問題なし |
| `conhex.html` | YELLOW の軽微な指摘あり（上記参照）だが著作権侵害・商標侵害の明確なリスクはなし |
| `cyber-city.html` | タイトル「CITY BUILDER」。SimCity・GTA等の商標名不使用。外部ライブラリ・外部アセット参照なし。問題なし |
| `dark_fantasy_rpg.html` | タイトル「黒冠の諸島 / Crown of Ash Field RPG」（独自名）。外部ライブラリ・外部アセット参照なし。問題なし |
| `dots-and-boxes.html` | 「ドットアンドボックス（Dots and Boxes）」はパブリックドメインのゲーム。外部ライブラリ不使用。問題なし |
| `estate-tycoon.html` | タイトル「街区王 - 東京23区編」（独自名）。Monopoly 等の商標名不使用。アセットは GPT-image-2 生成（README 記録済み）。問題なし |
| `farlan.html`（アセット） | ゲームアセットは外部参照なし、Canvas API のみで描画（純粋プロシージャル）。アセット観点では問題なし。ただし RED の商標問題を要修正 |
| `fillit.html` | タイトル・description に「オリジナルボードゲーム」と明記。外部ライブラリ・外部アセット参照なし。問題なし |
| `fixer-of-history.html` | タイトル「影の権力者 / Fixer of History」（独自名）。登場する「織田信長」等は歴史上の人物でパブリックドメイン（存命でないためパブリシティ権なし）。外部ライブラリ・外部アセット参照なし。問題なし |
| `freecell.html` | 「フリーセル」はパブリックドメインのカードゲーム。Microsoft Solitaire との混同なし（UI 独自実装）。問題なし |
| `galactic-assault.html` | タイトル「GALACTIC ASSAULT」（独自名）。Star Wars・グラディウス等の商標名不使用。外部ライブラリ不使用。問題なし |
| `hex.html` | 「ヘックス（Hex）」はジョン・ナッシュ考案の抽象ゲームでパブリックドメイン。外部ライブラリ不使用。OGP 画像は自サイト参照。問題なし |
| `hyakki.html` | タイトル「百鬼演武録」（独自名）。キャラクター名も「朧丸」「夜叉お鈴」等、独自の創作名称（ゲゲゲの鬼太郎・妖怪ウォッチ等の商標名不使用）。外部ライブラリ不使用。アセットは自サイト内。ただし YELLOW の GA タグ問題を要対応 |
| `iroha_karuta.html` | 「いろはかるた」は伝統的カードゲームでパブリックドメイン。外部ライブラリ・外部アセット参照なし。問題なし |
| `kage_shura_den.html` | タイトル・キャラクター名は独自創作。アセットは GPT-image-2 生成（manifest 記録済み）。外部ライブラリ不使用。問題なし |
| `kart_racer.html` | タイトル「ターボカート・グランプリ / TURBO KART GRAND PRIX」（独自名）。Mario Kart 等の商標名不使用。外部ライブラリ・外部アセット参照なし。問題なし |
| `ludo.html` | タイトル「Ludo Neon Dice」（独自名、Ludo は伝統ゲームの一般名称）。アセットは GPT-image-2 生成 + CC0 のWikimedia素材（README 記録済み）。外部ライブラリ不使用。問題なし |
| `mahjong-solitaire.html` | 「麻雀ソリティア」は一般名称。外部ライブラリ・外部アセット参照なし。問題なし |
| `momentum-territory.html` | タイトル「モーメンタム・テリトリー」（独自名）。外部ライブラリ・外部アセット参照なし。schema.org 構造化データのみ。問題なし |
| `poker.html` | 「5枚ドローポーカー」は一般名称。外部ライブラリ・外部アセット参照なし。問題なし |
| `shichi-narabe.html` | 「七並べ」は伝統的カードゲームでパブリックドメイン。外部ライブラリ・外部アセット参照なし。問題なし |
| `shinkei-suijaku.html` | 「神経衰弱」は伝統的カードゲームでパブリックドメイン。外部ライブラリ・外部アセット参照なし。問題なし |
| `solitaire.html` | 「ソリティア（クロンダイク）」はパブリックドメイン。外部ライブラリ・外部アセット参照なし。問題なし |
| `typing_dojo.html` | タイトル「Typing Dojo」（独自名）。外部ライブラリ・外部アセット参照なし。問題なし |

---

## 総評・優先度付き対応ロードマップ

### 優先度 1（即時対応、今週中）: 商標名の変更

| 対象 | 変更内容 |
|---|---|
| `catan.html` | タイトルを独自名に変更。`assets/catan/` アセットパス参照も変更 |
| `blokus.html` | タイトル・ルール見出しを独自名に変更 |
| `blokus_trigon.html` | タイトル・OGP・Twitter Card を独自名に変更 |
| `corridor.html` | タイトル・OGP を独自名に変更 |
| `flip_seven.html` | タイトル・ゲーム内テキストを独自名に変更 |
| `farlan.html` | `<title>` および OGP から商標名を削除 |

### 優先度 2（今月中）: YELLOW 対応

| 対象 | 変更内容 |
|---|---|
| `indigo.html` | タイトルを独自名への変更またはdescriptionから商標文言の削除 |
| `train-collection.html` | 免責事項の追加またはキャラクター名の架空化の検討 |
| `corridor.html` / `catan.html` | アセットの README / manifest 作成 |
| `conhex.html` | アセットのドキュメント化、クレジット追加の検討 |
| `hyakki.html` | Google Analytics プレースホルダータグの削除または正式設定 |

### 補足事項

1. **GPT-image-2 生成アセットについて**: blokus / corridor / catan / conhex / kage_shura_den 等で使用されている GPT-image-2（OpenAI）生成画像は、OpenAI の利用規約上「ユーザーが所有権を取得できる」とされているが、生成プロンプトが既存商標製品に基づく場合（例: catan の地形タイル）は商標問題が残る点に注意。

2. **「Indigo」商標について**: 英語の色名「indigo」は一般語だが、Ravensburger は欧州・米国市場でボードゲームとして商標登録をしている可能性が高い。既存の「Indigo」表記を維持する場合は、最終的な商標調査を専門家に依頼することを推奨。

3. **「Flip Seven」商標について**: 2024年リリースの比較的新しいタイトルであり、商標権者（999 Games）が積極的に権利行使する可能性がある。即時変更を強く推奨。

4. **歴史的人物の使用（fixer-of-history.html）**: 織田信長・豊臣秀吉等は没後 500年以上が経過しており、日本法上パブリシティ権は発生しない。著作権上も問題なし。

5. **Google Fonts プライバシー（train-collection.html）**: M PLUS Rounded 1c は OFL ライセンスで商用・ウェブ使用とも問題ない。ただし Google Fonts CDN を使用すると訪問者の IP が Google に送信される。GDPR 準拠が必要な場合はセルフホスト化を検討すること。GitHub Pages（日本国内ユーザー向け）では現状は実務的リスクは低い。

---

## 注意事項

本レポートは AI による一次確認であり、法的効力を持ちません。
特に RED 判定の商標問題（Catan / Blokus / Corridor / Flip Seven / Indigo）は
各商標権者の方針によって差止請求や通知書の送付が行われる可能性があるため、
公開継続の判断については弁護士・弁理士への相談を推奨します。
