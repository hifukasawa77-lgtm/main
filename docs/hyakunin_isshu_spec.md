# 百人一首かるたゲーム 仕様書

**ファイル**: `hyakunin_isshu.html`
**作成日**: 2026-05-19
**対象ブランチ**: `kai_001`

---

## 1. 要件定義書

### 1.1 背景・目的

hideの個人ポートフォリオサイト（GitHub Pages）に、日本の伝統文化「百人一首」をテーマにしたかるたゲームを追加する。既存のゲームページ（hanafuda.html / shinkei-suijaku.html など）と統一されたダークテーマデザインで実装し、ポートフォリオの技術力とデザイン水準を示す。

### 1.2 対象ユーザー

- hideのポートフォリオを訪問する技術者・採用担当者
- 百人一首に興味のある一般ユーザー（スマートフォン・PC両対応）

### 1.3 機能要件（MoSCoW法）

#### Must（必須）

| ID | 機能 |
|----|------|
| M01 | 100首の上の句・下の句データを内蔵する |
| M02 | 読み上げ表示（上の句テキストを画面に表示する） |
| M03 | 取り札（下の句）をCanvas APIで描画し、複数枚を場に並べる |
| M04 | 正しい取り札をクリック/タップして選択できる |
| M05 | 正解・不正解の判定とフィードバック表示 |
| M06 | スコア・残り枚数の表示 |
| M07 | ゲーム終了画面（結果表示・もう一度プレイ） |
| M08 | 難易度選択（枚数選択: 10首 / 25首 / 50首 / 100首） |
| M09 | モバイル対応（タッチ操作） |
| M10 | index.html からリンクを貼れる独立HTMLファイルとして完結する |

#### Should（できれば）

| ID | 機能 |
|----|------|
| S01 | 制限時間モード（1枚あたり30秒） |
| S02 | 正解時のアニメーション演出（取り札が飛ぶ） |
| S03 | 不正解時のミス札ハイライト表示 |
| S04 | 作者名の表示（正解後に表示） |
| S05 | 読み上げ音声（Web Speech API、日本語TTS） |

#### Could（余力があれば）

| ID | 機能 |
|----|------|
| C01 | ハイスコア保存（localStorage） |
| C02 | 競技かるた風の「決まり字」表示モード |

#### Won't（今回は実装しない）

- 対戦モード（サーバーサイド通信不要な仕様のため）
- 外部画像ファイル依存の絵札（→ Canvas描画で代替）
- バックエンド・APIとの連携

### 1.4 非機能要件

| 項目 | 要件 |
|------|------|
| パフォーマンス | 初回ロード3秒以内（外部画像なし・軽量設計） |
| 互換性 | Chrome / Firefox / Safari / Edge 最新版、iOS Safari / Android Chrome |
| セキュリティ | XSS対策: innerHTML によるユーザー入力挿入禁止。全テキストはtextContent/createTextNodeで挿入 |
| アクセシビリティ | aria-label をCanvas要素に付与、キーボード操作は対象外（カード選択はクリック/タップのみ） |
| ホスティング | GitHub Pages（静的ファイルのみ）。外部APIへのリクエスト禁止（CORSリスク回避） |

### 1.5 制約条件

- フレームワーク（React / Vue等）使用禁止
- ビルドツール（webpack / vite等）使用禁止
- ライブラリはCDN経由のみ許可（今回は不要）
- カラースキーム: 黒背景 + シアン / パープル系（サイバーパンク演出禁止）
- 絵札画像は外部依存禁止 → Canvas APIでテキスト描画する

---

## 2. 基本設計書

### 2.1 システム構成図

```
hyakunin_isshu.html (単一ファイル完結)
│
├── <head>
│   ├── CSS（インライン <style>）
│   └── カスタムフォント: なし（システムフォント使用）
│
├── <body>
│   ├── <header>  ← ナビゲーション・タイトル
│   ├── #screen-start    ← スタート画面（難易度選択）
│   ├── #screen-game     ← ゲーム画面
│   │   ├── #yomi-area   ← 読み札表示エリア（上の句テキスト）
│   │   ├── #info-bar    ← スコア・残り枚数・タイマー
│   │   └── <canvas id="field-canvas"> ← 取り札フィールド
│   └── #screen-result   ← 結果画面
│
└── <script>（インライン）
    ├── POEMS_DATA[]   ← 100首の歌データ配列
    ├── class KarutaGame  ← ゲームロジック
    ├── class CardRenderer ← Canvas描画
    └── 初期化・イベントハンドラ
```

