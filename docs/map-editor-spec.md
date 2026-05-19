# ファンタジーマップエディタ 仕様書

## 採用フリーアセット一覧

| アセット名 | 提供元 | ライセンス | ダウンロードURL | 用途 |
|---|---|---|---|---|
| Cartography Pack (85 assets) | Kenney.nl | CC0 | https://kenney.nl/assets/cartography-pack / ZIP: `https://opengameart.org/sites/default/files/cartographypack.zip` | 地図描画用スタンプ（山・木・城・港・船・コンパスローズなど）、シームレス羊皮紙テクスチャ |
| Map Pack (180 assets) | Kenney.nl | CC0 | https://kenney.nl/assets/map-pack | 地形タイル（草・水・道・砂漠・岩）、スプライトシート |
| Roguelike/RPG Pack (1700 assets, 16x16px) | Kenney.nl | CC0 | https://kenney.nl/assets/roguelike-rpg-pack | 追加オブジェクト（建物・家具・アイテム）スプライトシート |
| CC0 Hand-drawn Fantasy Icon Pack | Cosmo Myzrail Gorynych (itch.io) | CC0 | https://comigo.itch.io/fantasy-icons-ink — ZIP: `CoMiGoFantasyIcons.zip` (9.7 MB) | 手描きアイコン（自然物・ランドマーク・武器）PNG/SVG |
| Game-icons.net 自然・マップカテゴリ | Game-icons.net | CC BY 3.0 | https://game-icons.net/tags/nature.html / https://game-icons.net/tags/map.html | 山・森・木・火山・川・洞窟・コンパスなどのアイコン（SVG/PNG） |

**注意**: Game-icons.netはCC BY 3.0のためクレジット表記が必要。実装時にフッターに `Icons by game-icons.net (CC BY 3.0)` を記載する。

---

## 要件定義書

### 背景・目的

ゲーム制作者・TRPGユーザーが、ブラウザ上でファンタジーワールドマップを手軽に作成・書き出しできるツールを提供する。Inkarnate Worldsのコア操作体験（地形ペイント + アセット配置 + PNG書き出し）をシングルHTMLファイルで再現する。

---

### 機能要件（MoSCoW法）

#### Must（必須）

| ID | 機能名 | 概要 |
|---|---|---|
| F-01 | マップキャンバス | 可変サイズ（デフォルト 1024×768px、最大 2048×2048px）のCanvasを表示する |
| F-02 | 地形ペイントツール | 海・深海・浅瀬・草原・砂漠・雪原・山岳の7種を選択し、ブラシで塗れる |
| F-03 | ブラシサイズ変更 | スライダーでブラシ半径を調整（10〜200px）|
| F-04 | アセット配置ツール | アセットパネルからスタンプを選択し、キャンバスをクリックして配置する |
| F-05 | 地形レイヤー | 地形カラーマップを保持する専用Canvasレイヤー |
| F-06 | オブジェクトレイヤー | 配置済みアセットのリストを保持し、地形の上に描画する |
| F-07 | PNG書き出し | 全レイヤーを合成してPNGとしてダウンロードする |
| F-08 | アセットパネル | カテゴリ別にアセットサムネイルを表示する左サイドバー |
| F-09 | 選択・削除ツール | 配置済みオブジェクトをクリックで選択し、Deleteキーで削除する |
| F-10 | 日英バイリンガルUI | ボタン・ラベルに日本語・英語を併記する |

#### Should（推奨）

| ID | 機能名 | 概要 |
|---|---|---|
| F-11 | 配置オブジェクト移動 | 選択したオブジェクトをドラッグで移動する |
| F-12 | 消しゴムツール | 地形レイヤーを塗りつぶし色（「陸地ベース」色）に戻す |
| F-13 | アンドゥ | Ctrl+Z で直近10操作を元に戻す |
| F-14 | マップタイトル記入 | テキスト入力でマップ名を設定し、書き出しPNGのファイル名に反映する |
| F-15 | ズーム・パン | マウスホイールでズーム（50%〜300%）、スペース+ドラッグでパン |
| F-16 | アセットサイズ変更 | 配置前にスライダーでアセットのスケールを変更（50%〜200%）|

#### Could（任意）

| ID | 機能名 | 概要 |
|---|---|---|
| F-17 | レイヤー可視切替 | レイヤーパネルで地形/オブジェクト各レイヤーの表示/非表示を切替 |
| F-18 | グリッド表示 | 任意間隔のグリッドをオーバーレイ表示する |
| F-19 | マップ保存・読み込み | JSON形式でマップデータをローカル保存/ファイル読み込みする |
| F-20 | テキストラベル | キャンバス上に地名テキストを配置する |

#### Won't（今回実装しない）

- サーバーサイド処理・アカウント管理
- マルチユーザー共同編集
- 3Dまたは等角投影マップ
- アセットの自前アップロード機能

---

### 非機能要件

