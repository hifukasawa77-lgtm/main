---
type: 詳細設計書
project: genpei
status: 作業中
agent: planner
target_file: genpei.html
created: 2026-08-05
updated: 2026-08-05
revision_count: 0
tags: [claudechord, 詳細設計, genpei]
---

# 詳細設計書 — 源平争乱記 / Genpei Souranki

> プロジェクトハブ: [[genpei]] ／ 上流: [[genpei_基本構想]] → [[genpei_要件定義]] → [[genpei_基本設計]]
> 本書は Code-Generator が着手できる粒度まで落としたもの。**第0節は実装前に必ず読むこと。**

---

## 0. 実装前の必読事項（既存資産の罠）

戦国風雲記・三国志で実際に事故った項目。**すべて「例外もエラーも出ずに壊れる」種類**なので、
コードレビューでは見つからない。着手前に頭に入れておくこと。

| # | 罠 | 対策 |
|---|---|---|
| 1 | **タイトル画面が出た＝起動成功ではない。** 描画ループの例外は「背景だけ残ってUIが出ない」形で現れ、タイトルは無事に出る | `verify-genpei-boot.mjs` でマップ画面まで入って確認する |
| 2 | **GameKit は update/draw の例外を捕捉して継続し `engine.errors` に積む。** `pageerror` だけ見る検査は素通りする | 検査で `pageerror` と `engine.errors` を**合算**する |
| 3 | **武将を配列の途中に挿入すると後続全員の顔がずれる。** 肖像枠を index で配布するため | **必ず配列末尾に追加**する。1枚1人の専用画は `{cols:1,rows:1}` スロットを作り、スロット割当の**最後**に当てる |
| 4 | **`drawImage` の source-rect を画素値で直書きすると、画像を縮小した瞬間に絵が無言で消える。** 読み込みは成功するので404もエラーも出ない | 矩形は「測った原寸サイズ」と対で持ち、描画時に実解像度へスケールする（`scaleSrcRect`）|
| 5 | **拠点座標を絶対画素値で持つと、参照先の地図が別解像度で再エンコードされた瞬間に全拠点がずれる** | `kyoten_ichi.csv` は**正規化 `MX,MY`（0..1）**で持つ（基本設計 3.3）|
| 6 | **埋め込みシードの更新を忘れても例外は出ない。** 正本CSVを編集した端末だけ正しく見え、初回起動の端末は古いシードで動く | `verify-genpei-kyoten.mjs` が**埋め込みシードと正本CSVの両方**を突き合わせる |
| 7 | **ブラウザは `favicon.ico` を勝手に取りに行く。** テストサーバが404を返すと `console.error` で検査が常に落ちる | テストサーバは favicon に **204** を返す（本物のアセット404は `response` で拾う）|
| 8 | **AI の集計値は乱数の種を固定しないと試行ごとに大きく揺れる** | バランスは1回でなく**5試行以上の平均**で見る |
| 9 | **`sengoku.html` は1行も変更しない**（決定事項B）。コードは読んで移植する | 受入基準に「`sengoku.html` の差分0行」がある |
| 10 | **`siro_ichi.csv` の X,Y は現行の地図画像の画素座標ではない。** 旧い地図に対して起こされた座標がそのまま残っており、素直に画素として扱うと164城中100城以上が海に落ちる。読み込みは成功し例外も出ない | 較正アフィン `x*1.275, y*1.235−88` を通す（1.3参照）。`verify-genpei-kyoten.mjs` が毎回164城の陸載り率を測り直す |
| 11 | **陸/海の判定を生成側と検査側で別々に書くと永久に直らない。** 片方が単一画素・片方が近傍平均だと、細い地峡で「生成は陸・検査は海」と食い違う | 両者を同一規則（`g > b+4` の3×3近傍平均）に揃える |

---

## 1. データファイル仕様

### 1.1 `assets/genpei/provinces.json` — 令制国の再編（66国）

`assets/sengoku/provinces.json`（65件）を複製し、**12世紀の令制国に合わせて再編する**。
戦国風雲記側は分割・改称の履歴を持っているため、そのままでは12世紀の国名と一致しない。

