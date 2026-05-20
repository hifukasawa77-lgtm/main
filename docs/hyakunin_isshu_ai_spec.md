# 百人一首かるた — 対AIモード 設計書

バージョン: 1.0  
作成日: 2026-05-20  
対象ファイル: `hyakunin_isshu.html`

---

## 1. 要件定義

### 1.1 背景・目的

既存のひとりプレイモード（上の句を読んで下の句の取り札を選ぶ）に加え、AIと対戦する「対AIモード」を追加する。AIが一定の反応速度で取り札を奪いに来ることで、ゲームに緊張感と競技性を与える。

### 1.2 機能要件（MoSCoW法）

#### Must（必須）

| ID | 要件 |
|----|------|
| M-01 | スタート画面に「ひとりプレイ」と「対AIモード」の選択UIを追加する |
| M-02 | 対AIモードでは難易度ごとにAI反応速度が変わる（弱/普通/強/鬼強） |
| M-03 | 上の句が読まれてから一定時間後にAIが正解札を取る（タイマーベース） |
| M-04 | プレイヤーが先にクリックすれば「プレイヤー得点」、AIが先に取れば「AI得点」 |
| M-05 | ゲーム終了時にプレイヤースコアとAIスコアを比較して勝敗を表示する |
| M-06 | プレイヤーが誤った札をクリックした場合、その問題はAI有利になるペナルティを与える |
| M-07 | 対AIモードでも既存の難易度（練習/初級/中級/上級）の問題数・場枚数設定を維持する |
| M-08 | Canvas上でプレイヤー陣地とAI陣地のスコア表示領域を確保する |

#### Should（推奨）

| ID | 要件 |
|----|------|
| S-01 | AIが取る瞬間にアニメーション（別色フラッシュ）で視覚的フィードバックを出す |
| S-02 | 結果画面に「勝ち / 負け / 引き分け」を日英両語で大きく表示する |
| S-03 | AIの思考中を示す「プログレス表示」（残り時間バー）をCanvas上に描画する |

#### Could（任意）

| ID | 要件 |
|----|------|
| C-01 | AIがたまり（人間らしく）取り損ねる演出（難易度「弱」のみ、低確率でAIが取らない） |
| C-02 | 効果音（Web Audio API で生成、CDN不使用） |

#### Won't（今回スコープ外）

| ID | 要件 |
|----|------|
| W-01 | 通信対戦（マルチプレイヤー）機能 |
| W-02 | AIの学習・強化学習による適応 |

### 1.3 ゲームルール詳細

#### 基本フロー（対AIモード）

1. 上の句が表示・読み上げられる（既存の `speakKami` を流用）
2. 上の句が読まれ始めた瞬間（`speakKami` 呼び出し時）にAIタイマーを開始する
3. AIタイマーが切れると、AIが正解札を取得する
4. タイマーが切れる前にプレイヤーが正解札をクリックすれば「プレイヤー得点」
5. タイマーが切れる前にプレイヤーが誤札をクリックした場合：
   - ミスカウントを増やす（既存の `mistakeCount` と同一カウンタ）
   - **ペナルティ**: AIの取得待機時間を現在の残り時間の 50% に短縮する（競技かるたの「お手つき」相当の簡略版）
6. 問題ごとにどちらが取ったかを記録し、`playerScore` / `aiScore` を更新する

#### 勝敗条件

- 全問終了後、`playerScore > aiScore` → プレイヤー勝ち
- `playerScore < aiScore` → AI勝ち
- `playerScore === aiScore` → 引き分け

### 1.4 AI難易度と反応速度

| 難易度 | AI反応速度（秒） | 備考 |
|--------|-----------------|------|
| 弱 (weak) | 3.0 〜 5.0秒 | ランダム幅大、取り損ね率 15% |
| 普通 (normal) | 1.5 〜 3.0秒 | ランダム幅中、取り損ね率 0% |
| 強 (strong) | 0.5 〜 1.5秒 | ランダム幅小、取り損ね率 0% |
| 鬼強 (expert) | 0.2 〜 0.8秒 | ランダム幅最小、取り損ね率 0% |

