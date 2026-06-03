# 詳細設計書 — でんしゃずかんワールド

バージョン: 1.0.0
作成日: 2026-06-03
作成者: Plannerエージェント

---

## 1. 収録車両60両リスト

### レア度凡例
- L = レジェンド（3%）
- SR = スーパーレア（10%）
- R = レア（27%）
- C = コモン（60%）

### 1.1 新幹線系 15両

| # | id | よびかた(ひらがな) | 正式名称 | レア度 | 路線 | 地域 | primaryカラー | accentカラー | 形状特記 |
|---|---|---|---|---|---|---|---|---|---|
| 01 | shinkansen-nozomi | のぞみ | のぞみ（N700S） | L | 東海道・山陽新幹線 | tokai/sanyo | #FFFFFF | #006DB7 | 流線型ロングノーズ。白ボディ、青帯2本。先頭部が鋭く長い |
| 02 | shinkansen-doctor-yellow | ドクターイエロー | ドクターイエロー（923形） | L | 東海道・山陽新幹線 | tokai | #FFD700 | #FFD700 | 全身黄色。N700系と同形状だが全黄。幸せの新幹線 |
| 03 | shinkansen-500 | 500けい | 500系 | L | 山陽新幹線 | sanyo | #878787 | #0047AB | 円筒形断面の丸い車体。先頭が長く尖った砲弾型 |
| 04 | shinkansen-hayabusa | はやぶさ | はやぶさ（E5系） | SR | 東北・北海道新幹線 | tohoku | #006341 | #C8A951 | 先頭がロングノーズ。濃い緑（常磐グリーン）+金帯 |
| 05 | shinkansen-komachi | こまち | こまち（E6系） | SR | 秋田新幹線 | tohoku | #C80000 | #C0C0C0 | 鮮やかな赤ボディ。E5系と連結。先頭部がやや短め |
| 06 | shinkansen-kagayaki | かがやき | かがやき（W7系） | SR | 北陸新幹線 | hokuriku | #FFFFFF | #0A2472 | 白ボディ、紺青の帯（銀帯も）。先頭部が緩やかな流線型 |
| 07 | shinkansen-mizuho | みずほ | みずほ（N700系8000番台） | SR | 山陽・九州新幹線 | sanyo/kyushu | #FFFFFF | #004EA2 | N700系ベース。青帯。九州乗り入れ |
| 08 | shinkansen-sakura | さくら | さくら（N700系7000番台） | R | 山陽・九州新幹線 | sanyo/kyushu | #FFFFFF | #E83929 | 白ボディ、赤帯2本。日本桜イメージ |
| 09 | shinkansen-hikari | ひかり | ひかり（N700A） | R | 東海道新幹線 | tokai | #FFFFFF | #006DB7 | のぞみと同形N700A。帯は同じ青。別種ではなく別愛称 |
| 10 | shinkansen-kodama | こだま | こだま（700系） | R | 東海道新幹線 | tokai | #FFFFFF | #004EA2 | 700系。先頭部がカモノハシ型（フラットなノーズ） |
| 11 | shinkansen-tsubame | つばめ | つばめ（800系） | R | 九州新幹線 | kyushu | #FFFFFF | #C0A000 | 白ボディ、ゴールド帯。木目内装が特徴的 |
| 12 | shinkansen-linear | リニア | リニアモーターカー（L0系） | L | リニア中央新幹線 | tokai | #FFFFFF | #006DB7 | 超流線型。先端が非常に鋭い。磁気浮上を連想させる |
| 13 | shinkansen-toki | とき | とき（E7系） | R | 上越新幹線 | kanto/niigata | #FFFFFF | #CC2200 | 白ボディ、赤帯。E7系ベース |
| 14 | shinkansen-nasuno | なすの | なすの（E5系） | C | 東北新幹線 | tohoku | #006341 | #C8A951 | はやぶさと同形E5系だが各駅停車種別 |
| 15 | shinkansen-tsubasa | つばさ | つばさ（E8系） | R | 山形新幹線 | tohoku | #C80000 | #FFD700 | 赤ボディ、金帯。E6系後継機種。山形新幹線ミニ新幹線 |

### 1.2 特急・在来線系 20両

