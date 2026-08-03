---
type: 基本設計書
project: sanguo
status: レビュー待ち
agent: planner
target_file: sanguo.html
created: 2026-08-03
updated: 2026-08-03
tags: [claudechord, 基本設計, sanguo, ブラッシュアップ]
---

# 基本設計書 — 三国志・天下三分 ブラッシュアップ（第2次拡張）

> プロジェクトハブ: [[sanguo]] ／ 上流: [[sanguo_ブラッシュアップ_要件定義]] ／ 下流: [[sanguo_ブラッシュアップ_詳細設計]]

## 1. 設計方針

### 1.1 守るべき既存構造

`sanguo.html` は 2,693行の単一 IIFE（`(() => { 'use strict'; ... })()`）で、
定数群 → `state` → 描画 → 経済 → AI → 人事 → 合戦 → 計略 → 外交 → セーブ → 画面遷移 の順に並ぶ。
第1次拡張（P0〜P7）が確立した以下の規約を、本次でも例外なく守る。

| 規約 | 内容 | 根拠 |
|---|---|---|
| E-05 | 実行不可のボタンは `disabled` にし、理由を日英併記で `title` に入れる | 第1次拡張で確立 |
| E-15 | セーブの未知フィールドは無視し、欠落フィールドは既定値で補う | 同上 |
| 単一HTML | 新規の外部ファイルを増やさない（データのみ classic script で外部化済み） | `dynamic-test` が `file://` で開くため |
| クロージャ | 既存 IIFE の内側に追記する。グローバルを増やさない | 同上 |

### 1.2 本次の3つの決定

#### 決定1: 政務ポイントは「単一ゲート関数」に集約する

コマンドの実行可否は現在、`policyBtnHtml()` / `genRowHtml()` / `cityPanel()` / `openPlotOverlay()` /
`buildDiplo()` の5箇所にバラバラの `why` 生成として散在している。ここに AP 判定を追記すると
**5箇所の二重管理**になり、片方だけ直して「押せるのに何も起きない」不整合を生む。

→ **`apGate(kind)` を新設し、`{ok, why, cost}` を返す単一の窓口とする。**
既存の `why` 生成は「資源が足りるか」だけを見て、AP は `apGate` が見る。
両者の合成は `gateWhy(kind, resourceWhy)` 1本に集約する。

#### 決定2: 増援は「兵のみ・即時到着」とする

プレイヤーの兵糧 `state.food` は**国庫一括**（`foodIncome()` / `attack()` はすべて `state.food` を読む）。
都市別の `c.food` は `tickEconomyAI` / `aiPolicyChoice` / `aiMarch` のみが使う**AI専用フィールド**である。
したがってプレイヤー視点で「兵糧を都市へ運ぶ」ことに意味はない。

→ **輸送するのは兵のみ。名称は「増援 / REINFORCE」とする。**
また、輸送中の部隊をマップに描く方式（要件 C-01）は描画・セーブ・AI の三方に影響が及ぶため、
本次は**即時到着**とし、コストと1巡1回の制限で強さを抑える。

#### 決定3: AIの churn は「原因の是正」で直し、難易度つまみでは誤魔化さない

実測した往復の主因は3つあり、いずれも `DIFFICULTY` のつまみでは解消しない。

1. `aiMarch()` が `to.generals=from.generals.slice(); from.generals=[];` として
   **出撃元の武将を全員連れ去る** → `cityPower()` は武将の統率・武力を加算するため、
   出撃元の戦力評価が急落し、次の巡に取り返される
2. 占領直後の守備が `to.garrison=Math.max(10,r.atkSurv)` と薄いまま放置される（増援手段がない）
3. 進軍先を毎巡 `cityPower` 差の最大値で選び直すため、**目標が毎巡ぶれる**

→ ①随行は半数まで ②AI版の増援 `aiReinforce()` ③目標の持続 `state.aiGoal` の3点で是正する。
`DIFFICULTY` の値は**是正後に受入基準14〜16を計測してから**最終調整する。