反応速度の計算式:  
`delay = min + Math.random() * (max - min)` （単位: 秒）

### 1.5 非機能要件

| 区分 | 要件 |
|------|------|
| セキュリティ | `innerHTML` 禁止を継続。DOM操作は全て `textContent` / `createElement` を使用 |
| パフォーマンス | `setInterval` を使わず `setTimeout` + `requestAnimationFrame` で描画ループを管理する |
| 互換性 | Chrome / Firefox / Safari（モバイル含む）の最新版で動作すること |
| 保守性 | 既存の `KarutaGame` クラス・`CardRenderer` クラスを壊さず拡張すること |
| ファイル | 単一ファイル完結（`hyakunin_isshu.html`）を維持。CDNライブラリの追加なし |

### 1.6 制約条件

- フレームワーク不使用（素のHTML/CSS/JS）
- Canvas API のみで取り札描画を行う（既存 `CardRenderer` を拡張）
- ダークテーマ・Glassmorphismデザインを維持
- サイバーパンク的演出禁止（ネオングロウ過多は不可）

---

## 2. 基本設計

### 2.1 画面構成の変更

#### スタート画面の変更

既存の難易度選択ボタン上に「プレイモード選択」セクションを追加する。

```
[スタート画面]
  タイトル: 百人一首かるた

  ── プレイモード ──────────────────
  [ひとりプレイ]  [対AIモード]
  ──────────────────────────────────

  ── 難易度 ───────────────────────
  [練習] [初級] [中級] [上級]
  ──────────────────────────────────

  （対AIモード選択時のみ表示）
  ── AI強さ ──────────────────────
  [弱] [普通] [強] [鬼強]
  ──────────────────────────────────

  [ゲーム開始]
```

#### ゲーム画面のinfo-barの変更

現在の `info-bar` を対AIモード時に拡張する。

ひとりプレイ時（現状維持）:
```
  0 / 10 問   正解 0   ミス 0
```

対AIモード時:
```
  0 / 10 問   あなた: 0   AI: 0   ミス 0
```

#### ゲーム画面のCanvas変更

対AIモード時、Canvasの最上部にAIプログレスバー（AIが取るまでの残り時間表示）を描画する領域を設ける。  
高さ: 24px。取り札フィールドの上に配置。

```
[Canvas]
┌──────────────────────────────┐
│ AI残り時間バー（対AIモード時のみ）│  24px
├──────────────────────────────┤
│                              │
│   取り札フィールド              │
│                              │
└──────────────────────────────┘
```

#### 結果画面の変更

ひとりプレイ時（現状維持）:
```
  正解 / Miss / 正答率
```

対AIモード時:
```
  勝ち / 負け / 引き分け（大文字）
  あなた: N  AI: N  ミス: N
```

### 2.2 クラス設計

#### 新規クラス: `KarutaAI`

AIの思考・タイマー管理を担当する独立クラス。

```
KarutaAI
  プロパティ:
    _difficulty: 'weak' | 'normal' | 'strong' | 'expert'
    _timer: タイマーID（setTimeout の戻り値）
    _remaining: 残り時間（ms）。プログレスバー描画用
    _totalDelay: 今問のAI反応時間（ms）
    _startTime: タイマー開始時刻（performance.now()）
    onTake: コールバック関数（AIが取る時に呼ばれる）

  メソッド:
    start(correctId, onTake): 新問題のAIタイマー開始
    cancel(): タイマーをキャンセル（プレイヤーが取った時）
    penalize(): ペナルティ適用（残り時間を50%短縮）
    getProgress(): 0.0〜1.0 の進捗値（プログレスバー描画用）
```

#### 既存クラス: `KarutaGame` の拡張

既存の `KarutaGame` に対AIモード用フィールドを追加する。`answer()` メソッドの戻り値の変更は**行わない**（後方互換を維持）。

