---
type: 基本設計書
project: genpei
status: 作業中
agent: planner
target_file: genpei.html
created: 2026-08-05
updated: 2026-08-05
revision_count: 0
tags: [claudechord, 基本設計, genpei]
---

# 基本設計書 — 源平争乱記 / Genpei Souranki

> プロジェクトハブ: [[genpei]] ／ 上流: [[genpei_基本構想]] → [[genpei_要件定義]] ／ 下流: `genpei_詳細設計.md`
> 本書の数値は**初期値**であり、`verify-genpei-balance.mjs` の結果を見て調整する前提で置いている。

---

## 1. システム構成・全体像

### 1.1 ファイル構成

| パス | 内容 | 新規/既存 |
|---|---|---|
| `genpei.html` | 本体（単一HTML・Canvas API・フレームワーク不使用） | 新規 |
| `kyoten_ichi.csv` | **拠点データの正本**（270拠点・11種別）。リポジトリ直下 | 新規 |
| `assets/genpei/provinces.json` | 令制国66。`assets/sengoku/provinces.json` を複製し `kokudaka` を12世紀の田数相当へ置換 | 新規（複製元は既存） |
| `assets/genpei/generals.json` | 武将 約115名 | 新規 |
| `assets/genpei/scenarios.json` | 6シナリオの初期配置 | 新規 |
| `assets/genpei/bands.json` | 武士団 約70団の定義 | 新規 |
| `assets/genpei/portraits/*.webp` | 肖像アトラス | 新規 |
| `assets/genpei/kamon/*.webp` | 家紋 約20種 | 新規 |
| `assets/genpei/scenes/*.webp` | 合戦背景7・イベント絵10〜14 | 新規 |
| `assets/sengoku/gpt/sengoku-japan-map-user-v1.webp` | 日本地図（1672×941）。**参照のみ・複製も改変もしない** | 既存 |
| `gamekit/gamekit.js` | エンジン | 既存 |
| `scripts/verify-genpei-boot.mjs` | 起動〜ターン終了の例外検査 | 新規 |
| `scripts/verify-genpei-kyoten.mjs` | 拠点CSVとゲーム内データの突合 | 新規 |
| `scripts/verify-genpei-balance.mjs` | 120ターン×3試行の長期進行検査 | 新規 |

> **`sengoku.html` は読み取り専用。** 差分0行を受入基準とする（要件 5.4）。

### 1.2 レイヤ構成

```
┌─ Presentation ────────────────────────────────────┐
│  Scene（GameKit.Scene 派生）                        │
│  Boot / Title / ScenarioSelect / Opening /          │
│  FactionSelect / Map / Battle / Retsuden / Result   │
├─ Rule（純粋関数・副作用なし・テスト可能）───────────┤
│  meibun.js相当  … 名分の算出・無血開城・朝敵認定     │
│  hoko.js相当    … 奉公度・恩賞債務・離反・勧誘       │
│  economy.js相当 … 兵糧・徴税・季節・飢饉             │
│  combat.js相当  … 野戦/攻城/海戦の判定式             │
│  ai.js相当      … AI の行動選択                      │
├─ Data ────────────────────────────────────────────┤
│  DATA.provinces / generals / scenarios / bands      │
│  KYOTEN（kyoten_ichi.csv 由来 + 埋め込みシード）    │
├─ Infra ───────────────────────────────────────────┤
│  GameKit（ループ・入力・SFX・パーティクル・セーブ）  │
│  ASSETS（Proxy による遅延読込＋優先度キュー）        │
└───────────────────────────────────────────────────┘
```

**Rule 層は `state` を引数に取り新しい値を返す純粋関数**とする。副作用を Scene 側に閉じることで、
`verify-genpei-balance.mjs` から Rule 層だけを直接叩いて長期進行を高速に回せるようにする。

### 1.3 データの読み込みとフォールバック（要件 M-46）

戦国風雲記と同方式。**`file://` で開いても動くことが必須**（`dynamic-test` が `file://` を使うため）。

```
起動時:
  1. fetch('assets/genpei/*.json') / fetch('kyoten_ichi.csv')
  2. 成功 → それを使う（正本）
  3. 失敗（file:// / 404 / CORS）→ HTML 埋め込みの
     DATA_FALLBACKS / KYOTEN_SEED_CSV へ落ちる
```

> ⚠ **埋め込みシードの更新を忘れても例外は出ない。** 正本CSVを編集した端末だけ正しく見え、
> 初回起動の端末は古いシードで動く。`verify-genpei-kyoten.mjs` が
> **埋め込みシードと正本CSVの両方**をゲーム内データと突き合わせる（戦国風雲記の `force_list.csv` で起きた事故の予防）。

---

## 2. 画面・UI 設計

### 2.1 画面遷移