## 2. データ設計

### 2.1 `state` への追加フィールド

```
state = {
  ...既存,
  // ===== P11 政務ポイント =====
  ap: 5,                    // 今巡の残ポイント
  apMax: 5,                 // 今巡の上限（endTurn で再計算し ap を満たす）
  // ===== P10 AI 目標の持続 =====
  aiGoal: {},               // { [fid]: {city:cityId, until:turn} }
}
```

### 2.2 都市（`CITIES` 要素）への追加フィールド

`initCityFields()` に追加する（既に値があるものは上書きしない、の既存規約に従う）。

| フィールド | 型 | 既定 | 用途 |
|---|---|---|---|
| `reinforceTurn` | number | 0 | この都市が最後に増援を**送った**巡。1巡1回の判定に使う |

武将の `movedTurn`（`state.gen[id].movedTurn`）と同じ設計を、都市側に持たせる形。

### 2.3 新規定数

既存の `ECON` / `PERSONNEL` の直後に置く。

```
const REINFORCE = {
  gold: 40,                 // 1回あたりの固定費（金）
  foodPerSoldier: 0.6,      // 兵1あたりの兵糧（自領内なので遠征 1.2 の半額）
  minKeep: 15,              // 出発都市に必ず残す兵
  cap: 150,                 // 到着都市の兵の上限（ECON.actions.levy.cap と一致させる）
  amounts: [20, 50, 100],   // 選択できる兵数
  loyaltyCost: 1            // 到着都市の民忠（駐屯負担・S-06）
};

const AP = {
  base: 2, perCities: 2, touDiv: 40, min: 3, max: 8,
  cost: {
    agri:1, trade:1, levy:1, wall:1, relief:1,   // 内政5種
    scout:1, recruit:1, transfer:1, reward:0,     // 人事（恩賞のみ0）
    reinforce:1, grain:1,                         // 増援・兵糧買付
    march:2,                                      // 出陣
    alienate:2, rumor:2, poison:2,                // 戦略計略
    alliance:1, truce:1, gift:1, joint:2          // 外交
  }
};

const GRAIN = {                // S-04 兵糧買付（金のシンク）
  gold: 100,
  yield: { growth: 60, harvest: 110 }   // 春夏は端境で高い＝少ししか買えない
};

const AI_REINFORCE = {
  minSurplus: 60,     // 送り元に必要な余剰兵
  send: 40,           // 1回に送る兵
  frontierGap: 25     // 「脆弱」と見なす隣接敵との兵力差
};
```

### 2.4 セーブ形式 v3

| 版 | 追加 | 移行 |
|---|---|---|
| v1 | — | `migrateSaveV1()` で v2 へ（既存） |
| v2 | 兵糧・シナリオ・武将ランタイム・難易度 | 既存 |
| **v3** | `ap` / `apMax` / `aiGoal` / 都市の `reinforceTurn` | **v2 からは無変換で読める**。欠落は `applySaveData()` が既定値で補う |

v3 は v2 の上位互換であり、専用の移行関数は**作らない**（E-15 の「欠落は既定値」で足りる）。
`saveGame()` の `v:2` を `v:3` に変え、`applySaveData()` に3行の既定値補完を足すだけとする。

## 3. 画面設計

### 3.1 上部HUD（`.topbar` の `.topStats`）

```
年代 190年 ｜ 第 1 巡 ｜ 勢力 魏 ｜ 領 2/20 ｜ 政務 5/5 ｜ 金 450 ｜ 糧 900 ｜ 季 春夏
                                        ↑ 追加
```

- `<span id="apStat" title="政務 / ACTIONS">政務 <b id="apText">—</b></span>` を `cityText` の直後に挿入
- 残0のときは `apText` を `var(--red)` にする（`foodText` の既存の色替えと同じ手法）
- `title` に消費表の要約を入れる（例: `政務 / ACTIONS：内政1・出陣2・計略2・恩賞0`）

### 3.2 都市パネル（`cityPanel()`）— 自軍領のみ

