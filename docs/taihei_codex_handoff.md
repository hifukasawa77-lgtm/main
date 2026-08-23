# 太平風雲記 Codex 引き継ぎメモ

## 対象
- Repository: `hifukasawa77-lgtm/main`
- Branch: `taihei-ui-redesign`
- Draft PR: #331 `太平風雲記 UIリデザイン 第1段階`
- Issue: #330 `太平風雲記 UI全面見直し`

## 目的
`taihei.html` の既存ゲームロジックを壊さず、南北朝・太平記らしい中世和風UIへ刷新する。あわせて登場人物の顔グラフィックを個別PNGアセット化し、ゲーム内で実画像として利用する。

## UI方針
- 配色: 墨黒 / 焦茶 / 生成り / 朱 / 金
- 上部HUD: 年月、勢力、金、兵力、威信、朝廷関係、平均忠義、恩賞待ち
- 中央: 全国マップ
- 右側: 選択国、武将、朝廷・正統性、軍勢情報
- 下部: 内政 / 軍事 / 外交 / 朝廷 / 恩賞 / 悪党 / 情報（本体では既存コマンド体系との整合を優先）
- 南朝 / 北朝 / 中立・地方勢力を色と家紋で識別
- Android横画面を重視

## 現在の実装状況
- `taihei-ui-preview.html` を作成済み。中世和風UIのプレビューとして利用。
- `scripts/apply-taihei-ui-redesign.mjs` を作成済み。本体Canvas UIへ変換をかけるための試作スクリプト。
- `.github/workflows/taihei-ui-redesign.yml` を作成済み。ただしChatGPT側APIコミットではActionsが期待どおり自動実行されなかったため、本体 `taihei.html` への変換適用は未完了。
- 公開中の `main/taihei.html` はまだ本番UI置換をしていない。
- `taihei.html` には既に GameKit ベースの全国マップ、国選択、武将、朝廷、恩賞、忠義、悪党、年代記、戦闘、セーブなどのロジックがある。UI層を中心に改修すること。

## 重要な既存データ
`taihei.html` 内の `GENERALS_DEF` に主要武将データがある。現行仕様書 `specs/taihei_spec.md` では主要武将は約30名が正式実装対象。ChatGPT画像生成中に表示された「412名」などの人数は生成画像上の仮表示であり、正式仕様として採用しないこと。

主な武将例:
- 足利尊氏 `ashikaga_takauji`
- 足利直義 `ashikaga_tadayoshi`
- 高師直 `ko_moronao`
- 赤松円心 `akamatsu_enshin`
- 佐々木道誉 `sasaki_doukyo`
- 北畠顕家 `kitabatake_akiie`
- 北畠親房 `kitabatake_chikafusa`
- 楠木正成 `kusunoki_masashige`
- 楠木正行 `kusunoki_masatsura`
- 新田義貞 `nitta_yoshisada`
- 名和長年 `nawa_nagatoshi`
- 菊池武光 `kikuchi_takemitsu`
- 後醍醐天皇 `godaigo`

正確な全一覧は `GENERALS_DEF` をソース・オブ・トゥルースとして読むこと。

## 人物アセット方針
最終配置例:
```
assets/taihei/characters/
  ashikaga_takauji.png
  ashikaga_tadayoshi.png
  ko_moronao.png
  akamatsu_enshin.png
  ...
```

推奨仕様:
- 1人物1ファイル
- 正方形 512x512 以上で生成し、ゲーム側では必要サイズへ縮小表示（128x128等）
- 背景は透過、または統一した暗い和紙背景
- 文字・人物名・ステータスは画像に焼き込まない
- 胸上ポートレート、正面〜やや斜め、顔の識別性を最優先
- 南北朝時代の装束・甲冑・烏帽子・冠を時代考証寄りにする
- 戦国期の派手な大兜や江戸期風の装束を避ける
- 写実寄り歴史シミュレーションゲームの統一画風

## 画像生成の現状
ChatGPTの画像生成で以下を作成済みだが、これらは会話内生成物でありリポジトリには未格納。
- UI完成イメージ画像
- 足利尊氏の単独ポートレート
- 主要人物30名の一覧グリッド画像
- 南朝武将40名風の一覧グリッド画像

注意: 一覧グリッド画像には史実・正式データと一致しない人物名や人数が混入している可能性がある。個別アセット作成時は必ず `GENERALS_DEF` のID・氏名を正とすること。

## Codexに依頼したい次の作業
1. `taihei-ui-redesign` ブランチをチェックアウト。
2. `taihei.html`, `taihei-ui-preview.html`, `scripts/apply-taihei-ui-redesign.mjs`, `specs/taihei_spec.md` を確認。
3. `main` の最新変更を取り込み、PR #331の競合状態を解消する。
4. プレビューの和風UI方針を本体 `MapScene` に直接統合する。
5. 既存機能（国選択、地図ズーム/パン、内政、軍事、恩賞、朝廷、悪党、年代記、ターン終了、セーブ/ロード）を壊さない。
6. Android横画面で操作しやすいタップ領域を確保する。
7. `GENERALS_DEF` から人物ID一覧を抽出し、`assets/taihei/characters/index.json` を作る。
8. 画像が未配置の場合でもプロシージャル肖像にフォールバックする実装を残す。
9. 個別PNGが配置されたら `drawGeneralPortrait` より実画像を優先して描画する `loadGeneralPortraits` / キャッシュ機構を追加する。
10. 変更後に構文エラー、起動エラー、主要画面遷移を確認し、PR #331へコミットする。

## 受入条件
- タイトル〜シナリオ選択〜陣営選択〜全国マップまで正常起動
- 本体ロジックに例外が出ない
- 全国マップが中世和風UIになっている
- 実データの金/兵/威信/忠義/朝廷/恩賞がHUDへ反映される
- 選択国と武将情報が右パネルへ反映される
- Android横画面でメニュー操作可能
- 人物画像が存在する場合はPNGを表示、存在しない場合は既存のプロシージャル肖像へフォールバック
- `main` へは直接コミットせず、PR #331でレビュー可能な状態を維持

## Codex向け開始プロンプト
以下をそのままCodexへ渡してよい:

> `hifukasawa77-lgtm/main` の `taihei-ui-redesign` ブランチで作業してください。まず `docs/taihei_codex_handoff.md`、`specs/taihei_spec.md`、`taihei.html`、`taihei-ui-preview.html`、`scripts/apply-taihei-ui-redesign.mjs` を読み、Draft PR #331の作業を引き継いでください。目的は太平風雲記の既存ゲームロジックを壊さず、中世和風UIを本体Canvasへ統合し、`GENERALS_DEF` を正本として人物PNGアセット対応を実装することです。mainへ直接コミットせず、`taihei-ui-redesign` にコミットしてください。`