```
BootScene（アセット先読み・データ読込）
   ↓
TitleScene ──[続きから]→ MapScene（autosave）
   │
   [新規]
   ↓
ScenarioSelectScene（6シナリオ・年表と情勢図）
   ↓
OpeningScene（開幕の口上・縦書き・スキップ可）
   ↓
FactionSelectScene（playable 勢力・難易度・勝利条件の提示）
   ↓
MapScene ⇄ BattleScene（mode: field / siege / naval）
   │  ⇄ RetsudenScene（人物列伝）
   ↓
ResultScene（勝敗・戦績・年代記）
```

`OpeningScene` を独立させるのは、シナリオ選択の直後に**その年に何が起きているか**を読ませてから
勢力を選ばせるため（三国志・天下三分で「シナリオを選んでも盤面が変わらない」失敗があったため、
シナリオの差を最初に提示する）。

### 2.2 主要UI

| 画面 | UI要素 |
|---|---|
| 上部ステータスバー | 年月（和暦）・季節・家紋・当主・名分・金銭・兵糧・兵士・拠点・朝廷支持・朝敵 |
| 全国図（左上） | 列島全体。国の領有を勢力色で塗り、勢力の名札を置く。選択中の国を破線枠で示す |
| 拡大図（右上） | 選択した国。**拠点アイコン（11種）と街道**、拠点名を表示。下端に選択拠点のステータス帯 |
| 周辺図（右中） | 選択した拠点の周囲。最も寄った段。村までが見える |
| 拠点の詳細（右） | 拠点の絵・種類・国・支配勢力・兵士・規模・防御・領主／**命令（徴兵・出兵）** |
| 拠点一覧（左下） | 選択中の国の全拠点。拠点名／種類／支配勢力／兵士／規模 |
| 時代イベント（中下） | 年表。経過済みは淡色、これからは金色 |
| 勢力と年代記（右下） | 名分順の勢力一覧＋直近のログ |
| コマンドバー（最下部） | 内政・軍事・人事・外交・計略・情報・機能・ターン終了 |

| 名分パネル（Phase 2） | 内訳の分解表示（令旨/院宣/宣旨/官位/神器/評判/朝敵）※ Could C-03 |
| 恩賞パネル（Phase 2） | 恩賞債務の総額・団別内訳・本領安堵/新恩給与の実行 |
| BattleScene（Phase 3-4） | ヘックス盤・部隊士気バー・兵種アイコン・名乗りボタン・（naval）潮向きインジケータ |

> 拠点アイコンは **Canvas のみで描く**（画像アセットに依存しないので、後読みの失敗で白い箱にならない）。
> コマンドバーのうち Phase 1 で機能するのは「情報・機能・ターン終了」。他は押すと開通予定の Phase を告げる。
>
> ### 地図は写真をそのまま使う（決定・2026-08-05）
>
> **三段すべてで `sengoku-japan-map-user-v1.webp` をそのまま拡大して使う。**
> 素材が 1672×941 しかないため、国の拡大図（約7倍）・周辺図（約15倍）ではぼやける。
> これは承知のうえで**写真の質感を優先する**という深澤の判断。
>
> ⚠ **海岸線を抽出してベクターで描き起こす案は一度実装し、差し戻した**（コミット `ee07253` と
> その revert）。鮮明にはなるが地図の見た目が変わってしまうため。**同じ手を再提案しないこと。**
> ぼやけが問題になる場合の残る手は「より大きな地図素材を用意する」か「拡大率の上限を下げる」の2つ。

### 2.3 レイアウト方針

- 黒背景 `#0a0d12` ＋ Glassmorphism カード。アクセントはサイト共通のシアン `#5eead4` / パープル `#a78bfa`
- **勢力色はデータ側の値**（平氏 `#c0392b` 赤 / 源氏系 `#ecf0f1` 白 / 奥州 `#d4af37` 金 / 院 `#8e44ad` 紫）。UI クロームの配色とは分離する
- 見出しは**縦書き**（`drawVerticalLabel` 相当を移植）。和紙質感・墨・金泥のモチーフ
- **サイバーパンク的演出は禁止**（ネオングロウ過多・原色ネオン・SF都市風）
- 全ラベルに日英併記

### 2.4 モバイル対応

戦国風雲記の `IS_TOUCH` 分岐を移植。タップ判定を拡大し、ピンチズーム・ドラッグパンを有効化する。
拠点は**段階表示**（全国図＝国府・館、国の拡大図＝城柵・砦・荘園・寺・神社・関所・町・湊、周辺図＝村）。

---

## 3. データ設計

### 3.1 勢力 `FACTIONS`

```js
{
  id:'taira', nameJP:'平氏', nameEN:'Taira',
  color:'#c0392b', kamon:'ageha',        // 揚羽蝶
  playable:true,
  ai:'aggressive',                        // aggressive|defensive|opportunist|court|clerical
  lord:'taira_kiyomori',                  // 当主の武将ID
  capital:'rokuhara',                     // 本拠の拠点ID
  authority:['jingi','emperor'],          // 保持する権威（3.5）
  victory:'survive_regime'                // 勝利条件キー（4.13）
}
```

