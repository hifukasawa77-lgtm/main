# 戦国風雲記 — 武将肖像監査（2026-07-25）

## 対象と確認方法

現在ゲームが参照し得る武将肖像を、画像アトラスの全コマと最終的な `ASSETS.portraitSlots` の上書き順の両方から確認した。

| 区分 | 確認コマ数 |
| --- | ---: |
| 通常の武将肖像ページ | 461 |
| 追加家臣肖像 | 400 |
| 専門家・朝廷関係者肖像 | 75 |
| 個別の修正・名簿差分枠 | 62 |
| **合計** | **998** |

確認基準は「主役以外の人物の顔・上半身が、肖像内で明瞭に判別できるか」。背景の甲冑意匠、旗、ぼけた装飾は複数人物には数えない。

## 複数人物だった肖像の全件と現状

以下の16名は以前に複数人物が含まれるため修正対象として登録されており、全員が `portraitFixMultiPerson`（4×4、1名ずつの胸像）へ差し替え済みである。

| ID | 現在の枠 | 主役中心トリミング |
| --- | --- | --- |
| `niwa_nagahide` | 0,0 | 完了 |
| `akechi_mitsuhide` | 1,0 | 完了 |
| `mori_yoshinari` | 2,0 | 完了 |
| `sassa_narimasa` | 3,0 | 完了 |
| `baba_nobuharu` | 0,1 | 完了 |
| `sanada_yukitaka` | 1,1 | 完了 |
| `naoe_kagetsuna` | 2,1 | 完了 |
| `kakizaki_kageie` | 3,1 | 完了 |
| `tsugaru_nobuhira` | 0,2 | 完了 |
| `numata_sukemitsu` | 1,2 | 完了 |
| `soma_takamitsu` | 2,2 | 完了 |
| `minato_suehide` | 3,2 | 完了 |
| `miki_naoyori` | 0,3 | 完了 |
| `nikaido_yukichika` | 1,3 | 完了 |
| `suka_moritsune` | 2,3 | 完了 |
| `otawara_tsunekiyo` | 3,3 | 完了 |

`buildPortraitSlots()` では、通常・追加家臣の対応表を作成した後にこの修正表を上書きしているため、上の16名は元アトラスを表示しない。

## 結果

- 現在ゲームに表示される肖像で、複数人物が明瞭に残るもの: **0件**
- 主役中心へのトリミングが未実施の修正対象: **0件**
- 追加の画像生成・トリミング作業: **不要**

修正表の定義は `sengoku.html` の `PORTRAIT_FIX_SLOTS`（`portraitFixMultiPerson` の16枠）にある。
