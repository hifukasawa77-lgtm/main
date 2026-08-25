#!/usr/bin/env python3
"""
optimize-assets.py — 画像アセットを WebP へ再エンコードして軽量化する（全ゲーム共通）

背景: 本リポジトリのゲーム用アセットは写実CG・生成イラストを PNG/JPG で持っており、
解像度は概ね表示サイズ相応でも、可逆形式のぶん容量が数倍〜十数倍に膨らんでいた。
WebP へ変えるだけで解像度を落とさずに大幅に縮む（戦国風雲記で 660MB → 89MB / 7.4倍）。

安全上の要点:
  * **解像度は変えない**。source-rect を画素値で切り出している描画があると、縮小した瞬間に
    矩形が画像外へ出て無言で絵が消える（2026-08-02 の事故）。形式のみ変えれば矩形は有効なまま。
  * **アルファは必ず保つ**。RGBA を RGB で保存すると背景が白い箱になる。
  * **実行時に組み立てるパスは置換できない**。`'assets/x/' + id + '.png'` のような箇所は
    文字列リテラルではないため本スクリプトの置換から漏れる。該当しそうな行を検出して
    警告するので、手で直したうえで必ず `node scripts/verify-game-assets.mjs` を通すこと。

使い方:
    python3 scripts/optimize-assets.py --dir assets/black-fang --dry-run
    python3 scripts/optimize-assets.py --dir assets/black-fang
    python3 scripts/optimize-assets.py --dir assets/sanguo --quality 82
    python3 scripts/optimize-assets.py --dir assets/sengoku/gpt --only png   # JPEGは触らない
    python3 scripts/optimize-assets.py --dir assets --only png --no-recurse  # 直下だけ

除外すべきもの:
  * `assets/marketing/ig-*.jpg` — Instagram Graph API は JPEG しか受け付けない
  * `assets/og/*` — OGP画像。SNS側のWebP対応が不安定
  * `assets/maps/strategic-japan.png` — `scripts/verify-bakumatsu-map.mjs` がパスを直書きで参照
  いずれも `--only png` や対象ディレクトリの選び方で避けること。
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
CONVERTIBLE = {".png", ".jpg", ".jpeg"}
CODE_EXT = {".html", ".js", ".mjs", ".cjs", ".json", ".css"}
SKIP_DIRS = {".git", "node_modules", ".edge-test-profile", "assets"}


def code_files():
    """参照を書き換える対象のコードファイル（assets配下のJSONも含む）。"""
    out = []
    for base, dirs, files in os.walk(ROOT):
        rel = os.path.relpath(base, ROOT)
        parts = rel.split(os.sep)
        if parts[0] in (".git", "node_modules", ".edge-test-profile"):
            continue
        for f in files:
            if os.path.splitext(f)[1].lower() in CODE_EXT:
                out.append(os.path.join(base, f))
    return out


def find_dynamic_refs(target_dir):
    """実行時に拡張子を連結しているパス組み立てを検出する（置換から漏れる箇所）。"""
    name = target_dir.rstrip("/").split("/")[-1]
    pat = re.compile(r"""(\+\s*['"]\.(?:png|jpe?g)['"]|\$\{[^}]*\}[^'"`]*\.(?:png|jpe?g))""")
    hits = []
    for f in code_files():
        if os.path.splitext(f)[1].lower() not in {".html", ".js", ".mjs", ".cjs"}:
            continue
        try:
            text = open(f, encoding="utf-8", errors="ignore").read()
        except OSError:
            continue
        if name not in text and target_dir not in text:
            continue
        for i, line in enumerate(text.split("\n"), 1):
            if pat.search(line) and (".png" in line or ".jpg" in line or ".jpeg" in line):
                hits.append((os.path.relpath(f, ROOT), i, line.strip()[:150]))
    return hits


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True, help="変換対象ディレクトリ（例: assets/black-fang）")
    ap.add_argument("--quality", type=int, default=90)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--keep-original", action="store_true")
    ap.add_argument("--only", default="png,jpg,jpeg",
                    help="変換する拡張子（既定: png,jpg,jpeg）。"
                         "OGP画像やInstagram用JPEGを触りたくないときは --only png を使う")
    ap.add_argument("--no-recurse", action="store_true",
                    help="直下のファイルだけを対象にする（サブディレクトリへ降りない）")
    args = ap.parse_args()
    os.chdir(ROOT)
    target = args.dir.rstrip("/")
    if not os.path.isdir(target):
        sys.exit(f"ディレクトリが無い: {target}")

    wanted = {f".{e.strip().lstrip('.').lower()}" for e in args.only.split(",") if e.strip()}
    unknown = wanted - CONVERTIBLE
    if unknown:
        sys.exit(f"--only に変換できない拡張子: {', '.join(sorted(unknown))}")

    targets = []
    for base, dirs, files in os.walk(target):
        if args.no_recurse:
            dirs[:] = []
        for f in files:
            if os.path.splitext(f)[1].lower() in wanted:
                targets.append(os.path.join(base, f))
    targets.sort()
    print(f"対象: {target}  {len(targets)}枚")

    dyn = find_dynamic_refs(target)
    if dyn:
        print(f"\n[要手当] 実行時にパスを組み立てている箇所 {len(dyn)}件 — 置換されないので手で直すこと:")
        for f, i, line in dyn:
            print(f"   {f}:{i}  {line}")
        print()

    before = after = 0
    converted = {}
    for src in targets:
        sz0 = os.path.getsize(src)
        before += sz0
        dst = os.path.splitext(src)[0] + ".webp"
        if args.dry_run:
            after += sz0
            continue
        if os.path.exists(dst):     # 同名 webp が既にある場合は触らない
            after += sz0
            continue
        im = Image.open(src)
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGBA" if (im.mode == "P" and "transparency" in im.info) or "A" in im.getbands() else "RGB")
        im.save(dst, "WEBP", quality=args.quality, method=6)
        sz1 = os.path.getsize(dst)
        if sz1 >= sz0:              # 縮まないなら元のまま使う
            os.remove(dst)
            after += sz0
            continue
        after += sz1
        converted[src] = dst

    print(f"変換前: {before/1048576:8.1f}MB")
    print(f"変換後: {after/1048576:8.1f}MB  ({before/max(after,1):.1f}倍)")
    if args.dry_run:
        print("\n--dry-run のため書き換え・削除なし")
        return
    if not converted:
        print("変換対象なし")
        return

    changed = 0
    for f in code_files():
        try:
            text = open(f, encoding="utf-8").read()
        except (OSError, UnicodeDecodeError):
            continue
        orig = text
        for src, dst in converted.items():
            if src in text:
                text = text.replace(src, dst)
        if text != orig:
            open(f, "w", encoding="utf-8").write(text)
            changed += 1
            print(f"参照を書き換え: {os.path.relpath(f, ROOT)}")
    if not changed:
        print("[注意] 参照を書き換えたファイルが1つも無い。実行時組み立てのみの可能性が高い")

    # 置換もれの検出。パスを `ASSET_ROOT + 'gpt/foo.png'` のように分割して書いている箇所は
    # フルパス一致では拾えない。変換したファイル名（basename）がコード中に旧拡張子のまま
    # 残っていないかを見ることで、この型を確実に捕まえる。
    leftovers = []
    basenames = {os.path.basename(s): s for s in converted}
    for f in code_files():
        try:
            text = open(f, encoding="utf-8").read()
        except (OSError, UnicodeDecodeError):
            continue
        for bn, src in basenames.items():
            if bn in text:
                leftovers.append((os.path.relpath(f, ROOT), bn))
    if leftovers:
        print(f"\n[要手当] 旧拡張子のまま残っている参照 {len(leftovers)}件（パスを分割して書いている箇所）:")
        for f, bn in leftovers[:30]:
            print(f"   {f}: {bn}")
        if len(leftovers) > 30:
            print(f"   … 他 {len(leftovers)-30}件")

    if not args.keep_original:
        for src in converted:
            os.remove(src)
        print(f"元ファイルを削除: {len(converted)}枚（git履歴から復元可能）")
    print("\n次に必ず: node scripts/verify-game-assets.mjs <対象のHTML>")


if __name__ == "__main__":
    main()
