# 基本設計書 — プリズムフォール (PrismFall)

バージョン: 1.0.0
作成日: 2026-06-10
作成者: Plannerエージェント

---

## 1. システム構成図

```
prismfall.html                   ← エントリポイント（単一HTMLファイル）
    │
    ├── <head>
    │     └── <style>            ← インラインCSS（ページ全体のレイアウト・タッチUI）
    │
    ├── <body>
    │     ├── <canvas id="game"> ← GameKit.Engine の描画先（960×540）
    │     ├── タッチ操作UI（DOM製ボタン群、CSS Glassmorphism）
    │     └── 操作説明テキスト（日英併記）
    │
    ├── <script src="gamekit/gamekit.js"></script>  ← 既存GameKitをそのまま参照
    │
    └── <script>                 ← インラインJS（ゲームロジック全体）
          ├── PIECES              テトリミノ形状・回転データ（定数）
          ├── SCORE_TABLE         スコア・レベル係数（定数）
          ├── BagRandomizer       7-bagランダム生成
          ├── Field               フィールド状態（10x20グリッド）・ライン消去判定
          ├── Piece               現在操作中テトリミノの状態・移動/回転/SRS壁蹴り
          ├── EffectManager       ライン消去パーティクル・コンボ表示・レベルアップ演出
          ├── SoundFx             GameKit.Sfxラッパー（ミュート管理込み）
          ├── TouchControls       タッチボタンのDOM生成・イベントバインド
          ├── TitleScene          GameKit.Scene継承（タイトル画面）
          └── PlayScene           GameKit.Scene継承（プレイ画面・本体ロジック）
```

外部アセット・追加ファイルは一切なし。`gamekit/gamekit.js` への変更も不要（既存APIのみ使用）。

---

## 2. 画面遷移図

```
[ページ読み込み]
      │
      ▼
[TitleScene] ←─────────────────────────────┐
      │ Space / クリック / タップ            │
      ▼                                      │
[PlayScene]                                  │
      │ ゲーム中: P/Escキーでポーズ           │
      │   └─ ポーズ中オーバーレイ表示（同シーン内のフラグ管理）
      │                                      │
      │ ゲームオーバー判定                    │
      ▼                                      │
[PlayScene内 ゲームオーバーオーバーレイ]       │
      │ ハイスコア更新（GameKit.Save）        │
      │ Space / クリック / タップ ────────────┘
```

注: ポーズ・ゲームオーバーは別Sceneを作らず、PlayScene内の状態フラグ（`this.state = 'playing' | 'paused' | 'gameover'`）で表現する（シーン遷移コストを避け、フィールド状態を保持したまま再開できるようにするため）。

---

## 3. 画面レイアウト概要

### 3.1 タイトル画面（960×540 Canvas内）

```
┌──────────────────────────────────────────────┐
│                                                │
│          ┌──────────────────────────┐        │
│          │   PRISMFALL              │        │ ← Glassmorphismパネル
│          │   プリズムフォール         │        │
│          │                          │        │
│          │  HIGH SCORE: 12345       │        │
│          │                          │        │
│          │  ▶ Click / Space to Start│        │ ← 点滅
│          │  ▶ クリック / Space で開始 │        │
│          │                          │        │
│          │  操作: ←→移動 ↑回転 ↓加速 │        │
│          │  Space:ハードドロップ     │        │
│          │  C:ホールド  P:ポーズ     │        │
│          └──────────────────────────┘        │
│                                                │
│  （背景: GameKit.Particlesによるシアン/パープル │
│    アンビエントパーティクル）                    │
└──────────────────────────────────────────────┘
```

### 3.2 プレイ画面（960×540 Canvas + 下部タッチUI）

```
┌──────────────────────────────────────────────┐
│ ┌────────┐ ┌────────────────────┐ ┌────────┐ │
│ │ HOLD   │ │                    │ │ NEXT   │ │
│ │[ミノ]   │ │   フィールド        │ │[ミノ1] │ │
│ └────────┘ │   10列 x 20行      │ │[ミノ2] │ │
│ ┌────────┐ │   各セル24px       │ │[ミノ3] │ │
│ │ SCORE  │ │   (240 x 480px)    │ └────────┘ │
│ │ LEVEL  │ │                    │ ┌────────┐ │
│ │ LINES  │ │  ゴーストピース表示  │ │ MUTE   │ │
│ └────────┘ │  落下中ピース表示    │ └────────┘ │
│            │  コンボ/レベルアップ │            │
│            │  演出はここに重畳     │            │
│            └────────────────────┘            │
├──────────────────────────────────────────────┤
│  [タッチUI: ← ↻ → ]   [ ↓ ] [HOLD] [DROP]    │ ← DOM製ボタン（Canvas外）
└──────────────────────────────────────────────┘

ゲームオーバー時: フィールド中央にGlassmorphismパネルで
  「GAME OVER / ゲームオーバー」+ スコア/レベル/ライン数/ハイスコア更新表示
ポーズ時: フィールド全体に半透明オーバーレイ + 「PAUSED / 一時停止」
```

