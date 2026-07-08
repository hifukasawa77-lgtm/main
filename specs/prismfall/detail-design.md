# 詳細設計書 — プリズムフォール (PrismFall)

バージョン: 1.0.0
作成日: 2026-06-10
作成者: Plannerエージェント

---

## 0. アセット方針（重要）

**本案件では Graphic-Designer / Music-Generator は不要。**
全てのビジュアル（テトリミノ・パーティクル・UI）はCanvas APIによるプロシージャル描画、全ての音はGameKit.Sfx（Web Audio API）でその場生成する。外部画像ファイル・音声ファイル・追加CDNライブラリは一切使用しない。

---

## 1. ファイル構成

```
C:\Users\hifuk\Documents\Git_hub\hide_0001_hon\
└── prismfall.html      ← 新規作成。gamekit/template.html をコピーして改変
```

`gamekit/gamekit.js` への変更は不要。`<script src="gamekit/gamekit.js"></script>` の相対パスはそのまま使用する（リポジトリ直下に配置するため `gamekit/gamekit.js` で参照可能）。

---

## 2. HTML構造

```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>PrismFall | プリズムフォール</title>
<style>
  /* template.html の :root 変数・bodyスタイルを継承 */
  :root {
    --bg: #05070d;
    --accent-cyan: #22d3ee;
    --accent-purple: #a78bfa;
    --text: #e2e8f0;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: var(--bg); color: var(--text);
    font-family: "Segoe UI", "Hiragino Sans", sans-serif;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    min-height: 100vh; gap: 12px; padding: 12px;
  }
  canvas {
    max-width: 96vw; border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.12);
    background: var(--bg); box-shadow: 0 10px 40px rgba(0,0,0,0.6);
  }
  .hint { font-size: 13px; color: #94a3b8; text-align: center; }

  /* タッチコントロール */
  #touch-controls {
    display: none; /* JSでタッチデバイス判定時のみ flex に */
    width: 100%; max-width: 960px;
    justify-content: space-between; align-items: center;
    gap: 8px; flex-wrap: wrap;
  }
  .touch-group { display: flex; gap: 8px; }
  .touch-btn {
    min-width: 56px; min-height: 56px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 12px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.18);
    backdrop-filter: blur(6px);
    color: var(--text); font-size: 20px;
    user-select: none; -webkit-tap-highlight-color: transparent;
  }
  .touch-btn:active { background: rgba(34,211,238,0.25); }

  @media (hover: none) and (pointer: coarse) {
    #touch-controls { display: flex; }
  }
</style>
</head>
<body>
<canvas id="game"></canvas>
<p class="hint">移動: ←→ ・ 回転: ↑/Z ・ ソフトドロップ: ↓ ・ ハードドロップ: Space ・ ホールド: C ・ ポーズ: P<br>
Move: ←→ ・ Rotate: ↑/Z ・ Soft Drop: ↓ ・ Hard Drop: Space ・ Hold: C ・ Pause: P</p>

<div id="touch-controls">
  <div class="touch-group">
    <div class="touch-btn" id="btn-left">←</div>
    <div class="touch-btn" id="btn-rotate">↻</div>
    <div class="touch-btn" id="btn-right">→</div>
  </div>
  <div class="touch-group">
    <div class="touch-btn" id="btn-down">↓</div>
    <div class="touch-btn" id="btn-hold">HOLD</div>
    <div class="touch-btn" id="btn-drop">DROP</div>
  </div>
</div>

<script src="gamekit/gamekit.js"></script>
<script>
'use strict';
/* ゲームロジック全体（セクション3〜9を参照） */
</script>
</body>
</html>
```

タッチボタンのid一覧: `btn-left`, `btn-right`, `btn-down`, `btn-rotate`, `btn-hold`, `btn-drop`。
`#touch-controls` はCSSメディアクエリ `(hover: none) and (pointer: coarse)` で表示切り替え（JS側での追加判定は不要）。

---

## 3. 定数定義

### 3.1 キャンバスサイズ

```javascript
const W = 960, H = 540;
const game = new GameKit.Engine(document.getElementById('game'), { width: W, height: H });
const save = new GameKit.Save('prismfall');
```

### 3.2 フィールド・セルサイズ

```javascript
const COLS = 10, ROWS = 20;
const CELL = 24; // 1セル24px → フィールド描画サイズ 240x480
const FIELD_X = 360, FIELD_Y = 30; // フィールド左上のCanvas座標
```

### 3.3 PIECES — テトリミノ定義

各テトリミノは4方向(0=spawn, 1=R, 2=2, 3=L)×4x4のビットマップで定義する（標準SRSの座標系に準拠した簡易実装でよい）。

