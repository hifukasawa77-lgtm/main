# 仕様書: shogi_rpg_local.html グラフィック強化

バージョン: 1.0  
作成日: 2026-04-05  
対象ファイル: `c:/Users/hifuk/Documents/Git_hub/hide_0001/shogi_rpg_local.html`

---

## 要件定義書

### 背景・目的

`shogi_rpg_local.html`（React + Babel CDN 構成、3602行、単一HTMLファイル）のグラフィックを、フリー素材（ぴぽや倉庫）とGSAP（CDN経由）を用いて強化する。ゲームロジックは一切変更せず、視覚的完成度を高める。

### 機能要件一覧（MoSCoW法）

#### Must（必須）

| ID | 機能 |
|----|------|
| M-01 | StageBackground に背景画像（ぴぽや倉庫 JPEG/PNG）を差し込み、各ステージの雰囲気を強化 |
| M-02 | 攻撃発動時（マッチ成立時）にバトルエフェクトGIFをオーバーレイ表示し、1.5秒後に自動消去 |
| M-03 | 駒の種類によってエフェクトGIFを切り替える（炎/雷/斬撃/氷/闇） |
| M-04 | GSAPによる画面遷移フェードイン（start→playing、stageClear、victory、gameover） |
| M-05 | バトルUIパネルをグラスモーフィズム化（backdrop-filter: blur + 半透明） |
| M-06 | HPバーにグラデーション + グロー効果を追加 |

#### Should（推奨）

| ID | 機能 |
|----|------|
| S-01 | タイトル画面のロゴに光沢アニメーション（shimmer）を追加 |
| S-02 | GSAPによるタイトル文字の出現アニメーション（stagger） |
| S-03 | 妖怪表示エリアに発光エフェクト枠を追加 |
| S-04 | 将棋盤マス目のグラデーション強化・選択駒のグロー強化 |

#### Could（あれば望ましい）

| ID | 機能 |
|----|------|
| C-01 | タイトル画面に和風パーティクル（桜・雪等）のCSSアニメーション追加 |
| C-02 | スタートボタンのホバーエフェクト強化 |

#### Won't（今回は対象外）

- 音声・BGMの変更
- ゲームロジック（findMatches / checkAndRemoveMatches 等）の変更
- 新しい妖怪や駒の追加
- ファイルの分割・ビルドツール導入

### 非機能要件

- ファイルサイズ: 300KB 以内（外部画像はURLで参照するため画像バイナリはHTMLに含まない）
- XSS脆弱性ゼロ（dangerouslySetInnerHTML 使用禁止、外部URLは既存のCDNとぴぽや倉庫のみ）
- React + Babel CDN 構成を維持
- 既存のゲームロジックを一切変更しない
- iOS Safari / Chrome 最新版で動作すること
- GSAP CDN読み込み失敗時もゲームがクラッシュしないこと（try-catch または optional chaining）

### 制約条件

- フレームワーク不使用（React は既存のまま維持）
- ライブラリ追加はCDN経由のみ
- 単一HTMLファイルに全て収める
- ビルドツール不使用

---

## 基本設計書

### システム構成図

```
shogi_rpg_local.html（単一ファイル）
├── <head>
│   ├── 既存: Noto Serif JP (Google Fonts)
│   └── 追加: GSAP 3.12.2 (cdnjs CDN) ← <script> タグで追加
│
├── <body>
│   └── <div id="root"> ← React マウントポイント
│
└── <script type="text/babel">
    └── ShogiRPG コンポーネント
        ├── 追加: BattleEffectOverlay コンポーネント（GIF表示）
        ├── 追加: useBattleEffect カスタムフック（エフェクト制御）
        ├── 変更: StageBackground コンポーネント（画像化）
        ├── 変更: バトルUIパネル（グラスモーフィズム）
        ├── 変更: HPバー（グラデーション強化）
        ├── 変更: タイトル画面（GSAP アニメーション）
        └── 変更: 将棋盤セル（グロー強化）
```

### 画面遷移とアニメーション適用箇所

