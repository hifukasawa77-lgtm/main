# 太平風雲記 (Taihei Fuuunki) — 仕様書 v1

対象ファイル: `taihei.html`（リポジトリ直下、`sengoku.html` と同じ命名パターン）
作業ブランチ: `claude/kamakura-shogunate-game-4fdsiy`（既存ブランチを流用。ブランチ名と内容不一致は実害なしのためリネームしない）
土台: `gamekit/gamekit.js`（GameKit）。`sengoku.html` の**姉妹作品**として、そのシステム（全国マップ＋勢力AI＋ターン制＋ヘックス合戦＋施設パネル＋イベント系）のアーキテクチャパターンを継承する
規模目安: `genpei.html`（3,881行）〜`sanguo.html`（3,283行）の**1.5〜2倍**（朝廷／恩賞／悪党／忠義思想の4新システムがあるため）＝おおよそ**6,000〜7,800行**を目安とする。`sengoku.html`（19,564行）規模の全サブシステム複製は初回で行わない。

> **前身仕様の扱い**: `specs/kamakura_spec.md`（鎌倉幕府テーマ）は深澤の指示により不採用・破棄。本ファイルが正本。

---

## 0. 事前調査サマリー（sengoku.html / genpei.html 再確認）

前回（鎌倉幕府案）調査済みの基本パターンに加え、本ブリーフの新システム（朝廷・恩賞・忠義思想）に直結する既存実装を追加調査した。

- **全国マップは国ノード＋隣接グラフ方式、ヘックスは合戦画面のみ**（前回調査の再掲）。`sengoku.html` の攻城ヘックスも城単体のサブ画面に閉じている。太平風雲記もこのパターンを踏襲する。
- **朝廷システムは `sengoku.html` に既に実装例がある**（`specs/sengoku_expansion_v1.md` §4-1/4-2 に詳細設計あり）。`COURT_KANOI_RANKS`（従五位下→正一位、`courtRel` 閾値・`cost`・`prestigeGain` を持つランク配列）と `SHOGUN_ROLE_RANKS`（幕府奉公衆→副将軍、`shogunRel` 閾値・`provinces` 閾値を持つ役職配列）が、`_courtPropose`/`_shogunPropose` という「前提条件チェック→コスト消費→確率成功判定→効果適用」の定型フローで実装されている。**太平風雲記の朝廷システムはこのフローをそのまま流用し、朝廷を南朝・北朝の二系統に複製する**（後述4.3）。
- **忠誠（`loyalty`）は `sengoku.html` の武将データに既に存在する数値**（0-100、初期値60前後）。イベントや家宝で増減し（`addPrestige`/`loyalty()` ヘルパー、`g.loyalty=Math.max(20,(g.loyalty||60)-5)` 等の書き方）、閾値割れで裏切り・出奔の伏線になる。太平風雲記の「忠義・思想システム」はこの`loyalty`基盤の上に**思想（ideology）による変動係数**を足す拡張として設計する（0から作らない）。
- **歴史イベントは条件付き発火＋効果関数の定型パターンを持つ**（`GAME_EVENT_DEFS`: `id/nameJP/nameEN/year/month/condition(st)→bool/lines[]/effectJP/effectEN/effect(st)`）。武将の生死判定は `dAlive`/`gAlive` ヘルパー、大名の威信/朝廷関係/金は `addPrestige`/`addCourtRel`/`addGold` ヘルパーで一括操作する。太平風雲記の主要歴史イベント（4.6節）もこの定型に従う。
- **兵科は `UNITS` テーブル＋三すくみ `advantage(a,d)` 関数**（`足軽>騎馬>鉄砲>足軽`）で表現されている。太平風雲記は同じ形で8兵科を再現する（4.5節）。
- **忍者衆（`NINJA_GROUPS`）は非対称・秘匿系コマンドの先例**。太平風雲記の「悪党システム」（夜襲/放火/略奪/城門破壊）はこの「雇用制の特殊部隊が固有コマンドを解放する」設計パターンを踏襲する。

---

## 1. 概要・背景・目的

元弘元年（1331年）の元弘の乱から明徳3年（1392年）の南北朝合一までを題材にした戦略シミュレーション。`sengoku.html`（戦国風雲記）の姉妹作品として同じアーキテクチャ基盤（全国マップ・勢力AI・ターン制・ヘックス合戦・施設パネル・イベント系）を継承しつつ、**戦国風雲記が「領土争い」中心なのに対し、本作は「忠義・官位・朝廷・恩賞・離反」といった政治的要素が中心**という明確な差別化を持つ。単純な戦力だけでなく、武将個々の忠誠・思想と、南朝/北朝どちらの正統性を掌握しているかが勝敗を左右する、人間ドラマ重視の設計とする。

対象ユーザー: hide_0001ポートフォリオの訪問者（`sengoku.html`/`genpei.html`/`sanguo.html` と同一層）。日英バイリンガル対応。

---

## 2. 要件定義書

### 2.1 コアループ

1. 勢力選択（3陣営から選択。詳細は2.3・4.2） → オープニング（元弘の乱の史実イントロ）
2. 全国マップ画面（`MapScene`）で月単位のターン制ループ:
   - コマンドバー: 政務／軍事／人事（恩賞）／朝廷（南朝 or 北朝への外交）／悪党（雇用済みなら特殊コマンド）／記録／ターン終了
   - 隣接国への出兵 → `BattleScene`（ヘックス戦術戦闘、8兵科の三すくみ）→ 結果を全国マップへ反映
   - ターン終了で他勢力AIが行動し、思想・忠義に基づく離反判定、恩賞不足判定、年代記イベント（4.6節）が発火し得る
