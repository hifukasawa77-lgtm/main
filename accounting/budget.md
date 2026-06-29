# 予算設定（Budget）

経理エージェント（`.claude/agents/accounting-agent.md`）が参照する予算定義。
**この値は機械可読**。`KEY: VALUE` 形式を崩さないこと（hookがパースする）。

```
CURRENCY: JPY
MONTHLY_LIMIT: 5000
ALERT_THRESHOLD_NOTICE: 70
ALERT_THRESHOLD_WARN: 90
ALERT_THRESHOLD_STOP: 100
RESET_DAY: 1
```

## 説明
| 項目 | 値 | 意味 |
|---|---|---|
| `CURRENCY` | JPY | 通貨（日本円） |
| `MONTHLY_LIMIT` | 5000 | 月次の課金累計上限（¥5,000） |
| `ALERT_THRESHOLD_NOTICE` | 70% | 🟡 注意通知の閾値（¥3,500） |
| `ALERT_THRESHOLD_WARN` | 90% | 🟠 警告通知の閾値（¥4,500） |
| `ALERT_THRESHOLD_STOP` | 100% | 🔴 停止＆要承認の閾値（¥5,000超） |
| `RESET_DAY` | 1 | 毎月この日に累計をリセット（月初） |

## 大前提
- プロジェクト方針は **課金ゼロの維持**（CLAUDE.md L159-164 / music-generator.md L28-35）。
- 上限¥5,000は「**万一の例外的課金に対する安全装置**」であり、通常運用での消費を想定したものではない。
- 上限の変更は深澤（PM）の明示的な指示があった場合のみ行う。