```
[start] ──────────────────────────────────────
  ・タイトルロゴ: GSAPで下から出現（stagger 0.1s）
  ・ロゴ背景: shimmer グロー CSS アニメーション
  ・ボタン: hover時スケール 1.05 + glow

        ↓ ゲーム開始（GSAP fadeIn 0.5s）

[playing] ─────────────────────────────────────
  ・StageBackground: 背景画像 + 半透明オーバーレイ
  ・バトルパネル: glassmorphism
  ・妖怪エリア: 発光枠
  ・マッチ成立時: BattleEffectOverlay（GIF）表示

        ↓ HP0（GSAP fadeIn 0.5s）

[stageClear / victory / gameover] ─────────────
  ・画面全体 GSAP fadeIn 0.5s
```

### データ構造の概要（追加分のみ）

```javascript
// useBattleEffect フックが管理する状態
{
  effectGif: null | string,   // 表示中のGIF URL
  effectKey: number           // GIF再生を強制リセットするためのキー
}

// 駒種別エフェクトマッピング（定数）
PIECE_EFFECT_MAP = {
  HI:    '炎GIF URL',    // 飛車 → 炎
  RYU:   '炎2 GIF URL',  // 竜   → 炎（強）
  KYO:   '雷GIF URL',    // 香車 → 雷
  KAKU:  '闇GIF URL',    // 角行 → 闇
  UMA:   '闇GIF URL',    // 馬   → 闇
  GIN:   '斬撃GIF URL',  // 銀将 → 斬撃
  NARIGIN:'斬撃GIF URL', // 全   → 斬撃
  KIN:   '斬撃GIF URL',  // 金将 → 斬撃
  GYOKU: 'バラGIF URL',  // 玉将 → バラ
  FU:    '斬撃GIF URL',  // 歩兵 → 斬撃
  KEI:   '氷GIF URL',    // 桂馬 → 氷
  // ... 残りはデフォルト（斬撃）
}
```

### 主要コンポーネントの役割

| コンポーネント / フック | 役割 |
|------------------------|------|
| `BattleEffectOverlay` | GIF画像を全画面または盤面上にオーバーレイ表示。effectGifがnull時は非表示 |
| `useBattleEffect` | マッチ成立を検知してGIFを表示し、1500ms後にnullにリセットするタイマーを管理 |
| `StageBackground` | 既存コンポーネントを改修。backgroundImageにぴぽやURLを設定し、半透明オーバーレイを重ねる |
| `<style>` タグ（追加分） | shimmer / particleFall / glowPulse 等の新規CSSキーフレームを追記 |

---

## 詳細設計書

### 1. CDN追加（`<head>` タグ内）

既存の `<script src="...react...">` タグ群の直前に以下を追加する。

```html
<!-- GSAP アニメーションライブラリ -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
```

追加場所: `<script src="https://unpkg.com/react@18/umd/react.development.js"` の直前（17行目の前）。

### 2. グローバルCSS追加（`<style>` タグ内）

`body { margin: 0; background: #1a1a2e; }` の後に以下を追加する。

```css
/* シマーアニメーション（タイトルロゴ用） */
@keyframes shimmer {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}

/* パーティクル落下（タイトル背景用） */
@keyframes particleFall {
  0% { transform: translateY(-10px) rotate(0deg); opacity: 0; }
  10% { opacity: 0.8; }
  90% { opacity: 0.5; }
  100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
}

/* グローパルス（妖怪枠用） */
@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 15px currentColor, 0 0 30px currentColor; }
  50% { box-shadow: 0 0 25px currentColor, 0 0 50px currentColor, 0 0 80px currentColor; }
}

/* エフェクトオーバーレイフェード */
@keyframes effectFadeOut {
  0% { opacity: 1; }
  70% { opacity: 1; }
  100% { opacity: 0; }
}
```

### 3. BattleEffectOverlay コンポーネント

**配置場所**: `YokaiSVG` コンポーネント定義の直後（約586行目付近）に追加する。

**実装コード（JSX）**:

