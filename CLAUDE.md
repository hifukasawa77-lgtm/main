# CLAUDE.md — hide_0001 Portfolio

## プロジェクト概要
hideの個人ポートフォリオサイト。GitHub Pages でホスティング。モダン・ダーク系のビジュアルデザイン。

## ファイル構成
- `index.html` — メインポートフォリオページ（シングルページ）
- `game.html` — ZELDA QUEST（Canvas APIのみで作ったトップビューRPG）
- `shogi.html` — 将棋パズル
- `shogi_rpg.html` / `shogi_rpg_enhanced.jsx` — 将棋RPG
- `claudechord-vault/` — Obsidian メモリ層（全成果物・KPI・テンプレートの正本。詳細: `claudechord-vault/README.md`）

## デザイン・スタイルのルール
- カラースキーム: 黒背景 + アクセントカラー（シアン / パープル系）※サイバーパンク的演出は使用禁止
- スタイル: Glassmorphism カード、アニメーションパーティクル背景（Canvas API）
- UIは日英バイリンガル表記
- 既存のビジュアルスタイルを壊さないこと
- **禁止**: サイバーパンクテーマ（ネオングロウ過多、SF都市風演出など）

## コーディング方針
- フレームワーク不使用。素のHTML / CSS / JavaScript（Canvas API）を優先
- ライブラリを追加する場合はCDN経由、ビルドツール不使用
- ゲーム系はCanvas APIのみで完結させる方針

## 戦国風雲記の攻城ヘックス（侵入可否）

攻城戦のヘックスは「侵入出来る／破壊すれば侵入出来る／侵入出来ない」の3分類で、
定義は `sengoku.html` の `CASTLE_PASSABILITY` に一本化してある（進入判定・枠の描き分け・凡例が共有）。

- 城郭レイアウトの優先順: ①`CASTLE_TRACED_LAYOUTS`（絵をトレース済み）→ ②特別城は天守中心の生成リング → ③`CASTLE_HEX_LAYOUTS`（城タイプ別）
- 天守の位置は `SPECIAL_CASTLE_KEEP_HEX`（特別城35城分、専用画像からトレース済み）
- **自動画像分類は使わない**。手トレース済み4城を正解として実測した結果、しきい値方式で水堀の適合率46%/再現率48%（全マスopenと答える基準値と同等以下）、領域成長法でF1 0.22。写実CGのため水堀・石垣・曲輪・遠景の水田の色差が数階調しかない

### トレース手順
編集ページはリポジトリにコミットしてあり、GitHub Pages から直接開ける（Node不要）:
<https://hifukasawa77-lgtm.github.io/main/castle-layout-trace.html>
**`sengoku.html` のレイアウトを更新したら、必ず再生成してコミットし直すこと**（初期値が古いままになる）。

```bash
node scripts/trace-castle-layout.mjs          # 編集ページを再生成（39城・現在の状態を初期値に）
node scripts/trace-castle-layout.mjs --serve  # 生成してローカルURLで開く（手元で作業する場合）
# 絵を見てヘックスを塗る（編集はブラウザに自動保存）
#   ドラッグでなぞって連続塗り／数字キー1〜0で種別切替／右ドラッグで消去／Ctrl+Zで取り消し
#   上部の索引から城へジャンプ。丸印が進捗（緑=OK 黄=注意 赤=要修正 白抜き=未トレース）
#   城ごとに「閉じている・落城可能」を即時判定。要修正（赤）が出たら直す
node scripts/apply-castle-layouts.mjs castle-layouts.json   # sengoku.html へ反映
node scripts/verify-castle-layouts.mjs                      # 全39城を機械検査（必須）
```
検査内容: 天守が盤内で1マス／無傷なら天守へ到達不能／破壊可能な塁を全部破れば到達可能／城内に空きマスが十分。
トレースが天守を囲みきれない場合は `ensureKeepSealed()` が本丸石垣＋虎口を自動で足す（素通り落城の防止）。

## 戦国風雲記の必須チェック（sengoku.html を触ったら必ず実行）

```bash
node scripts/verify-sengoku-boot.mjs   # 起動して遊べるか（タイトル→マップ→街道編集→ターン終了で例外0件）
node scripts/verify-castle-csv.mjs     # siro_ichi.csv の全行がゲーム内データと一致するか
node scripts/verify-castle-layouts.mjs # 攻城レイアウト39城
node scripts/verify-map-assets.mjs     # マップアイコンが実際に絵として描かれるか（アセットを差し替えたら必須）
```