3. 毎ターン終了時（および主要イベント直後）に**6エンディングの成立条件を評価**（早期終了あり）。条件が揃わないまま上限ターンに達した場合は「全国統一」寄りの暫定エンド（勢力比較で最も優勢な陣営の視点エンド）を表示する

### 2.2 勝敗条件（複数エンディング）

「誰が天皇（南朝／北朝どちらか）を擁立し支配するか」という、戦国風雲記には無かった軸を勝敗の中心に据える。判定は`checkEndings(state)`が毎ターン終了時に評価し、複数条件が同時成立した場合は表の上から優先度順に採用する。

| 優先度 | エンディング | 成立条件（概要、詳細式は4.3/4.6） |
|---|---|---|
| 1 | **建武の新政成功** | 建武の新政イベント成立後、中先代の乱トリガー条件（足利方の建武政権への`courtRel`閾値割れ）が一定ターン不成立のまま経過。南朝(建武政権)が武家勢力からの離反を抑え続けた到達点 |
| 2 | **新幕府樹立** | 足利方(北朝)が観応の擾乱イベントを乗り切り（内訌後も足利方の総石高が一定割合を維持）、南朝方の総石高が閾値未満に低下 |
| 3 | **南朝統一** | 南朝方勢力の合計制圧国数が全国の閾値（例: 80%）以上、かつ北朝方の天皇（北朝）擁立勢力が消滅または北朝courtRel系が破綻 |
| 4 | **北朝統一** | 北朝方（足利方）の合計制圧国数が全国の閾値以上、かつ南朝方の天皇（後醍醐帝統）擁立勢力が消滅 |
| 5 | **天下泰平** | 応安の和約フラグ成立後、南北朝合一イベント（1392年固定）まで大規模衝突なく到達。史実通りの円満終結ルート |
| 6 | **全国統一** | 上記いずれにも該当しないが、単独勢力が全国制圧国数の閾値（例: 90%）以上に到達（南朝/北朝いずれの正統性条件も満たさない、軍事的天下統一ルート） |

敗北条件（プレイヤー勢力共通）: 本拠国をすべて失う、または麾下武将全員の忠義崩壊（`loyalty<defectBelow`が全員成立）で軍事力0になる。

### 2.3 機能要件（MoSCoW）

**Must**
- 全国マップ（国ノード＋隣接、`genpei.html`/`sengoku.html`の province データを流用）とターン制進行（月単位、1ターン＝1か月）
- 3陣営（時代に応じた幕府・足利方／朝廷方、1338年以降は北朝・足利方／南朝方、および中立・地方勢力）・史実準拠の初期配置（4.2節の全30武将データ）
- **朝廷システム**（4.3節）: 南朝・北朝それぞれの官位授与・討伐令・恩賞・勅命、courtRel/legitimacy、玉座（天皇の身柄）保持ボーナス
- **恩賞システム**（4.4節）: 武将の`landDesire`と功績に対する恩賞充足率、不足時の忠義低下
- **悪党システム**（4.5節）: 悪党衆の雇用、夜襲／放火／略奪／城門破壊の4特殊コマンド
- **忠義・思想システム**（4.4節）: 尊王／幕府派／野心家／現実主義の4思想、思想別の忠義変動係数と離反判定
- 8兵科＋海賊(水軍)のヘックス戦術戦闘（4.5節、`sengoku.html`の`UNITS`/`advantage()`パターン踏襲）
- 主要歴史イベント11件（4.6節）の条件発火・盤面反映
- AI（3陣営の非操作勢力が思想・朝廷関係・恩賞状況に基づき行動）
- セーブ/ロード（`GameKit.Save`、名前空間`'taihei'`）
- 複数エンディング判定（2.2節）とエンディング画面
- 黒背景＋シアン/パープルのGlassmorphism UI、日英バイリンガル、サイバーパンク演出禁止

**Should**
- 特殊兵（勢力固有ユニット）: 楠木軍（ゲリラ戦、山岳地形ボーナス増）／北畠騎馬隊（高速移動）／赤松軍（山城防衛ボーナス）／海賊衆（水上戦）／僧兵（士気ボーナス）
- 特殊施設: 関所／宿場／荘園／寺社／市／港／山城／館／城塞（`sengoku.html`の施設パネルパターンを国ノードに付随させる形で実装）
- 1331年から1392年までの主要局面を選べる6シナリオ（元弘の変／建武の新政／南北朝分裂／観応の擾乱／義満台頭／元中の一統）
- 年代記/史書ビュー（`genpei.html`の`RetsudenScene`相当）

**Could**
- 実在武将の手描き風肖像（コード描画、新規画像生成は必須にしない）
- イベント挿絵（Graphic-Designerへの個別発注は任意）
- 南朝・北朝の玉座UI演出（三種の神器の所在を視覚的に表示する等）
- BGM/SEジングルの拡張

**Won't（v1では実装しない）**
- `sengoku.html`級の攻城ヘックス手トレース・64武装勢力・実データCSV取込パイプライン
- 全66国個別の固有イベント（主要国・主要武将中心に絞る）
- モバイル最適化の完全対応（既存ゲーム群と同水準でよい）

### 2.4 非機能要件

- フレームワーク不使用、ビルドツール不使用、`gamekit/gamekit.js`をそのまま読み込む
- ライブラリ追加はCDN経由のみ（v1では追加ライブラリ不要の想定）
- Canvas解像度 `W=1440, H=810`（既存ゲーム群と統一）
- 新規画像アセットはWebP、既存流用アセットの解像度は変更しない
- `GameKit.Save`による永続化、60fps目標、`.claude/skills/game-dev`ガイドライン準拠

### 2.5 制約条件