### 2.2 画面遷移

```
[スタート画面]
  ↓ 難易度選択 → ゲーム開始ボタン
[ゲーム画面]
  ↓ 全カード正解 or 全ラウンド消化
[結果画面]
  ↓ 「もう一度」ボタン
[スタート画面]
```

### 2.3 ゲームフロー詳細

1. スタート画面で難易度（枚数）を選択
2. 100首からランダムに指定枚数を抽出する
3. ゲーム開始: 1ラウンドの処理
   a. 現在の問題（1首）の上の句をyomi-areaに表示する
   b. 場に取り札を並べる（Canvas描画）
      - 場の枚数: 難易度に応じて変動（下記参照）
   c. ユーザーがCanvas上の札をクリック/タップする
   d. 正解判定:
      - 正解: 正解アニメーション → 場から除去 → 次の問題へ
      - 不正解: ミス表示 → 再選択（制限時間モード時はペナルティ）
4. 全問終了 → 結果画面表示

### 2.4 場の枚数設計

| 難易度 | 問題数 | 場の同時表示枚数 |
|--------|--------|-----------------|
| 練習（10首） | 10 | 5枚 |
| 初級（25首） | 25 | 8枚 |
| 中級（50首） | 50 | 10枚 |
| 上級（100首）| 100 | 15枚 |

場の取り札は問題数すべてを場に出すのではなく、現在の問題 + ランダムな複数枚を混ぜた「部分的な場」として表示する。正解後に場の枚数が減り、次の問題から補充はしない（消えていく演出）。

### 2.5 データ構造

```javascript
// 歌データ（POEMS_DATA配列の1要素）
{
  id: 1,                              // 歌番号 (1-100)
  poet: "天智天皇",                   // 作者名（漢字）
  kami: "秋の田の かりほの庵の 苫をあらみ",  // 上の句
  shimo: "わが衣手は 露にぬれつつ",         // 下の句
  kana_kami: "あきのたの かりほのいおの とまをあらみ",  // 上の句（かな・読み上げ用）
  kana_shimo: "わがころもでは つゆにぬれつつ"            // 下の句（かな・読み上げ用）
}

// ゲーム状態
{
  mode: "practice"|"easy"|"medium"|"hard",
  totalQuestions: 10|25|50|100,
  questions: [/* シャッフルされた歌IDの配列 */],
  currentIndex: 0,          // 現在の問題インデックス
  score: 0,                 // 正解数
  mistakeCount: 0,          // ミス数
  fieldCards: [/* 場に出ている歌IDの配列 */]
}

// Canvas上のカード位置情報
{
  id: 1,
  x: 120,
  y: 80,
  w: CARD_W,   // 定数
  h: CARD_H,   // 定数
  state: "normal"|"correct"|"wrong"  // 表示状態
}
```

### 2.6 主要コンポーネントの役割

| コンポーネント | 役割 |
|---------------|------|
| `KarutaGame` クラス | ゲーム状態管理、問題の進行、スコア計算 |
| `CardRenderer` クラス | Canvas APIによる取り札の描画・レイアウト計算 |
| `POEMS_DATA` 配列 | 100首の歌データ（インライン定義） |
| `ScreenManager` 関数群 | 画面切り替え（start/game/result） |
| イベントハンドラ | Canvas クリック/タップの座標変換・カードヒットテスト |

---

## 3. 詳細設計書

### 3.1 ファイル構成

```
/home/user/main/
└── hyakunin_isshu.html   ← 新規作成（単一ファイル完結）
```

外部ファイルは一切作成しない。CSS・JavaScriptはすべてインラインに記述する。

### 3.2 HTML構造

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>百人一首かるた | hide portfolio</title>
  <style>/* インラインCSS */</style>