```javascript
// 1=ブロックあり, 0=なし。各配列は4行×4列をフラット化した16要素
const PIECES = {
  I: {
    color: { base: '#22d3ee', light: '#a5f3fc', dark: '#0e7490' },
    rotations: [
      [0,0,0,0, 1,1,1,1, 0,0,0,0, 0,0,0,0],
      [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
      [0,0,0,0, 0,0,0,0, 1,1,1,1, 0,0,0,0],
      [0,1,0,0, 0,1,0,0, 0,1,0,0, 0,1,0,0],
    ],
  },
  O: {
    color: { base: '#a78bfa', light: '#ddd6fe', dark: '#6d28d9' },
    rotations: [
      [0,1,1,0, 0,1,1,0, 0,0,0,0, 0,0,0,0],
      [0,1,1,0, 0,1,1,0, 0,0,0,0, 0,0,0,0],
      [0,1,1,0, 0,1,1,0, 0,0,0,0, 0,0,0,0],
      [0,1,1,0, 0,1,1,0, 0,0,0,0, 0,0,0,0],
    ],
  },
  T: {
    color: { base: '#67e8f9', light: '#cffafe', dark: '#0891b2' },
    rotations: [
      [0,1,0,0, 1,1,1,0, 0,0,0,0, 0,0,0,0],
      [0,1,0,0, 0,1,1,0, 0,1,0,0, 0,0,0,0],
      [0,0,0,0, 1,1,1,0, 0,1,0,0, 0,0,0,0],
      [0,1,0,0, 1,1,0,0, 0,1,0,0, 0,0,0,0],
    ],
  },
  S: {
    color: { base: '#c4b5fd', light: '#ede9fe', dark: '#7c3aed' },
    rotations: [
      [0,1,1,0, 1,1,0,0, 0,0,0,0, 0,0,0,0],
      [0,1,0,0, 0,1,1,0, 0,0,1,0, 0,0,0,0],
      [0,0,0,0, 0,1,1,0, 1,1,0,0, 0,0,0,0],
      [1,0,0,0, 1,1,0,0, 0,1,0,0, 0,0,0,0],
    ],
  },
  Z: {
    color: { base: '#22d3ee', light: '#cffafe', dark: '#155e75' },
    rotations: [
      [1,1,0,0, 0,1,1,0, 0,0,0,0, 0,0,0,0],
      [0,0,1,0, 0,1,1,0, 0,1,0,0, 0,0,0,0],
      [0,0,0,0, 1,1,0,0, 0,1,1,0, 0,0,0,0],
      [0,1,0,0, 1,1,0,0, 1,0,0,0, 0,0,0,0],
    ],
  },
  J: {
    color: { base: '#818cf8', light: '#e0e7ff', dark: '#4338ca' },
    rotations: [
      [1,0,0,0, 1,1,1,0, 0,0,0,0, 0,0,0,0],
      [0,1,1,0, 0,1,0,0, 0,1,0,0, 0,0,0,0],
      [0,0,0,0, 1,1,1,0, 0,0,1,0, 0,0,0,0],
      [0,1,0,0, 0,1,0,0, 1,1,0,0, 0,0,0,0],
    ],
  },
  L: {
    color: { base: '#f0abfc', light: '#fae8ff', dark: '#a21caf' },
    rotations: [
      [0,0,1,0, 1,1,1,0, 0,0,0,0, 0,0,0,0],
      [0,1,0,0, 0,1,0,0, 0,1,1,0, 0,0,0,0],
      [0,0,0,0, 1,1,1,0, 1,0,0,0, 0,0,0,0],
      [1,1,0,0, 0,1,0,0, 0,1,0,0, 0,0,0,0],
    ],
  },
};
const PIECE_TYPES = ['I','O','T','S','Z','J','L'];
```

### 3.4 SCORE_TABLE — スコア・落下速度

```javascript
const SCORE_TABLE = {
  // 同時消去ライン数別スコア（レベルが乗算される）
  lineScore: { 1: 100, 2: 300, 3: 500, 4: 800 }, // 4=Tetris
  softDropPoint: 1,   // ソフトドロップ1セルごとに+1
  hardDropPoint: 2,   // ハードドロップ1セルごとに+2
  linesPerLevel: 10,  // 10ライン消去ごとにレベルアップ
  // レベル別落下間隔（秒）。レベル0が初期値、最大29でクリップ
  dropInterval(level) {
    const lv = Math.min(level, 29);
    return Math.pow(0.8 - (lv * 0.007), lv); // 標準テトリスの近似式
  },
};
const LOCK_DELAY = 0.5; // ロック遅延（秒）
const SOFT_DROP_FACTOR = 12; // ソフトドロップ時の落下速度倍率の目安（落下間隔を1/12に）
```

---

## 4. クラス・モジュール設計

### 4.1 BagRandomizer

```javascript
class BagRandomizer {
  constructor() { this.bag = []; }
  next() {
    if (this.bag.length === 0) {
      this.bag = [...PIECE_TYPES];
      // Fisher-Yatesシャッフル
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    return this.bag.pop();
  }
}
```

### 4.2 Field