- ファイル名`taihei.html`をリポジトリ直下（`sengoku.html`と同じ並び）
- UIクロームは黒背景＋シアン/パープルGlassmorphism。**勢力・陣営の識別色は史実準拠の多色使用でよい**（南朝＝菊の御紋を連想する金/朱系、北朝＝足利二つ引を連想する紺/白系など）。UIクロームとは別枠であり、CLAUDE.mdが禁じるのはネオングロウ過多・原色マゼンタ・SF都市風演出であって史実色分けそのものではない（前回kamakura_spec.md 2.5節と同じ整理）
- APIキー・有料サービス禁止

---

## 3. 基本設計書

### 3.1 システム構成図（テキスト）

```
taihei.html
 ├─ <script src="gamekit/gamekit.js">
 └─ <script> インライン実装
     ├─ 定数群: RULE / CAMPS / COURTS(南朝・北朝) / COURT_KANI_RANKS×2
     │          / SCENARIOS / TIMELINE_EVENTS / GENERALS / IDEOLOGY
     │          / PROVINCES(データ) / UNITS / FACILITIES / AKUTOU_COMMANDS
     ├─ データ読込: assets/taihei/provinces.json（国ノード＋隣接、既存流用）
     ├─ Rule（ゲームロジック純関数群）
     │    buildState / applyActions / endTurn / aiTurn
     │    courtPropose(court, action) / grantKani / issueTobatsurei
     │    evaluateReward / adjustLoyalty(ideology込み) / checkDefection
     │    hireAkutou / akutouCommand(kind) / checkEndings
     ├─ 描画ヘルパー: frame/txt/button/drawKamon/drawPortrait（genpei/sengoku踏襲）
     ├─ シーン: Backdrop → BootScene → TitleScene → FactionSelectScene
     │          → OpeningScene → MapScene ⇄ BattleScene → EndingScene
     └─ 起動: game.changeScene(new BootScene()); game.start();
```

```
   [プレイヤー入力]
        │
   MapScene（全国マップ・コマンドバー・朝廷パネル）
        │  出兵/被侵攻          │ 朝廷コマンド        │ 悪党コマンド
        ▼                       ▼                     ▼
   BattleScene              courtPropose()        akutouCommand()
   （ヘックス戦術戦闘）      （官位/討伐令/恩賞/勅命） （夜襲/放火/略奪/城門破壊）
        │                       │                     │
        └────────────┬──────────┴─────────────────────┘
                      ▼
              endTurn() → aiTurn()（3陣営AI）→ evaluateReward()/adjustLoyalty()
                      → TIMELINE_EVENTS判定 → checkEndings() → 次ターン or Ending
```

### 3.2 画面遷移

```
Boot → Title → FactionSelect → Opening
  → MapScene ⇄ BattleScene（合戦発生時）
  → （エンディング成立）→ EndingScene（6種のいずれかの結末テキスト） → Title へ戻る
```

- **Title**: タイトルロゴ「太平風雲記」・パーティクル背景
- **FactionSelect**: 主要2陣営（1331年は鎌倉幕府・足利方／後醍醐・倒幕方、1334年は足利方／建武政権・朝廷方、1338年以降は北朝・足利方／南朝方）と地方勢力のカード表示、家紋・当主・思想傾向を提示
- **Opening**: 元弘の乱の史実イントロ（縦書き風演出、`genpei.html`の`OpeningScene`踏襲）
- **MapScene**: 全国図＋国詳細パネル＋朝廷パネル（南朝/北朝どちらの官位・関係値かをタブ切替）＋コマンドバー＋年代記ログ
- **BattleScene**: ヘックス盤＋部隊パネル（兵科アイコン・特殊兵表示）＋ログ
- **EndingScene**: 成立したエンディングの結末テキストと最終勢力図

### 3.3 データ構造の概要

- **Province（国ノード）**: `{ id, jp, en, region, koku, adjacency:[id...], owner: campId|null, facility: facilityType|null, garrison }`
- **Camp（陣営）**: `{ id, jp, en, color, playable, ai, court: 'nanchou'|'hokuchou'|null, home:[provinceId...] }`（3陣営: `ashikaga`北朝・足利方、`nancho`南朝方、`chihou`中立・地方勢力 ※地方勢力は内部で複数の独立小勢力に分かれてもよい）
- **General（武将）**: `{ id, camp, jp, en, born, died, province, stats:{tosotsu,chiryaku,busou,suiren}, loyalty, landDesire, ideology }`
- **Court（朝廷、南朝・北朝2つ）**: `{ id, jp, en, emperor: {jp,en,alive}, heldBy: campId|null, legitimacy, kaniRanks:[...] }`
- **CourtRelation（陣営×朝廷の関係）**: `{ campId, courtId, courtRel, kaniRank, actedTurn }`
- **AkutouPool（悪党雇用状態）**: `{ campId, count, quality, cooldown }`
- **TimelineEvent**: `{ id, jp, en, year, month, condition(state)=>bool, effect(state)=>void }`（`sengoku.html`の`GAME_EVENT_DEFS`踏襲）

### 3.4 主要コンポーネントの役割

| コンポーネント | 役割 |
|---|---|
| `Rule.buildState` | 陣営選択から初期状態を構築（3陣営・30武将・66国配置） |
| `Rule.endTurn` | 年送り・AI実行・恩賞評価・忠義調整・TIMELINE判定・エンディング判定 |
| `Rule.aiTurn` | 非操作陣営の行動決定（朝廷工作・恩賞配分・出兵・悪党運用） |
| `Rule.courtPropose` | 朝廷コマンド共通口（官位授与/討伐令/恩賞/勅命、南朝北朝共通ロジック） |
| `Rule.evaluateReward` | 武将ごとの功績と実際の恩賞を比較し不足分を`loyalty`へ反映 |
| `Rule.adjustLoyalty` | 思想（ideology）別の変動係数を適用して忠義を増減 |
| `Rule.checkDefection` | `loyalty`が閾値を割った武将の離反判定・移籍先決定 |
| `Rule.hireAkutou`/`akutouCommand` | 悪党雇用と4特殊コマンドの実行 |
| `Rule.checkEndings` | 6エンディングの成立判定（優先度付き） |
| `MapScene` | 全国マップ表示・コマンド実行・朝廷/国詳細パネル |
| `BattleScene` | ヘックス戦術戦闘（8兵科三すくみ・特殊兵） |
| `drawKamon` | 家紋のコード描画（画像アセット不要） |