- **タイトル画面が出た＝起動成功ではない**。描画ループの例外は「背景画像だけ残してUIが出ない」形で現れ、タイトルは無事に出る。必ず `verify-sengoku-boot.mjs` でマップ画面まで入って確かめること（2026-08-02: `_drawRoads` の `preview is not defined` を「アセット読込が重い」「roundRect非対応」と誤診して3コミット費やした）
- GameKit のループは update/draw の例外を捕捉して継続し `engine.errors` に積む。**そのため `pageerror` だけ見る検査は素通りする**。描画系の検査を書くときは必ず `engine.errors` も合算する
- 城データの正本は `siro_ichi.csv`。取り込みは追加・更新のみで**削除はしない**ため、行を消しても城はゲーム内に残り座標だけ内蔵値へ戻る。差し替え時は `verify-castle-csv.mjs` の「CSV外の城が残存」警告を必ず確認する
- 地図画像は絵地図で `geoToScreen` の緯度経度換算と一致しない（九州はx方向に約380pxずれる）。**新しい城の座標は近傍城のCSV値から局所アフィン内挿で起こす**。城どうしの最短間隔は11px程度が下限
- **アセットを縮小・再エンコードするときは、そのアセットを切り出して使っている箇所を必ず洗う**。`drawImage` の source-rect を画素値で直書きしていると、縮小した瞬間に矩形が画像外へ出て絵が消える。読み込みは成功するので404もエラーも出ず、無言で絵だけが消える（2026-08-02: 1254px→256px でマーカー4種が塗り面積0〜3.5%に）。矩形は「測った原寸サイズ」と対で持ち、描画時に実解像度へスケールする（`scaleSrcRect`）
- **アセットは300枚超・計638MBある。全部を一度に要求しない**。後読みは同時4枚まで＋1枚60秒上限（`DEFERRED_LOAD_CONCURRENCY` / `DEFERRED_LOAD_TIMEOUT_MS`）。無制限に並列要求すると帯域を食い合い、そのとき前面で必要な画像が「読み込み中…」のまま何分も待たされる
- **施設・城グラフィックには未ロード時のフォールバック描画がある**（仮のベクター図形＝白い箱）。読み込みが遅いとこれが長時間表示され「画像が壊れている」ように見える。アイコンの不具合を調べるときは、primary が生きていると再現しないので `ASSETS.img` から該当キーを消してフォールバック経路を直接確かめること

## 戦国風雲記の武装勢力と棟梁

武装勢力（`NAVAL_FORCES` / `NINJA_GROUPS` / `KOKUJIN_FORCES` / `RELIGIOUS_FORCES`、計64）は
全勢力が `leader`（武将ID）を持ち、施設パネル右下に棟梁のグラフィックを表示する。
割り当ての正本は `applyArmedForceLeaders()`（追加勢力が出揃った後に実行すること）。

- **人物の選定方針**: 年代込みで実在を確認できた人物のみ実名登録。確認できない勢力は役職名のみの頭領とする
  （例: 戸隠衆頭領・塩飽衆年寄・彌彦神社大宮司）。既に大名当主になっている武将を頭領に充てないこと
- **肖像**: `buildPortraitSlots()` は `DATA.generals` 全員に連番でアトラス枠を配るため、実画像の無い武将は
  `noAtlas:true` を付けて対象外にする（付け忘れると無関係な顔・空セルが写る）。
  代わりに `portraitKind`（`ninja`/`monk`/`shinto`/`naval`/`kokujin`）で `drawProceduralPortrait()` の手描き風肖像に落ちる
- **マーカーと勢力の対応はID照合**。マーカーIDは `<勢力ID>_marker` / `_pirates` / `_ninja_marker` の規約。
  名前一致に頼ると勢力名の改称で対応が無言で切れる（軒猿→軒猿衆の改称で実際に切れていた）

