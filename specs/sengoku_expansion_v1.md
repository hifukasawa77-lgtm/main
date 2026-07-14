# 戦国の野望 拡張仕様書 v1.0

**対象ファイル**: `sengoku.html`（7341行）  
**策定日**: 2026-07-15  
**担当**: Planner → Code-Generator

---

## 0. 実装方針サマリー

| 区分 | 方針 |
|------|------|
| フレームワーク | 素のHTML/JS（Canvas API）。フレームワーク不使用 |
| 変更単位 | 変更箇所スニペット（前後10行含む）でCode-Generatorへ渡す |
| JSONファイル | `provinces.json` / `scenarios.json` は変更しない。湊・鉱山・特産品は定数で管理 |
| セーブ互換 | `state.daimyo[id]` の新フィールドは `??` でデフォルト値取得。既存セーブが壊れない |
| XSS対策 | `innerHTML` 使用禁止。描画は既存の `T(ctx, ...)` / `bs.push(...)` 体系に統一 |
| コンテキスト節約 | 1ファイルの全体読み込み禁止。行番号を指定してEdit toolで差し込む |

---

## 1. state 拡張定義

### 1-1. state.daimyo[id] に追加するフィールド

`buildGameState` 内の `state.daimyo[d.id] = { ... }` の初期化オブジェクト（**sengoku.html:3082行**）に下記を追加する。

```javascript
// 追加フィールド（既存行の末尾に追記）
// 変更前（3082行付近）:
state.daimyo[d.id] = { id:d.id, gold:..., alive:true, rice:0, horse:0, gun:0, daughters:1, fame:0 };

// 変更後:
state.daimyo[d.id] = {
  id:d.id, gold: 1000 + (owncnt[d.id]||1)*280, alive:true,
  rice:0, horse:0, gun:0, daughters:1, fame:0,
  prestige: 5,          // 威信（0-300）。官位・武功で増加、外交に影響
  court_rel: 10,        // 朝廷との信用（0-100）。献上品・推挙で増加
  shogunate_rel: 10,    // 幕府との信用（0-100）。役職申請・支援で増加
  kanoi_court: null,    // 朝廷から得た官位（string|null）例: '従五位下'
  kanoi_shogun: null,   // 幕府から得た役職（string|null）例: '幕府奉行'
};
```

**アクセスパターン（既存セーブ互換）:**
```javascript
// 既存セーブでフィールドが欠落している場合は ?? でデフォルト値を返す
const prestige  = st.daimyo[did].prestige  ?? 5;
const courtRel  = st.daimyo[did].court_rel ?? 10;
const shogunRel = st.daimyo[did].shogunate_rel ?? 10;
```

### 1-2. state に追加するフィールド

`buildGameState` の `state = { ... }` オブジェクト（**sengoku.html:3066行**）に下記を追加する。

```javascript
// 変更前の state オブジェクト末尾付近（3074行）:
  ricePrice: 100,
};

// 変更後:
  ricePrice: 100,
  armedForces: {},     // 武装勢力ステート { [forceId]: ArmedForceState }
};
```

**ArmedForceState 型定義（コメントのみ）:**
```javascript
// armedForces[forceId] = {
//   relation: 0,          // 関係値 0-100
//   allied: false,        // 従属/同盟フラグ（水軍・国人）
//   hired: false,         // 雇用フラグ（忍者集団）
//   actedTurn: -1,        // このターンに行動済み
//   vassalOf: null,       // どの大名の従属か（水軍・国人）
//   vassalUntil: 0,       // 従属終了ターン
// }
```

**武装勢力ヘルパ関数（`getDip` の隣に追加、sengoku.html:3183行付近）:**
```javascript
function getAF(st, forceId){
  if (!st.armedForces) st.armedForces = {};
  if (!st.armedForces[forceId]) st.armedForces[forceId] = {
    relation:0, allied:false, hired:false, actedTurn:-1, vassalOf:null, vassalUntil:0
  };
  return st.armedForces[forceId];
}
```

---

## 2. 定数データ定義

挿入位置: **sengoku.html:1462行**（`RELIGIOUS_FORCES` 定義の直後、`ADDITIONAL_DAIMYO_RETAINER_FAMILIES` の前）

### 2-1. 朝廷官位ランクテーブル

```javascript
// 朝廷官位。index が低いほど下位。court_rel と prestige の両閾値を満たすと申請可能
const COURT_KANOI_RANKS = [
  { rank:0, name:'従五位下', nameEN:'Jr. 5th Rank Lower', courtRel:15, prestige:10,  cost:200,  prestigeGain:10 },
  { rank:1, name:'従五位上', nameEN:'Jr. 5th Rank Upper', courtRel:25, prestige:25,  cost:350,  prestigeGain:15 },
  { rank:2, name:'従四位下', nameEN:'Jr. 4th Rank Lower', courtRel:40, prestige:50,  cost:500,  prestigeGain:20 },
  { rank:3, name:'従四位上', nameEN:'Jr. 4th Rank Upper', courtRel:55, prestige:80,  cost:700,  prestigeGain:25 },
  { rank:4, name:'従三位',   nameEN:'Jr. 3rd Rank',       courtRel:70, prestige:120, cost:1000, prestigeGain:35 },
  { rank:5, name:'正三位',   nameEN:'Sr. 3rd Rank',       courtRel:80, prestige:160, cost:1500, prestigeGain:50 },
  { rank:6, name:'正二位',   nameEN:'Sr. 2nd Rank',       courtRel:90, prestige:200, cost:2500, prestigeGain:75 },
  { rank:7, name:'正一位',   nameEN:'Sr. 1st Rank',       courtRel:100,prestige:250, cost:5000, prestigeGain:100},
];

// 幕府役職ランクテーブル。shogunate_rel と province数（支配国数）の両閾値
const SHOGUN_ROLE_RANKS = [
  { rank:0, name:'幕府奉公衆',   nameEN:'Shogunate Retainer', shogunRel:15, provinces:2,  cost:150,  prestigeGain:8  },
  { rank:1, name:'幕府奉行',     nameEN:'Shogunate Magistrate',shogunRel:25, provinces:5,  cost:300,  prestigeGain:12 },
  { rank:2, name:'幕府侍大将',   nameEN:'Shogunate Commander', shogunRel:40, provinces:10, cost:500,  prestigeGain:18 },
  { rank:3, name:'幕府評定衆',   nameEN:'Council of State',    shogunRel:55, provinces:15, cost:800,  prestigeGain:25 },
  { rank:4, name:'管領代',       nameEN:'Deputy Kanrei',       shogunRel:70, provinces:20, cost:1200, prestigeGain:35 },
  { rank:5, name:'管領',         nameEN:'Kanrei',              shogunRel:85, provinces:30, cost:2000, prestigeGain:50 },
  { rank:6, name:'副将軍',       nameEN:'Deputy Shogun',       shogunRel:95, provinces:40, cost:3500, prestigeGain:80 },
];
```

