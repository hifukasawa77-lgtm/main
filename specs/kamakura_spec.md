# 鎌倉幕府 (Kamakura Shogunate) — 仕様書 v1

対象ファイル: `kamakura.html`（リポジトリ直下）
作業ブランチ: `claude/kamakura-shogunate-game-4fdsiy`
土台: `gamekit/gamekit.js`（GameKit）
規模目安: 初回v1は `genpei.html`（3,881行）を上限の目安とする。`sengoku.html`（19,564行）は長期反復後の姿であり初回の目標にしない。

---

## 0. 事前調査サマリー（sengoku.html / genpei.html）

Code-Generatorが実装に入る前提として、既存2作を軽く調査した結果を記す。

- **戦略レイヤーはヘックスマップではない**。`sengoku.html` も `genpei.html` も、全国マップは「日本地図の背景画像＋国（令制国）ノード」の点＋隣接グラフ方式（`genpei.html` は `provinces.json` を実測CSVから構築、拠点=`kyoten` を国ごとに複数持つ）。ヘックスグリッドは**戦術合戦画面だけ**で使う（`genpei.html` の `HEX = { cols:13, rows:9, size:34 }` は `BattleScene` 専用、`sengoku.html` の攻城ヘックスも同様に城単体のサブ画面）。
  → 鎌倉幕府ゲームもこのパターンを踏襲する。全国戦略マップは国ノード方式、ヘックスは合戦画面のみ。
- **`genpei.html` の構成**（3,881行）: 定数群（RULE/AUTHORITY/FACTIONS/ERA/SCENARIOS/TIMELINE/GENERALS）→ 拠点CSV読込・隣接構築 → `Rule`（ゲームロジック関数群: `buildState/applyActions/levy/addRep/tryBloodlessOpen/declareChoteki/pillage/donateJisha/donateCourt/grantAndo/grantShinon/purgeBand/tryRecruit/applyEventEffect/aiPolitics/endTurn`）→ 描画ヘルパー（`frame/txt/button/drawKamon/drawPortrait` 等、家紋はコード描画でSVG/画像不要）→ `Backdrop/BootScene/TitleScene/ScenarioSelectScene/OpeningScene/FactionSelectScene/MapScene/BattleScene/RetsudenScene`。
- **御恩と奉公は `genpei.html` に既に雛形がある**（`RULE.hoko`: `andoCost/andoGain/shinonGain/joinHoko/defectBelow` 等、`grantAndo/grantShinon/purgeBand` 関数）。鎌倉幕府ゲームではこれを**主役の仕組みに格上げ**する。
- **`sengoku.html` は勢力数・城数が桁違いに多く、CSVで実データ（`siro_ichi.csv`/`force_list.csv`）を取り込む重厚な設計**。v1の鎌倉幕府ゲームはこの規模を目指さない（勢力5〜7・国66ノードのみ、CSV取込やアセット差し替えパイプラインは新設しない）。
- **アセット resource**: `assets/genpei/provinces.json` と地図WebP（`assets/sengoku/gpt/sengoku-japan-map-user-v2.webp` 系）は鎌倉時代でも国境が同一のため**流用可能**。家紋はコード描画（`drawKamon`パターン踏襲）でアセット生成コスト自体が発生しない。

---

## 1. 概要・背景・目的

源平合戦後の鎌倉幕府創設期〜承久の乱〜元寇〜幕府滅亡（1199年〜1333年）を題材にした戦略シミュレーション。プレイヤーは北条得宗家または有力御家人の一氏族を選び、**御恩と奉公**（所領・官職の給付と軍事奉仕の交換）、**地頭・守護の設置**（任免を通じた勢力伸長・粛清）、**評定衆による裁定**（御家人間の所領争いの政治決着）という鎌倉幕府特有の統治メカニクスを操作して勢力を伸ばす。`sengoku.html`（戦国大名の国盗り）・`sanguo.html`（三国志の天下三分）と同系統の「マップ上で勢力を動かす戦略ゲーム」だが、**合戦よりも御家人政治（粛清・恩賞・訴訟）が主軸**という点で差別化する。

対象ユーザー: hide_0001ポートフォリオの訪問者（既存の `sengoku.html`/`genpei.html`/`sanguo.html` プレイヤー層と同一）。日本史・戦略ゲーム好き。日英バイリンガル対応で海外訪問者もカバー。

---

## 2. 要件定義書

### 2.1 コアループ