</head>
<body>
  <header>
    <a href="index.html" class="logo">...</a>
    <nav>...</nav>
  </header>

  <!-- スタート画面 -->
  <div id="screen-start" class="screen active">
    <h1>百人一首かるた</h1>
    <p class="subtitle">Hyakunin Isshu Karuta</p>
    <div class="mode-grid">
      <button data-mode="practice">練習<br><small>10首・5枚場</small></button>
      <button data-mode="easy">初級<br><small>25首・8枚場</small></button>
      <button data-mode="medium">中級<br><small>50首・10枚場</small></button>
      <button data-mode="hard">上級<br><small>100首・15枚場</small></button>
    </div>
    <button id="btn-start" disabled>ゲーム開始</button>
  </div>

  <!-- ゲーム画面 -->
  <div id="screen-game" class="screen">
    <div id="info-bar">
      <span id="label-progress">0 / 10</span>
      <span id="label-score">正解: 0</span>
      <span id="label-miss">ミス: 0</span>
    </div>
    <div id="yomi-area">
      <p id="yomi-kami" class="kami-text"></p>
      <p id="yomi-hint" class="hint-text">← 下の句の取り札を選んでください</p>
    </div>
    <canvas id="field-canvas" aria-label="取り札フィールド"></canvas>
    <div id="feedback" class="feedback hidden"></div>
  </div>

  <!-- 結果画面 -->
  <div id="screen-result" class="screen">
    <h2>結果 / Result</h2>
    <div class="result-stats">
      <div class="stat"><span id="res-score">0</span><small>正解</small></div>
      <div class="stat"><span id="res-miss">0</span><small>ミス</small></div>
      <div class="stat"><span id="res-accuracy">0%</span><small>正答率</small></div>
    </div>
    <button id="btn-retry">もう一度 / Play Again</button>
    <a href="index.html" class="back-link">← ポートフォリオへ</a>
  </div>

  <script>/* インラインJS */</script>
</body>
</html>
```

### 3.3 CSSスタイル設計

既存ゲームページ（hanafuda.html）のCSS変数を完全継承する。

```css
:root {
  --bg: #070711;
  --panel: rgba(14, 18, 38, 0.78);
  --panel-strong: rgba(18, 24, 48, 0.92);
  --line: rgba(119, 224, 255, 0.2);
  --text: #f5f7fb;
  --muted: #aeb7cc;
  --cyan: #22d3ee;
  --magenta: #f472b6;
  --purple: #a78bfa;
  --gold: #f8d36f;
  --danger: #fb7185;
  --good: #34d399;
  --card-w: 90px;   /* 取り札幅 */
  --card-h: 140px;  /* 取り札高さ（縦長・かるた比率） */
  --radius: 8px;
}
```

**背景**: hanafuda.html と同じ radial-gradient + linear-gradient の多重グラデーション背景を使用。body::before の格子線パターンも継承。

**yomi-area**: Glassmorphismカード（backdrop-filter: blur(12px), rgba背景）で上の句を表示。上の句テキストは縦書き（writing-mode: vertical-rl）で表示する。

**取り札カード（Canvas描画）**: Canvas API で直接描画するため、CSSは不要。

**フィードバック**: 画面中央に絶対配置されるオーバーレイ（position: fixed）。正解時は緑、不正解時は赤のグロウなしテキスト表示。

### 3.4 Canvas設計

#### Canvas サイズ計算

```javascript
// Canvas は画面幅に応じてリサイズする
function resizeCanvas() {
  const maxW = Math.min(window.innerWidth - 32, 1000);
  canvas.width = maxW;
  // 高さは場の枚数・カードサイズから自動計算
  canvas.height = calcFieldHeight();
}
```

#### カードレイアウト計算

```javascript
// カードをグリッド配置する
function calcLayout(cardCount, canvasWidth) {
  const cols = Math.min(cardCount, Math.floor(canvasWidth / (CARD_W + GAP)));
  const rows = Math.ceil(cardCount / cols);
  // 中央寄せのオフセットを計算して返す
  return { cols, rows, offsetX, offsetY };
}
```

#### 取り札描画仕様（CardRenderer.drawCard メソッド）

取り札1枚のCanvas描画内容:

```
+------------------------+
| [上部 装飾ライン]        |  ← rgba(シアン系) 細線
|                        |
|   わが衣手は            |  ← 下の句テキスト（縦書き）
|   露にぬれつつ          |     font: 'bold 14px "Hiragino Mincho ProN"'
|                        |
| [下部 作者名エリア]      |  ← 正解後のみ表示
+------------------------+
```

**カード背景色**:
- 通常: `rgba(20, 28, 58, 0.88)` + border `rgba(119, 224, 255, 0.25)`
- ホバー: border `rgba(34, 211, 238, 0.6)` に変化（mousemove で再描画）
- 正解: border `rgba(52, 211, 153, 0.8)` + 背景 `rgba(52, 211, 153, 0.15)`
- 不正解: border `rgba(251, 113, 133, 0.8)` + 背景 `rgba(251, 113, 133, 0.12)`

**縦書き文字描画**: Canvas APIはCSSの `writing-mode` をサポートしないため、下の句を1文字ずつ縦に並べて描画する。

```javascript
function drawVerticalText(ctx, text, x, y, lineHeight) {
  const chars = [...text]; // サロゲートペア対応
  chars.forEach((ch, i) => {
    ctx.fillText(ch, x, y + i * lineHeight);
  });
}
```

改行（スペース区切り）がある場合は2列に分けて描画する（上の句の区切りに対応）。

### 3.5 JavaScriptクラス・関数設計

#### `POEMS_DATA` 配列（定数）

ファイル内に100首すべてをハードコードする。外部JSONファイル・外部APIは使用しない。

```javascript
const POEMS_DATA = [
  {
    id: 1,
    poet: "天智天皇",
    kami: "秋の田の かりほの庵の 苫をあらみ",
    shimo: "わが衣手は 露にぬれつつ",
    kana_kami: "あきのたの かりほのいおの とまをあらみ",
    kana_shimo: "わがころもでは つゆにぬれつつ"
  },
  // ... 2〜100番まで同形式で全首記述
];
```

ゲーム内テキストは日本語のみ（UIラベルは日英併記）。

#### `class KarutaGame`

```javascript
class KarutaGame {
  constructor(mode) {}       // mode: 'practice'|'easy'|'medium'|'hard'

