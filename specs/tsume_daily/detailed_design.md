# 詳細設計書 — 詰将棋デイリー / Tsume Daily（フェーズ1: Web版MVP）

- 作成日: 2026-06-11
- 作成者: Planner
- 対応文書: [requirements.md](./requirements.md) / [basic_design.md](./basic_design.md)
- 実装担当: Code-Generator（本書の指示単位で実装すること）

## 0. 実装上の大原則（Code-Generatorへの指示）
1. 成果物は `/home/user/main/tsume_daily.html` の1ファイル。外部JS/CSS/画像/CDNなし
2. shogi.html の流用関数は**コピーして組み込む**（shogi.htmlは編集禁止）。流用元行番号は basic_design.md §5 を参照
3. `innerHTML` に変数を連結しない。テキストは `textContent`、要素は `createElement` で生成（XSS対策。シェア文面も同様）
4. すべての純粋ロジック関数（ShogiCore / Solver / Generator / SeededRandom / Stats計算）はDOM非依存で書く（コンソールから単体検証可能にする）
5. 規模が大きいため、Code-Generatorは「§1のセクション単位」で分割並行実装してよい（CLAUDE.mdタイムアウト対策）

## 1. ファイル内セクション構成

`tsume_daily.html` 内を以下のコメントブロックで区切る。

```
<!-- ===== 1. HTML構造 ===== -->        ヘッダ/盤面/持ち駒/モーダル群/canvas背景
/* ===== 2. CSS ===== */               テーマ変数/Glassmorphism/盤面/レスポンシブ
// ===== 3. I18N =====                 辞書・t()
// ===== 4. SEEDED RANDOM =====        fnv1a / mulberry32 / 日付処理
// ===== 5. SHOGI CORE =====           shogi.html流用ロジック（純粋関数）
// ===== 6. TSUME SOLVER =====         王手着手列挙・全数探索
// ===== 7. TSUME GENERATOR =====      詰み形構築・検証リトライ
// ===== 8. FALLBACK BANK =====        埋め込み問題JSON（60問）
// ===== 9. STATS =====                localStorage統計・ストリーク
// ===== 10. SHARE =====               絵文字グリッド・コピー・X intent
// ===== 11. GAME CONTROLLER =====     進行状態機械
// ===== 12. UI =====                  描画・モーダル・カウントダウン・パーティクル
// ===== 13. BOOT =====                初期化エントリポイント
```

## 2. データ型定義

```js
// 駒: {t: PieceType, p: 1|2}   PieceType = 'FU'|'KYO'|'KEI'|'GIN'|'KIN'|'KAKU'|'HI'|'OU'
//                                          |'TO'|'NKYO'|'NKEI'|'NGIN'|'RYUMA'|'RYUO'
// shogi.html と同一表現。p=1 攻方(下向き先手) / p=2 受方(玉方)

// 局面 State
{ board: (Piece|null)[9][9],
  hands: { 1: PieceType[], 2: PieceType[] },  // 成駒は元の駒種で持つ(DEMOTE適用)
  turn: 1|2 }

// 着手 Move
{ kind: 'move', fr,fc,tr,tc, prom: boolean } | { kind: 'drop', t: PieceType, tr,tc }

// 問題 Problem
{ no: number,            // 問題番号(#)
  date: 'YYYY-MM-DD',    // JST
  plies: 1|3,            // 手数
  state: State,          // 初期局面(turn=1)
  solution: Move[],      // 主手順(攻方・受方交互, 長さ=plies)
  source: 'gen'|'bank' } // 生成元
```

`DEMOTE` マップ（成駒→元駒: TO→FU, NKYO→KYO, NKEI→KEI, NGIN→GIN, RYUMA→KAKU, RYUO→HI）を定義する。

## 3. 日付・シード仕様（SEEDED RANDOM）

| 関数 | 仕様 |
|---|---|
| `getJSTDateString(now=Date.now())` | `new Date(now + 9*3600*1000)` のUTC成分から `'YYYY-MM-DD'` を返す。**端末タイムゾーンに依存しないこと** |
| `getPuzzleNumber(dateStr)` | エポック日 `EPOCH='2026-07-01'`（公開予定日。リリース時に確定）からの経過日数+1。`Math.round((Date.UTC(y,m-1,d) - Date.UTC(2026,6,1)) / 86400000) + 1` |
| `fnv1a(str)` | FNV-1a 32bit。`h=0x811c9dc5; for each char: h^=code; h=Math.imul(h,0x01000193); return h>>>0` |
| `mulberry32(seed)` | 標準実装。`()=>{seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296}` |
| `createRng(dateStr, attempt)` | `mulberry32(fnv1a('tsumeDaily:' + dateStr + ':' + attempt))`。リトライごとに attempt をインクリメント |
| `getPlies(dateStr)` | JSTの曜日で決定: 月〜金=1、土・日=3（`Date.UTC`から`getUTCDay()`） |
| `msUntilNextJSTMidnight(now)` | 完了ビューのカウントダウン用。次のJST 0:00までのms |