1. シナリオ選択 → 自勢力選択 → オープニング（史実イントロ）
2. 全国マップ画面（`MapScene`）でターン制ループ:
   - コマンドバーから「政務・軍事・人事・評定・外交・記録」を選び行動（1ターンに実行できる行動数に上限を設ける＝`sengoku.html` の `RULE.ai.maxActions` 相当の設計を踏襲）
   - 隣接する他勢力の国へ出兵すると `BattleScene`（ヘックス戦術戦闘）へ遷移し、勝敗が全国マップへ反映される
   - ターン終了で他勢力AIが行動し、年代記イベント（`TIMELINE`）が発火し得る
3. 勝敗判定（シナリオ・勢力ごとに個別、2.2参照）で終了、結果画面（史書/エンディングテキスト）を表示

### 2.2 勝敗条件

シナリオ・勢力ごとに `VICTORY_TEXT` 相当のテーブルで定義する（`genpei.html` の `victory` フィールド踏襲）。代表例:

| シナリオ | 勢力 | 勝利条件 |
|---|---|---|
| S1 執権への道 | 北条氏 | シナリオ終了時に御家人中の最大勢力かつ承久の乱に勝利（京方の主要拠点を制圧） |
| S1 執権への道 | 三浦・畠山・比企・和田 | 粛清されずに生き残り、シナリオ終了時に一定以上の所領を保つ／北条を上回る勢力になれば下剋上勝利 |
| S1 執権への道 | 朝廷方（後鳥羽上皇、AI専用） | 承久の乱で鎌倉方の主要拠点（鎌倉）を陥落させる |
| S2 文永・弘安の役 | 北条得宗家・安達氏・少弐氏 | 元軍の全侵攻波（文永1274・弘安1281の2波）を撃退し、九州沿岸拠点を落とされない |
| S3 霜月騒動と滅亡 | 北条得宗家 | 1333年まで鎌倉・六波羅探題を保持したまま生存（史実通りの滅亡を回避する架空戦記ルート） |
| S3 霜月騒動と滅亡 | 新田・足利・後醍醐天皇方 | 鎌倉幕府滅亡イベント条件（鎌倉陥落）を成立させる（史実再現ルート） |

敗北条件（共通）: 自勢力の本拠国（鎌倉 / 各氏族の本領）を全て失う、または `hoko`（奉公度）崩壊で全御家人が離反し軍事力0になる。

### 2.3 機能要件（MoSCoW）

**Must**
- 全国マップ（国ノード＋隣接、`genpei.html` の `provinces.json` 方式を流用・改称）とターン制進行
- シナリオ選択（最低2本、目標3本）・勢力選択・オープニングテキスト
- 御恩と奉公システム: 各御家人勢力が「奉公度」パラメータを持ち、恩賞（地頭補任・所領宛行）で上昇、無視・粛清で低下。奉公度が閾値を割ると離反/挙兵（`genpei.html` の `RULE.hoko.defectBelow` を踏襲・拡張）
- 地頭・守護の設置と改易: 保有国に地頭（`jito`）を任免するUI、地域単位の守護（`shugo`）任免、任免に伴う収入・奉公度・評判への影響
- 評定（`評定衆` コマンド）: 御家人間の所領紛争をランダム/条件生成し、プレイヤーが裁定（有利側に付く／中立）することで legitimacy・relations が変動する仕組み
- ヘックス戦術戦闘（`genpei.html` の `HEX`/`BattleScene` パターン踏襲、13×9目安）。侵攻・防衛の双方で発生
- 年代記イベント（`TIMELINE`）: 各シナリオに応じて承久の乱・文永の役・弘安の役・霜月騒動・鎌倉幕府滅亡などを史実年月で自動発火し、盤面に効果（`fx`）を与える
- AI: 各非プレイヤー勢力が `aiPolitics`/`aiTurn` 相当の関数で行動（恩賞配分・出兵・評定介入）
- セーブ/ロード（`GameKit.Save`、ゲーム専用名前空間）
- 黒背景＋シアン/パープルのGlassmorphism UI、日英バイリンガル表記、サイバーパンク演出禁止（CLAUDE.md準拠）
- 勝敗判定・エンディングテキスト表示