```jsx
const BattleEffectOverlay = ({ effectGif, effectKey }) => {
  if (!effectGif) return null;
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      zIndex: 9999,
      animation: 'effectFadeOut 1.5s ease-out forwards'
    }}>
      <img
        key={effectKey}
        src={effectGif}
        alt=""
        style={{
          width: 'clamp(200px, 40vw, 400px)',
          height: 'clamp(200px, 40vw, 400px)',
          objectFit: 'contain',
          filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.8))'
        }}
      />
    </div>
  );
};
```

### 4. useBattleEffect カスタムフック

**配置場所**: `BattleEffectOverlay` の直後に追加する。

**実装コード（JSX）**:

```jsx
const useBattleEffect = () => {
  const [effectGif, setEffectGif] = React.useState(null);
  const [effectKey, setEffectKey] = React.useState(0);
  const timerRef = React.useRef(null);

  const PIECE_EFFECT_MAP = {
    HI:      'https://pipoya.net/sozai/wp-content/uploads/2018/07/392ece7e5e7b0f0d4f305830f7aaec8e.gif',
    RYU:     'https://pipoya.net/sozai/wp-content/uploads/2018/07/70af7017257fae86d648edc54b037517.gif',
    KYO:     'https://pipoya.net/sozai/wp-content/uploads/2018/07/62bbfa8da2acdc1ab2abd4fa29c84210.gif',
    NARIKYO: 'https://pipoya.net/sozai/wp-content/uploads/2018/07/62bbfa8da2acdc1ab2abd4fa29c84210.gif',
    KAKU:    'https://pipoya.net/sozai/wp-content/uploads/2018/07/pipo-btleffect175_sample.gif',
    UMA:     'https://pipoya.net/sozai/wp-content/uploads/2018/07/pipo-btleffect175_sample.gif',
    KEI:     'https://pipoya.net/sozai/wp-content/uploads/2018/07/26a2c0f7701e7c987449021385e4dc9a.gif',
    NARIKEI: 'https://pipoya.net/sozai/wp-content/uploads/2018/07/26a2c0f7701e7c987449021385e4dc9a.gif',
    GYOKU:   'https://pipoya.net/sozai/wp-content/uploads/2019/08/pipo-roseeffect01_sample.gif',
    // デフォルト（FU, GIN, KIN, TOKIN, NARIGIN 等）
    DEFAULT: 'https://pipoya.net/sozai/wp-content/uploads/2018/07/a25ea116d66806eb93f255f30d82d9eb.gif',
  };

  const showEffect = React.useCallback((matchedPieceTypes) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    // マッチした駒の中で優先度の高いエフェクトを選ぶ
    // 優先順位: RYU > HI > UMA > KAKU > GYOKU > KYO > KEI > DEFAULT
    const PRIORITY_ORDER = ['RYU', 'HI', 'UMA', 'KAKU', 'GYOKU', 'KYO', 'NARIKYO', 'KEI', 'NARIKEI'];
    let selectedGif = PIECE_EFFECT_MAP.DEFAULT;
    for (const priority of PRIORITY_ORDER) {
      if (matchedPieceTypes.includes(priority)) {
        selectedGif = PIECE_EFFECT_MAP[priority];
        break;
      }
    }

    setEffectGif(selectedGif);
    setEffectKey(k => k + 1);
    timerRef.current = setTimeout(() => setEffectGif(null), 1500);
  }, []);

  return { effectGif, effectKey, showEffect };
};
```

### 5. checkAndRemoveMatches へのエフェクト呼び出し追加

**変更箇所**: `checkAndRemoveMatches` 関数内、効果音再生の直後（約1512行目の `playSound('match')` の後）。

**変更内容**: 引数 `showEffect` を `checkAndRemoveMatches` に追加し、プレイヤーターンのマッチ成立時に呼び出す。

現在の関数シグネチャ:
```javascript
const checkAndRemoveMatches = (currentBoard, isInitial = false, isEnemy = false) => {
```

変更後のシグネチャ:
```javascript
const checkAndRemoveMatches = (currentBoard, isInitial = false, isEnemy = false, effectCallback = null) => {
```

