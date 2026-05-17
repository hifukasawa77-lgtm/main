# 詳細設計書 — City Builder ブラッシュアップ

**作成日:** 2026-05-17
**参照:** city_builder_req.md / city_builder_basic.md

---

## 1. ファイル構成

既存の `city.html` を直接編集する（単一ファイル完結）。
セクション構造は以下の順で並べること。

```
<!DOCTYPE html>
<html lang="ja">
<head>
  <!-- CSS (<style> タグ) -->
</head>
<body>
  <!-- HTML構造 -->
  <script>
    // ① CONSTANTS
    // ② STATE
    // ③ INFRA NETWORK (UnionFind + computeNetwork)
    // ④ SIMULATION TICK
    // ⑤ VEHICLES
    // ⑥ EVENTS
    // ⑦ DRAWING
    // ⑧ INPUT
    // ⑨ UI
    // ⑩ GAME LOOP
  </script>
</body>
</html>
```

---

## 2. タイルタイプ定数（T オブジェクト拡張）

現行の `T = { EMPTY:0, ROAD:1, RES1:2, ... IND3:10 }` を以下に置き換える。

```javascript
const T = {
  // 既存
  EMPTY:   0,
  ROAD:    1,
  RES1:    2,  RES2:  3,  RES3:  4,
  COM1:    5,  COM2:  6,  COM3:  7,
  IND1:    8,  IND2:  9,  IND3: 10,

  // 交通 (M-03, S-01)
  RAIL:   11,  // 線路
  STATION:12,  // 駅
  AIRPORT:13,  // 空港 (Should)

  // インフラ (M-04, M-05)
  POWER:  14,  // 発電所
  PLINE:  15,  // 送電線
  WATER:  16,  // 水道管

  // インフラ (Should)
  GAS:    17,  // ガス管
  NUCLEAR:18,  // 原子力発電所

  // 公共施設 (M-07, M-06, M-09)
  PARK:   19,  // 公園
  POLICE: 20,  // 警察署
  FIRE_ST:21,  // 消防署

  // 損傷状態
  ROAD_BROKEN: 22,  // 破損道路（地震後）
};
```

---

## 3. 施設・ツール一覧表

### 3-1. 基本施設

| T定数 | 名前（日/英） | 配置コスト | 年維持費 | 効果 | 備考 |
|-------|-------------|-----------|---------|------|------|
| T.ROAD | 道路 / Road | $100 | $2 | 施設の接続インフラ | 車が走る前提 |
| T.RES1 | 住宅Lv1 / Residence | $300 | $2 | 人口+2/年 | 道路+電力+水道要 |
| T.RES2 | 住宅Lv2 | (自動升格) | $4 | 人口+5/年 | - |
| T.RES3 | 住宅Lv3 | (自動升格) | $8 | 人口+10/年 | - |
| T.COM1 | 商業Lv1 / Commerce | $400 | $2 | 収入+15/年 | 道路+住宅隣接+電力+水道要 |
| T.COM2 | 商業Lv2 | (自動升格) | $4 | 収入+35/年 | - |
| T.COM3 | 商業Lv3 | (自動升格) | $8 | 収入+70/年 | - |
| T.IND1 | 工業Lv1 / Industry | $350 | $3 | 収入+25/年, 公害+10 | 電力要 |
| T.IND2 | 工業Lv2 | (自動升格) | $6 | 収入+50/年, 公害+20 | - |
| T.IND3 | 工業Lv3 | (自動升格) | $12 | 収入+100/年, 公害+40 | - |

### 3-2. 交通施設

| T定数 | 名前（日/英） | 配置コスト | 年維持費 | 効果 | 備考 |
|-------|-------------|-----------|---------|------|------|
| T.RAIL | 線路 / Rail | $150 | $3 | 電車の走行経路 | 単独では機能しない |
| T.STATION | 駅 / Station | $800 | $10 | 人口+10/年, 幸福+5 | 線路接続必要, 電力要 |
| T.AIRPORT | 空港 / Airport | $3000 | $50 | 収入+500/年 | 広いスペース推奨 (Should) |

### 3-3. インフラ施設

| T定数 | 名前（日/英） | 配置コスト | 年維持費 | 効果 | 備考 |
|-------|-------------|-----------|---------|------|------|
| T.POWER | 発電所 / Power Plant | $1000 | $20 | 隣接送電線から電力供給開始 | 接続数上限なし |
| T.PLINE | 送電線 / Power Line | $80 | $1 | 電力ネットワークを延伸 | 施設タイルに隣接で供給 |
| T.WATER | 水道管 / Water Pipe | $60 | $1 | 水道ネットワークを延伸 | 端点不要（マップ端から供給） |
| T.GAS | ガス管 / Gas Pipe | $70 | $1 | ガスネットワーク延伸 (Should) | 同上 |
| T.NUCLEAR | 原子力発電所 / Nuclear | $5000 | $100 | 大電力供給。年0.5%でメルトダウン (Should) | - |

### 3-4. 公共施設

| T定数 | 名前（日/英） | 配置コスト | 年維持費 | 効果 | 備考 |
|-------|-------------|-----------|---------|------|------|
| T.PARK | 公園 / Park | $500 | $5 | 人口+3/年, 幸福+8 | 電力・水道不要 |
| T.POLICE | 警察署 / Police | $1200 | $25 | 犯罪率-20%, 事故率-10% | 電力要 |
| T.FIRE_ST | 消防署 / Fire Station | $1000 | $20 | 隣接6タイル以内の火災を鎮火 | 電力要 |

---

## 4. 定数テーブル（JavaScript コード仕様）