```javascript
class Field {
  constructor() {
    this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    // セルの値: null=空、それ以外は { type: 'I'|'O'|... } （色参照用）
  }

  // ピースが指定位置・回転で配置可能か判定
  canPlace(piece, dx = 0, dy = 0, rotation = piece.rotation) {
    const cells = getPieceCells(piece.type, rotation);
    for (const [cx, cy] of cells) {
      const x = piece.x + cx + dx;
      const y = piece.y + cy + dy;
      if (x < 0 || x >= COLS || y >= ROWS) return false;
      if (y >= 0 && this.grid[y][x]) return false;
    }
    return true;
  }

  // ピースをグリッドに固定する
  lockPiece(piece) {
    const cells = getPieceCells(piece.type, piece.rotation);
    for (const [cx, cy] of cells) {
      const x = piece.x + cx, y = piece.y + cy;
      if (y >= 0) this.grid[y][x] = { type: piece.type };
    }
  }

  // 揃った行を検出して削除し、削除した行数を返す
  // 戻り値: 削除された行インデックスの配列（エフェクト用）
  clearLines() {
    const clearedRows = [];
    for (let y = 0; y < ROWS; y++) {
      if (this.grid[y].every(cell => cell !== null)) clearedRows.push(y);
    }
    for (const y of clearedRows) {
      this.grid.splice(y, 1);
      this.grid.unshift(Array(COLS).fill(null));
    }
    return clearedRows;
  }

  // 最上段（y=0,1）にブロックが残っている＝ゲームオーバー
  isGameOver() {
    return this.grid[0].some(c => c !== null) || this.grid[1].some(c => c !== null);
  }
}

// PIECES.rotations[rotation] (16要素) から座標リスト [[x,y], ...] を生成
function getPieceCells(type, rotation) {
  const shape = PIECES[type].rotations[rotation];
  const cells = [];
  for (let i = 0; i < 16; i++) {
    if (shape[i]) cells.push([i % 4, Math.floor(i / 4)]);
  }
  return cells;
}
```

### 4.3 Piece（操作中ピース）

```javascript
class Piece {
  constructor(type) {
    this.type = type;
    this.rotation = 0;
    this.x = 3; // 4x4バウンディングボックスの左上x（COLS=10の中央寄せ）
    this.y = type === 'I' ? -1 : 0; // Iミノは見た目調整で-1スタート
    this.lockTimer = 0;
  }

  // SRS簡易壁蹴りテーブル（JLSTZ用）。I・Oは別途簡易対応
  static get WALL_KICKS() {
    return {
      JLSTZ: [
        [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]], // 0->R
        [[0,0],[1,0],[1,-1],[0,2],[1,2]],     // R->2
        [[0,0],[1,0],[1,1],[0,-2],[1,-2]],    // 2->L
        [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],  // L->0
      ],
      I: [
        [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
        [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
        [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
        [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
      ],
    };
  }

  // 回転試行。fieldとの衝突判定+壁蹴りを行い、成功すればtrueを返す
  tryRotate(field, dir) { /* dir: +1=CW, -1=CCW。WALL_KICKSを順に試し、canPlaceがtrueになったら適用 */ }

  moveLeft(field)  { if (field.canPlace(this, -1, 0)) this.x -= 1; }
  moveRight(field) { if (field.canPlace(this, 1, 0)) this.x += 1; }

  // 1段下に落下できるか試し、できればtrue、できなければfalse
  moveDown(field) {
    if (field.canPlace(this, 0, 1)) { this.y += 1; return true; }
    return false;
  }

  // ハードドロップ: 落下可能な最大距離を返す（描画・スコア計算用）
  getGhostY(field) {
    let gy = this.y;
    while (field.canPlace(this, 0, gy - this.y + 1)) gy++;
    return gy;
  }
}
```

### 4.4 EffectManager