  // ゲーム初期化・開始
  start()                    // 問題セットをシャッフル、1問目を表示
  nextQuestion()             // 次の問題へ進む
  buildField()               // 場の取り札セットを構築する（正解札 + ダミー札）

  // 回答処理
  answer(poemId)             // カードIDを受け取り正誤判定
  onCorrect()                // 正解処理（スコア加算、アニメーション、次問へ）
  onWrong(wrongId)           // 不正解処理（ミス加算、ハイライト）

  // 状態取得
  isFinished()               // Boolean: 全問終了か
  getResult()                // { score, miss, accuracy, total } を返す

  // プロパティ（readonly）
  get currentPoem()          // 現在の問題の歌オブジェクト
  get fieldPoems()           // 場の取り札リスト（歌オブジェクトの配列）
}
```

#### `class CardRenderer`

```javascript
class CardRenderer {
  constructor(canvas, game) {}

  // レイアウト・描画
  layout()                   // カード位置を計算してthis.cardsに格納
  draw()                     // 全カードを再描画（requestAnimationFrameで呼ぶ）
  drawCard(ctx, cardInfo)    // 1枚描画（縦書き文字・状態色適用）
  drawVerticalText(ctx, text, cx, startY)  // 縦書きテキスト描画

  // ヒットテスト
  hitTest(x, y)              // クリック座標から該当カードのpoemIdを返す（なければnull）

  // アニメーション
  animateCorrect(poemId)     // 正解カードのフェードアウトアニメーション
  animateWrong(poemId)       // 不正解カードの赤点滅アニメーション（500ms後に通常に戻る）

  // Canvas座標変換（タッチ・マウス共通）
  getPos(e)                  // MouseEvent/TouchEvent → Canvas座標 {x, y}
}
```

#### 画面管理関数

```javascript
function showScreen(name)    // 'start'|'game'|'result' → 対応divを表示、他を非表示

function updateInfoBar()     // progress / score / miss ラベルを更新

function showFeedback(msg, type)  // type: 'correct'|'wrong' フィードバックオーバーレイ表示（1秒後自動消去）

function showYomiArea(poem)  // 上の句テキストをyomi-kamiに設定
```

#### イベントハンドラ

```javascript
// ゲーム開始
document.querySelectorAll('[data-mode]').forEach(btn => {
  btn.addEventListener('click', e => { selectedMode = e.target.dataset.mode; });
});
document.getElementById('btn-start').addEventListener('click', startGame);

