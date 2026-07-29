---
type: 詳細設計書
project: sanguo
status: 承認済み
agent: planner
target_file: sanguo.html
created: 2026-07-28
updated: 2026-07-29
tags: [claudechord, 詳細設計, sanguo]
---

# 詳細設計書 — 三国志・天下三分 機能拡張

> プロジェクトハブ: [[sanguo]] ／ 上流: [[sanguo_基本設計]] ／ 要件: [[sanguo_要件定義]]

本書は Code-Generator が迷わず実装できる粒度を目標とする。
**行番号は 2026-07-28 時点の `sanguo.html`（326行）のもの。実装時は関数名で grep して特定すること。**

---

## 0. 実装前の必読事項（既存コードの罠）

| # | 罠 | 対処 |
|---|---|---|
| T-01 | **`GENERAL_IDS` には重複IDがある**（`liu_bei` / `guan_yu` / `cao_cao` / `zhang_liao` 等が2〜3回出現）。`GENERAL_JP` と並行配列でインデックス対応するため配列自体は縮められない | 在野プール生成時は `new Set(GENERAL_IDS)` で一意化する。表示名は常に `nameForGeneral(GENERAL_IDS.indexOf(id))` で先頭一致を使う |
| T-02 | **`endTurn` が L313 で再代入されている**（`const priorEndTurn=endTurn; endTurn=()=>{...}` の歴史イベント用モンキーパッチ） | P2 で `endTurn()` を改修する際、このラッパを本体へ統合し L313 のパッチを削除する。二重ラップは事故のもと |
| T-03 | **`buildRoster()` が L183 と L316 で二重定義されている**（後者が勝つ） | P3 で名鑑に忠誠列を足すときは **L316 側を編集**する。L183 側は削除してよい |
| T-04 | `statFor()` は未定義武将のステータスを ID 文字列ハッシュから決定論生成する | この決定論性が在野プールの再現性の前提。**アルゴリズムを変更しない** |
| T-05 | `CITIES` の `x/y` は地図画像に対する 0-1 相対座標、`neighbors` は隣接グラフ | シナリオでこれらを上書きしない |
| T-06 | `sanguo.html` は全JSが末尾の単一IIFE内にあり、行が極端に長い | **ファイル全体を読まない**。grep で関数名を特定し offset/limit 付き Read で前後50行に絞る |
| T-07 | `dynamic-test` は `file://` でページを開く | **ES Modules と `fetch()` を使わない**。外部JSは classic `<script src>` のみ |
| T-08 | `bCleanup()` の「初期兵力の12%未満で一律壊走」が唯一の敗走判定 | P4 で士気ベースに置換するが、**全滅寸前のセーフティ（5%未満）は残す**。無限ループ防止 |

---

## 1. 新規ファイル仕様

### 1.1 `assets/js/sanguo-scenarios.js`（新規・classic script）

```js
/* 三国志・天下三分 シナリオ定義 / Scenario setups.
   sanguo.html より前に classic script として読み込む（ES Modules 不可: file:// 対応のため）。*/
window.SANGUO_SCENARIOS = [ /* 8件 */ ];
```

1件あたりの構造（全20都市をフル記述。差分方式は不採用 — 理由は [[sanguo_基本設計]] 3.3）:

| キー | 型 | 説明 |
|---|---|---|
| `id` | string | `SCENARIO_STORIES[].id` と1:1対応（`yellow_turban` / `anti_dong_zhuo` / `lu_bu_campaign` / `guandu` / `three_visits` / `red_cliffs` / `yi_province` / `five_routes`） |
| `year` | number | 開始年 |
| `playable` | string[] | プレイヤーが選べる勢力 id |
| `victory` | `{ratio:number, hint:string}` | 勝利に必要な都市占有率とヒント文 |
| `gold` | `{def:number, by:{[fid]:number}}` | 初期金。`by` に無ければ `def` |
| `food` | `{def:number, by:{[fid]:number}}` | 初期兵糧 |
| `relations` | `[[fidA, fidB, 'alliance'\|'truce', untilTurn?]]` | 開始時の外交関係 |
| `wildSeed` | string | 在野配分のPRNGシード（通常 `id` と同じ） |
| `notes` | string | 史実からの逸脱の記録（コード動作には影響しない） |
| `cities` | `{[cityId]: [owner, garrison, prosperity, generals[]]}` | **全20都市必須**。タプル短縮記法 |

配置の正は [[sanguo_基本設計]] 3.4 の表。実装時はその表を機械的にタプルへ落とすこと。

各シナリオの固定配置武将（`cities[].generals`）は**史実上その都市にいなければ嘘になる者のみ**を書く。
残り全員は在野プールへ回し `distributeWild()` が決定論的に配る（データ量とバランス調整コストを抑えるため）。

固定配置の推奨（最低限これだけは書く）:

| シナリオ | 固定配置すべき武将（都市: 武将） |
|---|---|
| 184 黄巾 | 鄴: `zhang_jiao`※ / 洛陽: `wang_yun` / 長安: `dong_zhuo`,`li_ru` / 許昌: `cao_cao` / 平原: `liu_bei`,`guan_yu`,`zhang_fei` / 会稽: `sun_jian` / 遼東: `gongsun_zan` |
| 190 反董卓 | 長安: `dong_zhuo`,`li_ru` / 洛陽: `lu_bu` / 鄴: `yuan_shao` / 許昌: `cao_cao`,`xun_yu` / 平原: `liu_bei`,`guan_yu`,`zhang_fei` / 襄陽: `liu_biao` / 建業: `sun_jian` |
| 198 呂布 | 合肥: `lu_bu`,`chen_gong` / 許昌: `cao_cao`,`guo_jia`,`xun_yu` / 洛陽: `xiahou_dun` / 鄴: `yuan_shao`,`tian_feng` / 襄陽: `liu_biao`,`huang_zhong` / 建業: `sun_ce`,`zhou_yu` |
| 200 官渡 | 許昌: `cao_cao`,`guo_jia`,`xun_yu`,`xu_chu` / 鄴: `yuan_shao`,`tian_feng`,`ju_shou` / 平原: `yan_liang`,`wen_chou` / 長沙: `liu_bei`,`guan_yu`,`zhang_fei` / 建業: `sun_quan`,`zhou_yu` |
| 207 三顧 | 許昌: `cao_cao`,`sima_yi` / 長沙: `liu_bei`,`guan_yu`,`zhang_fei`,`zhao_yun`,`xu_shu` / 襄陽: `liu_biao`,`huang_zhong` / 建業: `sun_quan`,`zhou_yu`,`lu_su` |
| 208 赤壁 | 襄陽: `cao_cao`,`xiahou_dun`,`zhang_liao` / 江陵: `cao_ren` / 江夏: `liu_bei`,`guan_yu`,`zhang_fei`,`zhuge_liang`,`zhao_yun` / 武昌: `zhou_yu`,`huang_gai`,`gan_ning` / 建業: `sun_quan`,`lu_su` |
| 214 益州 | 成都: `liu_bei`,`zhuge_liang`,`fa_zheng` / 梓潼: `zhang_fei`,`ma_chao` / 江陵: `guan_yu` / 長安: `cao_cao`,`sima_yi` / 建業: `sun_quan`,`lu_meng` |
| 223 五路 | 成都: `zhuge_liang`,`zhao_yun` / 漢中: `wei_yan`,`ma_dai` / 江州: `meng_huo`,`lady_zhurong` / 長安: `sima_yi`,`cao_zhen`※ / 建業: `sun_quan`,`lu_xun` |

※ `zhang_jiao` / `cao_zhen` は `GENERAL_IDS` に未収録。**`GENERAL_IDS` / `GENERAL_JP` へ追記するのではなく**（並行配列とアトラス肖像のインデックス対応が崩れるため）、
`statFor()` の決定論フォールバックに任せる。名鑑には出ないが盤上には出る。
名鑑にも出したい場合は `SANGUO_LORE.extraNames = {zhang_jiao:'張角', cao_zhen:'曹真'}` を用意し、
`nameForGeneral()` を「`GENERAL_JP` に無ければ `extraNames` を引く」よう拡張する（**推奨**）。

### 1.2 `assets/js/sanguo-lore.js`（新規・classic script）