```javascript
class EffectManager {
  constructor() {
    this.lineFlashes = [];   // { row, t, duration } ライン消去フラッシュ
    this.particles = [];     // { x, y, vx, vy, life, color, r } きらめき粒子
    this.comboText = null;   // { text, t, duration }
    this.levelUpRing = null; // { t, duration }
  }

  // ライン消去時に呼ぶ。clearedRows: 行インデックス配列
  triggerLineClear(clearedRows) {
    for (const row of clearedRows) {
      this.lineFlashes.push({ row, t: 0, duration: 0.25 });
      for (let i = 0; i < 16; i++) {
        this.particles.push({
          x: FIELD_X + Math.random() * (COLS * CELL),
          y: FIELD_Y + row * CELL + CELL / 2,
          vx: (Math.random() - 0.5) * 120,
          vy: (Math.random() - 0.5) * 120 - 40,
          life: 0.6, age: 0,
          color: Math.random() < 0.5 ? '#22d3ee' : '#a78bfa',
          r: 1.5 + Math.random() * 2,
        });
      }
    }
  }

  triggerCombo(count) {
    this.comboText = { text: `COMBO x${count}`, t: 0, duration: 1.0 };
  }

  triggerLevelUp() {
    this.levelUpRing = { t: 0, duration: 0.8 };
  }

  update(dt) {
    this.lineFlashes = this.lineFlashes.filter(f => (f.t += dt) < f.duration);
    this.particles = this.particles.filter(p => {
      p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt;
      return p.age < p.life;
    });
    if (this.comboText && (this.comboText.t += dt) > this.comboText.duration) this.comboText = null;
    if (this.levelUpRing && (this.levelUpRing.t += dt) > this.levelUpRing.duration) this.levelUpRing = null;
  }

  draw(ctx) {
    // lineFlashes: フィールド幅いっぱいに白〜シアンの矩形をフェードアウト描画
    // particles: 円を globalAlpha = 1 - age/life で描画
    // comboText: フィールド中央上部にGameKit.UI.textでフェードイン/アウト
    // levelUpRing: フィールド中央に同心円（リング）をscale 0->1.5, alpha 1->0で描画
  }
}
```

### 4.5 SoundFx

```javascript
class SoundFx {
  constructor(game, save) {
    this.audio = game.audio; // GameKit.Sfx インスタンス
    this.muted = save.get('mute', false);
  }
  toggleMute(save) { this.muted = !this.muted; save.set('mute', this.muted); }

  move()    { if (!this.muted) this.audio.beep(220, 0.04, 'square', 0.08); }
  rotate()  { if (!this.muted) this.audio.beep(330, 0.05, 'triangle', 0.1); }
  lock()    { if (!this.muted) this.audio.beep(165, 0.06, 'square', 0.1); }
  hold()    { if (!this.muted) this.audio.beep(440, 0.08, 'sine', 0.1); }

  // 1〜4ライン消去で音階・音数を変える
  lineClear(count) {
    if (this.muted) return;
    const notes = {
      1: [{ f: 523, d: 0.08 }],
      2: [{ f: 523, d: 0.07 }, { f: 659, d: 0.08 }],
      3: [{ f: 523, d: 0.06 }, { f: 659, d: 0.06 }, { f: 784, d: 0.08 }],
      4: [{ f: 523, d: 0.06 }, { f: 659, d: 0.06 }, { f: 784, d: 0.06 }, { f: 1047, d: 0.14 }],
    };
    this.audio.jingle(notes[count] || notes[1], 'triangle', 0.15);
  }

  levelUp() {
    if (this.muted) return;
    this.audio.jingle([{ f: 659, d: 0.1 }, { f: 784, d: 0.1 }, { f: 988, d: 0.2 }], 'triangle', 0.18);
  }

  gameOver() {
    if (this.muted) return;
    this.audio.jingle([{ f: 392, d: 0.15 }, { f: 330, d: 0.15 }, { f: 220, d: 0.3 }], 'sawtooth', 0.15);
  }
}
```

### 4.6 TitleScene

```javascript
class TitleScene extends GameKit.Scene {
  enter() {
    this.particles = new GameKit.Particles(W, H, { count: 80 });
    this.t = 0;
  }
  update(dt, game) {
    this.t += dt;
    this.particles.update(dt);
    if (game.input.justPressed('Space') || game.input.pointer.justPressed) {
      game.audio.jingle([{ f: 523, d: 0.1 }, { f: 659, d: 0.1 }, { f: 784, d: 0.18 }]);
      game.changeScene(new PlayScene());
    }
  }
  draw(ctx, game) {
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 0, W, H);
    this.particles.draw(ctx);

    GameKit.UI.glassPanel(ctx, W/2 - 260, H/2 - 170, 520, 340);
    GameKit.UI.text(ctx, 'PRISMFALL', W/2, H/2 - 140, { font: 'bold 48px "Segoe UI", sans-serif', color: '#22d3ee' });
    GameKit.UI.text(ctx, 'プリズムフォール', W/2, H/2 - 90, { color: '#a78bfa', font: '20px sans-serif' });
    GameKit.UI.text(ctx, 'HIGH SCORE / ハイスコア: ' + save.get('hiscore', 0), W/2, H/2 - 50, { color: '#e2e8f0', font: '16px sans-serif' });

    const blink = Math.sin(this.t * 4) > -0.3;
    if (blink) {
      GameKit.UI.text(ctx, 'Click / Space to Start', W/2, H/2, { color: '#22d3ee', font: 'bold 18px sans-serif' });
      GameKit.UI.text(ctx, 'クリック / Space で開始', W/2, H/2 + 26, { color: '#22d3ee', font: '16px sans-serif' });
    }

    // 操作説明（複数行）
    const lines = [
      '←→: 移動 / Move    ↑ or Z: 回転 / Rotate',
      '↓: ソフトドロップ / Soft Drop    Space: ハードドロップ / Hard Drop',
      'C: ホールド / Hold    P: ポーズ / Pause',
    ];
    lines.forEach((l, i) => {
      GameKit.UI.text(ctx, l, W/2, H/2 + 70 + i * 24, { color: '#94a3b8', font: '13px sans-serif' });
    });
  }
}
```