| 操作 | 内容 |
|---|---|
| 改称 | `南越後` → `越後` ／ `北信濃` → `信濃` ／ `東土佐` → `土佐` |
| 統合 | `南近江` ＋ `北近江` → `近江`（`neighbors` は両者の和集合から自己参照を除く）|
| 追加 | `淡路`（南海道）／`隠岐`（山陰道）|
| 除外 | `壱岐` `対馬` は地図画像の範囲外のため置かない（西海道は9国とする）|
| 置換 | `kokudaka`（太閤検地由来の千石単位）→ **`tasu`（田数・町）** へ。12世紀の『和名類聚抄』系の概算値を使う |
| 維持 | `id` / `x` / `y`（論理座標 1000×650）／`terrain` は変更しない |

結果: **66国**（畿内5・東海道15・東山道8・北陸道7・山陰道8・山陽道8・南海道6・西海道9）。

> ⚠ `id` を変えると `neighbors` の参照が切れる。改称は `nameJP` / `nameEN` のみ変更し、
> `id` は既存値（`echigo` / `shinano` / `tosa`）を流用する。統合する近江のみ新IDを起こす。

### 1.2 `kyoten_ichi.csv` — 拠点の正本（270拠点・11種別）

スキーマは基本設計 3.3 のとおり。**座標は正規化 `MX,MY`（0..1・小数6桁）**。

内訳: **国府66 ／ 館25 ／ 城柵24 ／ 砦12 ／ 荘園40 ／ 寺20 ／ 神社20 ／ 関所14 ／ 町14 ／ 村18 ／ 湊17 ＝ 270**

> 2026-08-05、深澤の指示（決定事項G）で当初の4種147拠点から11種270拠点へ拡張した。
> 「地図を拡大すると 館・城柵・国府・砦・村・町・寺・神社・関所・街道・湊 が現れる」ため。
> 街道は拠点として持たず、国府どうしを令制国の隣接関係で結んだ線として描く。

### 1.3 座標の起こし方（`scripts/gen-genpei-kyoten.mjs`）

地図は絵地図であり、`geoToScreen` の緯度経度換算と一致しない（九州はx方向に約380pxずれる）。
したがって**経緯度からは起こさない**。CLAUDE.md の方針どおり、**近傍の既知地点から局所アフィン内挿**する。

```
入力: siro_ichi.csv（戦国の城164）／ assets/sengoku/.../sengoku-japan-map-user-v1.webp（1672×941）
手順:
  1. 各拠点に「アンカー城」（同国または隣国の既知の城）を割り当て、画素オフセット(dx,dy)を与える
  2. アンカーの座標に較正アフィンを掛けて現行地図の画素へ写す（★下記）
  3. 地図画像を実際に読み、海に落ちた拠点を最寄りの陸へスナップする
     湊は「陸であり、かつ半径20px以内に海がある」位置へ寄せる（河港の淀津は除外）
  4. 重なり（最短間隔11px未満）を陸判定つきの決定論的な螺旋で解消する
  5. MX = x/1672, MY = y/941 で正規化して出力
```

> ★ **較正アフィン（実装時に判明した重要事項）**
> `siro_ichi.csv` の X,Y は**現行の地図画像の画素座標ではない**。旧い地図に対して起こされた
> 座標が残っており、そのまま画素として扱うと164城中100城以上が海に落ちる。
> 全164城が陸に載る係数を総当たりで求めた結果が **`x*1.275 + 0`, `y*1.235 − 88`**（164/164）。
>
> - `sengoku.html` 側は直さない（決定事項B）。これは genpei 側だけの読み替えである
> - 地図画像を差し替えると係数は無効になる。`verify-genpei-kyoten.mjs` が毎回
>   164城の陸載り率を測り直し、3%を超えたら校正失敗として落とす
> - **`gen-genpei-kyoten.mjs` は `siro_ichi.csv` を読むだけで書き戻さない**

**関連スクリプト**

| スクリプト | 役割 |
|---|---|
| `scripts/genpei-kyoten-anchors.mjs` | 拠点147のアンカー定義（生成の入力。生成後の正本は CSV 側）|
| `scripts/gen-genpei-kyoten.mjs` | `kyoten_ichi.csv` を生成（`--force` / `--dry-run`）|
| `scripts/verify-genpei-kyoten.mjs` | 機械検査（第9節）|
| `scripts/render-genpei-kyoten-map.mjs` | 全拠点を地図に重ねた目視確認用の画像を出力。**「相模国衙が相模にあるか」は機械では分からないので人が見る** |

---

## 2. 拠点ロスター（当初の147。拡張分は `scripts/genpei-kyoten-anchors.mjs` を正とする）

「アンカー」は `siro_ichi.csv` の城名。座標はそこからの局所内挿で起こす。

### 2.1 国府（66）

