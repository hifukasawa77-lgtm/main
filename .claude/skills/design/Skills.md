# デザインスキル集

ダークサイバーパンク系ビジュアル（黒背景 + ネオンシアン / マゼンタ / パープル）の実装ガイドライン。

---

## Skill: Glassmorphismカード (Glassmorphism Cards)
- **概要**: 本プロジェクトの基本UIコンポーネント。すりガラス質感のカードを正しく実装する。
- **実装要件**:
  - 背景に `backdrop-filter: blur(12px)` を適用し、`background: rgba(255,255,255,0.05)` で薄い白みを乗せること。
  - ボーダーは `border: 1px solid rgba(0, 255, 255, 0.2)` のように低透明度のネオンカラーで囲む。
  - `box-shadow` は外側に拡散したネオングロウ（例: `0 0 20px rgba(0, 255, 255, 0.15)`）を設定すること。
  - `backdrop-filter` 非対応ブラウザのフォールバックとして `background: rgba(10,10,20,0.8)` を前に記述すること。

## Skill: ネオングロウエフェクト (Neon Glow Effect)
- **概要**: テキスト・ボーダー・アイコンにサイバーパンク的な発光感を与える。
- **カラーパレット**:
  - シアン: `#00ffff` / `rgba(0,255,255,α)`
  - マゼンタ: `#ff00ff` / `rgba(255,0,255,α)`
  - パープル: `#7f00ff` / `rgba(127,0,255,α)`
- **実装要件**:
  - テキストのグロウは `text-shadow` を多重に重ねる: `0 0 5px #00ffff, 0 0 20px #00ffff, 0 0 40px rgba(0,255,255,0.5)`。
  - ボーダーのグロウは `box-shadow` で内側と外側の両方に設定: `inset 0 0 10px rgba(0,255,255,0.1), 0 0 15px rgba(0,255,255,0.3)`。
  - Canvas での発光は `ctx.shadowColor` と `ctx.shadowBlur` を組み合わせ、同一パスを2〜3回重ね描きしてグロウを強調すること。

## Skill: アニメーションパーティクル背景 (Particle Background)
- **概要**: Canvas APIで流れるパーティクルやグリッドを背景として実装する際のパターン。
- **実装要件**:
  - パーティクルは配列で管理し、`{ x, y, vx, vy, alpha, size }` の構造体として定義すること。
  - 毎フレーム `clearRect` 前に `ctx.fillStyle = 'rgba(0,0,0,0.05)'` で半透明塗りつぶしを行い、残像トレイルを演出すること。
  - 画面端を超えたパーティクルは反対側に折り返す（ラップアラウンド）か、`alpha` をフェードアウトさせてリセットすること。
  - パーティクル数は最大200個を上限とし、それ以上は古いものを再利用するプールパターンを使うこと。

## Skill: レスポンシブレイアウト (Responsive Layout)
- **概要**: フレームワーク不使用でモバイル〜デスクトップに対応するレイアウト実装。
- **実装要件**:
  - グリッドレイアウトは `display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))` を基本とする。
  - ブレークポイントは `768px`（タブレット）と `480px`（モバイル）の2段階で十分。メディアクエリを多用しない。
  - Canvas のサイズは `canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight` でコンテナに追従させ、`ResizeObserver` で変更を検知すること。
  - モバイルでのタッチ操作は `touchstart` / `touchmove` / `touchend` を `mousedown` / `mousemove` / `mouseup` と並列で登録すること。