**Should**
- 元寇（S2）における「元軍」= 非プレイヤー・交渉不能の侵攻専用勢力（史実の暴風雨撤退を `fx` イベントで再現）
- 武将データ（`GENERALS` 相当）: 主要人物（北条義時・北条泰時・北条時宗・三浦義村・和田義盛・比企能員・後鳥羽上皇・足利尊氏・新田義貞・後醍醐天皇 等）に統率・知略等のステータスを持たせ、合戦・評定の裁定に影響させる
- 史書/年代記ビュー（`genpei.html` の `RetsudenScene` 相当、簡易版でも可）
- 元寇での「てつはう」等の特殊演出（史実フレーバー、戦闘に軽い補正を与える程度）

**Could**
- 実在武将の手描き風肖像（`drawProceduralPortrait` 系のコード描画。新規画像アセット生成は必須にしない）
- イベント挿絵（Graphic-Designerへの依頼は任意、無くても文章のみで成立する設計にする）
- 後醍醐天皇方をプレイヤー選択可能にする（S3）
- BGM/SEの拡張（ジングル等）

**Won't（v1では実装しない）**
- `sengoku.html` 規模の攻城ヘックス（城郭レイアウトのトレース等）
- 実データCSV（`siro_ichi.csv`/`force_list.csv` 相当）の取込パイプライン新設
- 全国66国すべてに個別イベント・固有武将を用意すること（主要国・主要人物に絞る）
- モバイル最適化（既存ゲーム群と同様、デスクトップ固定解像度Canvasを基本とする。タッチ操作の完全対応は任意）

### 2.4 非機能要件

- フレームワーク不使用、ビルドツール不使用。`gamekit/gamekit.js` をそのまま `<script src>` で読み込む
- ライブラリ追加はCDN経由のみ（v1では追加ライブラリ不要の想定）
- Canvas解像度は `genpei.html`/`sengoku.html` と同じ `W=1440, H=810` を踏襲（既存ゲーム群との統一感）
- 画像アセットを新規追加する場合はWebP、既存アセットの解像度は変更しない（CLAUDE.md「画像アセットの方針」準拠）
- `GameKit.Save` によるlocalStorage永続化、名前空間 `'kamakura'`
- パフォーマンス: 60fps目標（他Canvasゲームと同基準）、`.claude/skills/game-dev` のガイドライン準拠

### 2.5 制約条件

- ファイル名 `kamakura.html` をリポジトリ直下に配置（既存ゲームと同じ並び）
- デザイン規約: 黒背景＋シアン/パープル系アクセントのGlassmorphismを**UIクローム**（パネル・ボタン・背景）に適用。**勢力の識別色（マップ上の国の色分け）は`genpei.html`/`sengoku.html`同様に多色使用してよい**（赤・青・緑・金等）— これはゲームプレイ上の識別であり、CLAUDE.mdの「サイバーパンク演出禁止」規約が禁じるのはネオングロウ過多・マゼンタ等の原色ネオン・SF都市風演出であって、史実勢力の識別色分けそのものではない。ただしネオン発光的な過剰演出は避け、既存2作の落ち着いた配色（`FACTIONS` の色サンプル参照）に揃えること
- APIキー・有料サービス禁止（CLAUDE.md全体ルール）

---

## 3. 基本設計書

### 3.1 システム構成図（テキスト）

```
kamakura.html
 ├─ <script src="gamekit/gamekit.js">          … GameKit本体（既存・改変しない）
 └─ <script> インライン実装
     ├─ 定数群: RULE / FACTIONS / AUTHORITY / SCENARIOS / TIMELINE / GENERALS
     │          / PROVINCES(データ) / REGIONS(五畿七道相当の守護単位)
     ├─ データ読込: assets/kamakura/provinces.json（国ノード＋隣接）、地図画像
     ├─ Rule（ゲームロジック純関数群）
     │    buildState / applyActions / endTurn / aiPolitics
     │    appointJito / revokeJito / appointShugo / revokeShugo
     │    grantOn / adjustHoko / raiseHyojoDispute / resolveHyojo
     │    startInvasionWave（S2専用）/ applyEventEffect
     ├─ 描画ヘルパー: frame/txt/button/drawKamon/drawPortrait（genpei踏襲）
     ├─ シーン: Backdrop → BootScene → TitleScene → ScenarioSelectScene
     │          → OpeningScene → FactionSelectScene → MapScene ⇄ BattleScene
     │          → (Could) ChronicleScene
     └─ 起動: game.changeScene(new BootScene()); game.start();
```