```js
window.SANGUO_LORE = {
  // 名乗り用: 二つ名と出身地。未定義武将は決定論生成にフォールバック
  epithet: {
    lu_bu:      {sobriquet:'人中の呂布', origin:'并州五原'},
    guan_yu:    {sobriquet:'美髯公',     origin:'河東解県'},
    zhang_fei:  {sobriquet:'燕人',       origin:'幽州涿郡'},
    zhao_yun:   {sobriquet:'常山の趙子龍', origin:'常山真定'},
    ma_chao:    {sobriquet:'錦馬超',     origin:'扶風茂陵'},
    zhuge_liang:{sobriquet:'臥龍',       origin:'琅邪陽都'},
    /* … 30〜40名程度。無名武将は fallback で十分 … */
  },
  // 在野配分の史実ゆかり: この都市に配られやすくなる（重み ×6）
  affinity: {
    zhuge_liang:['xiang_yang'], pang_tong:['xiang_yang'],
    ma_chao:['chang_an'], ma_dai:['chang_an'],
    meng_huo:['jiang_zhou'], lady_zhurong:['jiang_zhou'],
    taishi_ci:['kuai_ji'], gan_ning:['jiang_xia'],
    /* … 20〜30名 … */
  },
  extraNames: { zhang_jiao:'張角', cao_zhen:'曹真' }
};
```

**両ファイルとも「無くてもゲームが起動する」こと**。`window.SANGUO_LORE` が undefined なら
`epithet`/`affinity`/`extraNames` を空オブジェクトとして扱う。

---

## 2. 状態・データ構造の最終形

### 2.1 `state` への追加（L141 の `const state={...}` を拡張）

```js
scenario:'anti_dong_zhuo', food:1200, weather:'clear', season:'growth',
gen:{}, victory:{ratio:0.6,hint:''}, plotCooldown:{}, rngSeed:0
```

### 2.2 `CITIES[]` への追加フィールド

`agriculture / commerce / wall / loyalty / food / wild[] / found[] / plotFlags`
（既定値の算出式は [[sanguo_基本設計]] 3.2）。

**注意**: `CITIES` はリテラルで宣言されている（L89）。追加フィールドを全20都市のリテラルへ書き足すのではなく、
`applyScenario()` / `initCityFields()` が**実行時に注入**する。リテラルは地理情報のみに保つこと（差分レビューが小さくなる）。

### 2.3 `state.gen[generalId]`

```js
{loyalty:70, service:'wei', at:'xu_chang', exp:0, duelWin:0, duelLose:0, injuredUntil:0, movedTurn:0}
```

### 2.4 定数テーブル（新規・`===== 定数・データ =====` 区画の末尾に置く）

```js
const ECON = {
  baseIncome:40,                 // 勢力あたり固定収入（金）
  goldPerCommerce:0.55,          // 金収入 = Σ commerce * この係数
  foodPerAgri:0.9,               // 兵糧収穫 = Σ agriculture * この係数 * 季節倍率
  seasonMul:{growth:0.7, harvest:1.5},
  foodPerSoldier:0.5,            // 毎ターン兵1あたりの消費
  autoGarrison:1,                // 兵糧黒字かつ民忠50以上のとき garrison が自然増する量
  marchFoodPerSoldier:1.2,       // 遠征1兵あたりの持ち出し兵糧
  actions:{
    agri:  {cost:100, food:0,  stat:'chi', base:6, div:28, field:'agriculture', cap:100},
    trade: {cost:100, food:0,  stat:'chi', base:6, div:28, field:'commerce',    cap:100},
    levy:  {cost:120, food:60, stat:'tou', base:8, div:22, field:'garrison',    cap:150},
    wall:  {cost:150, food:0,  stat:'tou', base:5, div:30, field:'wall',        cap:100},
    relief:{cost:80,  food:40, stat:'mix', base:7, div:26, field:'loyalty',     cap:100}
  },
  famine:{desertRate:0.08, loyaltyDrop:4, moraleDrop:12},  // 兵糧枯渇時
  rebel:{threshold:25, garrisonLoss:0.15, defectChance:0.12}
};

const WEATHER = {
  clear:{jp:'晴', en:'CLEAR', bowRange:0,  fireMul:1.0, vision:99, moveMul:1.0},
  rain: {jp:'雨', en:'RAIN',  bowRange:-1, fireMul:0.0, vision:99, moveMul:0.85},
  fog:  {jp:'霧', en:'FOG',   bowRange:-1, fireMul:0.6, vision:3,  moveMul:1.0},
  wind: {jp:'風', en:'GALE',  bowRange:0,  fireMul:2.0, vision:99, moveMul:1.0},
  weights:{growth:{clear:50,rain:30,fog:12,wind:8}, harvest:{clear:45,rain:12,fog:23,wind:20}}
};

const PLOT = {
  // 戦略計略（マップ画面）
  alienate:{jp:'離間', en:'ALIENATE', gold:200, food:0,  base:0.30, floor:0.05, ceil:0.85, cd:4},
  rumor:   {jp:'流言', en:'RUMOR',    gold:120, food:0,  base:0.45, floor:0.10, ceil:0.90, cd:2},
  poison:  {jp:'埋伏の毒', en:'SLEEPER', gold:300, food:0, base:0.20, floor:0.05, ceil:0.70, cd:6},
  // 合戦計略（ヘックス戦）: 金は消費しない。1戦闘・1部隊あたり各1回
  fire:    {jp:'火計', en:'FIRE',    base:0.42, floor:0.05, ceil:0.90, dmg:0.18, burnTurns:3},
  ambush:  {jp:'伏兵', en:'AMBUSH',  base:0.55, floor:0.10, ceil:0.92, atkBonus:1.5},
  confuse: {jp:'混乱', en:'CONFUSE', base:0.38, floor:0.05, ceil:0.85},
  rally:   {jp:'鼓舞', en:'RALLY',   base:1.00, floor:1.00, ceil:1.00, morale:18}
};

const DUEL = {
  refuseCautionMin:0.35, refuseCautionMax:1.0, gapDiv:70,
  hp:100, roundsMin:3, roundsMax:5,
  dmgMin:4, dmgMax:30,
  deathBase:0.28,
  moraleWin:18, moraleLose:22, moraleDeath:30, moraleDraw:4, moraleAllyWin:6,
  injureTurns:2, injurePenalty:0.8,     // 負傷中 bu/tou に ×0.8
  killCountLoss:0.25,                    // 討死した武将の部隊は兵の25%を失う
  phaseMs:{hail:1600, name:1800, answer:1600, clash:3000, result:2000}
};

const MORALE = {
  init:55, initTouDiv:5, commanderBonus:10, min:30, max:95,
  onDealBig:+6, onTakeBig:-8, commanderAdj:+3, commanderRout:-25,
  surrounded:-6, lowStrength:-4, fireHit:-12, supplyOut:-7
};
```

---

## 3. 関数仕様表

### 3.1 P0 基盤（新規）

| 名称 | 種別 | 入出力 | 説明 |
|---|---|---|---|
| `hashStr(s)` | 純粋関数 | `string → uint32` | 文字列 → 32bit ハッシュ。`statFor()` と同じ FNV 風の乗算法を流用 |
| `srand(seed)` | ファクトリ | `number → ()=>number` | mulberry32 相当の決定論PRNG。`[0,1)` を返す関数を生成 |
| `rndPick(rng, list, weightFn)` | 純粋関数 | `(fn, T[], (T)=>number) → T` | 重み付き抽選 |
| `seasonOf(turn)` | 純粋関数 | `number → 'growth'\|'harvest'` | `turn % 2 === 1 ? 'growth' : 'harvest'`（1ターン＝半年） |
| `seasonLabel(s)` | 純粋関数 | `string → {jp,en}` | `growth → {jp:'春夏',en:'SPRING–SUMMER'}` / `harvest → {jp:'秋冬',en:'AUTUMN–WINTER'}` |
| `initCityFields()` | 副作用 | `() → void` | 全 `CITIES` に追加フィールドを既定値で注入（未定義のもののみ） |
| `genOf(id)` | 副作用あり取得 | `string → GenState` | `state.gen[id]` を遅延生成して返す |
| `effStat(id)` | 純粋関数 | `string → {bu,chi,tou}` | `statFor(id)` に負傷ペナルティ（`injuredUntil >= state.turn` なら bu/tou ×`DUEL.injurePenalty`）を適用した実効値。**以後の全判定はこちらを使う** |
| `migrateSaveV1(d)` | 純粋関数 | `v1obj → v2obj` | [[sanguo_基本設計]] 5.2 の変換 |

### 3.2 P1 シナリオ（新規／改修）