`playSound('match')` の直後に以下を追加:
```javascript
if (!isInitial && !isEnemy && effectCallback) {
  const matchedTypes = matches.map(([x, y]) => currentBoard[y][x]?.type).filter(Boolean);
  effectCallback(matchedTypes);
}
```

`checkAndRemoveMatches` を呼び出しているすべての箇所を検索し、プレイヤーターン呼び出しのもの（`isEnemy = false`のケース）に `showEffect` を第4引数として渡す。

呼び出し箇所の特定: ファイル内で `checkAndRemoveMatches(` を grep し、`isEnemy` が false（省略含む）のものに `showEffect` を追加する。

### 6. ShogiRPG コンポーネントへのフックとオーバーレイ追加

**フック呼び出し追加場所**: `const [combo, setCombo] = useState(0);` の後（約1152行目）。

```jsx
const { effectGif, effectKey, showEffect } = useBattleEffect();
```

**BattleEffectOverlay の配置場所**: メインの return 文の最外ラッパー div の直下（最初の子要素として）。

```jsx
return (
  <div style={{ /* 既存の最外ラッパースタイル */ }}>
    <BattleEffectOverlay effectGif={effectGif} effectKey={effectKey} />
    {/* 以下既存コンテンツ */}
```

### 7. StageBackground コンポーネントの改修

**対象**: 約588〜1100行目の `StageBackground` コンポーネント全体。

**改修方針**: 各ステージの最外 `<div>` に `backgroundImage` プロパティを追加し、既存の CSS グラデーション/パターンの `<div>` をオーバーレイとして重ねる。

**ステージ別背景画像アサイン**:

| Stage | 妖怪 | 背景画像URL |
|-------|------|-------------|
| 1 | 座敷わらし（古びた宿） | `https://pipoya.net/sozai/wp-content/uploads/2018/07/66f03f1a4230e3418f0282d812fc920a.jpeg` |
| 2 | 河童（河原） | `https://pipoya.net/sozai/wp-content/uploads/2018/07/a3c1f16d14a2f03a8074b2e62afe9fd4.jpeg` |
| 3 | 天狗（山岳） | `https://pipoya.net/sozai/wp-content/uploads/2018/07/235884c456a74b8f859646f36d6da7d4.jpeg` |
| 4 | 鬼（鬼ヶ島） | `https://pipoya.net/sozai/wp-content/uploads/2018/07/78d95e7df9096c32af0599d38f4ccad6.jpeg` |
| 5 | 九尾の狐（神社） | `https://pipoya.net/sozai/wp-content/uploads/2018/07/b168bedf1adfa3818004d3af94ee9d54.jpeg` |
| 6 | 雪女（雪山） | `https://pipoya.net/sozai/wp-content/uploads/2018/07/76d9576038cc7443dbb2eebb5ea777f2.png` |
| 7〜10 | 残りステージ | 画像なし（既存CSSを強化して対応） |

**各ステージの共通改修パターン**:

```jsx
// ステージ N の最外 div を以下に変更（画像URLはステージ別に変える）
<div style={{
  position: 'absolute',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundImage: 'url(ぴぽやURL)',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
}}>
  {/* 半透明オーバーレイ（視認性確保） */}
  <div style={{
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.55)',
  }} />
  {/* 既存の CSS パターン div はそのまま残す（ただし opacity を調整） */}
  {/* 既存のグラデーション div の opacity を 0.3 以下に下げる */}
```

ステージ 7〜10 は `backgroundImage` を追加せず、既存の CSS グラデーションの彩度・コントラストを若干強化するにとどめる。

### 8. GSAPによる画面遷移アニメーション

**追加場所**: `ShogiRPG` コンポーネント内、`useEffect` の末尾（新規 `useEffect` として追加）。

```jsx
// GSAP画面遷移エフェクト
React.useEffect(() => {
  if (typeof gsap === 'undefined') return; // GSAP読み込み失敗時のフォールバック
  gsap.fromTo(
    '#game-screen',
    { opacity: 0, y: 20 },
    { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }
  );
}, [gameState]);
```