### 4.7 PlayScene（本体）

```javascript
class PlayScene extends GameKit.Scene {
  enter() {
    this.particles = new GameKit.Particles(W, H, { count: 40 });
    this.field = new Field();
    this.bag = new BagRandomizer();
    this.nextQueue = [this.bag.next(), this.bag.next(), this.bag.next()];
    this.current = new Piece(this.nextQueue.shift());
    this.refillQueue();
    this.holdType = null;
    this.canHold = true;
    this.score = 0;
    this.level = 0;
    this.lines = 0;
    this.combo = -1; // -1=直前消去なし
    this.dropTimer = 0;
    this.state = 'playing'; // 'playing' | 'paused' | 'gameover'
    this.fx = new EffectManager();
    this.sfx = new SoundFx(game, save);
    this.hiscoreUpdated = false;
    TouchControls.bind(this);
  }

  exit() {
    TouchControls.unbind();
  }

  refillQueue() {
    while (this.nextQueue.length < 3) this.nextQueue.push(this.bag.next());
  }

  spawnNext() {
    this.current = new Piece(this.nextQueue.shift());
    this.refillQueue();
    this.canHold = true;
    if (!this.field.canPlace(this.current)) {
      this.state = 'gameover';
      this.sfx.gameOver();
      const hi = save.get('hiscore', 0);
      if (this.score > hi) { save.set('hiscore', this.score); this.hiscoreUpdated = true; }
    }
  }

  update(dt, game) {
    this.particles.update(dt);
    this.fx.update(dt);

    // ポーズ切り替え（playing/paused間のみ）
    if (game.input.justPressed('KeyP') || game.input.justPressed('Escape')) {
      if (this.state === 'playing') this.state = 'paused';
      else if (this.state === 'paused') this.state = 'playing';
    }

    if (this.state === 'gameover') {
      if (game.input.justPressed('Space') || game.input.pointer.justPressed) {
        game.changeScene(new TitleScene());
      }
      return;
    }
    if (this.state === 'paused') return;

    // --- 入力処理（移動・回転・ホールド・ハードドロップ） ---
    if (game.input.justPressed('ArrowLeft') || game.input.justPressed('KeyA') || TouchControls.consume('left')) {
      this.current.moveLeft(this.field); this.sfx.move();
    }
    if (game.input.justPressed('ArrowRight') || game.input.justPressed('KeyD') || TouchControls.consume('right')) {
      this.current.moveRight(this.field); this.sfx.move();
    }
    if (game.input.justPressed('ArrowUp') || game.input.justPressed('KeyW') || game.input.justPressed('KeyX') || TouchControls.consume('rotate')) {
      if (this.current.tryRotate(this.field, +1)) this.sfx.rotate();
    }
    if (game.input.justPressed('KeyZ')) {
      if (this.current.tryRotate(this.field, -1)) this.sfx.rotate();
    }
    if ((game.input.justPressed('KeyC') || game.input.justPressed('ShiftLeft') || TouchControls.consume('hold')) && this.canHold) {
      this.doHold();
    }
    if (game.input.justPressed('Space') || TouchControls.consume('drop')) {
      this.doHardDrop();
    }

    // --- 落下処理 ---
    const softDrop = game.input.isDown('ArrowDown') || game.input.isDown('KeyS') || TouchControls.isDown('down');
    const interval = SCORE_TABLE.dropInterval(this.level) / (softDrop ? SOFT_DROP_FACTOR : 1);
    this.dropTimer += dt;
    if (this.dropTimer >= interval) {
      this.dropTimer = 0;
      if (this.current.moveDown(this.field)) {
        if (softDrop) this.score += SCORE_TABLE.softDropPoint;
      } else {
        this.current.lockTimer += interval;
        if (this.current.lockTimer >= LOCK_DELAY) this.lockCurrent();
      }
    }
  }

  doHold() {
    this.sfx.hold();
    if (this.holdType === null) {
      this.holdType = this.current.type;
      this.spawnNext();
    } else {
      const tmp = this.holdType;
      this.holdType = this.current.type;
      this.current = new Piece(tmp);
    }
    this.canHold = false;
  }

  doHardDrop() {
    const ghostY = this.current.getGhostY(this.field);
    this.score += (ghostY - this.current.y) * SCORE_TABLE.hardDropPoint;
    this.current.y = ghostY;
    this.lockCurrent();
  }

  lockCurrent() {
    this.field.lockPiece(this.current);
    this.sfx.lock();
    const cleared = this.field.clearLines();
    if (cleared.length > 0) {
      this.fx.triggerLineClear(cleared);
      this.sfx.lineClear(cleared.length);
      this.score += SCORE_TABLE.lineScore[cleared.length] * (this.level + 1);
      this.lines += cleared.length;
      this.combo += 1;
      if (this.combo > 0) this.fx.triggerCombo(this.combo);
      const newLevel = Math.floor(this.lines / SCORE_TABLE.linesPerLevel);
      if (newLevel > this.level) {
        this.level = newLevel;
        this.fx.triggerLevelUp();
        this.sfx.levelUp();
      }
    } else {
      this.combo = -1;
    }
    if (this.field.isGameOver()) {
      this.state = 'gameover';
      this.sfx.gameOver();
      const hi = save.get('hiscore', 0);
      if (this.score > hi) { save.set('hiscore', this.score); this.hiscoreUpdated = true; }
      return;
    }
    this.spawnNext();
  }

  draw(ctx, game) {
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 0, W, H);
    this.particles.draw(ctx);

    this.drawField(ctx);
    this.drawGhost(ctx);
    this.drawCurrentPiece(ctx);
    this.fx.draw(ctx);
    this.drawSidePanels(ctx);

    if (this.state === 'paused') this.drawPauseOverlay(ctx);
    if (this.state === 'gameover') this.drawGameOverOverlay(ctx);
  }

  // --- 描画ヘルパー（詳細はセクション5参照） ---
  drawField(ctx) { /* ... */ }
  drawGhost(ctx) { /* ... */ }
  drawCurrentPiece(ctx) { /* ... */ }
  drawSidePanels(ctx) { /* HOLD / SCORE-LEVEL-LINES / NEXT / MUTEボタン */ }
  drawPauseOverlay(ctx) { /* ... */ }
  drawGameOverOverlay(ctx) { /* ... */ }
}
```

