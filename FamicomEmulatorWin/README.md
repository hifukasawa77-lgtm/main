# Famicom Emulator Lab for Windows

ファミコン/NES とディスクシステム対応を目指す Windows デスクトップ版プロトタイプです。

## 概要

- .NET 8 + WPF のネイティブ Windows アプリです。
- `.nes` / `.fds` ファイルをローカルで読み込み、iNES / NES 2.0 / FDS のヘッダー情報を解析します。
- 6502 CPU ミニコアの Step / Run デモ、256×240 PPU プレビュー、FDS 対応ロードマップを搭載しています。
- 市販ゲームの ROM や FDS BIOS は同梱しません。自作 ROM または権利を持つ正規バックアップを読み込む設計です。

## 実行方法

```powershell
dotnet run --project FamicomEmulatorWin/FamicomEmulatorWin.csproj
```

## 配布ビルド例

```powershell
dotnet publish FamicomEmulatorWin/FamicomEmulatorWin.csproj -c Release -r win-x64 --self-contained true /p:PublishSingleFile=true
```

## 次の実装候補

1. 6502 全命令・アドレッシングモード・NMI/IRQ/DMA
2. CPU/PPU/APU バスと NROM 起動
3. PPU scanline レンダリング、スプライト0ヒット、スクロール
4. APU AudioWorklet 相当の Windows 音声出力
5. FDS BIOS 読込、2C33 レジスタ、IRQ タイマ、ディスク面切替、FDS 音源
6. テスト ROM による互換性検証とセーブステート
