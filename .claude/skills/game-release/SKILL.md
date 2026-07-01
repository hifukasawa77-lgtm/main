---
name: game-release
description: 完成したゲーム/ツールを公開する一連のリリース手順（オーケストレータ）。動的テスト→SEO/a11y監査→index.htmlへのカード追加→スクリーンショット→マーケ連携→デプロイ検証を順に実行する。「ゲームを公開して」「リリースして」「index に載せて」という依頼、new-game パイプラインの Evaluator 合格後に使用する。
---

# /game-release — ゲーム公開のリリースパイプライン

新しいゲーム/ツールHTMLが完成（Evaluator合格）してから公開完了までの定型手順。各ステップは既存スキル/エージェントを呼ぶ。

## 手順

### 1. 品質ゲート（必須）
```bash
bash .claude/skills/release-check/release-check.sh          # 混入・SRI・シークレット
bash .claude/skills/dynamic-test/run.sh <ゲーム.html>       # 動作検証＋スクショ取得
bash .claude/skills/seo-audit/seo-audit.sh <ゲーム.html>    # OGP（欠落ならテンプレで是正）
bash .claude/skills/a11y-audit/a11y-audit.sh <ゲーム.html>  # a11y（canvasのaria等）
```

### 2. index.html へのカード追加
ツール/ゲームセクションの既存カード（`index.html` 961行付近の `tool-card` パターン）に合わせて1枚追加する:

```html
<div class="card tool-card reveal">
  <div class="tool-icon cyan">🎮</div>  <!-- 色: cyan/blue/purple から既存の並びと重ならないもの -->
  <div class="tool-body">
    <span class="claude-badge" data-i18n="claude-badge">🤖 Claude製</span>
    <h3 data-i18n="tool-XXX-title">ゲーム名</h3>
    <p data-i18n="tool-XXX-desc">1〜2文の説明（ジャンル＋何が面白いか）。</p>
    <div class="tool-tags">
      <span class="ttag">Canvas API</span>
      <span class="ttag" data-i18n="ttag-XXX">ジャンル</span>
    </div>
    <a class="tool-link" href="ゲーム.html" data-i18n="tool-link-play">遊んでみる →</a>
  </div>
</div>
```

- `data-i18n` キーの日英辞書エントリも追加する（/i18n-check のルール参照）
- index.html の JSON-LD `ItemList`（`SoftwareApplication`）にもエントリを追加
- `sitemap.xml` に `<url>` を1件追加

### 3. コミット & デプロイ検証
```bash
bash .claude/skills/release-check/release-check.sh   # 最終確認
# コミット（日本語メッセージ可）→ push（CLAUDE.mdのGitルール準拠）
# 2〜3分待って:
bash .claude/skills/deploy-verify/deploy-verify.sh --smoke <ゲーム.html>
```

### 4. マーケ連携（任意）
- marketer エージェントへ成果物情報（ゲーム名・URL・スクショパス・ジャンル・USP候補）を渡し、X投稿（日英）等を生成
- スクショは手順1で `test-screenshots/` に生成済みのものを使う

### 5. 記録
- `obsidian-vault/02-Projects/<ゲーム名>.md` を status: released に更新（無ければ作成しMOCへリンク）
- 深澤(PM)へ公開URL付きで完了報告
