# 法務チェックレポート — トップページ掲載ゲーム全体（再点検）

実施日: 2026-10-13
担当: legal-checker（AIによる一次確認。法的効力なし。最終判断は弁護士等の専門家へ）
対象: `index.html` 掲載ゲーム（`agent-data.js` GAMES 48本）＋ツール `retro-emulator.html` ＋ index から辿れる関連ページ（`kart_racer` `kage_shura_den` `pinball` `iroha_karuta` `tri_territory` `hexlan` `tetra_territory` `gradius-1`）
前回: `legal/homepage_games_legal_audit_2026-10-08.md`（10-08〜10-10）

## 方法と限界（先に明記）
- 横断 grep（商標・作品名・実在人物・企業名）、CDN/フォント/外部URL、README/manifest/credits、marketing 文面、`git log` による 10-10 以降の変更洗い出し。
- 画像は Read で目視したもの: club-road（match-sprites / club-crests / title-stadium / stadium-levels）、burst-brawlers（新規7ステージ全部＋logo / fahren / hagane / effects / game-thumb）、lumina-tamer（items / people / monsters-1〜5）、namarigasawa（clinic / police-box / public-hall / inn / mining-office 外壁、zombies、town-concept）、underpass-anomaly（branding / posters / figures / decals）、nurinuri（aqua / pinky）、eclipse（hero-atlas）、catan（terrain / sprites）、blokus-hero、nes/retro-console、world-tour（moscow / tokyo）、turbo-kart atlas、trains（vehicles atlas 01/02）、yokai（kappa.jpg / yuki-onna.jpg / enhanced/kappa）、IG画像2枚。
- **目視していない**（記録・文字列のみで判定）: burst-brawlers の他キャラ約20枚、eclipse の他5枚、namarigasawa の他、nurinuri のステージ、lumina の battlefields/tiles、sengoku/sanguo/genpei/taihei/bakumatsu の画像、hyakki / beat_em_up / kage_shura / pippa の画像、hex / corridor / othello / checkers の atlas、音声（聴取していない）。
- **ネット到達不可**（`commons.wikimedia.org` / `images.unsplash.com` はプロキシが拒否、WebFetch も名前解決不可）。J-PlatPat・TMview での商標検索も未実施。
- 商標・著作権の判断は「見た目の印象」「リスクの程度」であり、侵害の断定ではない。

## サマリー
| レベル | 件数 |
|---|---|
| RED（即時修正必須） | **0** |
| YELLOW（要対応） | **18**（うち優先度高 5、低〜中 13） |
| GREEN | 下表のとおり（ゲーム単位は判定表参照） |

RED はなし。ただし **Y1（クラブロードの3本線）は「RED 相当に近い YELLOW」**で、公開を止めるかは深澤さん判断（解釈が割れる論点）。

---

## YELLOW（要対応）— 優先度順

### 優先度 高
| # | 対象（ファイル:行） | 問題内容 | 是正アクション | 状態 |
|---|---|---|---|---|
| Y1 | `assets/club-road/match-sprites.webp`（club_road.html） | 選手4種（青・赤・白・GK黄）の袖・肩に斜めの**3本線**が明瞭に見える（目視再確認）。著名スポーツメーカーの3本線に近い。**未解決（前回から変化なし）** | 袖の線を外す／別柄（単色の帯・1本線・ドット）へ描き直し。同レイアウト・同解像度（1774×887）でWebP差替え → `verify-game-assets` / `verify-asset-format` | 継続 |
| Y2 | `assets/club-road/club-crests.webp` 2行目左（白鷺ウイングス） | 白い鶴＋赤い日の丸の盾。航空会社の鶴丸ロゴを連想。**未解決** | 鶴の向き・赤円を変える（例: 別の鳥／青系）。`club_road.html:106` の色指定も合わせる | 継続 |
| Y3 | `assets/js/agent-data.js:207-214`、`marketing/social_game_spotlight.md:1625,1637,1648,1660,1672,1683`、`marketing/game-spotlight-posts.generated.js` | 説明文が「**カタン風**ボードゲーム」「**Catan-style**」「**ブロックス風**」「**Blokus-style**」。aliases に `カタン`/`catan`/`ブロックス`/`blokus`。GAMES の href が旧URL `catan.html`/`blokus.html`（転送ページ）のまま。**これが X/Bluesky の自動投稿文になる**（`marketing/post-log.json` は空＝未投稿。次回 Auto Social Post は水曜 21:00 JST）。ほかに club-road の alias `サカつく風`、burst-brawlers の alias `大乱闘`（ともに他社作品名由来） | desc を「資源集めの陣取りボードゲーム」「ポリオミノ陣取り」等へ、aliases から商標語を除去、href を `hexlan.html`/`tetra_territory.html` へ。`node scripts/gen-game-spotlight-posts.mjs` で再生成 → `verify-social-posts.mjs` / `agent-evolve-check.mjs`。**投稿前に実施** | **新規** |
| Y4 | `gradius-1.html`（URL・`:14` og:description・`:20` twitter:description「グラジウス風横スクロールシューティング」・`:68` `function Gradius`）、リンク文言「グラジウス」: `galactic-assault.html:1805` / `hyakki.html:1865` / `dark_fantasy_rpg.html:1819`、`sitemap.xml:214` | 他社の著名シューティングの名称（グラディウス）に1字違いの表記を、URL・SNSメタ・3つの掲載ゲームの相互リンクに使用。タイトルは VECTOR VANGUARD に改称済みだが URL/メタが残る。`galactic-assault`（火山→モアイ→ピラミッド…＋リング弾）は段構成が同種の先行作品を想起（型は参考扱い） | `vector_vanguard.html` へ改称＋旧URLは転送ページ、メタ・リンク文言・sitemap を修正、関数名置換。galactic の段名・モアイ敵は「型の類似」として要検討 | **新規** |
| Y5 | `scripts/gen-instagram-images.mjs:35`、`assets/marketing/ig-03-board.jpg` | 焼き込み画像に「**バックギャモン・オセロ**」。オセロは登録商標。Instagram へ配布される画像（配布形態が焼き込みに変わった例）。未投稿だが次回投稿で出る | 「リバーシ」へ変更 → `node scripts/gen-instagram-images.mjs` で再生成（JPEG固定） | **新規** |