| 区分 | 要件 |
|---|---|
| パフォーマンス | 1024×768px時に地形ペイントが60fps維持（requestAnimationFrame使用）|
| セキュリティ | 外部URL入力なし。XSSリスクなし（ユーザー入力はマップ名テキストのみ）|
| 互換性 | Chrome/Edge/Firefox最新版。モバイル対応は任意（PCブラウザ優先）|
| デプロイ | シングルHTMLファイルとして静的配信（GitHub Pages）|
| アセット読み込み | 外部アセット画像はJavaScript内でBase64埋め込みまたはCORSフリーURLから fetch して Canvas.drawImage で描画 |

---

### 制約条件

- フレームワーク・ビルドツール不使用
- 外部ライブラリはCDN経由のみ（ただし今回は使用しない方針）
- アセット画像: kenney.nlのZIPをダウンロードしてBase64化するか、または同リポジトリにPNG配置する。ライセンスはCC0
- 黒背景 + シアン/パープルアクセント（既存スタイル継承）、Glassmorphismカード
- ファイル名: `map-editor.html`（プロジェクトルート直下）

---

## 基本設計書

### システム構成図

```
map-editor.html（シングルファイル）
│
├── <head>
│   ├── CSS変数定義（カラースキーム・フォント）
│   └── <style> インラインCSS
│
├── <body>
│   ├── #app-container          ← 全体レイアウト（flex）
│   │   ├── #toolbar            ← 上部ツールバー
│   │   ├── #main-area          ← メインエリア（flex横並び）
│   │   │   ├── #asset-panel    ← 左サイドバー（アセットパネル）
│   │   │   ├── #canvas-area    ← 中央キャンバスエリア
│   │   │   │   ├── canvas#terrain-canvas   ← 地形レイヤー
│   │   │   │   └── canvas#object-canvas    ← オブジェクトレイヤー（マウスイベント受信）
│   │   │   └── #props-panel    ← 右サイドバー（プロパティパネル）
│   │   └── #statusbar          ← 下部ステータスバー（座標表示）
│   └── <script> インラインJS
│
└── JavaScript モジュール（クラス・モジュール設計）
    ├── MapState             ← マップデータ管理
    ├── TerrainRenderer      ← 地形レイヤー描画
    ├── ObjectRenderer       ← オブジェクトレイヤー描画
    ├── AssetLibrary         ← アセット画像管理
    ├── ToolManager          ← 現在のアクティブツール管理
    ├── UndoHistory          ← アンドゥ履歴
    ├── InputHandler         ← マウス/キーボードイベント統合
    └── Exporter             ← PNG書き出し
```

---

### 画面レイアウト

```
┌──────────────────────────────────────────────────────────────────┐
│  [ツールバー]  Map Editor  [タイトル入力]  [保存] [書き出しPNG]  │  高さ 52px
├───────────────┬─────────────────────────────┬───────────────────┤
│               │                             │                   │
│  アセット      │                             │ プロパティ        │
│  パネル        │      キャンバスエリア        │ パネル            │
│  (240px)      │   ┌─────────────────────┐  │ (200px)           │
│  ─────────── │   │  terrain-canvas     │  │ ─────────────── │
│  カテゴリタブ  │   │  (z-index: 1)       │  │ ブラシサイズ      │
│  ・地形        │   ├─────────────────────┤  │ アセットスケール  │
│  ・自然物      │   │  object-canvas      │  │ 選択オブジェクト  │
│  ・建物        │   │  (z-index: 2)       │  │ 情報              │
│  ・海洋        │   └─────────────────────┘  │                   │
│  ─────────── │                             │                   │
│  サムネイル   │                             │                   │
│  グリッド     │                             │                   │
│               │                             │                   │
├───────────────┴─────────────────────────────┴───────────────────┤
│  [ステータスバー]  X:512 Y:384  Zoom:100%  ツール:ペイント       │  高さ 28px
└──────────────────────────────────────────────────────────────────┘
```

---

### 画面遷移

単一ページ（遷移なし）。モーダルダイアログのみ:

- 「新規マップ」押下 → サイズ選択モーダル（幅・高さ入力）
- 「PNG書き出し」押下 → 解像度選択モーダル → ダウンロード

---

### データ構造の概要

```javascript
// マップ全体の状態
MapState = {
  width: 1024,        // キャンバス幅(px)
  height: 768,        // キャンバス高(px)
  title: "My Map",    // マップ名
  terrainData: ImageData,  // 地形レイヤーのピクセルデータ（直接Canvas保持）
  objects: [          // 配置済みオブジェクト配列
    {
      id: "obj_001",
      assetId: "tree_pine",   // AssetLibrary内のキー
      x: 300,         // キャンバス上のX座標（中心）
      y: 200,         // キャンバス上のY座標（中心）
      scale: 1.0,     // スケール倍率
      rotation: 0     // 回転角度（今回は0固定）
    }
  ],
  undoStack: []       // 操作履歴
}

// アセット定義
AssetDef = {
  id: String,         // 一意キー（例: "tree_pine"）
  name_ja: String,    // 日本語名
  name_en: String,    // 英語名
  category: String,   // カテゴリ（"nature" | "building" | "ocean" | "terrain"）
  src: String,        // 画像URL またはBase64
  img: HTMLImageElement  // ロード済み画像オブジェクト（実行時に格納）
}
```

