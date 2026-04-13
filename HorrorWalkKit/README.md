# HorrorWalkKit（Unity 3D / 探索ホラー散歩）

このフォルダは「5分で終わる探索ホラー散歩」の最小実装キットです。Unityプロジェクト自体は同梱していないので、Unity Hubで新規プロジェクトを作ってから `Assets/` 配下に取り込みます。

## 使い方（最短）

1. Unity Hubで **3D（Core）** の新規プロジェクトを作成（Built-in Render Pipeline想定）
2. 作成したUnityプロジェクトの `Assets/` 配下に、このリポジトリの `HorrorWalkKit/Assets/HorrorWalk` を丸ごとコピー
3. Unityを開き、メニューから `Tools > Horror Walk > Build Demo Scenes` を実行
4. `File > Build Settings...` を開き、以下3シーンを **この順番で** 追加
   - `Assets/HorrorWalk/Scenes/Title.unity`
   - `Assets/HorrorWalk/Scenes/House.unity`
   - `Assets/HorrorWalk/Scenes/Result.unity`
5. `Title` シーンを開いて Play

## ゲーム内容（MVP）

- 一人称で廃屋を探索し、`鍵×3` を集めて出口ドアから脱出
- 暗さ＋足音＋ライトのちらつき＋一瞬の出現で怖さを作る
- イベントで恐怖値が上がり、上限に達するとゲームオーバー

## 変更したくなったら

- 鍵の必要数: `GameManager.keysRequired`
- 恐怖の上限: `GameManager.fearMax`
- 移動速度: `PlayerController.walkSpeed/runSpeed`

