# GameKit — Claude Code ゲーム制作フレームワーク

hide_0001 ポートフォリオの Canvas ゲームを量産するための共通基盤。
**フレームワーク不使用・ビルド不要** の方針のまま、毎回ゼロから書いていた定型コード（ループ・入力・衝突・SFX・UI）を1ファイルに集約したマイクロエンジンです。

A micro-engine + agent workflow for producing Canvas games inside Claude Code. No build tools, no external libraries.

## 構成 / Contents

| ファイル | 役割 |
|---|---|
| `gamekit.js` | エンジン本体（`window.GameKit` を公開） |
| `template.html` | そのまま動くスターター（タイトル→プレイの2シーン構成） |
| `.claude/skills/new-game/SKILL.md` | `/new-game` — エージェントパイプラインでゲームを1本作るスキル |

## クイックスタート / Quick Start

```html
<script src="gamekit/gamekit.js"></script>
<script>
  const game = new GameKit.Engine(document.getElementById('game'), { width: 960, height: 540 });

  class MyScene extends GameKit.Scene {
    update(dt, game) {
      const ax = game.input.axis();          // 矢印/WASD → {x, y}
      if (game.input.justPressed('Space')) game.audio.beep(880);
    }
    draw(ctx, game) { /* Canvas API で描画 */ }
  }

  game.changeScene(new MyScene());
  game.start();
</script>
```

新しいゲームは `template.html` をリポジトリ直下にコピーして改名し、`<script src="gamekit/gamekit.js">` のパスを保ったまま中身を差し替えるのが最短ルート。

## モジュール一覧 / Modules

- `GameKit.Engine` — deltaTime ベースのゲームループ（0.1sキャップ）、`isPaused` フラグ、シーン遷移 `changeScene()`
- `GameKit.Scene` — `enter / exit / update(dt, game) / draw(ctx, game)` を上書きする基底クラス
- `GameKit.Input` — キーボード（`isDown` / `justPressed` / `axis()`）+ マウス・タッチ統合ポインタ
- `GameKit.Assets` — 画像・JSONのプリロード。404は例外になるので Dynamic-Tester で検知可能
- `GameKit.Sprite` — スプライトシートのフレームアニメーション
- `GameKit.Collision` — AABB / 円 / 矩形×円（`.claude/skills/game-dev` のガイドライン準拠）
- `GameKit.Sfx` — Web Audio プロシージャルSE（`beep` / `noise` / `jingle`）。音声ファイル不要
- `GameKit.Particles` — ポートフォリオ共通のアンビエントパーティクル背景
- `GameKit.Gen` — プロシージャル画像生成（シード付き乱数・ノイズ・パレット・ネビュラ背景・スターフィールド・タイルパターン・オーブ/バッジアイコン + PNG書き出し）。`generator.html` で動作確認・アセット書き出し可能
- `GameKit.UI` — Glassmorphism パネル + テキスト描画
- `GameKit.Save` — localStorage ラッパー（ゲームごとに名前空間分離）
- `GameKit.MathX` — `clamp` / `lerp` / `rand`

## デザイン規約 / Design Rules

CLAUDE.md のルールに従う:

- 黒背景 (`#05070d`) + シアン (`#22d3ee`) / パープル (`#a78bfa`) のアクセント
- Glassmorphism カード、パーティクル背景
- UIは日英バイリンガル表記
- **サイバーパンク演出は禁止**（ネオングロウ過多・SF都市風は不可）

## 画像アセットについて / Graphics (APIキー不要)

画像生成・取得は Graphic-Designer エージェントが担当。優先順位:

1. **MCPコネクタ**（OAuth認証・APIキー不要）: Adobe（Stock無料素材検索 / 背景削除 / 生成拡張 / ベクター化）、Canva（AIデザイン生成）、Figma
2. **プロシージャル生成**: Canvas / SVG をコードで描く（このリポジトリの主流）。`gamekit/generator.html` を開くと `GameKit.Gen` の各関数（ネビュラ背景・スターフィールド・タイルパターン・オーブ/バッジアイコン）をシード/パレット/サイズ指定でプレビューしPNG書き出しできる。text-to-image系MCP（GPT-Image相当）が使えない場合の主要な代替手段
3. **フリー素材**: Kenney / OpenGameArt / itch.io（要ライセンス確認）
4. **ローカル生成**: 自分のPCの Stable Diffusion（ComfyUI 等）を MCP サーバー経由で接続

詳細は `.claude/agents/graphic-designer.md` を参照。
