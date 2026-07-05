# ことのは / Kotonoha — 日本語プログラミング学習環境 仕様書

- 言語名: **ことのは / Kotonoha**（なでしこ・ひまわり・Mind・プロデル・ドリトル等の既存日本語言語と非衝突）
- 成果物ファイル: リポジトリ直下 `kotonoha.html`（UI）＋ `kotonoha-lang.js`(言語コア)
- 作成: Planner / 承認: 深澤PM（自律実行モード・確定要件）

---

## 1. 要件定義

### 1.1 目的・コアバリュー
- プログラミング初学者（特に英語に抵抗のある日本語話者）が、母語のままプログラミングの概念（変数・分岐・繰り返し・関数・再帰）を学べるブラウザ完結型学習ツール。
- コアバリュー: (1) 全角/半角を意識せず書ける寛容なレキサ (2) 行ハイライト付きステップ実行で「動きが見える」 (3) 日本語で原因と直し方を示すエラーメッセージ。

### 1.2 ターゲット
- 小中高生・プログラミング入門者・日本語話者の社会人学習者。PC/タブレットのモダンブラウザ（Chrome/Edge/Safari/Firefox 最新）。

### 1.3 機能要件（MoSCoW）
- **Must**: 言語コア（§2）／エディタ＋ハイライト／実行・出力コンソール／ステップ実行デバッガ（行ハイライト・変数ウォッチ・コールスタック・速度スライダー）／日本語エラー／7段階レッスン＋自動判定／サンプル集／localStorage保存・読込／ステップ上限ガード／XSS対策（全出力textContent経由）
- **Should**: 実行中の停止ボタン、レッスン進捗のlocalStorage保存、エディタのTabインデント対応
- **Could**: 行番号表示、出力のクリアボタン、コード共有用のクリップボードコピー
- **Won't**: サーバ通信、外部CDN、画像/音声アセット、モバイル最適化の完全対応（崩れない程度のレスポンシブのみ）

### 1.4 非機能要件
- フレームワーク・ビルドツール不使用。素のHTML/CSS/JS。GitHub Pages静的ホスティングで動作。
- 1000行程度のプログラムを体感遅延なく実行（ツリーウォークで十分）。
- 無限ループでもタブがフリーズしない（既定 100,000 ステップで中断）。

---

## 2. 言語仕様（Kotonoha v1）

### 2.1 字句仕様（レキサ）

**正規化（トークン化前に全ソースへ適用）**
- 全角英数字→半角、全角記号→半角に正規化: `＋－＊／％＝＜＞！（）［］｛｝、，．：；　`→`+-*/%=<>!()[]{},,.:; `（全角スペースは半角スペース）
- `×`→`*`、`÷`→`/`、`≠`→`!=`、`≦`→`<=`、`≧`→`>=`
- 文字列リテラル内部（`「…」` / `"…"` の中）は正規化しない（原文保持）。

**トークン一覧**

| type | 内容 |
|---|---|
| `NUMBER` | `[0-9]+(\.[0-9]+)?`（正規化後）。負数は単項演算子で表現 |
| `STRING` | `「…」` または `"…"`。エスケープなし。`」`/`"` で終端。閉じ忘れは字句エラー |
| `IDENT` | 漢字・ひらがな・カタカナ・英字・`_`で始まり、同+数字が続く列。ただし各位置でキーワード最長一致を優先 |
| `KEYWORD` | 下表 |
| `OP` | `+ - * / % == != < <= > >= = ( ) [ ] { } , : 。` |
| `NEWLINE` | `\n` または文末記号 `。`（文区切りとして等価） |
| `EOF` | 入力末尾 |

各トークンは `{ type, value, line, col, raw }` を持つ（line/col は1始まり）。

**キーワード表（予約語・最長一致）**

`もし` `ならば` `そうでなければ` `おわり` `回繰り返す` `の間繰り返す` `関数` `戻す` `表示` `抜ける` `続ける` `真` `偽` `かつ` `または` `でない`

