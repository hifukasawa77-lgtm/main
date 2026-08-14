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

アンシャープは既定で切ってある（2026-08-07）
--------------------------------------------
初版は radius=1.0 / percent=80 のアンシャープを焼いていたが、拡大率200%以上で
「地図にノイズが入る」（深澤報告）。原因はアンシャープのリンギングで、
海岸線に黒縁・白縁、森の縁に硬い黒枠、海面のさざ波テクスチャに白い粒が出る。
2倍解像度の上に載った1px幅のハローが、画面では5〜9px幅の帯に引き伸ばされる。

ここは「ハローが目視で分かるかどうか」ではなく、**画面に出た時点で何倍に
引き伸ばされるか**で判断する。原画を200%で約10.5倍、325%で約17倍に拡大する
本作では、2倍解像度に対するどんな弱さのアンシャープも画面上では拡大される。
Lanczos拡大そのものが元画像より十分シャープなので、アンシャープ無しでも
従来（ブラウザ側 bicubic プリスケール）よりはっきり精細になる。

無劣化Lanczos2xからの乖離（＝拡大時に見えるのは全て人工物）RMS:
  旧 r1.0/80/t2 q86 → 3.56 ／ アンシャープ無し q86 → 2.27 ／ 同 q92 → 1.66

品質は q92。q86 だとWebPのブロックが平坦な海面で目に付き（同じく拡大される）、
q95 は 1MB を超えて release-check の新規1MB超検査に触れる。

`--unsharp` を明示した場合のみ掛かる。上げるときは必ず 200% と 325% の
実画面スクリーンショットで海岸線の縁と海面の粒を確認すること。

使い方: python3 scripts/build-map-detail.py [--quality 92] [--unsharp 0]
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
UNSHARP_RADIUS = 1.0    # --unsharp を指定したときの半径（2倍解像度に対する画素）
UNSHARP_THRESHOLD = 3


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--quality', type=int, default=92, help='WebP 品質（既定92）')
    ap.add_argument('--unsharp', type=int, default=0,
                    help='アンシャープ強度％（既定0＝無効。拡大でリンギングが見えるため通常は掛けない）')
    args = ap.parse_args()

    if not os.path.exists(SRC):
        sys.exit(f'元画像が見つかりません: {SRC}')

    src = Image.open(SRC).convert('RGB')
    iw, ih = src.size
    out = src.resize((iw * SCALE, ih * SCALE), Image.LANCZOS)
    if args.unsharp > 0:
        out = out.filter(ImageFilter.UnsharpMask(
            radius=UNSHARP_RADIUS, percent=args.unsharp, threshold=UNSHARP_THRESHOLD))
    out.save(DST, 'WEBP', quality=args.quality, method=6)

    sharpen = f'r{UNSHARP_RADIUS}/{args.unsharp}%' if args.unsharp > 0 else '無し'
    print(f'元画像   : {iw}x{ih}  {os.path.getsize(SRC) // 1024} KB')
    print(f'高精細版 : {out.size[0]}x{out.size[1]}  {os.path.getsize(DST) // 1024} KB  q{args.quality}  アンシャープ{sharpen}')
    print(f'書き出し : {os.path.relpath(DST, ROOT)}')


if __name__ == '__main__':
    main()