国府の所在は『延喜式』『和名類聚抄』の国府比定地による。

| 道 | 国府 | アンカー城 |
|---|---|---|
| 畿内 | 山城国府 | 二条御所 |
| 畿内 | 大和国府 | 多聞山城 |
| 畿内 | 河内国府 | 高屋城 |
| 畿内 | 和泉国府 | 岸和田城 |
| 畿内 | 摂津国府 | 石山御坊 |
| 東海 | 伊賀国府 | 伊賀上野城 |
| 東海 | 伊勢国府 | 霧山城 |
| 東海 | 志摩国府 | 鳥羽城 |
| 東海 | 尾張国府 | 清洲城 |
| 東海 | 三河国府 | 岡崎城 |
| 東海 | 遠江国府 | 曳馬城 |
| 東海 | 駿河国府 | 駿府館 |
| 東海 | 伊豆国府 | 伊豆韮山城 |
| 東海 | 甲斐国府 | 躑躅ヶ崎館 |
| 東海 | 相模国府 | 小机城（西へオフセット＝平塚）|
| 東海 | 武蔵国府 | 江戸城（西へオフセット＝府中）|
| 東海 | 安房国府 | 館山城 |
| 東海 | 上総国府 | 真里谷城 |
| 東海 | 下総国府 | 関宿城（南へオフセット＝市川）|
| 東海 | 常陸国府 | **府中城**（＝国府そのもの）|
| 東山 | 近江国府 | 観音寺城（西へオフセット＝大津）|
| 東山 | 美濃国府 | 稲葉山城 |
| 東山 | 飛騨国府 | 松倉城 |
| 東山 | 信濃国府 | **深志城**（＝松本・国府）|
| 東山 | 上野国府 | 箕輪城 |
| 東山 | 下野国府 | 唐沢山城 |
| 東山 | 陸奥国府 | 岩出山城（＝多賀城比定）|
| 東山 | 出羽国府 | 大宝寺城（＝城輪柵比定）|
| 北陸 | 若狭国府 | 後瀬山城 |
| 北陸 | 越前国府 | 一乗谷城 |
| 北陸 | 加賀国府 | 尾山御坊 |
| 北陸 | 能登国府 | 七尾城 |
| 北陸 | 越中国府 | 富山城 |
| 北陸 | 越後国府 | 春日山城（＝直江津・国府）|
| 北陸 | 佐渡国府 | 雑太城 |
| 山陰 | 丹波国府 | 丹波亀山城 |
| 山陰 | 丹後国府 | 弓木城 |
| 山陰 | 但馬国府 | 此隅山城 |
| 山陰 | 因幡国府 | 鳥取城 |
| 山陰 | 伯耆国府 | 羽衣石城 |
| 山陰 | 出雲国府 | 月山富田城 |
| 山陰 | 石見国府 | 山吹城 |
| 山陰 | 隠岐国府 | 月山富田城（北へ大きくオフセット＝隠岐島）|
| 山陽 | 播磨国府 | 姫路城 |
| 山陽 | 美作国府 | 津山城 |
| 山陽 | 備前国府 | 岡山城 |
| 山陽 | 備中国府 | 備中高松城 |
| 山陽 | 備後国府 | 神辺城 |
| 山陽 | 安芸国府 | 吉田郡山城（南へオフセット＝府中）|
| 山陽 | 周防国府 | 山口館 |
| 山陽 | 長門国府 | 櫛崎城 |
| 南海 | 紀伊国府 | 雑賀城 |
| 南海 | 淡路国府 | 洲本城 |
| 南海 | 阿波国府 | 勝瑞城 |
| 南海 | 讃岐国府 | 十河城 |
| 南海 | 伊予国府 | 湯築城 |
| 南海 | 土佐国府 | 岡豊城 |
| 西海 | 豊前国府 | 小倉城（南へオフセット＝京都郡）|
| 西海 | 豊後国府 | 府内館（＝国府）|
| 西海 | 筑前国府 | 立花山城（南西へオフセット＝太宰府）|
| 西海 | 筑後国府 | 柳川城 |
| 西海 | 肥前国府 | 佐賀城 |
| 西海 | 肥後国府 | 隈本城 |
| 西海 | 日向国府 | 佐土原城 |
| 西海 | 大隅国府 | 肝付城 |
| 西海 | 薩摩国府 | 内城 |

### 2.2 荘園（40）