### 2-2. 湊（PORT_PROVINCES）

```javascript
// 国ID → 湊名。同一国に複数の場合は代表1つ
const PORT_PROVINCES = {
  izumi:    { nameJP:'堺',      nameEN:'Sakai',      incomeBonus:250 },
  chikuzen: { nameJP:'博多',    nameEN:'Hakata',     incomeBonus:200 },
  hizen:    { nameJP:'平戸/長崎',nameEN:'Hirado/Nagasaki', incomeBonus:180 },
  owari:    { nameJP:'津島/熱田',nameEN:'Tsushima/Atsuta',incomeBonus:160 },
  dewa:     { nameJP:'湊/酒田', nameEN:'Minato/Sakata',   incomeBonus:120 },
  echizen:  { nameJP:'敦賀/三国',nameEN:'Tsuruga/Mikuni', incomeBonus:140 },
  ise:      { nameJP:'安濃津',  nameEN:'Anoutsu',    incomeBonus:130 },
  iyo:      { nameJP:'今治',    nameEN:'Imabari',    incomeBonus:110 },
  echigo:   { nameJP:'直江津',  nameEN:'Naoetsu',    incomeBonus:100 },
  wakasa:   { nameJP:'小浜',    nameEN:'Obama',      incomeBonus:120 },
  nagato:   { nameJP:'赤間関',  nameEN:'Akamagaseki',incomeBonus:150 },
  buzen:    { nameJP:'門司',    nameEN:'Moji',       incomeBonus:130 },
  bungo:    { nameJP:'臼杵',    nameEN:'Usuki',      incomeBonus:100 },
  satsuma:  { nameJP:'坊津',    nameEN:'Bonotsu',    incomeBonus:120 },
  tosa:     { nameJP:'宿毛',    nameEN:'Sukumo',     incomeBonus:80  },
  aki:      { nameJP:'厳島',    nameEN:'Itsukushima',incomeBonus:110 },
  bingo:    { nameJP:'鞆',      nameEN:'Tomo',       incomeBonus:90  },
  harima:   { nameJP:'室津',    nameEN:'Murotsu',    incomeBonus:100 },
  mutsu:    { nameJP:'十三港',  nameEN:'Juzangou',   incomeBonus:70  },
  settsu:   { nameJP:'大坂',    nameEN:'Osaka',      incomeBonus:170 },
};
```

### 2-3. 鉱山（MINE_PROVINCES）

```javascript
const MINE_PROVINCES = {
  sado:    { nameJP:'佐渡金山',  nameEN:'Sado Gold Mine',    kind:'gold',   incomeBonus:600 },
  iwami:   { nameJP:'石見銀山',  nameEN:'Iwami Silver Mine', kind:'silver', incomeBonus:450 },
  tajima:  { nameJP:'生野銀山',  nameEN:'Ikuno Silver Mine', kind:'silver', incomeBonus:300 },
  settsu:  { nameJP:'多田銀山',  nameEN:'Tada Silver Mine',  kind:'silver', incomeBonus:200 },
  iyo:     { nameJP:'別子銅山',  nameEN:'Besshi Copper Mine',kind:'copper', incomeBonus:180 },
  echigo:  { nameJP:'鳴海金山',  nameEN:'Narumi Gold Mine',  kind:'gold',   incomeBonus:250 },
  kai:     { nameJP:'黒川金山',  nameEN:'Kurokawa Gold Mine',kind:'gold',   incomeBonus:350 },
};
```

### 2-4. 特産品（SPECIALTY_PRODUCTS）

```javascript
const SPECIALTY_PRODUCTS = {
  owari:    { nameJP:'綿', nameEN:'Cotton',    bonus:80  },
  kai:      { nameJP:'絹', nameEN:'Silk',      bonus:100 },
  kii:      { nameJP:'材木', nameEN:'Timber',  bonus:70  },
  settsu:   { nameJP:'鉄砲', nameEN:'Firearms',bonus:120 },
  izumo:    { nameJP:'玉鋼', nameEN:'Tamahagane',bonus:90},
  ise:      { nameJP:'真珠', nameEN:'Pearl',   bonus:110 },
  aki:      { nameJP:'塩',   nameEN:'Salt',    bonus:75  },
  echigo:   { nameJP:'越後布',nameEN:'Echigo Cloth',bonus:80},
  tosa:     { nameJP:'紙',   nameEN:'Paper',   bonus:70  },
  satsuma:  { nameJP:'硫黄', nameEN:'Sulfur',  bonus:85  },
  chikuzen: { nameJP:'博多織',nameEN:'Hakata Fabric',bonus:95},
  hizen:    { nameJP:'南蛮物',nameEN:'Namban Goods',bonus:130},
};
```

### 2-5. 水軍（NAVAL_FORCES）

```javascript
const NAVAL_FORCES = [
  { id:'noshima',     nameJP:'能島水軍',   nameEN:'Noshima Navy',   province:'iyo',     lordName:'村上武吉',  hireCost:500, combat:85, vassalBonus:0.30 },
  { id:'innoshima',   nameJP:'因島水軍',   nameEN:'Innoshima Navy', province:'bingo',   lordName:'村上吉充',  hireCost:400, combat:75, vassalBonus:0.25 },
  { id:'kurushima',   nameJP:'来島水軍',   nameEN:'Kurushima Navy', province:'iyo',     lordName:'来島通総',  hireCost:400, combat:70, vassalBonus:0.22 },
  { id:'kuki',        nameJP:'志摩水軍',   nameEN:'Kuki Navy',      province:'shima',   lordName:'九鬼嘉隆',  hireCost:600, combat:90, vassalBonus:0.35 },
  { id:'wakasa_navy', nameJP:'若狭水軍',   nameEN:'Wakasa Navy',    province:'wakasa',  lordName:'若狭衆',    hireCost:250, combat:60, vassalBonus:0.15 },
  { id:'kumano_navy', nameJP:'熊野水軍',   nameEN:'Kumano Navy',    province:'kii',     lordName:'熊野衆',    hireCost:300, combat:65, vassalBonus:0.18 },
  { id:'shiwaku',     nameJP:'塩飽水軍',   nameEN:'Shiwaku Navy',   province:'sanuki',  lordName:'塩飽衆',    hireCost:300, combat:65, vassalBonus:0.18 },
  { id:'satomi_navy', nameJP:'里見水軍',   nameEN:'Satomi Navy',    province:'awa_kanto',lordName:'正木時茂', hireCost:350, combat:72, vassalBonus:0.20 },
  { id:'matsuura',    nameJP:'松浦水軍',   nameEN:'Matsuura Navy',  province:'hizen',   lordName:'松浦隆信',  hireCost:450, combat:80, vassalBonus:0.28 },
];
// vassalBonus: 海上戦闘時の兵力補正率（provinceStrength 乗算として適用）
```