## GameKit（ゲーム制作フレームワーク）
- 新規ゲームは `gamekit/gamekit.js`（自作マイクロエンジン）を土台にする。ループ・入力・衝突・SFX・パーティクル・Glassmorphism UI・セーブを提供（詳細: `gamekit/README.md`）
- スターター: `gamekit/template.html` をリポジトリ直下にコピーして開始する
- `/new-game` スキルでエージェントパイプライン一式（仕様→アセット→実装→テスト→採点）を起動できる
- 画像生成はAPIキー不要のMCPコネクタ（Adobe / Canva / Figma）またはプロシージャル生成を使う（`.claude/agents/graphic-designer.md` 参照）

## hideの案内エージェント（サイト内チャットウィジェット）
- 実装3点セット: データ=`assets/js/agent-data.js`（GAMES/intent辞書/KB）・ロジック=`assets/js/agent.js`・AI=`cloudflare-worker/gemini-proxy.js`（SYSTEM_PROMPTは `site-knowledge.js` を `scripts/gen-agent-knowledge.mjs` で自動生成）
- 検証: `node scripts/agent-evolve-check.mjs`（データ整合）＋ `node scripts/agent-dynamic-test.cjs`（Playwright 6シナリオ）
- **週次自己進化**: Claude Code Remote の Routine（毎週木曜 05:00 JST）が `/agent-evolve` を実行 → worker `/stats` で弱点発見 → `agent-data.js`/`data/agent-news.json` を小改善 → ローリングPR `claude/agent-evolve` に積み深澤が承認（mainへ直接pushしない）
- **週次ブラッシュアップ提案**: Routine（毎週月曜 07:00 JST）が `/site-proposal` を実行 → 監査＋/stats＋トレンドからトップ3提案 → GitHub Issue（ラベル `proposal`）起票のみ。実装は深澤承認後に planner から

## 定期実行（Routine）一覧 ※スケジュールの正はここ
Claude Code Remote の Routine で自動起動されるスキル。**Routineを新設・変更・停止したら、この表と該当スキルの記載を必ず同時に更新する**（実態だけ変えて文書が残ると、次のセッションが誤った前提で動く。harness-lint 検査#11 が表とスキル記載の一致を機械検査する）。

| スキル | スケジュール（JST） | 成果物 | mainへの直接push |
|---|---|---|---|
| `/agent-evolve` | 毎週木曜 05:00 | ローリングPR `claude/agent-evolve` | 禁止（深澤承認制） |
| `/site-proposal` | 毎週月曜 07:00 | GitHub Issue（ラベル `proposal`）※提案のみ | 禁止（コード変更なし） |
| `/self-improve` | 毎週日曜 21:00 | ローリングPR `claude/self-improve` | 禁止（深澤承認制） |

## Obsidian 第二の脳（セカンドブレイン）
- `obsidian-vault/` をClaude Codeの永続メモリとして運用する（Obsidian互換のMarkdown Vault）
- セッション開始時に `.claude/hooks/second-brain-recall.sh`（SessionStart hook）が `MOC.md`・知見クイックインデックス（`04-Knowledge/`）・直近のDaily Noteを自動でコンテキストに読み込む
- 重要な意思決定・学び・「メモして」等の指示があった場合は `obsidian-vault/` へ追記する。書き込みルールの詳細は `.claude/skills/second-brain/SKILL.md` を参照
- **再帰的自己改善ループ**: 蓄積（`/second-brain`）→ 想起（recall hook）→ 反映（`/self-improve`）の閉ループで運用する。セッションの区切りや同種のミス再発時は `/self-improve` で、Vaultの学びを最も狭く効く宛先（該当エージェント定義 / CLAUDE.md / スキル / フック）へ昇格させる。詳細は `.claude/skills/self-improve/SKILL.md`
- PMOの `pmo/`（Google Drive、ステークホルダー向け進捗管理）とは役割が異なる。本Vaultは個人の知的資産（意思決定の理由・学び）を蓄積する

## Git
- メインブランチ: `main`
- 作業ブランチ: `kai_001`
- コミット前に `.edge-test-profile/` が含まれていないか確認すること（.gitignore 推奨）
- コミットメッセージは日本語でもOK

## Obsidian メモリ層（Claudechord Vault）

`claudechord-vault/` を Claudechord（本エージェントハーネス）の**単一ナレッジ／メモリ層**とする。
要件定義・設計・評価・リスク・マーケ等の成果物をここに集約し、エージェントは `[[ウィキリンク]]` で相互参照する。