| # | id | よびかた | 正式名称 | レア度 | 路線 | 地域 | primaryカラー | accentカラー | 形状特記 |
|---|---|---|---|---|---|---|---|---|---|
| 16 | limited-thunderbird | サンダーバード | サンダーバード（683系） | R | 北陸本線（大阪〜金沢） | kansai/hokuriku | #FFFFFF | #003DA5 | 白ボディ、青帯。流線型先頭部 |
| 17 | limited-azusa | あずさ | あずさ（E353系） | R | 中央本線（新宿〜松本） | kanto/chubu | #FFFFFF | #CC3300 | 白ボディ、赤ライン。流線型先頭。斬新なデザイン |
| 18 | limited-odoriko | おどりこ | 踊り子（E257系） | C | 東海道本線（東京〜伊豆） | kanto | #FFFFFF | #CC3300 | 白ボディ、赤帯。前面に大きな窓 |
| 19 | limited-kuroshio | くろしお | くろしお（287系） | C | 阪和線・きのくに線 | kansai | #FFFFFF | #006341 | 白ボディ、緑帯。パンダ柄先頭も一部あり |
| 20 | limited-shimakaze | しまかぜ | しまかぜ（50000系） | SR | 近鉄特急（名古屋〜賢島） | tokai | #C8A900 | #4B3B00 | 金色・ゴールドを基調とした豪華なデザイン |
| 21 | limited-laview | ラビュー | Laview（001系） | SR | 西武池袋線 | kanto | #C0C0C0 | #F0F0A0 | 銀色の丸いフォルム。大きな丸い窓が特徴 |
| 22 | limited-romancecar | ロマンスカー | ロマンスカーGSE（70000形） | SR | 小田急線 | kanto | #FF5500 | #FFFFFF | 鮮やかな朱赤。展望席を持つ流線型 |
| 23 | limited-haruka | はるか | はるか（281系） | R | 関空快速（大阪〜関西空港） | kansai | #006341 | #FFFFFF | 濃い緑。関空アクセス特急 |
| 24 | limited-wc99 | ウエストエクスプレス | WEST EXPRESS 銀河（117系） | R | 山陰本線・伯備線 | chugoku | #282840 | #C0C0C0 | ダークネイビーに星空をイメージした帯 |
| 25 | limited-yufuin | ゆふいんのもり | ゆふいんの森（キハ72系） | R | 久大本線（博多〜由布院） | kyushu | #006341 | #C8A951 | 深緑ボディ、ウッド調内装。クラシックな特急 |
| 26 | limited-kirara | キラキラうえつ | きらきらうえつ（485系） | R | 羽越本線（新潟〜酒田） | tohoku | #C8A951 | #FFFFFF | 金色を基調とした観光列車。側面に日本海と花 |
| 27 | limited-sunrise | サンライズ | サンライズ瀬戸・出雲（285系） | SR | 東海道・山陽・伯備線 | nationwide | #FF6600 | #FFFFFF | オレンジ+白のツートン。夜行寝台特急 |
| 28 | limited-hitachi | ひたち | ひたち（E657系） | R | 常磐線（上野〜仙台） | kanto/tohoku | #FFFFFF | #CC2200 | 白ボディ、赤ライン。すっきりした流線型 |
| 29 | limited-kintetsu-ace | アーバンライナー | アーバンライナーnext（21020系） | R | 近鉄特急（名古屋〜大阪） | tokai/kansai | #C0C0C0 | #003DA5 | シルバー+ブルー。スタイリッシュな近鉄特急 |
| 30 | limited-kamome | かもめ | かもめ（885系） | R | 長崎本線（博多〜長崎） | kyushu | #FFFFFF | #003DA5 | 白ボディ、青帯。曲面ガラスの先頭部 |
| 31 | limited-hida | ひだ | ひだ（HC85系） | R | 高山本線（名古屋〜富山） | tokai/hokuriku | #006341 | #C8A951 | 緑+金のハイブリッド気動車 |
| 32 | limited-saphir | サフィール | サフィール踊り子（E261系） | SR | 東海道本線（東京〜伊豆） | kanto | #0A2472 | #C8A951 | 深い紺青ボディ、金帯。全席グリーン車 |
| 33 | limited-tokyo-metro | メトロ | 東京メトロ1000系（銀座線） | C | 東京メトロ銀座線 | kanto | #FF9500 | #FFFFFF | オレンジ一色の丸みを帯びた車体 |
| 34 | limited-odakyu-3000 | ロマンスカーEXE | ロマンスカーEXE（30000形） | R | 小田急線 | kanto | #C0C0C0 | #003DA5 | シルバー+ブルー。量産型ロマンスカー |
| 35 | limited-yakumo | やくも | やくも（381系） | C | 伯備線（岡山〜松江） | chugoku | #CC3300 | #FFFFFF | 赤+白の古典的な振り子式特急 |

### 1.3 ローカル・観光列車系 10両

| # | id | よびかた | 正式名称 | レア度 | 路線 | 地域 | primaryカラー | accentカラー | 形状特記 |
|---|---|---|---|---|---|---|---|---|---|
| 36 | local-itozakura | いとざくら | いとざくら（キハ40系改造） | R | いさぶろう・しんぺい号（肥薩線） | kyushu | #CC6688 | #FFFFFF | ピンク桜柄のラッピング列車 |
| 37 | local-orenji | オレンジ | おれんじ食堂（HISATSU ORANGE RAILWAY） | R | 肥薩おれんじ鉄道 | kyushu | #FF6600 | #FFFFFF | 鮮やかなオレンジ一色の観光列車 |
| 38 | local-joyful-train | のってたのしい | ながら（313系8000番台） | C | 東海道本線（ムーンライトながら） | kanto/tokai | #FFFFFF | #003DA5 | 青帯の普通車。夜行快速として有名 |
| 39 | local-tanada | たなだ | たなだ（えちごトキめき鉄道観光急行） | R | えちごトキめき鉄道 | niigata | #CC3300 | #C8A951 | 赤と金の観光急行スタイル |
| 40 | local-kyushu-sweet | スイート | ある列車（D&S列車） | SR | 大村線 | kyushu | #C8A900 | #FFFFFF | 豪華な黄金色の観光列車。水戸岡デザイン |
| 41 | local-sagano | さがのとろっこ | 嵯峨野トロッコ列車 | R | 嵯峨野観光鉄道 | kansai | #8B6914 | #228B22 | 木製風の茶色、オープンエアな観光列車 |
| 42 | local-furano | ふらの | ノロッコ号（富良野） | R | 富良野線 | hokkaido | #4682B4 | #FFFFFF | 青い開放客車+機関車。ラベンダー畑の列車 |
| 43 | local-nanairo | ななつぼし | ななつ星in九州（77系） | L | 九州全域（クルーズ） | kyushu | #4B3B00 | #C8A951 | ダークブラウン+ゴールド。超豪華クルーズ列車 |
| 44 | local-seto-ohashi | せとおおはし | マリンライナー（223系5000番台） | C | 瀬戸大橋線（岡山〜高松） | chugoku/shikoku | #FFFFFF | #003DA5 | 白+青の2階建て連絡特急 |
| 45 | local-tsunan | つなん | 津南ロマン（越後心動鉄道） | C | 北越急行ほくほく線 | niigata | #006341 | #FFFFFF | 緑の地方ローカル電車 |

### 1.4 SL・特殊車両系 5両

| # | id | よびかた | 正式名称 | レア度 | 路線 | 地域 | primaryカラー | accentカラー | 形状特記 |
|---|---|---|---|---|---|---|---|---|---|
| 46 | sl-c57 | SLやまぐち | SL やまぐち号（C57形） | SR | 山口線 | chugoku | #1C1C1C | #C0C0C0 | 黒い蒸気機関車。シリンダーと大きな動輪が特徴 |
| 47 | sl-paleo | SLパレオ | SLパレオエクスプレス（C58形） | SR | 秩父鉄道 | kanto | #1C1C1C | #CC3300 | 黒い機関車。赤いヘッドマークが目印 |
| 48 | sl-hitoyoshi | SLひとよし | SL人吉（8620形） | SR | 肥薩線 | kyushu | #1C1C1C | #C8A951 | 黒いSL。金色の装飾が豪華。レトロ客車を牽引 |
| 49 | monorail-tokyo | モノレール | 東京モノレール1000形 | C | 東京モノレール | kanto | #FFFFFF | #CC3300 | 白ボディ、赤帯。跨座式モノレール特有の細い車体 |
| 50 | train-maglev-test | リニアてすと | リニア実験線（MLX01） | SR | リニア実験線（山梨） | chubu | #FFFFFF | #003DA5 | 実験車両。超流線型。機首が非常に細い |