// Canvas クリック
canvas.addEventListener('click', e => {
  const pos = renderer.getPos(e);
  const poemId = renderer.hitTest(pos.x, pos.y);
  if (poemId !== null) game.answer(poemId);
});

// Canvas タッチ
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const t = e.touches[0];
  canvas.dispatchEvent(new MouseEvent('click', { clientX: t.clientX, clientY: t.clientY }));
}, { passive: false });

// Canvas ホバー（マウスのみ）
canvas.addEventListener('mousemove', e => {
  const pos = renderer.getPos(e);
  renderer.hoveredId = renderer.hitTest(pos.x, pos.y);
  renderer.draw();
  canvas.style.cursor = renderer.hoveredId !== null ? 'pointer' : 'default';
});

// リサイズ対応
window.addEventListener('resize', () => {
  resizeCanvas();
  renderer.layout();
  renderer.draw();
});

// もう一度
document.getElementById('btn-retry').addEventListener('click', () => showScreen('start'));
```

#### メインフロー関数

```javascript
function startGame() {
  game = new KarutaGame(selectedMode);
  renderer = new CardRenderer(canvas, game);
  game.start();
  showScreen('game');
  resizeCanvas();
  renderer.layout();
  renderer.draw();
  showYomiArea(game.currentPoem);
  updateInfoBar();
}

function onAnswer(poemId) {
  game.answer(poemId);
  if (/* 正解 */) {
    renderer.animateCorrect(poemId);
    showFeedback('正解！', 'correct');
    setTimeout(() => {
      if (game.isFinished()) {
        showResult();
      } else {
        game.nextQuestion();
        renderer.layout();
        renderer.draw();
        showYomiArea(game.currentPoem);
        updateInfoBar();
      }
    }, 800);
  } else {
    renderer.animateWrong(poemId);
    showFeedback('もう一度', 'wrong');
    updateInfoBar();
  }
}

function showResult() {
  const r = game.getResult();
  document.getElementById('res-score').textContent = r.score;
  document.getElementById('res-miss').textContent = r.miss;
  document.getElementById('res-accuracy').textContent = r.accuracy + '%';
  showScreen('result');
}
```

### 3.6 フリー画像の取得方針

#### 方針決定: 画像不使用、Canvas APIでテキスト描画

調査の結果、以下の理由から**取り札・読み札ともに外部画像は使用せず、Canvas APIでテキストを描画する**方針とする。

**理由**:
1. Wikimedia Commonsに100枚分のかるた取り札画像が揃ったセットが存在しない
2. 外部画像をfetchすると CORS 制限・ライセンス管理が複雑になる
3. GitHub Pages の静的ホスティング要件（外部依存最小化）に反する
4. Canvas テキスト描画で十分に「かるた」らしい見た目を実現できる（縦書き・和風フォント）

#### 参考調査結果（記録として）

- **Wikimedia Commons / Category:Hyakunin Isshu**
  URL: `https://commons.wikimedia.org/wiki/Category:Hyakunin_Isshu`
  → 歌仙絵・浮世絵の写真はあるが、かるた取り札全100枚の統一セットは存在しない
  → Utagawa Kuniyoshi（国芳）シリーズ（100枚分近くあり）はCC-PD相当だが、個別ファイルURLが不統一で自動取得が困難

- **publicdomainq.net**
  URL: `https://publicdomainq.net/tag/%E7%99%BE%E4%BA%BA%E4%B8%80%E9%A6%96/`
  → CC0ライセンスの百人一首イラスト素材があるが、取り札1枚1枚ではなくセット画像

- **Cansei Creative Park（Canon）**
  URL: `https://creativepark.canon/jp/contents/CNT-0010718/index.html`
  → 印刷用PDFのみ、Web組み込み不可

#### 代替案: 和風デコレーションを Canvas で描画

取り札の背景に和風のビジュアル要素をCanvasで描画することで、画像なしでも視覚的完成度を高める。

- カード枠: 二重罫線（外枠 + 内枠）
- 上部: 作者の家紋風シンボル（単純な幾何学形状をCanvas APIで描画）
- 下部: 金色（`var(--gold)`）の細いアクセントライン
- テキスト: `"Hiragino Mincho ProN", "Yu Mincho", "MS Mincho", serif` の明朝体系フォント

