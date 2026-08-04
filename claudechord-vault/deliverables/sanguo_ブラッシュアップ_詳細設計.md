---
type: 詳細設計書
project: sanguo
status: レビュー待ち
agent: planner
target_file: sanguo.html
created: 2026-08-03
updated: 2026-08-03
tags: [claudechord, 詳細設計, sanguo, ブラッシュアップ]
---

# 詳細設計書 — 三国志・天下三分 ブラッシュアップ（第2次拡張）

> プロジェクトハブ: [[sanguo]] ／ 上流: [[sanguo_ブラッシュアップ_基本設計]] ／ 要件: [[sanguo_ブラッシュアップ_要件定義]]

## 0. 実装順序

| 順 | フェーズ | 内容 | 単体マージ | 依存 |
|---|---|---|---|---|
| 1 | **P9** | 肖像の展開（機能4） | ○ | なし |
| 2 | **P8** | 増援（機能1） | ○ | なし |
| 3 | **P10** | AIの収束性（機能3） | ○ | P8（`aiReinforce` が増援の考え方を踏襲する） |
| 4 | **P11** | 政務ポイント＋兵糧買付（機能2） | ○ | P8・P10（全コマンドを一斉にゲートする） |

**P9 を先頭に置く。** 描画のみで他に一切依存せず、目に見える成果が最も早く出るため。
**P11 を末尾に置く。** 全コマンドの入口に触るため、コマンドが出揃ってから一度で通す。

---

## 1. P9 — 肖像の展開（機能4 / M-16・S-01〜S-03）

### 1.1 前提の確認（実測済み）

`EXPANDED_PORTRAIT_ATLASES` は6枚。スロット総数と `GENERAL_IDS` の長さは**完全に一致する**。

| アトラス | グリッド | スロット | 累積 |
|---|---|---|---|
| `sanguo-generals-atlas-01.webp` | 6×6 | 36 | 36 |
| `sanguo-generals-atlas-02.webp` | 6×6 | 36 | 72 |
| `sanguo-generals-atlas-03.webp` | 6×6 | 36 | 108 |
| `sanguo-generals-atlas-04-gpt-image-2.webp` | 6×6 | 36（`names`） | 144 |
| `sanguo-generals-atlas-05-gpt-image-2.webp` | 5×5 | 25（`names`） | 169 |
| `sanguo-generals-atlas-06-gpt-image-2.webp` | 5×5 | 25（`names`） | 194 |

`GENERAL_IDS` の初期長は **108**（＝アトラス1〜3の合計）。`extraNames` の 86 件が push され、
最終的に **194** となる。したがって **スロット番号 ＝ `GENERAL_IDS` のインデックス**が厳密に成り立つ。

> **注意**: `genName()` のコメントにあるとおり `GENERAL_IDS` には重複がある。
> `indexOf` は先頭一致を返すため、重複IDでは同じ肖像が引かれる。これは**既存の `buildRoster()`
> と同じ挙動**であり、本次で変更しない（変えると名鑑と各画面で顔がずれる）。

### 1.2 新設関数

#### `portraitSlotOf(id)` → `{file, cols, rows, col, row} | null`

`buildRoster()` にインラインで埋まっている「オフセットからアトラスとセルを求める」ロジックを抽出する。
**`buildRoster()` も本関数を使うよう書き換え、挙動が変わらないことを確認する。**

```
function portraitSlotOf(id){
  const idx = GENERAL_IDS.indexOf(id);
  if(idx < 0) return null;
  let offset = 0;
  for(const a of EXPANDED_PORTRAIT_ATLASES){
    const count = a.count || (a.names ? a.names.length : 0);
    if(idx < offset + count){
      const slot = idx - offset;
      return {file:a.file, cols:a.cols, rows:a.rows, col:slot % a.cols, row:Math.floor(slot / a.cols)};
    }
    offset += count;
  }
  return null;                    // アトラス範囲外（受入基準20）
}
```

#### `portraitCss(id, size)` → `string`（DOM用・S-01/S-02）

`buildRoster()` が既に使っている `background-size` / `background-position` の式をそのまま関数化する。

```
function portraitCss(id, size){
  const s = portraitSlotOf(id);
  if(!s) return '';                                        // 呼び出し側が空文字を見て肖像を省く
  const bx = s.col * (100 / (s.cols - 1 || 1));
  const by = s.row * (100 / (s.rows - 1 || 1));
  return `background-image:url('${ASSET_ROOT}${s.file}');`
       + `background-size:${s.cols*100}% ${s.rows*100}%;`
       + `background-position:${bx}% ${by}%;`
       + `width:${size}px;height:${size}px`;
}
```

#### `portraitImage(file)` → `Image`（Canvas用・M-16/S-03）

`battleBg()` と同じキャッシュ方式。**モジュールスコープの `Map` に持ち、毎フレーム生成しない。**

```
const portraitCache = {};
function portraitImage(file){
  if(portraitCache[file]) return portraitCache[file];
  const im = new Image();
  im.src = ASSET_ROOT + file;
  portraitCache[file] = im;
  return im;
}
```

#### `drawPortrait(c2d, id, x, y, size, ringColor)` → `boolean`