第三勢力（`goshirakawa` 院 / `jisha` 寺社 / `suigun_*` 水軍 / `bushi_*` 地方武士団）も同じ形で持ち、
`playable:false` とする。院は `ai:'court'`（常に優勢な側へ権威を貸す）、寺社は `ai:'clerical'`（自領を侵されたときのみ敵対）。

### 3.2 拠点 `KYOTEN`

```js
{
  id:'kokuga_sagami', nameJP:'相模国衙', nameEN:'Sagami Provincial Seat',
  type:'kokuga',            // kokuga | shoen | tachi | minato
  province:'sagami',
  mx:0.6412, my:0.4103,     // ★正規化座標（0..1）— 絶対画素値にしない
  scale:120,                // 種別で意味が変わる（下表）
  defense:35,               // 防御値
  owner:'taira',            // ランタイムで変動
  garrison:0,               // 駐留兵
  bands:[],                 // 駐留武士団ID
  holder:'kuge'             // 荘園のみ: 荘園領主（kuge|jisha|sekkanke|buke）
}
```

**拠点種別11（決定事項G）**。地図を拡大すると順に現れる。`tier` は表示され始める段（0=全国図・1=国の拡大図・2=周辺図）。

| type | 名称 | tier | `scale` の意味 | 役割 |
|---|---|---|---|---|
| `kokufu` | 国府 | 0 | 田数（町）＝税収・動員上限 | 国の政庁。**無血開城の対象** |
| `tachi` | 館 | 0 | 収容兵力の上限 | 武士の本拠。防衛拠点 |
| `kisaku` | 城柵 | 1 | 収容兵力 | 柵と逆茂木の軍事拠点。攻城戦の舞台 |
| `toride` | 砦 | 1 | 収容兵力 | 街道・渡河点を押さえる小拠点 |
| `shoen` | 荘園 | 1 | 田数＝兵糧収穫 | `holder` が `jisha`/`sekkanke` なら接収で名分ペナルティ |
| `tera` | 寺 | 1 | 僧兵 | 寺社勢力。名分に影響 |
| `jinja` | 神社 | 1 | 神人 | 寺社勢力。源氏の氏神は八幡宮 |
| `sekisho` | 関所 | 1 | 守備兵 | 街道の通行料と足止め |
| `minato` | 湊 | 1 | 船数 | 渡海と海戦の起点。水軍の去就で移る |
| `machi` | 町 | 1 | 商業 | 金の産出 |
| `mura` | 村 | 2 | 田数 | 兵糧の底。郎党の住まい |

**街道**は拠点として持たず、**国府どうしを令制国の隣接関係で結んだ線**として描く（七道の近似）。

### 3.3 `kyoten_ichi.csv` スキーマ

**座標は正規化 `MX,MY`（0..1・小数6桁）**。絶対画素値にしない（基本構想 第7.0節・決定事項B）。

```csv
ID,拠点名,種別,国名,MX,MY,規模,防御,荘園領主,S1180,S1183,S1184,S1185A,S1185B,SIF,備考
kokuga_sagami,相模国衙,kokuga,相模,0.641200,0.410300,120,35,,taira,kamakura,kamakura,kamakura,kamakura,taira,
shoen_oyama,大山荘,shoen,丹波,0.512400,0.523100,60,10,jisha,taira,taira,kiso,kamakura,kamakura,taira,興福寺領
tachi_kamakura,鎌倉大倉御所,tachi,相模,0.648900,0.412700,3000,45,,taira,kamakura,kamakura,kamakura,kamakura,taira,
minato_watanabe,渡辺津,minato,摂津,0.498700,0.531200,40,20,,taira,taira,kamakura,kamakura,kamakura,taira,
```

- `S****` 列 = 各シナリオ開始時の支配勢力ID。空欄＝中立
- 取り込みは**追加・更新のみ**とし、行を消しても既存の拠点は消さない（戦国風雲記の `siro_ichi.csv` と同方針）。
  ただし `verify-genpei-kyoten.mjs` が「CSV外の拠点が残存」を**警告として必ず出す**

### 3.4 武士団 `BANDS`

軍事の最小単位。武将ではなく**団**が兵を持つ。

```js
{
  id:'band_miura', nameJP:'三浦党', nameEN:'Miura Band',
  home:'tachi_kinugasa',    // 本領（拠点ID）
  province:'sagami',
  leader:'miura_yoshizumi', // 武将ID
  troops:800,               // 兵数
  faction:null,             // 所属勢力（null=中立）
  hoko:60,                  // 奉公度 0..100
  ando:false,               // 本領安堵済みか
  debt:0,                   // 恩賞債務
  independence:35,          // 独立志向（勧誘の抵抗値 0..100）
  affinity:{'kamakura':20,'taira':-10}  // 勢力別の地縁・因縁
}
```

