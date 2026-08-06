#!/usr/bin/env python3
"""
optimize-sengoku-assets.py — 戦国風雲記のアセットを WebP へ再エンコードして軽量化する

背景: アセットは写実CG（GPT Image 2 生成）を PNG（可逆）で持っていたため、
315枚で計638MB あった。解像度はすべて論理キャンバス(2560x1440)以下で過大ではなく、
肥大の主因は「写実的な絵を可逆形式で持っていること」だった。WebP へ変えるだけで
解像度を一切落とさずに約7倍（q90）縮む。

安全上の要点（2026-08-02 の事故を繰り返さないため）:
  * **解像度は変えない**。source-rect を画素値で切り出している描画があるため、
    縮小すると切り出しが画像外へ出て無言で絵が消える（sengoku.html の scaleSrcRect 参照）。
    形式だけ変えるこのスクリプトでは矩形はそのまま有効。
  * **アルファは必ず保つ**。RGBA の画像を RGB で保存すると背景が白い箱になる。
    q90 lossy でもアルファ分布は完全一致することを実測で確認済み。
  * 変換後は必ず `node scripts/verify-map-assets.mjs` で「実際に絵が描かれるか」を検査する。

使い方:
    python3 scripts/optimize-sengoku-assets.py --dry-run     # 変換内容の確認のみ
    python3 scripts/optimize-sengoku-assets.py               # 変換＋参照書き換え＋元ファイル削除
    python3 scripts/optimize-sengoku-assets.py --quality 82  # 画質を変える（既定 90）
    python3 scripts/optimize-sengoku-assets.py --keep-original  # 元PNGを残す

依存: Pillow（pip install pillow）
"""
import argparse
import os
import re
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow が必要です: pip install pillow")

Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSET_DIR = "assets/sengoku"
CONVERTIBLE = {".png", ".jpg", ".jpeg"}
# 参照を書き換える対象。ここに挙げ漏れると 404 になるので、追加時は必ず洗い直すこと。
REF_FILES = [
    "sengoku.html",
    "castle-layout-trace.html",
    "index.html",
    "scripts/trace-battlefield-hexes.mjs",
    "assets/sengoku/manifest.json",
    "assets/sengoku/castle_positions.json",
]


def collect_referenced():
    """参照されている画像パスを集める（未参照ファイルは変換対象外）。"""
    refs = set()
    pat = re.compile(r"assets/sengoku/[A-Za-z0-9_\-./]+\.(?:png|jpg|jpeg)")
    for rel in REF_FILES:
        p = os.path.join(ROOT, rel)
        if not os.path.exists(p):
            continue
        with open(p, encoding="utf-8", errors="ignore") as f:
            refs.update(pat.findall(f.read()))
    return refs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quality", type=int, default=90)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--keep-original", action="store_true")
    args = ap.parse_args()
    os.chdir(ROOT)

    refs = sorted(collect_referenced())
    # manifest.json のライセンス記載には、すでに削除された旧アセット名が残っている。
    # 実コード（sengoku.html 等）側の参照欠落は 404 を意味するので、こちらは区別して報告する。
    missing = [r for r in refs if not os.path.exists(r)]
    if missing:
        print(f"[注意] 参照先が存在しないパス {len(missing)}件（変換対象から除外）:")
        for m in missing:
            print("   -", m)
        print()
        refs = [r for r in refs if os.path.exists(r)]

    targets = [r for r in refs if os.path.splitext(r)[1].lower() in CONVERTIBLE]
    print(f"変換対象: {len(targets)}枚（参照されている画像のみ）\n")

    before = after = 0
    converted = {}
    for i, src in enumerate(targets, 1):
        dst = os.path.splitext(src)[0] + ".webp"
        sz0 = os.path.getsize(src)
        before += sz0
        if args.dry_run:
            after += sz0
            converted[src] = dst
            continue
        im = Image.open(src)
        # パレット画像などは RGBA/RGB へ正規化する（アルファの有無は保つ）
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGBA" if "A" in im.getbands() or im.mode == "P" else "RGB")
        im.save(dst, "WEBP", quality=args.quality, method=6)
        sz1 = os.path.getsize(dst)
        # 逆に大きくなる画像（すでに最適化済み等）は変換を破棄して元を使う
        if sz1 >= sz0:
            os.remove(dst)
            after += sz0
            continue
        after += sz1
        converted[src] = dst
        if i % 40 == 0:
            print(f"  ... {i}/{len(targets)}")

    print(f"\n{'変換前':>10s}: {before/1048576:8.1f}MB")
    print(f"{'変換後':>10s}: {after/1048576:8.1f}MB  ({before/max(after,1):.1f}倍の削減)")

    if args.dry_run:
        print("\n--dry-run のため書き換え・削除は行っていない")
        return

    # 参照の書き換え
    for rel in REF_FILES:
        p = os.path.join(ROOT, rel)
        if not os.path.exists(p):
            continue
        with open(p, encoding="utf-8") as f:
            text = f.read()
        orig = text
        for src, dst in converted.items():
            text = text.replace(src, dst)
        if text != orig:
            with open(p, "w", encoding="utf-8") as f:
                f.write(text)
            print(f"参照を書き換え: {rel}")

    if not args.keep_original:
        for src in converted:
            os.remove(src)
        print(f"元ファイルを削除: {len(converted)}枚（git履歴から復元可能）")

    print("\n次は必ず実行すること:")
    print("  node scripts/verify-map-assets.mjs")
    print("  node scripts/verify-sengoku-boot.mjs")


if __name__ == "__main__":
    main()