追加プロパティ:
- `isVsAI`: boolean（対AIモードフラグ）
- `playerScore`: number（プレイヤー取得枚数）
- `aiScore`: number（AI取得枚数）

追加メソッド:
- `aiTake()`: AIが取った時に呼ぶ。`aiScore++`、`_answered = true` を設定して `'ai_correct'` を返す
- `getVsResult()`: 対AIモードの結果オブジェクトを返す

`start()` メソッド内で `isVsAI` が `true` の場合に `playerScore` / `aiScore` をリセットする。

#### 既存クラス: `CardRenderer` の拡張

`layout()` メソッドに対AIモード時のプログレスバー描画領域の高さオフセットを追加する。  
`draw()` メソッドに対AIモード時のプログレスバー描画処理を追加する。

追加プロパティ:
- `aiProgress`: 0.0〜1.0 の数値。外部から代入するだけでよい（`draw()` 時に参照）
- `isVsAI`: boolean

### 2.3 データ構造の概要

#### AI難易度設定

```javascript
const AI_CONFIG = {
  weak:   { minDelay: 3000, maxDelay: 5000, missRate: 0.15 },
  normal: { minDelay: 1500, maxDelay: 3000, missRate: 0.00 },
  strong: { minDelay:  500, maxDelay: 1500, missRate: 0.00 },
  expert: { minDelay:  200, maxDelay:  800, missRate: 0.00 },
};
```

#### ゲーム状態

```javascript
let game         = null;   // KarutaGame インスタンス（既存）
let renderer     = null;   // CardRenderer インスタンス（既存）
let ai           = null;   // KarutaAI インスタンス（新規）
let selectedMode = null;   // 'practice' | 'easy' | 'medium' | 'hard'（既存）
let playMode     = 'solo'; // 'solo' | 'vs_ai'（新規）
let selectedAI   = null;   // 'weak' | 'normal' | 'strong' | 'expert'（新規）
let _progressRaf = null;   // プログレスバー用アニメーションフレームID（新規）
```

---

## 3. 詳細設計

### 3.1 `KarutaAI` クラス実装

**ファイル内の配置**: `KarutaGame` クラス定義の直後、`CardRenderer` クラス定義の前に記述する。

```javascript
class KarutaAI {
  constructor(difficulty) {
    this._difficulty = difficulty;
    this._cfg = AI_CONFIG[difficulty];
    this._timer = null;
    this._remaining = 0;
    this._totalDelay = 0;
    this._startTime = 0;
    this.onTake = null; // (correctId) => void
  }

  start(correctId, onTake) {
    this.cancel();
    this.onTake = onTake;
    // missRate による取り損ね判定
    if (Math.random() < this._cfg.missRate) {
      // このラウンドはAIが取らない
      this._totalDelay = 0;
      return;
    }
    const { minDelay, maxDelay } = this._cfg;
    this._totalDelay = minDelay + Math.random() * (maxDelay - minDelay);
    this._startTime = performance.now();
    this._timer = setTimeout(() => {
      if (this.onTake) this.onTake(correctId);
    }, this._totalDelay);
  }

  cancel() {
    if (this._timer !== null) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._totalDelay = 0;
  }

  penalize() {
    if (this._timer === null) return;
    clearTimeout(this._timer);
    const elapsed = performance.now() - this._startTime;
    const remaining = Math.max(0, this._totalDelay - elapsed);
    const newDelay = remaining * 0.5;
    this._totalDelay = elapsed + newDelay;
    this._timer = setTimeout(() => {
      if (this.onTake) this.onTake(null); // nullは呼び出し元でcorrectIdを参照
    }, newDelay);
  }

  getProgress() {
    if (this._totalDelay <= 0) return 1.0;
    const elapsed = performance.now() - this._startTime;
    return Math.min(1.0, elapsed / this._totalDelay);
  }
}
```