```javascript
// 配置コスト（初期配置時のみ消費）
const PLACE_COST = {
  [T.ROAD]:    100, [T.RES1]:   300, [T.COM1]:   400, [T.IND1]:   350,
  [T.RAIL]:    150, [T.STATION]:800, [T.AIRPORT]:3000,
  [T.POWER]:  1000, [T.PLINE]:   80, [T.WATER]:   60, [T.GAS]:    70,
  [T.NUCLEAR]:5000, [T.PARK]:   500, [T.POLICE]: 1200, [T.FIRE_ST]:1000,
};

// 年間維持費
const MAINT = {
  [T.ROAD]:2, [T.RES1]:2, [T.RES2]:4, [T.RES3]:8,
  [T.COM1]:2, [T.COM2]:4, [T.COM3]:8,
  [T.IND1]:3, [T.IND2]:6, [T.IND3]:12,
  [T.RAIL]:3, [T.STATION]:10, [T.AIRPORT]:50,
  [T.POWER]:20, [T.PLINE]:1, [T.WATER]:1, [T.GAS]:1,
  [T.NUCLEAR]:100, [T.PARK]:5, [T.POLICE]:25, [T.FIRE_ST]:20,
};

// 人口増加（住宅系のみ）
const POP_GAIN = { [T.RES1]:2, [T.RES2]:5, [T.RES3]:10, [T.STATION]:10, [T.PARK]:3 };

// 商業収入
const COM_INC = { [T.COM1]:15, [T.COM2]:35, [T.COM3]:70, [T.AIRPORT]:500 };

// 工業収入
const IND_INC = { [T.IND1]:25, [T.IND2]:50, [T.IND3]:100 };

// 工業公害
const IND_POL = { [T.IND1]:10, [T.IND2]:22, [T.IND3]:44 };

// 幸福度ボーナス（タイルあたり）
const HAPPINESS_BONUS = { [T.PARK]:8, [T.STATION]:5 };
const HAPPINESS_PENALTY = { /* 犯罪・事故・火災は crimeRate, fireTimer から計算 */ };

// 升格テーブル（既存と同様）
const XP_MAX = {
  [T.RES1]:30, [T.RES2]:80, [T.COM1]:40, [T.COM2]:100, [T.IND1]:50, [T.IND2]:120
};
const NEXT_T = {
  [T.RES1]:T.RES2, [T.RES2]:T.RES3,
  [T.COM1]:T.COM2, [T.COM2]:T.COM3,
  [T.IND1]:T.IND2, [T.IND2]:T.IND3,
};

// インフラ分類セット
const POWERED_BY = new Set([T.PLINE, T.POWER, T.NUCLEAR]); // 電力ネットワーク要素
const POWER_SRC  = new Set([T.POWER, T.NUCLEAR]);            // 電力源
const WATER_SRC  = null; // 水道はマップ端=供給源（特別処理）
const NEEDS_POWER = new Set([
  T.RES1,T.RES2,T.RES3, T.COM1,T.COM2,T.COM3,
  T.IND1,T.IND2,T.IND3, T.STATION, T.POLICE, T.FIRE_ST
]);
const NEEDS_WATER = new Set([
  T.RES1,T.RES2,T.RES3, T.COM1,T.COM2,T.COM3
]);

// 乗り物
const RAIL_SET   = new Set([T.RAIL, T.STATION]);
const ROAD_SET   = new Set([T.ROAD]);
```

---

## 5. インフラネットワーク実装方針

### 5-1. 電力ネットワーク（BFS方式）

`computeNetwork()` 関数を `tick()` の先頭で呼び出す。

```
アルゴリズム:
1. 全セルの powered = false にリセット
2. 発電所タイル（T.POWER, T.NUCLEAR）をキューに積む
3. BFS で隣接する T.PLINE と NEEDS_POWER タイルを辿る
4. 辿ったタイルに powered = true を設定
```

```javascript
function computePowerNetwork() {
  // 全リセット
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      grid[r][c].powered = false;

  const queue = [];
  // 発電所を起点に積む
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (POWER_SRC.has(grid[r][c].type)) {
        grid[r][c].powered = true;
        queue.push([r, c]);
      }

  // BFS
  while (queue.length) {
    const [r, c] = queue.shift();
    for (const [dr, dc] of DIRS4) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      const nb = grid[nr][nc];
      if (nb.powered) continue;
      // 送電線、または電力が必要な施設タイルに伝播
      if (POWERED_BY.has(nb.type) || NEEDS_POWER.has(nb.type)) {
        nb.powered = true;
        queue.push([nr, nc]);
      }
    }
  }
}
```

### 5-2. 水道ネットワーク（BFS方式）

水道は「マップ端から供給」とする（水源タイル不要）。
初期キュー: マップ端（row=0, row=ROWS-1, col=0, col=COLS-1）の T.WATER タイル。

```javascript
function computeWaterNetwork() {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      grid[r][c].watered = false;

  const queue = [];
  // マップ端の水道管を起点
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].type !== T.WATER) continue;
      if (r === 0 || r === ROWS-1 || c === 0 || c === COLS-1) {
        grid[r][c].watered = true;
        queue.push([r, c]);
      }
    }

  while (queue.length) {
    const [r, c] = queue.shift();
    for (const [dr, dc] of DIRS4) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      const nb = grid[nr][nc];
      if (nb.watered) continue;
      if (nb.type === T.WATER || NEEDS_WATER.has(nb.type)) {
        nb.watered = true;
        queue.push([nr, nc]);
      }
    }
  }
}
```

### 5-3. 統合呼び出し

```javascript
function computeNetwork() {
  computePowerNetwork();
  computeWaterNetwork();
  // computeGasNetwork(); // Should
}
```

---

## 6. シミュレーション tick() 詳細