約70団。うち平氏方15・鎌倉方20・木曽8・甲斐5・奥州6・中立16程度で開始する（1180シナリオ）。

### 3.5 権威 `AUTHORITY`（名分の源）

```js
const AUTHORITY = {
  ryoji:   { nameJP:'以仁王の令旨', value:120, unique:false }, // 複数勢力が保持しうる
  inzen:   { nameJP:'院宣',         value:200, unique:true  },
  senji:   { nameJP:'宣旨',         value:150, unique:true  },
  jingi:   { nameJP:'三種の神器',   value:180, unique:true  },
  emperor: { nameJP:'帝の身柄',     value:150, unique:true  },
  in:      { nameJP:'院の身柄',     value:120, unique:true  },
};
```

`unique:true` の権威は同時に1勢力しか持てない。奪取は拠点占領・イベント・奏請で発生する。

### 3.6 武将 `GENERALS`

```js
{
  id:'minamoto_yoshitsune', nameJP:'源義経', nameEN:'Minamoto no Yoshitsune',
  faction:'kamakura',
  sotsu:78,   // 統率
  kisha:88,   // 騎射
  tachi:82,   // 太刀
  chiryaku:95,// 知略
  kakaku:62,  // 家格 ★名分の獲得効率と勧誘可否に効く
  suiren:70,  // 水練
  born:1159, died:1189,
  portrait:{ atlas:'genpei_a', slot:12 }
}
```

> ⚠ **武将は必ず配列末尾に追加する。** 肖像枠を配列 index で配布するため、途中挿入は
> 後続全員の顔が無言でずれる（例外もエラーも出ない）。
> ⚠ **1180年以前の物故者は `GENERALS` に入れない。** 前史人物は `RETSUDEN_PREHISTORY` の
> テキストのみで扱う（要件 M-38 / M-42）。

### 3.7 シナリオ `SCENARIOS`

```js
{
  id:'s1180', nameJP:'令旨、東国に至る', nameEN:'The Prince\'s Call',
  startYear:1180, startMonth:4, endYear:1190, endMonth:3,   // 最大120ターン（奥州合戦1189まで含む）
  playable:['taira','kamakura','kiso','kai','oshu'],
  recommended:['kamakura','taira'],        // 入門推奨（名分を表裏から学べる）
  csvColumn:'S1180',                        // kyoten_ichi.csv の対応列
  authority:{ taira:['jingi','emperor'], goshirakawa:['in'], kamakura:['ryoji'] },
  bandOverrides:{ 'band_miura':{faction:null,hoko:50} },
  events:['kiyomori_death','nanto_burning','yowa_famine', ...],
  opening:'治承四年四月、以仁王の令旨が諸国の源氏へ流れはじめた。……'
}
```

### 3.8 ランタイム `state`

```js
{
  version:SAVE_VERSION,
  scenario:'s1180', faction:'kamakura', difficulty:'normal',
  year:1180, month:4, turn:1,
  factions:{ taira:{ meibun:0, reputation:0, authority:[...], gold:0, food:0,
                     choteki:false, chotekiUntil:0, courtInfluence:0 }, ... },
  kyoten:{ kokuga_sagami:{ owner:'taira', garrison:120, bands:[] }, ... },
  bands:{ band_miura:{ faction:null, troops:800, hoko:60, ando:false, debt:0, at:'tachi_kinugasa' }, ... },
  generals:{ minamoto_yoshitsune:{ alive:true, injuredUntil:0, at:'tachi_kamakura' }, ... },
  famine:{ active:false, until:0 },
  pendingBattle:null,
  log:[]
}
```

---

## 4. ルール設計（計算式）

以下の係数は初期値。`verify-genpei-balance.mjs`（120ターン×3試行）の結果で調整する。

### 4.1 名分（Legitimacy）

```
meibun(f) = clamp(0, 1000,
      Σ AUTHORITY[a].value  for a in f.authority
    + kakakuBonus(f.lord)          // 家格 0..100 → 0..200
    + f.reputation                 // 評判（可変・下記）
    - (f.choteki ? 400 : 0)        // 朝敵
)

kakakuBonus(lord) = lord.kakaku * 2
```

**評判 `reputation`** は行動の履歴。毎ターン **0 へ 5% 減衰**する（尾を引くが永続しない）。

| 行動 | reputation |
|---|---|
| 寺社領・摂関家領の荘園を接収 | −25 |
| 都・畿内での略奪（兵糧不足時に強制発生） | −60 |
| 寺社への寄進（金50） | +15 |
| 院への献納（金80） | +20 |
| 合戦の大勝（敵の主力を崩す） | +30 |
| 味方武士団の粛清 | −40 |
| 拠点の無血開城に成功 | +10 |