- **正本**: `claudechord-vault/`（git 管理）。Google Drive `pmo/` は配布用ミラー
- **frontmatter 規約必須**: `type / project / status / agent` ＋（評価）`eval_score / spec_score / revision_count / verdict`、（法務）`risk_level`。語彙は規約から外さない（Dataview 集計が壊れる）
- **保存先**: 成果物→`deliverables/`、プロジェクトハブ→`projects/`、ダッシュボード→`dashboards/`、雛形→`_templates/`、日次→`daily/`
- **テンプレート**: 新規成果物は `_templates/`（Templater）から起こす
- **KPI**: PMO は `dashboards/KPI_品質メトリクス.md`（Dataview）で合格率・平均修正回数・ベロシティを参照
- **連携**: Local REST API プラグイン or git 経由でClaude Codeが読み書き（詳細: `claudechord-vault/README.md`）
- **APIキー禁止規約**: Local REST API のキーは `.gitignore` 管理。コミット禁止

## エージェントハーネス設計

成果物作成は以下のエージェントパイプラインで行う（`.claude/agents/` に定義）。
PM（プロジェクトマネージャー）は深澤。PMOエージェントがプロジェクト全体を横断管理する。

### PMOエージェント (`pmo`)
- PM・深澤を支援するプロジェクトマネジメントオフィス特化型エージェント
- 開発パイプライン全体の進捗・リスク・課題・品質・ドキュメントを一元管理する
- ドキュメントの正本は Obsidian メモリ層（`claudechord-vault/`）。Google Drive（pmo/）は配布用ミラーとして扱う
- KPI（合格率・平均修正回数・ベロシティ）は vault の Dataview ダッシュボードで自動集計する
- Google Calendar・Gmail・Slackと連携して運用する
- 先読み型（Proactive）でパイプラインのボトルネック・リスクを検知して深澤に報告する
- 週次ステータスレポート・デイリーブリーフィングを担当する
- KPI管理（evaluator合格率・平均修正回数・ベロシティ）を行う

### Plannerエージェント (`planner`)
- 深澤から要件をヒアリングする
- Researcherから市場調査レポートが渡された場合はそれを要件定義に反映する
- 市場調査はResearcherの専管。Planner自身は市場調査を行わない
- 要件定義書 → 基本設計書 → 詳細設計書の順で仕様書を作成
- 深澤の承認後、Graphic-Designer / Music-Generator / Code-Generatorへ仕様書を引き渡す

### Graphic-Designerエージェント (`graphic-designer`)
- グラフィックデザイン・画像アセット制作に特化
- Plannerの要件をもとに、外部ツール連携またはフリー素材の取得/加工で画像を制作する
- 生成した画像をリポジトリへ追加し、Code-Generatorが実装できる形で引き渡す

### Music-Generatorエージェント (`music-generator`)
- ゲーム音楽・効果音（SE）・ジングルの制作に特化
- Plannerの要件をもとに、フリー素材収集またはWeb Audio APIプロシージャル生成でオーディオアセットを制作する
- 音楽ファイル（OGG/MP3）またはWeb Audio API実装コードをCode-Generatorへ引き渡す

### Code-Generatorエージェント (`code-generator`)
- コードの生成・修正のみを担当（言語・環境問わず）
- Plannerの仕様書と、Graphic-Designer・Music-Generatorからの納品物を組み合わせて実装する
- 実装完了後はEvaluatorへ成果物を提出する
- Evaluatorから不合格を受けた場合は修正して再提出する
- 2回以上同じ理由で不合格になった場合は深澤へ報告・判断を仰ぐ
- **タイムアウト対策**: 実装規模が大きくタイムアウトが見込まれる場合は、複数のCode-Generatorエージェントに作業を分割して並行実装する。分割単位はファイル単位またはページセクション単位とし、各エージェントが担当範囲を明示してから着手すること
- **エージェント停止時の引き継ぎ**: サブエージェントがセッション上限等で停止しても成果物ファイルはディスクに残っていることが多い。「停止＝作業消失」と即断せず、まずファイル実体を確認してメイン側が残作業（テスト・修正）を引き継ぐ。上限リスクが高い局面では後続の品質ゲートをエージェント追加起動せずインライン実行に切り替えてよい