```javascript
function tick() {
  if (gameOver) return;
  frame_tick++;

  computeNetwork();  // ① インフラ接続判定

  // 公害リセット
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      grid[r][c].pol = 0;

  let income = 0, maint = 0, popGain = 0;
  let totalHappiness = 100;
  let crimeIncrement = 0;

  // ② 工業処理
  for (各IND系タイル) {
    if (!cell.powered) continue;  // 電力なしは機能しない
    income += IND_INC[t];
    maint  += MAINT[t];
    公害を隣接4タイルへ拡散;
    升格チェック;
  }

  // ③ 住宅処理
  for (各RES系タイル) {
    if (adjHas(ROAD_SET) && cell.powered && cell.watered) {
      popGain += POP_GAIN[t];
      升格チェック;
    }
    maint += MAINT[t];
    totalPol += cell.pol;
  }

  // ④ 商業処理
  for (各COM系タイル) {
    if (adjHas(ROAD_SET) && adjHas(RES) && cell.powered && cell.watered) {
      income += COM_INC[t];
      升格チェック;
    }
    maint += MAINT[t];
  }

  // ⑤ 交通施設
  for (各STATION) {
    if (hasRailConnection(r,c) && cell.powered) {
      popGain += POP_GAIN[T.STATION];
      totalHappiness += HAPPINESS_BONUS[T.STATION];
      income += 50; // 運賃収入
    }
    maint += MAINT[T.STATION];
  }

  // ⑥ 公共施設
  for (各PARK)    { popGain += 3; totalHappiness += 8; maint += MAINT[T.PARK]; }
  for (各POLICE)  { if (cell.powered) crimeReduction += 20; maint += MAINT[T.POLICE]; }
  for (各FIRE_ST) { if (cell.powered) 隣接6タイルの火災timを加速減少; maint += MAINT[T.FIRE_ST]; }

  // ⑦ 税収
  const tax = Math.floor(stats.pop * 0.12);
  income += tax;

  // ⑧ 犯罪率計算
  stats.crimeRate = Math.max(0, Math.floor(stats.pop / 50) - crimeReduction);

  // ⑨ 人口変動
  const crimeVictims = Math.floor(stats.crimeRate * 0.1);
  stats.pop = Math.max(0, stats.pop + popGain - crimeVictims);

  // ⑩ 幸福度
  stats.happiness = Math.max(0, Math.min(100,
    totalHappiness - Math.floor(totalPol / Math.max(1, zoneCount)) * 0.5
    - stats.crimeRate * 0.3
  ));

  // ⑪ 収支反映
  const net = income - maint;
  lastIncome = net;
  stats.money += net;
  stats.year++;

  // ⑫ イベント
  processEvents();
  spawnVehicles();

  // ⑬ 判定
  if (stats.money <= 0) { gameOver = true; showOverlay('GAME OVER', ...); }
  if (!gameClear && stats.pop >= 1000) { gameClear = true; showOverlay('CLEAR !', ...); }

  updateUI();
}
```

---

## 7. 乗り物アニメーション実装方針

### 7-1. 車（Car）

**生成条件:** 道路タイルが2つ以上連続し、隣接に住宅がある場合。
**生成タイミング:** tick() 内で `vehicles` 配列の車の数が `Math.floor(roadCount / 5)` 未満なら追加。
**移動:** 道路タイルの中心座標列を path として持つ。

```javascript
// Vehicle 生成
function spawnCar(path) {
  vehicles.push({
    type: 'car',
    path,           // [[r,c], [r,c], ...] 道路タイル列
    pathIdx: 0,
    progress: 0,    // 0.0 = タイル始点, 1.0 = 次タイルへ
    dir: 1,         // 1=前進, -1=後退（折り返し）
    color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    active: true,
  });
}

// 毎フレーム更新
function updateCar(v) {
  v.progress += 0.04;  // 速度: タイルを25フレームで通過
  if (v.progress >= 1.0) {
    v.progress -= 1.0;
    v.pathIdx += v.dir;
    if (v.pathIdx >= v.path.length - 1) v.dir = -1;
    if (v.pathIdx <= 0) v.dir = 1;
  }
  const [r, c] = v.path[v.pathIdx];
  const [nr, nc] = v.path[v.pathIdx + v.dir] || [r, c];
  v.x = (c + (nc - c) * v.progress) * TS + TS / 2;
  v.y = (r + (nr - r) * v.progress) * TS + TS / 2;
}

// 描画
function drawCar(v) {
  ctx.fillStyle = v.color;
  ctx.fillRect(v.x - 4, v.y - 3, 8, 6);  // 8×6px の矩形
}

const CAR_COLORS = ['#c0c0c0', '#e8e8e8', '#888888', '#4fc3f7', '#ab47bc'];
```

### 7-2. 電車（Train）

**生成条件:** T.STATION が2つ以上存在し、線路で接続されている場合。
**経路探索:** 駅間の T.RAIL タイル列を BFS で取得。

```javascript
function findRailPath(r1, c1, r2, c2) {
  // BFS で RAIL_SET タイルを辿り、(r2,c2)駅までの経路を返す
  // 経路が存在しない場合は null を返す
}

function spawnTrain(path) {
  vehicles.push({
    type: 'train',
    path,
    pathIdx: 0,
    progress: 0,
    dir: 1,
    color: '#4fc3f7',
    active: true,
    length: 3,  // 3タイル分の長さを描画
  });
}

// 描画 (電車は3タイル分の長さで描画)
function drawTrain(v) {
  // 先頭
  ctx.fillStyle = '#4fc3f7';
  ctx.fillRect(v.x - 6, v.y - 5, 12, 10);
  // 車体（pathIdx-1, pathIdx-2の座標に縮小矩形）
  // ...
}
```

### 7-3. 飛行機（Plane）

**生成条件:** T.AIRPORT タイルが存在し、tick() で `Math.random() < 0.3` の場合。
**移動:** path 不使用。直線移動。

```javascript
function spawnPlane() {
  const fromLeft = Math.random() < 0.5;
  vehicles.push({
    type: 'plane',
    x: fromLeft ? -50 : COLS * TS + 50,
    y: Math.random() * ROWS * TS * 0.6,
    dx: fromLeft ? 1.5 : -1.5,
    dy: fromLeft ? -0.3 : 0.3,
    color: '#e0e0e0',
    active: true,
    path: null,
  });
}

function updatePlane(v) {
  v.x += v.dx;
  v.y += v.dy;
  if (v.x < -80 || v.x > COLS * TS + 80) v.active = false;
}

function drawPlane(v) {
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.rotate(Math.atan2(v.dy, v.dx));
  // 胴体
  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(-15, -3, 30, 6);
  // 主翼
  ctx.fillRect(-5, -10, 10, 20);
  ctx.restore();
}
```

### 7-4. 乗り物の一括管理

```javascript
function updateVehicles() {
  for (let i = vehicles.length - 1; i >= 0; i--) {
    const v = vehicles[i];
    if (!v.active) { vehicles.splice(i, 1); continue; }
    if (v.type === 'car')   updateCar(v);
    if (v.type === 'train') updateTrain(v);
    if (v.type === 'plane') updatePlane(v);
  }
}

function drawVehicles() {
  for (const v of vehicles) {
    if (!v.active) continue;
    if (v.type === 'car')   drawCar(v);
    if (v.type === 'train') drawTrain(v);
    if (v.type === 'plane') drawPlane(v);
  }
}
```

---

## 8. イベントシステム実装方針