---

### 主要コンポーネントの役割

| コンポーネント | 役割 |
|---|---|
| TerrainRenderer | terrain-canvas に地形カラーを描画。ブラシ塗りはputImageDataで直接ピクセル操作 |
| ObjectRenderer | object-canvas に objects配列を毎フレームdrawImageで再描画（dirty flagによる最適化） |
| AssetLibrary | 起動時に全アセット画像をImage要素に非同期ロード。ロード完了後にUIを有効化 |
| ToolManager | currentTool（"paint" / "erase" / "stamp" / "select" / "move"）を管理 |
| UndoHistory | paint/stamp/deleteごとにスナップショット（地形はImageData, オブジェクトはJSON）を最大10件保持 |
| InputHandler | mousedown/mousemove/mouseup/wheel/keydown を統合。ズーム変換を適用した仮想座標を各ツールに渡す |
| Exporter | OffscreenCanvas に terrain + objects を合成して toBlob でダウンロード |

---

## 詳細設計書

### ファイル構成

```
hide_0001_hon/
└── map-editor.html   ← 単一ファイル（全コードをインライン）
assets/
└── map-editor/
    ├── cartography/  ← Kenney Cartography Pack の個別PNG（85枚）
    │   ├── tree_pine.png
    │   ├── mountain_01.png
    │   ├── castle_01.png
    │   └── ... (合計85枚)
    └── roguelike/    ← Roguelike RPG Pack から抽出した建物PNGのみ
        ├── building_house.png
        └── ...
```

**アセット配置方針**: Kenney Cartography PackのZIPをダウンロードし、個別PNGを `assets/map-editor/cartography/` に配置する。map-editor.html からは相対パスで参照する。

---

### CSS変数定義

```css
:root {
  --bg: #0a0a0f;
  --surface: rgba(255, 255, 255, 0.04);
  --surface-hover: rgba(255, 255, 255, 0.08);
  --border: rgba(255, 255, 255, 0.10);
  --cyan: #06b6d4;
  --cyan-soft: rgba(6, 182, 212, 0.15);
  --purple: #a855f7;
  --purple-soft: rgba(168, 85, 247, 0.15);
  --text: #e2e8f0;
  --muted: #64748b;
  --radius: 10px;
  --toolbar-h: 52px;
  --panel-w: 240px;
  --props-w: 200px;
  --statusbar-h: 28px;
}
```

---

### HTMLレイアウト（骨格）

```html
<div id="app">
  <!-- ツールバー -->
  <header id="toolbar">
    <div class="toolbar-left">
      <span class="logo">Map Editor</span>
      <input id="map-title" type="text" value="My Map" />
    </div>
    <div class="toolbar-tools">
      <button data-tool="paint"  class="tool-btn active" title="地形ペイント / Paint">🖌</button>
      <button data-tool="erase"  class="tool-btn" title="消しゴム / Erase">⬜</button>
      <button data-tool="stamp"  class="tool-btn" title="スタンプ / Stamp">📌</button>
      <button data-tool="select" class="tool-btn" title="選択 / Select">↖</button>
    </div>
    <div class="toolbar-right">
      <button id="btn-new">新規 / New</button>
      <button id="btn-save">保存 / Save</button>
      <button id="btn-export" class="btn-primary">PNG書き出し / Export</button>
    </div>
  </header>

  <!-- メインエリア -->
  <main id="main-area">
    <!-- 左サイドバー: アセットパネル -->
    <aside id="asset-panel">
      <div id="category-tabs">
        <button class="cat-tab active" data-cat="nature">自然 / Nature</button>
        <button class="cat-tab" data-cat="building">建物 / Building</button>
        <button class="cat-tab" data-cat="ocean">海洋 / Ocean</button>
        <button class="cat-tab" data-cat="terrain">地形 / Terrain</button>
      </div>
      <div id="terrain-palette"><!-- 地形カテゴリ時のみ表示 --></div>
      <div id="asset-grid"><!-- アセットサムネイル --></div>
    </aside>

    <!-- 中央: キャンバスエリア -->
    <section id="canvas-area">
      <div id="canvas-wrapper">
        <canvas id="terrain-canvas"></canvas>
        <canvas id="object-canvas"></canvas>
      </div>
    </section>

    <!-- 右サイドバー: プロパティ -->
    <aside id="props-panel">
      <section class="prop-section">
        <h3>地形ブラシ / Brush</h3>
        <label>サイズ / Size</label>
        <input id="brush-size" type="range" min="10" max="200" value="40" />
        <span id="brush-size-val">40px</span>
      </section>
      <section class="prop-section">
        <h3>スタンプ / Stamp</h3>
        <label>スケール / Scale</label>
        <input id="asset-scale" type="range" min="25" max="200" value="100" />
        <span id="asset-scale-val">100%</span>
      </section>
      <section class="prop-section" id="selected-props">
        <h3>選択中 / Selected</h3>
        <p id="selected-info">なし / None</p>
        <button id="btn-delete-obj">削除 / Delete</button>
      </section>
    </aside>
  </main>

  <!-- ステータスバー -->
  <footer id="statusbar">
    <span id="status-coords">X:0 Y:0</span>
    <span id="status-zoom">Zoom: 100%</span>
    <span id="status-tool">ツール: ペイント / Tool: Paint</span>
  </footer>
</div>
```