### 1.5 レジェンド枠（L確定・希少5両）

（のぞみ・ドクターイエロー・500系・リニアL0系・ななつ星はすでに01〜50に含む。以下は追加L枠）

| # | id | よびかた | 正式名称 | レア度 | 路線 | 地域 | primaryカラー | accentカラー | 形状特記 |
|---|---|---|---|---|---|---|---|---|---|
| 51 | legend-ef66 | EF66 | EF66形電気機関車（ブルートレイン牽引機） | L | 東海道本線ほか | nationwide | #003DA5 | #C8A951 | 青い電気機関車。ヘッドライトが目立つ大型機関車 |
| 52 | legend-0kei | 0けい | 0系新幹線 | L | 東海道新幹線（引退済） | tokai | #FFFFFF | #003DA5 | 丸いノーズ、丸い窓。初代新幹線の象徴的な形 |

### 1.6 コモン枠（地方の普通電車 8両）

| # | id | よびかた | 正式名称 | レア度 | 路線 | 地域 | primaryカラー | accentカラー | 形状特記 |
|---|---|---|---|---|---|---|---|---|---|
| 53 | local-yamanote | やまのてせん | 山手線（E235系） | C | 山手線 | kanto | #9ACD32 | #FFFFFF | 黄緑色一色。楕円形路線の代名詞 |
| 54 | local-chuo | ちゅうおうせん | 中央線（E233系） | C | 中央線快速 | kanto | #FF4500 | #FFFFFF | オレンジ一色のシンプルな通勤電車 |
| 55 | local-osaka-kanjo | おおさかかんじょう | 大阪環状線（323系） | C | 大阪環状線 | kansai | #FF4500 | #FFFFFF | オレンジ。大阪の環状線 |
| 56 | local-sapporo-subway | さっぽろちかてつ | 札幌市営地下鉄（6000形） | C | 札幌市営地下鉄南北線 | hokkaido | #006341 | #FFFFFF | 緑色、ゴムタイヤ走行のゴム系地下鉄 |
| 57 | local-kyushu-817 | つうきんでんしゃ | 817系（九州） | C | 鹿児島本線ほか | kyushu | #CC3300 | #FFFFFF | 赤帯の九州の汎用通勤型電車 |
| 58 | local-hokkaido-kiha | ほっかいどうディーゼル | キハ40系（北海道色） | C | 北海道各路線 | hokkaido | #CC3300 | #C8A951 | 赤+クリームのツートン。北海道の気動車 |
| 59 | local-hiroshima-streetcar | ひろしまでんしゃ | 広島電鉄800形 | C | 広島電鉄 | chugoku | #CC3300 | #FFFFFF | 赤い路面電車。低床で古典的な形 |
| 60 | local-toden-7000 | とでん | 東京都電荒川線（7000形） | C | 東京都電荒川線 | kanto | #FFD700 | #006341 | 黄色い路面電車。緑ラインアクセント |

---

## 2. すごろくマス36個の定義

| # | 地域コード | 地域名 | マス種別 | 車両ID | コイン最小 | コイン最大 | 特記 |
|---|---|---|---|---|---|---|---|
| 1 | hokkaido | ほっかいどう（スタート） | normal | local-hokkaido-kiha | 10 | 20 | ゲーム開始マス |
| 2 | hokkaido | ほっかいどう | normal | local-sapporo-subway | 10 | 30 | |
| 3 | tohoku | あおもり | normal | shinkansen-hayabusa | 15 | 30 | |
| 4 | tohoku | もりおか | special | shinkansen-komachi | 20 | 40 | こまち出発演出 |
| 5 | tohoku | せんだい | normal | shinkansen-hayabusa | 10 | 20 | |
| 6 | tohoku | やまがた | normal | shinkansen-tsubasa | 10 | 30 | |
| 7 | tohoku | あきた | bonus | shinkansen-komachi | 30 | 50 | ボーナスマス +30コイン |
| 8 | kanto | うえの | normal | limited-hitachi | 10 | 20 | |
| 9 | kanto | とうきょう | special | shinkansen-nozomi | 20 | 50 | のぞみ出発演出 |
| 10 | kanto | しんじゅく | normal | limited-azusa | 15 | 30 | |
| 11 | kanto | よこはま | normal | local-yamanote | 10 | 20 | |
| 12 | chubu | あたみ | normal | limited-odoriko | 10 | 30 | |
| 13 | chubu | しずおか | normal | shinkansen-kodama | 10 | 20 | |
| 14 | tokai | なごや | bonus | limited-shimakaze | 30 | 50 | ボーナスマス |
| 15 | tokai | しんおおさか | special | shinkansen-nozomi | 20 | 40 | のぞみ到着演出 |
| 16 | kansai | きょうと | normal | local-sagano | 10 | 30 | |
| 17 | kansai | おおさか | normal | local-osaka-kanjo | 10 | 20 | |
| 18 | kansai | しんこうべ | normal | shinkansen-hikari | 15 | 25 | |
| 19 | chugoku | ひろしま | normal | local-hiroshima-streetcar | 10 | 20 | |
| 20 | chugoku | おかやま | normal | local-seto-ohashi | 15 | 30 | |
| 21 | chugoku | やまぐち | special | sl-c57 | 20 | 40 | SL蒸気演出 |
| 22 | shikoku | たかまつ | normal | local-seto-ohashi | 10 | 20 | |
| 23 | kyushu | はかた | bonus | shinkansen-sakura | 30 | 50 | ボーナスマス |
| 24 | kyushu | くまもと | normal | shinkansen-tsubame | 10 | 30 | |
| 25 | kyushu | ひとよし | special | sl-hitoyoshi | 20 | 40 | SL蒸気演出 |
| 26 | kyushu | かごしま | special | local-kyushu-sweet | 15 | 35 | ある列車演出 |
| 27 | kyushu | なかのしま | normal | local-orenji | 10 | 20 | |
| 28 | hokuriku | かなざわ | normal | shinkansen-kagayaki | 15 | 30 | |
| 29 | hokuriku | とやま | normal | limited-hida | 10 | 25 | |
| 30 | niigata | にいがた | normal | shinkansen-toki | 10 | 20 | |
| 31 | tohoku | もどり | bonus | shinkansen-nasuno | 20 | 40 | 折り返し・コイン多め |
| 32 | kanto | にっこう | special | limited-romancecar | 15 | 30 | ロマンスカー演出 |
| 33 | nationwide | よる | special | limited-sunrise | 20 | 50 | サンライズ夜行演出 |
| 34 | nationwide | たび | special | local-nanatseboshi | 25 | 50 | ななつ星演出（id:local-kyushu-sweet） |
| 35 | nationwide | おいわい | bonus | legend-0kei | 30 | 60 | 0系登場！ボーナスマス |
| 36 | nationwide | ゴール！ | goal | shinkansen-linear | 0 | 0 | ゴール演出 + コイン200固定 |