```javascript
// イベント発生確率（tick() 1回=1年ごと）
const EVENT_PROB = {
  fire:    0.08,   // 火災（商業多いほど増加）
  quake:   0.03,   // 地震
  typhoon: 0.04,   // 台風 (Should)
  meltdown:0.005,  // メルトダウン (Should・核発電所がある時のみ)
};

function processEvents() {
  // 火災
  const comCount = count(COM);
  const fireChance = EVENT_PROB.fire + comCount * 0.005;
  if (Math.random() < fireChance) {
    const candidates = []; // RES, COM タイルを候補に
    for (各タイル) if (RES.has(t)||COM.has(t)) candidates.push([r,c]);
    if (candidates.length > 0) {
      const [r,c] = candidates[Math.floor(Math.random()*candidates.length)];
      events.push({ type:'fire', r, c, timer:300, severity:1 });
      grid[r][c].fireTimer = 300;
      grid[r][c].hp = Math.max(0, grid[r][c].hp - 40);
    }
  }

  // 地震（10年ごとに一定確率）
  if (stats.year % 10 === 0 && Math.random() < EVENT_PROB.quake) {
    events.push({ type:'quake', r:-1, c:-1, timer:120, severity:2 });
    // 全タイルにダメージ
    for (各タイル) {
      cell.hp = Math.max(0, cell.hp - Math.floor(Math.random() * 20 + 10));
      if (cell.type === T.ROAD && Math.random() < 0.2) cell.type = T.ROAD_BROKEN;
    }
    // 画面揺れエフェクト: shakeTimer = 60 をセット
    shakeTimer = 60;
  }

  // メルトダウン (Should)
  if (hasNuclear && Math.random() < EVENT_PROB.meltdown) {
    events.push({ type:'meltdown', r:nuclearR, c:nuclearC, timer:600, severity:3 });
    // 半径5タイル内の人口を激減、施設破壊
    広域ダメージ処理;
  }
}

function updateEvents() {
  for (let i = events.length - 1; i >= 0; i--) {
    events[i].timer--;
    if (events[i].timer <= 0) events.splice(i, 1);
  }
  // 火災タイルの timer 減少 & 消防署による鎮火加速
  for (各タイル) {
    if (cell.fireTimer > 0) {
      cell.fireTimer -= 1;
      if (fireStationNearby(r,c)) cell.fireTimer -= 2; // 追加減少
      if (cell.fireTimer <= 0) cell.fireTimer = 0; // 鎮火
    }
  }
}
```

---

## 9. 描画関数仕様

### 9-1. draw() メインループ

```javascript
function draw() {
  // 画面揺れ
  ctx.save();
  if (shakeTimer > 0) {
    shakeTimer--;
    ctx.translate(
      (Math.random()-0.5)*4,
      (Math.random()-0.5)*4
    );
  }

  // 背景
  ctx.fillStyle = '#0a0f14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // グリッドタイル
  for (let r=0; r<ROWS; r++)
    for (let c=0; c<COLS; c++)
      drawTile(r, c);

  // グリッド線
  ctx.strokeStyle = '#1a2332';
  // ... (現行と同様)

  // 乗り物
  drawVehicles();

  // エフェクト（火災・爆発）
  drawEffects();

  // パーティクル
  drawParticles();

  // ホバーハイライト
  drawHover();

  // 情報ポップアップ
  drawInfoPopup();

  ctx.restore();
}
```

### 9-2. drawTile() 拡張

```javascript
function drawTile(r, c) {
  const x = c * TS, y = r * TS;
  const cell = grid[r][c];
  const t = cell.type;

  if (t === T.EMPTY) { drawEmpty(x, y, cell.pol); return; }
  if (t === T.ROAD)  { drawRoad(x, y); return; }
  if (t === T.ROAD_BROKEN) { drawRoadBroken(x, y); return; }

  if (RES.has(t)) { drawBuilding(x, y, t-T.RES1, 'res', r, c, cell); return; }
  if (COM.has(t)) { drawBuilding(x, y, t-T.COM1, 'com', r, c, cell); return; }
  if (IND.has(t)) { drawBuilding(x, y, t-T.IND1, 'ind', r, c, cell); return; }

  if (t === T.RAIL)    { drawRail(x, y, r, c); return; }
  if (t === T.STATION) { drawStation(x, y, cell); return; }
  if (t === T.AIRPORT) { drawAirport(x, y, cell); return; }

  if (t === T.POWER)   { drawPowerPlant(x, y, cell); return; }
  if (t === T.PLINE)   { drawPowerLine(x, y, r, c); return; }
  if (t === T.WATER)   { drawWaterPipe(x, y, r, c, cell); return; }

  if (t === T.PARK)    { drawPark(x, y); return; }
  if (t === T.POLICE)  { drawPolice(x, y, cell); return; }
  if (t === T.FIRE_ST) { drawFireStation(x, y, cell); return; }
}
```

### 9-3. インフラ状態のビジュアル表現

- **電力未接続の施設**: 建物色を50%暗くし、窓を全消灯にする。右上に「⚡?」アイコンを描画
- **水道未接続の施設**: 建物色を30%暗くし、右上に「💧?」アイコンを描画
- **火災中のタイル**: 建物の上に揺れる炎エフェクト（Canvas arc で描画）
- **破損道路**: グレーのひび割れ模様を描画

### 9-4. drawInfoPopup()

```javascript
function drawInfoPopup() {
  if (!hover) return;
  const { r, c } = hover;
  const cell = grid[r][c];
  if (cell.type === T.EMPTY) return;

  // ポップアップ位置（カーソルの右隣、画面外に出る場合は左）
  const px = (c + 1) * TS + 4;
  const py = r * TS;
  const pw = 130, ph = 80;

  // グラスモーフィズム背景
  ctx.fillStyle = 'rgba(10,15,20,0.88)';
  ctx.strokeStyle = '#4fc3f7';
  ctx.lineWidth = 1;
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeRect(px, py, pw, ph);

  // テキスト
  ctx.fillStyle = '#e0e0e0';
  ctx.font = '10px Courier New';
  const tileName = TILE_NAMES[cell.type] || 'Unknown';
  ctx.fillText(tileName, px+6, py+14);
  ctx.fillStyle = cell.powered ? '#66bb6a' : '#ef5350';
  ctx.fillText('電力: ' + (cell.powered ? '供給中' : '未接続'), px+6, py+28);
  ctx.fillStyle = cell.watered ? '#4fc3f7' : '#ef5350';
  ctx.fillText('水道: ' + (cell.watered ? '供給中' : '未接続'), px+6, py+42);
  if (cell.fireTimer > 0) {
    ctx.fillStyle = '#ef5350';
    ctx.fillText('火災発生中!', px+6, py+56);
  }
  ctx.fillStyle = '#888888';
  ctx.fillText('HP: ' + cell.hp + '%', px+6, py+70);
}
```

