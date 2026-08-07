#!/usr/bin/env python3
"""戦国風雲記の日本地図から、高ズーム用の高精細版（2倍）を焼き出す。

背景
----
地図の原画は 1672x941 しかない。マップは拡大率100%の時点で既に元画像の約5.3倍、
200%で約10.5倍、325%では約17倍に引き伸ばされるため、高ズームでは必ずぼやける。

従来はブラウザ側で `buildSharpenedMap()` が毎起動 2倍プリスケールを焼いていたが、
ブラウザの補間（bicubic相当）は Lanczos より甘く、拡大時のにじみが残っていた。
本スクリプトは同じ2倍化をオフラインで Lanczos + 弱いアンシャープで行い、
`*-detail.webp` として書き出す。ゲーム側は `mapDetail` として後読みし、
届いた時点で背景描画のソースを差し替える（未着の間は従来のプリスケールで描く）。

強度について
------------
アンシャープを強くするほど数値上の鮮鋭度は上がるが、13倍まで引き伸ばす都合で
ハロー（輪郭の黒縁・白縁）も一緒に拡大され、森が「潰れた黒い塊」に見える。
実測比較の結果、radius=1.0 / percent=80（2倍解像度に対して＝表示上は半径0.5相当）が
ハローが目視で分からない範囲での上限だった。ここを上げるときは必ず高ズームの
スクリーンショットで輪郭を確認すること。

使い方: python3 scripts/build-map-detail.py [--quality 86]
"""
import argparse
import os
import sys

try:
    from PIL import Image, ImageFilter
except ImportError:
    sys.exit('Pillow が必要です: pip install Pillow')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/sengoku/gpt/sengoku-japan-map-user-v1.webp')
DST = os.path.join(ROOT, 'assets/sengoku/gpt/sengoku-japan-map-user-v1-detail.webp')

SCALE = 2               # sengoku.html の buildSharpenedMap と同じ倍率（配置計算は縦横比のみに依存）
UNSHARP_RADIUS = 1.0    # 2倍解像度に対する半径。表示上は元画像0.5px相当でハローが目立たない
UNSHARP_PERCENT = 80
UNSHARP_THRESHOLD = 2


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--quality', type=int, default=86, help='WebP 品質（既定86）')
    args = ap.parse_args()

    if not os.path.exists(SRC):
        sys.exit(f'元画像が見つかりません: {SRC}')

    src = Image.open(SRC).convert('RGB')
    iw, ih = src.size
    up = src.resize((iw * SCALE, ih * SCALE), Image.LANCZOS)
    out = up.filter(ImageFilter.UnsharpMask(
        radius=UNSHARP_RADIUS, percent=UNSHARP_PERCENT, threshold=UNSHARP_THRESHOLD))
    out.save(DST, 'WEBP', quality=args.quality, method=6)

    print(f'元画像   : {iw}x{ih}  {os.path.getsize(SRC) // 1024} KB')
    print(f'高精細版 : {out.size[0]}x{out.size[1]}  {os.path.getsize(DST) // 1024} KB  q{args.quality}')
    print(f'書き出し : {os.path.relpath(DST, ROOT)}')


if __name__ == '__main__':
    main()