- 複合キーワード `回繰り返す` `の間繰り返す` は**一体の1トークン**として認識する（これにより変数名「回数」「間隔」等が安全に使える）。
- IDENT走査中、現在位置からキーワードが最長一致した場合はIDENTを打ち切りキーワードを発行する。ただし `真`/`偽` は前後がIDENT構成文字なら識別子の一部とみなす（例:「真offset」は稀なので v1 は単純に最長一致で可、テストは「合計」「カウンタ」等の非衝突名を使う）。
- コメント: `#`（正規化後。`＃`含む）から行末まで無視。
- 空白・タブはトークン区切り。**キーワード/識別子の境界が曖昧な場合は空白区切りを推奨**（レッスン内サンプルは常に空白区切りで書く）。

### 2.2 文法（BNF風）

```
program     ::= { statement }
statement   ::= assign | if | repeat | while | funcdef | return
              | print | break | continue | exprstmt
assign      ::= IDENT [ "[" expr "]" | "[" expr "]" … ] "=" expr NEWLINE
if          ::= "もし" expr "ならば" NEWLINE block
                [ "そうでなければ" ( if | NEWLINE block ) ] "おわり" NEWLINE
                -- 「そうでなければ もし …」で else-if 連鎖
repeat      ::= expr "回繰り返す" NEWLINE block "おわり" NEWLINE
while       ::= expr "の間繰り返す" NEWLINE block "おわり" NEWLINE
funcdef     ::= "関数" IDENT "(" [ IDENT { "," IDENT } ] ")" NEWLINE
                block "おわり" NEWLINE
return      ::= "戻す" [ expr ] NEWLINE
print       ::= "表示" expr { "," expr } NEWLINE   -- 複数引数は連結して1行出力
break       ::= "抜ける" NEWLINE
continue    ::= "続ける" NEWLINE
exprstmt    ::= expr NEWLINE                        -- 主に関数呼び出し
block       ::= { statement }

expr        ::= or
or          ::= and { "または" and }
and         ::= not { "かつ" not }
not         ::= [ "でない" ] comparison             -- 前置。「でない x」
comparison  ::= additive [ ("=="|"!="|"<"|"<="|">"|">=") additive ]
additive    ::= multiplicative { ("+"|"-") multiplicative }
multiplicative ::= unary { ("*"|"/"|"%") unary }
unary       ::= [ "-" ] postfix
postfix     ::= primary { "(" [ expr {"," expr} ] ")" | "[" expr "]" }
primary     ::= NUMBER | STRING | "真" | "偽" | IDENT
              | "(" expr ")"
              | "[" [ expr {"," expr} ] "]"                 -- 配列リテラル
              | "{" [ STRING ":" expr {"," STRING ":" expr} ] "}"  -- 辞書リテラル
```

**優先順位表（低→高）**

| 優先度 | 演算子 | 結合 |
|---|---|---|
| 1 | `または` | 左 |
| 2 | `かつ` | 左 |
| 3 | `でない` | 前置 |
| 4 | `== != < <= > >=` | 非結合（連鎖不可） |
| 5 | `+ -` | 左 |
| 6 | `* / %` | 左 |
| 7 | 単項 `-` | 前置 |
| 8 | 呼び出し `()` / 添字 `[]` | 左 |

### 2.3 意味論

- **型**: 数値(JS number)・文字列・真偽値・配列(JS Array)・辞書(JS Map または plain object w/ null prototype)。
- `+` は両辺数値なら加算、どちらかが文字列なら文字列連結（他方を文字列化）。`- * / %` は数値のみ（違反は実行時エラー）。`/` の0除算は実行時エラー。
- 比較 `== !=` は型と値の一致。`< <= > >=` は数値同士または文字列同士（辞書順）。混在はエラー。
- 真偽値が必要な文脈（もし/の間/かつ/または/でない）で真偽値以外はエラー（暗黙変換しない — 学習用に厳格）。
- **スコープ**: グローバル＋関数ローカル（レキシカル）。関数内での代入はローカル変数を作る。未定義変数の参照は実行時エラー。ブロック（もし/繰り返し）は新スコープを作らない。
- `戻す` 省略時・関数末尾到達時の戻り値は `偽`（v1簡易仕様として明記して統一）。関数外の `戻す`、ループ外の `抜ける`/`続ける` は解析時エラー。
- **組み込み関数**: `長さ(x)`（文字列/配列/辞書の要素数）、`追加(配列, 値)`（破壊的、戻り値は配列）、`数値(文字列)`（変換不能はエラー）、`文字列(値)`、`キー一覧(辞書)`（キーの配列）。ユーザ定義関数が同名なら上書き可。
- **表示**: 引数を文字列化して連結し、1呼び出し＝出力1行。文字列化規則: 数値はそのまま、真偽値は「真」「偽」、配列は `[1、2、3]`、辞書は `{「キー」：値、…}`。
- **ステップ上限**: 1文の実行＝1ステップとカウント。`maxSteps`（既定100,000）超過で `kind:"step-limit"` エラー「実行ステップの上限（…回）に達しました。無限ループになっていないか確認してください。」

