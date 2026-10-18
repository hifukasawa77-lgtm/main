# legal/knowledge — リーガルチェッカーの知識ベース（入口）

**読む順**: ①このINDEX ②`00-method.md` ③案件の領域のプレイブック ④`08-this-repo-ledger.md`（既知の論点台帳）。
**条文は引いてから書く**: `node scripts/legal-lookup.mjs <法令名> <条>`。引用は `【法令名 条｜キーワード】` で書き、`node scripts/verify-legal-knowledge.mjs` が実条文と照合する。
**施行予定の改正**: `legal/corpus/AMENDMENTS.md`。**取得物の状態**: `node scripts/legal-corpus.mjs --status`。

## プレイブック（論点別）
| ファイル | 領域 | こういうときに読む |
|---|---|---|
| [00-method.md](00-method.md) | 顧問弁護士の方法論 | **毎回**。受任整理・IRAC・リスク見積り・エスカレーション・報告書の型 |
| [01-copyright.md](01-copyright.md) | 著作権法 | 素材・生成AI・フォント・OSS・エミュレータ・ゲームの「似せ方」・歴史題材 |
| [02-trademark-unfair-competition.md](02-trademark-unfair-competition.md) | 商標法・不競法 | 名称・ロゴ・ファイル名/URL・「◯◯風」・ドメイン |
| [03-privacy-data.md](03-privacy-data.md) | 個人情報・通信の秘密・外部送信 | フォーム・カメラ・位置・ログ・外部API・Cookie・AI・未成年 |
| [04-consumer-commerce.md](04-consumer-commerce.md) | 景表法・特商法・消契法・資金決済法 | 広告文・有料記事・課金・ガチャ・規約・ポイント |
| [05-cyber-content.md](05-cyber-content.md) | サイバー・コンテンツ（刑事を含む） | スクリプト・ツール・UGC・誹謗中傷・性的/暴力表現・賭博類似 |
| [06-contracts-platforms-oss-ai.md](06-contracts-platforms-oss-ai.md) | 契約・規約・OSS・AIモデル・プラットフォーム | 外注・CDN・モデルのライセンス・ToS・準拠法 |
| [07-dispute-response.md](07-dispute-response.md) | 紛争対応・手続 | 警告書・削除請求・発信者情報開示・告訴・時効・証拠保全 |
| [08-this-repo-ledger.md](08-this-repo-ledger.md) | **このリポジトリの論点台帳** | 監査の出発点。前回の評価・未対応の把握 |

## 六法の条文地図（第二の脳・Claude Code の常時想起と共用）
`obsidian-vault/04-Knowledge/` に置く（**重複させない**）:
[rokuho-overview.md](../../obsidian-vault/04-Knowledge/rokuho-overview.md)（ハブ）・
[rokuho-kenpo.md](../../obsidian-vault/04-Knowledge/rokuho-kenpo.md)・[rokuho-minpo.md](../../obsidian-vault/04-Knowledge/rokuho-minpo.md)・
[rokuho-keiho.md](../../obsidian-vault/04-Knowledge/rokuho-keiho.md)・[rokuho-shoho.md](../../obsidian-vault/04-Knowledge/rokuho-shoho.md)・
[rokuho-minso.md](../../obsidian-vault/04-Knowledge/rokuho-minso.md)・[rokuho-keiso.md](../../obsidian-vault/04-Knowledge/rokuho-keiso.md)

## データ台帳（`data/`・スキャナが突合する）
| ファイル | 内容 | 更新のタイミング |
|---|---|---|
| `data/third-party-marks.json` | 他社標章（高=著名／verify=要J-PlatPat）・ファイル名トークン | 新作の名称決定時・指摘を受けたとき |
| `data/external-hosts.json` | 外部ホストの分類（事業者・種別・送られる情報・privacy照合語） | 未分類ホストが出たとき |
| `data/oss-licenses.json` | OSS/CDNライブラリのライセンス | 新しいライブラリを入れたとき |
| `data/ai-model-licenses.json` | AIモデルのライセンス（confirmed＝一次情報で確認済） | モデルを一覧に足す前 |

## 道具（`scripts/`）
| コマンド | 用途 |
|---|---|
| `node scripts/legal-lookup.mjs 著作権法 32` | 条文を引く（`--search 語`・`--toc`・`--list`・範囲 `709..711`） |
| `node scripts/legal-scan.mjs [--only 規則] [--changed]` | リポジトリを法務の目で走査（候補の列挙） |
| `node scripts/legal-corpus.mjs --status／--check-online／--fetch／--amendments／--diff <slug>` | コーパスの状態・取得・改正の中身 |
| `node scripts/verify-legal-knowledge.mjs [--inject]` | 知識ベースの引用を実条文へ照合（必須検査） |

## 運用メモ
- 判例は**記憶ベース**。報告に使う前に**裁判所HP等で原典確認**（未確認は「要原典確認」を付す）。
- ToS・ガイドライン・告示は**検査時点の原文を WebFetch**で確認し、**URLと取得日**を残す。
- コーパス未取込: 省令・告示・ガイドライン（個人情報保護委員会・消費者庁・総務省）・判例・会社法。**必要になったら LAWS（`scripts/legal-lib.mjs`）へ追加して `--fetch`**。
