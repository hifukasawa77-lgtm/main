# 法務総点検レポート — トップページ掲載ゲーム全体

実施日: 2026-10-08
対象: `index.html` に掲載の約50本のゲーム（カード一覧）と、その `assets/`・出典表記・外部読込
方法: ソース／READMEの静的調査（商標語・実在人物名・素材ライセンス・出自記録・外部読込）
前提: 非商用の個人ポートフォリオ（GitHub Pages）。**法的な最終判断は弁護士に委ねる前提の早期発見レポート**。

## 限界（先に明記）
- `commons.wikimedia.org` へ到達できず、**麻雀牌SVG（Shizhao）の現行ライセンスは未確認**。
- 画像の「見た目が既存キャラに似ていないか」は全点を目視していない（記録と文字列からの判定）。
- 商標の登録状況は記憶ベース。J-PlatPat での確認は未実施。

## サマリー
| レベル | 件数 |
|---|---|
| RED（即時修正必須） | **0** |
| YELLOW（要対応） | 15 |
| GREEN | 素材・ライブラリの大半（末尾） |

明白な侵害（権利者素材の同梱・ROM配布・無断利用）は見つからなかった。ただし、**他社の登録商標を名称・URL・説明文に使っている箇所**と、**出自の記録が無い生成画像**が残っている。

---

## YELLOW（要対応）— 優先度順

### Y1 `nes-emulator.html`（ツール欄）— 任天堂の名称・意匠の使用
- タイトル「FAMICOM ROOM」、画面に「FAMILY COMPUTER」「ファミコン」「FAMICOM / NES / DISK SYSTEM」。
- 本体画像（ベージュ＋赤茶の本体・コントローラー）はロゴ無しだが、ファミコンを強く想起させる配色と形。
- ROMは同梱せず利用者のファイルを端末内で読む方式（**違法配布には当たらない**）。ただし**「ご自身が適法に所有するデータのみ」という注意が無い**。
- EmulatorJS（GPL-3.0）・FCEUmm/Nestopia（GPL-2.0）をCDN読込。リンクはあるがライセンス名の明示が無い。
- **対応**: 名称を一般名（例: 「8bitレトロ機ルーム」）へ。ブランド名は「対応形式の説明」だけに限定。注意書き（自己所有ROMのみ・当サイトはROMを提供しない・任天堂等とは無関係）を追加。GPLライセンス名を表記。

### Y2 `zelda_like.html` — URL・パス・内部名に "zelda"
- 表示名は「ファーレンクエスト」へ改称済み（`legal/zelda_quest_legal_report.md` のRED-1/2は解消）。
- 残り: URL `zelda_like.html`、`assets/zelda-like/`、`agent-data.js` の slug `zelda`、`burst_brawlers.html` の `source:'Fahren / zelda_like'`。URLは検索結果にも出る。
- 素材は Kenney・ATMANAN（CC0）＋自作生成。生成プロンプトに「no Zelda/Nintendo likeness」を明記済みで**出自記録は良好**。
- **対応**: `fahren_quest.html` へ移し、旧URLは転送ページに。内部名も置換。

### Y3 `agent-data.js` に実在棋士の名前が残存
- `shogi` の説明が「**藤井棋風AI**」（en: Fujii-style）。`shogi.html` 本体は「電竜・幻石」へ改称済みで、**案内チャットだけ古い**。実在の存命棋士名で、本人の関与を示唆する書き方。
- **対応**: 「電竜・幻石の2つの棋風AI」へ修正（`/agent-evolve` の検査対象）。

### Y4 「オセロ」は登録商標（株式会社メガハウス）
- `othello.html` のtitleは「Reversi AI」だが、description「AIオセロ」、index/agent-dataのカード名「AIオセロ」、`mahjong.html` 内リンク「オセロ」、スコア名 `'オセロ'`。
- **対応**: 表記を「リバーシ」に統一。

### Y5 `catan.html`（表示名 HEXLAN）— CATANの完全実装
- 表示名は変更済み。ルールそのものは著作権で保護されない。一方、**URL `catan.html`・コード内 `CATAN_ASSETS`・gameId `catan`**にCATAN（Catan GmbH）の商標が残る。「開拓地」「最長道路」「最大軍勢」「VP10点」など公式用語に近い語、発展カード名 "Monopoly" も同様。
- **対応**: URLを `hexlan.html` へ。用語を独自語に寄せる。盤面・駒画像が公式の見た目に寄っていないかを目視。