---

## 10. UIレイアウト（HTML/CSS）詳細

### 10-1. HTMLタブ構造

```html
<div id="toolbar">
  <div id="tab-bar">
    <button class="tab-btn active" data-tab="basic">基本 Basic</button>
    <button class="tab-btn" data-tab="traffic">交通 Traffic</button>
    <button class="tab-btn" data-tab="infra">設備 Infra</button>
    <button class="tab-btn" data-tab="public">公共 Public</button>
  </div>
  <div class="tab-panel active" id="tab-basic">
    <button class="tool-btn active" data-tool="1">▬ 道路 $100</button>
    <button class="tool-btn" data-tool="2">⬛ 住宅 $300</button>
    <button class="tool-btn" data-tool="5">⬛ 商業 $400</button>
    <button class="tool-btn" data-tool="8">⬛ 工業 $350</button>
    <button class="tool-btn" data-tool="0">✕ 撤去</button>
  </div>
  <div class="tab-panel" id="tab-traffic">
    <button class="tool-btn" data-tool="11">━ 線路 $150</button>
    <button class="tool-btn" data-tool="12">🚉 駅 $800</button>
    <button class="tool-btn" data-tool="13">✈ 空港 $3000</button>
  </div>
  <div class="tab-panel" id="tab-infra">
    <button class="tool-btn" data-tool="14">⚡ 発電所 $1000</button>
    <button class="tool-btn" data-tool="15">╌ 送電線 $80</button>
    <button class="tool-btn" data-tool="16">≈ 水道管 $60</button>
  </div>
  <div class="tab-panel" id="tab-public">
    <button class="tool-btn" data-tool="19">🌳 公園 $500</button>
    <button class="tool-btn" data-tool="20">🚔 警察 $1200</button>
    <button class="tool-btn" data-tool="21">🚒 消防 $1000</button>
  </div>
</div>
```

### 10-2. StatusBar 拡張

```html
<div id="status-bar">
  <span id="game-title">CITY BUILDER</span>
  <span class="stat">資金 <span class="stat-val" id="stat-money">$10,000</span></span>
  <span class="stat">人口 <span class="stat-val" id="stat-pop">0</span></span>
  <span class="stat">幸福 <span class="stat-val" id="stat-happiness">100%</span></span>
  <span class="stat">犯罪 <span class="stat-val" id="stat-crime">0%</span></span>
  <span class="stat">収入 <span class="stat-val" id="stat-income">+$0</span></span>
  <span class="stat" style="margin-left:auto">年 <span class="stat-val" id="stat-year">1</span></span>
</div>
```

### 10-3. 主要CSSルール

```css
/* タブ */
#tab-bar {
  display: flex;
  gap: 2px;
  margin-bottom: 4px;
}
.tab-btn {
  background: rgba(10,15,20,0.7);
  border: 1px solid #1a2332;
  color: #556677;
  padding: 4px 12px;
  font-family: 'Courier New', monospace;
  font-size: 10px;
  cursor: pointer;
  letter-spacing: 0.5px;
  backdrop-filter: blur(4px);
}
.tab-btn.active {
  color: #4fc3f7;
  border-color: #4fc3f7;
  background: rgba(15,30,45,0.85);
}
.tab-panel { display: none; flex-wrap: wrap; gap: 4px; }
.tab-panel.active { display: flex; }

/* ツールボタン（タイプ別色） */
.tool-btn[data-tool="1"].active  { border-color: #667788; color: #99aabb; }
.tool-btn[data-tool="2"].active  { border-color: #4fc3f7; color: #80d8ff; }
.tool-btn[data-tool="5"].active  { border-color: #ab47bc; color: #ce93d8; }
.tool-btn[data-tool="8"].active  { border-color: #ff8f00; color: #ffca28; }
.tool-btn[data-tool="11"].active { border-color: #8d6e63; color: #bcaaa4; }
.tool-btn[data-tool="12"].active { border-color: #4fc3f7; color: #80d8ff; }
.tool-btn[data-tool="14"].active { border-color: #ffca28; color: #fff176; }
.tool-btn[data-tool="15"].active { border-color: #ffca28; color: #fff176; }
.tool-btn[data-tool="16"].active { border-color: #4fc3f7; color: #80d8ff; }
.tool-btn[data-tool="19"].active { border-color: #66bb6a; color: #a5d6a7; }
.tool-btn[data-tool="20"].active { border-color: #42a5f5; color: #90caf9; }
.tool-btn[data-tool="21"].active { border-color: #ef5350; color: #ef9a9a; }
.tool-btn[data-tool="0"].active  { border-color: #ef5350; color: #ef5350; }

/* タイトル（サイバーパンク演出を除去） */
h1 {
  font-size: 18px;
  letter-spacing: 4px;
  color: #4fc3f7;
  margin-bottom: 6px;
  text-align: center;
  /* text-shadow は最小限に */
  text-shadow: 0 0 10px #4fc3f744;
}
```

---

## 11. 各描画関数スペック

### drawRail(x, y, r, c)
- 背景: `#1e2a3a`（道路より若干明るいネイビー）
- 枕木: 茶色矩形 (`#5d4037`) を等間隔に4本
- レール: シルバー2本ライン (`#78909c`)、枕木の上に重ねる
- 接続方向（4方向チェック）に応じてH/V/十字を描き分ける

### drawStation(x, y, cell)
- 背景: `#1a2d3d`
- 建物: `#1e3a5f` 矩形、枠線 `#4fc3f7`
- 電力未接続時: 暗色 (`#0a1520`) + 右上「⚡?」テキスト
- 駅マーク「S」を中央に描画

### drawPowerPlant(x, y, cell)
- 背景: `#1a1a0a`
- 煙突: 細い矩形2本
- 電力ゾーン表示: 建物が明るい黄色 (`#ffca28`)
- 煙アニメーション: 工業と同様の arc()

### drawPowerLine(x, y, r, c)
- 背景: `#0a0f14`（空地と同色）
- 電柱: 縦線2本 (`#78909c`)
- 電線: 細い横/縦ライン (`#ffca28`、不透明度0.7)
- 接続方向に応じてH/V/十字を描き分ける