### 4.8 TouchControls

```javascript
const TouchControls = {
  _pressed: {},  // { left: true, ... } 1フレームのみ消費
  _down: {},     // { down: true } 押し続け状態
  _handlers: [],

  bind(scene) {
    const map = {
      'btn-left': 'left', 'btn-right': 'right', 'btn-down': 'down',
      'btn-rotate': 'rotate', 'btn-hold': 'hold', 'btn-drop': 'drop',
    };
    for (const [id, action] of Object.entries(map)) {
      const el = document.getElementById(id);
      const onDown = (e) => { e.preventDefault(); this._pressed[action] = true; this._down[action] = true; };
      const onUp = (e) => { e.preventDefault(); this._down[action] = false; };
      el.addEventListener('touchstart', onDown, { passive: false });
      el.addEventListener('touchend', onUp);
      el.addEventListener('mousedown', onDown);
      el.addEventListener('mouseup', onUp);
      this._handlers.push([el, onDown, onUp]);
    }
  },

  unbind() {
    for (const [el, onDown, onUp] of this._handlers) {
      el.removeEventListener('touchstart', onDown);
      el.removeEventListener('touchend', onUp);
      el.removeEventListener('mousedown', onDown);
      el.removeEventListener('mouseup', onUp);
    }
    this._handlers = [];
    this._pressed = {}; this._down = {};
  },

  // 1回限りのトリガー消費（justPressed相当）
  consume(action) {
    if (this._pressed[action]) { this._pressed[action] = false; return true; }
    return false;
  },
  isDown(action) { return !!this._down[action]; },
};
```

### 4.9 シーン起動

```javascript
game.changeScene(new TitleScene());
game.start();
```

---

## 5. 描画詳細仕様（「ビジュアルが綺麗」を実現する具体演出）

### 5.1 ブロック描画関数 `drawBlock(ctx, x, y, colorSet)`

各テトリミノブロック1マスを「ガラス・宝石風」に描く共通関数。`colorSet = { base, light, dark }`。

```javascript
function drawBlock(ctx, px, py, colorSet, opts = {}) {
  const size = CELL;
  const pad = 1;
  ctx.save();
  // 外周グロー（控えめ。shadowBlurは6px程度に抑える）
  ctx.shadowColor = colorSet.base;
  ctx.shadowBlur = opts.glow || 6;

  // ベースグラデーション（左上=light、右下=dark）
  const grad = ctx.createLinearGradient(px, py, px + size, py + size);
  grad.addColorStop(0, colorSet.light);
  grad.addColorStop(0.5, colorSet.base);
  grad.addColorStop(1, colorSet.dark);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(px + pad, py + pad, size - pad * 2, size - pad * 2, 4);
  ctx.fill();

  // 上部ハイライト（ガラスの反射）
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.roundRect(px + pad + 2, py + pad + 2, size - pad * 2 - 4, (size - pad * 2) * 0.35, 3);
  ctx.fill();

  ctx.restore();
}
```

- ゴーストピース描画時は `opts.glow = 0` かつ `globalAlpha = 0.25` で `drawBlock` を呼び、塗りつぶしの代わりに枠線のみ（`ctx.strokeStyle = colorSet.base; ctx.lineWidth = 2; ctx.stroke()`）にする軽量版 `drawGhostBlock` を別途用意する。