`holder`（荘園領主）が **`jisha`（寺社）/ `sekkanke`（摂関家）** の荘園を接収すると
`reputation −25`（基本設計 4.1）。**平氏の知行国が多い西国ほど、接収の名分コストが重い。**

| 荘園 | 国 | holder | アンカー | 備考 |
|---|---|---|---|---|
| 鎌倉御厨 | 相模 | jisha | 小机城 | 伊勢神宮領 |
| 大庭御厨 | 相模 | jisha | 小田原城 | 大庭氏の本領。平氏方 |
| 三浦荘 | 相模 | buke | 小机城 | 三浦党 |
| 秩父牧 | 武蔵 | buke | 鉢形城 | 秩父党・軍馬 |
| 児玉荘 | 武蔵 | buke | 鉢形城 | 児玉党 |
| 相馬御厨 | 下総 | jisha | 関宿城 | 伊勢神宮領。千葉氏と争論 |
| 千葉荘 | 下総 | buke | 佐倉城 | 千葉常胤の本領 |
| 佐竹荘 | 常陸 | buke | 太田城 | 常陸源氏 |
| 那須荘 | 下野 | buke | 烏山城 | 那須与一 |
| 新田荘 | 上野 | buke | 新田金山城 | 新田氏 |
| 足利荘 | 下野 | buke | 唐沢山城 | 足利氏 |
| 一条荘 | 甲斐 | buke | 躑躅ヶ崎館 | 甲斐源氏 |
| 塩田荘 | 信濃 | sekkanke | 上原城 | |
| 蒲原荘 | 駿河 | kuge | 蒲原城 | 富士川の戦場に隣接 |
| 富士大宮 | 駿河 | jisha | 蒲原城 | 浅間社領 |
| 河合荘 | 越前 | jisha | 一乗谷城 | 平泉寺領 |
| 倉月荘 | 加賀 | sekkanke | 尾山御坊 | |
| 白山宮領 | 加賀 | jisha | 大聖寺城 | 僧兵 |
| 平等院領 | 山城 | sekkanke | 二条御所 | 以仁王・頼政の最期 |
| 鳥羽殿領 | 山城 | kuge | 勝龍寺城 | 後白河の御所 |
| 石清水八幡宮領 | 山城 | jisha | 勝龍寺城 | 源氏の氏神 |
| 春日社領 | 大和 | jisha | 多聞山城 | 興福寺と一体 |
| 黒田荘 | 大和 | jisha | 多聞山城 | 東大寺領 |
| 大山荘 | 丹波 | jisha | 八上城 | 興福寺領 |
| 高野山領 | 紀伊 | jisha | 新宮城 | |
| 熊野三山領 | 紀伊 | jisha | 新宮城 | 熊野水軍の基盤 |
| 大田荘 | 備後 | jisha | 神辺城 | 高野山領 |
| 厳島社領 | 安芸 | jisha | 吉田郡山城 | **平氏の信仰の中心** |
| 弓削島荘 | 伊予 | jisha | 川之江城 | 東寺領・塩 |
| 麻植荘 | 阿波 | buke | 勝瑞城 | 阿波民部の基盤 |
| 屋島荘 | 讃岐 | jisha | 十河城 | 屋島の戦場 |
| 神埼荘 | 肥前 | buke | 佐賀城 | **平氏領・日宋貿易の拠点** |
| 宇佐宮領 | 豊前 | jisha | 城井谷城 | |
| 緒方荘 | 豊後 | buke | 府内館 | 緒方惟栄 |
| 阿蘇社領 | 肥後 | jisha | 岩尾城 | |
| 島津荘 | 日向 | sekkanke | 佐土原城 | **日本最大の荘園**・近衛家領 |
| 平泉領 | 陸奥 | buke | 高水寺城 | 奥州藤原氏の中枢 |
| 気仙荘 | 陸奥 | buke | 寺池城 | 産金 |
| 白河荘 | 陸奥 | buke | 白河城 | 奥州の南門 |
| 遊佐荘 | 出羽 | buke | 大宝寺城 | |

### 2.3 館・城郭（25）

`scale` は収容兵力の上限。攻城戦（基本設計 4.10）の舞台になる。

