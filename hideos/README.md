# hideOS — 自作Linuxディストリビューション / A Handmade Linux Distribution

```
  _     _     _       ___  ____
 | |__ (_) __| | ___ / _ \/ ___|
 | '_ \| |/ _` |/ _ \ | | \___ \
 | | | | | (_| |  __/ |_| |___) |
 |_| |_|_|\__,_|\___|\___/|____/   0.1 "Aoi"
```

Linuxカーネル v6.6 LTS と BusyBox 1.36.1 をソースからビルドして作った、
ゼロからの超ミニマルLinuxディストリビューション。QEMUで起動します。

A from-scratch minimal Linux distribution: the Linux 6.6 LTS kernel and a
statically-linked BusyBox userland, glued together by a hand-written
`/init`, bootable in QEMU.

## 構成 / Architecture

| Component | What it is |
|---|---|
| `out/bzImage` | Linux 6.6 カーネル（`defconfig + kvm_guest.config`、バージョン文字列 `6.6.0-hideos`） |
| `out/initramfs.gz` | ユーザーランド全体。静的BusyBox 1本 + 全コマンドのsymlink + 自作 `/init` |
| `rootfs/init` | PID 1。proc/sys/devのマウント → ブート画面表示 → シェル起動（自作） |
| `rootfs/etc/` | `os-release` / `motd` / `profile`（シアン基調のブランディング） |

ブートの流れ / Boot flow:

```
QEMU (BIOS) → bzImage 起動 → initramfs 展開 → /init (PID 1)
            → proc/sys/devtmpfs マウント → MOTD表示 → BusyBox ash シェル
```

## ビルド / Build

```bash
# 依存パッケージ (Ubuntu/Debian)
sudo apt-get install -y build-essential flex bison libelf-dev libssl-dev bc cpio qemu-system-x86

./build.sh   # ダウンロード → BusyBox → カーネル → initramfs 生成（4コアで30分前後）
```

ソースは kernel.org が遮断された環境でもビルドできるよう、GitHub公式ミラー
（`torvalds/linux`, `mirror/busybox`）から取得します。
中間生成物は `work/`、成果物は `out/` に出力されます（どちらもgit管理外）。

## 起動 / Run

```bash
./run.sh
```

シリアルコンソールに hideOS のブート画面が表示され、BusyBox ash シェルが起動します。
終了はゲスト内で `poweroff -f`、またはQEMUのエスケープ `Ctrl-A` → `X`。

## なぜ動くのか（学習メモ） / How it works

1. **カーネル**: `kvm_guest.config` はQEMU/KVMゲストに必要なドライバ（virtio, シリアル8250等）を有効にするconfigフラグメント。ディスクドライバ不要のinitramfs起動なので構成が最小で済む。
2. **initramfs**: カーネルがメモリ上に展開するcpioアーカイブ。ルートFSのマウントが不要になるため、ブートローダもディスクイメージも作らずに「ディストロ」が成立する。
3. **BusyBox**: `ls`/`sh`/`mount` など300以上のコマンドを1つの静的バイナリに同梱。libcの動的リンクが無いので、initramfsにバイナリを1個置くだけでユーザーランドが完成する。
4. **/init**: カーネルはinitramfs内の `/init` をPID 1として実行する。ここが「ディストロの個性」の入口で、hideOSではマウント処理とブランディング表示を行い、`cttyhack` でジョブ制御付きシェルを起動する。