### drawWaterPipe(x, y, r, c, cell)
- 背景: `#0a0f14`
- パイプ: `#1565c0`（ブルー）の太い線（6px幅）
- 水が通っている（watered=true）: `#4fc3f7` に明色化
- 接続方向に応じて描き分ける

### drawPark(x, y)
- 背景: `#0a1f0a`（ダークグリーン）
- 木: 緑の円 (`#2e7d32`) を3〜4個配置
- 芝生: 点描で薄緑を散らす

### drawPolice(x, y, cell)
- 背景: `#0a0f2a`
- 建物: `#1a237e`（ダークブルー）
- 「P」マークを `#42a5f5` で描画
- 電力未接続時: 暗色化

### drawFireStation(x, y, cell)
- 背景: `#2a0a0a`
- 建物: `#b71c1c`（ダークレッド）
- 「F」マークを `#ef5350` で描画
- 電力未接続時: 暗色化

### drawEffects()
- 火災中のタイル (`cell.fireTimer > 0`):
  ```javascript
  const flicker = Math.sin(frame * 0.3) * 3;
  ctx.fillStyle = `rgba(255, ${80 + Math.random()*40}, 0, 0.8)`;
  ctx.beginPath();
  ctx.arc(cx, cy - 4 + flicker, 5 + Math.random()*3, 0, Math.PI*2);
  ctx.fill();
  ```
- 地震中 (`shakeTimer > 0`): 爆発パーティクルを広域に散布

---

## 12. タイル名称テーブル

```javascript
const TILE_NAMES = {
  [T.EMPTY]:    '空地 / Empty',
  [T.ROAD]:     '道路 / Road',
  [T.RES1]:     '住宅Lv1 / Residence',
  [T.RES2]:     '住宅Lv2 / Residence+',
  [T.RES3]:     '住宅Lv3 / Residence++',
  [T.COM1]:     '商業Lv1 / Commerce',
  [T.COM2]:     '商業Lv2 / Commerce+',
  [T.COM3]:     '商業Lv3 / Commerce++',
  [T.IND1]:     '工業Lv1 / Industry',
  [T.IND2]:     '工業Lv2 / Industry+',
  [T.IND3]:     '工業Lv3 / Industry++',
  [T.RAIL]:     '線路 / Rail',
  [T.STATION]:  '駅 / Station',
  [T.AIRPORT]:  '空港 / Airport',
  [T.POWER]:    '発電所 / Power Plant',
  [T.PLINE]:    '送電線 / Power Line',
  [T.WATER]:    '水道管 / Water Pipe',
  [T.GAS]:      'ガス管 / Gas Pipe',
  [T.NUCLEAR]:  '原子力発電所 / Nuclear',
  [T.PARK]:     '公園 / Park',
  [T.POLICE]:   '警察署 / Police',
  [T.FIRE_ST]:  '消防署 / Fire Station',
  [T.ROAD_BROKEN]: '破損道路 / Damaged Road',
};
```

---

## 13. 状態初期値

```javascript
function init() {
  grid = Array.from({length: ROWS}, () =>
    Array.from({length: COLS}, () => ({
      type: T.EMPTY, xp: 0, pol: 0,
      hp: 100, powered: false, watered: false,
      fireTimer: 0, gassed: false
    }))
  );
  stats = {
    money: 10000, pop: 0, happiness: 100,
    year: 1, crimeRate: 0, fireRisk: 0, pollution: 0
  };
  vehicles  = [];
  events    = [];
  particles = Array.from({length: 12}, makeParticle);
  selectedTool = T.ROAD;
  gameOver = false;
  gameClear = false;
  frame = 0;
  frame_tick = 0;
  shakeTimer = 0;
  hover = null;
  dragging = false;
  lastIncome = 0;
  document.getElementById('overlay').classList.remove('show');
  updateUI();
}
```

---

## 14. 地形システム（新規追加）

### 14-1. 地形定数（TR オブジェクト）

```javascript
const TR = {
  GRASS:    0,  // 草地（デフォルト・全施設建設可）
  HIGHLAND: 1,  // 高台（道路のみ建設可、コスト×1.5）
  RIVER:    2,  // 川（橋のみ建設可）
  SEA:      3,  // 海（建設不可）
  FOREST:   4,  // 森（撤去後に建設可）
};
```

### 14-2. マップサイズ定数

```javascript
const COLS  = 40;   // マップ全幅（タイル数）
const ROWS  = 32;   // マップ全高（タイル数）
const VCOLS = 20;   // ビューポート幅（Canvas表示タイル数）
const VROWS = 16;   // ビューポート高（Canvas表示タイル数）
const TS    = 32;   // タイルサイズ（px）
// Canvas サイズは変更なし: 640×512px
```

### 14-3. ビューポート・スクロール

```javascript
// グローバルスクロール状態
let viewX = 0;  // ビューポート左端（タイル単位）
let viewY = 0;  // ビューポート上端（タイル単位）

// スクロール制御
function scrollView(dx, dy) {
  viewX = Math.max(0, Math.min(COLS - VCOLS, viewX + dx));
  viewY = Math.max(0, Math.min(ROWS - VROWS, viewY + dy));
}

// スクリーン座標 → タイル座標（ビューポートオフセット込み）
function screenToTile(sx, sy) {
  return {
    c: Math.floor(sx / TS) + viewX,
    r: Math.floor(sy / TS) + viewY
  };
}

// スクロール操作
// - キーボード: Arrow / WASD で 1タイルずつスクロール
// - マウスホイール: 縦スクロール
// - 中ボタンドラッグ: 自由スクロール
// - Canvas 端から 2px 以内のホバー: エッジスクロール（毎フレーム +1）
```

### 14-4. セル構造の更新

```javascript
// cell に terrain フィールドを追加
cell = {
  terrain: TR.GRASS,  // ★ 地形タイプ（新規）
  type: T.EMPTY,
  xp: 0, pol: 0, hp: 100,
  powered: false, watered: false, gassed: false,
  fireTimer: 0,
}
```

### 14-5. 手続き的地形生成アルゴリズム

`generateTerrain()` を `init()` 内で呼び出す。外部ライブラリ不使用。