---

## 3. スタンプラリー駅30個の定義

座標はCanvas幅・高さに対する%位置。日本地図は縦長SVG/Canvas描画を前提。

| # | id | 駅名ひらがな | 駅名漢字 | 路線 | posX% | posY% | 路線グループ | 対応車両ID |
|---|---|---|---|---|---|---|---|---|
| 01 | sapporo | さっぽろ | 札幌 | 函館本線 | 68 | 8 | hakodate | local-hokkaido-kiha |
| 02 | shin-hakodate-hokuto | しんはこだてほくと | 新函館北斗 | 北海道新幹線 | 65 | 14 | hokkaido-shinkansen | shinkansen-hayabusa |
| 03 | shin-aomori | しんあおもり | 新青森 | 東北新幹線 | 69 | 20 | tohoku-shinkansen | shinkansen-hayabusa |
| 04 | morioka | もりおか | 盛岡 | 東北・秋田新幹線 | 72 | 26 | tohoku-shinkansen | shinkansen-komachi |
| 05 | sendai | せんだい | 仙台 | 東北新幹線 | 70 | 31 | tohoku-shinkansen | shinkansen-hayabusa |
| 06 | yamagata | やまがた | 山形 | 山形新幹線 | 66 | 32 | yamagata-shinkansen | shinkansen-tsubasa |
| 07 | akita | あきた | 秋田 | 秋田新幹線 | 62 | 28 | akita-shinkansen | shinkansen-komachi |
| 08 | ueno | うえの | 上野 | 東北新幹線 | 71 | 38 | tohoku-shinkansen | limited-hitachi |
| 09 | tokyo | とうきょう | 東京 | 東海道新幹線 | 72 | 39 | tokaido-shinkansen | shinkansen-nozomi |
| 10 | shin-yokohama | しんよこはま | 新横浜 | 東海道新幹線 | 71 | 40 | tokaido-shinkansen | shinkansen-nozomi |
| 11 | atami | あたみ | 熱海 | 東海道本線 | 70 | 42 | izu | limited-odoriko |
| 12 | shizuoka | しずおか | 静岡 | 東海道新幹線 | 68 | 43 | tokaido-shinkansen | shinkansen-kodama |
| 13 | nagoya | なごや | 名古屋 | 東海道新幹線 | 61 | 44 | tokaido-shinkansen | limited-shimakaze |
| 14 | kyoto | きょうと | 京都 | 東海道新幹線 | 56 | 44 | tokaido-shinkansen | local-sagano |
| 15 | shin-osaka | しんおおさか | 新大阪 | 東海道・山陽新幹線 | 54 | 45 | tokaido-sanyo-shinkansen | shinkansen-nozomi |
| 16 | osaka | おおさか | 大阪 | 大阪環状線 | 53 | 46 | osaka-loop | local-osaka-kanjo |
| 17 | shin-kobe | しんこうべ | 新神戸 | 山陽新幹線 | 51 | 46 | tokaido-sanyo-shinkansen | shinkansen-hikari |
| 18 | okayama | おかやま | 岡山 | 山陽新幹線 | 48 | 46 | tokaido-sanyo-shinkansen | local-seto-ohashi |
| 19 | hiroshima | ひろしま | 広島 | 山陽新幹線 | 43 | 47 | tokaido-sanyo-shinkansen | shinkansen-500 |
| 20 | kokura | こくら | 小倉 | 山陽・九州新幹線 | 35 | 49 | kyushu-shinkansen | shinkansen-sakura |
| 21 | hakata | はかた | 博多 | 九州新幹線 | 33 | 51 | kyushu-shinkansen | shinkansen-tsubame |
| 22 | kumamoto | くまもと | 熊本 | 九州新幹線 | 35 | 54 | kyushu-shinkansen | shinkansen-tsubame |
| 23 | kagoshima-chuo | かごしまちゅうおう | 鹿児島中央 | 九州新幹線 | 37 | 60 | kyushu-shinkansen | shinkansen-mizuho |
| 24 | nagano | ながの | 長野 | 北陸新幹線 | 65 | 39 | hokuriku-shinkansen | shinkansen-kagayaki |
| 25 | kanazawa | かなざわ | 金沢 | 北陸新幹線 | 59 | 39 | hokuriku-shinkansen | shinkansen-kagayaki |
| 26 | fukui | ふくい | 福井 | 北陸新幹線 | 58 | 41 | hokuriku-shinkansen | shinkansen-kagayaki |
| 27 | niigata | にいがた | 新潟 | 上越新幹線 | 65 | 35 | joetsu-shinkansen | shinkansen-toki |
| 28 | takasaki | たかさき | 高崎 | 上越新幹線 | 69 | 37 | joetsu-shinkansen | shinkansen-toki |
| 29 | shin-yamaguchi | しんやまぐち | 新山口 | 山陽新幹線 | 40 | 49 | tokaido-sanyo-shinkansen | sl-c57 |
| 30 | nishi-kagoshima | にしかごしま | 指宿枕崎線（観光） | 指宿枕崎線 | 38 | 63 | kyushu-local | local-orenji |