---

### JavaScriptモジュール詳細設計

#### 1. 定数定義

```javascript
const TERRAIN_TYPES = [
  { id: 'deep_sea',  name_ja: '深海',  name_en: 'Deep Sea',   color: '#0d2b45' },
  { id: 'sea',       name_ja: '海',    name_en: 'Sea',         color: '#1a5f8a' },
  { id: 'shallow',   name_ja: '浅瀬',  name_en: 'Shallow',     color: '#2a9d8f' },
  { id: 'plains',    name_ja: '草原',  name_en: 'Plains',      color: '#4a7c59' },
  { id: 'desert',    name_ja: '砂漠',  name_en: 'Desert',      color: '#c9a84c' },
  { id: 'snow',      name_ja: '雪原',  name_en: 'Snow',        color: '#c8d8e8' },
  { id: 'mountain',  name_ja: '山岳',  name_en: 'Mountain',    color: '#7a6652' }
];

const ASSET_DEFS = [
  // カテゴリ: nature
  { id: 'tree_pine',      name_ja: '松',    name_en: 'Pine Tree',    category: 'nature',   src: 'assets/map-editor/cartography/tree_pine.png' },
  { id: 'tree_oak',       name_ja: '広葉樹', name_en: 'Oak Tree',     category: 'nature',   src: 'assets/map-editor/cartography/tree_oak.png' },
  { id: 'tree_dead',      name_ja: '枯れ木', name_en: 'Dead Tree',    category: 'nature',   src: 'assets/map-editor/cartography/tree_dead.png' },
  { id: 'mountain_sm',    name_ja: '山(小)', name_en: 'Mountain S',   category: 'nature',   src: 'assets/map-editor/cartography/mountain_small.png' },
  { id: 'mountain_lg',    name_ja: '山(大)', name_en: 'Mountain L',   category: 'nature',   src: 'assets/map-editor/cartography/mountain_large.png' },
  { id: 'hill',           name_ja: '丘',    name_en: 'Hill',          category: 'nature',   src: 'assets/map-editor/cartography/hill.png' },
  // カテゴリ: building
  { id: 'castle',         name_ja: '城',    name_en: 'Castle',        category: 'building', src: 'assets/map-editor/cartography/castle.png' },
  { id: 'village',        name_ja: '村',    name_en: 'Village',       category: 'building', src: 'assets/map-editor/cartography/village.png' },
  { id: 'tower',          name_ja: '塔',    name_en: 'Tower',         category: 'building', src: 'assets/map-editor/cartography/tower.png' },
  { id: 'ruins',          name_ja: '廃墟',  name_en: 'Ruins',         category: 'building', src: 'assets/map-editor/cartography/ruins.png' },
  // カテゴリ: ocean
  { id: 'ship',           name_ja: '船',    name_en: 'Ship',          category: 'ocean',    src: 'assets/map-editor/cartography/ship.png' },
  { id: 'lighthouse',     name_ja: '灯台',  name_en: 'Lighthouse',    category: 'ocean',    src: 'assets/map-editor/cartography/lighthouse.png' },
  { id: 'harbor',         name_ja: '港',    name_en: 'Harbor',        category: 'ocean',    src: 'assets/map-editor/cartography/harbor.png' },
  // カテゴリ: terrain
  { id: 'compass',        name_ja: 'コンパス', name_en: 'Compass Rose', category: 'terrain', src: 'assets/map-editor/cartography/compass.png' },
  { id: 'scroll_border',  name_ja: '巻物枠', name_en: 'Scroll Border', category: 'terrain', src: 'assets/map-editor/cartography/scroll_border.png' }
];
```

**実装注意**: ASSET_DEFSのsrcは、実際にCartography PackのZIPを展開してassetsフォルダに配置後、実際のファイル名に合わせて修正すること。ファイル名はZIP内の名前をそのまま使用する（例: `kenney_cartographypack/` 内のPNGファイル名）。

---

#### 2. MapState クラス