### 2-6. 忍者集団（NINJA_GROUPS）

```javascript
const NINJA_GROUPS = [
  { id:'iga',           nameJP:'伊賀衆',     nameEN:'Iga Shinobi',   province:'iga',     hireCost:300, turnFee:80,  skill:95 },
  { id:'koka',          nameJP:'甲賀衆',     nameEN:'Koka Shinobi',  province:'omi',     hireCost:300, turnFee:80,  skill:90 },
  { id:'fuma',          nameJP:'風魔衆',     nameEN:'Fuma Ninja',    province:'sagami',  hireCost:350, turnFee:90,  skill:90 },
  { id:'suppa',         nameJP:'透波',       nameEN:'Suppa',         province:'shinano', hireCost:200, turnFee:60,  skill:75 },
  { id:'nokizaru',      nameJP:'軒猿',       nameEN:'Nokizaru',      province:'echigo',  hireCost:200, turnFee:60,  skill:75 },
  { id:'kurohabaki',    nameJP:'黒脛巾組',   nameEN:'Kurohabakigumi',province:'dewa',    hireCost:150, turnFee:50,  skill:65 },
];
// skill: 忍者アクションの基本成功率（0-100）。rng と組み合わせて判定する
```

### 2-7. 寺社勢力ゲーム効果（RELIGIOUS_FORCE_EFFECTS）

`RELIGIOUS_FORCES` 配列（sengoku.html:1451行）の各エントリと同一 `id` で参照する。  
（`RELIGIOUS_FORCES` 本体は変更しない）

```javascript
// 寺社勢力の効果定義。RELIGIOUS_FORCES と id でリンクする
const RELIGIOUS_FORCE_EFFECTS = {
  hieizan_enryakuji: { minchuBonus:8,  provinces:['omi','yamashiro','kita_omi'], combatBonus:0,    offeringCost:200 },
  koyasan_kongobuji: { minchuBonus:6,  provinces:['kii','kawachi','izumi'],      combatBonus:0,    offeringCost:200 },
  kofukuji:          { minchuBonus:5,  provinces:['yamato','yamashiro'],         combatBonus:0,    offeringCost:150 },
  suwa_taisha:       { minchuBonus:4,  provinces:['shinano','kai'],              combatBonus:0,    offeringCost:120 },
  itsukushima_jinja: { minchuBonus:4,  provinces:['aki','suo','nagato'],         combatBonus:0,    offeringCost:120 },
  // 一向宗系：minchuBonus が高い代わりに敵対時に戦闘力を持つ
  zuisenji:          { minchuBonus:10, provinces:['etchu','kaga','noto'],        combatBonus:0.15, offeringCost:300 },
  honshoji:          { minchuBonus:10, provinces:['mikawa','totomi'],            combatBonus:0.15, offeringCost:300 },
  ganshoji:          { minchuBonus:10, provinces:['ise','iga','omi'],            combatBonus:0.15, offeringCost:300 },
  yoshizaki_gobo:    { minchuBonus:10, provinces:['kaga','echizen','wakasa'],    combatBonus:0.15, offeringCost:300 },
  negoroji:          { minchuBonus:8,  provinces:['kii','kawachi'],              combatBonus:0.12, offeringCost:250 },
};
// provinces: 同盟/従属時に毎ターン minchu を加算する対象国リスト（プレイヤーが所有中のもの）
// combatBonus: 敵対時（relation<0）にこの省で戦闘する際の兵力補正（守備側に加算）
```

### 2-8. 国人勢力（KOKUJIN_FORCES）

```javascript
const KOKUJIN_FORCES = [
  { id:'kokujin_mino',    nameJP:'美濃国人衆', nameEN:'Mino Kokujin',  province:'mino',    soldiers:1200, hireCost:300, recruitCost:150 },
  { id:'kokujin_shinano', nameJP:'信濃国人衆', nameEN:'Shinano Kokujin',province:'shinano', soldiers:1000, hireCost:250, recruitCost:120 },
  { id:'kokujin_omi',     nameJP:'近江国人衆', nameEN:'Omi Kokujin',   province:'omi',     soldiers:800,  hireCost:200, recruitCost:100 },
  { id:'kokujin_higo',    nameJP:'肥後国人衆', nameEN:'Higo Kokujin',  province:'higo',    soldiers:900,  hireCost:220, recruitCost:110 },
  { id:'kokujin_kii',     nameJP:'紀伊国人衆', nameEN:'Kii Kokujin',   province:'kii',     soldiers:700,  hireCost:180, recruitCost:90  },
  { id:'kokujin_mutsu',   nameJP:'陸奥国人衆', nameEN:'Mutsu Kokujin', province:'mutsu',   soldiers:1500, hireCost:350, recruitCost:180 },
  { id:'kokujin_dewa',    nameJP:'出羽国人衆', nameEN:'Dewa Kokujin',  province:'dewa',    soldiers:1000, hireCost:250, recruitCost:130 },
  { id:'kokujin_chikugo', nameJP:'筑後国人衆', nameEN:'Chikugo Kokujin',province:'chikugo',soldiers:800,  hireCost:200, recruitCost:100 },
];
// soldiers: 帰属後に当該国に加算する兵力
// hireCost: 篭絡の初回コスト（relation 50達成に必要な総合コスト目安）
// recruitCost: 毎ターンの維持費（帰属中）
```

---

## 3. 省単位の湊・鉱山・特産品マッピング（まとめ）

| 国ID | 湊ボーナス | 鉱山ボーナス | 特産品ボーナス |
|------|-----------|-------------|--------------|
| sado | - | 金山 600 | - |
| echigo | 100 | 金山 250 | 越後布 80 |
| kai | - | 金山 350 | 絹 100 |
| owari | 160 | - | 綿 80 |
| ise | 130 | - | 真珠 110 |
| settsu | 170 | 銀山 200 | 鉄砲 120 |
| izumi | 250 | - | - |
| kii | - | - | 材木 70 |
| tajima | - | 銀山 300 | - |
| iwami | - | 銀山 450 | - |
| izumo | - | - | 玉鋼 90 |
| aki | 110 | - | 塩 75 |
| bingo | 90 | - | - |
| nagato | 150 | - | - |
| buzen | 130 | - | - |
| iyo | 110 | 銅山 180 | - |
| tosa | 80 | - | 紙 70 |
| chikuzen | 200 | - | 博多織 95 |
| hizen | 180 | - | 南蛮物 130 |
| satsuma | 120 | - | 硫黄 85 |
| echizen | 140 | - | - |
| wakasa | 120 | - | - |
| harima | 100 | - | - |
| mutsu | 70 | - | - |
| dewa | 120 | - | - |
| bungo | 100 | - | - |

---

## 4. 各機能の処理フロー

### 4-1. 朝廷外交アクション

#### 4-1-a. 献上品（官位昇進申請） `_courtPropose(game, 'offering')`