### 路線グループとコンプリート称号

| 路線グループ | 称号 | 対象駅数 |
|---|---|---|
| tokaido-shinkansen | 「のぞみマスター」 | 8駅（東京〜博多系） |
| tohoku-shinkansen | 「はやぶさマスター」 | 5駅 |
| kyushu-shinkansen | 「つばめマスター」 | 5駅 |
| hokuriku-shinkansen | 「かがやきマスター」 | 3駅 |
| joetsu-shinkansen | 「ときマスター」 | 2駅 |
| akita-shinkansen | 「こまちマスター」 | 1駅 |
| yamagata-shinkansen | 「つばさマスター」 | 1駅 |
| hokkaido-shinkansen | 「はやぶさほっかいどうマスター」 | 1駅 |

---

## 4. クイズ問題データ 50問

### 難易度: かんたん（新幹線のみ）15問

| # | id | 正解車両ID | ダミー1 | ダミー2 | ダミー3 |
|---|---|---|---|---|---|
| q001 | quiz-easy-001 | shinkansen-nozomi | shinkansen-hikari | shinkansen-kodama | shinkansen-hayabusa |
| q002 | quiz-easy-002 | shinkansen-hayabusa | shinkansen-komachi | shinkansen-kagayaki | shinkansen-nozomi |
| q003 | quiz-easy-003 | shinkansen-komachi | shinkansen-tsubasa | shinkansen-hayabusa | shinkansen-sakura |
| q004 | quiz-easy-004 | shinkansen-doctor-yellow | shinkansen-nozomi | shinkansen-hikari | shinkansen-kodama |
| q005 | quiz-easy-005 | shinkansen-500 | shinkansen-kodama | shinkansen-hikari | shinkansen-nozomi |
| q006 | quiz-easy-006 | shinkansen-kagayaki | shinkansen-toki | shinkansen-nozomi | shinkansen-sakura |
| q007 | quiz-easy-007 | shinkansen-sakura | shinkansen-mizuho | shinkansen-tsubame | shinkansen-kagayaki |
| q008 | quiz-easy-008 | shinkansen-tsubame | shinkansen-sakura | shinkansen-mizuho | shinkansen-kagayaki |
| q009 | quiz-easy-009 | shinkansen-hikari | shinkansen-nozomi | shinkansen-kodama | shinkansen-sakura |
| q010 | quiz-easy-010 | shinkansen-kodama | shinkansen-hikari | shinkansen-nozomi | shinkansen-toki |
| q011 | quiz-easy-011 | shinkansen-toki | shinkansen-kagayaki | shinkansen-komachi | shinkansen-kodama |
| q012 | quiz-easy-012 | shinkansen-tsubasa | shinkansen-komachi | shinkansen-sakura | shinkansen-toki |
| q013 | quiz-easy-013 | shinkansen-mizuho | shinkansen-sakura | shinkansen-tsubame | shinkansen-hikari |
| q014 | quiz-easy-014 | shinkansen-linear | shinkansen-nozomi | shinkansen-500 | shinkansen-hayabusa |
| q015 | quiz-easy-015 | legend-0kei | shinkansen-500 | shinkansen-kodama | shinkansen-hikari |

### 難易度: ふつう（特急含む）20問

| # | id | 正解車両ID | ダミー1 | ダミー2 | ダミー3 |
|---|---|---|---|---|---|
| q016 | quiz-normal-001 | limited-thunderbird | limited-azusa | limited-haruka | shinkansen-kagayaki |
| q017 | quiz-normal-002 | limited-azusa | limited-thunderbird | limited-odoriko | limited-hitachi |
| q018 | quiz-normal-003 | limited-shimakaze | limited-romancecar | limited-sunrise | limited-saphir |
| q019 | quiz-normal-004 | limited-laview | limited-romancecar | limited-shimakaze | limited-sunrise |
| q020 | quiz-normal-005 | limited-romancecar | limited-laview | limited-odakyu-3000 | limited-shimakaze |
| q021 | quiz-normal-006 | limited-sunrise | limited-shimakaze | limited-saphir | limited-romancecar |
| q022 | quiz-normal-007 | limited-saphir | limited-sunrise | limited-odoriko | limited-haruka |
| q023 | quiz-normal-008 | limited-yufuin | limited-kamome | limited-hida | limited-kuroshio |
| q024 | quiz-normal-009 | limited-kamome | limited-yufuin | limited-thunderbird | limited-haruka |
| q025 | quiz-normal-010 | limited-hitachi | limited-azusa | limited-thunderbird | limited-haruka |
| q026 | quiz-normal-011 | limited-haruka | limited-kuroshio | limited-hitachi | limited-kamome |
| q027 | quiz-normal-012 | limited-hida | limited-yufuin | limited-thunderbird | limited-kamome |
| q028 | quiz-normal-013 | limited-odoriko | limited-azusa | limited-saphir | limited-hitachi |
| q029 | quiz-normal-014 | limited-kuroshio | limited-haruka | limited-kamome | limited-yufuin |
| q030 | quiz-normal-015 | limited-kintetsu-ace | limited-shimakaze | limited-romancecar | limited-laview |
| q031 | quiz-normal-016 | limited-wc99 | limited-sunrise | limited-hitachi | limited-azusa |
| q032 | quiz-normal-017 | limited-kirara | limited-thunderbird | limited-hida | limited-kamome |
| q033 | quiz-normal-018 | limited-yakumo | limited-odoriko | limited-kuroshio | limited-haruka |
| q034 | quiz-normal-019 | limited-tokyo-metro | local-yamanote | local-chuo | local-osaka-kanjo |
| q035 | quiz-normal-020 | limited-odakyu-3000 | limited-romancecar | limited-laview | limited-kintetsu-ace |

### 難易度: むずかしい（ローカル・SL・特殊含む）15問