```javascript
class MapState {
  constructor(width = 1024, height = 768) {
    this.width = width;
    this.height = height;
    this.title = 'My Map';
    this.objects = [];      // PlacedObject[]
    this.undoStack = [];    // {terrainImageData: ImageData, objects: PlacedObject[]}[]
    this.nextObjId = 1;
  }

  // 配置済みオブジェクトを追加
  addObject(assetId, x, y, scale) { ... }

  // オブジェクトをIDで削除
  removeObject(id) { ... }

  // オブジェクトを移動
  moveObject(id, dx, dy) { ... }

  // アンドゥ用スナップショット取得
  snapshot(terrainCtx) {
    return {
      terrainImageData: terrainCtx.getImageData(0, 0, this.width, this.height),
      objects: JSON.parse(JSON.stringify(this.objects))
    };
  }

  // スナップショットを最大10件保持してスタックに積む
  pushUndo(snap) {
    this.undoStack.push(snap);
    if (this.undoStack.length > 10) this.undoStack.shift();
  }

  // アンドゥ実行: スタックから1件ポップしてterrain/objectsを復元
  undo(terrainCtx) {
    if (this.undoStack.length === 0) return;
    const snap = this.undoStack.pop();
    terrainCtx.putImageData(snap.terrainImageData, 0, 0);
    this.objects = snap.objects;
  }
}
```

---

#### 3. AssetLibrary クラス

```javascript
class AssetLibrary {
  constructor() {
    this.assets = {};  // id -> { def: AssetDef, img: HTMLImageElement }
    this.loadedCount = 0;
    this.totalCount = ASSET_DEFS.length;
  }

  // 全アセットを非同期ロード。完了時に onReady コールバックを呼ぶ
  loadAll(onProgress, onReady) {
    ASSET_DEFS.forEach(def => {
      const img = new Image();
      img.onload = () => {
        this.assets[def.id] = { def, img };
        this.loadedCount++;
        onProgress(this.loadedCount, this.totalCount);
        if (this.loadedCount === this.totalCount) onReady();
      };
      img.onerror = () => {
        // ロード失敗時は32x32の代替画像（赤×）を生成してフォールバック
        this.assets[def.id] = { def, img: createFallbackImage(def.name_en) };
        this.loadedCount++;
        if (this.loadedCount === this.totalCount) onReady();
      };
      img.src = def.src;
    });
  }

  // IDでアセット画像を取得
  getImage(id) { return this.assets[id]?.img ?? null; }
  getDef(id) { return this.assets[id]?.def ?? null; }

  // カテゴリでフィルタリングしてAssetDef[]を返す
  getByCategory(category) {
    return ASSET_DEFS.filter(d => d.category === category);
  }
}

// フォールバック: 指定テキストを描いた32x32 Canvasをdata URLに変換
function createFallbackImage(label) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#333'; ctx.fillRect(0,0,32,32);
  ctx.fillStyle = '#f00'; ctx.font = '10px sans-serif';
  ctx.fillText('?', 10, 20);
  const img = new Image();
  img.src = c.toDataURL();
  return img;
}
```

---

#### 4. TerrainRenderer クラス

```javascript
class TerrainRenderer {
  constructor(canvas, mapState) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mapState = mapState;
    this._initCanvas();
  }

  _initCanvas() {
    this.canvas.width = this.mapState.width;
    this.canvas.height = this.mapState.height;
    // デフォルト地形: 全面「海」
    this.ctx.fillStyle = '#1a5f8a';
    this.ctx.fillRect(0, 0, this.mapState.width, this.mapState.height);
  }

  // ブラシ描画: 円形エリアを terrainColor で塗る
  // cx, cy: キャンバス座標（ズーム変換適用後）, radius: ブラシ半径
  paint(cx, cy, radius, terrainColor) {
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    this.ctx.fillStyle = terrainColor;
    this.ctx.fill();
    this.ctx.restore();
  }

  // 消しゴム: 指定円を海色で塗り潰す
  erase(cx, cy, radius) {
    this.paint(cx, cy, radius, '#1a5f8a');
  }

  // キャンバス全体をImageDataとして取得（アンドゥ用）
  getImageData() {
    return this.ctx.getImageData(0, 0, this.mapState.width, this.mapState.height);
  }

  // ImageDataからキャンバスを復元（アンドゥ用）
  putImageData(imageData) {
    this.ctx.putImageData(imageData, 0, 0);
  }
}
```

---

#### 5. ObjectRenderer クラス

```javascript
class ObjectRenderer {
  constructor(canvas, mapState, assetLibrary) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mapState = mapState;
    this.assetLibrary = assetLibrary;
    this.selectedId = null;
    this.dirty = true;
  }

  // 毎フレームまたはdirty=trueのとき呼ぶ
  render() {
    if (!this.dirty) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.mapState.objects.forEach(obj => {
      const img = this.assetLibrary.getImage(obj.assetId);
      if (!img) return;
      const w = img.naturalWidth * obj.scale;
      const h = img.naturalHeight * obj.scale;
      this.ctx.drawImage(img, obj.x - w/2, obj.y - h/2, w, h);
      // 選択中オブジェクトはシアンの選択枠を描画
      if (obj.id === this.selectedId) {
        this.ctx.save();
        this.ctx.strokeStyle = '#06b6d4';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([4, 4]);
        this.ctx.strokeRect(obj.x - w/2 - 2, obj.y - h/2 - 2, w + 4, h + 4);
        this.ctx.restore();
      }
    });
    this.dirty = false;
  }

  markDirty() { this.dirty = true; }

  // クリック座標からオブジェクトを逆順（前面優先）でヒットテスト
  hitTest(x, y) {
    for (let i = this.mapState.objects.length - 1; i >= 0; i--) {
      const obj = this.mapState.objects[i];
      const img = this.assetLibrary.getImage(obj.assetId);
      if (!img) continue;
      const w = img.naturalWidth * obj.scale;
      const h = img.naturalHeight * obj.scale;
      if (x >= obj.x - w/2 && x <= obj.x + w/2 &&
          y >= obj.y - h/2 && y <= obj.y + h/2) {
        return obj;
      }
    }
    return null;
  }
}
```