**注意**: `penalize()` 内の `setTimeout` コールバックで `correctId` が必要なため、`start()` で `correctId` を `this._correctId` として保持し、`penalize()` でも参照できるようにする。

実際の実装では `this._correctId = correctId` を `start()` 内に追加し、`penalize()` の `onTake` 呼び出しを `this.onTake(this._correctId)` とする。

### 3.2 `KarutaGame` クラスへの変更点

`hyakunin_isshu.html` の `KarutaGame` クラス（582行〜661行）に以下を追加・変更する。

#### constructor 変更（587行付近）

```javascript
// 追加するプロパティ（既存の mistakeCount の後に追記）
this.isVsAI = false;
this.playerScore = 0;
this.aiScore = 0;
```

#### start() メソッド変更（594行付近）

```javascript
// 既存の this.score = 0; this.mistakeCount = 0; の後に追記
if (this.isVsAI) {
  this.playerScore = 0;
  this.aiScore = 0;
}
```

#### 追加メソッド（getResult() メソッドの直前、656行付近に挿入）

```javascript
// AIが取った時に呼ぶ
aiTake() {
  if (this._answered) return 'already';
  this._answered = true;
  this.aiScore++;
  return 'ai_correct';
}

// 対AIモードの結果
getVsResult() {
  const base = this.getResult();
  const winner =
    this.playerScore > this.aiScore ? 'player' :
    this.playerScore < this.aiScore ? 'ai' : 'draw';
  return { ...base, playerScore: this.playerScore, aiScore: this.aiScore, winner };
}
```

### 3.3 `CardRenderer` クラスへの変更点

#### constructor 変更（667行付近）

```javascript
// 追加するプロパティ（既存プロパティの後に追記）
this.isVsAI = false;
this.aiProgress = 0; // 0.0〜1.0
```

#### layout() メソッド変更（676行付近）

`layout()` の冒頭で `yOffset` 変数を導入し、対AIモード時はプログレスバー分（32px）だけ取り札グリッドを下にずらす。

変更対象: `const row = Math.floor(idx / cols);` で計算する `y` 座標に加算するオフセット。

```javascript
// layout() 内の冒頭に追加
const progressBarH = this.isVsAI ? 32 : 0;

// 既存の y 座標計算を変更
// 変更前: const y = GAP + row * (CARD_H + GAP);
// 変更後:
const y = progressBarH + GAP + row * (CARD_H + GAP);
```

Canvasの高さ更新部分も同様に `progressBarH` を加算する。  
変更対象行: `this.canvas.height = fieldH + ...` の計算部分。

#### draw() メソッド変更（709行付近）

`draw()` メソッドの冒頭（`ctx.clearRect` の後）に、`isVsAI` が true の場合にプログレスバーを描画する処理を追加する。

```javascript
// draw() の clearRect 直後に追加
if (this.isVsAI) {
  this._drawProgressBar();
}
```

#### 追加メソッド `_drawProgressBar()`（`draw()` メソッドの後に追加）

```javascript
_drawProgressBar() {
  const ctx = this.ctx;
  const cw = this.canvas.width;
  const barY = 6;
  const barH = 14;
  const barX = 8;
  const barW = cw - 16;

  // 背景トラック
  ctx.save();
  ctx.beginPath();
  this._roundRect(ctx, barX, barY, barW, barH, 7);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();

  // 進捗（1.0に近づくほど赤くなる警告色）
  const prog = Math.min(1.0, this.aiProgress);
  const fillW = Math.max(0, barW * (1 - prog)); // 残り時間を表す（右から左へ減る）
  if (fillW > 0) {
    // 色: シアン(0%) → マゼンタ(70%) → レッド(100%)
    const r = Math.round(prog < 0.7 ? prog / 0.7 * 200 : 200 + (prog - 0.7) / 0.3 * 55);
    const g = Math.round(Math.max(0, 200 - prog * 200));
    const b = Math.round(prog < 0.5 ? 255 : 255 - (prog - 0.5) / 0.5 * 200);
    ctx.beginPath();
    this._roundRect(ctx, barX, barY, fillW, barH, 7);
    ctx.fillStyle = `rgba(${r},${g},${b},0.75)`;
    ctx.fill();
  }

  // ラベル
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('AI', barX + 4, barY + barH - 3);
  ctx.restore();
}
```