| 名称 | 種別 | 入出力 | 説明 |
|---|---|---|---|
| `scenarioSetups()` | 取得 | `() → Setup[]` | `window.SANGUO_SCENARIOS` を返す。undefined なら内蔵ミニマル1件 |
| `setupById(id)` | 純粋関数 | `string → Setup\|null` | |
| `validateSetup(su)` | 検証 | `Setup → {ok, warnings[]}` | 5.3 の検査。破損時も落とさず既定値で補う |
| `applyScenario(su)` | 副作用 | `Setup → void` | **本機能の中核**。`CITIES` の可変フィールドを上書き、`state.gen` を初期化、外交関係を張り、`state.food/gold/victory/scenario/year` を設定、`distributeWild()` を呼ぶ |
| `distributeWild(su)` | 副作用 | `Setup → void` | 未配置武将を各都市の `wild[]` へ決定論配分（4.1） |
| `openScenarioPicker()` | UI | 既存 L293 | 変更: 呼び出し元がタイトルボタンになる（勢力未選択でも開く） |
| `openStory(s)` | UI | 既存 L294 | 変更: `[この時代で開始]` → `[勢力を選ぶ / CHOOSE FACTION]` に変え `openFactionPick(s)` を呼ぶ |
| `openFactionPick(s)` | UI | **新規** | `su.playable` の勢力カードのみ表示。各カードに初期領数・初期金・初期兵糧・難易度★を併記 |
| `difficultyOf(su, fid)` | 純粋関数 | **新規** | 初期都市数と隣接敵数から★1〜3を返す。UI表示専用 |
| `startScenario(s, fid)` | 副作用 | 既存 L295 を全面改修 | `clearSave()` → `state.faction=fid` → `applyScenario(su)` → `rollWeather()` → `enterGame()` → `saveGame()` |
| `checkVictory()` | 既存 L176 改修 | | 固定 0.6 を `state.victory.ratio` に置換。`state.victory.hint` を勝利メッセージに使う |

### 3.3 P2 経済・内政（新規／改修）

| 名称 | 種別 | 入出力 | 説明 |
|---|---|---|---|
| `myCities()` | 純粋関数 | `() → City[]` | `CITIES.filter(c=>c.owner===state.faction)`（既存コードの重複を集約） |
| `foodIncome(fid)` | 純粋関数 | `string → number` | `Σ agriculture × ECON.foodPerAgri × seasonMul` |
| `foodUpkeep(fid)` | 純粋関数 | `string → number` | `Σ garrison × ECON.foodPerSoldier` |
| `goldIncome(fid)` | 純粋関数 | `string → number` | `ECON.baseIncome + Σ commerce × ECON.goldPerCommerce` |
| `tickEconomy(fid)` | 副作用 | `string → {gold,food,famine}` | 収支を適用し、赤字なら `applyFamine()` |
| `applyFamine(fid)` | 副作用 | `string → void` | 4.2 の枯渇処理 |
| `doPolicy(kind)` | 副作用 | `'agri'\|'trade'\|'levy'\|'wall'\|'relief' → void` | 内政5種の統一エントリ。`develop()`（L177）を置換 |
| `policyGain(kind, city)` | 純粋関数 | | 4.3 の効果量計算 |
| `tickLoyalty(fid)` | 副作用 | | 都市 `loyalty` の自然変動と反乱判定 |
| `endTurn()` | 既存 L172 全面改修 | | 順序は 4.4 のシーケンス。**L313 のモンキーパッチを本体へ統合し削除する** |
| `attack(targetId)` | 既存 L179 改修 | | 兵糧の持ち出しチェックを追加。不足なら出陣不可＋理由表示 |

### 3.4 P3 人事（新規）

| 名称 | 種別 | 入出力 | 説明 |
|---|---|---|---|
| `scoutCity(cityId)` | 副作用 | `string → void` | 在野探索。80金。知力判定で `wild[]` → `found[]` へ1名移す |
| `scoutChance(city)` | 純粋関数 | `City → number` | 4.5 の式 |
| `recruitCost(genId)` | 純粋関数 | `string → number` | `Math.round(60 + (bu+chi+tou) * 2.2)` |
| `recruitChance(city, genId, mult)` | 純粋関数 | | 4.6 の式 |
| `doRecruit(cityId, genId, mult)` | 副作用 | | 登用交渉。`mult ∈ {1.0,1.5,2.0}` |
| `transferGeneral(genId, toCityId)` | 副作用 | | 配置転換。隣接自領のみ、30金＋兵糧20、同一ターン1回 |
| `rewardGeneral(genId, amount)` | 副作用 | | 恩賞。`amount ∈ {100,300,600}` |
| `tickLoyaltyGenerals()` | 副作用 | | 全武将の忠誠自然変動 |
| `tickPoaching()` | 副作用 | | 敵勢力による引き抜き判定（4.7） |
| `recruit()` | 既存 L178 | **削除**し `scoutCity` + `doRecruit` に置換 | サイドパネルのボタンも差し替える |

### 3.5 P4 士気・天候（新規／改修）

| 名称 | 種別 | 入出力 | 説明 |
|---|---|---|---|
| `rollWeather()` | 副作用 | `() → void` | 季節別重みで `state.weather` を抽選（マップ用・毎ターン） |
| `weatherOf()` | 純粋関数 | `() → WeatherDef` | `WEATHER[state.weather]` |
| `bAddMorale(s, delta, reason)` | 副作用 | | 士気加減の唯一の入口。0以下で `bRout(s)` |
| `bRout(s)` | 副作用 | | 壊走処理。`count=0`、`bAddFx('壊走')`、`sfx('rout')`、総大将なら味方全体に `MORALE.commanderRout` |
| `bTickMorale()` | 副作用 | | ラウンド開始時の士気変動（総大将隣接・包囲・低兵力・兵糧切れ） |
| `bSurroundCount(s)` | 純粋関数 | | 隣接する敵スタック数 |
| `bBuildStacks()` | 既存 L217 改修 | | `morale/morale0/commander/hidden/confusedUntil/duelDone/supply` を追加 |
| `bResolveMelee()` | 既存 L246 改修 | | 士気補正・天候補正・城壁補正・伏兵ボーナス・混乱チェックを組み込む（4.8） |
| `bCleanup()` | 既存 L247 改修 | | 12%固定ルールを削除。5%未満の全滅セーフティのみ残す。壊走判定は `bAddMorale` 側へ |
| `bDrawStack()` | 既存 L234 改修 | | 士気バー・伏兵（半透明）・混乱（渦記号）・負傷（△）を追加描画 |
| `bComputeRange()` | 既存 L240 改修 | | 天候 `moveMul` を移動力に反映 |
| `bAttackTargets()` | 既存 L242 改修 | | 弓の射程に `WEATHER[].bowRange` を加算（最低1） |
| `bSyncHUD()` | 既存 L257 改修 | | 天候バッジ・攻撃側の残兵糧を表示 |
| `bAutoResolve()` | 既存 L253 改修 | | 士気を戦力係数に組み込む（`quality *= 0.6 + morale/125`） |

### 3.6 P5 一騎打ち（新規）

| 名称 | 種別 | 入出力 | 説明 |
|---|---|---|---|
| `duelCandidates(s)` | 純粋関数 | `Stack → Stack[]` | 隣接（`bDist<=1`）する敵スタックで、両者が `gen` を持ち `duelDone` でないもの |
| `duelRefuseChance(a, d)` | 純粋関数 | | 4.9 の受諾判定式 |
| `resolveDuel(a, d)` | 純粋関数 | `→ DuelResult` | **勝敗を先に全部計算する**。`{accepted, exchanges:[{aHp,dHp,dmg,who}], winner, loser, death, draw}` |
| `bDuelStart(a, d)` | 副作用 | | `resolveDuel()` の結果を `state.battle.duel` に格納し演出を開始 |
| `bDuelTick(dt)` | 副作用 | | フェーズ進行。`bTickStart()` のループから呼ぶ |
| `bDuelDraw()` | 描画 | | 名乗り帯・武将名・二つ名・HPバー・斬撃線を `bctx` に描画（4.10） |
| `bDuelSkip()` | 副作用 | | 演出を `result` フェーズへ即時ジャンプ。結果は変わらない |
| `bDuelApply()` | 副作用 | | 決着適用: 討死/負傷、`GEN` 更新、士気波及、`bCheckEnd()` |
| `epithetOf(genId)` | 純粋関数 | | `SANGUO_LORE.epithet[id]` ／ 無ければ ID ハッシュから決定論生成（`['驍将','猛士','壮士','義士','豪傑']` × `['幽州','并州','荊州',…]`） |

### 3.7 P6 合戦計略（新規）