セクションの並びを次のようにする。**「増援」は「出陣」の直前**に置く（軍事の文脈でまとめる）。

```
許昌
魏／曹操 ・ 自軍領
[兵力][民政][農業][商業][城壁][民忠][武将]
兵糧収支 …

内政 / DOMESTIC AFFAIRS
[農業 100金][商業 100金][徴兵 120金+糧60][城壁 150金][施し 80金+糧40]
[兵糧買付 100金 → 糧+110]                      ← 追加（S-04）

人事 / PERSONNEL
[在野探索 80金][在野 9]
 (肖像) 曹操  武72 知91 統96      忠 70   ← 肖像サムネを追加（S-01）
 [恩賞額▼][恩賞][転属先▼][転換]

増援 / REINFORCE（40金・兵糧 兵数×0.6）        ← 追加セクション
 [送り先▼ 合肥][兵数▼ 20/50/100][送る]
 現在の兵 55 ／ 最低 15 は残す

出陣 / CAMPAIGN（50金・兵糧54）
[洛陽 董卓軍・80兵][宛 …]

軍議記録 / WAR COUNCIL
```

- 隣接自軍領がない場合はセクションごと「隣接する自軍領がありません / No adjacent friendly city.」に置換する
- 兵数の `<option>` は `garrison - amount < REINFORCE.minKeep` のとき `disabled`
- 「送る」ボタンの `title` に不能理由を日英併記（E-05）

### 3.3 一騎打ちの名乗り（`bDuelDraw()`）— M-16

現在の `drawNameCard(who, y, alpha)` は縦積みのテキスト3行（`○○の△△` / `― 二つ名 ―` / `武 nn MIGHT`）。
ここに**肖像を左に置き、テキストを右へ寄せる**構成へ変更する。

```
┌────────────────────────────────┐
│  ╔══════╗                                      │
│  ║      ║   涼州の呂布                          │
│  ║ 肖像 ║   ― 人中の呂布 ―                      │
│  ║      ║   武 100  MIGHT                       │
│  ╚══════╝                                      │
└────────────────────────────────┘
```

- 肖像は円形にクリップし、勢力色（`D.aColor` / `D.dColor`）の輪でふちどる
- サイズは既存のスケール係数 `k` に連動（`96*k` 角）
- **肖像が未ロード／該当なしのときは、現行の中央寄せテキストのままにする**（レイアウトを分岐させる）
- `hail` / `name` / `answer` / `result` の各フェーズで同じ `drawNameCard` を使うため、変更は1関数に閉じる

### 3.4 その他の肖像（Should）

| 箇所 | 実装手段 | 備考 |
|---|---|---|
| 都市パネルの武将行・在野行（S-01） | CSS `background-image` + `background-position`（`buildRoster()` と同じ手法） | DOM なので Image のロード待ち不要 |
| 勢力選択カード・外交カード（S-02） | 同上。君主IDは既存の `leaderIdOf(fid)` で解決 | |
| 合戦の部隊チップ（S-03） | Canvas `drawImage` + 円形クリップ | 未ロード時は現行の色付き円＋兵種漢字にフォールバック |

## 4. 処理設計

### 4.1 政務ポイントのライフサイクル

```
勢力選択で開始 ──▶ recalcApMax() ──▶ state.ap = state.apMax
                                          │
   コマンド実行 ──▶ apGate(kind) ──┬─ ok:false ──▶ ボタンは disabled（実行されない）
                                    └─ ok:true  ──▶ 本処理 ──▶ spendAp(kind) ──▶ updateUI()
                                          │
   次のターン ──▶ endTurn() 冒頭 ──▶ recalcApMax() ──▶ state.ap = state.apMax（繰り越しなし）
```

`apMax` の算出式（受入基準8: 190年・魏＝2都市・曹操 統96 で **5**）:

```
apMax = clamp( AP.base + floor(領地数 / AP.perCities) + floor(君主の統率 / AP.touDiv),
               AP.min, AP.max )
      = clamp( 2 + floor(2/2) + floor(96/40), 3, 8 )
      = clamp( 2 + 1 + 2, 3, 8 ) = 5   ✔
```