---

#### 6. ToolManager クラス

```javascript
class ToolManager {
  constructor() {
    this.currentTool = 'paint';   // 'paint' | 'erase' | 'stamp' | 'select'
    this.selectedTerrainId = 'sea';
    this.selectedAssetId = null;
    this.brushRadius = 40;
    this.assetScale = 1.0;
    this.listeners = {};          // ツール変更時コールバック
  }

  setTool(tool) {
    this.currentTool = tool;
    this._emit('toolChange', tool);
    updateStatusBar();
  }

  setTerrain(terrainId) { this.selectedTerrainId = terrainId; }
  setAsset(assetId) { this.selectedAssetId = assetId; }
  setBrushRadius(r) { this.brushRadius = r; }
  setAssetScale(s) { this.assetScale = s; }

  on(event, cb) { this.listeners[event] = cb; }
  _emit(event, data) { if (this.listeners[event]) this.listeners[event](data); }
}
```

---

#### 7. InputHandler クラス（ViewTransform統合）

```javascript
class InputHandler {
  constructor(objectCanvas, toolManager, terrainRenderer, objectRenderer, mapState, assetLibrary) {
    // 各コンポーネントを保持
    this.canvas = objectCanvas;
    this.tm = toolManager;
    this.tr = terrainRenderer;
    this.or = objectRenderer;
    this.ms = mapState;
    this.al = assetLibrary;

    // ビュー変換（ズーム/パン）
    this.viewScale = 1.0;
    this.viewOffsetX = 0;
    this.viewOffsetY = 0;

    this.isPainting = false;
    this.isDragging = false;
    this.dragObj = null;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;

    this._bindEvents();
  }

  // スクリーン座標 → キャンバス座標変換
  screenToCanvas(sx, sy) {
    return {
      x: (sx - this.viewOffsetX) / this.viewScale,
      y: (sy - this.viewOffsetY) / this.viewScale
    };
  }

  // キャンバス座標 → スクリーン座標変換（CSS transform用）
  canvasToScreen(cx, cy) {
    return {
      x: cx * this.viewScale + this.viewOffsetX,
      y: cy * this.viewScale + this.viewOffsetY
    };
  }

  // transform文字列をcanvas-wrapperのCSSに適用
  applyTransform() {
    const wrapper = document.getElementById('canvas-wrapper');
    wrapper.style.transform =
      `translate(${this.viewOffsetX}px, ${this.viewOffsetY}px) scale(${this.viewScale})`;
    wrapper.style.transformOrigin = '0 0';
    document.getElementById('status-zoom').textContent =
      `Zoom: ${Math.round(this.viewScale * 100)}%`;
  }

  _bindEvents() {
    this.canvas.addEventListener('mousedown', this._onMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this._onMouseMove.bind(this));
    this.canvas.addEventListener('mouseup',   this._onMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave',this._onMouseUp.bind(this));
    this.canvas.addEventListener('wheel',     this._onWheel.bind(this), { passive: false });
    document.addEventListener('keydown',      this._onKeyDown.bind(this));
  }

  _onMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { x, y } = this.screenToCanvas(sx, sy);

    if (e.button === 1 || e.spaceKey) { /* パン開始 */ return; }

    const tool = this.tm.currentTool;
    if (tool === 'paint' || tool === 'erase') {
      // アンドゥスナップショット（mousedown時に1回のみ取得）
      this.ms.pushUndo(this.ms.snapshot(this.tr.ctx));
      this.isPainting = true;
      this._doPaint(x, y);
    } else if (tool === 'stamp') {
      if (!this.tm.selectedAssetId) return;
      this.ms.pushUndo(this.ms.snapshot(this.tr.ctx));
      this.ms.addObject(this.tm.selectedAssetId, x, y, this.tm.assetScale);
      this.or.markDirty();
    } else if (tool === 'select') {
      const hit = this.or.hitTest(x, y);
      if (hit) {
        this.or.selectedId = hit.id;
        this.isDragging = true;
        this.dragObj = hit;
        this.dragStartX = x;
        this.dragStartY = y;
      } else {
        this.or.selectedId = null;
      }
      this.or.markDirty();
      updateSelectedProps(this.or.selectedId, this.ms, this.al);
    }
  }

  _onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { x, y } = this.screenToCanvas(sx, sy);

    document.getElementById('status-coords').textContent =
      `X:${Math.round(x)} Y:${Math.round(y)}`;

    if (this.isPainting) this._doPaint(x, y);
    if (this.isDragging && this.dragObj) {
      const dx = x - this.dragStartX;
      const dy = y - this.dragStartY;
      this.ms.moveObject(this.dragObj.id, dx, dy);
      this.dragStartX = x;
      this.dragStartY = y;
      this.or.markDirty();
    }
  }

  _onMouseUp(e) {
    this.isPainting = false;
    if (this.isDragging && this.dragObj) {
      this.ms.pushUndo(this.ms.snapshot(this.tr.ctx));
    }
    this.isDragging = false;
    this.dragObj = null;
  }

  _onWheel(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(3.0, Math.max(0.5, this.viewScale * delta));
    // ズーム中心点を維持
    this.viewOffsetX = mx - (mx - this.viewOffsetX) * (newScale / this.viewScale);
    this.viewOffsetY = my - (my - this.viewOffsetY) * (newScale / this.viewScale);
    this.viewScale = newScale;
    this.applyTransform();
  }

  _onKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      this.ms.undo(this.tr.ctx);
      this.or.markDirty();
    }
    if (e.key === 'Delete' && this.or.selectedId) {
      this.ms.pushUndo(this.ms.snapshot(this.tr.ctx));
      this.ms.removeObject(this.or.selectedId);
      this.or.selectedId = null;
      this.or.markDirty();
    }
  }

  _doPaint(x, y) {
    const tool = this.tm.currentTool;
    if (tool === 'paint') {
      const terrain = TERRAIN_TYPES.find(t => t.id === this.tm.selectedTerrainId);
      if (terrain) this.tr.paint(x, y, this.tm.brushRadius, terrain.color);
    } else if (tool === 'erase') {
      this.tr.erase(x, y, this.tm.brushRadius);
    }
  }
}
```