### 4.2 無血開城（国衙のみ）

```
攻側 = meibun(atk)/10 + lord.kakaku*3 + 隣接する自勢力武士団数*4
守側 = meibun(def)/10 + kyoten.defense + garrison/100
開城成功 = 攻側 > 守側 * (1 + rand(-0.15, +0.15))
```

成功時: 戦闘なしで所有権が移る。`reputation +10`。守備兵は四散する。
失敗時: 1ターン消費。同一拠点への再試行は **3ターンの間隔**を空ける。

> これが**本作の最重要ルール**。「名分だけで国衙が開く」が受入基準（要件 5.3）。

### 4.3 朝敵認定

```
前提: 院の身柄 or courtInfluence >= 60、金 200、クールダウン12ターン明け
成立確率 = clamp(0.05, 0.90,
      (meibun(self) - meibun(target)) / 600
    + courtInfluence / 200
    - 0.10 )
```

成立時: `target.choteki = true`, `chotekiUntil = turn + 24`（2年）。
効果: 名分 −400。**毎ターン全武士団に離反判定**（4.4 の decay に +3.0）。
解除: 院宣の奪取、または `chotekiUntil` 到達。同一勢力への再認定は1シナリオ2回まで。

**院影響力 `courtInfluence`（0..100）** は院への働きかけの蓄積。朝敵認定の前提であり、院宣の授受にも効く。

| 行動 | courtInfluence |
|---|---|
| 院への献納（金80） | +12 |
| 京・畿内の国衙を保持（1つにつき毎ターン） | +0.5 |
| 院の身柄を保持 | +2.0 / turn |
| 都・畿内での略奪 | −25 |
| 毎ターンの自然減衰 | −3% |

### 4.4 奉公度と離反

```
毎ターン: band.hoko -= decay
decay = 1.0
      + (band.debt / max(1, 勢力総兵力)) * 8   // 恩賞債務の圧
      + (勢力が朝敵なら 3.0)
      + (本領が敵支配下なら 2.5)
      - (band.ando ? 1.0 : 0)
      - (meibun(f) / 1000) * 1.5

離反判定: hoko < 20 のとき P(離反) = (20 - hoko) / 40
  → 中立化。近傍に高名分の敵勢力があればそちらへ寝返る
```

| 行動 | コスト | 効果 |
|---|---|---|
| **本領安堵** | 名分 −15 | `hoko +12`、`ando = true`（以後 decay −1.0） |
| **新恩給与** | 占領拠点1つを割当 | `hoko +35`、`debt = 0`。以後その拠点の収入の30%が団へ（＝勢力収入減） |
| **粛清** | — | 団を除去。`reputation −40`、他の全団 `hoko −5` |

**恩賞債務の発生**

```
参陣中: debt += troops * 0.02 / turn
合戦勝利: debt += troops * 0.5
拠点占領に貢献: debt += troops * 1.0
```

> **平氏は「配る土地がない」ため debt が減らせず、勝つほど崩れる。**
> 鎌倉は東国の占領地を新恩給与に回せる。この非対称が史実の再現になる。

### 4.5 中立武士団の勧誘

```
説得力 = meibun(f)/10 + lord.kakaku*4
       + 地縁ボーナス（本領が同国 +25 / 隣国 +10）
       + band.affinity[f.id]            // 因縁（正負）
       + 贈与(金)/20                     // 上限 +25
       - band.independence
成功 = 説得力 > 60 * (1 + rand(-0.2, +0.2))
```

成功時 `faction = f, hoko = 45, debt = troops * 0.3`（＝参陣した時点で恩賞を負う）。

### 4.6 経済（兵糧・徴税・季節）

```
収穫 = Σ shoen.scale * 季節係数(month) * (1 - 飢饉係数(region))
消費 = Σ band.troops * 0.01   （遠征中の団は ×2）
税収 = Σ kokuga.scale * 0.05  （毎ターン）
動員上限 = Σ kokuga.scale * 8
```

**季節係数**: 8〜10月＝1.0（収穫期）／11〜3月＝0.05／4〜7月＝0.15
**積雪**（12〜3月）: 奥羽・北陸・東山道の移動力 −40%
**渡海**（4.11）: 11〜2月は失敗率 +25%

**兵糧枯渇**: 全団 `hoko −3/turn`、兵の逃散 `troops −5%/turn`、
かつ**畿内に駐留していると強制的に略奪が発生**（`reputation −60`）。義仲が都で信を失った経路を再現する。

### 4.7 養和の飢饉（要件 M-39）

1180シナリオの **1181年6月〜1182年12月（19ターン）** に強制発生。

| 地域 | 飢饉係数 |
|---|---|
| 西国（山陽・南海・西海） | 0.70 |
| 畿内 | 0.60 |
| 東海・東山 | 0.40 |
| 東国（坂東） | 0.30 |
| 奥羽 | 0.15 |

