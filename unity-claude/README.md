# Claude AI Unity Assistant

Unityに日本語でプロンプトを入力するだけで、C#スクリプトを自動生成するEditor拡張です。

## セットアップ（3ステップ）

### Step 1: APIキーを取得（無料）
1. [Google AI Studio](https://aistudio.google.com/) にアクセス
2. 「Get API key」→「Create API key」
3. 生成されたキー（`AIza...`）をコピー

### Step 2: スクリプトをUnityに配置
```
{あなたのUnityプロジェクト}/
  Assets/
    Editor/              ← このフォルダを作成
      ClaudeAssistant.cs ← ここに配置
```

`Editor` フォルダがない場合は作成してください。

### Step 3: Unityで使う
1. Unityを起動（または再起動）
2. メニューバー「**Tools > 🤖 Claude AI Assistant**」を開く
3. Step 1で取得したAPIキーを入力
4. 作りたいものを日本語で入力して「スクリプトを生成」

---

## 使用例

| 入力 | 生成されるスクリプト |
|------|---------------------|
| WASDで動く3Dプレイヤー | `PlayerController.cs` |
| 弾を一定間隔で発射する敵 | `EnemyShooter.cs` |
| スコアとHPを管理するゲームマネージャー | `GameManager.cs` |
| アイテムに触れると取得するシステム | `ItemPickup.cs` |
| カメラがプレイヤーを追従する | `CameraFollow.cs` |

---

## 生成ファイルの場所

`Assets/Scripts/Generated/{クラス名}.cs`

生成後はProjectウィンドウでファイルが自動ハイライトされます。

---

## 注意事項

- APIキーはUnityのEditorPrefsに保存されます（プロジェクト外）
- Gemini 1.5 Flash の無料枠: 15 RPM / 100万トークン/日
- 複雑なゲームロジックは複数回に分けて生成することをお勧めします

## 必要環境

- Unity 2021.3 LTS 以降
- インターネット接続（API呼び出しのため）