### Legal-Checkerエージェント (`legal-checker`)
- 著作権・ライセンス・利用規約等の法務リスクを確認する特化型エージェント
- コード・グラフィック・音楽・ライブラリ等の成果物を対象に法務チェックを実施する
- リスクを RED（即時修正必須）/ YELLOW（要対応）/ GREEN（問題なし）の3段階で分類して報告
- RED/YELLOWが存在する場合は問題の種別に応じて以下へ修正を依頼する:
  - グラフィック起因の問題 → [Graphic-Designer] へ結果を返す → 修正後に [Code-Generator] へ再連携
  - 音楽・SE起因の問題 → [Music-Generator] へ結果を返す → 修正後に [Code-Generator] へ再連携
  - コード起因の問題 → [Code-Generator] へ直接フィードバック
- 単独で実行することも、Evaluatorへの提出前に呼び出すことも可能

### Dynamic-Testerエージェント (`dynamic-tester`)
- Playwright（ヘッドレスChromium）でHTMLファイルを実際に起動し動作確認する品質ゲート
- 確認内容: JSランタイムエラー・Canvas描画・404アセット・スクリーンショット取得
- 対象: 変更されたHTMLファイル（`git diff HEAD` から自動検出）
- PASS時: Evaluatorへ結果サマリーを渡す
- FAIL時: Code-Generatorへブロッキングフィードバックを返す（Evaluatorには渡さない）

### Evaluatorエージェント (`evaluator`)
- Code-Generatorの成果物を仕様書と照らし合わせ100点満点で採点する
- 合格基準: 80点以上 かつ 仕様適合性16点以上（XSS等は即不合格）
- 不合格時: 具体的なフィードバックをCode-Generatorへ返す
- 合格時: 深澤へ結果報告 → `kai_001` ブランチへコミット＆プッシュ → Marketerへ成果物情報を引き渡す（任意）
- **前提**: Dynamic-TesterのPASS結果を受け取ってから採点を開始する

### Marketerエージェント (`marketer`)
- 完成した成果物のマーケティング戦略立案とコンテンツ生成を一貫して担当
- EvaluatorまたはPM（深澤）から成果物情報を受け取り作業開始
- 競合調査 → ターゲット/USP/KPI/スケジュール策定 → コンテンツ生成の順で進める
- 必須成果物: Xポスト（日英）・GitHub README紹介文・キャッチコピー集
- 任意成果物: ランディングページコピー（Code-Generatorへ引き渡し）・記事アウトライン・プレスリリース
- 出力先: `marketing/[プロダクト名]_strategy.md` と `marketing/[プロダクト名]_content.md`
- Researcherの市場調査レポートが存在する場合は活用する（自ら市場調査はしない）

### English-Teacherエージェント (`english-teacher`)
- ネイティブ英語講師として深澤の英語学習を支援する独立ユーティリティ（制作パイプラインとは独立して単発で利用する）
- 日英バイリンガルで指導し、CEFR（A1〜C2）で学習者レベルに合わせて難易度を調整する
- 4つの指導モードを持つ:
  - 英会話・スピーキング練習（ロールプレイ／自由会話、より自然な言い回しを提示）
  - 英作文・メール添削（Good points → Corrections → Native version の構成）
  - 文法・語彙の解説（結論→例文→日本語解説→よくある間違い）
  - 発音・リスニング指導（カタカナ近似＋IPA＋コツ、音声変化の解説）
- 「褒めてから直す」「間違いを歓迎する」を基本姿勢とし、学習者のモチベーション維持を最優先する

### Accountingエージェント (`accounting-agent`)
- 追加で課金が発生し得る操作を**常時監視**する経理（会計）特化型エージェント（PMOと同じく横断稼働）
- 課金が発生する／発生し得る場合は、**実行前に深澤(PM)へ通知**して許可を仰ぐ
- 深澤の許可で課金が発生する場合は、課金額をモニタリングし、**月次累計が予算上限（¥5,000）を超えないようチェック＆報告**する
- リスクを RED（即時停止・要承認）/ YELLOW（要確認）/ GREEN（課金なし）の3段階で分類する
- 台帳は `accounting/`（`budget.md` 予算 / `ledger.md` 台帳）。通知は Slack Incoming Webhook（無料）→未設定時はチャット報告にフォールバック
- 自動監視は `.claude/hooks/accounting-guard.sh`（PreToolUse hook）が担い、課金リスク操作を実行前に検知して承認(ask)を要求、上限超過見込みはブロック(deny)する
- 大前提は CLAUDE.md「有料APIキー禁止」「有料・従量課金サービス禁止」の徹底（＝**課金ゼロの維持**）。上限¥5,000は例外的課金への安全装置