収穫がほぼ止まるため、遠征は事実上できなくなる。**AI も出兵を停止する**（飢饉中は防衛と内政のみ）。
受入基準は「軍事行動が実際に止まること」（要件 5.3）。

### 4.8 野戦（BattleScene mode:'field'）

ヘックス盤。兵種5種。

| 兵種 | 有効射程 | 威力 | 備考 |
|---|---|---|---|
| 騎射武者 `kisha` | **2〜3** | 高 | **距離1では威力 ×0.35**（密着で騎射が死ぬ）。移動力最大 |
| 徒歩の郎党 `roto` | 1 | 中 | 汎用。地形ペナルティが小さい |
| 弓兵 `yumi` | 2〜4 | 中 | 移動力低。楯持に弱い |
| 楯持 `tate` | 1 | 低 | **被騎射・被弓 −40%**。前線を作る |
| 水手・梶取 `kako` | 1 | 極低 | 陸戦は弱い。海戦（4.9）で本領 |

```
ダメージ = 基礎威力 * (攻.troops/100) * 統率係数 * 兵種係数 * 地形係数 * 距離係数
         * (0.85 + rand()*0.3)
統率係数 = 0.7 + leader.sotsu/200
距離係数 = 騎射なら 距離1:0.35 / 距離2:1.0 / 距離3:0.85
```

**士気による決着（要件 M-30）**

```
被弾: morale -= (dmg / troops) * 40
大将討死: 自軍全部隊 morale -= 35
一騎討ち勝利: 自軍 +18 / 敵軍 -18
morale < 25: 崩れ判定 P = (25 - morale)/50 → 後退
morale < 10: 自動退却
```

**殲滅では終わらない。** 士気で決着させることで「中世の戦は追い散らして終わる」感覚を出す。

### 4.9 名乗りと一騎討ち（要件 M-31）

```
条件: 隣接／双方に武将／その戦闘で3回未満／挑戦側が負傷していない
受諾確率 = 0.35 + (受.tachi/200) + (受.kakaku/300) - (兵力劣勢なら 0.15)
勝敗: 3〜5合。各合 score = tachi + kisha*0.3 + rand(0,40)
     先に2勝差をつけた側が勝ち
敗者: 討死 40% / 負傷 60%（injuredUntil = turn+3、能力 −30%）
```

拒否された場合も**挑戦側の士気 +8**（名乗りを上げた事実が士気を上げる）。

### 4.10 攻城戦（BattleScene mode:'siege'・要件 M-32）

**石垣・水堀・天守は存在しない。** 柵と逆茂木のみ。

- 柵 `saku` / 逆茂木 `sakamogi` を破壊可能な障害ヘックスとして配置する
- 守備側の防御補正 **+25%**（戦国風雲記の城は +60% 相当。**短期決戦になるよう意図的に低くする**）
- **最大10ターン**で攻城側に兵糧切れ判定（`morale −10/turn`）
- 館の `scale` が収容兵力の上限。超過分は篭城できず野戦に出る

### 4.11 渡海・海戦・潮流（BattleScene mode:'naval'・要件 M-33〜M-36）

**渡海（M-33）**

```
条件: 出発地に自勢力の湊があり、船数 >= 部隊の兵数/50
失敗率 = 5% + (11〜2月なら +25%) + (船数不足率 * 40%)
失敗時: 1ターン消費し、兵力 −10%（時化で戻される）
```

湊を1つも持たない勢力は**海を越えられない**。四国・九州・西国への進出は湊の確保が前提になる。

**潮流（M-35）**

```
潮 tide ∈ {'east','west'}。開始向きはシナリオ指定。4ターンごとに反転。
順潮の側: 移動力 +2、射程 +1
逆潮の側: 移動力 −1
```

単位は**船**（`ships`）。各船に武士団を乗せる。`suiren`（水練）が命中と回避に効く。

**水軍勢力の離反（要件 M-36）**

```
毎ターン: P(離反) = clamp(0, 0.25,
      (meibun(敵) - meibun(自)) / 1500
    + 劣勢度 * 0.10 )        // 劣勢度 = 1 - 自船数/総船数
```

離反すると**その水軍の船が敵側に加わる**。壇ノ浦の阿波水軍を再現する。

### 4.12 三種の神器（要件 M-41）

- 平氏が保持。保持側は `AUTHORITY.jingi` により名分 +180
- 壇ノ浦シナリオの決着時、**宝剣は確定で失われる**（史実）。鏡・璽は勝者が回収する
- 鎌倉の勝利条件は「神器の**確保**」であり完全奪還ではない。宝剣喪失は勝利を妨げないが、
  結末テキストで頼朝の不満として提示する

### 4.13 勝利条件（要件 M-05）