## 4. ShogiCore（流用＋改修）

流用: `inB, rawMoves, findKing, inCheck, clone, validMoves_board, inPromZone, mustProm`（無改修コピー）。

### 新規・改修関数
| 関数 | 仕様 |
|---|---|
| `validDrops(state, t, p)` | shogi.htmlの`validMoves_drop`を改修。`capData`引数を `state.hands` 参照に変更。二歩・行き所なし・自殺手フィルタは流用。**打ち歩詰めフィルタは含めない**（ソルバー/着手側で `isUchifuzume` を別途適用。受方の合駒には打ち歩詰めが存在しないため） |
| `applyMove(state, move) -> State` | 非破壊（cloneして適用）。移動: 取った駒は `DEMOTE` して自分のhandsへ。`move.prom` で成り。drop: handsから1枚除去して配置。turn反転 |
| `isMate(state)` | `state.turn` 側が王手されている(`inCheck`) かつ 合法応手ゼロ(`legalMoves(state).length===0`) |
| `legalMoves(state)` | turn側の全合法手（盤上移動×成/不成バリエーション＋全持ち駒drop）。自玉が王手放置になる手を除外（validMoves_board/validDropsで担保） |
| `isUchifuzume(state, move)` | move が歩のdropで、適用後に相手が `isMate` ならtrue |

## 5. TsumeSolver

### 5.1 着手列挙
| 関数 | 仕様 |
|---|---|
| `attackerMoves(state)` | `legalMoves` のうち、適用後に受方玉が王手になる手のみ。かつ `isUchifuzume` がfalseの手のみ。成れる移動は「成」「不成」を別の手として列挙（`mustProm`該当は成のみ） |
| `defenderMoves(state)` | `legalMoves`（玉移動・王手駒の取り・合駒drop全種）。受方handsは生成時に「全駒−盤上−攻方hands」をセット済み |

### 5.2 探索
```js
// 戻り値: 解ツリー or null
// solveAttack(state, pliesLeft):
//   pliesLeft は残り総手数(奇数)。各 attackerMoves(state) の手 m について:
//     s2 = applyMove(state, m)
//     if isMate(s2): m は1手解
//     else if pliesLeft >= 3: solveDefense(s2, pliesLeft-1) が「全応手詰み」なら m は解
//   解となった初手の配列と、各初手に対する主変化を返す
// solveDefense(state, pliesLeft):
//   defenderMoves(state) の全手 d について solveAttack(applyMove(state,d), pliesLeft-1) ... (pliesLeft-1==1 含む)
//   1つでも詰まない応手があれば失敗(null)。全部詰むなら、応手のうち
//   「攻方の解初手数が最少」のものを最長抵抗手として記録
```
| 関数 | 仕様 |
|---|---|
| `solveTsume(state, plies)` | 上記探索のエントリ。戻り値 `{ firstMoves: Move[], line: Move[] }`。`firstMoves`=詰む初手の全列挙（余詰検出用）、`line`=主手順（最長抵抗ベース、長さ=plies） |
| 性能対策 | 3手詰・受方合駒含め分岐は高々数百×数十×数百規模。`attackerMoves`が0なら即null。ノード数上限 `NODE_LIMIT=200000` を設け、超過時は「検証失敗」として生成リトライへ |

## 6. TsumeGenerator

```js
generateDailyProblem(dateStr) -> Problem
  plies = getPlies(dateStr)
  for attempt = 0 .. MAX_ATTEMPTS(=400):
    rng = createRng(dateStr, attempt)
    cand = buildCandidate(rng, plies)      // 下記
    if (!cand) continue
    sol  = solveTsume(cand, plies)
    if (!sol) continue
    if (sol.firstMoves.length !== 1) continue      // 余詰排除（唯一初手）
    if (plies===3 && solveTsume(cand,1)) continue  // 1手で詰んでしまう問題を排除
    return Problem{...}
  return pickFallback(dateStr, plies)      // FallbackBankへ
```