---

## 4. 詳細設計書

### 4.1 ファイル構成

```
taihei.html                         … 本体（単一HTMLファイル、sengoku.html/genpei.htmlと同じ形式）
assets/taihei/
  provinces.json                    … 国ノード＋隣接（assets/genpei/provinces.json を複製・改称。国境は同一のため流用）
  README.md                         … アセット出典・流用元の記録
  taihei-thumb.webp                 … index.html掲載用サムネイル
specs/taihei_spec.md                … 本仕様書（正本）
specs/kamakura_spec.md              … 不採用記録として保持（削除しない）
```

地図背景画像は新規生成せず、`assets/sengoku/gpt/sengoku-japan-map-user-v2.webp`相当を`assets/taihei/`へコピーして自ゲーム完結にする（他ゲームフォルダを跨いで参照しない）。

### 4.2 陣営・武将データ（初期配置）

3陣営・史実準拠の初期配置。`camp`は`ashikaga`(北朝・足利方)/`nancho`(南朝方)/`chihou`(中立・地方勢力)。`ideology`は`sonno`(尊王)/`bakufu`(幕府派)/`yashin`(野心家)/`genjitsu`(現実主義)。

| id | 氏名 | camp | 初期国 | ideology | 備考 |
|---|---|---|---|---|---|
| ashikaga_takauji | 足利尊氏 | ashikaga | 三河→武蔵 | yashin | 恩賞不足で建武政権から離反する中核イベントの主体 |
| ashikaga_tadayoshi | 足利直義 | ashikaga | 武蔵 | bakufu | 観応の擾乱で兄と対立 |
| ko_moronao | 高師直 | ashikaga | 武蔵 | yashin | 執事、四條畷で楠木正行を破る |
| akamatsu_enshin | 赤松円心 | ashikaga | 播磨 | genjitsu | 山城防衛が得意、特殊兵「赤松軍」 |
| sasaki_doukyo | 佐々木道誉 | ashikaga | 近江 | genjitsu | 婆娑羅大名、史実通り日和見寄りAI |
| toki_yoritou | 土岐頼遠 | ashikaga | 美濃 | yashin | |
| hosokawa_akiuji | 細川顕氏 | ashikaga | 阿波 | bakufu | 四国方面 |
| imagawa_norikuni | 今川範国 | ashikaga | 駿河 | bakufu | |
| isshiki_norifuji | 一色範氏 | ashikaga | 陸奥 | bakufu | 奥州探題格 |
| yamana_tokiuji | 山名時氏 | ashikaga | 伯耆 | genjitsu | 山陰、後年南朝転属もあり得るAI挙動 |
| godaigo | 後醍醐天皇 | nancho | 山城→吉野 | sonno | 南朝の玉座そのもの。討死/退位で南朝legitimacy崩壊 |
| moriyoshi_shinno | 護良親王 | nancho | 大和 | sonno | |
| kitabatake_akiie | 北畠顕家 | nancho | 陸奥 | sonno | 特殊兵「北畠騎馬隊」 |
| kitabatake_chikafusa | 北畠親房 | nancho | 伊勢 | sonno | 神皇正統記、legitimacy維持に貢献する設計 |
| kusunoki_masashige | 楠木正成 | nancho | 河内 | sonno | 特殊兵「楠木軍」、湊川で討死イベント |
| kusunoki_masatsura | 楠木正行 | nancho | 河内 | sonno | 四條畷で討死イベント |
| nitta_yoshisada | 新田義貞 | nancho | 上野 | sonno | 鎌倉幕府滅亡イベントの主体 |
| nawa_nagatoshi | 名和長年 | nancho | 伯耆 | sonno | |
| kikuchi_takemitsu | 菊池武光 | nancho | 肥後 | sonno | 九州方面、南朝方の九州拠点 |
| yuki_munehiro | 結城宗広 | nancho | 陸奥 | sonno | |
| ouchi | 大内氏 | chihou | 周防 | genjitsu | 中立、情勢次第で南北いずれかへ |
| shimazu | 島津氏 | chihou | 薩摩 | genjitsu | 九州、独自勢力維持志向 |
| date | 伊達氏 | chihou | 陸奥 | genjitsu | |
| soma | 相馬氏 | chihou | 陸奥 | genjitsu | |
| ogasawara | 小笠原氏 | chihou | 信濃 | bakufu | |
| hatakeyama | 畠山氏 | chihou | 能登 | bakufu | 後の管領家、初期は一地方御家人 |
| kyogoku | 京極氏 | chihou | 近江北部 | bakufu | 佐々木氏庶流 |
| momonoi | 桃井氏 | chihou | 越中 | bakufu | |
| shiba | 斯波氏 | chihou | 陸奥探題格 | bakufu | 後の管領家 |

地方勢力(`chihou`)はプレイ開始時点では一枚岩の陣営ではなく、各家がそれぞれ独立した小勢力として存在し、南朝/北朝どちらの朝廷とも`courtRel`を個別に持つ（=どちらの陣営にも恩賞・官位で引き込める）ものとする。プレイヤーは3陣営いずれか（北朝・足利方、南朝方、または地方勢力のうち1家）を選択してスタートする。

### 4.3 朝廷システム（南朝・北朝）