| 勢力 | key | 判定 |
|---|---|---|
| 平氏 | `survive_regime` | 1185年12月時点で `emperor` を保持し、朝敵でなく、国衙20以上 |
| 鎌倉 | `bakufu` | 平氏を滅ぼし、`senji` を得て、国衙35以上（＝守護地頭の設置） |
| 木曽 | `seitai_shogun` | 京を占領し `senji` を得て、**朝敵にならずに12ターン維持** |
| 甲斐 | `independent` | 東海道の国衙8以上を保持し、鎌倉に併呑されずに終了時点で存続 |
| 奥州 | `hiraizumi` | 1189年9月まで平泉（`tachi_hiraizumi`）を保持 |

---

## 5. AI 設計

| 性格 | 挙動 |
|---|---|
| `aggressive` | 兵力比1.2倍以上で出兵。名分より領地を優先 |
| `defensive` | 隣接脅威に応じて守備を厚くする。名分獲得と本領安堵を好む |
| `opportunist` | 弱った勢力を狙う。優勢勢力へ寝返りやすい |
| `court`（院） | 戦わない。**毎ターン最も名分の高い勢力へ院宣を貸す**。ただし突出しすぎた勢力には貸さない（勢力均衡を志向） |
| `clerical`（寺社） | 自領の荘園を接収された勢力にのみ敵対。それ以外は中立 |

行動選択は優先度スコア方式:

```
score(出兵)    = 兵力比*30 + 拠点価値*0.5 - 距離*3 - (飢饉中 ? 999 : 0)
score(無血開城)= 開城成功率*80
score(勧誘)    = 説得成功率*60 + band.troops*0.02
score(本領安堵)= (20 - min(hoko,20)) * 5      // 離反寸前ほど優先
score(朝敵認定)= 成立確率*70（対象が最大勢力のとき）
```

> ⚠ **AI の集計値は乱数の種を固定しないため試行ごとに大きく揺れる。**
> バランスを語るときは1回の実行ではなく **5試行以上の平均**で見る（三国志・天下三分の教訓）。

---

## 6. モジュール分割

| モジュール | 責務 | Phase |
|---|---|---|
| `boot` | アセット先読み・データ読込・フォールバック | 1 |
| `data` | `DATA` / `KYOTEN` の構築、CSV パース、埋め込みシード | 1 |
| `map` | カメラ・拠点描画・段階表示・選択・パネル | 1 |
| `turn` | ターン進行・収支の一括更新・イベント発火 | 1 |
| `meibun` | 名分算出・無血開城・朝敵認定・権威の授受 | 2 |
| `hoko` | 奉公度・恩賞債務・離反・粛清・勧誘 | 2 |
| `economy` | 兵糧・徴税・季節・積雪・飢饉 | 2 |
| `combat` | ヘックス核（盤・移動・射線）＋ mode 別ルール表 | 3,4 |
| `duel` | 名乗り・一騎討ち・負傷 | 3 |
| `naval` | 潮流・船・水軍離反 | 4 |
| `ai` | 行動選択・性格別の重み | 1（簡易）→ 2,4（拡張）|
| `ui` | Glassmorphism パネル・縦書き・日英併記 | 全 |
| `save` | localStorage・バージョン検査 | 1 |

`combat` は **mode（field / siege / naval）でルール表を差し替える単一のヘックス核**とする。
3つのシーンに分けるとヘックス移動・射線判定が3重に重複するため。

---

## 7. セーブ仕様

```js
const SAVE_VERSION = 1;
localStorage['genpei_save_v1'] = JSON.stringify(state);
localStorage['genpei_autosave'] = ...;   // ターン終了ごと
```

- 読み込み時に `version !== SAVE_VERSION` なら**破棄して新規開始**。初版のため移行処理は持たない
- 破棄時は**理由を画面に表示する**（黙って消さない）
- `pendingBattle` を含めて保存し、合戦の途中でも復帰できるようにする

---

## 8. 外部依存・アセット

| 種別 | 内容 | ライセンス方針 |
|---|---|---|
| 地図 | `assets/sengoku/` を参照（複製・改変なし） | 自作既存 |
| 家紋 約20種 | 揚羽蝶・笹竜胆・三つ鱗・月星・三つ引両 ほか | 意匠として一般化したもののみ。登録商標に当たるものは使わない |
| 肖像 約115枚 | 大鎧・直垂・水干・僧形・法衣 | 自作生成。未制作分は手描き風のプロシージャル描画に落とす |
| 合戦背景 7枚 / イベント絵 10〜14枚 | 石橋山〜壇ノ浦、清盛の死〜衣川 | 自作生成 |
| 音楽・SE | Web Audio API のプロシージャル生成 | 外部音源を使わない |
| ライブラリ | **なし**（CDN も使わない） | — |
| 引用文 | 『平家物語』『吾妻鏡』『玉葉』等 | **著作権切れの古典のみ**。現代の研究書・小説・映像作品からは引用しない |

