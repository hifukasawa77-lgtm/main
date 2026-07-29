---
type: 基本設計書
project: sanguo
status: 承認済み
agent: planner
target_file: sanguo.html
created: 2026-07-28
updated: 2026-07-29
tags: [claudechord, 基本設計, sanguo]
---

# 基本設計書 — 三国志・天下三分 機能拡張

> プロジェクトハブ: [[sanguo]] ／ 上流: [[sanguo_要件定義]] ／ 下流: [[sanguo_詳細設計]]

## 1. システム構成・全体像

### 1.1 ファイル構成（決定事項）

**判断: 単一HTML維持ではなく「データのみ外部化」のハイブリッドを採る。**

| 選択肢 | 評価 |
|---|---|
| A. 単一 `sanguo.html` を維持 | 8シナリオ×20都市の setup（約200行）と二つ名テーブル（約120行）で HTML が肥大し、code-generator が既存行を読むだけでコンテキストを消費する。**却下** |
| B. ES Modules で全面分割 | `dynamic-test` が `file://` でページを開くため module スクリプトが CORS で読み込めず、既存の品質ゲートが機能しなくなる。**却下** |
| C. **データ表のみ classic script で外部化・ロジックは既存IIFE内に維持** | classic `<script src>` は `file://` でも GitHub Pages でも動く。既存 IIFE のクロージャ構造を壊さない。差分レビューがデータとロジックで分離される。**採用** |

```
/sanguo.html                          … ロジック本体（既存IIFE内に追記）
/assets/js/sanguo-scenarios.js        … 新規: window.SANGUO_SCENARIOS（8シナリオ setup）
/assets/js/sanguo-lore.js             … 新規: window.SANGUO_LORE（二つ名・出身地・在野配分の史実重み）
/assets/sanguo/gpt/scenarios/*.png    … 既存8枚（変更なし）
/assets/sanguo/gpt/battles/*.png      … 既存12枚（変更なし）
```

読み込み順（`sanguo.html` の `<script>` 直前に配置）:

```html
<script src="assets/js/sanguo-scenarios.js"></script>
<script src="assets/js/sanguo-lore.js"></script>
<script>(() => { /* 既存IIFE */ })()</script>
```

**フォールバック必須**: 外部JSが読めなかった場合（`window.SANGUO_SCENARIOS` が undefined）は、
190年反董卓の内蔵ミニマル setup で起動し、シナリオ選択を1件に縮退させる。ゲームが起動不能にならないこと。

### 1.2 レイヤ構成

```
┌─────────────────────────────────────────────────────────────┐
│ データ層（外部 classic script / 定数）                       │
│  SANGUO_SCENARIOS  SANGUO_LORE                              │
│  FACTIONS(10) CITIES(20 地理不変) GENERAL_IDS/JP/STATS      │
│  ECON  PLOT  DUEL  WEATHER  TERR  UNITS  BHEX               │
└───────────────┬─────────────────────────────────────────────┘
                │ applyScenario() が可変フィールドを注入
┌───────────────▼─────────────────────────────────────────────┐
│ 状態層  state{...} / CITIES[].{owner,garrison,...} / GEN{}  │
│  ・state: 国家スカラ（gold, food, weather, scenario, …）     │
│  ・CITIES[]: 都市スカラ（agriculture, commerce, wall, …）    │
│  ・GEN[generalId]: 武将ランタイム（loyalty, injuredUntil, …）│
│  ・state.battle: 合戦ローカル（stacks[].morale, fires, …）   │
└───────────────┬─────────────────────────────────────────────┘
     ┌──────────┴──────────┬───────────────┬──────────────┐
┌────▼─────┐  ┌────────────▼───┐  ┌────────▼───┐  ┌──────▼──────┐
│ 戦略層    │  │ 経済層          │  │ 人事層      │  │ 合戦層       │
│ endTurn   │  │ tickEconomy     │  │ 在野探索    │  │ b*() 群      │
│ runAI     │  │ 兵糧収支        │  │ 登用/転属   │  │ 士気/一騎打ち│
│ 戦略計略  │  │ 内政5種         │  │ 忠誠/引抜   │  │ 合戦計略/天候│
└────┬──────┘  └────────┬───────┘  └────┬───────┘  └──────┬──────┘
     └──────────┬────────┴───────────────┴─────────────────┘
┌───────────────▼─────────────────────────────────────────────┐
│ 表現層  draw()(mapCanvas) / bDraw()(battleCanvas) /          │
│         updateUI()(DOM sidePanel) / モーダル群 / sfx()        │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 画面・UI 設計

### 2.1 画面遷移（★変更あり）

**現行**（要件 M-05 で反転する）:
```
タイトル ─(勢力カード選択)→ [開始] ─→ シナリオ一覧 ─→ 開幕ストーリー ─→ ゲーム
                                        ↑ 勢力を先に選ぶため、その年代に存在しない勢力も選べてしまう