| 館・城郭 | 国 | アンカー | scale | 備考 |
|---|---|---|---|---|
| 鎌倉大倉御所 | 相模 | 小机城 | 3000 | 頼朝の本拠 |
| 衣笠城 | 相模 | 小机城 | 800 | 三浦義明の最期 |
| 石橋山 | 相模 | 小田原城 | 400 | 頼朝の初戦・敗走 |
| 大庭館 | 相模 | 小田原城 | 900 | 平氏方 |
| 山木館 | 伊豆 | 伊豆韮山城 | 300 | **頼朝挙兵の最初の標的** |
| 北条館 | 伊豆 | 伊豆韮山城 | 500 | 北条時政 |
| 千葉館 | 下総 | 佐倉城 | 1200 | |
| 上総一宮館 | 上総 | 真里谷城 | 2000 | 上総広常 |
| 金砂城 | 常陸 | 太田城 | 1000 | 佐竹征伐 |
| 新田館 | 上野 | 新田金山城 | 800 | |
| 武田館 | 甲斐 | 躑躅ヶ崎館 | 1500 | 甲斐源氏 |
| 依田城 | 信濃 | 上原城 | 700 | **義仲挙兵の地** |
| 木曽館 | 信濃 | 木曽福島城 | 600 | 中原兼遠のもと |
| 城氏館 | 越後 | 春日山城 | 1200 | 越後平氏 |
| 倶利伽羅陣 | 越中 | 富山城 | 1000 | **火牛の計** |
| 六波羅館 | 山城 | 二条御所 | 4000 | **平氏の本拠** |
| 宇治平等院 | 山城 | 二条御所 | 600 | 頼政の最期／宇治川 |
| 法住寺殿 | 山城 | 二条御所 | 800 | 法住寺合戦 |
| 福原京 | 摂津 | 有岡城 | 3500 | 清盛の遷都先 |
| 一ノ谷城郭 | 摂津 | 有岡城 | 2500 | **鵯越の逆落とし** |
| 屋島陣 | 讃岐 | 十河城 | 2000 | 那須与一の扇 |
| 彦島 | 長門 | 櫛崎城 | 1800 | 壇ノ浦直前の平氏本営 |
| 太宰府 | 筑前 | 立花山城 | 1500 | 都落ち後の一時拠点 |
| 柳之御所 | 陸奥 | 高水寺城 | 3000 | 平泉・奥州藤原氏 |
| 衣川館 | 陸奥 | 花巻城 | 400 | **義経の最期** |

### 2.4 湊（16）

`scale` は船数。**湊を1つも持たない勢力は海を越えられない**（基本設計 4.11）。

| 湊 | 国 | アンカー | scale | 帰属水軍 |
|---|---|---|---|---|
| 渡辺津 | 摂津 | 石山御坊 | 40 | — |
| 大輪田泊 | 摂津 | 有岡城 | 60 | 平氏（日宋貿易）|
| 淀津 | 山城 | 勝龍寺城 | 25 | — |
| 熱田湊 | 尾張 | 鳴海城 | 30 | — |
| 桑名湊 | 伊勢 | 長島城 | 25 | 伊勢平氏 |
| 品川湊 | 武蔵 | 江戸城 | 20 | — |
| 三浦湊 | 相模 | 小机城 | 30 | 三浦党 |
| 直江津 | 越後 | 春日山城 | 20 | — |
| 敦賀津 | 越前 | 金ケ崎城 | 30 | — |
| 三国湊 | 越前 | 一乗谷城 | 25 | — |
| 新宮湊 | 紀伊 | 新宮城 | 45 | **熊野水軍（湛増）** |
| 撫養湊 | 阿波 | 勝瑞城 | 50 | **阿波水軍（田口成良）** |
| 屋島湊 | 讃岐 | 十河城 | 35 | 平氏 |
| 三津浜 | 伊予 | 湯築城 | 45 | **河野水軍（河野通信）** |
| 牛窓 | 備前 | 岡山城 | 25 | — |
| 博多津 | 筑前 | 立花山城 | 40 | **松浦党** |

> **壇ノ浦の勝敗は熊野・河野・阿波の3水軍の去就で決まる。** この3つを重点的に演出する。

---

## 3. 定数テーブル（実装時の最終値）

基本設計 第4節の係数をコード定数として一箇所に集約する。**マジックナンバーを式に直書きしない。**

