# legal/corpus — 法令コーパス（取得物・手で直さない）

出典: デジタル庁 e-Gov 法令API Version 2（https://laws.e-gov.go.jp/api/2・キー不要・無料）。法令の条文は著作権の対象外（著作権法13条）。
**Read しない**（4MB超。`.claudeignore` 対象）。条文は `node scripts/legal-lookup.mjs <法令名> <条>` で引く。

| ファイル | 内容 |
|---|---|
| `<slug>.json` | 1法令の全条（見出し・章節・項）。`scripts/legal-lib.mjs` の LAWS が登録簿 |
| `MANIFEST.json` | 取得日・版（施行日）・条数・sha256・施行予定の改正 |
| `AMENDMENTS.md` / `.json` | 直近の改正と施行予定の改正で変わる条（自動生成） |

更新: `node scripts/legal-corpus.mjs --check-online`（古ければ△。**確認できなかった法令があれば非0**）→ `--fetch` → `--amendments` → `node scripts/verify-legal-knowledge.mjs`。
法令を足す: `scripts/legal-lib.mjs` の LAWS に追記して `--fetch --only <slug>`。