```
   [プレイヤー入力]
        │
   MapScene（全国マップ・コマンドバー）
        │  出兵/被侵攻
        ▼
   BattleScene（ヘックス戦術戦闘）
        │  勝敗
        ▼
   MapScene（結果反映）→ endTurn() → 他勢力AI（aiPolitics）→ TIMELINEイベント判定 → 次ターンへ
```

### 3.2 画面遷移

```
Boot → Title → ScenarioSelect → FactionSelect → Opening
  → MapScene ⇄ BattleScene（合戦発生時）
  → （勝敗成立）→ ResultScene/史書表示 → Title へ戻る
```

- **Title**: タイトルロゴ・パーティクル背景（`GameKit.Particles`）・「はじめる/Start」
- **ScenarioSelect**: シナリオカード一覧（S1/S2/S3）、時代・与件テキスト表示
- **FactionSelect**: シナリオ内のプレイアブル勢力一覧、家紋・当主・簡易ステータス表示
- **Opening**: 史実イントロの縦書き風テキスト演出（`genpei.html` の `OpeningScene` 踏襲）
- **MapScene**: 全国図＋国詳細パネル＋コマンドバー＋イベントログ（`genpei.html` の `L` レイアウト定数を鎌倉版に作り直す）
- **BattleScene**: ヘックス盤＋部隊パネル＋ログ
- **(Could) ChronicleScene**: 年代記・人物録

### 3.3 データ構造の概要

- **Province（国ノード）**: `{ id, jp, en, region, koku, adjacency:[id...], holder: factionId|null, jito: {by: factionId, since: turn}|null, garrison }`
- **Region（守護単位、五畿七道＋関東・九州等の粒度）**: `{ id, jp, en, provinces:[id...], shugo: factionId|null }`
- **Faction（御家人・朝廷・侵攻勢力）**: `{ id, jp, en, color, playable, ai, victory, home:[provinceId...], hoko, legitimacy }`
  - `hoko`（奉公度、0-100）: 得宗家/将軍への忠誠。恩賞で上昇、粛清・無視で低下、閾値割れで離反
  - `legitimacy`（権威/得宗専制度 or 倒幕大義、勢力の役割で意味が変わる）: `genpei.html` の `AUTHORITY` パターンを継承
- **General（武将）**: `{ id, faction, jp, en, born, died, stats:{tosotsu, chiryaku, busou, kakaku} }`（`genpei.html` の `GENERALS`/`GEN_BY_ID` 構造を踏襲）
- **Timeline Event**: `{ y, m, jp, en, fx? }`（`genpei.html` の `TIMELINE` 構造をそのまま踏襲）
- **HyojoDispute（評定案件、鎌倉幕府ゲーム新設）**: `{ id, turn, provinceId, claimantA, claimantB, strengthA, strengthB, resolved }`
- **InvasionWave（S2専用）**: `{ id, y, m, landingProvinces:[id...], strength, retreatsAfterTurns }`

### 3.4 主要コンポーネントの役割

| コンポーネント | 役割 |
|---|---|
| `Rule.buildState` | シナリオ・勢力選択から初期状態を構築 |
| `Rule.endTurn` | ターン送り・季節/年送り・AI実行・TIMELINE判定・奉公度自然減衰 |
| `Rule.aiPolitics` | 非操作勢力の行動決定（恩賞配分・出兵判断・評定介入） |
| `Rule.appointJito`/`revokeJito` | 地頭の任免。任免は所領収入・奉公度・評判に影響 |
| `Rule.appointShugo`/`revokeShugo` | 守護（地域単位の軍事警察権）の任免 |
| `Rule.raiseHyojoDispute`/`resolveHyojo` | 評定衆メカニクス。所領紛争の発生と裁定 |
| `Rule.startInvasionWave` | S2専用。元軍の上陸・撃退・撤退処理 |
| `MapScene` | 全国マップ表示・コマンド実行・国詳細パネル |
| `BattleScene` | ヘックス戦術戦闘（部隊移動・接敵・勝敗判定） |
| `drawKamon` | 家紋のコード描画（画像アセット不要） |

---

## 4. 詳細設計書

### 4.1 ファイル構成

```
kamakura.html                       … 本体（単一HTMLファイル、genpei.html/sengoku.html と同じ形式）
assets/kamakura/
  provinces.json                    … 国ノード＋隣接（assets/genpei/provinces.json を複製・改称して流用。国境は同一のため座標・隣接はそのまま利用可、shoen/kyoten等の源平期固有フィールドは間引く）
  README.md                         … アセット出典・流用元の記録（他ゲームと同様の慣習）
  kamakura-thumb.webp               … index.html掲載用サムネイル（Graphic-Designer or プロシージャル生成）
specs/kamakura_spec.md              … 本仕様書
```

