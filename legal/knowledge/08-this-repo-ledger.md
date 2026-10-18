# 08 このリポジトリの論点台帳 — 既知の論点・評価・対処の履歴（監査のたびに更新する）

**位置づけ**: legal-checker が案件ごとに**最初に読む**台帳。同じ論点を何度も洗い直さず、「前回どう評価したか・何が未対応か」から始める。
**更新ルール**: 監査したら下の表に**日付つきで追記**する（上書きしない）。解消したら状態を「解消（日付・根拠コミット）」へ。
スキャナの再実行: `node scripts/legal-scan.mjs`（全件）／`--only mark,external-send` など。**候補の列挙であって判定ではない**。

## ベースライン（2026-10-13・scripts/legal-scan.mjs ＋ 条文確認）
スキャン範囲: 176ファイル（HTML 約110・JS/CSS・マーケ/ノート文書）。候補は規則調整後に再計測（RED候補3・YELLOW候補約50・要確認・情報）。**下記は暫定評価で、深澤の確認前**。

### A. 他社標章（`legal/knowledge/02-trademark-unfair-competition.md`）
| # | 対象 | 事実（ファイル:行） | 暫定評価 | 対処案 | 状態 |
|---|---|---|---|---|---|
| A1 | `zelda_like.html` のURL/ファイル名 | title・og は「ファーレンクエスト」へ改称済み。**ファイル名に `zelda`**。参照: `index.html`・`burst_brawlers.html`・`kage_shura_den.html`・`assets/js/agent-data.js` ほか | **RED候補（URL）**。タイトル改称（2026-06 の指摘）の取りこぼし。URLは検索・SNSプレビューに出る（【不正競争防止法2条｜他人の著名な商品等表示】＝著名表示冒用の論点） | A: 新URLへ移行＋旧URLは短い転送ページ（noindex）／B: 旧URLを廃止（外部リンク切れを許容）。**深澤判断**（SEO・既存リンク） | 未対応 |
| A2 | `gradius-1.html` のURL | title・og は「VECTOR VANGUARD」へ改称済み。**ファイル名に `gradius`**。参照: `sitemap.xml`・`dark_fantasy_rpg.html`・`galactic-assault.html`・`hyakki.html` | **RED候補（URL）**。A1と同型 | A1と同じ | 未対応 |
| A3 | `nes-emulator.html` の名称 | title「**FAMICOM ROOM**」／`index.html:1693`「Famicom Emulator Lab」／本文に「ファミコン」。ROM・BIOSの同梱有無は別途確認（スキャン: `rom-emulator`） | **RED候補**（「ファミコン／FAMICOM」は任天堂の標章。出所表示的な使用） | A: 「8bitエミュレータ」等の説明的名称へ／ROM・BIOS不同梱の確認と明記 | 未対応 |
| A4 | `blokus.html`・`blokus_trigon.html` | ファイル名 `blokus` | YELLOW候補（要J-PlatPat） | 独自名称（例: 『陣取りブロック』）＋URL変更 | 未確認 |
| A5 | `catan.html` | ファイル名 `catan`（assets/catan に生成AI画像5点・出自記録なし） | YELLOW候補 | 同上 | 未確認 |
| A6 | `conhex.html`・`indigo.html` | title・og・h1・説明文にゲーム名。`indigo.html` は説明に「ラインナー・クニツィア」とあり出所が明示されている | YELLOW候補（既存ボードゲームの名称・意匠の利用） | 名称の独自化 or 権利者の二次創作ガイドライン確認 | 未確認 |
| A7 | `othello.html` | title・og は「Reversi AI」へ改称済み。**ファイル名・description に「オセロ」** | YELLOW候補 | descriptionの「オセロ」→「リバーシ」、URL変更 | 一部対応済み（title） |
| A8 | `sanguo.html`「三国志・天下三分」 | title・og・h1・description・`index.html:983` | YELLOW候補（歴史呼称か出所表示かの線引き。**歴史の題材の説明であれば自由**（【商標法26条｜普通に用いられる方法で表示する商標】）、作品名として他社と混同されうる名称ならリスク） | 「天下三分」を主名称にする／英語名を前面に | 未確認 |
| A9 | 「Claude」の使用 | `index.html:892・893・1643・1967`（「Claude Code」等の**説明的言及**）。プロジェクト名 `Claudechord`（語幹に Claude） | 要確認（説明的言及は自由。**製品名・サービス名に含める点**は Anthropic のブランド利用ガイドラインを原文で確認） | ガイドライン原文確認（WebFetch）→ 必要なら名称の独自化 | 未確認 |