### 3.4 AI取得タイマー更新ループ

プログレスバーをリアルタイムで更新するため、`requestAnimationFrame` ループを対AIモード中に動かす。  
この関数はゲーム開始時に起動し、ゲーム終了・画面遷移時に停止する。

```javascript
function startProgressLoop() {
  function loop() {
    if (!game || !ai || !renderer || game.isFinished()) return;
    renderer.aiProgress = ai.getProgress();
    renderer.draw();
    _progressRaf = requestAnimationFrame(loop);
  }
  _progressRaf = requestAnimationFrame(loop);
}

function stopProgressLoop() {
  if (_progressRaf !== null) {
    cancelAnimationFrame(_progressRaf);
    _progressRaf = null;
  }
}
```

### 3.5 `onAnswer()` 関数の変更

既存の `onAnswer(poemId)` 関数（961行〜986行）を以下のロジックに変更する。

**変更後の処理フロー:**

1. `game.answer(poemId)` を呼ぶ（既存処理維持）
2. `'correct'` の場合:
   - 対AIモードなら `ai.cancel()` でAIタイマー停止
   - 対AIモードなら `game.playerScore++`（注: `game.answer()` 内での得点カウントは `game.score` のみ。対AIモードでは `playerScore` への加算が必要）
   - 既存のアニメーション・次問遷移処理を実行
3. `'wrong'` の場合:
   - 対AIモードなら `ai.penalize()` を呼び出してペナルティ適用
   - 既存のアニメーション処理を実行

**注意**: `game.answer()` の `'correct'` 判定内で `game.score++` が行われる。対AIモードでは `playerScore++` も同タイミングで行う必要がある。これは `onAnswer()` の呼び出し側で `game.playerScore++` を追加するか、`game.answer()` メソッドを改修して `isVsAI` フラグを参照させる。後者（`answer()` メソッド内で分岐）を採用する。

#### `answer()` メソッド変更（628行〜638行）

```javascript
answer(poemId) {
  if (this._answered) return 'already';
  if (poemId === this.correctId()) {
    this._answered = true;
    this.score++;
    if (this.isVsAI) this.playerScore++;  // 追加
    return 'correct';
  } else {
    this.mistakeCount++;
    return 'wrong';
  }
}
```

#### `onAnswer()` 関数変更

```javascript
function onAnswer(poemId) {
  const result = game.answer(poemId);
  if (result === 'already') return;

  if (result === 'correct') {
    if (playMode === 'vs_ai') ai.cancel();  // 追加
    renderer.animateCorrect(poemId);
    showFeedback('正解！ Correct!', 'correct');
    updateInfoBar(game);
    setTimeout(() => {
      game.nextQuestion();
      if (game.isFinished()) {
        stopProgressLoop();  // 追加
        if (playMode === 'vs_ai') {
          showVsResult(game);  // 追加（後述）
        } else {
          showResult(game);
        }
      } else {
        renderer.layout();
        renderer.draw();
        showYomiArea(game.currentPoem);
        updateInfoBar(game);
        speakKami(game.currentPoem);
        if (playMode === 'vs_ai') {          // 追加
          ai.start(game.correctId(), onAiTake);
        }
      }
    }, 850);
  } else {
    renderer.animateWrong(poemId);
    showFeedback('もう一度 / Try again', 'wrong');
    updateInfoBar(game);
    if (playMode === 'vs_ai') ai.penalize();  // 追加
  }
}
```

### 3.6 AI取得コールバック `onAiTake()`

AIがタイマー切れで取り札を取った時に呼ばれる関数。グローバルスコープで定義する。