---

#### 8. Exporter クラス

```javascript
class Exporter {
  // terrainCanvas と objectCanvas を合成して PNG ダウンロード
  export(terrainCanvas, objectCanvas, title) {
    const w = terrainCanvas.width;
    const h = terrainCanvas.height;
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext('2d');
    // 1. 羊皮紙テクスチャ（任意: 半透明オーバーレイ）
    ctx.drawImage(terrainCanvas, 0, 0);
    ctx.drawImage(objectCanvas, 0, 0);
    offscreen.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${title || 'map'}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/png');
  }
}
```

---

#### 9. アニメーションループ

```javascript
function initRenderLoop(objectRenderer) {
  function loop() {
    objectRenderer.render();   // dirty=trueのときのみ実際に描画
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
```

---

#### 10. UIイベント初期化

```javascript
function initUI(toolManager, mapState, terrainRenderer, objectRenderer, assetLibrary, exporter) {
  // ツールボタン
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      toolManager.setTool(btn.dataset.tool);
    });
  });

  // 地形カテゴリタブ（terrain選択時にパレット表示）
  document.querySelectorAll('.cat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderAssetPanel(tab.dataset.cat, toolManager, assetLibrary);
    });
  });

  // ブラシサイズスライダー
  document.getElementById('brush-size').addEventListener('input', e => {
    toolManager.setBrushRadius(Number(e.target.value));
    document.getElementById('brush-size-val').textContent = e.target.value + 'px';
  });

  // アセットスケールスライダー
  document.getElementById('asset-scale').addEventListener('input', e => {
    toolManager.setAssetScale(Number(e.target.value) / 100);
    document.getElementById('asset-scale-val').textContent = e.target.value + '%';
  });

  // PNG書き出しボタン
  document.getElementById('btn-export').addEventListener('click', () => {
    const title = document.getElementById('map-title').value || 'map';
    exporter.export(
      document.getElementById('terrain-canvas'),
      document.getElementById('object-canvas'),
      title
    );
  });

  // 削除ボタン
  document.getElementById('btn-delete-obj').addEventListener('click', () => {
    if (objectRenderer.selectedId) {
      mapState.pushUndo(mapState.snapshot(terrainRenderer.ctx));
      mapState.removeObject(objectRenderer.selectedId);
      objectRenderer.selectedId = null;
      objectRenderer.markDirty();
    }
  });
}

// アセットパネルのサムネイルグリッドを更新
function renderAssetPanel(category, toolManager, assetLibrary) {
  const terrainPalette = document.getElementById('terrain-palette');
  const assetGrid = document.getElementById('asset-grid');

  if (category === 'terrain') {
    // 地形パレットを表示
    terrainPalette.style.display = 'grid';
    assetGrid.style.display = 'none';
    terrainPalette.innerHTML = '';
    TERRAIN_TYPES.forEach(t => {
      const swatch = document.createElement('div');
      swatch.className = 'terrain-swatch';
      swatch.title = `${t.name_ja} / ${t.name_en}`;
      swatch.style.background = t.color;
      swatch.addEventListener('click', () => {
        toolManager.setTerrain(t.id);
        toolManager.setTool('paint');
        document.querySelectorAll('.terrain-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
      });
      terrainPalette.appendChild(swatch);
    });
  } else {
    terrainPalette.style.display = 'none';
    assetGrid.style.display = 'grid';
    assetGrid.innerHTML = '';
    assetLibrary.getByCategory(category).forEach(def => {
      const item = document.createElement('div');
      item.className = 'asset-item';
      item.title = `${def.name_ja} / ${def.name_en}`;
      const img = assetLibrary.getImage(def.id);
      if (img) {
        const thumb = document.createElement('img');
        thumb.src = img.src;
        item.appendChild(thumb);
      }
      const label = document.createElement('span');
      label.textContent = def.name_ja;
      item.appendChild(label);
      item.addEventListener('click', () => {
        toolManager.setAsset(def.id);
        toolManager.setTool('stamp');
        document.querySelectorAll('.asset-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
      });
      assetGrid.appendChild(item);
    });
  }
}
```