メインの return 文の最外ラッパー div に `id="game-screen"` を追加する。

**タイトル画面のテキストアニメーション追加**:

```jsx
React.useEffect(() => {
  if (gameState !== 'start') return;
  if (typeof gsap === 'undefined') return;
  gsap.fromTo(
    '.title-logo',
    { opacity: 0, scale: 0.8, y: -30 },
    { opacity: 1, scale: 1, y: 0, duration: 0.8, ease: 'back.out(1.7)' }
  );
  gsap.fromTo(
    '.title-subtitle',
    { opacity: 0, y: 20 },
    { opacity: 1, y: 0, duration: 0.6, delay: 0.4, ease: 'power2.out' }
  );
}, [gameState]);
```

タイトルの `<h1>` に `className="title-logo"` を追加する。  
タイトルの `<p>` に `className="title-subtitle"` を追加する。

### 9. バトルUIのグラスモーフィズム化

**対象**: 約2889行目のバトルパネル最外 div。

現在のスタイル:
```javascript
background: 'linear-gradient(135deg, rgba(0,0,0,0.95), rgba(20,20,40,0.95))',
```

変更後のスタイル（既存スタイルに以下を追加・変更）:
```javascript
background: 'rgba(0, 0, 10, 0.75)',
backdropFilter: 'blur(12px)',
WebkitBackdropFilter: 'blur(12px)',
border: `2px solid ${currentMonster.color}88`,
boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 40px ${currentMonster.color}44, inset 0 1px 0 rgba(255,255,255,0.1)`,
```

### 10. HPバーのグラデーション・グロー強化

**対象**: 約2946行目のモンスターHPバー内側 div。

現在のスタイル:
```javascript
background: `linear-gradient(90deg, ${currentMonster.color}ee, ${currentMonster.color}99, ${currentMonster.color}ee)`,
```

変更後のスタイル（同プロパティを差し替え）:
```javascript
background: `linear-gradient(90deg, 
  ${currentMonster.color}ff 0%, 
  ${currentMonster.color}cc 50%, 
  ${currentMonster.color}ff 100%)`,
boxShadow: `0 0 10px ${currentMonster.color}cc, 0 0 20px ${currentMonster.color}66`,
transition: 'width 0.4s ease-out',
```

プレイヤーHPバーも同様に `boxShadow` グローを追加する（色は `#4ade80`）。

### 11. 妖怪表示エリアの発光枠

**対象**: 約2912行目の妖怪SVGを囲む `<div>`。

現在のスタイル（`filter` プロパティのみ）:
```javascript
filter: `drop-shadow(0 0 15px ${currentMonster.color}) drop-shadow(0 5px 10px rgba(0,0,0,0.5))`,
```

外側のラッパーdivにスタイルを追加:
```javascript
border: `2px solid ${currentMonster.color}66`,
borderRadius: '16px',
padding: '8px',
background: `radial-gradient(circle at center, ${currentMonster.color}22 0%, transparent 70%)`,
animation: 'glowPulse 2.5s ease-in-out infinite',
color: currentMonster.color,  // currentColor参照のため
```

### 12. タイトルロゴのシマーアニメーション

**対象**: 約2346行目のタイトル `<h1>`。

`className="title-logo"` を追加し、スタイルを変更:

```javascript
// background プロパティを以下に差し替え
background: 'linear-gradient(90deg, #ffd700, #fffbe0, #ffd700, #fffbe0, #ffd700)',
backgroundSize: '200% auto',
WebkitBackgroundClip: 'text',
WebkitTextFillColor: 'transparent',
animation: 'shimmer 3s linear infinite',
```

### 13. 将棋盤セルのグロー強化

**対象**: セルのレンダリング箇所（`handleCellClick` で `selectedCell` がセットされるセルの styling）。

選択済みセルのスタイルに以下を追加:
```javascript
boxShadow: `0 0 15px ${piece?.color || '#fff'}, 0 0 30px ${piece?.color || '#fff'}66`,
transform: 'scale(1.08)',
transition: 'all 0.15s ease',
zIndex: 10,
position: 'relative',
```