| # | id | 正解車両ID | ダミー1 | ダミー2 | ダミー3 |
|---|---|---|---|---|---|
| q036 | quiz-hard-001 | sl-c57 | sl-paleo | sl-hitoyoshi | limited-yufuin |
| q037 | quiz-hard-002 | sl-paleo | sl-c57 | sl-hitoyoshi | local-sagano |
| q038 | quiz-hard-003 | sl-hitoyoshi | sl-c57 | sl-paleo | local-kyushu-sweet |
| q039 | quiz-hard-004 | local-nanatseboshi | limited-kyushu-sweet | sl-hitoyoshi | limited-yufuin |
| q040 | quiz-hard-005 | local-sagano | local-furano | limited-yufuin | sl-c57 |
| q041 | quiz-hard-006 | local-furano | local-sagano | local-tsunan | local-hokkaido-kiha |
| q042 | quiz-hard-007 | local-itozakura | local-orenji | local-furano | local-kyushu-sweet |
| q043 | quiz-hard-008 | local-orenji | local-itozakura | local-kyushu-sweet | limited-yufuin |
| q044 | quiz-hard-009 | local-kyushu-sweet | local-nanatseboshi | local-orenji | sl-hitoyoshi |
| q045 | quiz-hard-010 | local-yamanote | local-chuo | local-osaka-kanjo | limited-tokyo-metro |
| q046 | quiz-hard-011 | local-chuo | local-yamanote | local-osaka-kanjo | local-sapporo-subway |
| q047 | quiz-hard-012 | local-osaka-kanjo | local-yamanote | local-chuo | limited-haruka |
| q048 | quiz-hard-013 | monorail-tokyo | limited-tokyo-metro | local-toden-7000 | local-hiroshima-streetcar |
| q049 | quiz-hard-014 | local-hiroshima-streetcar | local-toden-7000 | monorail-tokyo | limited-tokyo-metro |
| q050 | quiz-hard-015 | local-toden-7000 | local-hiroshima-streetcar | monorail-tokyo | local-yamanote |

---

## 5. ガチャ確率テーブル

```
レア度   確率   概要
L      3%    のぞみ・ドクターイエロー・500系・リニアL0系・ナナツ星・EF66・0系（7両）
SR     10%   はやぶさ・こまち・かがやき・みずほ・シマカゼ・ラビュー・ロマンスカーGSE・
             サンライズ・サフィール・ある列車・SL3種・リニア試験車・SLパレオ（計16両）
R      27%   残りの特急・新幹線系（中間レア度）（計22両）
C      60%   通勤電車・地方ローカル・各地の普通電車（計15両）

ピティシステム:
- ガチャ毎回、pityカウンターを+1
- pityカウンターが10になった時、必ずSR以上を排出
- SR以上排出時（ピティによらず）、pityカウンターを0にリセット

10連ガチャのピティ:
- 10連の10枚目は必ずSR以上（pityカウンター状態に関係なく）
- 10連開始時にpityが9の場合、1枚目でSR確定後も残り9枚は通常確率

重複時処理:
- 既収集車両が出た場合、コイン10枚に自動変換（「もっているよ！コイン10まい！」）
```

---

## 6. コイン経済設計

### 初期・定常供給

| 獲得イベント | コイン数 | 頻度 |
|---|---|---|
| ゲーム開始時（初回） | 100 | 一度のみ |
| デイリーログインボーナス | 30 | 1日1回 |
| スタンプラリー1駅クリア | 10 | 全30駅 |
| スタンプラリー路線コンプリート | 100 | 各路線1回 |
| たんていクイズ正解 | 20 | 1日5問まで |
| たんていクイズ不正解 | 5 | 1日5問まで |
| たびすごろく通常マス | 10〜50 | マス毎 |
| たびすごろくボーナスマス | 30〜60 | マス毎 |
| たびすごろくゴール | 200 | 周回毎 |
| 重複ガチャ排出 | 10 | 排出毎 |

### 消費設計

| 消費イベント | コイン数 |
|---|---|
| ガチャ1回 | 50 |
| ガチャ10回 | 450 |

### 経済バランス試算

- デイリーログイン継続で1週間で: 30×7 = 210コイン
- クイズ5問/日 × 7日: 平均15コイン/日 × 7 = 105コイン
- スタンプラリー全駅コンプリート（一度のみ）: 30×10 + 路線ボーナス = 1,100コイン以上
- すごろく1周（平均マス獲得25コイン × 36マス = 900コイン + ゴール200 = 1,100コイン）

- ガチャ1回50コインなので、デイリーのみで週2回ガチャ可能
- すごろく1周でガチャ22回分（意欲的な目標）
- **子どもが詰まらず、でも収集完了まで数週間かかる**ちょうど良い設計

---

## 7. ファイル構成案

```
c:\Users\hifuk\Documents\Git_hub\hide_0001_hon\
├── train-zukan.html          ← メインHTMLファイル（全機能インライン）
├── data/
│   └── trains.js             ← window.TRAINS_DATA を定義するJSファイル
└── assets/
    └── trains/
        ├── shinkansen-nozomi.png
        ├── shinkansen-doctor-yellow.png
        ├── shinkansen-500.png
        ├── shinkansen-hayabusa.png
        ├── shinkansen-komachi.png
        ├── shinkansen-kagayaki.png
        ├── shinkansen-mizuho.png
        ├── shinkansen-sakura.png
        ├── shinkansen-hikari.png
        ├── shinkansen-kodama.png
        ├── shinkansen-tsubame.png
        ├── shinkansen-linear.png
        ├── shinkansen-toki.png
        ├── shinkansen-nasuno.png
        ├── shinkansen-tsubasa.png
        ├── limited-thunderbird.png
        ├── limited-azusa.png
        ├── limited-odoriko.png
        ├── limited-kuroshio.png
        ├── limited-shimakaze.png
        ├── limited-laview.png
        ├── limited-romancecar.png
        ├── limited-haruka.png
        ├── limited-wc99.png
        ├── limited-yufuin.png
        ├── limited-kirara.png
        ├── limited-sunrise.png
        ├── limited-hitachi.png
        ├── limited-kintetsu-ace.png
        ├── limited-kamome.png
        ├── limited-hida.png
        ├── limited-saphir.png
        ├── limited-tokyo-metro.png
        ├── limited-odakyu-3000.png
        ├── limited-yakumo.png
        ├── local-itozakura.png
        ├── local-orenji.png
        ├── local-joyful-train.png
        ├── local-tanada.png
        ├── local-kyushu-sweet.png
        ├── local-sagano.png
        ├── local-furano.png
        ├── local-nanatseboshi.png
        ├── local-seto-ohashi.png
        ├── local-tsunan.png
        ├── sl-c57.png
        ├── sl-paleo.png
        ├── sl-hitoyoshi.png
        ├── monorail-tokyo.png
        ├── train-maglev-test.png
        ├── legend-ef66.png
        ├── legend-0kei.png
        ├── local-yamanote.png
        ├── local-chuo.png
        ├── local-osaka-kanjo.png
        ├── local-sapporo-subway.png
        ├── local-kyushu-817.png
        ├── local-hokkaido-kiha.png
        ├── local-hiroshima-streetcar.png
        └── local-toden-7000.png
```