領地が増えるほどポイントも増えるため、大国は多くの手を打てる。
一方 `AP.max = 8` で頭打ちにし、統一間際に作業化しないよう抑える。

### 4.2 増援の処理順序

```
doReinforce(fromId, toId, amount)
  1. 所有・隣接・自軍領の検証
  2. from.reinforceTurn === state.turn なら中断（1巡1回）
  3. apGate('reinforce') / 金 / 兵糧 の検証
  4. 実際に送れる兵 = min(amount, from.garrison - REINFORCE.minKeep, REINFORCE.cap - to.garrison)
  5. 送れる兵が0以下なら理由をログに出して中断
  6. 資源を引く（金・兵糧・AP）
  7. from.garrison -= n ; to.garrison += n ; to.loyalty -= REINFORCE.loyaltyCost
  8. from.reinforceTurn = state.turn
  9. ログ・SFX・updateUI() / draw()
```

**要件 M-04 の「超過分は送られず、その旨をログに出す」は手順4と5で担保する。**
兵数の `<option>` 側でも `disabled` にするが、上限は到着都市に依存するため
（`levy` の自然増で盤面が動く）、**実処理側でも必ずクランプする**。

### 4.3 AI収束性の3点是正

#### (a) 随行武将を半数に留める（M-13）

```
現行: to.generals = from.generals.slice();  from.generals = [];
是正: 統率の高い順に並べ、上位 ceil(n/2) を随行させ、残りは本拠に残す
      （ただし from.generals が1名のときは随行させ、本拠は空になる ─ 従来どおり）
```

`syncGenHomes()` は既に呼ばれているため、`state.gen[id].at / service` は自動的に追従する。

#### (b) AI版の増援（M-14 / `aiReinforce(fid)`）

```
毎巡 aiMarch より前に1回だけ実行する。
  1. 自領を「国境都市（隣接に他勢力がある）」と「後方都市」に分ける
  2. 国境都市のうち、隣接敵との兵力差が AI_REINFORCE.frontierGap 以上 劣る都市を選ぶ
  3. その都市に隣接する後方自領で、兵が AI_REINFORCE.minSurplus を超えるものを選ぶ
  4. AI_REINFORCE.send 兵を移す（AI は金・兵糧を消費しない ─ 既存の AI 経済モデルに合わせる）
  5. ログに出す（「袁紹軍が平原へ増援を送った。」）
```

**プレイヤーには金・兵糧・APのコストを課すが、AIには課さない。**
これは既存の AI 経済（`state.aiGold` は計略にしか使わず、内政は `aiGrowth()` で抽象化されている）
と一貫させるための意図的な非対称であり、難易度は `DIFFICULTY` のつまみで調整する。

#### (c) 攻撃目標の持続（M-15 / `state.aiGoal`）

```
aiMarch(fid) の目標選択:
  既存の goal が有効（until > state.turn かつ 目標が今も敵領 かつ 今も隣接）なら、その都市を最優先
  そうでなければ現行どおり cityPower 差で選び直し、state.aiGoal[fid] = {city, until: state.turn + 4}
```

これにより「洛陽を狙うと決めたら4巡は洛陽を狙う」挙動になり、攻めが分散しなくなる。

#### (d) 進軍回数（S-05）

```
現行: 1巡1回（Math.random() >= 0.32 + aggression*0.68 でスキップ）
是正: aggression >= 0.8 の勢力は最大2回まで試行する
```

董卓（0.94）・呂布（1.00）・黄巾（0.90）・魏（0.86）が対象。史実の気風とも整合する。

## 5. 影響範囲