### 優先度 中〜低
| # | 対象 | 問題内容 | 是正アクション | 状態 |
|---|---|---|---|---|
| Y6 | `burst_brawlers.html:283`（描画は `:1170`） | キャラ選択画面に `Fahren / zelda_like` が**画面表示**される（旧名 zelda を表示）。`kage_shura_den.html:175` のコメントにも「zelda_like流儀」 | 表示を `Fahren Quest / fahren_quest` に。コメントも置換 | 継続（前回Y2の取りこぼし） |
| Y7 | `lumina_tamer.html`（「ジム」16・「ジムリーダー」7・「バッジ」15・「ずかん」6・ミモザ「はかせ」15・「チャンピオン」2）、agent-data「ジムリーダーに挑む」、`assets/lumina-tamer/monsters-1/2/3/5.webp` | 捕獲球・ナース・草水電気6体は解消を確認。残: 炎の狐（炎の尾の小型狐）、青い冠羽の鳥の進化形、岩の角獣、ドリル鼻のモグラ、大樹の精は「中〜低」。全体の語彙・構造（博士・ジム・バッジ・図鑑・ライバル）は人気モンスターRPGと同型。特定キャラとの一致は見当たらない | 「ジムリーダ→試練の守り手」等へ語彙を独自化。炎の狐の尾・耳を描き直し | 継続（縮小） |
| Y8 | `assets/namarigasawa/{clinic,community-center,inn,mining-office,police-box,public-hall}-facade.webp` | 「from supplied reference」で追加された写真調の外壁6枚（512×256以下）。**参考画像の出所は未解決**。実在の廃墟の写真に由来するなら著作権・撮影地の論点。README にも未記載（README は18枚分のみ、実体は26枚）。タイトル・alias の「屍人」は有名ホラー作品の用語を連想（低） | 深澤さんに出所を確認し README に記録（自分で撮影／生成AI／第三者写真）。第三者写真なら差替え | 継続 |
| Y9 | `assets/*/README.md`（burst-brawlers / club-road / eclipse-castle / lumina-tamer / namarigasawa / nurinuri-arena / underpass-anomaly / audio） | 「要確認」欄（生成ツール・日付・プロンプト要旨・類似目視）が**全て空欄**。ファイル一覧が旧名 `.png`（実体は `.webp`）、**新規画像が未掲載**（burst-brawlers の `stage-*.webp` 7枚、namarigasawa の weapons/zombies/town-concept 等、nurinuri のステージ）。`assets/trains/manifest.json` は「自作SVG」だが実際は生成AIのWebPアトラス（`generated/source/`）。`assets/catan` `assets/conhex` `assets/corridor` `assets/hex` `assets/othello` 等に出自記録なし（`world-tour` と `turbo-kart-gpt` は prompts あり＝良好）。BGM 2本（taihei/bakumatsu-dawn.wav）も制作方法不明 | 深澤さんが欄を記入。ファイル名を `.webp` に更新し新規分を追記（削除でなく**記録の追加**） | 継続 |
| Y10 | `mahjong.html:2943`、`assets/mahjong-real/README.md` | 牌SVG（Shizhao）のライセンス未確認。README は「Public domain＋GPL等のメタ情報」と曖昧、画面表記にライセンス名なし | Commons の各ファイルページを確認し表記を追加。確認できなければ自作牌へ | 継続（ネット不可で**未確認**） |
| Y11 | `assets/hanafuda/`（SVG 49枚） | CC BY-SA の出典確認済みは2枚のみ。残りは Commons 照合が未実施。加工物（サムネ）は SA 継承対象 | 各ファイルのページ照合、`card-back.svg` の出自記録 | 継続（未確認） |
| Y12 | `hexlan.html:553` `btn_monopoly:'Play Monopoly'`（英語UIに表示）、`:471,706-716` `CATAN_ASSETS`、`:478` コメント、`assets/catan/gpt-image-2-catan-*.webp`（ファイル名公開） | URL・題名は解消。英語UIに別商標「Monopoly」、コード・フォルダ名に CATAN が残存。用語「開拓地」「独占」は公式日本語版に近い | 英語を「Resource Monopoly」等へ、識別子/フォルダを `hexlan` へ（動的パスは手で直す・`verify-game-assets` 必須）。盤面アートはリソース5種＋盗賊駒など汎用で、公式の見た目の複製ではない | 継続（縮小） |
| Y13 | フォルダ・URL 名: `assets/zelda-like/`、`assets/blokus/`（`manifest.json` に `blokus-redrawn`）、`assets/conhex/`、`assets/nes/`、**`assets/catan/`（前回リスト外）**、`assets/blokus-trigon-thumb.svg`、`othello.html`（URL・sitemap・JSON-LD）、`corridor.html`（URL・`:251` aria-label「コリドール盤面」・alias `コリドール`＝市販名）、`FamicomEmulatorWin/`（リポジトリ直下）、`nes-emulator.html` / `zelda_like.html` / `catan.html` / `blokus.html` 転送ページ | 未改称（無言で絵が消える危険があるため据え置き中）。`credits.html:54` は旧称「FAMICOM ROOM」のまま | 参照が少ないものから順に改称＋全検査。`credits.html` を RETRO 8-BIT ROOM に。`FamicomEmulatorWin` は改称または非公開 | 継続 |
| Y14 | `assets/nes/retro-console.webp`、`retro-emulator.html` の「1983 — PLAY IT AGAIN」 | ロゴ無しだがベージュ＋赤茶の本体・ディスクドライブは任天堂機を強く想起。注意書き・GPL表記・ROM非同梱は確認済み（`git ls-files` にROM/BIOSなし） | 配色・形を変える（例: 青灰系）／年号表記の削除 | 継続（縮小） |
| Y15 | `assets/turbo-kart-gpt/asset-atlas-gpt-image-2.webp`、`assets/world-tour/nurburgring.webp`（キー名 `kart_racer.html:266`） | 「?」付きアイテムボックス立方体＋流星の星アイテムが有名カートレースの意匠を連想。コース名は「アイフェル・フォレストリング」に改称済みだがファイル名にレース場名 | 「?」を別記号に、星を別形に。ファイル名変更 | **新規（低）** |
| Y16 | `assets/underpass-anomaly/posters.webp` 左下 | 「ひんやり 緑茶 冷茶」の緑PETボトル広告が実在飲料を想起し得る。ほか「8番出口」型の構造は `credits.html` に着想注記あり | ラベル意匠をより汎用に | **新規（低）** |
| Y17 | `index.html:1484,1497,1521`（うかぶ？しずむ？／AI将棋／GALACTIC ASSAULT のサムネ） | Unsplash 写真を直リンク（クレジット無し、`credits.html` 未記載）。Unsplash ライセンスは無償利用可・表記任意だが、画像内容（人物・商標）は**ネット不可で未確認**。他5件（`:2075-2127`）はゲーム外の生活情報カード | 自前画像に置換、または `credits.html` に出典追記、画像の中身確認 | **新規（低・未確認）** |
| Y18 | `assets/estate-tycoon/{dice,house,money-stack}.svg`（game-icons, CC BY 3.0）、`assets/yokai/{kappa,nue,yuki-onna,zashiki}.jpg` | 前者は**未使用のまま公開ツリーに残り**、帰属表示なし（README は「使用中」と古いまま）。後者は古い絵巻のスキャンと見られ、**どこからも参照されず出典記録なし**（WebP方針違反でもある）。 | いずれも不要なら削除、残すなら出典と表記を追記 | 継続／**新規** |