### 2.4 エラーメッセージ規約

書式: `「{line}行目: {原因}。{直し方}」` を `KotonohaError.message` に格納。例:
- `3行目: 「もし」に対応する「ならば」がありません。条件式のあとに「ならば」を書いてください。`
- `5行目: 「おわり」が足りません。「もし」「繰り返す」「関数」のブロックは「おわり」で閉じます。`
- `2行目: 変数「合計」はまだ作られていません。先に「合計 = 0」のように代入してください。`
- `4行目: 文字列と数値は「-」で計算できません。「数値(…)」で変換してください。`

---

## 3. 公開APIコントラクト（kotonoha-lang.js）

`kotonoha-lang.js` は `window.Kotonoha` のみを公開する（他のグローバル汚染禁止）。UI(`kotonoha.html`)はこのAPIだけに依存する。

```js
window.Kotonoha = {
  VERSION: "1.0.0",

  // 字句解析。tolerant:true なら不正文字を {type:"ERROR"} トークンとして返し throw しない
  // （シンタックスハイライト用）。tolerant省略/false時は KotonohaError を throw。
  tokenize(source: string, opts?: { tolerant?: boolean }): Token[],

  // 構文解析。KotonohaError(kind:"parse") を throw。
  parse(source: string): ProgramNode,

  // 一括実行。throwしない — エラーは戻り値に格納。
  // opts.onOutput は「表示」1回ごとに1行文字列で呼ばれる（HTMLエスケープ前の生文字列）。
  run(source: string, opts?: {
    maxSteps?: number,               // 既定 100000
    onOutput?: (line: string) => void
  }): RunResult,

  // ステップ実行器（内部はジェネレータ実装）。parse失敗時は KotonohaError を throw。
  createStepper(source: string, opts?: { maxSteps?: number }): Stepper,

  KotonohaError,   // class KotonohaError extends Error
};

// ---- 型定義 ----
// Token      = { type: "NUMBER"|"STRING"|"IDENT"|"KEYWORD"|"OP"|"NEWLINE"|"COMMENT"|"ERROR"|"EOF",
//                value: string|number, line: number, col: number, raw: string }
//   ※ tolerantモードのみ COMMENT/ERROR を含める（ハイライトで色分けするため）
// KotonohaError = Error & { kind: "lex"|"parse"|"runtime"|"step-limit",
//                           line: number|null, col: number|null,
//                           message: string /* §2.4書式の日本語 */, hint: string }
// RunResult  = { ok: boolean, output: string[], steps: number,
//                error: KotonohaError|null,
//                globals: Record<string, Value> /* 実行終了時のグローバル変数 */ }
// StepState  = { done: boolean, line: number|null,   // 次に実行する（直前に実行した）文の行
//                output: string[],                    // ここまでの全出力
//                variables: Array<{ scope: "グローバル"|string, name: string, value: string /* 表示用文字列化済 */ }>,
//                callStack: Array<{ name: string, line: number }>, // 底=メイン。name例: "(メイン)","フィボナッチ"
//                steps: number, error: KotonohaError|null }
// Stepper    = { step(): StepState,        // 1文実行して状態を返す。done後の呼び出しは同じ最終状態を返す
//                getState(): StepState,    // 実行せず現在状態を返す
//                reset(): void }
// ProgramNode(AST) 主要ノード種別（typeフィールド）:
//   Program{body} / Assign{target,value} / IndexAssign{object,index,value}
//   If{cond,then,else} / Repeat{count,body} / While{cond,body}
//   FuncDef{name,params,body} / Return{value} / Print{args}
//   Break / Continue / ExprStmt{expr}
//   Binary{op,left,right} / Unary{op,operand} / Call{callee,args} / Index{object,index}
//   NumberLit / StringLit / BoolLit / ArrayLit{elements} / DictLit{entries}
//   全ノードに line, col を付与（デバッガの行ハイライトに必須）
```