地図背景画像は新規生成せず、`assets/sengoku/gpt/sengoku-japan-map-user-v2.webp`（または `assets/genpei/` 内の同種資産）を `assets/kamakura/` へ**コピー**して自ゲーム完結にする（他ゲームのフォルダを跨いで参照しない。CLAUDE.mdの「参照はフルパスとは限らない」節の轍を踏まないため、パスは必ず `assets/kamakura/` 配下に統一する）。

### 4.2 データモデル定義（代表例。Code-Generatorはこれを土台に全件を埋める）

```js
const W = 1440, H = 810;
const SAVE_VERSION = 1;
const canvas = document.getElementById('game');
const game = new GameKit.Engine(canvas, { width: W, height: H });
const save = new GameKit.Save('kamakura');

/* 御家人・朝廷・侵攻勢力 */
const FACTIONS = {
  hojo:      { jp: '北条氏', en: 'Hōjō', color: '#5dd6c7', playable: true,  ai: 'central',    victory: 'tokuso_survive',
               home: ['izu', 'sagami'] },
  miura:     { jp: '三浦氏', en: 'Miura', color: '#4a7fd4', playable: true,  ai: 'opportunist', victory: 'gokenin_survive',
               home: ['sagami'] },
  hatakeyama:{ jp: '畠山氏', en: 'Hatakeyama', color: '#8a6d3b', playable: true, ai: 'defensive', victory: 'gokenin_survive',
               home: ['musashi'] },
  hiki:      { jp: '比企氏', en: 'Hiki', color: '#c0392b', playable: true,  ai: 'aggressive', victory: 'gokenin_survive',
               home: ['musashi'] },
  wada:      { jp: '和田氏', en: 'Wada', color: '#e08a3c', playable: true,  ai: 'aggressive', victory: 'gokenin_survive',
               home: ['sagami'] },
  choutei:   { jp: '朝廷',   en: 'The Court', color: '#ecd9a0', playable: false, ai: 'court', victory: 'restore_rule',
               home: ['yamashiro'] },
};

/* 五畿七道相当の守護単位（region.id は provinces.json の region と対応させる） */
const REGIONS = {
  kanto: { jp: '関東', en: 'Kantō', provinces: ['sagami','musashi','izu', /* ... */] },
  kinai: { jp: '畿内', en: 'Kinai', provinces: ['yamashiro','yamato', /* ... */] },
  saikaido: { jp: '西海道', en: 'Saikaidō', provinces: ['chikuzen','hizen', /* ... */] },
  // ... 東海道/北陸道/山陰道/山陽道/南海道/東山道/奥州 まで踏襲
};

/* シナリオ */
const SCENARIOS = [
  { id: 's1199', jp: '執権への道', en: 'Road to the Regency',
    start: [1199, 1], end: [1221, 12], playable: ['hojo','miura','hatakeyama','hiki','wada'],
    lords: { hojo: '北条義時', miura: '三浦義村', hatakeyama: '畠山重忠', hiki: '比企能員', wada: '和田義盛', choutei: '後鳥羽上皇' },
    opening: '正治元年正月。\n源頼朝、急死す。\n鎌倉殿の座は嫡子・頼家へ移るが、御家人たちの目は既に次を見ている。\n\n——鎌倉は、刀を抜かずに国を奪う政治の時代に入る。' },
  { id: 's1268', jp: '文永・弘安の役', en: 'The Mongol Invasions',
    start: [1268, 1], end: [1281, 12], playable: ['hojo','adachi','shoni'],
    lords: { hojo: '北条時宗', adachi: '安達泰盛', shoni: '少弐資能' },
    opening: '文永五年。\n高麗の使者が国書を携えて来る。\n「蒙古、日本を臣従させんとす」。\n\n——博多の海に、異国の船影が立つのはもう間もなくのことだ。' },
  { id: 's1285', jp: '霜月騒動と幕府滅亡', en: 'The Shimotsuki Incident',
    start: [1285, 1], end: [1333, 12], playable: ['hojo','adachi','ashikaga','nitta'],
    lords: { hojo: '北条貞時', adachi: '安達泰盛', ashikaga: '足利高氏', nitta: '新田義貞' },
    opening: '弘安八年。\n得宗の専制は強まり、御家人たちの不満は積もる。\n\n——この先に何が起きるか、鎌倉はまだ知らない。' },
];

/* 年代記イベント（史実年月で自動発火、fx を持つものは盤面に効く） */
const TIMELINE = [
  { y: 1203, m: 9,  jp: '比企能員の変。比企一族滅ぶ', fx: 'hiki_incident' },
  { y: 1205, m: 6,  jp: '畠山重忠の乱。畠山氏滅ぶ', fx: 'hatakeyama_incident' },
  { y: 1213, m: 5,  jp: '和田合戦。和田義盛、討たれる', fx: 'wada_incident' },
  { y: 1221, m: 5,  jp: '承久の乱、勃発', fx: 'jokyu_war' },
  { y: 1221, m: 6,  jp: '幕府軍、京へ入る。三上皇配流', fx: 'jokyu_end' },
  { y: 1274, m: 10, jp: '文永の役。元軍、博多湾に上陸', fx: 'bunei_landing' },
  { y: 1274, m: 11, jp: '暴風雨、元軍を退ける', fx: 'bunei_storm' },
  { y: 1281, m: 6,  jp: '弘安の役。元軍、再び来寇', fx: 'koan_landing' },
  { y: 1281, m: 7,  jp: '神風、元軍を壊滅させる', fx: 'koan_storm' },
  { y: 1285, m: 11, jp: '霜月騒動。安達泰盛、討たれる', fx: 'shimotsuki' },
  { y: 1333, m: 5,  jp: '新田義貞、鎌倉へ攻め入る', fx: 'kamakura_fall_trigger' },
  { y: 1333, m: 5,  jp: '鎌倉幕府、滅亡', fx: 'bakufu_fall' },
];

/* 御恩と奉公・地頭/守護のルール定数 */
const RULE = {
  hoko: {
    base: 1.0, onGain: 12, revokeSub: 20, purgeSub: 40, defectBelow: 20, decayPerTurn: 0.3,
  },
  jito: { incomeShareToAppointee: 0.6, legitimacyOnAppoint: 3, hokoOnAppoint: 8 },
  shugo: { legitimacyOnAppoint: 6, revokeHokoSub: 15 },
  hyojo: { disputeChancePerTurn: 0.15, biasWinBonus: 20, neutralLegitimacy: 4 },
  invasion: { buneiStrength: 900, koanStrength: 1600, stormRetreatTurns: 2 }, // S2専用
};
```

