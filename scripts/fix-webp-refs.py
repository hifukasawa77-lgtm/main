#!/usr/bin/env python3
"""
fix-webp-refs.py — WebP化で置き換わったアセットの「旧拡張子のまま残った参照」を直す

背景: 参照は必ずしもフルパスで書かれていない。`ASSET_ROOT + 'gpt/foo.png'` のように
定数と連結していたり、`{file:'actors/hero.png'}` のようにディレクトリ相対だったりする。
フルパス一致の置換ではこれらが漏れ、読み込みが静かに失敗する（404はJS例外にならない）。

方針: 変換済み（webpがあり旧ファイルが無い）アセットについて、パスの後方一致で
**長い形から順に**置換する。裸のファイル名だけの一致は、同名のPNG/JPGがまだ他所に
残っている場合のみ危険なので、その場合はスキップして報告する（誤爆防止）。

使い方:
    python3 scripts/fix-webp-refs.py --dry-run
    python3 scripts/fix-webp-refs.py
"""
import argparse
import re
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CODE_EXT = {".html", ".js", ".mjs", ".cjs", ".json", ".css"}
# 対象外: アセット生成スクリプト（出力ファイル名まで書き換わると PNG のバイト列を
# .webp という名前で書き出す壊れ方をする）と、実アセットを指さない docs/例示コード。
EXCLUDE = ("scripts/process_", "gamekit/gamekit.js", "scripts/optimize-assets.py")
OLD_EXT = (".png", ".jpg", ".jpeg")


def code_files():
    out = []
    for base, dirs, files in os.walk(ROOT):
        parts = os.path.relpath(base, ROOT).split(os.sep)
        if parts[0] in (".git", "node_modules", ".edge-test-profile"):
            continue
        for f in files:
            if os.path.splitext(f)[1].lower() not in CODE_EXT:
                continue
            p = os.path.relpath(os.path.join(base, f), ROOT).replace(os.sep, "/")
            if p.startswith(EXCLUDE):
                continue
            out.append(os.path.join(base, f))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    os.chdir(ROOT)

    # まだ存在する PNG/JPG のファイル名（ここに含まれる名前は裸一致の置換をしない）
    protected = set()
    webps = []
    for base, _, files in os.walk("assets"):
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext in OLD_EXT:
                protected.add(f)
            elif ext == ".webp":
                webps.append(os.path.join(base, f))

    # 変換済み＝webpがあり、同名の旧ファイルが消えているもの
    converted = []
    for w in webps:
        stem = w[:-5]
        if not any(os.path.exists(stem + e) for e in OLD_EXT):
            converted.append(w)
    print(f"変換済みアセット: {len(converted)}枚 / まだ残るPNG・JPG名: {len(protected)}種")

    # 後方一致はディレクトリを跨いで衝突する。`assets/A/icons/x.webp` が変換済みでも、
    # 未変換の `assets/B/icons/x.png` を参照している箇所まで `icons/x.png` の一致で
    # 書き換えてしまい、実在しないパスを指す 404 になる（2026-08-02 に実際に13件出した）。
    # そこで「その後方一致が、まだ残っている旧ファイルにも当たりうるか」を先に調べ、
    # 曖昧な後方一致は使わない。
    ambiguous = set()
    remaining = []
    for base, _, files in os.walk("assets"):
        for f in files:
            if os.path.splitext(f)[1].lower() in OLD_EXT:
                remaining.append(os.path.join(base, f))
    for r in remaining:
        parts = r.split(os.sep)
        for i in range(len(parts)):
            ambiguous.add(os.sep.join(parts[i:]))

    # 候補（後方一致の各形 × 旧拡張子）を先に1つの表へまとめ、正規表現も1本に束ねる。
    # ファイル×候補で毎回コンパイルすると候補が数千件になり実用的な速度で終わらない。
    repl = {}
    skipped_cands = set()
    for w in converted:
        rel = w[:-5]
        parts = rel.split(os.sep)
        for old_ext in OLD_EXT:
            for i in range(len(parts)):
                cand = os.sep.join(parts[i:]) + old_ext
                if cand in ambiguous:
                    skipped_cands.add(cand)
                    continue
                repl.setdefault(cand, os.sep.join(parts[i:]) + ".webp")
    # 長い候補を先に当てる（`a/b/c.png` を `c.png` より優先）
    keys = sorted(repl, key=len, reverse=True)
    # 素の部分文字列一致は誤爆する。`hero.jpg` が `misato-hero.jpg` の一部に当たって
    # 別ゲームの参照を壊した（2026-08-02）。直前がパス構成文字でないことを必ず要求する。
    big = re.compile(r"(?<![A-Za-z0-9_\-.])(" + "|".join(re.escape(k) for k in keys) + r")")

    changes = {}
    skipped = []
    for f in code_files():
        try:
            text = open(f, encoding="utf-8").read()
        except (OSError, UnicodeDecodeError):
            continue
        new_text = big.sub(lambda m: repl[m.group(1)], text)
        for c in skipped_cands:
            if c in text:
                skipped.append((os.path.relpath(f, ROOT), c))
        if new_text != text:
            changes[f] = new_text

    for f, text in changes.items():
        print(f"  書き換え: {os.path.relpath(f, ROOT)}")
        if not args.dry_run:
            open(f, "w", encoding="utf-8").write(text)
    if skipped:
        print(f"\n[要確認] 同名のPNG/JPGが他に残るため裸一致を見送った参照 {len(skipped)}件:")
        for f, c in skipped[:20]:
            print(f"   {f}: {c}")
    print(f"\n{'(dry-run) ' if args.dry_run else ''}書き換えたファイル: {len(changes)}件")
    print("次に必ず: node scripts/verify-game-assets.mjs")


if __name__ == "__main__":
    main()