---

#### 11. エントリーポイント

```javascript
// DOMContentLoaded後に実行
document.addEventListener('DOMContentLoaded', () => {
  const mapState = new MapState(1024, 768);
  const assetLibrary = new AssetLibrary();

  // ローディング表示
  showLoadingOverlay(true);
  assetLibrary.loadAll(
    (loaded, total) => updateLoadingProgress(loaded, total),
    () => {
      showLoadingOverlay(false);

      const terrainCanvas = document.getElementById('terrain-canvas');
      const objectCanvas  = document.getElementById('object-canvas');
      terrainCanvas.width  = objectCanvas.width  = mapState.width;
      terrainCanvas.height = objectCanvas.height = mapState.height;

      const terrainRenderer = new TerrainRenderer(terrainCanvas, mapState);
      const objectRenderer  = new ObjectRenderer(objectCanvas, mapState, assetLibrary);
      const toolManager     = new ToolManager();
      const inputHandler    = new InputHandler(
        objectCanvas, toolManager, terrainRenderer, objectRenderer, mapState, assetLibrary
      );
      const exporter = new Exporter();

      initUI(toolManager, mapState, terrainRenderer, objectRenderer, assetLibrary, exporter);
      renderAssetPanel('nature', toolManager, assetLibrary);  // 初期カテゴリ
      initRenderLoop(objectRenderer);
    }
  );
});
```

---

### アセット取得・配置手順（Generatorへの指示）

1. **Kenney Cartography Pack** を https://kenney.nl/assets/cartography-pack からダウンロードする
2. ZIPを展開し、個別PNGファイルを `assets/map-editor/cartography/` に配置する
3. 実際のPNGファイル名を確認し、`ASSET_DEFS`配列のsrcを実際のファイル名に合わせて更新する
4. ファイルが不足している場合（例: Cartography Packに木がない場合）は Roguelike RPG Pack（`assets/zelda-like/kenney_roguelike-rpg-pack/`）から追加で抽出する
5. game-icons.netを使用する場合はフッターに `Icons by game-icons.net (CC BY 3.0)` を記載する

---

### Generatorへの実装指示まとめ

1. `map-editor.html` をプロジェクトルート直下に作成する
2. `assets/map-editor/cartography/` ディレクトリを作成し、Kenney Cartography Pack ZIPのPNGを展開配置する
3. HTML構造は「HTMLレイアウト（骨格）」セクションの通りに実装する
4. CSSは「CSS変数定義」セクションの変数を`:root`に定義し、黒背景+シアン/パープルアクセント、Glassmorphismカード（`backdrop-filter: blur(12px); background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1)`）を使用する
5. JavaScriptは「JavaScriptモジュール詳細設計」の各クラスを順序通りに実装し、エントリーポイントで初期化する
6. 地形ペイントは `canvas.getContext('2d')` の `arc` + `fillStyle` で実装（ピクセル操作不要）
7. ズーム/パンは `canvas-wrapper` の `CSS transform` で実装し、マウス座標は `screenToCanvas()` で逆変換する
8. PNG書き出しは `OffscreenCanvas` または通常の `createElement('canvas')` で合成後 `toBlob` → `<a download>` で実行する
9. アンドゥは `terrainCanvas.getContext('2d').getImageData/putImageData` と `JSON.parse(JSON.stringify(objects))` のペアで実装する
10. アセットロード失敗時は `createFallbackImage` で代替画像を生成し、ツール操作が止まらないようにする
11. フォントは `"Aptos", "Segoe UI Variable", "Yu Gothic UI", "Hiragino Sans", sans-serif`（既存サイト準拠）
12. XSS対策: マップ名入力はHTMLに直接挿入せず、`textContent` またはダウンロードファイル名のみに使用する

---

*作成日: 2026-05-18 / Planner: hide_0001 project*