```
前提条件チェック:
  - st.daimyo[me].gold >= nextRank.cost
  - プレイヤーの現在官位ランク < COURT_KANOI_RANKS 最大
  - dip.actedTurn !== st.turn（朝廷行動は1ターン1回）

実行処理:
  1. gold -= nextRank.cost
  2. court_rel += 5（clamp 0-100）
  3. prestige += 3
  4. 成功判定: srand(st) < (court_rel / 100) * 0.8
     - 成功: kanoi_court = nextRank.name, prestige += nextRank.prestigeGain
             this._flash(`${nextRank.name}に任官！`)
     - 失敗: this._flash('朝廷に献上したが官位は得られなかった（court_rel +5）')
  5. st.daimyo[me]._courtActedTurn = st.turn
```

#### 4-1-b. 仲介停戦申請 `_courtPropose(game, 'mediate')`

```
前提条件:
  - court_rel >= 30
  - gold >= 200
  - selClan（対象大名）が指定されている
  - 対象大名と第三者大名（別途selMediatorで指定）が交戦状態

実行処理:
  1. gold -= 200
  2. court_rel -= 5（朝廷の政治力消耗）
  3. 成功判定: srand(st) < (court_rel / 100) * 0.7
     - 成功: getDip(st, targetA, targetB).truceUntil = st.turn + 8
             addRel(st, me, targetA, 5), addRel(st, me, targetB, 5)
             this._flash(`${nameA}と${nameB}の間を仲介、停戦が成立した`)
     - 失敗: this._flash('仲介は拒絶された（court_rel -5）')
  4. st.daimyo[me]._courtActedTurn = st.turn
```

#### 4-1-c. 他大名への官位推挙 `_courtPropose(game, 'recommend')`

```
前提条件:
  - prestige >= 30
  - court_rel >= 40
  - gold >= 150
  - selClan（推挙対象）が指定されている
  - 推挙対象が自分と同盟または関係値40以上

実行処理:
  1. gold -= 150
  2. prestige -= 10（推挙には威信を消費）
  3. 対象の court_rel += 8
  4. addRel(st, me, targetId, 12)（外交関係改善）
  5. this._flash(`${targetName}家に官位推挙。関係改善`)
  6. st.daimyo[me]._courtActedTurn = st.turn
```

### 4-2. 幕府外交アクション

#### 4-2-a. 役職申請 `_shogunPropose(game, 'request_role')`

```
前提条件:
  - 次ランク役職の shogunRel 閾値 <= shogunate_rel
  - 次ランク役職の provinces 閾値 <= ownedProvinces(st, me).length
  - gold >= nextRole.cost
  - プレイヤーの現在役職ランク < SHOGUN_ROLE_RANKS 最大
  - _shogunActedTurn !== st.turn

実行処理:
  1. gold -= nextRole.cost
  2. shogunate_rel += 5
  3. prestige += 3
  4. 成功判定: srand(st) < (shogunate_rel / 100) * 0.85
     - 成功: kanoi_shogun = nextRole.name, prestige += nextRole.prestigeGain
             // 外交ボーナス: 全大名との関係値+5（威信効果）
             daimyoOf(st).forEach(d => { if(d.id!==me) addRel(st, me, d.id, 5); })
             this._flash(`${nextRole.name}に任ぜられた！（威信 +${nextRole.prestigeGain}）`)
     - 失敗: this._flash('幕府に役職を申請したが見送られた（shogunate_rel +5）')
  5. st.daimyo[me]._shogunActedTurn = st.turn
```

#### 4-2-b. 征伐令申請 `_shogunPropose(game, 'seibatsu')`

```
前提条件:
  - shogunate_rel >= 60
  - prestige >= 80
  - gold >= 500
  - selClan（対象大名）が指定されている
  - 対象大名と自分が交戦状態 or 対象大名が未従属

実行処理:
  1. gold -= 500
  2. prestige += 20
  3. shogunate_rel += 10
  4. 対象大名 shogunate_rel -= 20, prestige -= 15
  5. 天下の旗印効果: 全大名が対象大名と中立以上なら addRel(st, d.id, targetId, -15)
  6. this._flash(`${targetName}家への征伐令が発出された（天下人の大義名分）`)
  7. st.daimyo[me]._shogunActedTurn = st.turn
```

### 4-3. 武装勢力アクション

#### 水軍従属 `_armedForcePropose(game, forceId, 'vassal')`

```
前提条件:
  - getAF(st, forceId).relation >= 30
  - gold >= navalForce.hireCost
  - getAF(st, forceId).allied === false
  - プレイヤーが対象水軍の province を支配している、または隣接している

実行処理:
  1. gold -= navalForce.hireCost
  2. af.allied = true
  3. af.vassalOf = me
  4. af.vassalUntil = st.turn + 999
  5. af.relation = Math.max(af.relation, 50)
  6. // 収入への海上ボーナスは _endTurn で navalBonus を参照
  7. this._flash(`${force.nameJP}が従属。海上戦力ボーナス ${Math.round(force.vassalBonus*100)}%UP`)
```

#### 忍者集団の雇用 `_armedForcePropose(game, forceId, 'hire')`

```
前提条件:
  - gold >= ninjaGroup.hireCost
  - getAF(st, forceId).hired === false

実行処理:
  1. gold -= ninjaGroup.hireCost
  2. af.hired = true
  3. af.relation = 80
  4. // 毎ターン turnFee を自動徴収（_endTurn で処理）
  5. this._flash(`${group.nameJP}を雇用。忍者アクションが使用可能になった`)
```

#### 忍者アクション `_ninjaAction(game, forceId, actionKind, targetPid)`

`actionKind`: `'spy'`（情報収集）/ `'arson'`（放火）/ `'sabotage'`（破壊工作）/ `'seduce'`（引き抜き）/ `'disrupt'`（撹乱）

```
前提条件:
  - getAF(st, forceId).hired === true
  - af.actedTurn !== st.turn
  - targetPid の owner が敵大名（非同盟・非停戦）

共通処理:
  1. af.actedTurn = st.turn
  2. successRate = ninjaGroup.skill / 100 * (0.6 + 0.4 * (af.relation / 100))
  3. success = srand(st) < successRate

アクション別処理:
  spy:      success → st.daimyo[me]._spyResult[targetPid] = {soldiers, rice, generals}
                      this._flash(`${provName}の情報を入手`)
             fail  → this._flash('忍びが捕縛された…（雇用コストを再徴収される可能性）')

  arson:    success → targetProv.rice（または owner の rice を -200）
                      this._flash(`${provName}の兵糧庫に火を放った！（兵糧 -200）`)
             fail  → this._flash(`${provName}で放火工作が失敗した`)

  sabotage: success → targetProv.castleLevel = Math.max(1, targetProv.castleLevel - 1)
                      （効果は3ターン後に自動回復: st.provinces[pid]._sabotageUntil = st.turn + 3）
                      this._flash(`${provName}の城門を破壊した（城Lv一時-1、${3}ターン後回復）`)
             fail  → this._flash('破壊工作が失敗した')

  seduce:   success → 対象省の任意武将の loyalty -= 20（clamp 0-100）
                      this._flash(`${generalName}の忠誠が低下した`)
             fail  → this._flash('引き抜き工作が失敗した')

  disrupt:  success → st.pendingMarch で対象省が攻撃元/攻撃先のものを取り消す
                      （または st.provinces[targetPid]._disruptedUntil = st.turn + 1 で出兵コスト2倍）
                      this._flash(`${provName}の軍勢が撹乱された！`)
             fail  → this._flash('撹乱工作が失敗した')
```