```js
const RULE = {
  meibun:{ chotekiPenalty:400, reputationDecay:0.05, kakakuMul:2, max:1000 },
  rep:{ seizeJisha:-25, pillage:-60, donateJisha:15, donateCourt:20,
        greatVictory:30, purge:-40, bloodlessOpen:10 },
  court:{ donate:12, kinaiKokuga:0.5, holdIn:2.0, pillage:-25, decay:0.03 },
  open:{ kakakuMul:3, bandMul:4, garrisonDiv:100, jitter:0.15, retryTurns:3 },
  choteki:{ needInfluence:60, costGold:200, cooldown:12, duration:24, maxPerScenario:2 },
  hoko:{ base:1.0, debtMul:8, chotekiAdd:3.0, homeLostAdd:2.5, andoSub:1.0,
         meibunSub:1.5, defectBelow:20, defectDiv:40,
         andoCost:15, andoGain:12, shinonGain:35, shinonShare:0.30 },
  debt:{ perTurn:0.02, victory:0.5, capture:1.0, onJoin:0.3 },
  recruit:{ meibunDiv:10, kakakuMul:4, sameProvince:25, adjacent:10,
            giftDiv:20, giftCap:25, threshold:60, jitter:0.2, joinHoko:45 },
  econ:{ foodPerTroop:0.01, marchMul:2, taxRate:0.05, levyMul:8,
         harvest:{autumn:1.0, winter:0.05, spring:0.15, summer:0.15},
         snowPenalty:0.40, starveHoko:-3, starveTroop:-0.05 },
  famine:{ from:{y:1181,m:6}, to:{y:1182,m:12},
           coef:{ saikoku:0.70, kinai:0.60, tokai:0.40, bando:0.30, ou:0.15 } },
  battle:{ sotsuBase:0.7, sotsuDiv:200, jitter:0.3,
           kishaRange:{1:0.35, 2:1.0, 3:0.85},
           tateReduce:0.40,
           moraleHitMul:40, moraleLordDeath:-35, moraleDuelWin:18,
           breakBelow:25, breakDiv:50, routBelow:10 },
  duel:{ base:0.35, tachiDiv:200, kakakuDiv:300, weakSub:0.15,
         maxPerBattle:3, rounds:[3,5], deathRate:0.40, injureTurns:3, injurePenalty:0.30,
         refusedMoraleGain:8 },
  siege:{ defBonus:0.25, maxTurns:10, starveMorale:-10 },
  naval:{ tidePeriod:4, withTideMove:2, withTideRange:1, againstTideMove:-1,
          crossFailBase:0.05, crossWinterAdd:0.25, crossShipDiv:50, crossLoss:0.10,
          defectMax:0.25, defectMeibunDiv:1500, defectWeakMul:0.10 },
};
```

---

## 4. 関数仕様表（Rule 層）

**すべて純粋関数**。`state` を変更せず、変更内容（patch）を返す。副作用は Scene 側が適用する。
これにより `verify-genpei-balance.mjs` が UI を介さず Rule 層だけを回せる。

### 4.1 名分

| 関数 | 引数 → 戻り値 | 内容 |
|---|---|---|
| `calcMeibun(state, fid)` | → `number` | 基本設計 4.1 の式。0..1000 にクランプ |
| `meibunBreakdown(state, fid)` | → `{authority, kakaku, reputation, choteki, total}` | 名分パネルの内訳表示用（Could C-03）|
| `canOpenBloodless(state, fid, kyotenId)` | → `{ok:boolean, atk:number, def:number, p:number}` | 国衙以外は常に `ok:false` |
| `tryBloodlessOpen(state, fid, kyotenId, rng)` | → `patch` | 成功で `owner` 変更＋`reputation +10`。失敗で `retryUntil` を設定 |
| `canDeclareChoteki(state, fid, targetId)` | → `{ok, reason, p}` | 前提（院影響力60・金200・クールダウン）を検査 |
| `declareChoteki(state, fid, targetId, rng)` | → `patch` | 成立で `choteki:true, chotekiUntil:turn+24` |
| `tickCourtInfluence(state)` | → `patch` | 献納・国衙保持・院の身柄・減衰 |

### 4.2 御恩と奉公

| 関数 | 引数 → 戻り値 | 内容 |
|---|---|---|
| `hokoDecay(state, bandId)` | → `number` | 基本設計 4.4 の decay。**デバッグ用に内訳も返せるようにする** |
| `tickHoko(state, rng)` | → `patch` | 全団の奉公度更新＋離反判定 |
| `grantAndo(state, fid, bandId)` | → `patch` | 本領安堵。名分 −15 |
| `grantShinon(state, fid, bandId, kyotenId)` | → `patch` | 新恩給与。`debt=0`、以後収入の30%が団へ |
| `purgeBand(state, fid, bandId)` | → `patch` | 粛清。`reputation −40`、他団 `hoko −5` |
| `accrueDebt(state, event)` | → `patch` | 参陣・勝利・占領で債務を加算 |
| `recruitChance(state, fid, bandId, gift)` | → `{p, breakdown}` | 基本設計 4.5 |
| `tryRecruit(state, fid, bandId, gift, rng)` | → `patch` | 成功で `faction=fid, hoko=45, debt=troops*0.3` |

