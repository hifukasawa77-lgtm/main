# Cドライブを空ける（170GB逼迫時の手順）

> **先に読む**: 消す前に「消したら戻らないもの」を確認します。順番を守れば安全です。

## 0. 絶対に先にやること — 失われる作業がないか確認

**ZERO-1 のクローンには、GitHub に無いファイルが残っています。**
このフォルダを消すと復元できません。

```powershell
cd <ZERO-1のフォルダ>
git status
```

`app/api/runtime/route.ts` と `public/images/` が未追跡で出るはずです。**先に push してください。**

```powershell
git add app/api/runtime public/images start-zero1.ps1
git commit -m "未コミットだった実行時ルートと画像を登録"
git push
```

他のフォルダも同様です。次のスクリプトが、リポジトリごとに未コミット・未pushを判定します。

## 1. 測る（何も削除しません）

```powershell
powershell -ExecutionPolicy Bypass -File scripts\disk-report.ps1
```

出力は3段階に色分けされます。

| 表示 | 意味 | 扱い |
|---|---|---|
| `[安全]` | キャッシュ・再取得できるもの | 上から消してよい |
| `[注意]` | AIモデル等。再取得に時間と通信量がかかる | 要否を自分で判断 |
| `[危険]` | 未コミット・未pushの作業が入っている | **push してから** |

フォルダを実測するため数分かかります。

## 2. 消す順番

### ① キャッシュ（やり直しが効く）

```powershell
npm cache clean --force
pip cache purge
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\Temp\*" -ErrorAction SilentlyContinue
```

`~\.cache\huggingface` は数十GBになることがあります。消しても必要時に再取得されます。

### ② node_modules（`npm install` で戻せる）

使っていないプロジェクトのものから消します。

```powershell
Remove-Item -Recurse -Force <プロジェクト>\node_modules
```

### ③ ローカルLLM（Ollama）

**ZERO-1 の 設定 → モデル管理・厳選** を開いてください。役割ごとの担当と削除候補、
実際に空く容量が表示されます。目標容量（10/20/40GB）を選ぶと、超過分を自動で削除候補にします。
**その役割を担当できるモデルが残らなくなる削除はしません。**

コマンドで見る場合:

```powershell
ollama list
ollama rm <モデル名>
```

派生モデル（`zero-1` `zero-1-geniac`）は土台の重みを共有しているため、**消しても容量はほとんど空きません**。
管理画面はそれを「実解放 —」と表示します。

### ④ 画像・音楽・動画生成のモデル ← 2026-08-26 時点で「不要」と判断済み

ComfyUI / Stable Diffusion / FLUX / ACE-Step / MusicGen のモデルは1つで数GB〜20GBあり、
**Ollama より大きいことがよくあります**。置き場所は導入方法で変わるので、まず探します。

```powershell
# 1. 探して容量を見る（削除しません）
powershell -ExecutionPolicy Bypass -File scriptsind-genai-models.ps1 -IncludeAudio

# 2. 一覧を確認してから削除（DELETE と入力する確認が入ります）
powershell -ExecutionPolicy Bypass -File scriptsind-genai-models.ps1 -IncludeAudio -Delete
```

`-IncludeAudio` を付けないと音楽生成（ACE-Step / MusicGen）は対象外です。
画像・動画と要否が別なので、既定では巻き込まない設計にしてあります。

**HuggingFace のダウンロードキャッシュ**もここに含まれます。丸ごと消して構いません
（キャッシュなので、必要になれば再取得されます）。

```powershell
# 中身を見てから
Get-ChildItem "$env:USERPROFILE\.cache\huggingface\hub" | Select-Object Name
# 丸ごと消す
Remove-Item -Recurse -Force "$env:USERPROFILE\.cache\huggingface"
```

**アプリ本体（ComfyUI / WebUI のフォルダごと）も不要なら消せます。** ただし
自分で書いたワークフローJSONや出力画像が中に残っていないか、先に確認してください。

#### 消したあと ZERO-1 はどうなるか

壊れません。`app/api/engines/route.ts` が接続確認をし、繋がらなければ画面に
**「エンジン未接続」**と出るだけです（生成成功を装いません）。生成ボタンも押せなくなります。

- 画像生成 → 「エンジン未接続」
- 音楽生成 → 「エンジン未接続」
- 動画生成 → もともと外部サイト（Hailuo / Kling）を開く方式なので**影響なし**

チャット・コード生成・文章要約・AIエージェントは Ollama だけを使うので、すべてそのまま動きます。

### ⑤ gitリポジトリ

**全て push 済みと確認できたものだけ**消します。必要になったら軽量クローンで取り直せます。

```powershell
git clone --depth 1 --filter=blob:none --sparse https://github.com/hifukasawa77-lgtm/main.git
cd main
git sparse-checkout set scripts docs gamekit .claude
```

1.3GB → 18MB です。詳細は `docs/クローンを軽くする.md`。

## 3. 消してはいけないもの

- `git status` で未コミットの変更が出るフォルダ（push が先）
- リモート未設定のリポジトリ（どこにも保存されていない）
- `AppData\Roaming`（設定の本体。`Local` のキャッシュとは別物）
- 中身の分からない大きいフォルダ（まず開いて確認する）

## 4. 参考: 170GB の内訳として起こりやすいもの

| 場所 | 目安 |
|---|---|
| 画像・動画生成モデル（ComfyUI / SD / FLUX）※不要と判断済み | 数十〜100GB |
| `~\.ollama\models` | 数十GB |
| `~\.cache\huggingface` | 数十GB |
| `node_modules` の集合 | 数GB |
| gitリポジトリ | 数GB |

**GitHub のクローンだけで170GBになることはありません**（対象2リポジトリは合計でも数GB以下）。
大半は生成AIのモデルとキャッシュである可能性が高いです。