`sengoku.html`の`COURT_KANOI_RANKS`/`SHOGUN_ROLE_RANKS`パターンを踏襲し、**南朝・北朝それぞれに独立した官位ランク表を持たせる**。

```js
const COURTS = {
  nancho:   { jp: '南朝', en: 'Southern Court', emperor: { jp: '後醍醐天皇', en: 'Emperor Go-Daigo' }, legitimacy: 60 },
  hokucho:  { jp: '北朝', en: 'Northern Court', emperor: { jp: '光厳天皇（擁立予定）', en: 'Emperor Kōgon' }, legitimacy: 0 }, // 延元の乱イベントで発足
};

/* 官位ランク（南朝・北朝共通の型。値は宮廷ごとに個別インスタンスを持つ） */
const KANI_RANKS = [
  { rank:0, jp:'従五位下', en:'Jr. 5th Rank Lower', rel:15, cost:200,  prestigeGain:10 },
  { rank:1, jp:'従五位上', en:'Jr. 5th Rank Upper', rel:25, cost:350,  prestigeGain:15 },
  { rank:2, jp:'従四位下', en:'Jr. 4th Rank Lower', rel:40, cost:500,  prestigeGain:20 },
  { rank:3, jp:'従四位上', en:'Jr. 4th Rank Upper', rel:55, cost:700,  prestigeGain:25 },
  { rank:4, jp:'従三位',   en:'Jr. 3rd Rank',       rel:70, cost:1000, prestigeGain:35 },
  { rank:5, jp:'正三位',   en:'Sr. 3rd Rank',       rel:80, cost:1500, prestigeGain:50 },
  { rank:6, jp:'征夷大将軍/鎮守府将軍', en:'Shogun-equivalent', rel:90, cost:2500, prestigeGain:75 },
];
```

- **勅命（討伐令）**: `issueTobatsurei(state, courtId, targetCampId)`。発する側の陣営が`courtRel>=60`かつ`legitimacy>=50`のとき朝廷へ申請でき、成立すると同じ朝廷に属す全陣営に「対象への軍事行動に戦闘ボーナス+15%・士気+10」を一定ターン付与する（`sengoku.html`の`_shogunPropose(game,'seibatsu')`と同型のフロー）
- **玉座（天皇の身柄）保持ボーナス**: `court.heldBy`の陣営は`legitimacy`に+20の恒常補正を得て、同朝廷に属す全陣営の`courtRel`自然回復速度が1.5倍になる。天皇が討死・退位すると`heldBy=null`となり`legitimacy`が即座に半減する
- **恩賞（朝廷からの土地宛行）**: `courtPropose(court,'onsho')`。`courtRel`消費で朝廷側から所領を認可させ、対象武将の`landDesire`充足に使える特別枠（4.4節の恩賞システムと接続する朝廷側チャネル）

### 4.4 恩賞システム／忠義・思想システム（本作の核心メカニクス）

**恩賞システム**

```js
// 武将の欲求値（0-100）。合戦参加・勝利・城の攻略で上昇する
function accrueLandDesire(gen, contribution) {
  gen.landDesire = clamp(gen.landDesire + contribution * 0.8, 0, 100);
}
// 功績スコア（戦国風雲記に無い指標。合戦の勝敗規模と攻略実績を重みづけ）
function contribution(battleResult) {
  return battleResult.won ? (10 + battleResult.provincesCaptured * 25) : 2;
}
// ターン終了時、直近 RULE.reward.gracePeriod ターン以内に功績があるのに
// 恩賞（所領/官位/金）が expectedReward の RULE.reward.minFulfillRatio 未満しか
// 支給されていない武将の忠義を下げる
function evaluateReward(state, camp) {
  for (const gen of campGenerals(state, camp)) {
    if (!gen.pendingContribution) continue;
    const expected = gen.pendingContribution * (1 + gen.landDesire / 100);
    const given = gen.recentRewardValue || 0;
    if (given < expected * RULE.reward.minFulfillRatio) {
      adjustLoyalty(state, gen, -RULE.reward.unrewardedPenalty, 'unrewarded');
    }
    gen.pendingContribution = 0; gen.recentRewardValue = 0;
  }
}
```

数値目安: `RULE.reward = { gracePeriod: 3, minFulfillRatio: 0.5, unrewardedPenalty: 15 }`。

**忠義・思想システム**

各武将は4思想のいずれかを持ち、`loyalty`（0-100）の変動係数が思想ごとに異なる。`adjustLoyalty(state, gen, delta, reason)`が全ての忠義増減の唯一の入口となり、`reason`に応じた思想別係数テーブルを介して実際の増減量を決める。

```js
const IDEOLOGY_MUL = {
  // 尊王: 自陣営が支持する朝廷との関係変化に強く反応。恩賞不足には比較的寛容
  sonno:    { court_shift: 1.6, unrewarded: 0.7, power_balance: 0.4 },
  // 幕府派: 秩序・安定（強い主君）を好む。主君が劣勢になると離反しやすい
  bakufu:   { court_shift: 0.8, unrewarded: 1.0, power_balance: 1.3 },
  // 野心家: 恩賞不足に最も敏感。朝廷の理念には無関心
  yashin:   { court_shift: 0.3, unrewarded: 1.6, power_balance: 0.9 },
  // 現実主義: 常に強い方へ緩やかに引き寄せられる。忠義の振れ幅は小さいが継続的
  genjitsu: { court_shift: 0.6, unrewarded: 0.9, power_balance: 1.5 },
};
function adjustLoyalty(state, gen, delta, reason) {
  const mul = IDEOLOGY_MUL[gen.ideology][reason] ?? 1.0;
  gen.loyalty = clamp(gen.loyalty + delta * mul, 0, 100);
  checkDefection(state, gen);
}
function checkDefection(state, gen) {
  if (gen.loyalty >= RULE.loyalty.defectBelow) return;
  const dest = pickDefectionTarget(state, gen); // 思想に応じた移籍先選定（下記）
  if (dest) defect(state, gen, dest);
}
```