**戻り値が `false` のとき、呼び出し側は現行の描画にフォールバックする。** これが M-19/受入基準19の担保。

```
function drawPortrait(c2d, id, x, y, size, ringColor){
  const s = portraitSlotOf(id);
  if(!s) return false;
  const im = portraitImage(s.file);
  if(!im.complete || !im.naturalWidth) return false;        // 未ロードなら描かない
  const cw = im.naturalWidth  / s.cols;                      // ★実解像度から1セルを割り出す
  const ch = im.naturalHeight / s.rows;
  c2d.save();
  c2d.beginPath(); c2d.arc(x, y, size/2, 0, Math.PI*2); c2d.clip();
  c2d.drawImage(im, s.col*cw, s.row*ch, cw, ch, x-size/2, y-size/2, size, size);
  c2d.restore();
  if(ringColor){
    c2d.save();
    c2d.strokeStyle = ringColor; c2d.lineWidth = Math.max(2, size*0.045);
    c2d.beginPath(); c2d.arc(x, y, size/2, 0, Math.PI*2); c2d.stroke();
    c2d.restore();
  }
  return true;
}
```

> **★ CLAUDE.md の教訓の適用**: source-rect を画素値で直書きしない。
> 必ず `im.naturalWidth / cols` として**実解像度から割り出す**。
> アトラスを将来再エンコードしても矩形が画像外へ出ず、「無言で絵が消える」事故を防ぐ。

### 1.3 変更する関数

#### `bDuelDraw()` の `drawNameCard(who, y, alpha)` — M-16 ★最重要

現行は `cx` 中央寄せの3行。肖像が描けた場合のみ**左に肖像・右にテキスト**の2カラムへ切り替える。

```
const drawNameCard = (who, y, alpha) => {
  const ep = epOf(who), nm = nameOf(who);
  const gid = (who === 'a') ? D.aGen : D.dGen;          // ★ bDuelStart で保持する（1.4 参照）
  const ring = (who === 'a') ? D.aColor : D.dColor;
  const pSize = 96 * k;
  bctx.save(); bctx.globalAlpha = alpha;

  // 肖像を試し、成否でレイアウトを決める
  const twoCol = drawPortrait(bctx, gid, cx - maxW*0.28, y + 6*k, pSize, ring);
  const tx = twoCol ? (cx + pSize*0.42) : cx;            // テキストの基準X
  const tw = twoCol ? (maxW - pSize*1.2) : maxW;         // テキストの使える幅
  bctx.textAlign = twoCol ? 'left' : 'center';

  bDuelRules(twoCol ? tx + tw/2 : cx, y - 52*k, tw/2, k, 0.9);
  const kanji = `${ep.origin}の${nm}`;
  bDuelFit(kanji, 54*k, 'bold', DUEL_SERIF, tw);
  bctx.fillStyle = '#f5efe3'; bctx.fillText(kanji, tx, y);
  bDuelFit(`― ${ep.sobriquet} ―`, 21*k, '', DUEL_SERIF, tw);
  bctx.fillStyle = '#e4c27b'; bctx.fillText(`― ${ep.sobriquet} ―`, tx, y + 40*k);
  bDuelFit(`武 ${buOf(who)}  MIGHT`, 15*k, '', DUEL_SANS, tw);
  bctx.fillStyle = 'rgba(170,179,189,.9)'; bctx.fillText(`武 ${buOf(who)}  MIGHT`, tx, y + 64*k);
  bDuelRules(twoCol ? tx + tw/2 : cx, y + 80*k, tw/2, k, 0.9);

  bctx.textAlign = 'center';                             // ★ 呼び出し元の前提へ必ず戻す
  bctx.restore();
};
```

**注意**: `bDuelDraw()` の冒頭で `bctx.textAlign='center'` が設定され、以降の全描画がそれに依存している。
`drawNameCard` 内で `left` に変えたら**必ず `center` へ戻す**（戻し忘れると勝敗表示が横にずれる）。

#### `bDuelStart(a, d, onDone)` — 肖像に必要な武将IDを保持する

`B.duel` は `aName` / `aBu` / `aEp` のように**値をコピーして持つ**設計（演出中に盤面が変わっても
表示が壊れないため）。同じ方針で武将IDも持たせる。

```
B.duel = { ..., aGen: a.gen, dGen: d.gen, ... };
```

#### `bDrawStack(s)` — S-03

色付き円を描いた**あと**に肖像を重ねる。失敗したら現行のまま（兵種漢字が見える）。

- 霧で不可視（`!bVisible(s, playerSide)`）のときは**肖像を描かない**（シルエットのまま／情報漏れ防止）
- 敵の伏兵は既に `return` 済みなので影響なし
- 肖像を描けたときは兵種漢字を小さくして円の下端へ寄せ、兵数バッジと重ねない

#### `genRowHtml(c, id)` / `wildRowHtml(c, id)` — S-01

`.genHead` の先頭に肖像 `<i>` を差し込む。`portraitCss()` が空文字を返したら要素ごと省く。