| 名称 | 種別 | 説明 |
|---|---|---|
| `plotChance(atkChi, defChi, def)` | 純粋関数 | 共通成功率式（4.11） |
| `bPlotFire(s, c, r)` | 副作用 | 火計。天候・地形チェック → 判定 → 損害 → `fires` 登録 |
| `bPlotAmbush(s)` | 副作用 | 伏兵。`s.hidden=true` |
| `bPlotConfuse(s, target)` | 副作用 | 混乱。`target.confusedUntil = B.round + 1` |
| `bPlotRally(s)` | 副作用 | 鼓舞。自軍隣接スタックの士気回復 |
| `bTickFires()` | 副作用 | ラウンド開始時: 延焼・焼損・鎮火（4.12） |
| `bFlammable(c, r)` | 純粋関数 | 地形別可燃度: `plain 0.6 / forest 1.0 / mountain 0.4 / river 0 / water 0` |
| `bDrawFires()` | 描画 | 炎ヘックスの描画（`--red` の半透明多角形＋煙。**発光加算は使わない**） |
| `bDrawFog()` | 描画 | 霧の視界制限表現 |

### 3.8 P7 戦略計略・AI（新規／改修）

| 名称 | 種別 | 説明 |
|---|---|---|
| `openPlotOverlay()` | UI | 戦略計略オーバーレイ。実行元都市と対象を選ばせる |
| `plotAlienate(targetA, targetB)` | 副作用 | 離間。成功で同盟解消＋`friend -30` |
| `plotRumor(cityId)` | 副作用 | 流言。成功で `loyalty -= 18..28`、`plotFlags.rumorUntil = turn+3` |
| `plotPoison(cityId, genId)` | 副作用 | 埋伏の毒。武将を潜入させる（自陣から除去）。成功で `plotFlags.poisonBy` を設定 |
| `tickPoison()` | 副作用 | 毎ターン開城判定・露見判定（4.13） |
| `runAI()` | 既存 L174 改修 | 内政・徴兵・兵糧管理・計略・引き抜きの判断を追加（4.14） |
| `aiPolicyChoice(faction, city)` | 純粋関数 | AI の内政方針決定 |

---

## 4. アルゴリズム詳細

### 4.1 在野武将の配分 `distributeWild(su)`

```
placed  = new Set(Object.values(su.cities).flatMap(t => t[3]))
pool    = [...new Set(GENERAL_IDS)].filter(id => !placed.has(id))   // T-01: 重複除去必須
rng     = srand(hashStr(su.wildSeed || su.id))
CITIES.forEach(c => { c.wild = []; c.found = []; })

// 能力の高い順に配ると偏るため、pool を rng でシャッフルしてから配る
shuffle(pool, rng)
for (const id of pool):
    cand = CITIES.filter(c => c.wild.length < 8)          // 1都市あたり上限8名
    if (cand.length === 0) break                           // 20*8=160 > pool なので通常起きない
    w = c => (c.prosperity + 20)
            * ((LORE.affinity[id] || []).includes(c.id) ? 6 : 1)
    city = rndPick(rng, cand, w)
    city.wild.push(id)
```

**保証**: 同じ `wildSeed` なら毎回同じ配置。テストと攻略記事の再現性が確保される。

### 4.2 兵糧の収支と枯渇 `tickEconomy` / `applyFamine`

```
income  = foodIncome(fid)          // Σ agriculture * 0.9 * seasonMul(0.7 or 1.5)
upkeep  = foodUpkeep(fid)          // Σ garrison * 0.5
state.food += Math.round(income - upkeep)

if (state.food < 0):
    applyFamine(fid)
    state.food = 0
```

`applyFamine(fid)`:
```
shortfall = -netFood                                   // 不足分
for each city of fid (garrison 降順):
    desert = Math.ceil(city.garrison * ECON.famine.desertRate)   // 8% が逃散
    city.garrison = Math.max(5, city.garrison - desert)
    city.loyalty  = clamp(city.loyalty - ECON.famine.loyaltyDrop, 0, 100)
addLog('兵糧が尽き、諸城の兵が逃散した。 / Famine: troops desert.')
sfx('famine')
// 進行中の合戦があれば全スタックの士気 -12（ECON.famine.moraleDrop）
```

**バランス検証（設計時の試算）**: 標準都市（agriculture 55 / garrison 60）1つあたり
- 春夏: 収穫 `55*0.9*0.7 = 34.6` − 消費 `30` = **+4.6**
- 秋冬: 収穫 `55*0.9*1.5 = 74.3` − 消費 `30` = **+44.3**
garrison を上限近く（130）まで積むと消費 65 となり、**春夏は 34.6 − 65 = −30.4 の赤字**。
→ 「兵を貯めるだけ」は春夏に破綻する。農業（`agri`）への投資か兵の削減が必要になり、狙い通りのジレンマが成立する。

### 4.3 内政の効果量 `policyGain(kind, city)`

```
def   = ECON.actions[kind]
lead  = def.stat === 'mix'
          ? bestGeneral(city, effStat(...).bu >= effStat(...).chi ? 'bu' : 'chi')   // 施しは武力・知力の高い方
          : bestGeneral(city, def.stat)
bonus = lead ? Math.floor(effStat(lead.id)[def.stat === 'mix' ? 'chi' : def.stat] / def.div) : 0
gain  = def.base + bonus + (rng 0..2)
city[def.field] = Math.min(def.cap, city[def.field] + gain)
```

| 施策 | コスト | 兵糧 | 担当 | 対象フィールド | 標準gain（担当90） |
|---|---|---|---|---|---|
| 農業 AGRI | 100金 | — | 知力 | `agriculture` | 6 + 3 = 9〜11 |
| 商業 TRADE | 100金 | — | 知力 | `commerce` | 6 + 3 = 9〜11 |
| 徴兵 LEVY | 120金 | 60 | 統率 | `garrison` | 8 + 4 = 12〜14 |
| 城壁 WALL | 150金 | — | 統率 | `wall` | 5 + 3 = 8〜10 |
| 施し RELIEF | 80金 | 40 | 武力/知力の高い方 | `loyalty` | 7 + 3 = 10〜12 |

`prosperity` は廃止しない。**`prosperity = round((agriculture + commerce) / 2)` として毎ターン導出する**（既存の
`cityPower()` / `simResolve()` / `startBattle()` の `siege` 判定が `prosperity` に依存しているため、互換性を保つ）。

### 4.4 `endTurn()` の新シーケンス

```
0. state.over なら return
1. state.turn++ ; if (turn % 2 === 0) state.year++
2. state.season = seasonOf(state.turn)
3. rollWeather()
4. tickEconomy(state.faction)          // 金・兵糧の収支 → 赤字なら applyFamine
5. 全勢力ぶんの AI 経済処理 tickEconomyAI(f)  （簡略版: 都市単位で完結）
6. 自領の自然変動: prosperity = (agri+commerce)/2、兵糧黒字かつ loyalty>=50 なら garrison += ECON.autoGarrison
7. tickLoyalty(state.faction)          // 都市民忠の自然変動・反乱判定
8. tickLoyaltyGenerals()               // 武将忠誠の自然変動
9. tickPoaching()                      // 敵による引き抜き
10. tickPoison()                       // 埋伏の毒の開城/露見判定
11. runAI()                            // AI 勢力の内政・徴兵・計略・進軍
12. decayDiplomacy()
13. HISTORY_EVENTS チェック（★L313 のモンキーパッチをここへ統合し、L313 を削除）
14. updateUI(); draw(); sfx('click'); checkVictory(); saveGame();
```

### 4.5 在野探索 `scoutChance(city)`

```
scholar = bestGeneral(city, 'chi')                    // effStat ベース
p = clamp(0.25 + (scholar ? scholar.chi/220 : 0) + city.prosperity/400, 0.15, 0.85)
```
知力100の軍師がいる繁栄80の都市 → `0.25 + 0.45 + 0.20 = 0.90 → 0.85`（上限）。
武将不在の寒村（繁栄40） → `0.25 + 0 + 0.10 = 0.35`。

発見される武将の選定（発見の質にも知力を効かせる）:
```
rng = Math.random
候補 = city.wild
高知力ボーナス: p_elite = clamp(scholar.chi/300, 0, 0.33)
  rng() < p_elite なら「能力合計が最も高い者」を発見（賢者は逸材を見抜く）
  そうでなければ一様抽選
```

### 4.6 登用交渉 `recruitChance(city, genId, mult)`