#### 寺社勢力との関係 `_religiousPropose(game, forceId, 'offering')`

```
前提条件:
  - gold >= effect.offeringCost
  - _religiousActedTurn[forceId] !== st.turn

実行処理:
  1. gold -= effect.offeringCost
  2. getAF(st, forceId).relation = Math.min(100, af.relation + 15)
  3. prestige += 5
  4. _religiousActedTurn[forceId] = st.turn
  // minchu ボーナスは _endTurn の毎ターン処理で適用
```

#### 国人勢力の篭絡 `_armedForcePropose(game, forceId, 'gift')`

```
前提条件:
  - gold >= 100
  - getAF(st, forceId).relation < 100

実行処理:
  1. gold -= 100
  2. af.relation = Math.min(100, af.relation + 15)
  // relation >= 80 で「帰属」が解放される
```

#### 国人勢力の帰属 `_armedForcePropose(game, forceId, 'annex')`

```
前提条件:
  - getAF(st, forceId).relation >= 80
  - gold >= force.recruitCost
  - プレイヤーが force.province を支配している

実行処理:
  1. gold -= force.recruitCost
  2. af.allied = true, af.vassalOf = me
  3. st.provinces[force.province].soldiers += force.soldiers
  4. // 以降毎ターン force.recruitCost の維持費を自動徴収（_endTurn）
  5. this._flash(`${force.nameJP}が帰属。${force.province}に兵力 +${force.soldiers}`)
```

---

## 5. UI変更点

### 5-1. MapScene に追加するインスタンス変数

`this.showClans=false;` の初期化行（**sengoku.html:3598行**）に追加:

```javascript
// 変更前:
this.showClans=false; this.selClan=null; this.ploy=null; ...

// 変更後（追記のみ、既存フィールドを維持）:
this.showClans=false; this.selClan=null; this.ploy=null; ...
this.diploTab='clan';      // 'clan'|'court'|'shogun'|'armed'
this.armedSubTab='naval';  // 'naval'|'ninja'|'religious'|'kokujin'
this.selForce=null;        // 選択中の武装勢力ID
this.ninjaAction=null;     // 選択中の忍者アクション種別
```

### 5-2. タブバー追加（_buildButtons の showClans ブロック内）

**sengoku.html:5086行** の `if (this.showClans){` ブロック冒頭に、タブバーボタンを4つ追加する。

```javascript
// --- タブバー（外交パネル上部） ---
// 挿入位置: if(this.showClans){ の直後、const L=this._diploLayout(); の前
const TABS = [
  { key:'clan',   jpLabel:'大名外交', enLabel:'Daimyo' },
  { key:'court',  jpLabel:'朝廷',     enLabel:'Court'  },
  { key:'shogun', jpLabel:'幕府',     enLabel:'Bakufu' },
  { key:'armed',  jpLabel:'武装勢力', enLabel:'Forces' },
];
const tabW = Math.floor(L.pw / TABS.length);
TABS.forEach((tab, i) => {
  const isActive = this.diploTab === tab.key;
  bs.push({
    x: L.px + i * tabW, y: L.py,
    w: tabW - 4, h: 56,
    jp: tab.jpLabel, en: tab.enLabel,
    sz: 22, ensz: 13,
    accent: isActive ? 'rgba(100,200,255,0.5)' : 'rgba(60,60,80,0.5)',
    action: () => { this.diploTab = tab.key; this.selClan = null; this.selForce = null; }
  });
});
// タブバーの高さ分レイアウトを下にオフセット（L.listY += 66 等の調整が必要）
```

### 5-3. タブ別描画分岐

`if (this.showClans){` ブロック内の既存ボタン定義を、`if (this.diploTab === 'clan'){` で囲んで分岐する。

```javascript
if (this.showClans) {
  // [タブバー追加]
  if (this.diploTab === 'clan') {
    // 既存の大名外交ボタン（そのまま移動）
    const L=this._diploLayout(); const clans=this._diploClans(); ...
  }
  else if (this.diploTab === 'court') {
    this._buildCourtButtons(bs, st, L);
  }
  else if (this.diploTab === 'shogun') {
    this._buildShogunButtons(bs, st, L);
  }
  else if (this.diploTab === 'armed') {
    this._buildArmedForceButtons(bs, st, L);
  }
  // 閉じるボタン（共通）
  bs.push({x:L.px+L.pw-152, y:L.py+22, w:128, h:60, skin:'topBar', label:'✕ 閉じる', sz:24,
    action:()=>{ this.showClans=false; this.selClan=null; this.selForce=null; }});
}
```

### 5-4. `_buildCourtButtons(bs, st, L)` 関数

```javascript
// sengoku.html の MapScene クラス内メソッドとして追加
_buildCourtButtons(bs, st, L){
  const me = st.playerDaimyo;
  const dmyo = st.daimyo[me];
  const prestige   = dmyo.prestige   ?? 5;
  const courtRel   = dmyo.court_rel  ?? 10;
  const kanoi      = dmyo.kanoi_court ?? null;
  const currentRank = kanoi ? COURT_KANOI_RANKS.findIndex(r=>r.name===kanoi) : -1;
  const nextRank   = COURT_KANOI_RANKS[currentRank + 1] || null;
  const acted      = (dmyo._courtActedTurn === st.turn);

  const bx = L.rightX, bw = L.rightW;
  let by = L.py + 90;  // タブバー下のスタート位置

  // 現在の官位表示（ボタンではなくラベルとして bs に info フラグ付きで追加）
  bs.push({x:bx, y:by, w:bw, h:72, _infoOnly:true,
    jp:`現在の官位: ${kanoi || '無位'}`,
    en:`Rank: ${kanoi || 'None'}`, sz:22});
  by += 86;

  bs.push({x:bx, y:by, w:bw, h:72, _infoOnly:true,
    jp:`朝廷信用: ${courtRel} / 威信: ${prestige}`,
    en:`Court: ${courtRel} / Prestige: ${prestige}`, sz:20});
  by += 86;

  if (nextRank) {
    bs.push({x:bx, y:by, w:bw, h:92,
      jp:`献上品（${nextRank.cost}貫）→ ${nextRank.name}`,
      en:`Offering → ${nextRank.nameEN}`,
      sz:22, ensz:14, accent:'rgba(200,170,80,0.6)',
      on: dmyo.gold >= nextRank.cost && !acted && courtRel >= nextRank.courtRel && prestige >= nextRank.prestige,
      action: g => this._courtPropose(g, 'offering')
    });
    by += 106;
  }

  bs.push({x:bx, y:by, w:bw, h:92,
    jp:'仲介停戦（200貫）',
    en:'Mediate Truce (200)',
    sz:22, ensz:14, accent:'rgba(100,180,200,0.55)',
    on: dmyo.gold >= 200 && !acted && courtRel >= 30 && this.selClan != null,
    action: g => this._courtPropose(g, 'mediate')
  });
  by += 106;

  bs.push({x:bx, y:by, w:bw, h:92,
    jp:'官位推挙（150貫）',
    en:'Recommend Rank (150)',
    sz:22, ensz:14, accent:'rgba(160,130,220,0.55)',
    on: dmyo.gold >= 150 && !acted && prestige >= 30 && courtRel >= 40 && this.selClan != null,
    action: g => this._courtPropose(g, 'recommend')
  });
}
```