### 4.3 主要関数・モジュール設計（シグネチャレベル）

```js
// 状態構築・進行
function buildState(scenarioId, factionId): State
function endTurn(state, audio): void            // 季節/年送り・aiPolitics一括実行・TIMELINE判定
function applyActions(state, fid, acts): void    // プレイヤー/AI共通の行動適用口

// 御恩と奉公・地頭/守護（本作の中核、新設）
function appointJito(state, byFid, provinceId, toFid): void
function revokeJito(state, byFid, provinceId): void       // 改易。対象factionのhokoを下げる
function appointShugo(state, byFid, regionId, toFid): void
function revokeShugo(state, byFid, regionId): void
function adjustHoko(state, fid, delta, why): void
function checkDefection(state, fid): boolean              // hoko < defectBelow で離反イベント発生

// 評定衆（新設）
function raiseHyojoDispute(state): HyojoDispute|null      // ターン開始時に確率発生
function resolveHyojo(state, disputeId, favor: 'A'|'B'|'neutral'): void

// 元寇（S2専用、新設）
function startInvasionWave(state, waveId): void
function resolveInvasionTurn(state): void                  // 上陸勢力の行動・撤退判定

// AI
function aiPolitics(state, fid): void   // 恩賞配分・地頭任免・出兵判断（genpei.html踏襲、行動数上限あり）

// イベント
function applyEventEffect(state, fx): void  // TIMELINEのfxをディスパッチ

// 合戦（ヘックス、genpei.html踏襲）
function hexToPixel(hx, hy, size)
function hexNeighbors(hx, hy)
function initBattle(state, spec): BattleState
const Battle = { /* ターン処理・命中/損耗計算・勝敗判定 */ };
```

### 4.4 UI/画面ごとの実装方針