---

## 8. Canvas API 実装メモ

### 8.1 車両走行アニメーション実装方針

```javascript
// TrainAnimator クラス
class TrainAnimator {
  constructor(canvasId, vehicleId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.x = -256;          // 画面外左から開始
    this.speed = 2;         // px/frame
    this.img = new Image();
    this.img.src = `assets/trains/${vehicleId}.png`;
    this.rafId = null;
  }

  start() {
    this.x = -256;
    const loop = () => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      // 線路描画（灰色の直線 + 枕木）
      this.drawTrack();
      // 車両描画
      this.ctx.drawImage(this.img, this.x, 40, 256, 80);
      this.x += this.speed;
      // 画面右端を超えたら左端に折り返し
      if (this.x > this.canvas.width + 10) this.x = -256;
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  drawTrack() {
    const ctx = this.ctx;
    const y = 120; // レール高さ
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 4;
    // レール2本
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.canvas.width, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, y + 10); ctx.lineTo(this.canvas.width, y + 10); ctx.stroke();
    // 枕木（等間隔）
    ctx.strokeStyle = '#5C4A2A';
    ctx.lineWidth = 3;
    for (let i = 0; i < this.canvas.width; i += 30) {
      ctx.beginPath();
      ctx.moveTo(i, y - 4);
      ctx.lineTo(i, y + 14);
      ctx.stroke();
    }
  }
}
```

### 8.2 ガシャポン演出実装方針

```javascript
// GachaAnimator クラス
class GachaAnimator {
  // フェーズ管理: 'idle' → 'spin' → 'drop' → 'reveal'
  // idle: 待機状態（筐体静止）
  // spin: ハンドル回転（0→360度、duration: 1200ms、ease-out）
  // drop: カプセルが排出口から落下（translateY: -100 → 0、bounce）
  // reveal: カプセル割れアニメ → 車両フルカラー表示

  // イージング関数（ease-out cubic）
  easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  // ハンドル回転アニメーション
  // Canvas上のハンドル部分だけ ctx.save() / ctx.rotate() / ctx.restore()
  drawHandle(rotation) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(handleCenterX, handleCenterY);
    ctx.rotate(rotation * Math.PI / 180);
    // ハンドル描画
    ctx.restore();
  }

  // カプセル落下（バウンスイージング）
  // bounceEase(t): t=0〜1で、1を超えてバウンスする
  bounceEase(t) {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1/d1) return n1*t*t;
    if (t < 2/d1) return n1*(t-=1.5/d1)*t+0.75;
    if (t < 2.5/d1) return n1*(t-=2.25/d1)*t+0.9375;
    return n1*(t-=2.625/d1)*t+0.984375;
  }
}
```

### 8.3 すごろく盤面描画方針

```javascript
// SugorokuRenderer クラス
// 盤面: 日本地図を背景としたCanvas（全幅×65vh）
// マス配置: S字形（蛇腹状）に36マスを配置
// 各マス: 丸い角の正方形（80×80px）
// マス内: 地域アイコン（絵文字/テキスト）+ マス番号

class SugorokuRenderer {
  // マス座標の計算
  // 行1（左→右）: マス1〜10
  // 行2（右→左）: マス11〜20
  // 行3（左→右）: マス21〜30
  // 行4（右→左）: マス31〜36 + ゴール
  getSquarePosition(index) {
    const row = Math.floor((index - 1) / 10);
    const col = (index - 1) % 10;
    const x = row % 2 === 0
      ? col * squareWidth + margin
      : (9 - col) * squareWidth + margin;
    const y = row * squareHeight + margin;
    return { x, y };
  }

  // 駒描画: 丸い電車アイコン（32×32px）
  // プレイヤー駒は現在のマスの上に配置
  // サイコロアニメ: 数字を高速切り替え（50ms間隔）→ 徐々に減速 → 停止
}
```

### 8.4 スタンプラリー日本地図描画方針

```javascript
// JapanMapRenderer クラス
// 地図: Canvas全幅×70vhの描画領域
// 背景: 薄い青（海） + 日本列島の多角形描画（簡略化SVGパス相当）
// 日本列島は Canvas fillPath で手書き多角形を使用
// 駅アイコン: 円（直径20px）+ 駅名テキスト（12px）
// 取得済み: 路線カラーで塗りつぶし
// 未取得: グレー（#888）

// タップ判定: 各駅の座標から半径30px以内をタップ判定（子ども指サイズ対応）
// touchstart / mousedown イベントで判定
canvas.addEventListener('touchstart', (e) => {
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const x = (touch.clientX - rect.left) * (canvas.width / rect.width);
  const y = (touch.clientY - rect.top) * (canvas.height / rect.height);
  const hit = stations.find(s => {
    const sx = s.posX / 100 * canvas.width;
    const sy = s.posY / 100 * canvas.height;
    return Math.hypot(x - sx, y - sy) < 30;
  });
  if (hit) openDoorGame(hit);
});
```

### 8.5 ドアタイミングゲーム実装方針

```javascript
// DoorTimingGame クラス
// Canvas: 300×200px
// 左ドア: x=0 から中央へ移動（速度: 1.5px/frame）
// 右ドア: x=300 から中央へ移動（速度: 1.5px/frame）
// 中央ゾーン: x=130〜170（40px幅のグリーンゾーン）
// タップ判定: 両ドアが中央ゾーン内にある時にタップ = 成功
// 成功: ドアが閉まる演出 + コイン + スタンプ付与
// 失敗: ドアが通過し端まで消える → 再び開いて再チャレンジ（ペナルティなし）

// 難易度調整案: 一発成功を要求しない（子ども向け）
// ゾーン幅を広め（40px）に設定し、何度でも挑戦可能
```