### 5-5. `_buildShogunButtons(bs, st, L)` 関数

```javascript
_buildShogunButtons(bs, st, L){
  const me = st.playerDaimyo;
  const dmyo = st.daimyo[me];
  const prestige    = dmyo.prestige       ?? 5;
  const shogunRel   = dmyo.shogunate_rel  ?? 10;
  const kanoi       = dmyo.kanoi_shogun   ?? null;
  const currentRank = kanoi ? SHOGUN_ROLE_RANKS.findIndex(r=>r.name===kanoi) : -1;
  const nextRole    = SHOGUN_ROLE_RANKS[currentRank + 1] || null;
  const acted       = (dmyo._shogunActedTurn === st.turn);
  const provCount   = ownedProvinces(st, me).length;

  const bx = L.rightX, bw = L.rightW;
  let by = L.py + 90;

  bs.push({x:bx, y:by, w:bw, h:72, _infoOnly:true,
    jp:`現在の役職: ${kanoi || '無役'}`,
    en:`Role: ${kanoi || 'None'}`, sz:22});
  by += 86;

  bs.push({x:bx, y:by, w:bw, h:72, _infoOnly:true,
    jp:`幕府信用: ${shogunRel} / 支配国: ${provCount}国`,
    en:`Bakufu: ${shogunRel} / Provinces: ${provCount}`, sz:20});
  by += 86;

  if (nextRole) {
    const canApply = dmyo.gold >= nextRole.cost
      && shogunRel >= nextRole.shogunRel
      && provCount >= nextRole.provinces
      && !acted;
    bs.push({x:bx, y:by, w:bw, h:92,
      jp:`役職申請（${nextRole.cost}貫）→ ${nextRole.name}`,
      en:`Request → ${nextRole.nameEN}`,
      sz:20, ensz:13, accent:'rgba(180,150,60,0.6)',
      on: canApply,
      action: g => this._shogunPropose(g, 'request_role')
    });
    by += 106;
  }

  bs.push({x:bx, y:by, w:bw, h:92,
    jp:'征伐令申請（500貫）',
    en:'Request Seibatsu (500)',
    sz:22, ensz:14, accent:'rgba(200,80,80,0.6)',
    on: dmyo.gold >= 500 && !acted && shogunRel >= 60 && prestige >= 80 && this.selClan != null,
    action: g => this._shogunPropose(g, 'seibatsu')
  });
}
```

### 5-6. `_buildArmedForceButtons(bs, st, L)` 関数