```javascript
// ① ハッシュベースのノイズ関数（Perlin類似）
function hash2(x, y, seed) {
  let n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.3) * 43758.5453;
  return n - Math.floor(n);
}
function octaveNoise(x, y, octaves, seed) {
  let v = 0, a = 1, f = 1, mx = 0;
  for (let i = 0; i < octaves; i++) {
    v += hash2(x * f / 8, y * f / 8, seed + i) * a;
    mx += a; a *= 0.5; f *= 2;
  }
  return v / mx;
}

// ② 高さマップ生成 → 地形割り当て
function generateTerrain() {
  const seed = Math.random() * 1000;
  // 各セルに高さ値を割り当て
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const h = octaveNoise(c, r, 4, seed);
      let terrain;
      if (h < 0.28)      terrain = TR.SEA;       // 海（マップ外縁寄りに多い）
      else if (h < 0.38) terrain = TR.RIVER;     // 川・沿岸（海と草地の間）
      else if (h < 0.72) terrain = TR.GRASS;     // 草地（中間帯、最多）
      else if (h < 0.86) terrain = TR.HIGHLAND;  // 高台
      else               terrain = TR.HIGHLAND;  // 山岳
      grid[r][c].terrain = terrain;
    }
  }

  // ③ 川の生成（高台→海へのランダムウォーク、2〜4本）
  const riverCount = 2 + Math.floor(Math.random() * 3);
  for (let ri = 0; ri < riverCount; ri++) {
    // 高台セルからスタート
    const starts = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (grid[r][c].terrain === TR.HIGHLAND) starts.push([r, c]);
    if (!starts.length) continue;
    let [r, c] = starts[Math.floor(Math.random() * starts.length)];
    for (let step = 0; step < ROWS * 2; step++) {
      grid[r][c].terrain = TR.RIVER;
      // 下方向・側方向のランダムウォーク（海に向かって）
      const dirs = [[1,0],[0,1],[0,-1],[1,1],[1,-1]];
      const [dr, dc] = dirs[Math.floor(Math.random() * dirs.length)];
      r = Math.max(0, Math.min(ROWS-1, r + dr));
      c = Math.max(0, Math.min(COLS-1, c + dc));
      if (grid[r][c].terrain === TR.SEA) break;
    }
  }

  // ④ 森の生成（草地にランダムクラスター、8〜12箇所）
  const forestCount = 8 + Math.floor(Math.random() * 5);
  for (let fi = 0; fi < forestCount; fi++) {
    const fr = Math.floor(Math.random() * ROWS);
    const fc = Math.floor(Math.random() * COLS);
    const size = 2 + Math.floor(Math.random() * 4); // 半径2〜5タイル
    for (let dr = -size; dr <= size; dr++) {
      for (let dc = -size; dc <= size; dc++) {
        if (dr*dr + dc*dc > size*size) continue;
        const nr = fr + dr, nc = fc + dc;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
        if (grid[nr][nc].terrain === TR.GRASS && Math.random() < 0.7)
          grid[nr][nc].terrain = TR.FOREST;
      }
    }
  }
}
```

### 14-6. 地形の建設制約

```javascript
// placeTile() 内でチェック
function canBuildOn(r, c, toolType) {
  const terrain = grid[r][c].terrain;
  if (terrain === TR.SEA) return false;           // 海: 全面禁止
  if (terrain === TR.RIVER) {
    return toolType === T.BRIDGE;                  // 川: 橋のみ
  }
  if (terrain === TR.HIGHLAND) {
    // 高台: 道路・橋・送電線・水道管のみ可（居住・商業・工業は不可）
    return [T.ROAD, T.PLINE, T.WATER, T.PARK].includes(toolType);
  }
  return true;  // 草地・森は全て可（森は建設時に terrain = TR.GRASS に変更）
}

// 高台の建設コスト割増
function getPlaceCost(r, c, toolType) {
  const base = PLACE_COST[toolType] || 0;
  return grid[r][c].terrain === TR.HIGHLAND ? Math.ceil(base * 1.5) : base;
}

// 森タイルへの建設時: 自動的に伐採（terrain = TR.GRASS に変更）
// 伐採費用: $100 追加
```

### 14-7. 橋タイル追加

```javascript
// T オブジェクトに追加
T.BRIDGE = 24;  // 橋（川の上に建設できる道路）

PLACE_COST[T.BRIDGE] = 400;   // 道路(100)の4倍
MAINT[T.BRIDGE] = 5;

// 橋は道路として扱う（車が走れる）
ROAD_SET.add(T.BRIDGE);
```

### 14-8. ミニマップ表示

Canvas右下 120×80px 領域に地形＋建物のミニマップを常時表示。

```javascript
function drawMinimap() {
  const mw = 120, mh = 80;
  const mx = canvas.width - mw - 4, my = canvas.height - mh - 4;
  
  // 背景
  ctx.fillStyle = 'rgba(10,15,20,0.85)';
  ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = '#1a2332';
  ctx.strokeRect(mx, my, mw, mh);

  const tw = mw / COLS, th = mh / ROWS;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      let color;
      // 建物があれば建物色を優先
      if      (cell.type !== T.EMPTY) color = MINIMAP_COLOR[cell.type] || '#888';
      else if (cell.terrain === TR.SEA)      color = '#1a3a5c';
      else if (cell.terrain === TR.RIVER)    color = '#1e4d7b';
      else if (cell.terrain === TR.HIGHLAND) color = '#4a3f2f';
      else if (cell.terrain === TR.FOREST)   color = '#1a3a1a';
      else                                    color = '#1a2a1a';
      ctx.fillStyle = color;
      ctx.fillRect(mx + c * tw, my + r * th, Math.max(1, tw), Math.max(1, th));
    }
  }

  // ビューポート枠
  ctx.strokeStyle = '#4fc3f7';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx + viewX * tw, my + viewY * th, VCOLS * tw, VROWS * th);
  ctx.lineWidth = 1;
}
```

### 14-9. 地形の描画関数

