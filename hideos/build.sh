#!/bin/bash
# hideOS build script — Linuxカーネル + BusyBox からミニマルディストロを再現ビルドする
#
# Usage:   ./build.sh            # フルビルド（ダウンロード→ビルド→initramfs生成）
# Output:  out/bzImage           # hideOSカーネル
#          out/initramfs.gz     # hideOSユーザーランド（BusyBox + 自作init）
#
# 必要パッケージ (Ubuntu/Debian):
#   sudo apt-get install -y build-essential flex bison libelf-dev libssl-dev bc cpio
set -euo pipefail

KERNEL_VER=6.6
BUSYBOX_VER=1_36_1

HIDEOS_DIR="$(cd "$(dirname "$0")" && pwd)"
WORK="${HIDEOS_WORK:-$HIDEOS_DIR/work}"
OUT="$HIDEOS_DIR/out"
JOBS="$(nproc)"

mkdir -p "$WORK" "$OUT"

# --- ソース取得（kernel.org が使えない環境向けにGitHubミラーへフォールバック） ---
fetch() { # fetch <output> <url1> [url2...]
    local out="$1"; shift
    [ -f "$out" ] && return 0
    for url in "$@"; do
        echo ">> fetch $url"
        curl -fsSL --retry 3 -o "$out" "$url" && return 0
    done
    echo "!! failed to fetch $out" >&2; return 1
}

fetch "$WORK/linux.tar.gz" \
    "https://codeload.github.com/torvalds/linux/tar.gz/refs/tags/v$KERNEL_VER" \
    "https://cdn.kernel.org/pub/linux/kernel/v6.x/linux-$KERNEL_VER.tar.gz"

fetch "$WORK/busybox.tar.gz" \
    "https://codeload.github.com/mirror/busybox/tar.gz/refs/tags/$BUSYBOX_VER" \
    "https://busybox.net/downloads/busybox-${BUSYBOX_VER//_/.}.tar.bz2"

# --- BusyBox: 静的シングルバイナリをビルド ---
if [ ! -f "$WORK/busybox/busybox" ]; then
    echo ">> building BusyBox $BUSYBOX_VER"
    tar xzf "$WORK/busybox.tar.gz" -C "$WORK"
    rm -rf "$WORK/busybox" && mv "$WORK/busybox-$BUSYBOX_VER" "$WORK/busybox"
    cd "$WORK/busybox"
    make defconfig
    sed -i 's/^# CONFIG_STATIC is not set/CONFIG_STATIC=y/' .config
    # 新しいカーネルヘッダではCBQ削除によりtcがビルド不能のため無効化
    sed -i 's/^CONFIG_TC=y/# CONFIG_TC is not set/' .config
    make -j"$JOBS"
fi

# --- Linuxカーネル: QEMUゲスト向け設定でビルド ---
if [ ! -f "$WORK/linux/arch/x86/boot/bzImage" ]; then
    echo ">> building Linux $KERNEL_VER"
    tar xzf "$WORK/linux.tar.gz" -C "$WORK"
    rm -rf "$WORK/linux" && mv "$WORK/linux-$KERNEL_VER" "$WORK/linux"
    cd "$WORK/linux"
    make defconfig kvm_guest.config
    sed -i 's/^CONFIG_LOCALVERSION=.*/CONFIG_LOCALVERSION="-hideos"/' .config
    make olddefconfig
    make -j"$JOBS" bzImage
fi
cp "$WORK/linux/arch/x86/boot/bzImage" "$OUT/bzImage"

# --- initramfs: rootfs/ + BusyBox を cpio アーカイブに固める ---
echo ">> assembling initramfs"
ROOT="$WORK/initramfs"
rm -rf "$ROOT"
mkdir -p "$ROOT"/{bin,sbin,etc,proc,sys,dev,tmp,run,usr/bin,usr/sbin,root}

cp "$WORK/busybox/busybox" "$ROOT/bin/busybox"
for app in $("$ROOT/bin/busybox" --list); do
    ln -sf busybox "$ROOT/bin/$app"
done

cp -a "$HIDEOS_DIR/rootfs/." "$ROOT/"
chmod +x "$ROOT/init"

(cd "$ROOT" && find . -print0 | cpio --null -o --format=newc 2>/dev/null | gzip -9) > "$OUT/initramfs.gz"

echo ""
echo "== hideOS build complete =="
ls -lh "$OUT"
echo ""
echo "起動: ./run.sh"