- **離反先の選定方針（思想別）**:
  - `sonno`（尊王）: 自身の陣営が属す朝廷（南朝/北朝）と別の朝廷に鞍替えしている主君からは離れ、**支持する朝廷を掲げる最有力陣営**へ移籍
  - `bakufu`（幕府派）: 現在の勢力比で**最も安定して秩序を維持している陣営**（合戦での負け越しが少ない陣営）へ移籍
  - `yashin`（野心家）: 直近で最も高い恩賞提示（`landDesire`充足見込み）を出した陣営へ移籍。**AIが引き抜き工作を仕掛けられる唯一の思想**（4.5節悪党システムとは別に、通常の`人事`コマンドから「調略」で狙える）
  - `genjitsu`（現実主義）: 単純な総石高比較で**現在最大の陣営**へ緩やかに吸着（史実の日和見武将の再現）
- 数値目安: `RULE.loyalty = { defectBelow: 20, decayPerTurn: 0.3 }`

### 4.5 悪党システム（特殊コマンド）

`sengoku.html`の`NINJA_GROUPS`（雇用制の秘匿部隊）と同型の設計。悪党衆は正規軍とは別枠のプールとして陣営ごとに保持する。

```js
const AKUTOU_COMMANDS = {
  yogeki:     { jp:'夜襲', en:'Night Raid',     cost:80,  baseSuccess:0.55, effect:'targetGarrison -15%' },
  housen:     { jp:'放火', en:'Arson',          cost:60,  baseSuccess:0.60, effect:'targetKoku -20% (3turn)' },
  ryakudatsu: { jp:'略奪', en:'Pillage',        cost:40,  baseSuccess:0.70, effect:'自陣営gold +targetKoku*0.3, targetKoku -10%' },
  jomonhakai: { jp:'城門破壊', en:'Gate Break', cost:120, baseSuccess:0.40, effect:'次合戦の防御側地形ボーナス無効化' },
};
function hireAkutou(state, camp, gold) {
  const pool = state.akutou[camp];
  pool.count += Math.floor(gold / RULE.akutou.hireCostPerUnit);
  pool.quality = clamp(pool.quality + 2, 0, 100);
}
function akutouCommand(state, camp, kind, targetProvinceId) {
  const cmd = AKUTOU_COMMANDS[kind];
  const pool = state.akutou[camp];
  if (pool.count <= 0 || pool.cooldown > 0) return { ok:false, reason:'no_akutou_or_cooldown' };
  const success = srand(state) < cmd.baseSuccess * (0.5 + pool.quality / 200);
  pool.count -= 1; pool.cooldown = RULE.akutou.cooldownTurns;
  if (success) {
    applyAkutouEffect(state, cmd, targetProvinceId);
  } else {
    // 露見: 実行元の court_rel・prestige にペナルティ（正規戦でない不名誉行為として）
    adjustCourtRel(state, camp, -8);
  }
  return { ok:true, success };
}
```

数値目安: `RULE.akutou = { hireCostPerUnit: 15, cooldownTurns: 2, poolCap: 12 }`。悪党の雇用そのものは常時可能（正規軍の徴兵とは別予算枠）だが、`人事`コマンドの下に「悪党雇用」を配置し、実行コマンドは`悪党`タブに独立させる（2.3節Must要件）。

### 4.6 主要歴史イベント（発火条件・効果）

`sengoku.html`の`GAME_EVENT_DEFS`パターン（`id/year/month/condition(st)/effect(st)`）に従う。

```js
const TIMELINE_EVENTS = [
  { id:'genko_no_ran', jp:'元弘の乱', en:'Genkō War', year:1331, month:5,
    condition: st => st.turn === 0,
    effect: st => { st.camps.nancho.legitimacy += 20; /* 開幕イベント。後醍醐帝挙兵 */ } },

  { id:'kamakura_bakufu_fall', jp:'鎌倉幕府滅亡', en:'Fall of the Kamakura Shogunate', year:1333, month:5,
    condition: st => campAlive(st,'nancho') && generalAlive(st,'nitta_yoshisada'),
    effect: st => { redistributeOwnerlessJito(st); adjustLegitimacy(st,'nancho',+25); } },

  { id:'kenmu_shinsei', jp:'建武の新政', en:'Kenmu Restoration', year:1333, month:6,
    condition: st => st.firedEvents['kamakura_bakufu_fall'],
    effect: st => { st.regime = 'kenmu'; bushiIdeologyPenalty(st, ['bakufu','yashin'], -10); } },

  { id:'nakasendai_no_ran', jp:'中先代の乱', en:'Nakasendai Rebellion', year:1335, month:7,
    condition: st => st.regime === 'kenmu' && courtRel(st,'ashikaga','nancho') < 25,
    effect: st => { setCampCourt(st,'ashikaga',null); flagAshikagaBreak(st); } },

  { id:'minatogawa', jp:'湊川の戦い', en:'Battle of Minatogawa', year:1336, month:5,
    condition: st => st.flags.ashikagaBreak && generalAlive(st,'kusunoki_masashige'),
    effect: st => { killGeneral(st,'kusunoki_masashige'); adjustLegitimacy(st,'nancho',-15); } },

  { id:'engen_no_ran', jp:'延元の乱', en:'Engen Disturbance (Two Courts Established)', year:1337, month:1,
    condition: st => st.flags.ashikagaBreak && !st.courts.hokucho.active,
    effect: st => { activateCourt(st,'hokucho'); relocateEmperor(st,'nancho','yoshino'); } },

  { id:'shijonawate', jp:'四條畷の戦い', en:'Battle of Shijōnawate', year:1348, month:1,
    condition: st => generalAlive(st,'kusunoki_masatsura') && generalAlive(st,'ko_moronao'),
    effect: st => { killGeneral(st,'kusunoki_masatsura'); adjustLegitimacy(st,'nancho',-10); } },

  { id:'kanno_no_jouran', jp:'観応の擾乱', en:'Kannō Disturbance', year:1350, month:10,
    condition: st => generalLoyalty(st,'ashikaga_tadayoshi') < 35,
    effect: st => { splitCamp(st,'ashikaga',['ashikaga_takauji'],['ashikaga_tadayoshi']); } },

  { id:'shohei_ittou', jp:'正平一統', en:'Shōhei Unification (Temporary)', year:1351, month:11,
    condition: st => st.firedEvents['kanno_no_jouran'],
    effect: st => { setCourtRel(st,'ashikaga','hokucho',0); adjustLegitimacy(st,'nancho',+30); st.flags.shoheiTemp = st.turn; } },

  { id:'oan_no_wayaku', jp:'応安の和約', en:'Ōan Accord', year:1370, month:1,
    condition: st => courtRel(st,'ashikaga','hokucho') >= 70 && courtRel(st,'nancho_camp','nancho') >= 60 && st.turnsSinceLastBattle >= 8,
    effect: st => { st.flags.peaceTrackOpen = true; } },

  { id:'nanboku_gouitsu', jp:'南北朝合一', en:'Unification of the Courts', year:1392, month:10,
    condition: st => st.flags.peaceTrackOpen,
    effect: st => { st.ending = 'tenka_taihei'; } },
];
```