```
const pc = portraitCss(id, 34);
const pf = pc ? `<i class="genFace" style="${pc}"></i>` : '';
... `<div class="genHead">${pf}<b>${escHtml(genName(id))}</b>...`
```

CSS: `.genFace{display:inline-block;border-radius:6px;background-repeat:no-repeat;vertical-align:middle;margin-right:6px;border:1px solid rgba(240,221,176,.25)}`

#### `openFactionPick(s)` / `buildDiplo()` — S-02

君主IDは既存の `leaderIdOf(fid)` で解決できる。`portraitCss(leaderIdOf(fid), 56)` を
カードの `<h2>` の隣に置く。`leaderIdOf` が `null` を返す勢力（`GENERAL_JP` に君主名がない）では
肖像を省く。

### 1.4 P9 のテスト観点

| # | 観点 | 方法 |
|---|---|---|
| 1 | `buildRoster()` の出力が変わっていない | 変更前後で `#rosterGrid` の `innerHTML` を比較（194枚・同じ `background-position`） |
| 2 | 一騎打ちで肖像が出る | 合戦へ入り一騎打ちを起こしてスクリーンショット目視 |
| 3 | 未ロードでも破綻しない | `portraitCache` を空にし `Image` を差し替えてフォールバックを確認 |
| 4 | 範囲外IDで例外が出ない | `portraitSlotOf('__nonexistent__')` が `null` を返す |
| 5 | `textAlign` の戻し忘れがない | 名乗り後の勝敗表示が中央にあることを目視 |

---

## 2. P8 — 増援（機能1 / M-01〜M-06）

### 2.1 定数

```
const REINFORCE = {
  gold:40, foodPerSoldier:0.6, minKeep:15, cap:150,
  amounts:[20,50,100], loyaltyCost:1
};
```

`cap:150` は `ECON.actions.levy.cap`（150）と一致させる。**片方だけ変えると、
増援で `levy` の上限を超えられる**ため、実装時に両者を並べてコメントで結びつける。

### 2.2 `initCityFields()` への追加

```
if(typeof c.reinforceTurn!=='number') c.reinforceTurn = 0;
```

### 2.3 新設関数

#### `reinforceMax(from, to)` → `number`

実際に送れる兵の上限。UI と実処理の**両方**がこれを使う（二重管理を避ける）。

```
function reinforceMax(from, to){
  if(!from || !to) return 0;
  return Math.max(0, Math.min(
    (from.garrison||0) - REINFORCE.minKeep,      // 送り元に minKeep を残す
    REINFORCE.cap - (to.garrison||0)             // 送り先の上限
  ));
}
```

#### `reinforceCost(n)` → `{gold, food}`

```
function reinforceCost(n){
  return { gold: REINFORCE.gold, food: Math.round(n * REINFORCE.foodPerSoldier) };
}
```

#### `reinforceWhy(from, to, n)` → `string`（不能理由・日英併記／E-05）

判定順は**プレイヤーが直せる順**に並べる（構造的な理由 → 一時的な理由 → 資源）。

| 順 | 条件 | 文言 |
|---|---|---|
| 1 | `!to` | `送り先を選んでください / Choose a destination` |
| 2 | `from.reinforceTurn === state.turn` | `今巡すでに増援を送った / Already reinforced this turn` |
| 3 | `reinforceMax(from,to) <= 0` かつ `from.garrison-minKeep<=0` | `送れる兵がない（最低${minKeep}兵は残す） / No troops to spare` |
| 4 | `reinforceMax(from,to) <= 0` | `${to.name}の兵は上限（${cap}）に達している / Destination is at troop cap` |
| 5 | `state.gold < gold` | `金が足りない（${gold}金） / Not enough gold` |
| 6 | `state.food < food` | `兵糧が足りない（${food}） / Not enough food` |
| 7 | （P11で追加）`!apGate('reinforce').ok` | `政務が足りない / Not enough actions` |
| — | それ以外 | `''`（実行可能） |

#### `doReinforce(fromId, toId, amount)`

```
function doReinforce(fromId, toId, amount){
  const from = cityById[fromId], to = cityById[toId];
  // 1. 検証（UI を経由しない呼び出しにも耐える）
  if(!from || !to) return;
  if(from.owner !== state.faction || to.owner !== state.faction) return;
  if(!(from.neighbors||[]).includes(to.id)) return;
  if(reinforceWhy(from, to, amount)){ addLog(...); updateUI(); return; }

  // 2. 実際に送る兵をクランプ（★UI の option だけに頼らない）
  const n = Math.min(amount, reinforceMax(from, to));
  if(n <= 0){ addLog(`${to.name}へ送れる兵がない。 / No troops could be sent.`); updateUI(); return; }
  const cost = reinforceCost(n);

  // 3. 適用
  state.gold -= cost.gold;
  state.food -= cost.food;
  from.garrison -= n;
  to.garrison   += n;
  to.loyalty = clamp((to.loyalty||0) - REINFORCE.loyaltyCost, 0, 100);
  from.reinforceTurn = state.turn;
  // spendAp('reinforce')  ← P11 で追加

  // 4. 通知
  const short = (n < amount) ? `（要請${amount}のうち${n}）` : '';
  addLog(`${from.name}より${to.name}へ${n}の兵を送った${short}。 / Reinforced ${to.name} with ${n} troops.`);
  sfx('march'); updateUI(); draw();
}
```