- **共通**: `GameKit.UI` のGlassmorphismパネル・`frame/txt/button` ヘルパーを `genpei.html` から移植・改名して流用（コピー&改変、依存参照はしない）。黒背景 `#05070d` ＋シアン `#22d3ee` ／パープル `#a78bfa` の枠線・発光は控えめに（CLAUDE.md/design skill準拠）。
- **MapScene レイアウト（`L` 定数、genpei.html の値を鎌倉版に再配置）**:
  - `nation`: 全国図（国ノードをクリックで選択、勢力色で塗り分け）
  - `province`: 選択国の詳細（地頭・守護・所領高・駐留兵）
  - `hyojo`: 評定案件パネル（新設、発生中の紛争を裁定できるUIをここに独立配置）
  - `list`/`events`: 年代記ログ・自勢力一覧
  - `cmd`: コマンドバー（政務/軍事/人事/評定/外交/記録/ターン終了）
- **BattleScene**: `genpei.html` の `HEX`/`Battle` オブジェクトを移植し、部隊種別を鎌倉風に改称（`御家人騎馬武者`/`郎党`/`（S2限定）元軍歩兵`等）。地形は平地/山地/海岸（上陸戦用）程度で十分。
- **日英バイリンガル**: 全UI文言は `{jp, en}` を保持し、既存ゲームの表記パターン（JPメイン・ENサブ、`i18n-check` スキルのルール）に従う。

### 4.5 ヘックス合戦（v1スコープ）

- グリッド: 13×9目安（`genpei.html` の `HEX` を踏襲、盤サイズは戦況に応じて可変にしなくてよい）
- 地形: `plain`（平地）/`mountain`（山地、防御有利）/`coast`（元寇上陸戦専用、上陸ペナルティ）程度の3種で開始
- 部隊: 兵科は2〜3種（`御家人騎馬武者`＝機動力高、`郎党歩兵`＝標準、S2のみ`元軍`＝集団戦術・てつはうでSoftな範囲攻撃演出）
- 勝敗: 全滅/潰走ラインで判定。`sengoku.html` の `RULE.battle`（`breakBelow`/`routBelow`相当の士気崩壊ライン）パターンを踏襲

### 4.6 AI設計

- `aiPolitics(state, fid)`: 勢力の `ai` タイプ（`central`/`opportunist`/`defensive`/`aggressive`/`court`）ごとに行動方針を分岐（`genpei.html` の `FACTIONS[].ai` パターンをそのまま踏襲）
- 1ターンの行動数上限を設ける（`sengoku.html` の `RULE.ai.maxActions` 相当）。理由: 上限が無いと最大勢力が毎ターン全戦線で同時に行動し、弱小勢力が初手で消える（`sengoku.html` の実装コメントに実例あり）
- `choteki`勢力（S1の朝廷、S3の後醍醐天皇方）は通常ターンは静観し、`legitimacy`が閾値を超えた時点でTIMELINEの `fx` を介して挙兵する設計（`genpei.html` の `declareChoteki` パターン踏襲）

### 4.7 セーブ/ロード

- `GameKit.Save('kamakura')` を使用。`SAVE_VERSION` を持たせ、`migrateState()` でスキーマ変更に備える（`genpei.html` の `migrateState` パターン踏襲）

### 4.8 必要アセット一覧と優先順位

| アセット | 優先方針 |
|---|---|
| 全国地図背景 | **流用（新規生成不要）**。`assets/sengoku/`または`assets/genpei/`の地図WebPを `assets/kamakura/` へコピー |
| 国ノード座標・隣接データ | **流用**。`assets/genpei/provinces.json` を複製・整理（源平期固有フィールドは削る） |
| 家紋（北条三つ鱗、三浦三つ引両、畠山、比企、和田、足利二つ引、新田大中黒 等） | **コード描画**。`genpei.html` の `drawKamon` パターンを移植し家紋種を追加。画像アセット不要 |
| 武将肖像 | **プロシージャル（Could）**。`drawProceduralPortrait`系のコード描画で代替可、Graphic-Designerへの依頼は必須にしない |
| イベント挿絵（承久の乱・元寇上陸等） | **任意（Could）**。無くても文章のみで成立させる。依頼する場合はGraphic-Designerへ個別発注 |
| サムネイル（index.html掲載用） | プロシージャル生成（`GameKit.Gen`）または簡易コード描画で可 |
| BGM/SE | **Must最低限はGameKit標準の`GameKit.Sfx`プロシージャル効果音のみ**。Music-Generatorへのジングル追加依頼はShould（任意） |

### 4.9 デザイン規約（再掲・遵守事項）

