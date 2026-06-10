#!/bin/bash
# hideOS をQEMUで起動する（シリアルコンソール、ウィンドウ不要）
# 終了方法: ゲスト内で poweroff -f / QEMU自体は Ctrl-A → X
set -euo pipefail
HIDEOS_DIR="$(cd "$(dirname "$0")" && pwd)"

exec qemu-system-x86_64 \
    -kernel "$HIDEOS_DIR/out/bzImage" \
    -initrd "$HIDEOS_DIR/out/initramfs.gz" \
    -append "console=ttyS0 quiet" \
    -m 512M \
    -nographic \
    "$@"