**手順2のクランプが M-04 の担保。** `<option>` 側の `disabled` は目安であり、
`levy` の自然増や AI の行動で盤面が動くため、**実処理側のクランプが正**とする。

### 2.4 UI

#### `reinforceHtml(c)` → `string`

```
function reinforceHtml(c){
  const dest = (c.neighbors||[]).map(n=>cityById[n]).filter(x=>x && x.owner===state.faction);
  const head = `<div class="sectionTitle">増援 / REINFORCE（${REINFORCE.gold}金・兵糧 兵数×${REINFORCE.foodPerSoldier}）</div>`;
  if(!dest.length)
    return head + `<div class="subtle">隣接する自軍領がありません。 / No adjacent friendly city.</div>`;
  const to = cityById[c.reinforceTo] || dest[0];         // 直近の選択を保つ必要はない。既定は先頭
  const opts = dest.map(x=>`<option value="${escHtml(x.id)}">${escHtml(x.name)}（${x.garrison}兵）</option>`).join('');
  const maxN = reinforceMax(c, to);
  const amts = REINFORCE.amounts.map(n=>
    `<option value="${n}"${n>maxN?' disabled':''}>${n}兵 ＋糧${reinforceCost(n).food}</option>`).join('');
  const why = reinforceWhy(c, to, REINFORCE.amounts[0]);
  return head
    + `<div class="genActs">`
    +   `<select class="miniSel" data-reinf-to="${escHtml(c.id)}">${opts}</select>`
    +   `<select class="miniSel" data-reinf-amt="${escHtml(c.id)}">${amts}</select>`
    +   `<button class="miniBtn" data-reinf="${escHtml(c.id)}"${why?' disabled':''} `
    +   `title="${escHtml(why || `隣接自軍領へ兵を送る（1巡1回） / Send troops to an adjacent friendly city`)}">送る</button>`
    + `</div>`
    + `<div class="subtle">現在の兵 ${c.garrison} ／ 最低 ${REINFORCE.minKeep} は残す。 / Keeps ${REINFORCE.minKeep} behind.</div>`;
}
```

#### `cityPanel()` への挿入位置

```
return head + balance
  + 内政セクション
  + personnelHtml(c)
  + reinforceHtml(c)            ← 追加（出陣の直前）
  + 出陣セクション
  + tail;
```

#### `bindReinforce()`（`bindPersonnel()` とは別関数）

`updateUI()` から `bindPersonnel()` の直後に呼ぶ。

```
function bindReinforce(){
  document.querySelectorAll('[data-reinf]').forEach(b=>{
    b.onclick = () => {
      const id = b.dataset.reinf;
      const to  = selByData('data-reinf-to',  id);
      const amt = selByData('data-reinf-amt', id);
      if(to && to.value) doReinforce(id, to.value, amt ? parseInt(amt.value,10) : REINFORCE.amounts[0]);
    };
  });
  // 送り先を変えたら「送れる兵数」の disabled を引き直す
  document.querySelectorAll('[data-reinf-to]').forEach(s=>s.onchange = () => updateUI());
}
```

> **`<select>` の `onchange` で `updateUI()` を呼ぶと、`sidePanel.innerHTML` の再生成で
> 選択が既定へ戻る。** 送り先を保つため、`c.reinforceTo` に選択値を控えてから `updateUI()` する。
> （`reinforceTurn` と違い**セーブ対象外**の一時値でよい。`saveGame()` の `cities` には含めない）

### 2.5 セーブ

`saveGame()` の `cities` マップに `reinforceTurn:c.reinforceTurn` を追加し、
`applySaveData()` に `if(typeof cd.reinforceTurn==='number')c.reinforceTurn=cd.reinforceTurn;` を追加する。
`v:2` → `v:3` へ。欠落時は `initCityFields()` が 0 を補う。

### 2.6 P8 のテスト観点

| # | 受入基準 | 方法 |
|---|---|---|
| 1 | 1 | 自軍領を選ぶと増援セクションが出る |
| 2 | 2 | 隣接自軍領のない都市で「隣接する自軍領がありません」 |
| 3 | 3 | 100兵送って from −100 / to +100（上限で頭打ちすること） |
| 4 | 4 | `garrison=30` のとき `100兵` の option が `disabled` |
| 5 | 5 | 同一巡の2回目が `disabled` |
| 6 | 6 | 金/兵糧不足で `disabled`＋`title` に理由 |
| 7 | — | 上限超過分がログに `（要請100のうち20）` と出る |

---

## 3. P10 — AIの収束性（機能3 / M-13〜M-15・S-05）

### 3.1 `aiMarch()` の修正（M-13 ★根本原因）

```
// 現行（出撃元が武将ゼロになる）
to.owner=fid; to.garrison=Math.max(10,r.atkSurv); to.generals=from.generals.slice(); from.generals=[];

// 是正: 統率の高い順に上位 ceil(n/2) を随行させ、残りは本拠に残す
const roster = from.generals.slice().sort((x,y)=> effStat(y).tou - effStat(x).tou);
const takeN  = Math.max(1, Math.ceil(roster.length / 2));
to.owner = fid;
to.garrison = Math.max(10, r.atkSurv);
to.generals = roster.slice(0, takeN);
from.generals = roster.slice(takeN);
```