### buildCandidate(rng, plies) の配置仕様
1. 受方玉 `OU(p=2)` を r∈0..2, c∈1..7 にランダム配置
2. 攻方駒を **盤上 1〜3枚＋持ち駒 1〜2枚** 選択。プール（重み付き）: KIN×3, GIN×3, KEI×2, KYO×2, FU×2, HI×1, KAKU×1, TO×1, RYUO×1, RYUMA×1（玉の周囲チェビシェフ距離≤2のマスへ優先配置。RYUO/RYUMA/HI/KAKUは距離≤4許容）
3. 受方守備駒を 0〜2枚（KIN/GIN/FU から）玉の隣接マスに配置
4. 整合性チェック（不成立なら null を返す）:
   - 同一駒種の総数が現物将棋の枚数（歩18/香4/桂4/銀4/金4/角2/飛2/玉2）を超えない
   - 二歩・行き所のない駒（1段目の歩香、1-2段目の桂 等）がない
   - 初期局面で受方玉が**王手されていない**こと（攻方手番開始のため王手状態は不可）
   - 攻方の駒が受方玉に取られ放題の浮き駒だけでない 等の簡易品質チェックは行わない（ソルバー検証に委ねる）
5. 受方hands = 全40枚 −盤上 −攻方hands（種類別カウントで構成）

### FallbackBank
- 同一アルゴリズムをNode/ブラウザで事前実行して生成した **1手詰40問＋3手詰20問** を JSONで埋め込む
- `pickFallback(dateStr, plies)`: `fnv1a(dateStr) % 該当手数の問題数` で決定論的に選出
- **Code-Generatorへの指示**: バンク生成は実装完了後に `node` でジェネレータ部を実行して出力すること（手作業で局面を作らない＝著作権安全性の担保）。生成スクリプトの実行ログをLegal-Checker提出物に含める

## 7. GameController（状態機械）

状態: `READY → PLAYING → (CLEARED | FAILED) → DONE`

| 関数 | 仕様 |
|---|---|
| `boot()` | dateStr取得 → session復元（§basic 3.2。日付不一致なら破棄）→ 問題生成 → state==='cleared'/'failed'なら完了ビューへ、それ以外はプレイビューへ |
| `onCellTap(r,c)` / `onHandTap(t)` | shogi.htmlの`handleCell`/`handleDrop`相当を簡略実装。選択→候補ハイライト→着手。攻方手番のみ受付 |
| `tryPlayerMove(move)` | ① `attackerMoves(current)` に含まれるか（王手かつ非打ち歩詰め）② 含まれても、その手が解手順（`solveTsume`残り手数での解）に入らなければミス。判定: `applyMove`後に `残りplies-1` で受方全応手詰みが成立するか。**成立→着手確定**、不成立→`onMistake()` で巻き戻し |
| `onMistake()` | mistakes++、シェイク演出、インジケータ更新、session保存。`mistakes>=5` で `fail()` |
| `defenderAutoReply()` | `solveTsume` が返す最長抵抗応手を400ms後に適用。続けて攻方手番へ（3手詰のみ） |
| `clear()` / `fail()` | session確定 → `Stats.commitResult()` → 結果モーダル表示 |
| ヒント(`onHint`) | 1日1回。解の初手の移動元駒（dropなら持ち駒）をパープルでハイライト。`hintUsed=true` |

## 8. Stats（localStorage）

| 関数 | 仕様 |
|---|---|
| `loadJSON(key, fallback)` / `saveJSON(key, obj)` | try/catchラップ。例外時はメモリフォールバック（モジュール内変数）＋初回のみ警告バナー |
| `commitResult(dateStr, {cleared, mistakes, timeSec, hintUsed, plies})` | history追記、totalPlayed/Cleared/Mistakes更新、ストリーク再計算、history>400件で古い順削除 |
| `recalcStreak(stats, todayStr)` | todayから過去へ `history[d].cleared===true` が連続する日数。maxStreak更新 |
| `getDisplayStats()` | クリア率 = totalCleared/totalPlayed（%、四捨五入）、平均ミス = totalMistakes/totalPlayed（小数1桁） |

## 9. Share

### 9.1 文面フォーマット（厳守）
絵文字グリッド: 試行を左から表示。ミス=🟥、クリア=🟦、失敗で終了=⬛、未使用枠=⬜（計最大6枠: ミス5＋最終1）。

```
JA:
詰将棋デイリー #{no}（{plies}手詰）
🟥🟦⬜⬜⬜⬜ {mistakes}ミス {m}:{ss}
🔥{currentStreak}日連続
#詰将棋デイリー
{URL}

EN:
Tsume Daily #{no} (Mate in {plies})
🟥🟦⬜⬜⬜⬜ {mistakes} miss / {m}:{ss}
🔥 {currentStreak}-day streak
#TsumeDaily
{URL}
```
- 失敗時は2行目を `⬛×6 X/5` 形式（クリア🟦なし）、ストリーク行は省略
- ヒント使用時は時間の後に `💡` を付加
- `{URL}` = `https://<GitHub Pagesドメイン>/tsume_daily.html`（実装時に定数 `SITE_URL` として定義。リリース時に確定）