```
st       = statFor(genId)                    // 在野武将は負傷しないので statFor で可
total    = st.bu + st.chi + st.tou
cost     = Math.round(60 + total * 2.2)      // 平均150 → 390金 ／ 呂布(195) → 489金
persuade = bestGeneral(city, 'chi')
prestige = (factionCounts()[state.faction] || 0) / CITIES.length * 0.35
p = clamp(0.30 + 0.44 * (mult - 1)            // 1.0→+0, 1.5→+0.22, 2.0→+0.44
          + (persuade ? persuade.chi/350 : 0)
          + prestige
          - total/700,
          0.10, 0.95)
```
成功: `city.generals.push(id)` / `genOf(id) = {loyalty: 50 + 24*(mult-1) + rnd*10, service, at}` / `found` から除去
失敗: 支払い金の 40% を失い、`found` に残る。同一武将は2ターンのクールダウン

**支払い**: `cost * mult` を先に検査し、成功時に全額、失敗時に 40% を消費する。

### 4.7 引き抜き `tickPoaching()`

```
for each 自軍武将 g (loyalty < 40):
    city   = 在城
    rivals = city.neighbors の都市 owner のうち自勢力でない勢力（同盟中は除く）
    if (!rivals.length) continue
    best   = rivals のうち最も都市数の多い勢力
    p      = clamp((40 - g.loyalty)/120 + (bestCityCount - myCityCount)/CITIES.length*0.15, 0, 0.35)
    if (Math.random() < p):
        移籍: city.generals から除去 → best 勢力の隣接都市へ追加、genOf.service/at 更新、loyalty = 60
        addLog(`⚠ ${名}が${敵勢力名}の誘いに応じ、${先}へ去った。 / defected.`)
// loyalty < 25 の武将は毎ターン警告ログを出す（対処の機会をプレイヤーに与える）
```

### 4.8 戦闘解決 `bResolveMelee()` の改修式

既存式（L246）に**乗算項を追加する形**で拡張する（既存のバランスを崩しにくい）。

```
// --- 既存 ---
baseAtk = atk.count * UNITS[atk.type].atk * (1 + atk.st.bu/200) * advantage(atk.type, def.type)
baseDef = def.count * UNITS[def.type].def * (1 + def.st.tou/200) * tDef * castle

// --- 追加する係数 ---
moraleAtk = 0.70 + atk.morale / 250          // 士気95 → 1.08 ／ 士気20 → 0.78
moraleDef = 0.70 + def.morale / 250
ambush    = atk.hidden ? PLOT.ambush.atkBonus : 1        // 伏兵からの初撃 ×1.5
injuryA   = 実効値は effStat() 側で吸収済み（st は生成時にコピーされるため再評価が必要 → 4.8.1）
castle    = (B.castle && B.siege && def.side==='def' && def.row<=1)
              ? 1 + (cityById[B.dCity].wall || 40) / 250     // wall 100 → 1.40（旧: 固定1.15）
              : 1

baseAtk *= moraleAtk * ambush
baseDef *= moraleDef

// 損害計算は既存のまま（ratio → defLoss / atkLoss）

// --- 事後処理（追加） ---
if (defLossRate > 0.20) bAddMorale(def, MORALE.onTakeBig, '大損害')
if (defLossRate > 0.20) bAddMorale(atk, MORALE.onDealBig, '戦果')
atk.hidden = false                                        // 伏兵は攻撃で解除
```

**4.8.1 負傷の反映**: `bBuildStacks()` はスタック生成時に `st` をコピーしている。
一騎打ちで負傷が発生するのは戦闘中なので、`s.st` を直接書き換える（`s.st.bu = Math.round(s.st.bu * DUEL.injurePenalty)` 等）。
マップ側の恒久的な負傷は `genOf(id).injuredUntil` に記録し、`effStat()` が吸収する。**二重適用に注意**。

### 4.9 一騎打ちの受諾判定 `duelRefuseChance(a, d)`

```
gap      = a.st.bu - d.st.bu                      // 挑戦側が強いほど断られる
caution  = DUEL.refuseCautionMin + (DUEL.refuseCautionMax - DUEL.refuseCautionMin) * (d.st.chi / 100)
p = clamp( (gap / DUEL.gapDiv) * caution
           + (d.morale < 40 ? 0.20 : 0)           // 士気が低いと逃げる
           - (d.st.bu >= 90 ? 0.15 : 0)           // 猛将は受けたがる
           - (d.commander ? 0.05 : 0)             // 総大将は名分上断りにくい
           , 0, 0.90)
```

検算:
| 挑戦側 | 受け手 | gap | caution | pRefuse |
|---|---|---|---|---|
| 呂布(武100) | 諸葛亮(武38/知100) | +62 | 1.00 | `0.886` → **ほぼ断る** |
| 呂布(武100) | 張飛(武98/知30) | +2 | 0.55 | `0.016 − 0.15 → 0` → **必ず受ける** |
| 諸葛亮(武38) | 呂布(武100/知35) | −62 | 0.58 | `−0.51 → 0` → **必ず受ける**（挑む方が愚か） |
| 関羽(武97) | 荀彧(武30/知95) | +67 | 0.97 | `0.90`（上限）→ **ほぼ断る** |

拒否時の演出も見せ場にする: 「〜は陣中より応えず、矢を放った」＋挑戦側の士気 +8（気勢を制した）／
受け手の士気 −6（臆したと見なされる）。**拒否がノーリスクにならないようにする**のが設計意図。

### 4.10 一騎打ちの決着 `resolveDuel(a, d)` と演出

**設計原則: 勝敗は演出開始前に全て確定させ、`bDuelDraw()` は再生専用にする。**
スキップしても結果が変わらず、演出中の状態遷移バグが構造的に発生しない。

```
accepted = Math.random() >= duelRefuseChance(a, d)
if (!accepted) return {accepted:false}

aHp = dHp = DUEL.hp
rounds = DUEL.roundsMin + Math.floor(Math.random() * (DUEL.roundsMax - DUEL.roundsMin + 1))
exchanges = []
weatherMod = (state.battle.weather === 'rain' || state.battle.weather === 'fog') ? 0.95 : 1.0
                                          // 足場が悪い・視界が悪いと武の差が出にくい

for (i = 0; i < rounds && aHp > 0 && dHp > 0; i++):
    aRoll = a.st.bu * (0.80 + Math.random()*0.40) * weatherMod + (a.morale - 50)/10
    dRoll = d.st.bu * (0.80 + Math.random()*0.40) * weatherMod + (d.morale - 50)/10
    dmg   = clamp(Math.abs(aRoll - dRoll) / 2, DUEL.dmgMin, DUEL.dmgMax)
    if (aRoll >= dRoll) { dHp -= dmg; exchanges.push({who:'a', dmg, aHp, dHp}) }
    else                { aHp -= dmg; exchanges.push({who:'d', dmg, aHp, dHp}) }

draw   = (aHp > 0 && dHp > 0)
winner = draw ? null : (aHp > 0 ? a : d)
loser  = draw ? null : (aHp > 0 ? d : a)
margin = draw ? 0 : Math.abs(aHp - dHp)
death  = !draw && Math.random() < (DUEL.deathBase + margin/200)     // 圧勝ほど討ち取りやすい
```

決着適用 `bDuelApply()`:

| 結果 | 効果 |
|---|---|
| 勝者 | `bAddMorale(winner, +18)` ／ 同陣営の全スタック `+6` ／ `genOf(winner.gen).duelWin++` |
| 敗者（負傷） | `bAddMorale(loser, −22)` ／ `loser.st.bu *= 0.8`、`loser.st.tou *= 0.8` ／ `genOf(loser.gen).injuredUntil = state.turn + 2` |
| 敗者（討死） | `bAddMorale(loser, −30)` ／ `loser.count -= 25%` ／ 武将を `genOf` から `dead:true` にし、決着後に都市の `generals` からも除去 ／ `loser.gen = null`（部隊は雑兵として残る） |
| 引き分け | 双方 `+4`（互いに認め合う） |
| 拒否 | 挑戦側 `+8` ／ 受け手 `−6` |

**討死武将の恒久除去**: `bApplyResult()`（L255）の後に `purgeDeadGenerals()` を呼び、
`CITIES[].generals` / `state.battle.*Generals` / `state.gen` から取り除く。名鑑には「討死」表記で残す。

**演出フェーズ** `bDuelDraw()`（`battleCanvas` へ直接描画。DOM は使わない）:

| フェーズ | 時間 | 描画内容 |
|---|---|---|
| `hail` | 1.6s | 画面を `rgba(6,10,15,.78)` で暗転。挑戦側の陣営色の帯が左からスライドイン。「我こそは」を大書 |
| `name` | 1.8s | 金(`--gold`)の上下二重罫線に挟んで **武将名（serif 56px相当）＋出身地＋二つ名**。武力値を篆書風に小さく添える |
| `answer` | 1.6s | 受諾: 相手側の帯が右からスライドインし同様に名乗る／拒否: 「〜、応じず」＋帯が退く |
| `clash` | 3.0s | 中央で両者の武将名を左右に配置。`exchanges` を等間隔で再生。1合ごとに斜め斬撃線（白 → `--gold`）＋ `sfx('hit')` ＋ HPバー更新 |
| `result` | 2.0s | 「〜、〜を討ち取る！」「〜、手傷を負い退く」「引き分け」を大書。討死時のみ画面を一度 `--red` で薄くフラッシュ（**加算合成やネオングローは使わない**） |

スキップ: `battleCanvas` への `pointerdown` または任意キー押下で `bDuelSkip()` → `result` へジャンプ。
`result` 終了で `bDuelApply()` → `state.battle.duel = null` → 通常の合戦操作へ復帰。

**1ラウンド1回制限**: 挑戦した側・受けた側の双方に `duelDone = true` を立て、`bEndEnemyPhase()` でリセットする。

### 4.11 計略の成功率 `plotChance(atkChi, defChi, def)`

```
p = clamp(def.base + (atkChi - defChi) / 200, def.floor, def.ceil)
```

| 実行者 | 対象の最高知力 | 火計(base .42) | 混乱(base .38) | 離間(base .30) |
|---|---|---|---|---|
| 諸葛亮 100 | 30 | 0.77 | 0.73 | 0.65 |
| 諸葛亮 100 | 98（司馬懿） | 0.43 | 0.39 | 0.31 |
| 張飛 30 | 100 | 0.05（下限） | 0.05 | 0.05 |

`atkChi` は「実行するスタック／都市の最高知力（`effStat` ベース）」、
`defChi` は「対象スタック／対象都市の最高知力」。守備側に軍師がいると計略が通らない、が成立する。

### 4.12 火計と延焼 `bPlotFire` / `bTickFires`

**実行条件**:
```
weather !== 'rain'                              （雨は不可・UIで理由を表示）
bFlammable(c, r) > 0                            （river / water は不可）
!plotUsed[s.id].fire                            （1部隊1回）
bDist(s.col, s.row, c, r) <= 2                  （火矢の届く距離）
```

**判定と損害**:
```
p = plotChance(atkChi, defChi, PLOT.fire)
成功時:
  fireMul = WEATHER[B.weather].fireMul          // 晴1.0 / 霧0.6 / 風2.0 / 雨0（実行不可）
  flam    = bFlammable(c, r)                    // plain .6 / forest 1.0 / mountain .4
  target  = bStackAt(c, r)
  if (target):
      loss = Math.round(target.count * PLOT.fire.dmg * fireMul * flam)
      target.count -= loss ; bAddMorale(target, MORALE.fireHit, '火計')
  B.fires[c+','+r] = {turnsLeft: PLOT.fire.burnTurns}
  sfx('fire')
```

**延焼 `bTickFires()`**（各ラウンド開始時に実行）:
```
for (key of Object.keys(B.fires)):
    f = B.fires[key]
    // 焼損: 炎上ヘックス上の部隊は毎ラウンド損害
    st = bStackAt(c, r)
    if (st): st.count -= Math.round(st.count * 0.08 * fireMul)
             bAddMorale(st, -6, '延焼')
    // 延焼: 風向き方向へ 50%、その左右へ各 25%
    dirs = [B.windDir, (B.windDir+1)%6, (B.windDir+5)%6]
    probs = [0.50, 0.25, 0.25]
    各方向の隣接ヘックスが bFlammable > 0 かつ未炎上なら probs で着火
    f.turnsLeft--
    if (f.turnsLeft <= 0) delete B.fires[key]
if (B.weather === 'rain') B.fires = {}           // 途中で雨になれば鎮火（天候は合戦中固定なので通常起きない）
```

`B.windDir` は合戦開始時に `Math.floor(Math.random()*6)`。天候が `wind` のときのみ HUD に矢印で表示する
（**赤壁シナリオで「東南の風」を演出できる余地を残す** — Could C-04）。

### 4.13 埋伏の毒 `plotPoison` / `tickPoison`

```
plotPoison(cityId, spyId):
   cost 300金。spy は自軍武将（知力が高いほど良い）
   p = plotChance(effStat(spyId).chi, 対象都市の最高知力, PLOT.poison)
   成功: 都市の plotFlags.poisonBy = state.faction ; plotFlags.spy = spyId
         spy を自軍都市の generals から除去（潜入中は使えない）
   失敗: spy は捕らえられ処刑（恒久除去）。金は全額消費
         addLog('⚠ 密偵は露見し、命を落とした。 / The agent was exposed.')

tickPoison()（毎ターン・全都市）:
   for each city with plotFlags.poisonBy:
      pOpen = clamp(0.05 + (100 - city.loyalty)/300 + effStat(spy).chi/500, 0.02, 0.35)
      if (rnd < pOpen):
          無血開城: city.owner = poisonBy ; spy を city.generals へ復帰 ; garrison はそのまま
          addLog('★ 城門が内より開かれた！ / The gates opened from within.')
      else if (rnd < 0.10):
          露見: spy 処刑、plotFlags クリア
```

**設計意図**: 流言（`loyalty` 低下）→ 埋伏の毒（低 `loyalty` ほど開城率が上がる）という
**計略のコンボが成立する**ようにしている。知力を主軸にした攻略ルートが軍事力ルートと並立する。

### 4.14 AI の拡張 `runAI()`

既存（L174）は「隣接で `cityPower` が勝れば攻撃」＋「ランダムに繁栄+2 / 兵+3」のみ。以下を追加する。

```
for each AI faction f:
  1. 経済:  aiFood = foodIncome(f) - foodUpkeep(f)
            aiFood < 0 なら agri を優先、そうでなければ commerce / levy を選択
  2. 内政:  最も低いフィールドへ投資（agriculture < 40 → agri、wall < 30 かつ前線都市 → wall）
  3. 徴兵:  兵糧に余裕があり、前線都市の garrison が隣接敵より低いときのみ levy
  4. 計略:  知力85以上の武将を持ち、金200以上なら
              - プレイヤーが同盟を組んでいる相手がいれば alienate（確率 0.25）
              - 前線の敵都市へ rumor（確率 0.35）
  5. 引抜:  隣接するプレイヤー都市の低忠誠武将へ働きかけ（tickPoaching 側で処理）
  6. 進軍:  既存ロジック。ただし兵糧チェックを追加（marchFood を賄えないなら出陣しない）
```

**プレイヤー優遇バイアスの維持**: 既存の `+12` 点バイアス（プレイヤー領を狙いやすくする）は残す。
ただし兵糧制約が入ることで AI も無制限に軍拡できなくなり、結果として難易度は自然に緩和される。
**P7 完了後にプレイテストで再調整すること。**

### 4.15 天候の抽選 `rollWeather()`

```
w = WEATHER.weights[state.season]        // growth / harvest で重みが変わる
state.weather = 重み付き抽選(w)
```
合戦開始時（`startBattle`）は `state.weather` を引き継ぎ、戦場の地形プロファイルで補正する:
`red_cliffs` / `riverbank` / `wetland` は `fog` の重みを ×1.5、`wuzhang` / `desert` は `wind` を ×1.5。

**霧の視界制限の実装**: `bDrawStack()` で、プレイヤー側スタックからの最短 `bDist` が
`WEATHER.fog.vision`(=3) を超える敵スタックは、武将名と兵数を伏せ地形色のシルエットで描く。
AI 側も同条件で `bAiActUnit()` の索敵対象を制限する（**公平性を保つ**）。

---

## 5. UI 仕様

### 5.1 日英バイリンガル文言表（追加分すべて）