各パネルの目安座標（960×540キャンバス基準）:

| パネル | x | y | w | h |
|---|---|---|---|---|
| フィールド | 360 | 30 | 240 | 480 |
| HOLD | 220 | 30 | 110 | 90 |
| SCORE/LEVEL/LINES | 220 | 130 | 110 | 130 |
| NEXT（3つ縦並び） | 630 | 30 | 110 | 280 |
| MUTEボタン | 630 | 320 | 110 | 50 |

---

## 4. データ構造の概要

### 4.1 テトリミノ定義（PIECES定数）

```javascript
// 各ミノ: 4方向（0,1,2,3）の4x4ブロックマップ + カラー定義
const PIECES = {
  I: { color: { base: '#22d3ee', light: '#a5f3fc', dark: '#0e7490' }, rotations: [ /* 4x4 x 4方向 */ ] },
  O: { color: { base: '#a78bfa', light: '#ddd6fe', dark: '#6d28d9' }, rotations: [ /* ... */ ] },
  T: { color: { base: '#67e8f9', light: '#cffafe', dark: '#0891b2' }, rotations: [ /* ... */ ] },
  S: { color: { base: '#c4b5fd', light: '#ede9fe', dark: '#7c3aed' }, rotations: [ /* ... */ ] },
  Z: { color: { base: '#22d3ee', light: '#cffafe', dark: '#155e75' }, rotations: [ /* ... */ ] },
  J: { color: { base: '#818cf8', light: '#e0e7ff', dark: '#4338ca' }, rotations: [ /* ... */ ] },
  L: { color: { base: '#f0abfc', light: '#fae8ff', dark: '#a21caf' }, rotations: [ /* ... */ ] },
};
```

全色をシアン〜パープル系のグラデーションバリエーションでまとめ、サイバーパンク的な原色ネオン（赤・緑・黄の極彩色）は使用しない。

### 4.2 フィールド状態（Field）

```javascript
// 10列 x 20行の2次元配列。0=空、1以上=テトリミノ種別インデックス（描画色参照用）
field.grid = Array.from({ length: 20 }, () => Array(10).fill(0));
```

### 4.3 現在ピース状態（Piece）

```javascript
piece = {
  type: 'T',        // PIECESのキー
  rotation: 0,       // 0-3
  x: 3, y: 0,        // フィールド座標（左上基準）
  lockTimer: 0,      // ロック遅延タイマー（秒）
};
```

### 4.4 GameKit.Save 永続化データ

| キー | 型 | 内容 |
|---|---|---|
| `hiscore` | number | ハイスコア（GameKit.Save名前空間: `prismfall`） |
| `mute` | boolean | ミュート状態 |

`new GameKit.Save('prismfall')` でインスタンス化し、`save.get('hiscore', 0)` / `save.set('hiscore', value)` の形式で利用する。

---

## 5. 主要コンポーネントの役割

| コンポーネント | 役割 |
|---|---|
| `PIECES` | 7種テトリミノの形状（4方向分の回転パターン）とカラーパレットを保持する定数オブジェクト |
| `SCORE_TABLE` | ライン消去数別の基礎スコア・落下速度テーブル等の定数 |
| `BagRandomizer` | 7種を1袋としてシャッフルし、`next()` でテトリミノ種別を1つずつ返す |
| `Field` | 10x20グリッドの状態管理。`lockPiece()`, `clearLines()`, `isGameOver()` 等を提供 |
| `Piece` | 操作中ピースの位置・回転状態。`moveLeft/Right/Down`, `rotateCW/CCW`（SRS壁蹴り含む）, `hardDrop`, `getGhostY` を提供 |
| `EffectManager` | ライン消去パーティクル、コンボテキスト、レベルアップ演出のキューと描画を管理 |
| `SoundFx` | `GameKit.Sfx` をラップし、ミュート状態に応じて各種SEを再生する |
| `TouchControls` | 画面下部のDOMボタンを生成し、`Input`相当のフラグをPlaySceneへ伝える |
| `TitleScene` | `GameKit.Scene` 継承。タイトル表示・パーティクル背景・遷移処理 |
| `PlayScene` | `GameKit.Scene` 継承。フィールド・ピース・UI・エフェクトの統合制御、状態（playing/paused/gameover）管理 |