### 付記（YELLOW に数えない低リスク）
- `credits.html` に `marked`（MIT）／`DOMPurify`（Apache-2.0 or MPL-2.0）／`jsQR`（Apache-2.0）／Freesound CC0 録音（`locker-cry.wav`・実在乳児の録音、CC0）の記載なし。追記推奨。
- `club_road.html` の選手名は姓×名の自動生成。実在選手と偶然一致し得る（低）。クラブ名24は架空で、実在クラブ・スポンサー名は見当たらない。
- `tetra_territory.html:1261` コメントの「ブロックスルール」、`prismfall.html`（掲載外）の「テトリス風」コメント、`flip_seven.html`（掲載外・sitemap外）の「FLIP SEVEN」文言、`farlan.html`（掲載外・sitemap掲載）。同種の残存。
- `index.html` の趣味欄（漫画作品名）・生活情報カード（実在商業施設へのリンク）は事実の記載／リンクのみ。
- 新名称（HEXLAN, Gem Gates, Cell Connect, Tetra/Tri Territory, Fahren Quest, Club Road, Lumina Tamer, Blast Brawlers 等）の**商標調査は未実施**。

---

## 前回（10-08〜10-10）からの変化
**解消を確認**: ルミナの捕獲球→結晶・ナース→薬師・草水電気6体／URL・題名の改称（fahren_quest, hexlan, tetra/tri_territory, gem_gates, cell_connect, retro-emulator。転送ページ有り）／藤井棋風・実在棋士名（grep 0件）／オセロ・シムシティ・上海の本文表記／ROM・GPL・鉄道・着想の注意書き／`credits.html`／鉛ヶ沢以外の出所不明テクスチャは見当たらず。新規ステージ7枚（burst-brawlers）は汎用景観（凱旋門風・東京タワー・虹橋風・桜島・桂浜など）で問題なし。
**継続**: Y1, Y2, Y8, Y9（欄は全て空）, Y10, Y11, Y13（フォルダ名）。
**新規発見**: Y3（自動投稿文・alias）, Y4（グラディウス系）, Y5（IG画像のオセロ）, Y6（画面表示の zelda_like）, Y15〜Y18、`assets/catan` 名、`credits.html` の旧称。
**10-13 の WebP 一括変換**: 画像の内容変更はなし。README・manifest の拡張子と一覧が実体とずれたまま（Y9）。