**分業境界**: 言語コア担当は上記APIと§2を実装（DOM操作禁止・純粋JS）。UI担当は `Kotonoha.*` のみ呼ぶ（インタプリタ内部に触れない）。単体でNode等でもテスト可能なよう、`kotonoha-lang.js` はDOM非依存で書くこと（`window`が無ければ `globalThis.Kotonoha` に公開）。

---

## 4. 画面構成（kotonoha.html）

### 4.1 レイアウト（デスクトップ3カラング / 900px未満は縦積み）

```
┌ header: ロゴ「ことのは / Kotonoha」・タグライン日英・index.htmlへ戻るリンク ┐
├──────────┬───────────────────────┬──────────────┤
│ 左: レッスン │ 中央: エディタ                  │ 右: デバッガ      │
│ ・レッスン1-7 │ ・ツールバー(実行/ステップ/停止/    │ ・変数ウォッチ表   │
│   一覧+進捗✓ │   速度スライダー/保存/読込/サンプル▼)│ ・コールスタック   │
│ ・課題文表示  │ ・textarea+ハイライトオーバーレイ    │ ・ステップ数表示   │
│ ・判定ボタン  │ ・実行中行ハイライト               │                │
│            ├───────────────────────┤                │
│            │ 下: 出力コンソール（エラーは赤系で表示） │                │
└──────────┴───────────────────────┴──────────────┘
背景: 固定Canvas パーティクル（design スキル準拠・低負荷・prefers-reduced-motion対応）
```

### 4.2 エディタ実装方針
- `position:relative` コンテナ内に `<pre><code>`(ハイライト層) と透明文字色の `<textarea>` を完全重ね合わせ。同一フォント（monospace）・同一パディング・`white-space:pre-wrap` を両層に適用し、textareaの `scroll` イベントでハイライト層を同期。
- ハイライトは `Kotonoha.tokenize(src, {tolerant:true})` の結果から `span` を**createElement+textContentで**構築（innerHTML禁止）。色: キーワード=シアン、文字列=パープル、数値=白、コメント=グレー、ERROR=赤下線。
- ステップ実行中は現在行に半透明シアンの行背景をオーバーレイ層に描画。

### 4.3 デバッガ動作
- 「ステップ実行」開始で `createStepper` を生成しエディタをreadonly化。ボタン: ▶次へ / ⏩自動（速度スライダー 1〜60 step/s、`setInterval`）/ ⏹停止。
- 毎ステップ `StepState` を反映: 行ハイライト・変数表(scope/name/value)・コールスタック(下から積む)・出力追記。
- 通常「実行」は `Kotonoha.run` を使い、`onOutput` で逐次出力（1回のrunで完了）。

### 4.4 レッスンデータ構造（HTML内のJS定数 `LESSONS`）

```js
const LESSONS = [
  { id: 1, title: { ja: "表示", en: "Print" },
    explain: "…（数行の日本語解説）",
    starter: "表示 「こんにちは」",           // エディタへ流し込む雛形
    task: "「ことのは」と1行表示してください",
    judge: { expected: ["ことのは"] }        // 期待出力（行配列・完全一致）
  }, …
];
// 全7課: 1表示 → 2変数 → 3条件分岐 → 4繰り返し → 5配列 → 6関数 → 7再帰
```
- 判定: 「判定」ボタンで `Kotonoha.run` 実行 → `result.output` の各行を `trimEnd` して `expected` と全行完全一致なら合格。合格レッスンidは `localStorage["kotonoha_progress"]`(JSON配列)へ保存し✓表示。
- 課題は出力が一意に定まるものにする（乱数・入力なし）。第7課の期待例: `フィボナッチ(10)` → `55`。

### 4.5 サンプル集（ツールバーのselect）
`こんにちは世界` / `FizzBuzz(1〜15)` / `九九の表` / `フィボナッチ(再帰)` / `配列の合計` / `辞書と成績判定` の6本を `SAMPLES` 定数で内蔵。選択でエディタへロード（編集中コードがあれば confirm）。

### 4.6 保存/読込
- `localStorage["kotonoha_saves"]` に `{name, code, savedAt}` の配列（最大20件）。保存名は `prompt` またはインラインフォーム、読込はダイアログ風Glassmorphismモーダル。