```javascript
function onAiTake(correctId) {
  const result = game.aiTake();
  if (result === 'already') return;
  renderer.animateAiTake(correctId);  // 後述
  showFeedback('AIが取りました / AI took it', 'wrong');
  updateInfoBar(game);
  setTimeout(() => {
    game.nextQuestion();
    if (game.isFinished()) {
      stopProgressLoop();
      showVsResult(game);
    } else {
      renderer.layout();
      renderer.draw();
      showYomiArea(game.currentPoem);
      updateInfoBar(game);
      speakKami(game.currentPoem);
      ai.start(game.correctId(), onAiTake);
    }
  }, 850);
}
```

### 3.7 `CardRenderer.animateAiTake()` メソッド追加

AIが取った時に使用する専用アニメーション。既存の `animateCorrect()` と色だけ異なる。  
AI取得色: `rgba(219, 39, 119, 0.7)` （マゼンタ系）

`animateWrong()` メソッドの後に追加する（869行付近）:

```javascript
animateAiTake(poemId) {
  const card = this.cards.find(c => c.id === poemId);
  if (!card) return;
  card.state = 'ai_take';  // 新ステート
  this.draw();
  const start = performance.now();
  const dur = 600;
  const step = (now) => {
    const t = Math.min(1, (now - start) / dur);
    card.alpha = 1 - t;
    this.draw();
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
```

`draw()` -> `_drawCard()` 内のステート分岐に `'ai_take'` を追加する（727行付近）:

```javascript
// 既存の分岐に追加
if (state === 'ai_take') { bg = 'rgba(219,39,119,0.18)'; bd = 'rgba(219,39,119,0.85)'; }
```

`hitTest()` の `card.state !== 'normal'` チェックにより `'ai_take'` ステートのカードはクリック不可となる（既存ロジックで自動対応）。

### 3.8 `updateInfoBar()` 関数の変更

```javascript
function updateInfoBar(game) {
  document.getElementById('label-progress').textContent =
    (game.currentIndex + 1) + ' / ' + game.questions.length;
  if (playMode === 'vs_ai') {
    document.getElementById('label-score').textContent = 'あなた: ' + game.playerScore;
    document.getElementById('label-miss').textContent  = 'AI: ' + game.aiScore;
  } else {
    document.getElementById('label-score').textContent = game.score;
    document.getElementById('label-miss').textContent  = game.mistakeCount;
  }
}
```

**注意**: `label-score` と `label-miss` の前のラベルテキスト（`<span>` 内のテキストノード）も対AIモード時は変更が必要。  
対応策として、`info-bar` の該当 `<span>` 要素に `id="label-score-wrap"` / `id="label-miss-wrap"` を追加し、`updateInfoBar()` 内で `textContent` を書き換える。

または、より簡潔に: 対AIモード時は `label-score` の `<b>` 要素の前のテキストノードを変更する代わりに、`label-score` の `textContent` 自体に「あなた: 0」のような形式で全テキストを入れる（ラベルなしの `<span>` に格納し直す）ことで対応する。実装担当者はこの点を判断して最も保守性の高い方法を選ぶこと。

### 3.9 `showVsResult()` 関数の追加

既存の `showResult()` 関数の後に追加する（916行付近）:

```javascript
function showVsResult(game) {
  const r = game.getVsResult();
  const winnerText =
    r.winner === 'player' ? '勝ち / You Win!' :
    r.winner === 'ai'     ? '負け / AI Wins'  : '引き分け / Draw';
  document.getElementById('res-winner').textContent = winnerText;
  document.getElementById('res-player-score').textContent = r.playerScore;
  document.getElementById('res-ai-score').textContent = r.aiScore;
  document.getElementById('res-miss').textContent = r.miss;
  document.getElementById('res-accuracy').textContent = r.accuracy + '%';
  // 既存のひとりプレイ用スコア表示は非表示にする
  document.getElementById('res-score').closest('.stat').style.display = 'none'; // ひとりプレイ用
  document.getElementById('screen-result-vs').style.display = '';  // 対AIモード用結果を表示
  showScreen('result');
}
```