### 8.6 シルエット表示実装方針

```javascript
// QuizSilhouette クラス
// 手法: Canvas globalCompositeOperation を使用
// 1. 車両画像を描画
// 2. globalCompositeOperation = 'source-atop' で黒矩形を重ねる
// → 透過部分は黒にならず、車両部分のみ黒くなる

function drawSilhouette(ctx, img, x, y, w, h) {
  ctx.save();
  ctx.drawImage(img, x, y, w, h);                   // まず通常描画
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = '#000000';
  ctx.fillRect(x, y, w, h);                          // 黒で上書き（透過部分は無効）
  ctx.restore();
}

// 正解後の演出:
// 1. 黒シルエット状態からフェードアウト（globalAlpha: 1 → 0, 500ms）
// 2. フルカラー画像をフェードイン（globalAlpha: 0 → 1, 500ms）
// 3. 走行アニメーション（TrainAnimator）を起動
```

---

## 9. Code-Generatorへの実装指示

### 9.1 ファイル作成指示

1. `c:\Users\hifuk\Documents\Git_hub\hide_0001_hon\train-zukan.html` を新規作成
2. `c:\Users\hifuk\Documents\Git_hub\hide_0001_hon\data\trains.js` を新規作成（`trains.json`の内容をJS変数として定義）
3. `c:\Users\hifuk\Documents\Git_hub\hide_0001_hon\assets\trains\` ディレクトリを作成（グラフィックはGraphic-Designerが後から格納）

### 9.2 HTMLファイルの構造

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>でんしゃずかんワールド</title>
  <style>
    /* インラインCSS: 全画面分 */
    /* ベース: 黒背景、子ども向けは内部で色調変更可 */
  </style>
</head>
<body>
  <!-- 各画面のDIVコンテナ（display:none/flex で切り替え） -->
  <div id="screen-splash" class="screen">...</div>
  <div id="screen-home" class="screen">...</div>
  <div id="screen-zukan" class="screen">...</div>
  <div id="screen-gacha" class="screen">...</div>
  <div id="screen-minigame-select" class="screen">...</div>
  <div id="screen-stamp" class="screen">...</div>
  <div id="screen-quiz" class="screen">...</div>
  <div id="screen-sugoroku" class="screen">...</div>

  <!-- モーダル -->
  <div id="modal-train-detail" class="modal hidden">...</div>
  <div id="modal-daily-bonus" class="modal hidden">...</div>
  <div id="modal-gacha-result" class="modal hidden">...</div>
  <div id="modal-door-game" class="modal hidden">...</div>

  <!-- データロード（fetchなし・インライン変数） -->
  <script src="data/trains.js"></script>
  <!-- ゲームロジック（全インライン） -->
  <script>
    // StorageManager, GameState, ScreenManager, 各Screenクラス, TrainAnimator, SoundManager
  </script>
</body>
</html>
```

### 9.3 CSS設計指針

```css
/* ベースリセット */
* { box-sizing: border-box; margin: 0; padding: 0; touch-action: manipulation; }
body { background: #0a0a0f; font-family: 'M PLUS Rounded 1c', 'Hiragino Maru Gothic ProN', sans-serif; }

/* 画面切り替え */
.screen { display: none; width: 100%; min-height: 100dvh; }
.screen.active { display: flex; flex-direction: column; }

/* モーダル */
.modal { display: none; position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.8); }
.modal:not(.hidden) { display: flex; align-items: center; justify-content: center; }

/* ボタン共通（96px以上のタップ領域） */
.btn-game {
  min-height: 96px;
  min-width: 96px;
  border-radius: 16px;
  font-size: 22px;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

/* アニメーション: ボタンバウンス */
@keyframes btnBounce {
  0% { transform: scale(1); }
  50% { transform: scale(0.92); }
  100% { transform: scale(1); }
}
.btn-game:active { animation: btnBounce 0.15s ease; }
```

### 9.4 SoundManager実装指示

```javascript
class SoundManager {
  constructor() {
    this.ctx = null;  // AudioContext（初回タップ時に初期化）
    this.muted = StorageManager.getMute();
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  // コイン獲得音: 短い上昇音 (C5→E5, 0.1秒)
  playCoin() { this._playTone(523, 659, 0.1); }

  // タップ音: 短いクリック (800Hz, 0.05秒)
  playTap() { this._playTone(800, 800, 0.05); }

  // 正解音: 明るい3音 (C5→E5→G5, 各0.1秒)
  playCorrect() { /* 3音連続 */ }

  // 不正解音: 低い2音 (D4→B3, 0.15秒)
  playWrong() { /* 2音連続 */ }

  // ガチャ排出音: ランダムなジリジリ音 (0.5秒)
  playGacha() { /* ノイズ+上昇音 */ }

  // SR以上排出音: ファンファーレ (5音, 0.8秒)
  playRareGet() { /* 5音ファンファーレ */ }

  _playTone(startFreq, endFreq, duration) {
    if (this.muted || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(endFreq, this.ctx.currentTime + duration);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }
}
```

### 9.5 Graphic-Designerへの指示サマリー

以下の仕様でPNG画像（256×128px、背景透過）を60両分作成すること:

- サイズ: 256px × 128px（横長）、背景完全透過PNG
- 視点: 側面図（左向き / 進行方向は右）
- スタイル: 子ども向けイラスト風（輪郭線あり、平面的・明るい色）
- 品質: 拡大してもジャギーが目立ちにくい程度の品質
- 各車両のcolorコードと形状特記事項は本設計書の車両リストを参照すること
- ファイル名: `assets/trains/[id].png`（idはvehicle IDと完全一致）

特にGraphic-Designerが注意すべき形状:
- のぞみ（N700S）: 非常に長いロングノーズ
- 500系: 丸い断面、砲弾型先頭
- ドクターイエロー: 全身黄色（N700S同形）
- ラビュー（001系）: 丸みのある未来的フォルム、大きな丸窓
- リニアL0系: 先端が細く非常に鋭い
- SL各種: 大きな動輪、シリンダー、煙突
- 路面電車（広島・都電）: 箱型で低床、パンタグラフが目立つ
