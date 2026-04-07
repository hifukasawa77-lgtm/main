# SakuraLikeEditor

Windows 11対応の「サクラエディター風」を目指す、軽量なWPFテキストエディター（.NET 8）。

## できること（現状）

- タブで複数ファイルを編集
- 新規作成 / 開く / 保存 / 名前を付けて保存
- 行番号表示、折り返し（Word Wrap）
- 検索 / 置換（正規表現・履歴あり）
- 最近使ったファイル（Recent Files）
- ドラッグ＆ドロップでファイルを開く
- 行ジャンプ（Ctrl+G）
- ブックマーク（Ctrl+F2 でトグル / F2 次 / Shift+F2 前）
- ズーム（Ctrl+ / Ctrl- / Ctrl0）
- 文字コード表示・切替（UTF-8 / UTF-8 BOM / Shift-JIS(CP932) / EUC-JP(CP51932) / UTF-16 LE / UTF-32 LE）
- 改行コード（CRLF / LF / CR）を保持して保存
- 自動保存（編集中のバックアップを `%AppData%\\SakuraLikeEditor\\autosave` に作成）
- 保存時バックアップ（同フォルダの `.sakura-backup` に世代保存）

## 起動

```powershell
dotnet run --project SakuraLikeEditor/SakuraLikeEditor.csproj
```

## コマンドライン起動

```powershell
SakuraLikeEditor.exe --portable C:\path\to\file.txt
```

- `--portable`: 設定をアプリ直下の `SakuraLikeEditorData\` に保存（USB運用向け）
- `portable.mode`: `SakuraLikeEditor.exe` と同じフォルダにこの空ファイルを置くと常にポータブル扱い

## ビルド

```powershell
dotnet build SakuraLikeEditor/SakuraLikeEditor.csproj -c Release
```

## .EXE作成（配布用）

`publish.ps1` で `SakuraLikeEditor.exe` を作れます（既定: フレームワーク依存。配布先PCに .NET Desktop Runtime が必要）。

```powershell
powershell -ExecutionPolicy Bypass -File SakuraLikeEditor/publish.ps1
```

出力先:

- `SakuraLikeEditor/publish/framework-dependent/SakuraLikeEditor.exe`

自己完結（ランタイム同梱）にしたい場合（初回にランタイムパックの取得が必要）:

```powershell
powershell -ExecutionPolicy Bypass -File SakuraLikeEditor/publish.ps1 -SelfContained -SingleFile
```

出力先:

- `SakuraLikeEditor/publish/win-x64-selfcontained-singlefile/SakuraLikeEditor.exe`