```javascript
_buildArmedForceButtons(bs, st, L){
  const me = st.playerDaimyo;
  const dmyo = st.daimyo[me];

  // サブタブ（水軍/忍者/寺社/国人）
  const SUB_TABS = [
    { key:'naval',     jpLabel:'水軍',     enLabel:'Navy'    },
    { key:'ninja',     jpLabel:'忍者',     enLabel:'Ninja'   },
    { key:'religious', jpLabel:'寺社',     enLabel:'Temple'  },
    { key:'kokujin',   jpLabel:'国人',     enLabel:'Lords'   },
  ];
  const stW = Math.floor(L.pw / SUB_TABS.length);
  SUB_TABS.forEach((st2, i) => {
    bs.push({
      x: L.px + i * stW, y: L.py + 60,
      w: stW - 4, h: 46,
      jp: st2.jpLabel, en: st2.enLabel, sz:20, ensz:12,
      accent: this.armedSubTab === st2.key ? 'rgba(80,200,180,0.5)' : 'rgba(50,50,70,0.5)',
      action: () => { this.armedSubTab = st2.key; this.selForce = null; }
    });
  });

  // サブタブ別リスト + アクション
  const listX = L.listX, listY = L.listY + 56;
  const forces = this.armedSubTab === 'naval'     ? NAVAL_FORCES
               : this.armedSubTab === 'ninja'     ? NINJA_GROUPS
               : this.armedSubTab === 'religious' ? RELIGIOUS_FORCES
               : KOKUJIN_FORCES;

  forces.forEach((f, i) => {
    const af = getAF(st, f.id);
    bs.push({
      x: listX, y: listY + i * (L.rowH + 8),
      w: L.rowW, h: L.rowH,
      jp: f.nameJP, en: f.nameEN || f.id,
      sz: 24, ensz: 14,
      accent: af.allied ? 'rgba(52,211,153,0.4)' : af.hired ? 'rgba(167,139,250,0.4)' : 'rgba(60,60,80,0.4)',
      _armedForce: f.id,
      action: () => { this.selForce = f.id; }
    });
  });

  // 右パネル：選択中の武装勢力のアクション
  const sid = this.selForce;
  if (sid) {
    const force = forces.find(f => f.id === sid);
    const af = getAF(st, sid);
    const bx = L.rightX, bw = L.rightW;
    let by = L.py + 120;

    if (this.armedSubTab === 'naval') {
      bs.push({x:bx, y:by, w:bw, h:92,
        jp:`贈物（100貫）`,
        en:'Gift (relation +15)',
        sz:22, ensz:14, accent:'rgba(52,211,153,0.55)',
        on: dmyo.gold >= 100 && af.actedTurn !== st.turn,
        action: g => this._armedForcePropose(g, sid, 'gift')
      }); by += 106;
      bs.push({x:bx, y:by, w:bw, h:92,
        jp:`従属の提案（${force.hireCost}貫）`,
        en:`Vassal Proposal`,
        sz:20, ensz:13, accent:'rgba(251,191,36,0.55)',
        on: dmyo.gold >= force.hireCost && af.relation >= 30 && !af.allied && af.actedTurn !== st.turn,
        action: g => this._armedForcePropose(g, sid, 'vassal')
      });
    }
    else if (this.armedSubTab === 'ninja') {
      if (!af.hired) {
        bs.push({x:bx, y:by, w:bw, h:92,
          jp:`雇用（${force.hireCost}貫）`,
          en:`Hire Ninja Group`,
          sz:22, ensz:14, accent:'rgba(100,100,200,0.55)',
          on: dmyo.gold >= force.hireCost,
          action: g => this._armedForcePropose(g, sid, 'hire')
        });
      } else {
        const NINJA_ACTIONS = [
          { k:'spy',     jp:'情報収集（省指定）', en:'Spy',       accent:'rgba(80,200,255,0.5)' },
          { k:'arson',   jp:'放火（兵糧 -200）',  en:'Arson',     accent:'rgba(255,120,50,0.5)' },
          { k:'sabotage',jp:'破壊工作（城Lv-1）', en:'Sabotage',  accent:'rgba(200,80,80,0.5)'  },
          { k:'seduce',  jp:'引き抜き（忠誠-20）',en:'Seduce',    accent:'rgba(200,150,80,0.5)' },
          { k:'disrupt', jp:'撹乱（出兵妨害）',   en:'Disrupt',   accent:'rgba(150,100,200,0.5)'},
        ];
        NINJA_ACTIONS.forEach((na, ni) => {
          bs.push({x:bx, y:by + ni*82, w:bw, h:72,
            jp: na.jp, en: na.en, sz:20, ensz:13,
            accent: na.accent,
            on: af.actedTurn !== st.turn && this.selected != null,
            action: g => this._ninjaAction(g, sid, na.k, this.selected)
          });
        });
      }
    }
    else if (this.armedSubTab === 'religious') {
      const effect = RELIGIOUS_FORCE_EFFECTS[sid];
      if (effect) {
        bs.push({x:bx, y:by, w:bw, h:92,
          jp:`布施（${effect.offeringCost}貫）`,
          en:`Offering (relation +15)`,
          sz:22, ensz:14, accent:'rgba(200,170,100,0.55)',
          on: dmyo.gold >= effect.offeringCost && af.actedTurn !== st.turn,
          action: g => this._religiousPropose(g, sid, 'offering')
        });
        by += 106;
        if (af.allied) {
          bs.push({x:bx, y:by, w:bw, h:72, _infoOnly:true,
            jp:`民忠ボーナス: ${effect.provinces.join('/')}`,
            en:`Minchu bonus: ${effect.provinces.join('/')}`, sz:18});
        }
      }
    }
    else if (this.armedSubTab === 'kokujin') {
      bs.push({x:bx, y:by, w:bw, h:92,
        jp:'贈物（100貫）',
        en:'Gift (relation +15)',
        sz:22, ensz:14, accent:'rgba(52,211,153,0.55)',
        on: dmyo.gold >= 100 && af.actedTurn !== st.turn && af.relation < 100,
        action: g => this._armedForcePropose(g, sid, 'gift')
      }); by += 106;
      if (af.relation >= 80 && !af.allied) {
        bs.push({x:bx, y:by, w:bw, h:92,
          jp:`帰属（${force.recruitCost}貫/ターン）`,
          en:`Annex Local Lord`,
          sz:20, ensz:13, accent:'rgba(251,191,36,0.55)',
          on: dmyo.gold >= force.recruitCost && af.actedTurn !== st.turn,
          action: g => this._armedForcePropose(g, sid, 'annex')
        });
      }
    }
  }
}
```

### 5-7. 描画への `_infoOnly` ボタン対応

既存の `_drawButton(ctx, b)` 関数（ `_drawClansOverlay` 付近）に、`_infoOnly` フラグ対応を追加する。

```javascript
// _drawButton(ctx, b) 関数内の冒頭に追記:
if (b._infoOnly) {
  // 背景なし、テキストのみ表示
  T(ctx, b.jp, b.x + 12, b.y + b.h/2 - 10, {size: b.sz || 22, color:'#c4b5fd'});
  if (b.en) T(ctx, b.en, b.x + 12, b.y + b.h/2 + 20, {size: (b.ensz || b.sz * 0.6), color:'#8b8fa8'});
  return;
}
```

---

## 6. ターン処理への組み込み

### 6-1. 湊・鉱山・特産品による収入加算

**sengoku.html:4680行** の `ownedProvinces(st,d.id).forEach(pid=>{...})` ブロック内に追加。

```javascript
// 既存コード（4682-4685行）の直後に追記:
ownedProvinces(st,d.id).forEach(pid=>{
  const prov=st.provinces[pid];
  const kd=DATA.provById[pid].kokudaka;
  inc += Math.round(kd*(prov.development/100)*SEASONS[season].mod*0.9);
  sol += prov.soldiers;
  if (season===2) harvest += Math.round(kd*(prov.development/100)*RICE_HARVEST_RATE);

  // --- 以下を追加 ---
  // 湊ボーナス
  if (PORT_PROVINCES[pid]) inc += PORT_PROVINCES[pid].incomeBonus;
  // 鉱山ボーナス
  if (MINE_PROVINCES[pid]) inc += MINE_PROVINCES[pid].incomeBonus;
  // 特産品ボーナス
  if (SPECIALTY_PRODUCTS[pid]) inc += SPECIALTY_PRODUCTS[pid].bonus;
});
```

### 6-2. 忍者集団の維持費徴収

`_endTurn` 内の収入処理ブロック（4689行付近、`treas.gold += inc;` の後）に追加。

```javascript
// 忍者集団の維持費（雇用中のみ）
if (d.id === st.playerDaimyo) {
  NINJA_GROUPS.forEach(ng => {
    const af = getAF(st, ng.id);
    if (af.hired) {
      treas.gold = Math.max(0, treas.gold - ng.turnFee);
    }
  });
}
```

### 6-3. 国人勢力の維持費徴収

同上ブロックに追加。

```javascript
// 国人勢力の維持費（帰属中のみ）
if (d.id === st.playerDaimyo) {
  KOKUJIN_FORCES.forEach(kf => {
    const af = getAF(st, kf.id);
    if (af.allied && af.vassalOf === st.playerDaimyo) {
      treas.gold = Math.max(0, treas.gold - kf.recruitCost);
    }
  });
}
```

### 6-4. 寺社勢力による民忠ボーナス

`_finalizeTurn` 内の民忠処理ブロック（4776行付近、`prov.minchu=mc;` の後）に追加。

```javascript
// 寺社勢力の民忠ボーナス（従属/同盟中）
RELIGIOUS_FORCES.forEach(rf => {
  const af = getAF(st, rf.id);
  if (af.allied || af.relation >= 60) {
    const effect = RELIGIOUS_FORCE_EFFECTS[rf.id];
    if (effect) {
      effect.provinces.forEach(epid => {
        const eprov = st.provinces[epid];
        if (eprov && eprov.owner === st.playerDaimyo) {
          eprov.minchu = Math.min(100, (eprov.minchu ?? 60) + effect.minchuBonus);
        }
      });
    }
  }
});
```

