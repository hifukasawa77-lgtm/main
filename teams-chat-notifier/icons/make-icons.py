#!/usr/bin/env python3
"""拡張機能アイコン（吹き出し＋チェック）を生成する。

外部ライブラリ不使用（zlib/struct のみ）。図形は正規化座標[0,1]で定義し、
4x スーパーサンプリングで各サイズへラスタライズする。

    python3 teams-chat-notifier/icons/make-icons.py
"""

import math
import os
import struct
import zlib

SIZES = (16, 32, 48, 128)
SS = 4  # スーパーサンプリング倍率

# 吹き出し本体（角丸矩形）
BUBBLE = (0.06, 0.08, 0.94, 0.70, 0.18)
# 吹き出しの尻尾
TAIL = ((0.26, 0.66), (0.30, 0.95), (0.52, 0.66))
# チェックマークの折れ線と線幅（半分）
CHECK = ((0.28, 0.40), (0.43, 0.54), (0.72, 0.24))
CHECK_HALF_W = 0.055

GRAD_FROM = (34, 211, 238)   # #22d3ee シアン
GRAD_TO = (167, 139, 250)    # #a78bfa パープル
CHECK_COLOR = (11, 16, 32)   # #0b1020 ダーク


def rrect_sdf(x, y, x0, y0, x1, y1, r):
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return math.hypot(x - cx, y - cy) - r


def in_triangle(x, y, tri):
    (ax, ay), (bx, by), (cx, cy) = tri

    def sign(px, py, qx, qy, rx, ry):
        return (px - rx) * (qy - ry) - (qx - rx) * (py - ry)

    d1 = sign(x, y, ax, ay, bx, by)
    d2 = sign(x, y, bx, by, cx, cy)
    d3 = sign(x, y, cx, cy, ax, ay)
    has_neg = d1 < 0 or d2 < 0 or d3 < 0
    has_pos = d1 > 0 or d2 > 0 or d3 > 0
    return not (has_neg and has_pos)


def seg_dist(x, y, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    denom = dx * dx + dy * dy
    t = 0.0 if denom == 0 else max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / denom))
    return math.hypot(x - (ax + t * dx), y - (ay + t * dy))


def in_check(x, y):
    a, b, c = CHECK
    d = min(seg_dist(x, y, a[0], a[1], b[0], b[1]),
            seg_dist(x, y, b[0], b[1], c[0], c[1]))
    return d <= CHECK_HALF_W


def in_bubble(x, y):
    return rrect_sdf(x, y, *BUBBLE) <= 0 or in_triangle(x, y, TAIL)


def sample(x, y):
    """(r,g,b,a) を返す。バブル外は透明。"""
    if not in_bubble(x, y):
        return None
    if in_check(x, y):
        return CHECK_COLOR
    t = max(0.0, min(1.0, x))
    return tuple(round(GRAD_FROM[i] + (GRAD_TO[i] - GRAD_FROM[i]) * t) for i in range(3))


def render(size):
    rows = []
    for py in range(size):
        row = []
        for px in range(size):
            acc_r = acc_g = acc_b = acc_a = 0
            for sy in range(SS):
                for sx in range(SS):
                    x = (px + (sx + 0.5) / SS) / size
                    y = (py + (sy + 0.5) / SS) / size
                    col = sample(x, y)
                    if col is None:
                        continue
                    acc_r += col[0]
                    acc_g += col[1]
                    acc_b += col[2]
                    acc_a += 1
            if acc_a == 0:
                row.append((0, 0, 0, 0))
            else:
                total = SS * SS
                row.append((acc_r // acc_a, acc_g // acc_a, acc_b // acc_a,
                            round(255 * acc_a / total)))
        rows.append(row)
    return rows


def write_png(path, size, rows):
    raw = b''.join(b'\x00' + b''.join(struct.pack('BBBB', *px) for px in row) for row in rows)

    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data
                + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff))

    header = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    blob = (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', header)
            + chunk(b'IDAT', zlib.compress(raw, 9))
            + chunk(b'IEND', b''))
    with open(path, 'wb') as fh:
        fh.write(blob)


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    for size in SIZES:
        path = os.path.join(here, f'icon{size}.png')
        write_png(path, size, render(size))
        print(f'{path} ({os.path.getsize(path)} bytes)')


if __name__ == '__main__':
    main()