#### 歌データの取得方針

歌データ（上の句・下の句・作者名）はパブリックドメインのため、100首すべてを `POEMS_DATA` 配列にハードコードする。

データソース参照: `https://www.saiyukan.com/miyabiyaka/list1.html`（小倉百人一首 一覧、表記の参考）

CSV形式の参考: `https://github.com/nyoronjp/Ogura_Hyakunin_Isshu.csv`（文字コードEUC-JC、ライセンス不明のためデータは参考のみ）

### 3.7 Web Speech API（S05: 読み上げ音声）

Must要件ではないが、Shouldとして設計に含める。

```javascript
// 読み上げ機能（ブラウザ対応チェック付き）
function speakKami(poem) {
  if (!window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance(poem.kana_kami);
  utter.lang = 'ja-JP';
  utter.rate = 0.85;  // やや遅めで聞き取りやすく
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}
```

問題表示時に自動的に `speakKami()` を呼び出す。iOS Safariではユーザージェスチャーがないと音声合成が動作しない制約があるため、問題表示のトリガーは常にユーザー操作（クリック/タップ）の直後とする。

### 3.8 Generatorへの実装指示

以下の順序で実装すること。

#### Step 1: HTMLスケルトン作成

`hyakunin_isshu.html` を新規作成する。`hanafuda.html` のヘッダー・フッター・CSS変数・body背景グラデーションを参考に、3.2節のHTML構造を実装する。

#### Step 2: POEMS_DATA配列の実装

`POEMS_DATA` 配列に100首すべてを記述する。各エントリは `{id, poet, kami, shimo, kana_kami, kana_shimo}` の形式。歌テキストは歴史的仮名遣い（現代語ではなく古典仮名遣い）で記述し、句の区切りをスペース1文字で区切る（例: `"秋の田の かりほの庵の 苫をあらみ"`）。

#### Step 3: KarutaGame クラスの実装

3.5節の設計に従い `KarutaGame` クラスを実装する。`buildField()` では、正解の1枚 + ランダムに選んだ（場の枚数 - 1）枚のダミー札を配列に入れてシャッフルする。

#### Step 4: CardRenderer クラスの実装

3.4節・3.5節の設計に従い `CardRenderer` クラスを実装する。`drawVerticalText()` ではスペースで区切られた句を2列（右列・左列）に分けて縦書き描画する。`hitTest()` は `this.cards` 配列を走査して座標がカード矩形内かどうかを判定する。

#### Step 5: 画面管理・イベントハンドラの実装

3.5節の `showScreen` / `updateInfoBar` / `showFeedback` / `showYomiArea` 関数と、全イベントハンドラを実装する。`canvas.addEventListener('click', ...)` → `onAnswer(poemId)` の流れで回答を処理する。

#### Step 6: レスポンシブ対応・動作確認

`resizeCanvas()` と `window.addEventListener('resize', ...)` を実装し、モバイル（375px幅）〜デスクトップ（1200px幅）での動作を確認する。

#### セキュリティ注意事項

- `innerHTML` を使用する箇所ではユーザー入力を一切挿入しないこと
- 歌データは静的定数のため問題なし
- `textContent` / `createTextNode` を使用すること（feedbackメッセージ等）

---

## 4. 実装チェックリスト（Evaluator用）

| # | チェック項目 | 基準 |
|---|------------|------|
| 1 | 仕様適合性 | 100首データが正確に記述されているか |
| 2 | Canvas描画 | 取り札が縦書きで正しく描画されるか |
| 3 | ヒットテスト | クリック・タップで正しいカードが選択されるか |
| 4 | 正誤判定 | 正解・不正解の判定ロジックが正確か |
| 5 | 難易度選択 | 4段階の難易度が機能するか |
| 6 | レスポンシブ | 375px〜1200px幅で表示が崩れないか |
| 7 | デザイン | カラースキームが既存サイトと統一されているか |
| 8 | XSS対策 | innerHTML でユーザー入力を挿入していないか |
| 9 | パフォーマンス | 外部リソースへのfetchがないか |
| 10 | ナビゲーション | index.html への戻りリンクが機能するか |