- **全画像は WebP q90。解像度は測った値を維持する**
- `drawImage` の source-rect を画素値で直書きしない。矩形は原寸サイズと対で持ち、描画時に実解像度へスケールする
- **Legal-Checker を Evaluator 提出前に必ず通す**（家紋・肖像・引用文）

---

## 9. 検証スクリプト設計

| スクリプト | 検査内容 |
|---|---|
| `verify-genpei-boot.mjs` | タイトル → シナリオ選択 → 勢力選択 → マップ → ターン終了。**`pageerror` と `engine.errors` を合算**して例外0件を確認。`favicon.ico` は 204 を返して黙らせる |
| `verify-genpei-kyoten.mjs` | `kyoten_ichi.csv` **および埋め込みシード**とゲーム内データの突合／全拠点が陸地（湊は海岸）に載っているか／CSV外の拠点の残存を警告／`assets/sengoku/` 参照ファイルの実在 |
| `verify-genpei-balance.mjs` | Rule 層を直接叩いて 120ターン×**5試行**。停止・例外・勢力の全滅・名分の発散がないかを平均で見る |

> ⚠ **タイトル画面が出た＝起動成功ではない。** 描画ループの例外は「背景だけ残ってUIが出ない」形で現れる。
> GameKit は update/draw の例外を捕捉して継続し `engine.errors` に積むため、
> **`pageerror` だけ見る検査は素通りする**（戦国風雲記で3コミット費やした事故）。

---

## 10. 要件トレーサビリティ

[[genpei_要件定義]] の Must 50件が本書のどこで設計されているかの対応表。**未設計の Must はない。**

| 要件 | 設計箇所 |
|---|---|
| M-01 シナリオ定義 | 3.7 `SCENARIOS` |
| M-02 選択可能勢力 | 3.7 `playable` |
| M-03 勢力定義 | 3.1 `FACTIONS` |
| M-04 画面遷移 | 2.1 |
| M-05 勝利・敗北条件 | 4.13 |
| M-06 地図表示 | 1.1（参照）／2.3・2.4 |
| M-07 令制国データ | 1.1 `provinces.json` |
| M-08 拠点CSV | 3.3 `kyoten_ichi.csv` スキーマ（正規化 `MX,MY`）|
| M-09 拠点4種の機能差 | 3.2 の対応表 |
| M-10 占領と支配 | 3.2 `owner`／4.2・4.8 |
| M-11 ターン進行（1ヶ月） | 3.8 `state`／6 `turn` モジュール |
| M-12 AI行動 | 5 |
| M-13 名分リソース | 4.1 |
| M-14 名分の効果 | 4.2・4.4・4.5 |
| M-15 無血開城 | 4.2 |
| M-16 朝敵認定 | 4.3 |
| M-17 名分を得る行動 | 4.1 評判表／4.3 `courtInfluence` 表 |
| M-18 武士団 | 3.4 `BANDS` |
| M-19 本領安堵 | 4.4 |
| M-20 新恩給与 | 4.4 |
| M-21 恩賞債務 | 4.4 |
| M-22 離反・粛清 | 4.4 |
| M-23 勧誘 | 4.5 |
| M-24 兵糧 | 4.6 |
| M-25 徴税・徴兵 | 4.6 |
| M-26 季節 | 4.6 |
| M-27 野戦ヘックス | 4.8 |
| M-28 兵種5種 | 4.8 の兵種表 |
| M-29 騎射の間合い | 4.8 距離係数 |
| M-30 士気による決着 | 4.8 |
| M-31 名乗り・一騎討ち | 4.9 |
| M-32 攻城戦 | 4.10 |
| M-33 渡海 | 4.11 |
| M-34 海戦マップ | 4.11 |
| M-35 潮流 | 4.11 |
| M-36 水軍の去就 | 4.11 |
| M-37 武将データ | 3.6 `GENERALS` |
| M-38 生没年ゲート | 3.6 `born/died` |
| M-39 養和の飢饉 | 4.7 |
| M-40 史実イベント | 3.7 `events`／6 `turn` |
| M-41 神器と安徳天皇 | 3.5 `AUTHORITY`／4.12 |
| M-42 人物列伝 | 2.1 `RetsudenScene`／3.6 `RETSUDEN_PREHISTORY` |
| M-43 家紋 | 8 |
| M-44 肖像 | 3.6 `portrait`／8 |
| M-45 セーブ | 7 |
| M-46 `file://` 対応 | 1.3 |
| M-47 日英併記 | 2.3 |
| M-48 デザイン方針 | 2.3 |
| M-49 タッチ対応 | 2.4 |
| M-50 起動検証 | 9 |

---

## 11. 承認

- [ ] 深澤（PM）承認
- 次工程: `genpei_詳細設計.md`（関数シグネチャ・シーン実装仕様・`kyoten_ichi.csv` の全145行の起こし方）