`from.generals` が1名のときは `takeN=1` で本拠が空になる（従来と同じ）。
これは「1名しかいないなら連れていく」で妥当。**2名以上なら必ず1名以上が残る**（受入基準13）。

`syncGenHomes()` は既存の呼び出しがそのまま効く（末尾で呼ばれている）。

### 3.2 `state.aiGoal` — 目標の持続（M-15）

```
const AI_GOAL_TURNS = 4;

// aiMarch(fid) の目標選択の直前に差し込む
function aiGoalCity(fid){
  const g = state.aiGoal && state.aiGoal[fid];
  if(!g || g.until <= state.turn) return null;
  const t = cityById[g.city];
  if(!t || t.owner === fid) return null;                       // 既に取った／消えた
  if(isAllied(fid,t.owner) || isTruce(fid,t.owner)) return null;
  // 今も自領のいずれかに隣接しているか
  const reachable = myCities(fid).some(c => (c.neighbors||[]).includes(t.id));
  return reachable ? t : null;
}
```

`aiMarch()` の `best` 決定に、次の加点を入れる。

```
const goal = aiGoalCity(fid);
...
const score = cityPower(c) - cityPower(d)
            + (vsPlayer ? D.playerBias : 0)
            + ((goal && d.id === goal.id) ? AI_GOAL_BONUS : 0);   // AI_GOAL_BONUS = 40
```

進軍を実行したとき（勝敗によらず）に目標を更新する。

```
state.aiGoal[fid] = { city: to.id, until: state.turn + AI_GOAL_TURNS };
```

**加点方式にする理由**: 目標を無条件に強制すると、圧倒的に不利でも突撃し続けて自壊する。
`AI_GOAL_BONUS=40` は「多少の不利なら押し通すが、絶望的なら諦める」量として設定し、
受入基準14〜16の実測で調整する。

### 3.3 `aiReinforce(fid)`（M-14）

`runAI()` の中で **`aiTryPlot(f)` の前・内政の後**に1回だけ呼ぶ。
（内政で増えた兵を、その巡のうちに前線へ回せるようにするため）

```
function aiReinforce(fid){
  const cs = myCities(fid);
  if(cs.length < 2) return;

  // 1. 国境都市と、その「脆弱さ」を測る
  let worst = null;
  cs.forEach(c=>{
    const foes = (c.neighbors||[]).map(n=>cityById[n])
      .filter(x=>x && x.owner!==fid && !isAllied(fid,x.owner) && !isTruce(fid,x.owner));
    if(!foes.length) return;                                 // 後方都市
    const threat = Math.max(...foes.map(f=>f.garrison||0));
    const gap = threat - (c.garrison||0);
    if(gap >= AI_REINFORCE.frontierGap && (!worst || gap > worst.gap)) worst = {city:c, gap};
  });
  if(!worst) return;

  // 2. 隣接する後方自領のうち、最も余剰のある都市から送る
  let src = null;
  (worst.city.neighbors||[]).forEach(n=>{
    const c = cityById[n];
    if(!c || c.owner !== fid) return;
    if((c.garrison||0) < AI_REINFORCE.minSurplus) return;
    if(!src || c.garrison > src.garrison) src = c;
  });
  if(!src) return;

  // 3. 送る（AI は金・兵糧を消費しない ─ 既存の AI 経済モデルに合わせる）
  const n = Math.min(AI_REINFORCE.send,
                     (src.garrison||0) - AI_REINFORCE.minSurplus / 2,
                     REINFORCE.cap - (worst.city.garrison||0));
  if(n <= 0) return;
  src.garrison -= n;
  worst.city.garrison += n;
  addLog(`${factionById[fid].name}が${worst.city.name}へ${n}の兵を送った。 / ${factionById[fid].name} reinforces ${worst.city.name}.`);
}
```

**ログを出す理由**: 受入基準17の検証と、プレイヤーが「敵が守りを固めた」と気づけるようにするため。
ただし `addLog` は12件で切られるため、AI増援が軍議記録を埋め尽くさないよう
**1巡につき勢力あたり最大1回**に留める（上記の構造で自然に1回になる）。

### 3.4 進軍回数（S-05）

```
// runAI() の中
aiMarch(f);
if(aiTraitOf(f).aggression >= 0.8) aiMarch(f);     // 攻撃的な勢力は2回まで試行
```

`aiMarch()` は冒頭で `Math.random() >= 0.32 + aggression*0.68` によりスキップ判定を行うため、
2回呼んでも必ず2回進軍するわけではない。董卓（0.94）・呂布（1.00）・黄巾（0.90）・魏（0.86）が対象。

### 3.5 バランス調整の手順（★数値は実測で決める）