### フロー概要
```
    [PMO] ← 進捗/リスク/品質を横断モニタリング   [Accounting] ← 課金リスクを常時監視（PreToolUse hook）
       │ 深澤(PM)へ報告（常時稼働）              │ 課金発生時に通知→承認→累計¥5,000上限チェック＆報告
       ▼                                          ▼
深澤(PM) → [Researcher] 市場調査（必要な場合）→ [Planner] レポート受け取り
深澤(PM) → [Planner] 要件定義・設計書作成（市場調査なしの場合）
          ├→ [Graphic-Designer] グラフィック制作（並行）
          ├→ [Music-Generator]  音楽・SE制作（並行）
          └→ [Code-Generator]   実装（グラフィック・音楽納品後）
               ↓
          → [Legal-Checker] 著作権・ライセンス法務チェック ※任意/Evaluator前推奨
               ↓ RED/YELLOW（グラフィック起因）
            [Graphic-Designer] 修正 → [Code-Generator] へ再連携 → [Legal-Checker] 再チェック
               ↓ RED/YELLOW（音楽・SE起因）
            [Music-Generator] 修正 → [Code-Generator] へ再連携 → [Legal-Checker] 再チェック
               ↓ RED/YELLOW（コード起因）
            [Code-Generator] 修正 → [Legal-Checker] 再チェック
               ↓ GREEN
          → [Dynamic-Tester] 動的実行チェック（Playwright）※必須
               ↓ FAIL
            [Code-Generator] 修正・再提出 → [Dynamic-Tester] 再検証
               ↓ PASS
          → [Evaluator] 検証・採点
               ↓ 不合格
            [Code-Generator] 修正・再提出 → [Evaluator] 再検証
               ↓ 合格
            深澤(PM)へ報告 → [PMO] 記録・KPI更新 → GitHub push (kai_001)
               ↓ ※任意
            [Marketer] 戦略立案・コンテンツ生成 → 深澤(PM)へ納品
```

## 注意事項
- `.edge-test-profile/` はMicrosoft Edgeのブラウザデータ。gitignoreすること
- `shogi_rpg_enhanced.jsx` はJSX形式だがビルド環境なし。取り扱い注意

## APIキーに関する禁止事項（必ず守ること）
- **有料APIキーを環境変数・設定ファイル・コードに設定・記述することを禁止**
  - 禁止対象例: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` 等
- Claude Codeのセッション認証はOAuth経由のみで行い、APIキーは使用しない
- `.env` ファイルや `config.json` 等にAPIキーを書いた場合は即時削除し、gitにコミットしないこと
- APIキーが誤ってコミットされた場合は、該当キーを即座に無効化（revoke）すること

## コンテキスト節約のルール（必ず守ること）

### ファイル読み込みの基本原則
- **Read前に必ず grep/find** で対象行番号を特定する
- **Read には offset + limit を必ず指定**（全体読み込み禁止）
  - 上限: 対象行の前後200行（index.html等は前後50行）
- `.claudeignore` 記載ファイルは Read 禁止。grep + offset/limit のみ許可

### エージェント間のデータ受け渡し
- **Code-Generator** へは変更箇所のみを渡す（ファイル全体を渡さない）
  - 形式: 「ファイルXのY行目付近をEdit toolで以下に変更」
- **Evaluator** は `git diff HEAD` で確認する（変更ファイルの全体再読み込み禁止）
  ```bash
  git diff HEAD        # 未コミット変更確認
  git diff HEAD~1 HEAD # 直前コミットの確認
  ```
- エージェント間のコードブロックにファイル全体を貼ることを禁止

### Code-Generator の出力形式
- コードは **変更箇所スニペット（前後10行含む）** で出力する
- ファイル全体出力は禁止（「省略なし」ルールより本ルールを優先）

### プランファイルの管理
- 完了タスクは詳細を削除し1行サマリーに置き換える
- プランファイルは「現在未完了のタスク」のみ保持する