### 9.2 関数
| 関数 | 仕様 |
|---|---|
| `buildShareText(lang, result, stats)` | 上記フォーマットの文字列を返す純粋関数 |
| `copyShare()` | `navigator.clipboard.writeText`。reject時フォールバック: 文面を読み取り専用`<textarea>`でモーダル表示し手動コピー誘導。成功時トースト「コピーしました / Copied!」 |
| `shareToX()` | `window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(text))` |

## 10. UI実装指示

- 盤面: `<div id="board">` に81個の `.cell` を生成（shogi.html 718-758の構造踏襲）。クラス: `.sel`(選択=シアン枠) `.vmove`(移動可=シアン淡) `.vcap`(駒取り=パープル淡) `.chk`(王手=パープル枠)
- 持ち駒トレイ: 攻方のみ操作可能UI。受方持ち駒は「残り全部」のため表示しない（凡例に注記）
- 成り確認: `attackerMoves` に成/不成両方が含まれる移動のみ選択モーダル表示。片方しか解に絡まなくてもユーザー選択を尊重し、`tryPlayerMove` で判定
- ミスインジケータ: `●○○○○` 形式5個。ミスで `●`（パープル）に
- カウントダウン: `setInterval` 1秒、`msUntilNextJSTMidnight` から `hh:mm:ss`。0到達でリロード促しボタン表示（自動リロードしない）
- 背景パーティクル: 既存 index.html のCanvasパーティクルを簡略流用（30〜50粒子、`requestAnimationFrame`、`prefers-reduced-motion` で停止）
- i18n: `t(key)` + `applyI18n()`（`data-i18n`属性走査で`textContent`差替）。言語トグルはヘッダ右上 `JA|EN`
- `<html lang>` も切替に追随。`<meta name="viewport" content="width=device-width, initial-scale=1">` 必須

## 11. エラー処理一覧

| 事象 | 検知箇所 | 挙動 |
|---|---|---|
| localStorage例外 | Stats.loadJSON/saveJSON | メモリ動作＋バナー「⚠ 記録が保存されません / Stats won't be saved」 |
| 保存データ破損/version不一致 | loadJSON | 該当キーのみ初期化（他キーは温存） |
| 問題生成リトライ上限超過 | generateDailyProblem | FallbackBankへ自動切替（ユーザーに区別を見せない。consoleにのみ`source:'bank'`をログ） |
| ソルバーNODE_LIMIT超過 | solveTsume | その候補を破棄しリトライ（=生成失敗扱い） |
| clipboard拒否 | copyShare | textareaフォールバックモーダル |
| 端末時計が過去/未来 | getPuzzleNumber | no<1 なら「公開前です/Coming soon」表示でプレイ不可（EPOCH前アクセス対策） |
| プレイ途中リロード | boot | session.v1 から mistakes/hintUsed/経過手を復元（盤面は解手順を movesDone 手分再生して復元） |

## 12. テスト観点（Dynamic-Tester / Evaluator向け申し送り）
1. 同一日付シードで2回生成して同一問題になること（決定論性）
2. 生成問題100件サンプルで: 全件「N手で詰む・N-2手で詰まない・初手唯一・打ち歩詰め非含有」をソルバー再検証
3. 日付切替（JST 23:59→0:00）でストリーク・問題番号が正しく進むこと
4. ミス5回→失敗→シェア文面が失敗フォーマットになること
5. localStorage無効環境（プライベートモード相当）で例外なく動作すること
6. iPhone SE相当(375px)で盤面・UIが収まりタップ操作できること
7. XSS: シェア文面・統計表示に `textContent` のみ使用していること

## 13. 実装分割案（Code-Generator並行実装用）
| 担当 | 範囲 | 依存 |
|---|---|---|
| CG-A | §1 HTML構造＋§2 CSS＋§12 UI骨格 | なし |
| CG-B | §4 SeededRandom＋§5 ShogiCore＋§6 Solver＋§7 Generator（純粋ロジック） | なし |
| CG-C | §9 Stats＋§10 Share＋§11 Controller＋§13 Boot＋結合 | CG-A/B完了後 |
| 後続 | FallbackBank生成（CG-Bのジェネレータをnode実行） | CG-B完了後 |