### Y6 `blokus.html` / `blokus_trigon.html` — Mattel商標のURL・フォルダ
- 表示名は「テトラ陣地」「トライ陣地」へ改称済み。ただし URL・`assets/blokus/`・コメントにBlokus。**Trigon版は市販品 Blokus Trigon のほぼ同一内容**（三角ピース×菱形盤）。
- **対応**: URL/フォルダ名の改称。説明文で市販品との関係を主張しない。

### Y7 `indigo.html` / `conhex.html` — 市販ゲーム名＋設計者名
- カード文言「ラインナー・クニツィアのヘックスタイル配置ゲーム」＋題名 "Indigo"。実在する出版物の名称で、**存命の設計者名を付けて関与を示唆**する形。ConHexも同様に市販ゲーム名。
- **対応**: 題名を汎用名へ、設計者名は削除（または公式の許諾）。

### Y8 他社ゲーム名による説明
- `cyber-city`: 「**シムシティ風**」（index.html・agent-data）。SimCity は EA の登録商標。
- `mahjong-solitaire`: 「**上海パズル**」（index.html・agent-data）。「上海」は Activision / サンソフトの商標。
- **対応**: 「都市育成シミュレーション」「麻雀牌ペアパズル」など一般語へ。`aliases` の `シムシティ`/`simcity`/`上海` も検索誘導になるので外す。

### Y9 `lumina_tamer.html` — ポケモン類似の構成
- 「ミモザはかせ→初期モンスター→ライバル→ジム4つ→バッジ→ずかん→チャンピオン候補→**バトルタワー**」という骨格がポケットモンスターと同型。ゲームの型は保護されないが、名称（バトルタワー等）と**キャラクターデザインの類似**は不正競争防止法・著作権の論点になり得る。**画像の生成元の記録（`assets/lumina-tamer/`）が無い**。
- **対応**: 生成元・プロンプトをREADMEに記録。38体を既存キャラと並べて目視。「バトルタワー」等の固有語を独自語へ。
- **【2026-10-08 追記・目視結果】`monsters-1.png` を確認したところ、草系（緑の斑点＋背中の蕾→開花）と水系（甲羅を背負う青い四足獣）が、著名なモンスターRPGの初期キャラの意匠に近いと受け取られ得る。YELLOW の中で**最優先**。描き直しを推奨。
  **全5枚の目視を完了**: 懸念が高いのは草系・水系・電気系の3系統（計6体）、中が炎系・岩系・ドリルモグラ、残り約20体は一般モチーフで特徴の一致なし。体別の表は `assets/lumina-tamer/README.md`。

### Y10 出自記録が無い生成画像群
> **【2026-10-08 追記】** 事後記録を整備（`assets/{lumina-tamer,burst-brawlers,eclipse-castle,underpass-anomaly,namarigasawa,audio}/README.md`、`assets/hanafuda/README.md` 補完）。履歴から確認できた事実のみ記し、**生成ツール・プロンプトは「要確認」欄として深澤さんの記入待ち**。訂正: `locker-cry.wav` は `audio-source.txt` に出典（Freesound the_yura・CC0、実在の乳児の録音）が記録済みで、「記録なし」は誤りだった。`taihei/bakumatsu-dawn.wav` は「自作」との自己申告のみで生成手段の記録なし。
- 記録なし: `assets/lumina-tamer/` `burst-brawlers/` `eclipse-castle/` `underpass-anomaly/` `namarigasawa/`。`sengoku-japan-map-user-v2.webp`（プロンプト無し・経緯のみ）。
- 音声: `assets/audio/taihei-dawn.wav` `bakumatsu-dawn.wav` `underpass-anomaly/locker-cry.wav` の**制作元・ライセンスの記録なし**。
- 生成AI画像は、日本では「AI生成物そのものに著作権が生じるか」「既存作品への依拠・類似」が論点。**記録が無いと問題発生時に潔白を示せない**。
- **対応**: 各フォルダに README（生成ツール・日付・プロンプト概要・「既存作品名を指定していない」旨）を追加。WAVは作成方法を記録（自作でないなら出典とライセンス）。

### Y11 CC BY-SA 素材の扱い（表示義務・継承）
- `mahjong.html`: 卓SVG（Mliu92・CC BY-SA 4.0）は表記あり。**牌SVG（Shizhao）はライセンス名が未表記**で、README上も「Public domain＋GPL等のメタ情報」と曖昧 → 要確認。
- `hanafuda.html`: Louie Mantia Jr. ほか CC BY-SA 4.0（表記あり、「未改変」と明記）。ただし README は2枚分しか列挙せず**`assets/hanafuda/` の50枚の出自が不完全**。READMEには「トップページのサムネイルに加工して使用」とあり、**加工物は同ライセンスで公開する義務（SA）**が生じる。
- `sengoku`: Wikipedia日本語版の要約（CC BY-SA 4.0）。帰属表示はゲーム内にあるが、**要約テキスト部分がCC BY-SA継承になる旨**の明示は無い。
- **対応**: 牌のライセンスをCommonsで確認して表記。50枚の一覧と加工有無をREADMEに。サイトに「CC BY-SA 部分の範囲」を明記。