---

## ファイル変更サマリー

対象ファイル: `c:/Users/hifuk/Documents/Git_hub/hide_0001/shogi_rpg_local.html`（単一ファイル）

| 変更箇所 | 変更種別 | 対象行（概算） |
|---------|---------|---------------|
| `<head>` — GSAP `<script>` タグ追加 | 追加 | 17行目の前 |
| `<style>` — CSSキーフレーム追加 | 追加 | 12行目 `</style>` の前 |
| `BattleEffectOverlay` コンポーネント追加 | 追加 | 586行目の後 |
| `useBattleEffect` カスタムフック追加 | 追加 | `BattleEffectOverlay` の後 |
| `ShogiRPG` — `useBattleEffect` フック呼び出し追加 | 追加 | 1152行目 |
| `checkAndRemoveMatches` — 引数追加・エフェクト呼び出し | 変更 | 1467行目 |
| `checkAndRemoveMatches` 呼び出し箇所 — 引数追加 | 変更 | 複数箇所 |
| `return` 文最外 div — `id="game-screen"` 追加 | 変更 | return 直後 |
| `return` 文内 — `BattleEffectOverlay` JSX追加 | 追加 | return 直後の子 |
| GSAP `useEffect` 追加（画面遷移） | 追加 | 既存 useEffect の後 |
| GSAP `useEffect` 追加（タイトルアニメ） | 追加 | 上記の後 |
| `<h1>` タイトルロゴ — className・スタイル変更 | 変更 | 2346行目 |
| `<p>` タイトルサブタイトル — className追加 | 変更 | 2357行目 |
| `StageBackground` stage 1〜6 — 背景画像追加 | 変更 | 588〜900行目 |
| バトルパネル最外 div — グラスモーフィズム化 | 変更 | 2889行目 |
| モンスターHPバー — グラデーション・グロー強化 | 変更 | 2946行目 |
| プレイヤーHPバー — グロー強化 | 変更 | HPバー付近 |
| 妖怪表示エリア — 発光枠追加 | 変更 | 2912行目 |
| 将棋盤セル — 選択グロー強化 | 変更 | セルレンダリング箇所 |

---

## Evaluator採点基準への対応

| 評価項目 | 対応内容 |
|---------|---------|
| 仕様適合性（M-01〜M-06 必須実装） | StageBackground画像化・GIFエフェクト・GSAP・グラスモーフィズム・HPグロー・発光枠 全6項目実装 |
| XSS脆弱性なし | dangerouslySetInnerHTML 不使用。外部URLはすべてハードコーディング |
| ゲームロジック無変更 | `checkAndRemoveMatches` はオプション引数追加のみ（既存呼び出しに影響なし） |
| ファイルサイズ300KB以内 | 外部画像はURL参照のみ。追加コードは約5KB以下 |
| React + Babel CDN 維持 | `<script type="text/babel">` 構成を変更しない |
| GSAP読み込み失敗フォールバック | `if (typeof gsap === 'undefined') return;` で guard |

---

## 注意事項（Generator向け）

1. `checkAndRemoveMatches` を呼び出している箇所をすべて特定すること（`grep 'checkAndRemoveMatches('` で確認）。プレイヤーターン（`isEnemy = false` または引数省略）の呼び出しにのみ `showEffect` を第4引数として追加する。

2. `StageBackground` の改修は、既存の CSS グラデーション `<div>` を削除しないこと。画像が読み込めない場合のフォールバックとして機能させる。

3. GSAP のセレクタ（`.title-logo` 等）は、React の JSX に `className` として付与すること。`document.querySelector` での直接操作は避ける。

4. `useBattleEffect` は `React.useState` / `React.useCallback` / `React.useRef` を使う（`const { useState } = React;` のデストラクチャ済み変数がスコープ内にある場合はそちらを使ってもよいが、フック内部では `React.useXxx` で統一すること）。

5. `BattleEffectOverlay` の `img` タグは `alt=""` とし、スクリーンリーダー対象外にする（装飾画像のため）。