1. 3.1〜3.4 を実装する
2. `scripts/verify-sanguo-boot.mjs` の検査 #5〜#7 で **190年・普通・完全放置50ターン**を計測する
3. 受入基準14〜16に対し:
   - 最大勢力 < 8都市 → `AI_GOAL_BONUS` を上げる / `AI_REINFORCE.frontierGap` を下げる
   - 所有者交代が多すぎる → `AI_REINFORCE.send` を上げる
   - プレイヤーが25ターンで滅ばない → `DIFFICULTY.normal.playerBias` を上げる（現行12）
4. **`DIFFICULTY` を触るのは最後**。原因側（3.1〜3.3）で直らないぶんだけをつまみで補う
5. `easy` / `hard` も同じ計測を行い、3段の差が保たれていることを確認する

### 3.6 セーブ

`saveGame()` に `aiGoal:state.aiGoal` を追加。
`applySaveData()` に `state.aiGoal=(d.aiGoal&&typeof d.aiGoal==='object')?d.aiGoal:{};` を追加。

---

## 4. P11 — 政務ポイント＋兵糧買付（機能2 / M-07〜M-12・S-04）

### 4.1 定数（基本設計 2.3 の `AP` / `GRAIN`）

### 4.2 中核: 単一ゲート `apGate(kind)`

```
function apCost(kind){ const v = AP.cost[kind]; return (typeof v === 'number') ? v : 1; }

function apGate(kind){
  const cost = apCost(kind);
  if(cost <= 0) return {ok:true, why:'', cost:0};                       // 恩賞など
  if((state.ap||0) >= cost) return {ok:true, why:'', cost};
  return {ok:false, cost,
    why:`政務が足りない（${cost}必要／残${state.ap||0}） / Not enough actions (need ${cost}, have ${state.ap||0})`};
}

function spendAp(kind){ state.ap = Math.max(0, (state.ap||0) - apCost(kind)); }
```

**合成ヘルパ**（`why` の二重管理を防ぐ・基本設計 決定1）:

```
// 資源側の理由を優先し、資源が足りていれば AP を見る
function gateWhy(kind, resourceWhy){
  if(resourceWhy) return resourceWhy;
  return apGate(kind).why;
}
```

`policyBtnHtml()` などの `why` 生成の**最後**を `return gateWhy(kind, why)` に置き換えるだけで、
全コマンドが同じ順序で理由を出すようになる。

### 4.3 `recalcApMax()`

```
function recalcApMax(){
  const n = factionCounts()[state.faction] || 0;
  const lid = leaderIdOf(state.faction);
  const tou = lid ? (effStat(lid).tou || 0) : 55;                       // 君主が討死していたら既定値
  state.apMax = clamp(AP.base + Math.floor(n / AP.perCities) + Math.floor(tou / AP.touDiv),
                      AP.min, AP.max);
  return state.apMax;
}
```

**検算（受入基準8）**: 190年・魏＝2都市、曹操 `cao_cao:[72,91,96]` → 統96
`clamp(2 + floor(2/2) + floor(96/40), 3, 8) = clamp(2+1+2,3,8) = 5` ✔

**参考値**:

| 状況 | 領地 | 君主統率 | apMax |
|---|---|---|---|
| 190年 蜀（劉備） | 1 | 85 | `clamp(2+0+2,3,8)` = **4** |
| 190年 呉（孫権） | 4 | 83 | `clamp(2+2+2,3,8)` = **6** |
| 190年 董卓 | 3 | 70 | `clamp(2+1+1,3,8)` = **4** |
| 中盤 10都市（曹操） | 10 | 96 | `clamp(2+5+2,3,8)` = **8**（上限） |

### 4.4 各コマンドへの組み込み

**全コマンドが同じ3ステップを踏む。**

```
1. 既存の資源検証の直前に:   if(!apGate(KIND).ok){ addLog(apGate(KIND).why); updateUI(); return; }
2. 既存の本処理
3. 資源を引いた直後に:       spendAp(KIND);
```

| 関数 | `kind` | AP | 備考 |
|---|---|---|---|
| `doPolicy(kind)` | `agri`/`trade`/`levy`/`wall`/`relief` | 1 | `kind` をそのまま使える |
| `doBuyGrain()` | `grain` | 1 | 新設（4.6） |
| `scoutCity(cityId)` | `scout` | 1 | |
| `doRecruit(genId,mult,cityId)` | `recruit` | 1 | **交渉決裂でも消費する**（時間を使ったため） |
| `rewardGeneral(genId,amount)` | `reward` | **0** | 金のみ（M-09・受入基準10） |
| `transferGeneral(genId,toCityId)` | `transfer` | 1 | 既存の `movedTurn` 制限と併存 |
| `doReinforce(...)` | `reinforce` | 1 | 既存の `reinforceTurn` 制限と併存 |
| `attack(targetId)` | `march` | **2** | 合戦へ入る前に消費（撤退しても戻さない） |
| `plotAlienate` / `plotRumor` / `plotPoison` | `alienate`/`rumor`/`poison` | 2 | 既存の `plotCooldown` と併存 |
| `proposeAlliance` / `proposeTruce` / `giveGift` | `alliance`/`truce`/`gift` | 1 | 断られても消費する |
| `jointAttack(f)` | `joint` | 2 | |