```javascript
// drawTile() の先頭: 地形背景を描画してから建物を重ねる
function drawTerrainBg(x, y, terrain) {
  switch (terrain) {
    case TR.GRASS:
      ctx.fillStyle = '#0d1f0d'; break;
    case TR.HIGHLAND:
      ctx.fillStyle = '#2a2218'; break;
    case TR.RIVER:
      ctx.fillStyle = '#0d2035';
      // 川の流れアニメーション: 薄い波紋
      const wave = Math.sin((frame + x * 0.1) * 0.05) * 2;
      ctx.fillStyle = `rgba(20, 80, 140, ${0.7 + wave * 0.05})`;
      break;
    case TR.SEA:
      ctx.fillStyle = '#071525';
      break;
    case TR.FOREST:
      ctx.fillStyle = '#0a1a0a'; break;
  }
  ctx.fillRect(x, y, TS, TS);
}

// 森の装飾（T.EMPTY かつ terrain=FOREST の場合）
function drawForestDecor(x, y) {
  // 木を2〜3本描画
  const treePositions = [[8, 20], [18, 14], [25, 22]];
  for (const [tx, ty] of treePositions) {
    ctx.fillStyle = '#1b5e20';
    ctx.beginPath();
    ctx.arc(x + tx, y + ty, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2e7d32';
    ctx.beginPath();
    ctx.arc(x + tx, y + ty - 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 海の装飾（波エフェクト）
function drawSeaDecor(x, y) {
  ctx.strokeStyle = `rgba(30, 100, 180, 0.4)`;
  ctx.lineWidth = 1;
  const waveOffset = (frame * 0.3 + x * 0.2) % (TS * 2);
  ctx.beginPath();
  ctx.moveTo(x + waveOffset - TS, y + TS * 0.4);
  ctx.quadraticCurveTo(x + waveOffset - TS/2, y + TS * 0.35, x + waveOffset, y + TS * 0.4);
  ctx.stroke();
}

// 高台の装飾（岩・段差表現）
function drawHighlandDecor(x, y) {
  ctx.fillStyle = '#3d3222';
  ctx.fillRect(x + 4, y + TS - 6, TS - 8, 4);
  ctx.fillStyle = '#4a3f2f';
  ctx.fillRect(x + 8, y + TS - 10, TS - 16, 5);
}
```

---

## 15. Generatorへの実装指示サマリー（最終版）

以下の順序で `city.html` を **全面書き直し**（既存658行を置き換え）すること。

1. `<title>` を `CITY BUILDER` に変更
2. `<h1>` を `▸ CITY BUILDER ◂` に変更
3. CSS: サイバーパンク演出を削除。カラーパレットを基本設計書セクション8の新規色に。タブ式UIをセクション10-3に従い追加
4. タブ式ツールバーをセクション10-1の HTML で実装（「交通」タブに橋ボタン追加）
5. StatusBar に `stat-crime` を追加（セクション10-2）
6. JS: **① CONSTANTS** — `const TS=32, COLS=40, ROWS=32, VCOLS=20, VROWS=16` で開始。`const T` をセクション2拡張版＋`T.BRIDGE=24` で定義。`const TR` をセクション14-1で定義。全定数テーブルをセクション4に従い追加
7. JS: **② STATE** — `viewX=0, viewY=0` を追加。`vehicles, events, particles, shakeTimer` を宣言。`init()` をセクション13＋`generateTerrain()` 呼び出しに更新
8. JS: **③ TERRAIN** — `hash2()` / `octaveNoise()` / `generateTerrain()` をセクション14-5に従い実装
9. JS: **④ INFRA NETWORK** — `computePowerNetwork()` / `computeWaterNetwork()` / `computeNetwork()` をセクション5に従い実装
10. JS: **⑤ SIMULATION TICK** — `tick()` をセクション6に従い実装。`canBuildOn()` / `getPlaceCost()` をセクション14-6に従い実装
11. JS: **⑥ VEHICLES** — `spawnVehicles()` / `updateVehicles()` / `drawVehicles()` をセクション7に従い実装（`drawCar`, `drawTrain`, `drawPlane` 含む）
12. JS: **⑦ EVENTS** — `processEvents()` / `updateEvents()` / `drawEffects()` をセクション8に従い実装
13. JS: **⑧ DRAWING** — `draw()` を以下の順で実装:
    - `ctx.save()` / shakeTimer 処理
    - ビューポート分ループ（`r: viewY〜viewY+VROWS, c: viewX〜viewX+VCOLS`）で `drawTile(r, c)` 呼び出し
    - `drawTile()` 内では先に `drawTerrainBg()` を呼び、次に建物を描画
    - `T.EMPTY` かつ `terrain===TR.FOREST` なら `drawForestDecor()` を呼ぶ
    - `T.EMPTY` かつ `terrain===TR.SEA` なら `drawSeaDecor()` を呼ぶ
    - `T.EMPTY` かつ `terrain===TR.HIGHLAND` なら `drawHighlandDecor()` を呼ぶ
    - グリッド線描画（ビューポート内のみ）
    - `drawVehicles()` → `drawEffects()` → `drawParticles()` → `drawHover()` → `drawInfoPopup()` → `drawMinimap()`
    - `ctx.restore()`
14. JS: `drawMinimap()` をセクション14-8に従い実装
15. JS: `drawInfoPopup()` をセクション9-4に従い実装
16. JS: **⑨ INPUT** — マウスイベントで `screenToTile()` を使いタイル座標を取得。`placeTile()` 内で `canBuildOn()` チェックを追加。コスト計算に `getPlaceCost()` を使用。キーボードイベント（Arrow / WASD）で `scrollView()` を呼び出す。ホイールイベントで縦スクロール
17. JS: **⑩ UI** — タブ切り替え `initToolbar()`。`updateUI()` に `stat-crime` 更新を追加。`TILE_NAMES` 定数をセクション12＋TR名を追加
18. JS: **⑪ GAME LOOP** — `requestAnimationFrame` ループ内で `frame++` → `updateVehicles()` → `updateEvents()` → `draw()` の順に呼び出し。`setInterval(tick, 3000)` を維持
19. Must 機能を全実装後、Should 機能を追加（原子力・空港・ガス管・台風）

**注意事項:**
- `innerHTML` へのユーザー入力注入禁止（XSS防止）
- ファイルサイズ目安: 1,800行以内
- 外部ライブラリ・ビルドツール不使用
- Canvas API のみで描画
- draw() ループは必ずビューポート（viewX〜viewX+VCOLS, viewY〜viewY+VROWS）のみ描画すること（全40×32タイルを描画するとパフォーマンス低下）
- 60fps 維持: tick() の重い処理は setInterval(3000ms) 側に集約し、draw() 内では計算を最小限に
- ミニマップは毎フレーム再描画（軽量なのでOK）