### Y12 `train-collection.html` — 実在の車両名・列車愛称
- 48形式すべて実在（のぞみ・ドクターイエロー・ななつ星in九州・WEST EXPRESS 銀河・ロマンスカー・アーバンライナー・ゆいレール 等）。愛称・商品名の一部は鉄道会社の登録商標。ロゴは自作SVG扱いだが、**塗装（配色）の再現**はデザイン権・商標の論点になり得る。
- **対応**: 「非公式・各名称は各社に帰属」の注記。ロゴ・社章を描いていないことを画像で確認。

### Y13 `underpass_anomaly.html` — 「8番出口」との構造的類似
- 「異変を見つけたら引き返す／なければ進む／正解を8回続けて脱出」。アイデア・ルールは保護されないが、**構造がほぼ同一**。名称・画面・看板意匠は独自（確認済み）。
- **対応**: 「着想」として一言明記するか、回数・規則を少し変えて差別化。KOTAKE CREATE のガイドライン確認を推奨。

### Y14 その他の「型」の類似（低）
- `nurinuri_arena`（スプラトゥーン型：インクで塗る・潜って泳ぐ）、`burst_brawlers`（スマブラ型：ダメージ%で吹っ飛ぶ）、`namarigasawa`（「屍人」の語がSIRENを連想）、`kart_racer`（コード内コメントに「マリオカート風」）、`bubble_rescue`（コメントに「マリオ風レンガ」）。
- 名称・キャラは独自で、**ルール・メカニクスは保護対象外**。コード内コメントも含め、他社名の記述を削除するのが安全。

### Y15 サイト全体の権利表記が無い
- `index.html` に クレジット／ライセンス／商標の一括表記が無い（出典は各ページに散在）。
- **対応**: `credits.html`（素材・ライブラリ・ライセンス一覧、商標と非公式の注記、CC BY-SA範囲）を新設しフッターに追加。

---

## GREEN（問題なし）
| 対象 | 根拠 |
|---|---|
| Kenney Roguelike/RPG pack、Kenney Cartography | CC0（License.txt同梱） |
| ATMANAN Walking Character Set | CC0（README） |
| トランプSVG（`assets/cards`） | 自作CC0、LICENSE.txt同梱 |
| Ludo盤（Alpha Arts / Openclipart）・チャイニーズチェッカー盤 | CC0 / パブリックドメイン、表記あり |
| 街区王の game-icons（CC BY 3.0） | 現行ページでは**未使用**。表示義務は発生しないが、不使用ファイルは削除推奨 |
| でんしゃずかん音声 | 全てWeb Audioのプロシージャル生成 |
| Google Fonts（Orbitron/Fira Code/Noto Serif JP/M PLUS/Yuji Boku） | SIL OFL。※Google側へIPが送信される点はプライバシーポリシーでの言及を推奨 |
| React / Babel / GSAP（cdnjs・unpkg） | MIT／GSAP標準ライセンス（無償利用可） |
| 戦国・源平・三国志・太平記・幕末の人物 | 歴史上の人物で肖像権・パブリシティ権の問題なし。genpei は既存の法務チェックもGREEN（`claudechord-vault/deliverables/genpei_法務チェック.md`） |
| 百人一首・いろはかるた | 和歌・諺は保護期間外。現代語訳の収録は見当たらず |
| 将棋・囲碁・チェス・麻雀・花札・ドット＆ボックス・ヘックス等の一般ゲーム | ルールは保護対象外、名称も一般名 |
| 駒・コマの名前等のオリジナルキャラ（BLACK FANG, 月蝕城, 百鬼演武録, ピッパ 等） | 他作品名の指定記録なし（要・目視。Y10参照） |

---

## 推奨する実施順
1. **文言だけで直るもの**（すぐ・安全）: Y3 藤井、Y4 オセロ、Y8 シムシティ／上海、Y14 コメント内の他社名
2. **注意書き追加**: Y1 ROM／GPL、Y12 鉄道、Y15 credits.html
3. **出自記録の整備**: Y10、Y11（牌ライセンスはネットに出られる環境で確認）
4. **URL改称（転送ページ付き）**: Y2 zelda、Y5 catan、Y6 blokus
5. **名称変更の判断が要るもの**: Y1 FAMICOM ROOM、Y7 Indigo/ConHex、Y9 ルミナ・テイマー、Y13 8番出口類似