**実装方針**: 結果画面は「ひとりプレイ用」「対AIモード用」の両方の要素を HTML に含めておき、`playMode` に応じて表示を切り替える。切り替えは `style.display` を `textContent` 形式で操作する（`innerHTML` 禁止のため `createElement` で要素を事前定義）。

### 3.10 HTML変更点の詳細

#### スタート画面に追加するHTML構造（397行付近、`<div class="mode-grid">` の前に挿入）

```html
<div class="play-mode-grid">
  <button class="mode-btn selected" id="btn-solo">ひとりプレイ<br><small>Solo Play</small></button>
  <button class="mode-btn" id="btn-vs-ai">対AIモード<br><small>VS AI</small></button>
</div>
<div id="ai-strength-section" style="display:none">
  <p class="section-label">AI強さ / AI Level</p>
  <div class="mode-grid">
    <button class="mode-btn" data-ai="weak">弱<br><small>Weak</small></button>
    <button class="mode-btn" data-ai="normal">普通<br><small>Normal</small></button>
    <button class="mode-btn" data-ai="strong">強<br><small>Strong</small></button>
    <button class="mode-btn" data-ai="expert">鬼強<br><small>Expert</small></button>
  </div>
</div>
```

#### 結果画面に追加するHTML構造（419行〜428行の `<div id="screen-result">` 内に追加）

```html
<!-- 対AIモード用（通常は非表示） -->
<div id="result-vs-section" style="display:none">
  <p id="res-winner" style="font-size:1.6rem; font-weight:bold; margin-bottom:12px"></p>
  <div class="result-stats">
    <div class="stat"><span id="res-player-score">0</span><small>あなた / You</small></div>
    <div class="stat"><span id="res-ai-score">0</span><small>AI</small></div>
    <div class="stat"><span id="res-miss-vs">0</span><small>ミス / Miss</small></div>
  </div>
</div>
<!-- ひとりプレイ用（既存、対AIモード時は非表示） -->
<div id="result-solo-section">
  <div class="result-stats">
    <div class="stat"><span id="res-score">0</span><small>正解 / Correct</small></div>
    <div class="stat"><span id="res-miss">0</span><small>ミス / Missed</small></div>
    <div class="stat"><span id="res-accuracy">0%</span><small>正答率 / Accuracy</small></div>
  </div>
</div>
```

### 3.11 CSS追加点

既存のCSSブロックに以下を追加する（`.mode-btn` の定義付近に追記）。

```css
.play-mode-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 16px;
}

.section-label {
  font-size: 0.8rem;
  color: rgba(255,255,255,0.5);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 8px 0 6px;
}

#ai-strength-section {
  margin-top: 8px;
}

/* 対AIモード: infobar スコア表示（文字サイズ調整） */
#label-score, #label-miss {
  font-variant-numeric: tabular-nums;
}
```

### 3.12 `startGame()` 関数の変更

```javascript
function startGame() {
  game = new KarutaGame(selectedMode);
  game.isVsAI = (playMode === 'vs_ai');
  game.start();
  renderer = new CardRenderer(canvas, game);
  renderer.isVsAI = (playMode === 'vs_ai');

  if (playMode === 'vs_ai') {
    ai = new KarutaAI(selectedAI);
  } else {
    ai = null;
  }

  showScreen('game');
  resizeCanvas();
  renderer.layout();
  renderer.draw();
  showYomiArea(game.currentPoem);
  updateInfoBar(game);
  speakKami(game.currentPoem);

  if (playMode === 'vs_ai') {
    startProgressLoop();
    ai.start(game.correctId(), onAiTake);
  }
}
```

### 3.13 ゲーム開始ボタンの有効化条件変更

ひとりプレイ: `selectedMode !== null` のみで有効化（既存と同じ）  
対AIモード: `selectedMode !== null && selectedAI !== null` の両方が選択済みで有効化