### 5.2 フィールド描画 `drawField(ctx)`

1. `GameKit.UI.glassPanel(ctx, FIELD_X - 4, FIELD_Y - 4, COLS*CELL + 8, ROWS*CELL + 8)` でフィールド全体の枠をGlassmorphism表示
2. グリッド線: `rgba(255,255,255,0.04)` の細線を1セルごとに描画（C-02相当。任意）
3. `field.grid` をループし、埋まっているセルに `drawBlock(ctx, FIELD_X + x*CELL, FIELD_Y + y*CELL, PIECES[cell.type].color)`
4. `fx.lineFlashes` がある行は、白〜シアンの半透明矩形を `globalAlpha = 1 - (flash.t / flash.duration)` で重畳描画

### 5.3 現在ピース・ゴースト描画

- `drawGhost`: `current.getGhostY(field)` で算出したY位置に、ゴースト用の半透明ブロックを描画（5.1の軽量版）
- `drawCurrentPiece`: `getPieceCells(current.type, current.rotation)` の各セルに `drawBlock` を通常描画（`opts.glow = 8` でやや強めのグロー、ロックタイマーが進むにつれ `glow` を線形に増加させ着地直前を強調してもよい＝Could相当）

### 5.4 サイドパネル描画 `drawSidePanels(ctx)`

- HOLDパネル: `GameKit.UI.glassPanel` + `GameKit.UI.text(ctx, 'HOLD', ...)`。`holdType` があれば中央に縮小表示（セルサイズ16px程度のミニブロックで4x4を描画）
- SCORE/LEVEL/LINESパネル: `GameKit.UI.text` でラベル+数値を3行表示（"SCORE / スコア", "LEVEL / レベル", "LINES / ライン"）
- NEXTパネル: `nextQueue` の3要素を縦に並べ、各々ミニブロック表示
- MUTEボタン: `GameKit.UI.glassPanel` + アイコンテキスト（🔇/🔊相当はテキスト "MUTE" / "SOUND" で代替し、`game.input.pointer` のクリック判定でトグル。座標は基本設計書3.2のMUTEパネル範囲を使用）

### 5.5 コンボ・レベルアップ・ライン消去エフェクト（`EffectManager.draw`）

- **ライン消去パーティクル**: `fx.particles` の各要素を `ctx.globalAlpha = 1 - p.age/p.life` で円描画。色は `#22d3ee` / `#a78bfa` のランダム
- **ライン消去フラッシュ**: 該当行を `rgba(255,255,255, alpha)` → `rgba(34,211,238, alpha)` のグラデーションでオーバーレイ（`alpha = 1 - flash.t/flash.duration`）
- **コンボ表示**: フィールド中央上部（`FIELD_X + COLS*CELL/2, FIELD_Y + 40`）に `GameKit.UI.text` で `comboText.text` を表示。`alpha` をsin波でフェードイン/アウト
- **レベルアップ演出**: フィールド中央に同心円リングを2〜3本、`scale = t/duration * 1.5`、`alpha = 1 - t/duration` で描画（`ctx.strokeStyle = '#a78bfa'` / `'#22d3ee'` を交互に）。同時に `GameKit.UI.glassPanel` で「LEVEL UP! / レベルアップ！」を画面中央にオーバーレイ表示

### 5.6 ポーズ・ゲームオーバーオーバーレイ

```javascript
drawPauseOverlay(ctx) {
  ctx.fillStyle = 'rgba(5,7,13,0.7)';
  ctx.fillRect(FIELD_X, FIELD_Y, COLS*CELL, ROWS*CELL);
  GameKit.UI.glassPanel(ctx, FIELD_X + 20, FIELD_Y + 200, COLS*CELL - 40, 80);
  GameKit.UI.text(ctx, 'PAUSED', FIELD_X + COLS*CELL/2, FIELD_Y + 220, { color: '#22d3ee', font: 'bold 22px sans-serif' });
  GameKit.UI.text(ctx, '一時停止 (P で再開)', FIELD_X + COLS*CELL/2, FIELD_Y + 250, { color: '#a78bfa', font: '14px sans-serif' });
}

drawGameOverOverlay(ctx) {
  ctx.fillStyle = 'rgba(5,7,13,0.75)';
  ctx.fillRect(FIELD_X, FIELD_Y, COLS*CELL, ROWS*CELL);
  GameKit.UI.glassPanel(ctx, FIELD_X + 10, FIELD_Y + 120, COLS*CELL - 20, 240);
  GameKit.UI.text(ctx, 'GAME OVER', FIELD_X + COLS*CELL/2, FIELD_Y + 145, { color: '#22d3ee', font: 'bold 22px sans-serif' });
  GameKit.UI.text(ctx, 'ゲームオーバー', FIELD_X + COLS*CELL/2, FIELD_Y + 170, { color: '#a78bfa', font: '14px sans-serif' });
  GameKit.UI.text(ctx, 'SCORE / スコア: ' + this.score, FIELD_X + COLS*CELL/2, FIELD_Y + 205, { font: '14px sans-serif' });
  GameKit.UI.text(ctx, 'LEVEL / レベル: ' + this.level, FIELD_X + COLS*CELL/2, FIELD_Y + 228, { font: '14px sans-serif' });
  GameKit.UI.text(ctx, 'LINES / ライン: ' + this.lines, FIELD_X + COLS*CELL/2, FIELD_Y + 251, { font: '14px sans-serif' });
  if (this.hiscoreUpdated) {
    GameKit.UI.text(ctx, 'NEW HIGH SCORE! / ハイスコア更新！', FIELD_X + COLS*CELL/2, FIELD_Y + 280, { color: '#22d3ee', font: 'bold 13px sans-serif' });
  }
  GameKit.UI.text(ctx, 'Click / Space でタイトルへ', FIELD_X + COLS*CELL/2, FIELD_Y + 320, { color: '#94a3b8', font: '12px sans-serif' });
}
```