`redistributeOwnerlessJito`（幕府滅亡で空白化した地頭職の再分配）は4.4節の恩賞システムの好機イベントとして扱い、この直後のターンは`RULE.reward.minFulfillRatio`判定を一時緩和する（史実の恩賞トラブル＝新田・足利間の不満の伏線を、緩和を切ってから数ターン後に効かせることで表現する）。

### 4.7 UI/画面ごとの実装方針

- 共通UIヘルパー（`frame/txt/button`等）は`genpei.html`/`sengoku.html`から移植・改名（コピー&改変、クロスファイル参照はしない）
- **朝廷パネル**（新設）: MapScene内に南朝/北朝タブを持つ専用パネルを配置し、`courtPropose`系コマンド（官位申請／討伐令／恩賞／勅命）をここに集約する
- **悪党パネル**（新設）: 雇用状態（数・練度・クールダウン）と4コマンドのボタンを表示。対象国選択はマップクリックと連動
- 兵科アイコン・特殊兵表示はcanvas描画（画像アセット依存にしない）
- 日英バイリンガル: 全UI文言は`{jp,en}`を保持

### 4.8 ヘックス合戦・兵科（v1スコープ）

- グリッド: 13×9目安（`genpei.html`の`HEX`踏襲）
- **8兵科＋水軍**（`sengoku.html`の`UNITS`/`advantage()`パターンを踏襲）:

```js
const UNITS = {
  kachi:    { jp:'徒武者', en:'Foot Warrior', move:3, range:1, atk:1.0,  def:1.0,  color:'#cbd5e1' },
  yumi:     { jp:'弓武者', en:'Bow Warrior',  move:3, range:2, atk:0.9,  def:0.9,  color:'#34d399' },
  kiba:     { jp:'騎馬武者', en:'Mounted Warrior', move:5, range:1, atk:1.3, def:0.95, color:'#fbbf24' },
  naginata: { jp:'薙刀兵', en:'Naginata Troops', move:2, range:1, atk:1.05, def:1.2, color:'#a78bfa' },
  souhei:   { jp:'僧兵', en:'Warrior Monks', move:2, range:1, atk:1.1, def:1.1, color:'#f97316', moraleBonus:15 },
  akutou:   { jp:'悪党', en:'Akutō Irregulars', move:4, range:1, atk:0.85, def:0.75, color:'#ef4444', ambushBonus:0.3 },
  nobushi:  { jp:'野伏', en:'Nobushi Skirmishers', move:3, range:1, atk:0.8, def:0.8, color:'#84cc16', terrainBonus:{mountain:0.3,forest:0.3} },
  kaizoku:  { jp:'海賊', en:'Pirates (Naval)', move:4, range:2, atk:1.15, def:0.9, color:'#22d3ee', navalOnly:true },
};
// 三すくみ: 騎馬武者 > 弓武者 > 徒武者 > 騎馬武者。薙刀兵は騎馬武者に特効(+50%)
function advantage(a, d) {
  if (a==='kiba' && d==='yumi') return 1.3;
  if (a==='yumi' && d==='kachi') return 1.3;
  if (a==='kachi' && d==='kiba') return 1.3;
  if (a==='naginata' && d==='kiba') return 1.5; // 対騎馬特効（史実の長柄武器の運用を反映）
  return 1.0;
}
```

- **特殊兵**（Should、4氏族固有）: `kusunoki`camp系の楠木軍は`terrainBonus.mountain`を通常の2倍、`kitabatake`系の北畠騎馬隊は`move+2`、`akamatsu`系の赤松軍は`def+0.3`(山城限定)、水軍系は`kaizoku`の生産コストを半減
- 地形: `plain`/`mountain`（山地防御有利、楠木軍・野伏に加算）/`coast`（水軍上陸）程度で開始
- 勝敗: 士気崩壊ライン方式（`sengoku.html`の`breakBelow`/`routBelow`相当）を踏襲

### 4.9 AI設計