### B. 外部送信・プライバシー（`03-privacy-data.md`）
| # | 事実 | 暫定評価 | 対処案 | 状態 |
|---|---|---|---|---|
| B1 | `privacy.html` は**外部アセットを一般論で記述**（「フォントやCDN…これらの読み込みに個人情報は含まれない」）。実際は Google Fonts（14ファイル）・jsDelivr・unpkg・cdnjs 等から読込（利用者のIP等が相手へ渡る） | YELLOW候補（【電気通信事業法27条の12｜情報送信指令通信】の通知・公表は**送信先・情報・目的の列挙**が実務。対象サービスかは総務省令・ガイドラインで判断） | privacy.html に**送信先一覧**（事業者名・目的・情報）を追加。フォントの自前ホスティングで送信先自体を減らす | 未対応 |
| B2 | `assets/js/app.js:425` が **api.countapi.xyz**（訪問者カウンタ）を呼ぶ。privacy.html は「**アクセス解析なし**」と記載 | YELLOW候補（**実質アクセス計測と記載の不一致**の可能性。サービス継続性の問題もある） | 記載の修正 or カウンタ廃止 | 未対応 |
| B3 | `assets/js/app.js` が **第三者CORSプロキシ**（corsproxy.io・api.allorigins.win・api.codetabs.com・thingproxy.freeboard.io）経由で外部ページを取得 | YELLOW候補（利用者の操作内容・取得URLが第三者へ渡る／取得内容の改ざん・可用性リスク） | 自前 Cloudflare Worker のプロキシへ置換（取得先を許可リスト化）。当面は privacy.html に記載 | 未対応 |
| B4 | 非公式API: Yahoo Finance（`query1.finance.yahoo.com`・`autoc.finance.yahoo.co.jp`）、`stooq.com`、`open.er-api.com`、`api.frankfurter.app` | YELLOW候補（利用規約・再配布条件・帰属表示の確認） | 各規約を原文確認し台帳（external-hosts.json）の note を更新 | 未確認 |
| B5 | AI中継 Worker は **Cloudflare Workers AI**（`cloudflare-worker/gemini-proxy.js` ほか）。privacy.html の記載と**一致**（scan: privacy-consistency） | GREEN（記載と実装が一致。2026-10-13時点） | 実装を変えたら再確認 | 確認済 |
| B6 | 位置情報（`dashboard.html:777`・`assets/js/app.js:804`）→ 国土地理院・Open-Meteo・Windy（外国事業者への提供は【個人情報保護法28条｜外国にある第三者】の確認対象） | GREEN候補（privacy.html に**許可時のみ送信**と明記あり。同意UIの実機確認は別途） | — | 概ね良好 |
| B7 | カメラ利用ページ（heart-rate・health・thermography・photo-booth・color-scanner・qr-scanner・receipt-ocr）の HTML に `fetch`/`XMLHttpRequest`/`sendBeacon`/`WebSocket` **の呼び出しが無い**（静的確認） | GREEN候補（端末内完結。**外部JS側の通信は未確認**） | ネットワーク要求の実測（Playwright）で「映像が出ない」を裏付け、画面に明記 | 実測未実施 |
| B8 | `oshikatsu.html` に **AdSense の雛形**（コメント・CSP許可）。現状は無効 | 情報（**有効化する時点**で privacy.html の「広告なし」記載・外部送信規律・広告表示の要件が変わる） | 有効化前に再監査（本台帳へ追記） | 将来対応 |

