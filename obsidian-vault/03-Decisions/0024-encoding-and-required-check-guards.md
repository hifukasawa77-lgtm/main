---
type: decision
date: 2026-08-16
status: accepted
tags: [decision, self-improve, release-check, encoding]
related: ["[[0023-verification-integrity-and-daily-backfill]]", "[[harness-maintenance-patterns]]"]
---

# 0024 文字化け・二重定義・必須検査の未実行を release-check で機械検出する

## 背景・問題

[[0023-verification-integrity-and-daily-backfill]] で backfill した Daily の `### 学び` を
当時の差分から埋める作業の中で、**誰も検出していなかった3つの事故**が見つかった。

1. **文字化け（2026-08-12）**: `Add daimyo diplomacy negotiation artwork`（da0cda3）が、画像追加とは
   無関係に `sengoku.html` の日本語を全面破壊した（UTF-8のバイト列をCP932として読んだ痕跡）。翌コミットで
   9,993行を書き戻して復旧したが、**`<title>` と meta description が化けたまま1コミット公開**された。
   さらにコメント内の化け4行は動作に影響しないため修正から取り残され、**2026-08-17まで生存**していた。
2. **必須検査の未実行（2026-08-13）**: `Fix 1534 Ashikaga clans and Kobayakawa castle`（78ee5e6）が
   勢力名を 足利→将軍足利 に改名し、`verify-castle-csv.mjs` が不一致を出す状態になった。
   CLAUDE.md は「sengoku.html を触ったら必ず実行」と規定しているが実行されず、
   **23件FAIL・`verify-force-list` 20件✗ を抱えたまま4日間 main に載り続けた**（同期間はDailyも無い）。
3. **同名 const の二重定義（2026-08-04）**: ブランチのマージで同じトップレベル `const` が2回宣言され、
   **SyntaxError でページが丸ごと起動不能**になっていた（`REQUESTED_KOKUJIN_TEMPLE_PORTRAIT_SLOTS`）。

いずれも「例外が出ない／出ても遅い」種類で、[[0023-verification-integrity-and-daily-backfill]] で `coding` へ昇格した
**「検査は嘘をつく方向に壊れる」の裏返し＝そもそも検査が存在しない領域**だった。

## 決定

`release-check`（コミット前の機械チェック）へ3つの検査を追加し、あわせて既存検査1つの腐りを直した。

- **検査#6 文字化けの追加行**: 差分の追加行に、CP932誤読で生じる「見慣れない漢字＋ひらがな/カタカナ」の
  並びが出たら✗。**検出パターンは `\x{}` 表記で書く**——literalで書くとスクリプト自身が検出対象になり、
  かつ harness-lint 検査#12（多バイトブラケットはC localeで空振り＝偽の✓）に引っかかる。
- **検査#8 トップレベル宣言の二重定義**: 変更HTMLの桁位置0の `const`/`let` が重複したら✗。
  **`function` は対象外**——関数宣言の再定義はJS仕様上合法（後勝ち）で、初版で含めたところ
  `shogi.html` の `findKing`/`inB` を誤検知した。
- **検査#9 変更ファイルに対応する必須チェックの列挙**: `sengoku.html` / `sanguo.html` / `genpei.html` /
  `synth-eq.html` / `siro_ichi.csv` / `force_list.csv` / `agent-data.js` を触ったら、必要な検査コマンドを
  △警告として列挙する（実行の有無は機械では確かめられないので非ブロッキング）。
- **検査#4の修正**: 「1MB超の変更ファイル」が、元から1.4MBの `sengoku.html` を**触るたびに毎回✗**を
  出していた。恒常的に赤い検査は他の指摘ごと無視されるため、
  「新規で1MB超」または「1MB超かつ今回+100KB以上増加」に限定した。

## 理由

- 3件とも**人間の注意力に頼る運用**でだけ守られていた。CLAUDE.md への記載は既にあり（必須チェック）、
  それでも4日間破れたので、**記載場所を増やすのではなく、変更した瞬間に目に入る場所へ出す**方を選んだ。
- Playwright検査は数分かかるため release-check 内では実行しない。列挙に留めるのは
  「実行しなかったこと」を責めるためではなく、**何を実行すべきかを思い出せない**問題を解くため。
- 検査#4の修正は [[0023-verification-integrity-and-daily-backfill]] で昇格した「`[warn]` は腐る」の直接適用。自分で書いたルールが
  同じセッション内の既存検査に当てはまった。

## 影響・トレードオフ

- release-check の項目が6→9へ増える。いずれも grep ベースで実行時間の増加はほぼ無い。
- 文字化け検査の実装で **`\x{}` の符号位置を推測で書いたところ5つ全部が誤り**だった。
  誤った符号位置は「エラーを出さずに一度も一致しない」＝完全な偽の✓になる。
  負のテスト（意図的に化けた行を入れて✗を出す）で初めて発覚した。
- **未解決として残すもの**: 上記2で壊れた `verify-castle-csv` 23件FAIL／`verify-force-list` 20件✗ は
  **今回修正していない**。城の領有・座標・マーカー名は史実解釈を含むデータ判断であり、
  正本（CSV）とゲーム内のどちらを正とするかは深澤の判断が要る。検出と報告までを行う。
- `verify-castle-layouts.mjs` はこの環境では未実行。playwright ^1.60 が要求するブラウザビルド(1223)と
  プリインストール(1194)が不一致で、環境規約により `playwright install` は行わない。