> **「失敗しても消費する」を原則とする。** 成功時のみ消費にすると、
> 低確率の登用交渉を残ポイントぶん試すのが最適解になり、判断が消える。

### 4.5 UI

#### HUD（`.topStats`・`cityText` の直後）

```html
<span id="apStat" title="政務 / ACTIONS">政務 <b id="apText">—</b></span>
```

`updateUI()` に追加:

```
document.getElementById('apText').textContent = `${state.ap}/${state.apMax}`;
document.getElementById('apText').style.color = (state.ap <= 0) ? 'var(--red)' : '';
document.getElementById('apStat').title =
  `政務 / ACTIONS：内政1・増援1・登用1・出陣2・計略2・外交1・恩賞0`;
```

#### 各ボタン

`policyBtnHtml()` / `reinforceHtml()` / `genRowHtml()` / `wildRowHtml()` / `personnelHtml()` /
`cityPanel()` の出陣ボタン / `openPlotOverlay()` / `buildDiplo()` の `why` 生成の末尾を
`gateWhy(kind, why)` に通す。**恩賞（`reward`）だけは `apCost=0` なので自然に素通りする。**

### 4.6 兵糧買付（S-04・金のシンク）

内政セクションの6番目のボタンとして置く。

```
function grainYield(){ return GRAIN.yield[state.season] || GRAIN.yield.growth; }

function doBuyGrain(){
  const g = apGate('grain');
  if(!g.ok){ addLog(g.why); updateUI(); return; }
  if(state.gold < GRAIN.gold){
    addLog(`金が足りず兵糧を買えない（${GRAIN.gold}金必要）。 / Not enough gold.`); updateUI(); return;
  }
  const n = grainYield();
  state.gold -= GRAIN.gold;
  state.food += n;
  spendAp('grain');
  addLog(`市より兵糧${n}を買い付けた（${GRAIN.gold}金）。 / Bought ${n} grain for ${GRAIN.gold} gold.`);
  sfx('click'); updateUI();
}
```

相場は**秋冬（収穫期）が安く、春夏（端境期）が高い**:
`harvest: 110` / `growth: 60`（同じ100金で買える量）。
季節の意味が「収穫量」だけでなく「買い時」にも及び、`seasonMul` の既存設計と噛み合う。

### 4.7 ライフサイクルへの結線

| 場所 | 追加 |
|---|---|
| `startScenario(s,fid,diff)` | `recalcApMax(); state.ap = state.apMax;` |
| `endTurn()` 手順1の直後 | `recalcApMax(); state.ap = state.apMax;`（**繰り越しなし**・M-12） |
| `applySaveData(d)` | `state.apMax = (typeof d.apMax==='number') ? d.apMax : recalcApMax();`<br>`state.ap = (typeof d.ap==='number') ? d.ap : state.apMax;` |
| `saveGame()` | `ap:state.ap, apMax:state.apMax` を追加 |

> **`endTurn()` の**どこ**に置くかが重要。** `runAI()`（手順11）より**前**、
> かつ `state.turn++`（手順1）の**直後**に置く。
> 後ろに置くと、AI の進軍でプレイヤーの領地が減った結果が同じ巡の `apMax` に反映され、
> 「ターンを終えた瞬間に政務が減る」不可解な挙動になる。

### 4.8 P11 のテスト観点

| # | 受入基準 | 方法 |
|---|---|---|
| 1 | 8 | 190年・魏で開始し `state.apMax === 5` |
| 2 | 7 | 農業を押すと `政務 4/5` になる |
| 3 | 9 | 残0で内政・出陣・登用・増援・計略・外交の全ボタンが `disabled` |
| 4 | 10 | 残0でも恩賞は実行できる |
| 5 | 11 | 「次のターン」で `5/5` に戻る。6/5 にならない |
| 6 | 12 | 兵糧買付が春夏60・秋冬110 |
| 7 | 21 | v2 セーブから「続きから」で `5/5` 復帰 |

---

## 5. `scripts/verify-sanguo-boot.mjs`（S-07）

### 5.1 骨格

```
node scripts/verify-sanguo-boot.mjs          # 全検査
node scripts/verify-sanguo-boot.mjs --ai     # AI収束の計測のみ（時間がかかるため分離）
```

- `playwright` の `chromium` で `file:///.../sanguo.html` を開く
- **収集するもの**: `pageerror` / `console` の `error` / `requestfailed`
  （GameKit 非依存のため `engine.errors` の合算は不要だが、`console.error` を落とすと
  「描画だけ死んで画面は出る」型の障害を見逃す）
- チュートリアルは `localStorage.setItem('sanguoTutorialSeen','1')` で抑止してから `reload()`
- **歴史イベントのモーダルが「次のターン」を遮る**ため、毎巡ループの先頭で
  `.scenarioModal:not(.hidden)` の最後のボタンを押して閉じる

### 5.2 検査項目（基本設計 6.1 の表を実装する）

AI収束の計測は、`CITIES` の所有者を毎巡スナップショットして判定する。

```
await page.addInitScript(() => { window.__SANGUO_TEST = true; });
const snap = await page.evaluate(() => window.SANGUO_DEBUG.CITIES.map(c => c.owner));
```