### C. AIモデル・ライセンス（`06-contracts-platforms-oss-ai.md`）
| # | 事実 | 暫定評価 | 対処案 | 状態 |
|---|---|---|---|---|
| C1 | `zero-1-mobile.html` が **Qwen2.5-3B-Instruct** を選択肢に載せる。HFのメタデータは **qwen-research**（**非商用目的のみ**・商用は許諾申請。2026-10-13 に原文確認）。mlc-ai の `-MLC` リポジトリはライセンス欄が空 | YELLOW（**現在は非営利なので許容範囲**。収益化する/広告を入れるなら**一覧から外す**か許諾を得る。再配布時は Notice・ライセンス写し） | 画面に「研究用ライセンス（非商用）」の注記。**収益化前チェックリストに登録** | 要判断 |
| C2 | `gemma-2-2b-jpn-it`: **Gemma Terms of Use＋禁止用途ポリシー**（HFでゲート付き） | 要確認（禁止用途の表示・利用条件へのリンク） | 画面にリンクと禁止用途の注記 | 未対応 |
| C3 | Qwen2.5-0.5B/1.5B: Apache-2.0（1.5Bを確認） | GREEN（帰属表示は望ましい） | モデルカードへのリンク | — |

### D. 素材の出自記録（`01-copyright.md`）
- `assets/` 直下106ディレクトリのうち**36ディレクトリに出自文書**（README・PROVENANCE・LICENSE・CREDITS・`.md` 等）**が見当たらない**（2026-10-13・スキャナの判定は「文書ファイルの有無」のみで、**中身が出自を説明しているかは未評価**。文書がある22ディレクトリにも生成AI名ファイルあり: sengoku・black-fang・zelda-like・sanguo ほか）。**生成AI名（gpt-image）のファイルがあるのに文書が無い**: `assets/catan`・`assets/conhex`・`assets/corridor`・`assets/hex`・`assets/othello`・`assets/pinball`。
- 評価: YELLOW（出自の追跡可能性）。**是正は削除でなく記録の追加**。`assets/<dir>/PROVENANCE.md`（生成元・日付・ツール・規約URL・商用可否・プロンプトの要旨）。
- 既存の記録の良い例: `assets/zelda-like/README.md`・`assets/oshikatsu/README.md`。

### E. 取引・表示（`04-consumer-commerce.md`）
- 収益化の信号: **note有料記事**（`note/articles/2026-09-03-ai-agent-pipeline-22.md`: `kind: paid`・`price: 500`）。サイト内に決済SDKは無い。
  → **特商法表示**（【特定商取引に関する法律11条｜通信販売についての広告】）・**返品方針**は note の販売者表示で満たせるかを**公開前に確認**（note側の表示項目を原文確認）。サイト内に利用規約・特商法ページは**無い**（現時点で必須かは収益化の形による）。
- 賭博類似: `poker.html`・`blackjack.html`・`no-luck-poker.html`・`loto6.html`・`mahjong.html` ほか。**「現実の金銭・景品と交換できない」旨の記載が検索した限り見当たらない**。YELLOW（記載の追加。賭博の線引きは【刑法185条｜賭博をした者】）。
- マーケ文面: `marketing/` の断定表現（「100%」等）は事実の範囲の記述が中心（要確認 26件は大半が内部文書・一般語）。公開文面は `/marketer-evolve` の検査で都度確認。

### F. セキュリティ系ページ（`05-cyber-content.md`）
- `security-toolkit.html`: **ローカルのマルウェア兆候検出ツール**（`SetWindowsHookEx` 等の**検知ルール**として「キーロガー」等の語が出るだけ。攻撃機能ではない）。GREEN候補。**ファイルは送信しない旨**の明記があるかを確認。
- `packet-visibility.html`: 通信の可視化（教育）。自己環境限定の旨の明記を確認。

## 追記ログ（新しい順）
| 日付 | 監査 | 要点 | 次の一手 |
|---|---|---|---|
| 2026-10-13 | ベースライン（scan＋条文確認） | 上表。RED候補3（A1〜A3）・privacy 整合（B1・B2）・Qwen3B非商用（C1） | 深澤の方針決定（URL移行・名称）→ 各担当へ |
