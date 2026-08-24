---
type: decision
date: 2026-08-16
status: accepted
tags: [decision, sengoku, csv, verification]
related: ["[[0024-encoding-and-required-check-guards]]", "[[0014-import-matching-and-grid-verification-promotion]]"]
---

# 0025 正本CSVはゲームへ追随させる（同期は"検査FAILの箇所だけ"当てる）

## 背景・問題

[[0024-encoding-and-required-check-guards]] で「未解決・要判断」として残した43件の検査FAILを片付けた。

- `verify-castle-csv` 23件FAIL: 1534年シナリオを `DATA.scenarios.unshift()` で**先頭へ挿入**したため
  CSVの「シナリオN(大名)」列の意味が1つずれた（列1=1560年想定のまま、ゲームの index 0 は1534年）＋
  2026-08-13 の座標修正8件＋城名変更1件（葛尾城→北信濃城）。
- `verify-force-list` 20件✗: **全て派生列**（「近くの城」）。X,Y は完全一致で、
  城の座標・名称の変更に派生列が追随していなかっただけ。
- `verify-castle-layouts` 実行不可: 環境制約と判断していたが、**このスクリプトだけ
  `chromium.launch()` にブラウザ実体の指定が無かった**（他の verify-*.mjs は
  `CHROMIUM_PATH || /opt/pw-browsers/chromium` のフォールバックを持つ）。

## 決定

深澤の判断により **CSV をゲームの現状に合わせて更新**する（ゲーム側は1534年の史実監査と
座標修正を経た新しい状態であり、CSVが陳腐化した側）。ただし**同期の当て方**を次のとおり定める。

- **一括同期はしない。検査がFAILとした箇所だけを当てる**。
  `buildCastlePositionCsv()` による全面同期を試したところ40行が差分になり、うち17行は
  シナリオ列が**空になる情報損失**だった（書き出しは「その大名がそのシナリオの名簿に居るとき」しか
  名前を出せない。検査側はその欠落をWARNとして許容している）。さらに岸和田城は
  **検査には存在するのに書き出しには出ない**。結果、23箇所だけを当てて差分22行に収めた。
- **派生列は再生成スクリプトを持つ**。`scripts/export-force-list.mjs` を新設し、
  ゲームの正準な書き出し（`_buildForceListCsv`）を `force_list.csv` へ反映する。
  X,Y や名称を手で変えたいときは使わない（取込側の経路を使う）と明記した。
- **`verify-castle-layouts.mjs` にブラウザ実体の指定を追加**し、他の検査と揃えた。

## 理由

- 「正本はCSV」という規約は CSV が維持されている前提のもの。今回はシナリオ挿入と史実監査で
  **ゲーム側が正しく、CSVが取り残された**。規約を曲げるのではなく、追随の向きを1回決めた。
- 一括同期の道具は「一見きれいに片付く」が、**書き出し経路と検査経路の範囲差**を吸収できず
  情報を落とす。最小の当て方の方が、レビューでも差分が読める。
- 検査が実行できない状態を「環境の制約」と結論づけていたが、実際はスクリプト間の不統一だった。
  **1本だけ落ちる検査は、環境ではなくそのスクリプトを疑う**。

## 影響・トレードオフ

- `siro_ichi.csv` 22行 / `force_list.csv` 16行を更新。`verify-castle-csv` `verify-force-list`
  `verify-castle-layouts` `verify-sengoku-boot` `verify-map-assets` `verify-sengoku-balance` の6本すべてPASS。
- CSV書き換えで **Python のテキストモードが改行を正規化する罠**を踏んだ。
  `open(path, encoding='utf-8')` は `\r\n` を `\n` に潰して返すため「読んだ文字列から元の改行を判定」は
  常に失敗し、CRLFのCSVを丸ごとLFにして155行の差分を作った。さらに元ファイルは**改行が混在**しており、
  一括正規化でも無関係な10行を巻き込む。行ごとに行末を保持する方式へ直した。
- **残置**: `verify-castle-csv` の WARN 24件（その大名がそのシナリオの名簿に不在）と、
  CSV外の城5件（筒井城・安芸高山城・小倉山城・出水城・勢福寺城＝1534年シナリオで追加）。
  いずれも非ブロッキング。CSVへ足すには8シナリオ分の領有を決める必要があり、次の判断待ち。