---

## ゲーム単位の判定表（G=GREEN、Y#=該当YELLOW）
| # | ゲーム（href） | 判定 | 備考 |
|---|---|---|---|
| 1 | BLACK FANG (beat_em_up) | G | 独自キャラ、README有。音はコード生成 |
| 2 | ファーレンクエスト (fahren_quest) | G（Y6, Y13） | Kenney/ATMANAN CC0、出自良好。フォルダ名 zelda-like 残存、burst_brawlers側の表示 |
| 3 | AI将棋 (shogi) | G（Y17） | 棋士名なし。サムネが Unsplash |
| 4 | AIチェス (chess) | G | |
| 5 | AI麻雀 (mahjong) | Y10 | 牌SVGライセンス未確認 |
| 6 | AI花札 (hanafuda) | Y11 | CC BY-SA 表記あり、残49枚未照合 |
| 7 | 百人一首かるた | G | 和歌は保護期間外 |
| 8 | AI囲碁 (go) | G | |
| 9 | AIリバーシ (othello) | Y13, Y5 | URL・IG画像にオセロ |
| 10 | Backgammon AI | G | |
| 11 | 街区王 (estate-tycoon) | Y18 | 実在企業名なし。未使用 CC BY 素材が残存 |
| 12 | Ludo Neon Dice | G | CC0/PD 表記あり |
| 13 | Chinese Checkers | G | PD 表記あり |
| 14 | Checkers AI | G | |
| 15 | ノーラックポーカー | G | |
| 16 | ドットアンドボックス | G | |
| 17 | ヘックス (hex) | G | atlas出自記録なし（Y9） |
| 18 | Cell Connect | G | 設計者名・市販名は削除済み |
| 19 | Gem Gates | G | 同上 |
| 20 | Carrom | G | 外部素材なし |
| 21 | モーメンタム・テリトリー | G | |
| 22 | 麻雀ソリティア | G | 「上海」文言は解消 |
| 23 | うかぶ？しずむ？ | Y17 | Unsplash サムネ |
| 24 | 将棋RPG Enhanced | G（Y18） | AI生成妖怪画。旧JPG4枚が未参照で残存 |
| 25 | BUBBLE RESCUE CLIMBER | G | |
| 26 | GALACTIC ASSAULT | Y4 | 「グラジウス」リンク、型の類似 |
| 27 | CITY BUILDER | G | 「シムシティ風」は解消 |
| 28 | 三国志・天下三分 | G | 歴史人物（故人）。目視せず |
| 29 | 戦国風雲記 | G | Wikipedia CC BY-SA の範囲を credits に明記済み。目視せず |
| 30 | 源平争乱記 | G | 既存法務チェックGREEN |
| 31 | 太平風雲記 | G | BGM出自は Y9 |
| 32 | でんしゃずかんワールド | Y9（旧Y12継続） | 実在塗装の再現。非公式注記あり（`:476`）。manifest が実態と不一致 |
| 33 | トランプゲーム集 | G | 自作CC0 |
| 34 | Typing Dojo | G | |
| 35 | 影の権力者 | G | 歴史人物のみ |
| 36 | 百鬼演武録 | Y4 | 「グラジウス」リンクのみ |
| 37 | ウォールチェイス (corridor) | Y13 | URL・aria-label・alias に市販名 |
| 38 | ピッパの月灯りランタン | G | |
| 39 | ルミナ・テイマー | Y7 | 縮小して継続 |
| 40 | ぬりぬりアリーナ | G（Y9） | キャラは独自（インクタンク＋銃のジェリー体）。メカニクスは保護対象外。出自欄は空 |
| 41 | ねじれ地下道 | Y16 | 着想注記あり |
| 42 | 鉛ヶ沢 ― 屍人の夜 | Y8 | 外壁6枚の出所 |
| 43 | ぶっ飛びブロウラーズ | Y6, Y3(alias) | 新規7ステージは問題なし。ロゴ・キャラも既存作品との一致なし。出自欄は空 |
| 44 | 月蝕城 | G（Y9） | ドット絵の作風は格闘ゲーム系に近いが特定キャラ一致なし |
| 45 | クラブロード | **Y1, Y2**, Y3(alias) | 最優先 |
| 46 | 幕末風雲記 | G | 肖像64は故人のAI想像図。出自記録なし（Y9） |
| 47 | HEXLAN AI (catan.html→hexlan) | Y3, Y12, Y13 | GAMES の href・説明が旧名のまま |
| 48 | テトラ陣地 (blokus.html→tetra_territory) | Y3, Y13 | 同上 |
| T | RETRO 8-BIT ROOM (retro-emulator) | Y14 | EmulatorJS 4.2.3 GPL-3.0 / コア GPL-2.0 を CDN 読込・表記あり。ROM/BIOS非同梱、注意書き有 |
| 追 | トライ陣地 / ターボカート / 影修羅伝 / NEON(GLASS) PINBALL / いろは / AI Notebook / ことのは | tri: G（Y13系）, kart: Y15, 他 G | notebook は「NotebookLM風」の説明（Google製品名・低）。marked/DOMPurify を credits に追記 |