- 黒背景 `#05070d` 系＋シアン `#22d3ee`／パープル `#a78bfa` のGlassmorphism（UIクローム）
- サイバーパンク的演出禁止（ネオングロウ過多・マゼンタ等の原色ネオン・SF都市風）
- 勢力識別色は史実準拠の落ち着いた配色でよい（3.4/2.5節参照、UIクロームとは別枠）
- 日英バイリンガル表記必須
- ライブラリはCDN経由のみ、ビルドツール不使用、Canvas APIのみで完結

---

## 5. v1スコープ外（既知の制限）

- `sengoku.html` 級の攻城ヘックス・実データCSV取込パイプラインは新設しない
- 全66国個別イベントの完全実装は行わない（主要国・主要人物中心）
- 元寇の上陸戦は「侵攻波」の抽象モデルとし、`sengoku.html`のような詳細な城郭トレースは行わない
- モバイル最適化・タッチジェスチャの完全対応は任意（既存ゲーム群と同水準）
- 後醍醐天皇方のプレイヤー選択は任意（Could、AI専用でv1完結可）

---

## 6. 実装ステップ（Code-Generatorへの引き継ぎ順序）

大規模実装のため、シーン/機能単位で段階分割する。各ステップ完了後に `node scripts/verify-*` 相当の動的検証（`dynamic-test` スキル）を挟むこと。タイムアウトが見込まれる場合はステップ2〜4を複数Code-Generatorへ分割してよい（ファイル単位ではなく本ファイルの担当セクション単位で分割し、着手前に担当範囲を明示する）。

1. **骨格構築**: `kamakura.html` を `gamekit/template.html` から作成、`W/H/canvas/game/save` の初期化、`RULE/FACTIONS/REGIONS/SCENARIOS/TIMELINE` の定数群を4.2の雛形から全件へ拡充。`assets/kamakura/provinces.json` を `assets/genpei/provinces.json` から複製・整理して配置
2. **状態構築とコアロジック**: `buildState/applyActions/endTurn/aiPolitics` と 4.3 の御恩奉公・地頭守護・評定衆関数群を実装（ヘッドレスで状態遷移をconsole検証できる段階まで）
3. **基本シーン**: `Backdrop/BootScene/TitleScene/ScenarioSelectScene/OpeningScene/FactionSelectScene` を実装（`genpei.html`から移植・改名）
4. **MapScene**: 全国図描画・国ノード選択・コマンドバー・評定パネル・年代記ログを実装
5. **BattleScene**: ヘックス戦術戦闘を実装（4.5節）
6. **S2元寇の侵攻波ロジック**: `startInvasionWave/resolveInvasionTurn` とTIMELINE連携（`bunei_landing/bunei_storm/koan_landing/koan_storm`）
7. **勝敗判定・エンディング**: シナリオ×勢力ごとの勝敗テキスト表示
8. **仕上げ**: セーブ/ロード動作確認、日英表記の総点検（`i18n-check`）、a11y簡易確認、`kamakura-thumb.webp` 生成とindex.htmlへのカード追加（`game-release`スキルの手順に従う。ただし本仕様書のスコープは実装まで。リリース作業はEvaluator合格後に別途）

---

## 7. 検証観点（Dynamic-Tester／手動）

- 起動→タイトル→シナリオ選択→勢力選択→オープニング→マップ画面まで例外0件で到達すること（`sengoku.html`の教訓: タイトルが出ても描画ループ例外でUIが出ないケースがあるため、マップ画面到達まで確認必須）
- ターン終了を数十回連続実行してもクラッシュ・無限ループしないこと（`verify-sengoku-balance.mjs`相当の長期進行検証があれば望ましい）
- 御恩/奉公・地頭/守護の任免操作が状態に正しく反映されること（付与→奉公度上昇、改易→奉公度下降→閾値割れで離反）
- 評定裁定の3分岐（favor A/B/neutral）がそれぞれ状態を変えること
- ヘックス合戦が発生・終了し、結果が全国マップに反映されること
- S2元寇: 文永・弘安の両侵攻波が発火し、暴風雨イベントで撤退処理が起きること
- S1承久の乱・S3幕府滅亡のTIMELINEイベントが史実年月で発火し、勝敗判定に接続すること
- セーブ→リロード→ロードで状態が復元されること
- 日英表記の欠落がないこと、サイバーパンク的演出（過剰ネオン・原色マゼンタ等）が混入していないこと