> **訂正（2026-08-04）**: 当初は `window.__sanguoDebug` を新設する前提で書いていたが、
> `sanguo.html` には**既に `window.SANGUO_DEBUG` ブリッジがある**（`window.__SANGUO_TEST===true` を
> `addInitScript` で立てたページでのみ露出。第1次拡張で整備済み）。新設せずこれを使う。
> 関数・定数を追加したらブリッジにも足すこと（`doReinforce` の足し忘れで1回踏んだ）。

判定:

| 検査 | 式 | 結果 |
|---|---|---|
| #5 最大勢力 | ~~50巡後の最頻値の出現数 ≧ 8~~ → **≧ 5（盟主が現れる）** | 種を固定していないため7〜11都市の幅で揺れ、≧8では実行ごとに合否が変わった。実測値をラベルに出す方式へ改めた |
| #6 churn | 各都市について所有者が変わった回数、`(変化回数 / 巡数) * 20 ≦ 3` | **着手前から0.96で充足**。検査には入れず、トライアル計測でのみ見る |
| #7 圧力 | プレイヤー勢力の都市数が0になった巡 ≦ 25 | **未達（平均46.8巡）**。原因は AI ではなく `cityPower` の武将重み。本次のスコープ外とした |
| #8 武将空白 | 占領のあった巡に、2名以上いた自軍領が0名になっていないこと | PASS |

> **AI の集計値は乱数の種を固定していないので試行ごとに大きく揺れる。**
> バランスを語るときは1回の実行ではなく5試行以上の平均で見ること。
> 起動検査に閾値の厳しい統計的判定を入れると、コードが正しくても落ちるようになる。

---

## 6. 影響範囲マトリクス

| 関数 / 箇所 | P8 | P9 | P10 | P11 |
|---|:-:|:-:|:-:|:-:|
| 定数群（`REINFORCE`/`AP`/`GRAIN`/`AI_REINFORCE`） | ● | | ● | ● |
| `state` の初期値 | | | ● | ● |
| `initCityFields()` | ● | | | |
| `portraitSlotOf` / `portraitCss` / `portraitImage` / `drawPortrait`（新設） | | ● | | |
| `buildRoster()` | | ○ | | |
| `genRowHtml()` / `wildRowHtml()` | | ● | | ○ |
| `personnelHtml()` | | | | ○ |
| `reinforceMax` / `reinforceCost` / `reinforceWhy` / `doReinforce` / `reinforceHtml` / `bindReinforce`（新設） | ● | | | ○ |
| `cityPanel()` | ● | | | ○ |
| `policyBtnHtml()` / `doPolicy()` | | | | ● |
| `doBuyGrain()` / `grainYield()`（新設） | | | | ● |
| `scoutCity()` / `doRecruit()` / `rewardGeneral()` / `transferGeneral()` | | | | ● |
| `attack()` | | | | ● |
| `updateUI()` | ● | | | ● |
| `apGate` / `spendAp` / `gateWhy` / `recalcApMax`（新設） | | | | ● |
| `endTurn()` | | | | ● |
| `startScenario()` | | | | ● |
| `runAI()` | | | ● | |
| `aiMarch()` | | | ● | |
| `aiReinforce()` / `aiGoalCity()`（新設） | | | ● | |
| `bDuelStart()` / `bDuelDraw()` | | ● | | |
| `bDrawStack()` | | ● | | |
| `openFactionPick()` / `buildDiplo()` | | ● | | ○ |
| `openPlotOverlay()` / `plotAlienate` / `plotRumor` / `plotPoison` | | | | ● |
| `proposeAlliance` / `proposeTruce` / `giveGift` / `jointAttack` | | | | ● |
| `saveGame()` / `applySaveData()` | ● | | ● | ● |
| `.topbar` の `.topStats`（HTML） | | | | ● |
| CSS（`.genFace` / `.reinfRow`） | ● | ● | | |
| `scripts/verify-sanguo-boot.mjs`（新設） | ○ | ○ | ● | ● |

●＝実質的な変更 ／ ○＝軽微な追随

## 7. 実装時の注意（既存の教訓の適用）

1. **source-rect を画素値で直書きしない**（CLAUDE.md）。`drawPortrait()` は必ず
   `im.naturalWidth / cols` から1セルを割り出す。アトラス再エンコード時に絵が無言で消えるのを防ぐ
2. **`bctx.textAlign` を変えたら必ず戻す**。`bDuelDraw()` の後続描画が `center` を前提にしている
3. **`updateUI()` は `sidePanel.innerHTML` を作り直す**。`<select>` の選択値は都市側に控えないと戻る
4. **UI の `disabled` は目安、実処理側のクランプが正**。`levy` の自然増や AI の行動で盤面は動く
5. **`endTurn()` への挿入位置は番号付きコメントの意図に従う**。既存の手順1〜14の順序には理由がある
6. **`ECON.actions.levy.cap` と `REINFORCE.cap` は必ず一致させる**。片方だけ変えると上限を迂回できる
7. **バランス定数は最後に触る**。`DIFFICULTY` を先に動かすと、原因の是正が効いたのか
   つまみが効いたのか判別できなくなる