### 4.3 経済

| 関数 | 引数 → 戻り値 | 内容 |
|---|---|---|
| `seasonOf(month)` | → `'spring'|'summer'|'autumn'|'winter'` | 8〜10月＝autumn |
| `famineCoef(state, provinceId)` | → `number` | 期間外は0 |
| `tickEconomy(state)` | → `patch` | 収穫・消費・税収を一括計算 |
| `checkStarvation(state)` | → `patch` | 枯渇時の逃散・奉公度低下・**畿内駐留なら強制略奪** |
| `levyCap(state, fid)` | → `number` | 動員上限 |
| `moveCost(state, from, to, month)` | → `number` | 積雪ペナルティを含む |

### 4.4 合戦

| 関数 | 引数 → 戻り値 | 内容 |
|---|---|---|
| `initBattle(state, spec)` | → `battle` | `mode:'field'|'siege'|'naval'` でルール表を差し替える |
| `unitDamage(battle, atk, def, dist)` | → `number` | 兵種・地形・距離・統率の合成 |
| `applyMorale(battle, unitId, delta)` | → `patch` | 崩れ・退却の判定を含む |
| `canDuel(battle, atkGenId, defGenId)` | → `{ok, reason}` | 隣接・武将在席・3回未満・非負傷 |
| `duelAcceptChance(battle, a, d)` | → `number` | 基本設計 4.9 |
| `resolveDuel(battle, a, d, rng)` | → `{winner, loser, death, injureUntil}` | 3〜5合 |
| `tickTide(battle)` | → `patch` | 4ターンごとに反転（naval のみ）|
| `navalDefectChance(state, battle, suigunId)` | → `number` | 基本設計 4.11 |
| `canCrossSea(state, fid, fromKyoten, toKyoten, month)` | → `{ok, failRate}` | 湊・船数・季節 |

### 4.5 AI

| 関数 | 引数 → 戻り値 | 内容 |
|---|---|---|
| `aiActions(state, fid, rng)` | → `action[]` | 優先度スコア順（基本設計 第5節）。**飢饉中は出兵スコアを −999** |
| `aiScore(state, fid, action)` | → `number` | 性格別の重みを適用 |

---

## 5. `endTurn()` のシーケンス

順序を間違えると「飢饉なのに出兵できる」「離反した団が同ターンに参陣する」といった破綻が出る。
**この順序を固定する。**

```
1.  史実イベントの発火判定（年月トリガ）
2.  飢饉フラグの更新（famine.active）
3.  tickEconomy      … 収穫・消費・税収
4.  checkStarvation  … 逃散・強制略奪（reputation を先に動かす）
5.  tickCourtInfluence
6.  名分の再計算（calcMeibun：3〜5の結果を反映）
7.  tickHoko         … 奉公度の減衰・離反判定（6の名分を使う）
8.  朝敵の期限切れ判定（chotekiUntil）
9.  AI 各勢力の行動（aiActions → 適用）※飢饉中は出兵しない
10. 合戦の発生（pendingBattle をセットして BattleScene へ）
11. 勝敗条件の判定
12. 月を進める（month++ / year++）
13. オートセーブ
```

> **6を7より前に置くこと。** 名分は奉公度の減衰式に入るため、順序が逆だと1ターン遅れて効く。
> 朝敵になった直後のターンに離反が起きず、プレイヤーに因果が伝わらなくなる。

---

## 6. UI 文言表（日英併記・要件 M-47）

主要語彙のみ。詳細は実装時に追補する。

| 日本語 | English |
|---|---|
| 名分 | Legitimacy |
| 御恩と奉公 | Fief and Service |
| 本領安堵 | Confirm Holdings |
| 新恩給与 | Grant New Fief |
| 恩賞債務 | Unpaid Rewards |
| 奉公度 | Loyalty of Service |
| 朝敵 | Enemy of the Court |
| 無血開城 | Bloodless Surrender |
| 国府 | Provincial Seat |
| 荘園 | Estate |
| 館・城郭 | Residence / Stockade |
| 湊 | Harbor |
| 武士団 | Warrior Band |
| 令旨 | Prince's Edict |
| 院宣 | Cloistered Emperor's Decree |
| 宣旨 | Imperial Rescript |
| 三種の神器 | Three Sacred Treasures |
| 騎射 | Mounted Archery |
| 名乗り | Challenge by Name |
| 一騎討ち | Single Combat |
| 潮目 | Turn of the Tide |
| 兵糧 | Provisions |
| 養和の飢饉 | The Yōwa Famine |
| 人物列伝 | Chronicles |

