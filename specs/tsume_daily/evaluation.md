# 評価報告書 — 詰将棋デイリー / Tsume Daily（フェーズ1: Web版MVP）

- 評価日: 2026-06-11
- 評価者: Evaluator
- 対象: `tsume_daily.html`（コミット 40c6bd9、1440行）
- 前提ゲート: Dynamic-Tester **PASS**（JSエラー0件・5パターン・モバイル確認済み） / Legal-Checker **GREEN**（バンク60問全件再検証済み）
- 仕様書: specs/tsume_daily/{requirements,basic_design,detailed_design}.md
- PM承認済み設計判断: ①盤面=DOM＋背景=Canvasハイブリッド ②平日1手詰/土日3手詰 ③初手唯一解必須

## 判定: ✅ 合格（96点 / 100点）

---

## Phase 1: テスト結果（静的解析）

| TC# | テスト内容（要件ID） | 結果 | 根拠（tsume_daily.html 行番号） |
|-----|---------------------|------|------|
| TC-001 | M1: 日付シード決定論的生成・JST非依存・EPOCH起点問題番号 | ✅ PASS | L348-395 getJSTDateString(UTC+9成分)/fnv1a/mulberry32/createRng — 詳細設計§3と完全一致 |
| TC-002 | M1: 難度カレンダー（平日1手詰・土日3手詰、PM承認版） | ✅ PASS | L385-390 getPlies: getUTCDay()で土日=3/平日=1 |
| TC-003 | M2: クライアントサイド自動生成＋ソルバー全数検証 | ✅ PASS | L654-741 buildCandidate（玉端域配置・二歩/行き所/枚数/初期王手チェック）→solveTsume検証 |
| TC-004 | M2: 余詰排除（初手唯一解）・ちょうどN手・打ち歩詰め排除 | ✅ PASS | L734 firstMoves.length!==1除外、L735 line長一致、L736 1手詰先行排除、L591 打ち歩詰めフィルタ |
| TC-005 | M2: ソルバー（攻方毎手王手・受方全応手・最長抵抗・NODE_LIMIT） | ✅ PASS | L583-647 attackerMovesEx(L589王手強制)/_solveDefense(L629全応手詰み要求・L631最長抵抗=解初手数最少)/L604 NODE_LIMIT=200000 |
| TC-006 | M3: 駒操作プレイ・ミス判定・ミス5回で失敗 | ✅ PASS | L977-1011 attemptMove(非王手/非詰み筋→onMistake・局面非適用=巻き戻し)、L1009 mistakes>=5でfinishGame(false) |
| TC-007 | M3: 受方自動応手（最長抵抗・400msディレイ） | ✅ PASS | L997-1005 defenderAutoReply: solveDefenseLineの最長抵抗手をsetTimeout 400msで適用 |
| TC-008 | M4: 統計・ストリーク（localStorage v1スキーマ・400日上限） | ✅ PASS | L840-872 defaultStats/recalcStreak/applyResultToStats(L858-859 400件超で古い順削除)/getDisplayStats（クリア率%・平均ミス小数1桁） |
| TC-009 | M5: Wordle風絵文字グリッド・シェア文面（JA/EN・失敗形式・💡） | ✅ PASS | L877-902 buildEmojiGrid(🟥/🟦/⬜/失敗⬛×6)・buildShareText — 詳細設計§9.1フォーマット厳守 |
| TC-010 | M5: クリップボードコピー（textareaフォールバック）・X intent | ✅ PASS | L1227-1243 navigator.clipboard→catch時showCopyFallback(textarea.value)、shareToX=encodeURIComponent＋noopener |
| TC-011 | M6: 日英バイリンガル切替・localStorage永続化・html lang追随 | ✅ PASS | L309-(I18N辞書)、L1262-1263 applyI18n(documentElement.lang切替)、L1284 saveJSON(K_PREF) |
| TC-012 | M7: モバイル対応（viewport・min-width360px・タップ44px・盤面min(92vw,480px)） | ✅ PASS | L5 viewport meta、L31 min-width:360px、L62/91/139 min-44px、L103 width:min(92vw,480px)、L188 @media(max-width:380px) |
| TC-013 | M8: 1日1問制御（完了後は結果ビュー直行・カウントダウン・再挑戦不可） | ✅ PASS | L1419-1420 session cleared/failed→restoreFinished→showDoneView、L1184-1200 startCountdown(1秒tick・0到達でリロードボタン=自動リロードなし) |
| TC-014 | NFR: 生成タイムバジェット3秒＋フォールバックバンク決定論選出 | ✅ PASS | L722/728 GEN_TIME_BUDGET_MS=3000、L830-836 pickFallback=fnv1a(dateStr)%bank.length（要件定義§4「最悪3秒・超過時バンク切替」に明記＝要件遵守） |
| TC-015 | NFR: フォールバックバンク60問（1手詰40＋3手詰20）埋め込み | ✅ PASS | L747- FALLBACK_BANK: "p":1×40件・"p":3×20件（grep計数で確認）。Legal-Checker GREEN（全件再検証済） |
| TC-016 | NFR: localStorage例外時メモリ動作＋警告バナー・version不一致初期化 | ✅ PASS | L933-950 Storage.mem フォールバック、L943 version!==1→初期化、L1279 !Storage.ok→showBanner、L1383-1386 boot時probe |
| TC-017 | NFR: EPOCH前アクセスゲート（no<1→公開前画面） | ✅ PASS | L1395-1400 getPuzzleNumber<1でsoonView表示・プレイ不可 |
| TC-018 | NFR: セキュリティ（XSS）— innerHTML不使用・textContent/createElementのみ | ✅ PASS | innerHTML/document.write/insertAdjacentHTML/eval/new Function 実コード使用0件（L1236はコメントのみ）。描画系40箇所すべてtextContent/createElement（L1058-1105等）。?dパラメータは`\d{4}-\d{2}-\d{2}`厳格regex＋textContent出力のみ（L1390-1393） |
| TC-019 | NFR: 完全オフライン・依存ゼロ・有料APIキーなし | ✅ PASS | 外部URL参照はX intentのwindow.openのみ。CDN/外部JS/API キー0件。Dynamic-Testerでも外部リクエスト0件確認済 |
| TC-020 | 詰将棋ルール: 二歩・行き所なし・自殺手（ShogiCore流用忠実性） | ✅ PASS | L407-468 shogi.html無改修コピー（inB/rawMoves/inCheck/validMoves_board/inPromZone/mustProm）、L483-501 validDrops（二歩L490-493・行き所L488-489・自玉王手L496）、L504-520 applyMove(DEMOTE/非破壊) |
| TC-021 | セッション復元（リロード時: movesDone手分の盤面再生） | ✅ PASS | L1409-1431 日付不一致破棄→解手順をmovesDone×2手適用して復元 — 詳細設計§11どおり |
| TC-022 | Should S1ヒント/S2リプレイ/S3統計モーダル | ✅ PASS | L1024-1032 onHint(1日1回・解初手ハイライト)、L1246- replaySolution、L275 statsModal |
| TC-023 | デザイン: 黒背景＋シアン/パープル・Glassmorphism・パーティクル・非サイバーパンク | ✅ PASS | L12-23 :root(--bg:#05060a/--cyan:#22d3ee/--purple:#a78bfa=仕様§5指定値)、L44-50 backdrop-filter、L1318-1329 パーティクル＋prefers-reduced-motion停止。グロウ過多なし |

**総テストケース数: 23件 / PASS: 23件 / FAIL: 0件**（Must要件 M1〜M8 すべてPASS）

### Code-Generator申告逸脱点の妥当性評価
1. **生成3秒タイムバジェット** — 逸脱ではなく要件定義§4非機能要件の明文（「最悪3秒以内…超過時はフォールバック問題バンクに切替」）の実装。**妥当**。残存リスク: 低速端末のみバンクへ落ちると当日問題が端末間で分かれ得る（M1決定論との緊張は要件自体に内在。実測gen時間はconsoleログ出力済みで監視可能）
2. **`?d=` デバッグ日付上書き** — EPOCH=2026-07-01が未来でありDynamic-Tester検証に必須。regex厳格検証＋console.warn明示でセキュリティ問題なし。**妥当**。ただし本番公開時に残すとチート/統計汚染の入口になるため、**リリース前に削除またはビルドフラグ化を推奨**（残タスクとして申し送り）
3. **index.htmlポートフォリオカード未実施**（基本設計§7） — 成果物指定外のスコープ縮小としてPM承認前提で減点対象外。ただし**公開時に必須の残タスク**として申し送り

---

## Phase 2: 採点

| 評価軸 | 点数 | 根拠 |
|---|---|---|
| 1. 仕様適合性 | 19 / 20 | Must 8/8・Should 3/3 実装、詳細設計の関数仕様（§3〜§11）にほぼ逐語一致。-1: index.htmlカード未実施（承認済みスコープ外だが基本設計記載項目のため公開前残タスク） |
| 2. 動作正確性 | 19 / 20 | Dynamic-Tester PASS（JSエラー0・5パターン）。静的解析でソルバー/生成/状態機械/復元ロジックの整合確認。エッジケース（打ち歩詰め・二歩・EPOCH前・storage不可・破損データ・リロード復元）すべて実装。-1: タイムバジェット起因の端末間問題分岐の理論的可能性（要件内在リスク） |
| 3. コード品質 | 19 / 20 | 詳細設計§1のセクション構成を厳守、純粋ロジック層とDOM層を script タグで分離（コンソール単体検証可能）、流用元行番号コメント付き、デッドコードなし。-1: G グローバル状態オブジェクトへの集中（MVP規模では許容） |
| 4. セキュリティ | 20 / 20 | XSSシンク使用0件（innerHTML/document.write/eval等なし）。全描画 textContent/createElement。URLパラメータは厳格regex検証。X intentは encodeURIComponent＋noopener。外部送信なし・APIキーなし。即不合格項目該当なし |
| 5. デザイン整合性 | 19 / 20 | カラー変数が仕様指定値と一致、Glassmorphism・パーティクル（reduced-motion対応）・日英UI・サイバーパンク演出なし。Dynamic-Testerでモバイル収まり確認済。-1: ENモード時の駒漢字補助（凡例）が基本設計§2の記載比で簡素 |
| **合計** | **96 / 100** | |

## Phase 3: 判定

- 合格基準: 合計80点以上 かつ 仕様適合性16点以上 → **96点・適合性19点で合格**
- セキュリティ即不合格項目（XSS/SQLi/認証回避/CSRF）: **該当なし**

## 公開前残タスク（申し送り）
1. index.html へのポートフォリオカード追加（基本設計§7）→ Code-Generator
2. `?d=` デバッグパラメータの削除判断 → 深澤（PM）
3. `SITE_URL`（L875）と `EPOCH`（L348）のリリース時確定値レビュー → 深澤（PM）
