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