---

## 7. エッジケース・エラー処理

| ケース | 扱い |
|---|---|
| 拠点の `owner` が消滅した勢力を指す | 中立に落とす。ターン開始時に一括で修復する |
| 武士団の本領が地図から消えた（データ不整合） | その団を中立化し、ログに警告を出す。**例外を投げない** |
| 当主が討死した | 一門の最上位（家格が最も高い生存武将）が自動継承。継承者がいなければ勢力消滅 |
| 全勢力が朝敵になった | 院が最も名分の高い勢力の朝敵を解除する（デッドロック回避）|
| 渡海先の湊が渡海中に敵の手に落ちた | 上陸失敗。兵力 −20% で出発地へ戻す |
| 一騎討ちの双方が負傷中 | `canDuel` が `false` を返す。UI はボタンを不活性にして理由を出す |
| セーブが非互換 | **理由を画面に表示**してから破棄する（黙って消さない）|
| CSV / JSON の fetch 失敗 | 埋め込みシードへ落ちる。**ログに「フォールバックを使用」と明示**する |
| 肖像アトラスが未ロード | プロシージャル肖像で描く。**白い箱を出さない** |

---

## 8. 実装順序表（★Code-Generator 必読）

**Phase 1 の完了時点で「1180シナリオを最後まで進行できる」こと**が最優先。
合戦は自動解決のままでよい。見た目より先に一周させる。

| 順 | 作業 | 成果物 | Phase |
|---|---|---|---|
| 1 | `verify-genpei-boot.mjs` を先に書く（空ページでも走る形で）| 検査スクリプト | 1 |
| 2 | `provinces.json` の再編（1.1）| データ | 1 |
| 3 | `gen-genpei-kyoten.mjs` と `kyoten_ichi.csv` 147行（1.3・第2節）| データ＋スクリプト | 1 |
| 4 | `verify-genpei-kyoten.mjs`（陸地判定・最短間隔・シード突合）| 検査スクリプト | 1 |
| 5 | Boot / Title / ScenarioSelect / Opening / FactionSelect | シーン | 1 |
| 6 | MapScene（カメラ・拠点描画・段階表示・パネル）| シーン | 1 |
| 7 | `turn` モジュールと `endTurn()` シーケンス（第5節）| ルール | 1 |
| 8 | AI 簡易版（出兵・防衛のみ）| ルール | 1 |
| 9 | セーブ／`file://` フォールバック | 基盤 | 1 |
| 10 | `meibun` モジュール（無血開城・朝敵認定）| ルール | 2 |
| 11 | `hoko` モジュール（安堵・新恩・債務・離反・勧誘）| ルール | 2 |
| 12 | `economy` モジュール（兵糧・季節・積雪）| ルール | 2 |
| 13 | AI 拡張（名分・恩賞運用）| ルール | 2 |
| 14 | `combat` ヘックス核＋ field ルール | ルール＋シーン | 3 |
| 15 | `duel`（名乗り・一騎討ち）| ルール＋演出 | 3 |
| 16 | siege ルール（柵・逆茂木・10ターン制限）| ルール | 3 |
| 17 | naval ルール（渡海・潮流・水軍離反）| ルール | 4 |
| 18 | 飢饉・史実イベント・神器 | ルール | 5 |
| 19 | 肖像・家紋・背景・イベント絵の実装組込 | アセット統合 | 5 |
| 20 | 人物列伝（前史人物を含む）| シーン | 5 |
| 21 | `verify-genpei-balance.mjs` で5試行の平均を取り係数を調整 | 検査＋調整 | 5 |

**分割の単位**: Phase 3・4 は規模が大きい。Code-Generator を分けるときは
**14〜16（陸戦）／17（海戦）** で切る。ヘックス核を共有するため、14 が終わってから 17 に入る。

---

## 9. 承認

- [ ] 深澤（PM）承認
- 次工程: Graphic-Designer へ制作要件（家紋20・肖像115・拠点グラフィック5〜8・合戦背景7・イベント絵10〜14）を引き渡し、
  並行して Code-Generator が実装順序表の 1〜4（検査スクリプトとデータ）から着手する