| 箇所 | 日本語 | 英語 |
|---|---|---|
| topbar 兵糧 | 兵糧 | FOOD |
| topbar 天候 | 天候（晴/雨/霧/風） | WEATHER (CLEAR/RAIN/FOG/GALE) |
| 季節 | 春夏 / 秋冬 | SPRING–SUMMER / AUTUMN–WINTER |
| 内政ボタン | 農業 / 商業 / 徴兵 / 城壁 / 施し | AGRI / TRADE / LEVY / WALL / RELIEF |
| 都市ステータス | 兵力 / 民政 / 農業 / 商業 / 城壁 / 民忠 / 武将 | TROOPS / DEV / AGRI / TRADE / WALL / LOYALTY / OFFICERS |
| 在野 | 在野探索 | SCOUT |
| 登用 | 登用 / 提示金額 | RECRUIT / OFFER |
| 忠誠 | 忠誠 | LOYALTY |
| 恩賞 | 恩賞 | REWARD |
| 配置転換 | 配置転換 | TRANSFER |
| 戦略計略 | 計略 / 離間 / 流言 / 埋伏の毒 | STRATAGEM / ALIENATE / RUMOR / SLEEPER |
| 合戦計略 | 火計 / 伏兵 / 混乱 / 鼓舞 | FIRE / AMBUSH / CONFUSE / RALLY |
| 一騎打ち | 一騎打ち | DUEL |
| 名乗り | 我こそは | I AM |
| 士気 | 士気 | MORALE |
| 壊走 | 壊走 | ROUT |
| 兵糧切れ | 兵糧が尽きた | OUT OF SUPPLY |
| 勢力選択 | 勢力を選ぶ | CHOOSE FACTION |
| シナリオ選択 | シナリオを選ぶ | CHOOSE SCENARIO |
| 難易度 | 難易度 | DIFFICULTY |

表記方式は既存の `.eyebrow`（英語を小さく上に）と `<small>` 併記を踏襲する。
**トップバー等の狭い場所では日本語のみ表示し、`title` 属性に英語を入れる**（1260x540 対策）。

### 5.2 サイドパネル `cityPanel()` の再構成

```
[都市名]                              ← 既存
[勢力名／君主／自軍領]                 ← 既存
┌ ステータス（2段グリッド・7項目）────┐
│ 兵力 62  民政 58  農業 55  商業 46   │
│ 城壁 48  民忠 71  武将 3            │
└──────────────────────────────────┘
[内政 / DOMESTIC AFFAIRS]             ← 新セクション見出し
┌ 2列グリッド ─────────────────┐
│ 農業 100金   商業 100金             │
│ 徴兵 120金+糧60  城壁 150金         │
│ 施し 80金+糧40                      │
└──────────────────────────────────┘
[人事 / PERSONNEL]                    ← 新セクション見出し
  在野探索（80金）  ※ 発見済みがあればバッジ表示
  駐屯武将リスト（1行 = 名 / 武知統 / 忠誠バー / [恩賞][転換]）
[出陣 / CAMPAIGN]
  隣接敵城ボタン（既存）＋ 必要兵糧の表示
[軍議記録 / WAR COUNCIL]              ← 既存 log
```

### 5.3 合戦画面の追加要素

- `#bPlotBar`: `#bSelect` の直下。4ボタン（火計/伏兵/混乱/鼓舞）。
  実行不可時は `disabled` ＋ `title` に理由（例: 「雨天のため火計は行えない / Rain prevents fire attacks」）
- `#bSelect` 内に「一騎打ち / DUEL」ボタン（隣接敵がいるときのみ表示）
- `.bInfo` に天候バッジ（漢字1文字＋英語小字）と攻撃側の残兵糧
- スタック描画に士気バー（幅 = `size*1.1`、高さ 3px、`--teal` → `--red` のグラデーションではなく
  **単色を閾値で切り替える**: `morale>=60` は `--teal`、`30-59` は `--gold`、`<30` は `--red`）

**色の追加は最小限**。`--grain:#c8b273`（兵糧）1色のみを新規追加し、他は既存変数を流用する。

---

## 6. エッジケース・エラー処理

| # | ケース | 挙動 |
|---|---|---|
| E-01 | 外部JS（`SANGUO_SCENARIOS`）が読み込めない | 内蔵ミニマル setup（190年）で起動し、シナリオ一覧を1件に縮退。`console.warn` |
| E-02 | setup の `cities` に都市が欠けている | 190年既定値で補完し `console.warn`。起動は継続 |
| E-03 | setup の `playable` に盤上不在の勢力が含まれる | 該当勢力を選択肢から除外 |
| E-04 | 在野プールが空（全員配置済み） | 探索ボタンを disabled にし「在野の人材は見当たらない / No talent available」 |
| E-05 | 兵糧が 0 で徴兵・遠征を試みる | ボタンを disabled にし、理由をツールチップ表示。**実行させない** |
| E-06 | 兵糧が負に落ちる（AI の計算ずれ等） | `state.food = Math.max(0, ...)` でクランプし `applyFamine` を1回だけ実行 |
| E-07 | 一騎打ちの対象武将が演出中に討死済み（多重発火） | `state.battle.duel !== null` の間は挑戦ボタンと `bClick()` を無効化 |
| E-08 | 一騎打ち演出中にブラウザタブが非アクティブ→復帰 | `bDuelTick()` は `performance.now()` の実時間差分で進行させ、`dt > 500ms` はクランプして飛ばす |
| E-09 | 討死した武将が `CITIES[].generals` に残る | `purgeDeadGenerals()` を `bApplyResult()` 直後と `loadGame()` 直後に実行 |
| E-10 | 埋伏の毒の潜入先都市が別勢力に奪われる | `plotFlags` をクリアし、密偵は 50% で自軍へ帰還・50% で消息不明 |
| E-11 | 離間の対象2勢力が既に同盟していない | ボタンを disabled。対象選択リストに同盟中のペアのみ出す |
| E-12 | 火計の延焼が盤面全体に広がり無限に続く | `turnsLeft` は必ず減算、同時炎上上限を `BHEX.cols*BHEX.rows*0.4`(=35) 枚に制限 |
| E-13 | 士気0の部隊が壊走した結果、両陣営が全滅 | `bCheckEnd()` で「相討ち」を防御側勝利として扱う（攻城側が城を取れなければ守備成功） |
| E-14 | v1 セーブが破損している | try/catch で握りつぶし、`clearSave()` してタイトルへ |
| E-15 | v2 セーブに未知のフィールドがある（将来版からのダウングレード） | 既知フィールドのみ読み、未知は無視 |
| E-16 | `GENERAL_IDS` の重複により同じ武将が2都市に存在 | `applyScenario()` の最後に重複検査を行い、後勝ちで1箇所に寄せる |
| E-17 | 忠誠の引き抜きでプレイヤーの武将が0人になる | 都市に武将が1人もいない状態は許容（`bBuildStacks` は「雑兵」でフォールバック済み）。ただし**君主武将は引き抜き対象外**とする |
| E-18 | 1260x540 で内政5ボタンが縦に溢れる | `.panelActions` を `max-height:28vh; overflow-y:auto` にする |

---

## 7. 実装順序表（★code-generator 必読）

**原則: 1フェーズ = 1 code-generator セッション。** `sanguo.html` は単一ファイルで既に大きく、
複数フェーズを1セッションで実装するとタイムアウトする。各フェーズの完了時点で
`dynamic-test`（`file://` でのランタイムエラー0）を通してから次へ進むこと。