### 4.7 ビジュアル・i18n
- 配色: 背景 `#05070d`、アクセント シアン `#22d3ee` / パープル `#a78bfa`、Glassmorphismパネル（`backdrop-filter: blur` + 半透明白ボーダー）。ネオングロウ過多・原色マゼンタ・SF都市風演出は禁止。
- UI文言は日英併記（例: 「実行 Run」「変数 Variables」）。`<html lang="ja">`。
- 画像・音声アセットはゼロ。フォントはシステムフォントスタック。

### 4.8 XSS対策（実装ルール・必須）
- プログラム出力・エラーメッセージ・変数値・ユーザコード由来の文字列をDOMに入れる箇所は**全て `textContent` または `createTextNode`** を使う。`innerHTML` はユーザ入力が到達し得ない静的テンプレートにも原則使わない（使用箇所ゼロを目標）。
- 確認観点: 出力コンソール／変数ウォッチ／コールスタック／ハイライト層／保存名リスト／エラー表示。テスト入力 `表示 「<img src=x onerror=alert(1)>」` で alert が発火しないこと。

---

## 5. ファイル構成と実装分担

| ファイル | 内容 | 担当 |
|---|---|---|
| `kotonoha-lang.js` | 正規化・Lexer・Parser・Interpreter(ジェネレータ)・組み込み関数・`window.Kotonoha` 公開（§2,§3） | Code-Generator A |
| `kotonoha.html` | UI全体（CSS/パーティクル/エディタ/デバッガ/レッスン/保存）。`<script src="kotonoha-lang.js">` を読み込む（§4） | Code-Generator B（分割時） |

規模が許せば1エージェントで両方実装してよい。タイムアウト見込み時は上記2分割とし、APIコントラクト（§3）を境界とする。Graphic-Designer / Music-Generator の起用は不要（アセットゼロ）。

---

## 6. 受け入れ基準チェックリスト（Evaluator採点基準）

**言語コア**
- [ ] `もし〜ならば／そうでなければ／おわり`（else-if連鎖含む）が動作する
- [ ] `N回繰り返す`・`式 の間繰り返す`・`抜ける`・`続ける` が動作する
- [ ] `関数`定義・呼び出し・`戻す`・再帰（フィボナッチ(10)=55）が動作する
- [ ] 数値・文字列・真偽値・配列・辞書のリテラルと添字アクセス/添字代入が動作する
- [ ] 全角ソース（`もし　点数　＞＝　８０　ならば` 等、全角数字・記号・スペース）が半角版と同一結果になる
- [ ] 演算子優先順位が§2.2の表どおり（例: `2+3*4==14` が真）
- [ ] `while 真` の無限ループが maxSteps で停止し step-limit エラーになる（タブがフリーズしない）
- [ ] エラーが§2.4書式（行番号＋原因＋直し方）の日本語で返る（構文・実行時それぞれ1例以上確認）
- [ ] `window.Kotonoha` が§3のシグネチャ（tokenize/parse/run/createStepper/KotonohaError）を満たし、UI以外から呼んでも動く（DOM非依存）

**UI**
- [ ] シンタックスハイライトが入力に追従し、スクロールもずれない（ライブラリ不使用）
- [ ] 実行ボタンで出力コンソールに結果が表示され、エラーは赤系で表示される
- [ ] ステップ実行で行ハイライト・変数ウォッチ・コールスタックが更新され、速度スライダーで自動実行速度が変わる
- [ ] レッスン7課すべてに解説・雛形・課題・自動判定があり、正答で✓が付き進捗がリロード後も残る
- [ ] サンプル6本（FizzBuzz・九九・フィボナッチ含む）がロードでき、いずれもエラーなく実行できる
- [ ] localStorageへの保存・読込が動作する

**横断（即不合格項目含む）**
- [ ] **XSS**: `表示 「<img src=x onerror=alert(1)>」` 等でスクリプトが発火しない（innerHTML経路なし）— **違反は即不合格**
- [ ] 外部CDN・外部リクエスト・画像/音声アセットがゼロ（`kotonoha.html`＋`kotonoha-lang.js`のみで完結）
- [ ] コンソールにJSランタイムエラーなし（Dynamic-Tester PASS）
- [ ] 配色・Glassmorphism・パーティクル背景がCLAUDE.mdデザインルール準拠（サイバーパンク演出なし）、UIが日英併記