`document.querySelectorAll('[data-mode]')` のクリックハンドラと、新たに追加する `document.querySelectorAll('[data-ai]')` のクリックハンドラ内で `checkStartable()` を呼ぶ。

```javascript
function checkStartable() {
  const ok = selectedMode !== null &&
             (playMode === 'solo' || selectedAI !== null);
  document.getElementById('btn-start').disabled = !ok;
}
```

---

## 4. ファイル構成案（変更対象）

変更対象は `hyakunin_isshu.html` のみ（単一ファイル完結を維持）。

変更箇所の概要:

| 行範囲（概算） | 変更内容 |
|--------------|----------|
| 140〜375 CSS | `play-mode-grid` / `section-label` / `ai-strength-section` スタイルを追加 |
| 388〜398 HTML | `play-mode-grid` / `ai-strength-section` を挿入 |
| 401〜416 HTML | `info-bar` の `label-score-wrap` / `label-miss-wrap` を id 追加 |
| 419〜429 HTML | `result-solo-section` / `result-vs-section` に分割 |
| 556〜561 JS | `AI_CONFIG` 定数を追加 |
| 582〜661 JS | `KarutaGame` クラスに `isVsAI` / `playerScore` / `aiScore` / `aiTake()` / `getVsResult()` を追加 |
| 661行直後 JS | `KarutaAI` クラスを新規挿入 |
| 666〜870 JS | `CardRenderer` クラスに `isVsAI` / `aiProgress` / `_drawProgressBar()` / `animateAiTake()` を追加 |
| 887〜892 JS | `updateInfoBar()` 関数を変更 |
| 910〜916 JS | `showResult()` 後に `showVsResult()` を追加 |
| 947〜959 JS | `startGame()` 関数を変更 |
| 961〜986 JS | `onAnswer()` 関数を変更 |
| 986行直後 JS | `onAiTake()` / `startProgressLoop()` / `stopProgressLoop()` を追加 |
| 992〜998 JS | `[data-mode]` イベントハンドラを変更（`checkStartable()` 呼び出しに統一） |
| 998行直後 JS | `[data-ai]` / `#btn-solo` / `#btn-vs-ai` のイベントハンドラを追加 |
| 1002〜1004 JS | `startGame()` 呼び出し前の条件変更 |

---

## 5. Generatorへの実装指示まとめ

1. `AI_CONFIG` 定数を `MODE_CONFIG` の直後（555行付近）に追記する
2. `KarutaGame` クラスを仕様書 3.2 の通りに変更する
3. `KarutaGame` クラスの後、`CardRenderer` クラスの前に `KarutaAI` クラスを挿入する（仕様書 3.1 の通り）
4. `CardRenderer` クラスを仕様書 3.3 の通りに変更する（`layout()` / `draw()` / `animateAiTake()` / `_drawProgressBar()` を追加・変更）
5. HTML構造を仕様書 3.10 の通りに変更する（スタート画面 / 結果画面）
6. CSS を仕様書 3.11 の通りに追加する
7. グローバル変数に `playMode` / `selectedAI` / `ai` / `_progressRaf` を追加する
8. `updateInfoBar()` を仕様書 3.8 の通りに変更する
9. `showVsResult()` を仕様書 3.9 の通りに追加する
10. `startGame()` を仕様書 3.12 の通りに変更する
11. `onAnswer()` を仕様書 3.5 の通りに変更する
12. `onAiTake()` / `startProgressLoop()` / `stopProgressLoop()` を仕様書 3.5 / 3.6 の通りに追加する
13. イベントハンドラ（`#btn-solo` / `#btn-vs-ai` / `[data-ai]` / `checkStartable()`）を仕様書 3.13 の通りに追加する
14. `innerHTML` を一切使用しないこと（`textContent` / `createElement` のみ）
15. 既存のひとりプレイモードは一切壊さないこと。`playMode === 'solo'` の分岐で完全に元の挙動を保持すること