| 対象 | 変更 | フェーズ |
|---|---|---|
| `initCityFields()` | `reinforceTurn` の初期化を追加 | P8 |
| `cityPanel()` | 「増援」セクションの追加 | P8 |
| `updateUI()` | 増援UIのイベント結線を追加 | P8 |
| `bindPersonnel()` | 変更なし（増援は別バインダ `bindReinforce()` を新設） | P8 |
| `bDuelDraw()` の `drawNameCard` | 肖像の描画を追加（分岐でフォールバック） | P9 |
| `buildRoster()` | スロット解決を `portraitSlotOf()` へ抽出（挙動は不変） | P9 |
| `genRowHtml()` / `wildRowHtml()` | 肖像サムネを追加 | P9 |
| `openFactionPick()` / `buildDiplo()` | 君主肖像を追加 | P9 |
| `bDrawStack()` | 肖像の円形クリップ描画を追加（フォールバックあり） | P9 |
| `aiMarch()` | 随行半数・目標の持続・最大2回 | P10 |
| `runAI()` | `aiReinforce()` の呼び出しを追加 | P10 |
| `.topbar` の `.topStats` | `apStat` / `apText` を追加 | P11 |
| `policyBtnHtml()` | `apGate` を経由した `why` へ | P11 |
| `doPolicy()` / `doRecruit()` / `scoutCity()` / `transferGeneral()` / `attack()` / `doReinforce()` | 冒頭に `apGate` 検証、末尾に `spendAp` | P11 |
| `openPlotOverlay()` / `plotAlienate()` / `plotRumor()` / `plotPoison()` | 同上 | P11 |
| `buildDiplo()` / `proposeAlliance()` / `proposeTruce()` / `giveGift()` / `jointAttack()` | 同上 | P11 |
| `endTurn()` | 手順1の直後に `recalcApMax()` と AP 回復を挿入 | P11 |
| `startScenario()` | 開始時の AP 初期化 | P11 |
| `saveGame()` / `applySaveData()` | v3・既定値補完 | P8/P10/P11 |
| `scripts/verify-sanguo-boot.mjs` | 新設 | S-07 |

**`bApplyResult()` は変更しない。** 占領後の守備兵が薄い問題は、
プレイヤー側は「増援」（P8）、AI側は `aiReinforce()`（P10）という**能動的な手段**で解く。
戦闘結果の式そのものを触ると、士気・一騎打ち・計略の既存バランスに波及するため。

## 6. 検証設計

### 6.1 `scripts/verify-sanguo-boot.mjs`（S-07・新設）

`scripts/verify-sengoku-boot.mjs` と同じ骨格で作る。**GameKit を使っていないため
`engine.errors` の合算は不要**だが、`pageerror` と `console.error` と `requestfailed` は必ず全て集める。

| 検査 | 内容 | 対応する受入基準 |
|---|---|---|
| #1 起動 | タイトル → シナリオ選択 → ストーリー → 勢力選択 → マップ到達 | 22 |
| #2 例外 | 上記＋60ターン自動進行で `pageerror` / `console.error` / 404 が0件 | 22 |
| #3 増援 | 自軍領を選び増援を実行、送り元−n・送り先+n を検証 | 3 |
| #4 政務 | 開始時 `apMax===5`、コマンドで減る、ターン終了で戻る | 7・8・11 |
| #5 AI収束 | 50ターン放置し、最大勢力の都市数 ≧ 8 | 14 |
| #6 churn | 同上、同一都市の所有者交代が20ターンあたり ≦ 3 回 | 15 |
| #7 圧力 | 同上、25ターン以内にプレイヤーが滅亡 | 16 |
| #8 武将空白 | AIの占領ログが出た巡に、出撃元の武将が0名になっていない | 13 |

> **「タイトル画面が出た＝起動成功ではない」**（CLAUDE.md の戦国風雲記の教訓）。
> 本検査も必ずマップ画面へ入り、ターンを回してから判定する。

### 6.2 手動確認（Playwright では見きれないもの）

- 一騎打ちの名乗りで肖像が出ること・演出のタイミングが崩れていないこと（スクリーンショット目視）
- 合戦の部隊チップが霧・伏兵・混乱の各状態で破綻しないこと
- v2 セーブからの「続きから」で政務ポイントが 5/5 で復帰すること