```

**新設計**:
```
                 ┌────────────────────────────────────────────────┐
                 │ タイトル (#startScreen)                          │
                 │  [続きから] [シナリオを選ぶ / CHOOSE SCENARIO]   │
                 └───────┬────────────────────────────┬───────────┘
                         │                            │ 続きから
        ┌────────────────▼──────────────┐             │
        │ ① シナリオ一覧 (scenarioModal) │             │
        │  8枚カード（年代・タイトル）    │             │
        └────────┬───────────────▲──────┘             │
                 │               │ 戻る                │
        ┌────────▼───────────────┴──────┐             │
        │ ② 開幕ストーリー（既存 openStory）│            │
        │  イラスト＋口上＋[勢力を選ぶ]     │            │
        └────────┬───────────────▲──────┘             │
                 │               │ 戻る                │
        ┌────────▼───────────────┴──────┐             │
        │ ③ 勢力選択（新設 openFactionPick）│            │
        │  playable の勢力カードのみ表示    │            │
        │  初期領数・初期金・初期兵糧を併記  │            │
        │  難易度★表示                     │            │
        └────────┬──────────────────────┘             │
                 │ [この勢力で開始]                     │
        ┌────────▼─────────────────────────────────────▼────────┐
        │ ゲーム画面 (#gameScreen)                                │
        │  topbar: 年代/巡/勢力/領/金/[兵糧]/[天候] ★2項目追加     │
        │  mapShell: mapCanvas ＋ sidePanel ＋ 各種オーバーレイ    │
        └───┬───────────────┬───────────────┬───────────────────┘
            │ 攻撃           │ 外交/名鑑/計略  │ 次のターン
   ┌────────▼────────┐ ┌────▼──────────┐   │
   │ 合戦 (#battleScreen)│ │ オーバーレイ群 │   │
   │  ヘックス戦        │ │ 外交/名鑑/     │   │
   │  ├ 一騎打ち演出 ★  │ │ 在野探索★/    │   │
   │  └ 合戦計略 ★     │ │ 戦略計略★/    │   │
   └────────┬────────┘ │ 武将配置転換★  │   │
            │ 決着       └───────────────┘   │
            └──────────────→ ゲーム画面 ←──────┘
```

**理由**: 勢力の存在可否は年代に従属する（董卓は208年に存在しない）。従属する側を後に選ばせるのが自然で、
シナリオ側の `playable` が UI の唯一のソースになるためバグが入りにくい。

### 2.2 追加UI一覧

| # | UI | 配置 | 日英表記 |
|---|---|---|---|
| U-01 | 兵糧インジケータ | topbar `#foodText` | 兵糧 / FOOD |
| U-02 | 天候インジケータ | topbar `#weatherText`（アイコン＋名称） | 天候 / WEATHER |
| U-03 | 兵糧収支ツールチップ | topbar hover / タップ | 収穫 −消費 = 残 / Balance |
| U-04 | 内政5ボタン | sidePanel `.panelActions` を2段グリッドへ | 農業 AGRI / 商業 TRADE / 徴兵 LEVY / 城壁 WALL / 施し RELIEF |
| U-05 | 都市ステータス拡張 | sidePanel `.cityStats` を 3→7 項目 | 兵力/民政/農業/商業/城壁/民忠/武将 |
| U-06 | 在野探索ボタン＋結果モーダル | sidePanel ＋ `#scoutOverlay` | 在野探索 / SCOUT |
| U-07 | 登用交渉モーダル | `#scoutOverlay` 内 | 登用 / RECRUIT（提示金額と成功率） |
| U-08 | 武将リスト（忠誠バー付き） | sidePanel `駐屯武将` を刷新 | 忠誠 / LOYALTY |
| U-09 | 配置転換UI | 武将行から `#transferOverlay` | 配置転換 / TRANSFER |
| U-10 | 恩賞ボタン | 武将行 | 恩賞 / REWARD |
| U-11 | 戦略計略オーバーレイ | topbar `#plotButton` → `#plotOverlay` | 計略 / STRATAGEM |
| U-12 | 合戦計略バー | battleScreen `#bPlotBar`（`#bSelect` 下） | 火計 FIRE / 伏兵 AMBUSH / 混乱 CONFUSE / 鼓舞 RALLY |
| U-13 | 一騎打ち挑戦ボタン | `#bSelect` 内（隣接敵がいるときのみ） | 一騎打ち / DUEL |
| U-14 | 名乗り演出レイヤ | battleCanvas 上に直接描画（DOMではない） | — （Canvas描画） |
| U-15 | 士気バー | `bDrawStack()` のスタック描画に追加 | — （視覚要素） |
| U-16 | 合戦天候バッジ | battleScreen `.bInfo` | 天候 / WEATHER |

### 2.3 レイアウト方針

- 既存のパネル構造・CSS変数（`--gold #e4c27b` / `--ink` / `--muted` / `--line` / `--red` / `--teal` / `--blue`）をそのまま使う
- **新規カラーは原則追加しない**。どうしても必要な場合のみ以下の範囲に留める（すべて低彩度・既存トーンと同系）:
  - 兵糧: `--grain:#c8b273`（金の低彩度版）
  - 士気: 既存 `--teal` を流用
  - 火計: 既存 `--red` を流用（**発光を重ねない。ネオン表現禁止**）
- 追加勢力カラー（サイバーパンク禁止規約に適合する低彩度アース系）:

| 勢力 | id | 君主 | color | 根拠 |
|---|---|---|---|---|
| 黄巾賊 | `turban` | 張角 | `#bfae63` | 黄巾＝黄土色。既存 `--gold` と近縁だが彩度を落として区別 |
| 呂布軍 | `lubu` | 呂布 | `#7e6a9b` | 既存 `dong #8a6fb2` の暗色系。同族的な武断勢力 |
| 荊州軍 | `biao` | 劉表 | `#5f8a9c` | 既存 `--blue #718bb7` と `--teal` の中間。長江の水色 |
| 南蛮 | `nanman` | 孟獲 | `#7a9a5e` | 南方の密林＝抑えた緑。既存 `--teal #6fb2a4` と識別可能 |

### 2.4 モバイル（1260x540）対応方針

| 課題 | 対策 |
|---|---|
| topbar に兵糧・天候を足すと横幅が溢れる | `@media (max-height:600px)` で `.topStats` の一部（`領`）をアイコン化し、天候は絵文字1文字＋`title` 属性に縮退 |
| 内政ボタンが5つになり sidePanel が縦に伸びる | `.panelActions` を `grid-template-columns:repeat(2,1fr)`（狭幅時は3列）に。ボタン高さ 32px |
| 合戦計略バーがヘックス盤に被る | `#bPlotBar` を `#bSelect` と同じ右下カラムに積み、`max-height:34vh; overflow:auto` |
| 一騎打ち演出が縦に収まらない | 名乗りレイヤは Canvas 中央帯（高さ 46%）に固定描画。フォントサイズを `battleCanvas` 高さ比で算出 |
| オーバーレイ（在野探索・計略）が全画面を覆う | 既存 `.rosterOverlay` / `.rosterBox` のスタイルを再利用（既にレスポンシブ対応済み） |

---

## 3. データ設計

### 3.1 勢力 FACTIONS（6 → 10）

既存6件はそのまま。以下4件を追加する。

```js
// 追記のみ。既存6件の id/name/leader/color/desc は変更しない
{id:'turban', name:'黄巾賊', leader:'張角', color:'#bfae63', desc:'蒼天已死、黄天當立。太平道の信徒が各地で蜂起する'},
{id:'lubu',   name:'呂布軍', leader:'呂布', color:'#7e6a9b', desc:'人中の呂布、馬中の赤兎。武を恃み天下を渡る'},
{id:'biao',   name:'荊州軍', leader:'劉表', color:'#5f8a9c', desc:'襄陽に拠り、荊州の富と人材を保つ'},
{id:'nanman', name:'南蛮',   leader:'孟獲', color:'#7a9a5e', desc:'南中の諸族を率い、山林と象兵で蜀を脅かす'}
```

**`han`（漢室）の運用ルール（重要）**: 勢力数の爆発を避けるため、`han` を
**「未統合の漢朝勢力（朝廷・宗室系太守・地方独立勢力）を束ねる中立枠」** として運用する。
劉焉/劉璋（益州）・張魯（漢中）・韓玄ら荊南太守はすべて `han` に含める。
これは意図的な簡略化であり、シナリオ setup の `notes` に明記する。

### 3.2 都市 CITIES の拡張

`CITIES` は **地理（不変）と国情（可変）に責務分離**する。

| 分類 | フィールド | 変更 | 説明 |
|---|---|---|---|
| 地理（不変） | `id / name / x / y / neighbors` | 変更なし | シナリオでも上書きしない |
| 国情（可変・既存） | `owner / garrison / prosperity / generals[]` | シナリオで上書き | |
| 国情（可変・**追加**） | `agriculture` | 新規 | 農業度 0-100。兵糧収穫の基礎値 |
| | `commerce` | 新規 | 商業度 0-100。金収入の基礎値 |
| | `wall` | 新規 | 城壁 0-100。攻城戦の防御補正に直結 |
| | `loyalty` | 新規 | 民忠 0-100。反乱・流言・埋伏の毒の対象 |
| | `food` | 新規 | 都市備蓄兵糧（国庫 `state.food` とは別。遠征持ち出しの原資） |
| | `wild[]` | 新規 | 未発見の在野武将ID配列 |
| | `found[]` | 新規 | 探索で発見済み・未登用の在野武将ID配列 |
| | `plotFlags` | 新規 | `{poisonBy: factionId|null, rumorUntil: turn}` 計略の潜伏状態 |

初期値の既定（シナリオが明示しない場合）:
`agriculture = prosperity`, `commerce = Math.round(prosperity*0.8)`, `wall = Math.round(30 + prosperity*0.4)`,
`loyalty = 60`, `food = garrison * 4`

### 3.3 シナリオ setup — データ構造の決定

**判断: 「190年ベース＋差分」ではなく「全20都市を毎回フルで持つ（タプル短縮記法）」を採る。**

| 選択肢 | 評価 |
|---|---|
| A. 190年をベースに差分だけ持つ | 184（黄巾蜂起）と223（三国鼎立後）は20都市中17〜19都市が190年と異なるため、差分にしても圧縮率がほぼ出ない。加えて「差分を頭の中で適用しないと盤面が読めない」ため、史実検証・バランス調整・バグ調査のすべてでコストが跳ね上がる。適用順序に依存する暗黙のバグも入りやすい。**却下** |
| B. **全20都市をタプル短縮記法でフル記述** | 1シナリオ＝20行、8シナリオ＝約160行。外部ファイルへ出せば HTML は太らない。`Object.keys(cities).length === 20` を起動時に検証でき、盤面が一目で読める。**採用** |

```js
// assets/js/sanguo-scenarios.js
window.SANGUO_SCENARIOS = [
  {
    id:'red_cliffs',            // SCENARIO_STORIES の id と1:1対応（既存8件のidを流用）
    year:208,
    playable:['wei','shu','wu'],
    victory:{ratio:0.75, hint:'長江を制し、天下の趨勢を決せよ'},
    gold:{def:600, by:{wei:900, shu:350, wu:700}},   // 勢力別の初期金
    food:{def:1200, by:{wei:2000, shu:600, wu:1400}},// 勢力別の初期兵糧
    relations:[['shu','wu','alliance']],             // 孫劉同盟を開始時に付与
    wildSeed:'red_cliffs',                           // 在野プール配分の乱数シード
    notes:'荊州北部は曹操が制圧済み。荊南四郡と益州・漢中は han（中立枠）が保持する。',
    // cityId: [owner, garrison, prosperity, [固定配置する武将ID]]
    cities:{
      chang_an:['wei',70,60,['zhong_yao']],
      luo_yang:['wei',66,74,[]],
      ye:['wei',88,70,['cao_pi']],
      /* … 全20都市を必ず列挙 … */
    }
  },
  /* … 8シナリオ … */
];
```

**タプル記法の理由**: `{owner:'wei',garrison:70,...}` だと1都市1行に収まらず視認性が落ちる。
タプルは短く、`applyScenario()` の1箇所でのみ展開されるため可読性リスクは局所化される。

### 3.4 シナリオ別 勢力配置（史実ベース・確定案）

20都市の粒度では史実の郡県を完全再現できないため、**代替マッピングを明示**する。

| 都市 | 184 黄巾 | 190 反董卓 | 198 呂布 | 200 官渡 | 207 三顧 | 208 赤壁 | 214 益州 | 223 五路 |
|---|---|---|---|---|---|---|---|---|
| 長安 chang_an | dong | dong | han | han | han | wei | wei | wei |
| 洛陽 luo_yang | han | dong | wei | wei | wei | wei | wei | wei |
| 鄴 ye | turban | yuan | yuan | yuan | wei | wei | wei | wei |
| 平原 ping_yuan | shu | shu | shu | yuan | wei | wei | wei | wei |
| 許昌 xu_chang | wei | wei | wei | wei | wei | wei | wei | wei |
| 宛 wan | turban | dong | wei | wei | wei | wei | wei | wei |
| 漢中 han_zhong | han | han | han | han | han | han | han | shu |
| 成都 cheng_du | han | han | han | han | han | han | shu | shu |
| 梓潼 zi_tong | han | han | han | han | han | han | shu | shu |
| 江州 jiang_zhou | han | han | han | han | han | han | shu | **nanman** |
| 襄陽 xiang_yang | han | biao | biao | biao | biao | wei | wei | wei |
| 江陵 jiang_ling | turban | biao | biao | biao | biao | wei | shu | wu |
| 江夏 jiang_xia | han | biao | biao | biao | biao | **shu** | wu | wu |
| 長沙 chang_sha | turban | biao | biao | **shu** | **shu** | han | shu | wu |
| 武昌 wuchang | han | wu | wu | wu | wu | wu | wu | wu |
| 建業 jian_ye | han | wu | wu | wu | wu | wu | wu | wu |
| 合肥 he_fei | han | wei | **lubu** | wei | wei | wei | wei | wei |
| 鄱陽 poyang | han | wu | wu | wu | wu | wu | wu | wu |
| 会稽 kuai_ji | wu | wu | wu | wu | wu | wu | wu | wu |
| 遼東 liao_dong | yuan | yuan | yuan | yuan | wei | wei | wei | wei |

勢力別都市数と選択可能勢力:

| シナリオ | 都市数の内訳 | playable | victory.ratio |
|---|---|---|---|
| 184 黄巾の乱 | han 11 / turban 4 / dong 1 / wei 1 / shu 1 / wu 1 / yuan 1 | turban, wei, shu, wu, yuan, dong, han | 0.70 |
| 190 反董卓 | dong 3 / yuan 2 / wei 2 / shu 1 / biao 4 / wu 4 / han 4 | dong, yuan, wei, shu, wu, biao, han | 0.60 |
| 198 呂布討伐 | wei 3 / lubu 1 / yuan 2 / shu 1 / biao 4 / wu 4 / han 5 | wei, lubu, yuan, shu, biao, wu | 0.60 |
| 200 官渡 | wei 4 / yuan 3 / shu 1 / biao 3 / wu 4 / han 5 | wei, yuan, shu, biao, wu | 0.65 |
| 207 三顧の礼 | wei 7 / biao 3 / shu 1 / wu 4 / han 5 | wei, biao, shu, wu | 0.70 |
| 208 赤壁 | wei 10 / shu 1 / wu 4 / han 5 | wei, shu, wu | 0.80 |
| 214 益州平定 | wei 9 / shu 5 / wu 5 / han 1 | wei, shu, wu | 0.75 |
| 223 五路侵攻 | wei 9 / wu 7 / shu 3 / nanman 1 | shu, wei, wu, nanman | 0.75 |

**史実からの意図的な逸脱（設計判断）**:

| # | 逸脱 | 理由 |
|---|---|---|
| D-01 | 呂布の本拠を「下邳」ではなく `he_fei`（合肥）とする | 都市リストに徐州・淮南の都市が存在しない。合肥は許昌・武昌・建業に隣接しており、四面楚歌の包囲戦を再現できる |
| D-02 | 184年の劉備を `ping_yuan`（平原）保持とする | 史実の劉備は184年時点で無領地。playable にするため最小1都市が必要。平原相は後年の実任地であり乖離が小さい |
| D-03 | 190年に `biao`（荊州軍）を新設し、現行の「襄陽・江陵が董卓領、長沙が蜀領」を補正 | 現行配置は史実と大きく乖離しており、シナリオを実データ化する本件で放置すると矛盾が固定化する。**深澤の承認事項** |
| D-04 | 益州（劉璋）・漢中（張魯）・荊南太守を `han` に集約 | 勢力カード・外交画面の破綻を避けるため。3.1 の中立枠ルール |
| D-05 | 223年の南蛮に `jiang_zhou`（江州）を割り当て | 南中に相当する都市が存在しない。江州は成都・梓潼に隣接し、蜀の南方脅威として機能する |
| D-06 | 208年赤壁の劉備を `jiang_xia`（江夏）1都市とする | 史実の夏口に対応。1都市からの逆転が赤壁シナリオの主題であり、難易度★★★として提示する |

### 3.5 武将ランタイム GEN

武将は現在 `CITIES[].generals[]` に ID 文字列としてのみ存在し、個体の状態を持てない。
**都市配列とは独立した辞書 `GEN` を新設**する（正規化。武将が移動しても状態が追随する）。

```js
// state.gen: { [generalId]: {...} }  ※ 存在しないIDは genOf() が既定値で遅延生成
{
  loyalty: 70,        // 忠誠 0-100
  service: 'wei',     // 所属勢力 id。'' なら在野
  at: 'xu_chang',     // 在城 cityId。在野なら発見された都市
  exp: 0,             // 通算戦功（Could: 名鑑表示用）
  duelWin: 0, duelLose: 0,  // 一騎打ち戦績（Could）
  injuredUntil: 0,    // このターンまで負傷（武力・統率に一時ペナルティ）
  movedTurn: 0        // 配置転換した最終ターン（同一ターン内の連続移動を禁止）
}
```

**在野プールの配分方針**: `GENERAL_IDS`（150人超）のうち、シナリオ setup が
`cities[].generals` に明示していない全員を在野とし、シード付き決定論 PRNG で各都市の `wild[]` に配る。
配分重みは `SANGUO_LORE.affinity`（著名武将の史実ゆかりの地）＋都市 `prosperity` を用いる。
シードはシナリオ id 固定なので **同じシナリオでは毎回同じ在野配置になり、攻略性とテスト再現性が担保される**。

### 3.6 state の拡張

```js
const state = {
  // ===== 既存（変更なし） =====
  screen, faction, year, turn, gold, selectedCity, zoom, panX, panY,
  drag, log, rosterData, relations, battle, muted, over,

  // ===== 追加 =====
  scenario:  'anti_dong_zhuo',  // 進行中シナリオ id
  food:      1200,              // 国庫兵糧
  weather:   'clear',           // 'clear'|'rain'|'fog'|'wind'
  season:    'spring',          // 'spring'|'summer'|'autumn'|'winter'（turn から導出）
  gen:       {},                // 3.5 の武将ランタイム辞書
  victory:   {ratio:0.6, hint:''}, // シナリオ由来の勝利条件
  plotCooldown: {},             // {計略種別: 使用可能になるturn}
  rngSeed:   0                  // 決定論PRNGの現在シード（在野配分・天候に使用）
};
```

### 3.7 合戦スタックの拡張

`bBuildStacks()` が生成するスタックへ以下を追加する。

| フィールド | 型 | 説明 |
|---|---|---|
| `morale` | number 0-100 | 士気。初期値は 60 + 統率/5 + 勢力補正 |
| `morale0` | number | 初期士気（回復上限の基準） |
| `commander` | boolean | 総大将フラグ。統率最上位の1名に付与 |
| `hidden` | boolean | 伏兵状態（1ターン不可視） |
| `confusedUntil` | number | このラウンドまで行動不能 |
| `duelDone` | boolean | このラウンドに一騎打ち済み（1ラウンド1回制限） |
| `supply` | number | 攻撃側のみ。持ち出した兵糧。0でラウンド毎に士気低下 |

`state.battle` へ追加:

| フィールド | 説明 |
|---|---|
| `weather` | 合戦開始時に確定する天候（マップ天候を継承、地形で補正） |
| `windDir` | 風向き 0-5（ヘックス6方位）。火計の延焼方向を決める |
| `fires` | `{ 'c,r': {turnsLeft:number} }` 延焼中ヘックス |
| `duel` | 一騎打ち演出の進行状態（null なら非表示） |
| `plotUsed` | `{ [stackId]: {fire:bool, ambush:bool, ...} }` 部隊ごとの計略使用履歴 |

### 3.8 定数テーブル（新規）

マジックナンバー散逸を防ぐため、4つの定数オブジェクトに集約する。詳細値は [[sanguo_詳細設計]] 第3章。

| 名称 | 内容 |
|---|---|
| `ECON` | 内政5種のコスト・効果量・兵糧の収穫/消費レート・遠征持ち出し係数・枯渇ペナルティ |
| `PLOT` | 戦略/合戦計略7種のコスト・基礎成功率・クールダウン・効果量 |
| `DUEL` | 一騎打ちの受諾判定係数・打ち合い回数・損害・討死率・士気波及量 |
| `WEATHER` | 天候4種の発生重み（季節別）・弓射程補正・火計倍率・視界制限 |

---

## 4. モジュール分割

`sanguo.html` の IIFE 内をコメントバナーで区画化する（既存の `// ===== ヘックス合戦 =====` と同じ流儀）。

| # | 区画（バナー） | 責務 | 新規/既存 |
|---|---|---|---|
| 1 | `===== 定数・データ =====` | FACTIONS / CITIES / GENERAL_* / ECON / PLOT / DUEL / WEATHER | 既存＋追加 |
| 2 | `===== 乱数・ユーティリティ =====` | 決定論PRNG `srand/rnd`、`clamp`、`seasonOf()` | **新規** |
| 3 | `===== シナリオ =====` | `SCENARIO_STORIES` / `applyScenario()` / `validateSetup()` / `distributeWild()` | 既存＋大幅追加 |
| 4 | `===== 起動フロー・画面遷移 =====` | シナリオ選択 → ストーリー → 勢力選択 → `enterGame()` | 既存を再構成 |
| 5 | `===== マップ描画 =====` | `draw()` / `point()` / `view()` / 入力ハンドラ | 既存（軽微変更） |
| 6 | `===== 経済・ターン =====` | `endTurn()` / `tickEconomy()` / 内政5関数 / 兵糧収支 | 既存＋追加 |
| 7 | `===== 人事 =====` | `genOf()` / 在野探索 / 登用交渉 / 配置転換 / 恩賞 / 引き抜き | **新規** |
| 8 | `===== 計略（戦略） =====` | 離間 / 流言 / 埋伏の毒 / 成功判定 | **新規** |
| 9 | `===== 外交 =====` | `ensureRel()` 他 | 既存 |
| 10 | `===== AI =====` | `runAI()`（内政・兵糧・計略の判断を追加） | 既存＋追加 |
| 11 | `===== 天候 =====` | `rollWeather()` / `weatherEffects()` | **新規** |
| 12 | `===== ヘックス合戦 =====` | `b*()` 群 | 既存＋改修 |
| 13 | `===== 合戦計略 =====` | `bPlotFire()` / `bPlotAmbush()` / `bPlotConfuse()` / `bPlotRally()` / 延焼処理 | **新規** |
| 14 | `===== 一騎打ち =====` | `bDuelStart()` / 名乗り演出 / 打ち合い / 決着 / 描画 | **新規** |
| 15 | `===== UI・DOM =====` | `updateUI()` / `cityPanel()` / 各オーバーレイ | 既存＋追加 |
| 16 | `===== SFX =====` | `sfx()` | 既存＋追加 |
| 17 | `===== セーブ =====` | `saveGame()` / `loadGame()` / `migrateSaveV1()` / `clearSave()` | 既存＋追加 |

---

## 5. セーブ仕様

### 5.1 v2 フォーマット

```js
const SAVE_KEY_V1 = 'sanguo_save_v1';  // 読み込み専用（マイグレーション元）
const SAVE_KEY    = 'sanguo_save_v2';  // 新・読み書き

{
  v: 2,
  scenario, faction, year, turn, gold, food, weather, season,
  selectedCity, over, muted, relations, victory, plotCooldown, rngSeed,
  gen: { [generalId]: {loyalty, service, at, injuredUntil, movedTurn, duelWin, duelLose} },
  cities: [{ id, owner, garrison, prosperity,
             agriculture, commerce, wall, loyalty, food,
             generals, wild, found, plotFlags }]
}
```

**保存しないもの**: `state.battle`（合戦中のセーブは非対応。既存も同様）、`rosterData`（UI キャッシュ）、
`zoom/panX/panY`（既存も未保存）。

### 5.2 マイグレーション方針

```
loadGame()
  ├ localStorage[SAVE_KEY](v2) あり → そのまま復元
  ├ なければ localStorage[SAVE_KEY_V1](v1) を読む
  │    ├ scenario   ← 'anti_dong_zhuo'（v1 は190年固定配置のため）
  │    ├ food       ← Σ(garrison) * ECON.foodPerSoldier * 6  （6ターン分の余裕を与える）
  │    ├ weather    ← 'clear' / season ← turn から導出
  │    ├ victory    ← {ratio:0.6}（v1 の一律60%を維持し、既存プレイヤーの目標を変えない）
  │    ├ 都市の追加フィールド ← 3.2 の既定式で補完
  │    ├ wild/found ← distributeWild() を 'anti_dong_zhuo' シードで再生成し、
  │    │              既に配置済みの武将を除外して割り当てる
  │    ├ gen        ← 各都市の generals から service/at を復元、loyalty は一律 70
  │    ├ v2 として保存し、SAVE_KEY_V1 を削除
  │    └ ログに「セーブデータを更新しました / Save data migrated.」を出す
  └ どちらもなければ false（＝タイトルの「続きから」を非表示）
```

**破壊的変更の扱い**: v1 セーブに `scenario` の概念がないため 190年固定とみなす。
これは v1 が実際に190年配置しか生成しなかったこと（`startScenario()` が盤面を書き換えていなかった＝既知の欠陥）から、
情報損失なしに一意に決まる。

### 5.3 起動時バリデーション

外部データの破損・記述漏れでゲームが起動不能になるのを防ぐため、`validateSetup()` を起動時に実行する。

| 検査 | 失敗時の挙動 |
|---|---|
| `SANGUO_SCENARIOS` が配列で長さ8 | 内蔵ミニマル setup へフォールバック |
| 各 setup の `cities` が全20都市を含む | 欠けた都市を190年既定値で補い、`console.warn` |
| `owner` が FACTIONS に存在する id | `han` へフォールバックし `console.warn` |
| `playable` の全 id が `cities` の owner 集合に含まれる | 該当勢力を playable から除外 |
| `generals` の全 id が `GENERAL_IDS` に存在する | 該当武将を無視し `console.warn` |

---

## 6. 外部依存・アセット

| 種別 | 内容 | 新規制作 |
|---|---|---|
| 画像（シナリオ） | `assets/sanguo/gpt/scenarios/*.png` 8枚 | **不要**（既存） |
| 画像（合戦背景） | `assets/sanguo/gpt/battles/*.png` 12枚 | **不要**（既存） |
| 画像（武将肖像） | `sanguo-generals-atlas-0*.png` | **不要**（既存） |
| 天候・火計の視覚表現 | Canvas でプロシージャル描画（雨=斜線、霧=半透明レイヤ、風=旗の傾き、火=`--red` の半透明多角形＋煙パーティクル） | **不要**（コードで生成） |
| 名乗り演出の背景 | Canvas 帯＋既存 `--gold` の罫線。既存背景画像を暗転して流用 | **不要** |
| 音 | `sfx()` に `duel` / `fire` / `rout` / `famine` を追加。Web Audio プロシージャル | **不要**（コードで生成） |
| ライブラリ | **追加なし** | — |

**Graphic-Designer / Music-Generator への発注は不要**。本件は Code-Generator 単独で完結する。

---

## 7. 承認

- [ ] 深澤（PM）承認
- 次工程: [[sanguo_詳細設計]]