## 外部読込（GREEN）
Google Fonts（Orbitron/Fira Code/Noto Serif JP/M PLUS Rounded 1c/Yuji Boku＝SIL OFL。IP送信は `privacy.html` が一般論で言及）／React・ReactDOM・Babel（MIT）・GSAP（標準ライセンス）／EmulatorJS（上記）／marked・DOMPurify（CDN）。いずれも条件充足。Fruit-water の unpkg は版未固定・SRI なし（Security 管轄）。

## 掲載文の承認示唆（項目6）
index.html・agent-data・marketing に「公式」「提携」「公認」等の承認を示唆する語はなし（GREEN）。ただし他社作品名を挙げる「〜風」表記が残る（Y3）。

## 未確認事項
1. Wikimedia Commons（麻雀牌 Shizhao・花札49枚）の現行ライセンス。2. Unsplash 画像の内容。3. J-PlatPat/TMview による新名称の商標調査。4. 目視していない画像群・音声の聴取（上記「限界」）。5. 鉛ヶ沢外壁の参考画像の出所、生成ツール・プロンプト（深澤さんの記入待ち）。

## 次の担当
- Y1, Y2, Y15, Y16 → `graphic-designer`（描き直し後 Asset-Guardian・Legal 再チェック）
- Y3, Y4, Y5, Y6, Y12, Y13 → `code-generator`（Y3 は水曜の自動投稿前に）
- Y8〜Y11, Y17, Y18 → 深澤さん確認・記録追加（削除より記録を第一候補）

## 注意事項
本レポートは AI による一次確認であり法的効力を持ちません。重大リスクの判断（特に Y1 の公開継続可否・商用利用の解釈）は専門家へ。
