---
name: kpi-report
description: 開発パイプラインのKPI集計レポート生成（PMO支援）。git logからコミット数・変更領域、Vaultから意思決定数を期間集計してMarkdownレポートを出力する。「KPIまとめて」「進捗レポート作って」「今月の活動を集計して」という依頼、PMOの週次ステータスレポート・デイリーブリーフィング作成時に使用する。
---

# /kpi-report — パイプラインKPI集計

PMO エージェントの週次ステータスレポート・KPI管理を支援する集計スクリプト。機械集計できる指標はスクリプトが、判断を要する指標はこのSKILL.mdの記録ルールが担う。

## 使い方

```bash
bash .claude/skills/kpi-report/kpi-report.sh        # 直近7日
bash .claude/skills/kpi-report/kpi-report.sh 30     # 直近30日
```

出力（Markdown・stdout）: 期間内コミット数 / 変更ファイル数と主要領域 / ADR（意思決定）数 / Daily Note数 / 成果物（HTML）総数。終了コード: 常に0（集計であり合否ではない）。

## 手動記録が必要なKPI（機械集計できないもの）

CLAUDE.md のPMO節が定める KPI（evaluator合格率・平均修正回数・ベロシティ）のうち、合格率と修正回数はパイプライン実行時にしか分からない。以下の場所に記録する:

- **記録場所**: `obsidian-vault/01-Daily/YYYY-MM-DD.md` の「今日やったこと」に、パイプライン完了ごとに1行:
  `- [pipeline] <成果物名>: evaluator <点数>点 / 修正<N>回 / <PASS|FAIL>`
- kpi-report.sh はこの `[pipeline]` 行を期間集計して合格率・平均修正回数を算出する

## レポートの使い方
- PMO の週次レポート素材: `kpi-report.sh 7` の出力を土台に、リスク・ボトルネック（判断部分）を追記して深澤へ報告
- 月次: `kpi-report.sh 30` ＋ /monthly-close の経理結果を合わせて月次サマリーにする