### 6-5. 破壊工作の城Lv自動回復

`_finalizeTurn` 内のターン終了処理に追加（4789行付近の末尾）。

```javascript
// 忍者破壊工作の城Lv回復
Object.keys(st.provinces).forEach(pid => {
  const prov = st.provinces[pid];
  if (prov._sabotageUntil && st.turn > prov._sabotageUntil) {
    if (prov._sabotageLevel != null) {
      prov.castleLevel = prov._sabotageLevel;
      delete prov._sabotageLevel;
      delete prov._sabotageUntil;
    }
  }
});
```

※ `_ninjaAction` の sabotage 実行時に `prov._sabotageLevel = prov.castleLevel` を保存してから `castleLevel--` する。

### 6-6. 威信による外交ボーナス

`_diploPropose` 関数（5613行付近）内の `gift` / `ally` 処理で prestige を参照する。

```javascript
// gift 処理（5622行付近）に追記:
pay(100);
const prestigeBonus = Math.floor((st.daimyo[me].prestige ?? 5) / 50); // 最大+4
addRel(st, me, rid, 8 + prestigeBonus);
dip.actedTurn = st.turn;
// // prestige += 1（贈物でわずかに威信上昇）
st.daimyo[me].prestige = Math.min(300, (st.daimyo[me].prestige ?? 5) + 1);
```

### 6-7. AI の朝廷・幕府外交

`runStrategicAI` 関数内（6207行付近）に以下を追加する。既存 AI ブロックの末尾に挿入。

```javascript
// AI 朝廷外交（court_rel < 50 かつ 100ターンに1回程度）
if (srand(st) < 0.05) {
  const courtRel = d_dmyo.court_rel ?? 10;
  if (courtRel < 50 && d_dmyo.gold > 500) {
    d_dmyo.court_rel = Math.min(100, courtRel + 3);
    d_dmyo.gold -= 100;
    d_dmyo.prestige = Math.min(300, (d_dmyo.prestige ?? 5) + 1);
  }
}
// AI 幕府外交（大勢力のみ）
if (srand(st) < 0.03 && ownedProvinces(st, d.id).length >= 10) {
  const shogunRel = d_dmyo.shogunate_rel ?? 10;
  if (shogunRel < 60 && d_dmyo.gold > 500) {
    d_dmyo.shogunate_rel = Math.min(100, shogunRel + 4);
    d_dmyo.gold -= 150;
    d_dmyo.prestige = Math.min(300, (d_dmyo.prestige ?? 5) + 2);
  }
}
```

---

## 7. ファイル変更一覧（Code-Generator 向け作業指示）

### 優先度 High（コア機能）

| # | 変更箇所 | 内容 |
|---|---------|------|
| 1 | sengoku.html:1462行 | 定数データ挿入（PORT/MINE/SPECIALTY/NAVAL/NINJA/KOKUJIN/COURT_KANOI/SHOGUN_ROLE/RELIGIOUS_EFFECT） |
| 2 | sengoku.html:3082行 | buildGameState の daimyo 初期化に prestige/court_rel/shogunate_rel/kanoi_court/kanoi_shogun を追加 |
| 3 | sengoku.html:3074行 | buildGameState の state に armedForces:{} を追加 |
| 4 | sengoku.html:3183行 | getAF() ヘルパ関数を追加 |
| 5 | sengoku.html:3598行 | MapScene インスタンス変数に diploTab/armedSubTab/selForce/ninjaAction を追加 |
| 6 | sengoku.html:5086行 | showClans ブロックにタブバー + diploTab 分岐を追加 |
| 7 | sengoku.html: 既存大名外交 | 既存ボタン定義を `if(this.diploTab==='clan'){...}` で囲む |

### 優先度 High（新規関数）

| # | 関数名 | 追加位置 |
|---|-------|---------|
| 8  | `_buildCourtButtons(bs, st, L)` | MapScene クラス内、`_diploPropose` の前 |
| 9  | `_buildShogunButtons(bs, st, L)` | 同上 |
| 10 | `_buildArmedForceButtons(bs, st, L)` | 同上 |
| 11 | `_courtPropose(game, kind)` | 同上 |
| 12 | `_shogunPropose(game, kind)` | 同上 |
| 13 | `_armedForcePropose(game, forceId, kind)` | 同上 |
| 14 | `_religiousPropose(game, forceId, kind)` | 同上 |
| 15 | `_ninjaAction(game, forceId, actionKind, targetPid)` | 同上 |

### 優先度 Medium（ターン処理統合）

| # | 変更箇所 | 内容 |
|---|---------|------|
| 16 | sengoku.html:4682行 | ownedProvinces ループ内に PORT/MINE/SPECIALTY 収入追加 |
| 17 | sengoku.html:4689行 | 忍者維持費 / 国人維持費の自動徴収 |
| 18 | sengoku.html:4776行 | 寺社勢力による minchu ボーナス |
| 19 | sengoku.html:4789行 | sabotage 城Lv 自動回復 |
| 20 | sengoku.html:5622行 | gift に威信ボーナス適用 |
| 21 | sengoku.html:6207行 | AI の朝廷/幕府外交行動追加 |

### 優先度 Low（UI polish）

| # | 内容 |
|---|------|
| 22 | 描画: `_infoOnly` ボタン対応（`_drawButton` 関数への追記） |
| 23 | 描画: 朝廷/幕府の「現在の官位」を省パネル下部にミニ表示（prestige 数値含む） |
| 24 | 描画: 水軍従属中は海上隣接省への出兵時に兵力ボーナス表示（march パネルに注記） |

---

## 8. セキュリティ注意事項

| 項目 | 対処 |
|-----|------|
| XSS | `innerHTML` を一切使用しない。テキスト描画は既存 `T(ctx, ...)` のみ |
| 入力検証 | `prestige`, `court_rel`, `shogunate_rel` はすべて `clamp(val, 0, 300)` / `clamp(val, 0, 100)` でサニタイズ |
| srand 乱数 | 成功判定は既存 `srand(st)` を使用。`Math.random()` は使用しない（セーブ再現性のため） |
| state 汚染 | `getAF()` は `st.armedForces` の存在を確認してから返す（`??` デフォルト方式で旧セーブ安全） |

---

## 9. 未対応事項（スコープ外）

以下は v1 スコープ外とし、v2 以降で検討する。

- 海上戦闘シーンへの水軍ボーナス実際の適用（BattleScene 内の兵力計算変更が必要）
- 忍者アクション「撹乱」の `pendingMarch` キャンセル実装（march 管理構造の精査が必要）
- 朝廷/幕府 AI の本格的な意思決定（現在は簡易ランダム）
- 国人勢力の離反処理（minchu や戦局に応じた relation 低下）
- 寺社勢力の武力蜂起（一向宗の自律的な出兵 AI）
- 特産品の交易シーン（別パネルとして独立した実装が必要）