| フェーズ | 内容 | 依存 | 主な編集対象（関数名で grep） | 目安 |
|---|---|---|---|---|
| **P0** | 基盤 | なし | `state`(L141) / `CITIES`(L89) / `saveGame`(L276) / `loadGame`(L279) / `clearSave`(L278)。新規: `hashStr` `srand` `rndPick` `seasonOf` `initCityFields` `genOf` `effStat` `migrateSaveV1` ＋ 定数 `ECON/PLOT/DUEL/WEATHER` ＋ `assets/js/sanguo-scenarios.js`（空の器）と `sanguo-lore.js` を新設し `<script src>` 追加 | 小 |
| **P1** | 機能1 シナリオ実データ化 ★最優先 | P0 | `FACTIONS`(L81 に4勢力追記) / `SCENARIO_STORIES`(L280) / `openScenarioPicker`(L293) / `openStory`(L294) / `startScenario`(L295) / `factionCard`(L150) / `startButton.onclick`(L296) / `checkVictory`(L176)。新規: `applyScenario` `validateSetup` `distributeWild` `openFactionPick` `difficultyOf`。**`sanguo-scenarios.js` に8シナリオ×20都市を全記述** | **大** |
| **P2** | 機能3 内政分化＋兵糧 | P0, P1 | `endTurn`(L172, ★L313 のモンキーパッチを統合削除) / `develop`(L177 → `doPolicy` へ置換) / `attack`(L179) / `cityPanel`(L181) / `updateUI`(L182) / `runAI`(L174 の経済部分) / topbar HTML(L52)。新規: `foodIncome` `foodUpkeep` `goldIncome` `tickEconomy` `applyFamine` `doPolicy` `policyGain` `tickLoyalty` `myCities` | 大 |
| **P3** | 機能2 武将運用 | P0, P1, P2 | `recruit`(L178 → 削除) / `cityPanel`(L181) / `updateUI`(L182) / `buildRoster`(★L316 側) / `endTurn`。新規: `scoutCity` `scoutChance` `recruitCost` `recruitChance` `doRecruit` `transferGeneral` `rewardGeneral` `tickLoyaltyGenerals` `tickPoaching` ＋ `#scoutOverlay` `#transferOverlay` | 大 |
| **P4** | 機能5-a 士気＋天候 | P0, P2 | `bBuildStacks`(L217) / `bResolveMelee`(L246) / `bCleanup`(L247) / `bCheckEnd`(L248) / `bEndEnemyPhase`(L252) / `bDrawStack`(L234) / `bSyncHUD`(L257) / `bAutoResolve`(L253) / `bComputeRange`(L240) / `bAttackTargets`(L242) / `startBattle`(L219) / `simResolve`(L260)。新規: `rollWeather` `weatherOf` `bAddMorale` `bRout` `bTickMorale` `bSurroundCount` `bDrawFog` | 中 |
| **P5** | 機能5-b 一騎打ち（名乗り演出）★深澤指名 | P4 | `bClick`(L243) / `bShowSel`(L258) / `bDraw`(L237) / `bTickStart`(L239) / `sfx`(L264) / `bApplyResult`(L255)。新規: `duelCandidates` `duelRefuseChance` `resolveDuel` `bDuelStart` `bDuelTick` `bDuelDraw` `bDuelSkip` `bDuelApply` `epithetOf` `purgeDeadGenerals` ＋ `sanguo-lore.js` の `epithet` 充実 | 中 |
| **P6** | 機能4-a 合戦計略 | P4（士気）, P0（天候定数） | `bDraw`(L237) / `bEndEnemyPhase`(L252) / `bShowSel`(L258) / `bResolveMelee`(L246 の伏兵・混乱分岐) / `TERR`(L197)。新規: `plotChance` `bPlotFire` `bPlotAmbush` `bPlotConfuse` `bPlotRally` `bTickFires` `bFlammable` `bDrawFires` ＋ `#bPlotBar` | 中 |
| **P7** | 機能4-b 戦略計略＋AI強化＋バランス | P2, P3, P6 | `runAI`(L174) / `endTurn`(L172) / `decayDiplomacy` / topbar(L53 に `#plotButton`)。新規: `openPlotOverlay` `plotAlienate` `plotRumor` `plotPoison` `tickPoison` `aiPolicyChoice` | 中 |

### 7.1 フェーズ間の依存グラフ

```
P0 基盤
 ├→ P1 シナリオ ────┐
 │                  ├→ P3 人事（在野プールが P1 の distributeWild に依存）
 ├→ P2 経済・兵糧 ──┤
 │                  └→ P7 戦略計略・AI
 └→ P4 士気・天候 ──→ P5 一騎打ち
                     └→ P6 合戦計略（鼓舞が士気に依存、火計が天候に依存）
```

**P1 完了時点で単体リリース可能**（既存イラスト8枚が機能する時点で価値が確定するため）。
深澤の承認が得られれば P1 だけを先行マージしてよい。

### 7.2 影響範囲マトリクス（既存関数 × フェーズ）

| 既存関数 | P0 | P1 | P2 | P3 | P4 | P5 | P6 | P7 |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `state`(L141) | ●大 | ○ | ○ | ○ | | | | ○ |
| `CITIES`(L89) | ●大 | ●大 | ○ | ○ | | | | |
| `FACTIONS`(L81) | | ●中 | | | | | | |
| `endTurn`(L172) | | | ●大 | ●中 | | | | ●中 |
| `runAI`(L174) | | | ●中 | | | | | ●大 |
| `checkVictory`(L176) | | ●小 | | | | | | |
| `develop`(L177) | | | ●削除 | | | | | |
| `recruit`(L178) | | | | ●削除 | | | | |
| `attack`(L179) | | | ●中 | | | | | |
| `cityPanel`(L181) | | | ●大 | ●大 | | | | ●小 |
| `updateUI`(L182) | ○ | ○ | ●中 | ●中 | | | | ○ |
| `buildRoster`(L316) | | | | ●中 | | ○ | | |
| `startBattle`(L219) | | | ○ | | ●中 | | ○ | |
| `bBuildStacks`(L217) | | | | | ●大 | ○ | ○ | |
| `bResolveMelee`(L246) | | | | | ●大 | ○ | ●中 | |
| `bCleanup`(L247) | | | | | ●大 | | | |
| `bCheckEnd`(L248) | | | | | ●小 | ○ | | |
| `bEndEnemyPhase`(L252) | | | | | ●中 | ○ | ●中 | |
| `bDrawStack`(L234) | | | | | ●中 | ○ | ○ | |
| `bDraw`(L237) | | | | | ○ | ●中 | ●中 | |
| `bAutoResolve`(L253) | | | | | ●中 | | | |
| `bApplyResult`(L255) | | | | | | ●小 | | |
| `simResolve`(L260) | | | ○ | | ●小 | | | |
| `sfx`(L264) | | | ○ | | | ●小 | ●小 | |
| `saveGame`/`loadGame`(L276/279) | ●大 | ●中 | ●中 | ●中 | ○ | ○ | | ○ |
| `startScenario`(L295) | | ●大 | | | | | | |
| L313 モンキーパッチ | | | ●削除 | | | | | |

●=主要変更 ○=軽微/連鎖変更

### 7.3 各フェーズの完了判定

| フェーズ | 完了判定（これが通らなければ次へ進まない） |
|---|---|
| P0 | 既存ゲームが従来通り遊べる（回帰なし）。v1 セーブが v2 へ移行し「続きから」で復帰できる |
| P1 | 受入基準 A-01〜A-04（8シナリオの盤面一致・208に董卓不在・勢力数変動・遷移順） |
| P2 | A-05, A-06。加えて「garrison を全都市 120 以上にすると春夏に兵糧が赤字になる」ことを手動確認 |
| P3 | A-07, A-08 |
| P4 | A-11, A-12, A-13, A-14 |
| P5 | A-09, A-10, A-11（スクリーンショットに名乗りが写ること） |
| P6 | A-13, A-14, A-15 |
| P7 | A-16, A-17。全体プレイテスト（1シナリオを勝利まで通す） |
| 全体 | A-18〜A-24（セーブ移行・モバイル・エラー0・日英・色規約・依存追加なし・60fps） |

---

## 8. テスト観点（Dynamic-Tester / Evaluator 向け）

### 8.1 `dynamic-test` で必ず見る点

- `pageerror` 0 件（`file://` 起動時。外部JS 2本の読み込み失敗を含まないこと）
- `assets/js/sanguo-scenarios.js` / `sanguo-lore.js` の 404 が出ていないこと
- 8シナリオそれぞれを開始 → `gameScreen` が表示され Canvas に描画がある
- 合戦へ進入 → 一騎打ちを1回発生させてスクリーンショットに名乗りが写る
- ビューポート 1260x540 と 1920x1080 の2種でスクリーンショット取得

### 8.2 手動確認が必要な点（自動化しにくい）

- 名乗り演出の「見せ場」としての質（間の取り方・文字サイズ・スキップの効き）
- 兵糧のジレンマが実際に効いているか（軍拡一辺倒で詰まるか）
- 計略ルートで軍事的に不利な勢力でも勝てるか（208赤壁の蜀＝1都市）
- 既存の黒＋金のトーンが崩れていないか

### 8.3 回帰確認

- 既存の外交（同盟・停戦・贈物・共同出兵）が動く
- 武将名鑑のアトラス切り出しが崩れていない
- 横向き強制ゲートがモバイルで機能する
- 歴史イベント（200年・208年のモーダル）が P2 の `endTurn` 統合後も出る

---

## 9. 引き渡し先

- **[Code-Generator]** — P0 から順に。1フェーズ1セッション。**フェーズ跨ぎの実装をしないこと**
- [Graphic-Designer] — **不要**（新規画像なし。天候・炎はプロシージャル描画）
- [Music-Generator] — **不要**（`sfx()` に Web Audio でプロシージャル追加）
- [Legal-Checker] — 新規アセット・新規ライブラリがないため **GREEN 見込み**。ただし追加勢力名・武将名の史実表記のみ確認
- [Dynamic-Tester] — 各フェーズ完了時に必須
- 成果物提出後: `sanguo_評価.md`（[[sanguo]] ハブから参照）
