# FRONTLINE ZERO（Unity 6 / WebGL）

オリジナルの陣取り型チームFPS。5つの拠点を奪い合い、チケット（持ち点）を先に0にされた側が負け。
素材・音・HUDはすべてコード生成（外部アセット無し）。Battlefield 等の既存IPは使っていない。

- ソース: `Assets/Scripts/`（`FrontlineGame.cs` が全体、`Soldier.cs` が兵士）
- 公開ビルド: リポジトリ直下の `frontline-zero/`（GitHub Pages から `…/frontline-zero/`）
- Unity 6000.6.3f1（Built-in RP・旧Input）

## ビルドし直す
```bash
"C:/Program Files/Unity/Hub/Editor/6000.6.3f1/Editor/Unity.exe" -batchmode -nographics -quit \
  -projectPath unity-frontline -logFile unity-build.log -buildTarget WebGL -executeMethod BuildScript.BuildWebGL
```
出力は `../frontline-zero/`。ビルド後は別ポートの静的サーバで開いて確認する（UnityCache が古い .data を返すため）。

## 落とし穴
- `PlayerSettings.stripEngineCode=false` が必須。物理(Collider)をコードからしか使わないので、削ると
  `Can't add component because class 'BoxCollider' doesn't exist!` で起動はするが何も当たらない。
- Standard / Unlit/Color / Sprites/Default は Always Included Shaders に入れる（実行時 `Shader.Find` は削られる）。
- 圧縮は Disabled（GitHub Pages が転送時に圧縮するため、Brotli/gzip ヘッダの問題を避ける）。

## 車両・テクスチャ（2026-10-21 追加）
- 軽戦車は各軍2両。1両目（青軍）はプレイヤー用に75秒基地で待つ。E で乗降、マウス/F で主砲（着弾点に範囲ダメージ）。AI戦車は拠点へ向かい敵を撃つ。撃破で −5チケット、30秒後に基地で復活。
- 質感は `Textures.cs` が実行時に生成（地面・迷彩・鋼板・コンクリ・土のう・木箱・布・クレーター・樹皮・焦げ）。外部画像なし。
- **`Mathf.SmoothStep(from,to,t)` は補間関数で、しきい値用の smoothstep ではない**。しきい値で使うと錆・泥の割合が常に高くなり、
  全部の金属が赤茶になる（例外もエラーも出ない）。`Textures.Sst` を使う。
- 確認用ブラウザペインは操作を送っていない間はゲーム時間が進まない（画面が止まって見えるが固まりではない）。

## 爆発・エフェクト（2026-10-21 追加）
- `Fx.cs`（膨らむ・飛ぶ・落ちる・色が変わる）と `FxLight.cs`（閃光・同時3つまで）を、`FrontlineGame.BigBoom` が組み合わせる。
  火球・白熱の芯・衝撃波（平たいリング）・黒煙・破片・火花・焦げ跡（最大40）・画面揺れ・白フラッシュ。
- 戦車撃破は誘爆2回＋砲塔の吹き飛び＋燃え続ける炎と煙。主砲は発砲炎・砲身の反動・砲弾の航跡。小銃は着弾の土ぼこりと火花。
- **見た目の確認**: URL に `?fxtest` を付けると、X キーで目の前に爆発を出せる（通常プレイでは無効）。
  戦闘の中で爆発を待っても、確認用ペインはゲーム時間がほとんど進まず捕まえられない。
- 色は `Unlit/Color` ＋ `MaterialPropertyBlock` で動かす（マテリアルは1つを共有）。`Standard` の Emission は
  シェーダーバリアントが削られて光らないので使わない。