---

## 6. デザイン演出チェックリスト（サイバーパンク禁止の確認）

| 項目 | 方針 |
|---|---|
| グロー強度 | `shadowBlur` は6〜8px程度に限定。過度な発光・走査線・グリッチは実装しない |
| 配色 | シアン(`#22d3ee`)・パープル(`#a78bfa`)とその明暗バリエーションのみ。原色赤緑黄は使用しない |
| フォント | 既存ポートフォリオと同じ `"Segoe UI", "Hiragino Sans", sans-serif`。装飾的なサイバーフォント不使用 |
| UI構造 | `GameKit.UI.glassPanel` を全パネルに統一適用し、Glassmorphismの質感で統一 |
| 背景演出 | `GameKit.Particles` のデフォルト色（シアン/パープル）をそのまま使用 |

---

## 7. Code-Generatorへの実装指示

1. `gamekit/template.html` を `C:\Users\hifuk\Documents\Git_hub\hide_0001_hon\prismfall.html` としてコピーする
2. `<title>` を `PrismFall | プリズムフォール` に変更
3. `<canvas>` 直下の操作説明 `<p class="hint">` をセクション2のテキストに差し替える
4. セクション2の `#touch-controls` ブロックとそのCSSを追加する
5. `<script>` 内を全面差し替えし、セクション3〜4で定義した定数・クラス・シーンを実装する:
   - `PIECES`, `PIECE_TYPES`, `SCORE_TABLE`, `LOCK_DELAY`, `SOFT_DROP_FACTOR`（セクション3）
   - `BagRandomizer`, `Field`, `getPieceCells`, `Piece`, `EffectManager`, `SoundFx`, `TouchControls`（セクション4.1〜4.5, 4.8）
   - `TitleScene`, `PlayScene`（セクション4.6〜4.7）。`PlayScene` の描画ヘルパー（`drawField`, `drawGhost`, `drawCurrentPiece`, `drawSidePanels`, `drawPauseOverlay`, `drawGameOverOverlay`）はセクション5の仕様に従って実装する
   - `drawBlock`, `drawGhostBlock` 共通関数（セクション5.1）
6. `Piece.tryRotate` はSRS壁蹴りテーブル（セクション4.3 `WALL_KICKS`）を使用し、`field.canPlace` がtrueになる最初のオフセットを採用する。全て失敗した場合は回転をキャンセルする
7. ハイスコア・ミュート設定は `new GameKit.Save('prismfall')` で永続化する（キー: `hiscore`, `mute`）
8. MUTEボタンのクリック判定は `game.input.pointer` の座標とMUTEパネルの矩形範囲（基本設計書3.2参照）を比較し、`pointer.justPressed` 時に `sfx.toggleMute(save)` を呼ぶ
9. 実装完了後、`git diff HEAD` で `prismfall.html` の新規追加内容をEvaluatorへ提出する（ファイル全体の貼り付けは禁止。新規ファイルなのでdiffは追加行のみとなる）

---

## 8. 動作確認観点（Dynamic-Tester向け参考情報）

- ページロード時にJSランタイムエラーが発生しないこと
- Canvas上にタイトル画面が描画されること（`PRISMFALL` テキストの存在確認）
- Space押下でPlaySceneに遷移し、フィールド・テトリミノが描画されること
- 7種テトリミノが全て正しい形状・色で描画されること（コンソールエラーなし）
- 矢印キー操作でブロックが移動・回転すること
- ライン消去・スコア加算・レベルアップが発生してもエラーが出ないこと
- ゲームオーバー後、Space押下でTitleSceneに戻ること
- 404になる外部アセットが存在しないこと（`gamekit/gamekit.js` 以外の外部参照がないこと）