- `aiTurn(state, camp)`: 陣営の`ai`タイプ（`sengoku.html`のFACTIONS.ai相当、`central`/`opportunist`/`defensive`/`aggressive`/`court`）ごとに行動方針を分岐
- 1ターンの行動数上限（`sengoku.html`の`RULE.ai.maxActions`踏襲）
- AIは`courtPropose`（官位/討伐令）・`人事`（恩賞配分/調略）・`悪党`コマンドも人間プレイヤーと同じ関数群を呼ぶ（ロジックの二重実装を避ける）

### 4.10 セーブ/ロード

`GameKit.Save('taihei')`。`SAVE_VERSION`を持たせ`migrateState()`でスキーマ変更に備える。

### 4.11 必要アセット一覧と優先順位

| アセット | 優先方針 |
|---|---|
| 全国地図背景・国ノード座標 | **流用**。`assets/genpei/provinces.json`と地図WebPを`assets/taihei/`へコピー |
| 家紋（足利二つ引、楠木菊水、新田大中黒、北畠、赤松、佐々木四つ目結、大内、島津、伊達 等） | **コード描画**（`drawKamon`パターン移植・家紋種追加、画像アセット不要） |
| 武将肖像 | **プロシージャル（Could）**。コード描画で代替可 |
| イベント挿絵（湊川・四條畷・南北朝合一等） | **任意（Could）** |
| サムネイル | プロシージャル生成（`GameKit.Gen`）または簡易コード描画 |
| BGM/SE | Must最低限は`GameKit.Sfx`プロシージャル。Music-Generatorへのジングル追加はShould |

### 4.12 デザイン規約（再掲）

黒背景`#05070d`系＋シアン`#22d3ee`／パープル`#a78bfa`のGlassmorphism（UIクローム）。サイバーパンク的演出禁止。勢力識別色は史実準拠でよい（4.12はUIクロームとは別枠、2.5節参照）。日英バイリンガル必須。ライブラリCDN経由のみ、ビルドツール不使用、Canvas APIのみで完結。

---

## 5. v1スコープ外（既知の制限）

- `sengoku.html`級の攻城ヘックス手トレース・64武装勢力・実データCSV取込パイプラインは新設しない
- 全66国個別イベントの完全実装は行わない
- 6シナリオの初期領有は全国66国の厳密な史料再現ではなく、各年代の大勢を表す近似とする
- モバイル最適化・タッチジェスチャの完全対応は任意

---

## 6. 実装ステップ（Code-Generatorへの引き継ぎ順序）

大規模実装のため段階分割する。各ステップ後に動的検証（`dynamic-test`スキル）を挟む。タイムアウトが見込まれる場合はステップ2〜5を複数Code-Generatorへ分割し、着手前に担当範囲（本ファイルのどのセクション相当か）を明示する。

1. **骨格構築**: `taihei.html`を`gamekit/template.html`から作成、`W/H/canvas/game/save`初期化、`RULE/CAMPS/COURTS/KANI_RANKS/GENERALS/UNITS`定数を4.2/4.3/4.8の雛形から全件へ拡充。`assets/taihei/provinces.json`を`assets/genpei/provinces.json`から複製・整理
2. **コアロジック（陣営・武将）**: `buildState/applyActions/endTurn/aiTurn`を実装。恩賞・忠義思想（4.4節: `accrueLandDesire/evaluateReward/adjustLoyalty/checkDefection/pickDefectionTarget`）をヘッドレスでconsole検証できる段階まで
3. **朝廷システム**: `courtPropose/issueTobatsurei/grantKani`と南朝北朝二重の`courtRel/legitimacy`管理（4.3節）
4. **悪党システム**: `hireAkutou/akutouCommand`と4特殊コマンドの効果適用（4.5節）
5. **基本シーン**: `Backdrop/BootScene/TitleScene/FactionSelectScene/OpeningScene`（`genpei.html`から移植・改名）
6. **MapScene**: 全国図描画・国ノード選択・コマンドバー・朝廷パネル・悪党パネル・年代記ログ
7. **BattleScene**: ヘックス戦術戦闘（4.8節、8兵科三すくみ・特殊兵）
8. **歴史イベント**: `TIMELINE_EVENTS`11件（4.6節）の条件・効果実装
9. **エンディング判定**: `checkEndings`と6種のエンディングテキスト・`EndingScene`
10. **仕上げ**: セーブ/ロード確認、日英表記総点検（`i18n-check`）、a11y簡易確認、`taihei-thumb.webp`生成とindex.htmlへのカード追加は実装完了・Evaluator合格後に別途（`game-release`スキル手順）

---

## 7. 検証観点（Dynamic-Tester／手動）

- 起動→タイトル→陣営選択→オープニング→マップ画面まで例外0件で到達すること
- ターン終了を数十回連続実行してもクラッシュ・無限ループしないこと
- 恩賞不足→忠義低下→離反の一連が、思想別に異なる挙動（4.4節の係数表通り）で発生すること
- 朝廷コマンド（官位申請/討伐令/恩賞/勅命）が南朝・北朝それぞれ独立して機能すること。玉座保持ボーナスが`heldBy`変化で正しく増減すること
- 悪党4コマンドがそれぞれ成功/失敗の両分岐で状態を変えること（失敗時のcourtRelペナルティ含む）
- ヘックス合戦が発生・終了し、結果が全国マップへ反映されること。薙刀兵の対騎馬特効など三すくみ外の特効が機能すること
- 11件のTIMELINE_EVENTSが史実年月・条件通りに発火し、`engen_no_ran`で北朝courtが正しく起動すること
- 6エンディングそれぞれが単独条件下で成立すること（優先度表の上位から検証）
- セーブ→リロード→ロードで状態が復元されること
- 日英表記の欠落なし、サイバーパンク的演出（過剰ネオン・原色マゼンタ等）の混入なし