※ 1〜3 は私が実装可能です（4・5 は深澤さんの判断後）。本レポートは調査のみで、ゲーム本体は変更していません。

---

## 対応状況（2026-10-08 追記）
| 項目 | 状況 |
|---|---|
| Y3 藤井棋風／Y4 オセロ／Y8 シムシティ・上海／Y14 コメント | ✅ 文言修正済み |
| Y1 FAMICOM ROOM | ✅ 「RETRO 8-BIT ROOM」へ改称、注意書き・GPL表記追加、URL `retro-emulator.html` |
| Y2 zelda | ✅ URL `fahren_quest.html`（旧URLは転送ページ） |
| Y5 catan | ✅ URL `hexlan.html`（旧URLは転送ページ） |
| Y6 blokus | ✅ URL `tetra_territory.html` / `tri_territory.html`（旧URLは転送ページ） |
| Y7 Indigo／ConHex | ✅ 「Gem Gates（ジェムゲート）」`gem_gates.html`／「Cell Connect（セルコネクト）」`cell_connect.html`。設計者名を削除 |
| Y9 ルミナ・テイマー | 🔶 「バトルタワー」→「ひかりの塔」に変更済み。**モンスター6体の描き直しは未実施**（画像生成が必要） |
| Y10 出自記録 | 🔶 事後記録を整備済み。生成ツール・プロンプトは深澤さんの記入待ち |
| Y11 CC BY-SA | 🔶 `credits.html` で範囲を明記。牌SVGのライセンスは未確認（外部接続不可） |
| Y12 鉄道／Y15 権利表記 | ✅ 注記・`credits.html` 追加 |
| Y13 ねじれ地下道 | ✅ `credits.html` に「着想」の注記（ゲーム本体は無変更） |

**未実施（既知）**: アセットのフォルダ名（`assets/zelda-like/`・`assets/blokus/`・`assets/conhex/`・`assets/nes/`）は参照が多く、無言で絵が消える危険があるため改称していない。URLは転送ページで旧名を残している。
**対象外で気づいた点**: リポジトリ直下の `FamicomEmulatorWin/`（Windows版）は公開サイトの掲載外だが、同じく「Famicom」名を使っている。

---

## 再点検: ルミナ・テイマー（2026-10-09）
`5776a360`（草・水・電気系6体を独自モチーフへ変更）の後、全12画像を再度目視した。詳細は `assets/lumina-tamer/README.md`。

| 判定 | 内容 |
|---|---|
| ✅ 解消 | 草・水・電気の3系統6体（前回「高」）。別モチーフに変わり、当初の類似は解消。寸法も不変 |
| 🔴 新規・最優先 | **捕獲アイテム2種（`items.png`）が、水平の黒帯＋中央の白ボタンの球体**。著名な捕獲球の意匠そのもの。配色変更だけでは足りず、図形を変える（例: 結晶球・ランタン型・鈴型）。戦闘の投てき演出でも使用 |
| 🟠 新規・高〜中 | **ナースNPC（`people.png` 2行目）がピンク髪＋十字入りナースキャップ**＋「回復の拠点」という役割まで同型。ピンクの十字は日本の赤十字標章の使用制限法との関係でも避けたい |
| 🟡 残 | 炎の狐、青い鳥の進化形、岩の角獣、ドリル鼻のモグラ、大樹の精（いずれも「中」以下） |
| ✅ 問題なし | tiles / battlefields / effects / title / panel |

**判断**: 今回の差し替えで「モンスターの類似」は大きく減ったが、**捕獲球とナースは、モンスター以上に出所を連想させやすい要素**で、現状のまま公開を続けるのは勧めない。
この2点を直すまでは、YELLOW の中でも最優先とする。残る「中」は、時間があるときに順次。

**推奨の順序**: ①捕獲球2種の描き直し（`ITEMART[3]`・`[4]`。同じ配置・同じ解像度で `items.png` を差し替え）→ ②ナース4体のスプライト（`people.png` 2行目）→ ③炎の狐・岩の角獣。
コード側の暫定策（任意）: 画像が揃うまで、捕獲アイテムの表示だけ `items.png` の下段の結晶球（`ITEMART[5]`〜`[7]`）に向ける方法がある。見た目の意味は変わるが、法務リスクは直ちに下がる。
