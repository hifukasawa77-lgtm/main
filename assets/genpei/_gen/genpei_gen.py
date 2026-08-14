#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
genpei_gen.py — 源平争乱記 合戦背景7枚 + イベント絵8枚 のプロシージャル生成
(Graphic-Designer エージェント / A-1 プロシージャル生成 / Pillow使用・APIキー不要)

方針:
  - 12世紀後半・治承寿永の乱の時代考証に合わせ、大鎧・烏帽子・直垂・水干・薙刀・太刀・
    騎射・和船・僧形などのシルエットのみで人物を表現する（顔の写実描写は一切行わない）。
  - 絵巻物・水墨画調のトーン（抑えた土・藍・朱・墨色、グラデーション空、滲み・にじみ質感）。
  - 戦国風雲記（16世紀）と混同する意匠（天守閣・石垣・火縄銃・南蛮胴）は一切描かない。
  - 出力は WebP (q90相当)、1600x900、PNG/JPGは残さない。
"""
import math
import random
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageOps

W, H = 1600, 900

# ---------------------------------------------------------------------------
# 基礎ユーティリティ
# ---------------------------------------------------------------------------

def lerp(a, b, t):
    return a + (b - a) * t


def lerp_color(c1, c2, t):
    return tuple(int(lerp(c1[i], c2[i], t)) for i in range(3))


def sky_gradient(size, stops):
    """stops: [(pos0-1, (r,g,b)), ...] 上から下へ"""
    w, h = size
    img = Image.new('RGB', size)
    px = img.load()
    row_cache = {}
    for y in range(h):
        t = y / (h - 1)
        # 区間探索
        for i in range(len(stops) - 1):
            p0, c0 = stops[i]
            p1, c1 = stops[i + 1]
            if p0 <= t <= p1 or i == len(stops) - 2:
                local_t = 0 if p1 == p0 else (t - p0) / (p1 - p0)
                local_t = max(0, min(1, local_t))
                row_cache[y] = lerp_color(c0, c1, local_t)
                break
    for y in range(h):
        c = row_cache[y]
        for x in range(w):
            px[x, y] = c
    return img


def add_paper_grain(img, intensity=14, seed=1):
    rnd = random.Random(seed)
    w, h = img.size
    noise = Image.new('L', (w // 2, h // 2))
    npx = noise.load()
    for y in range(h // 2):
        for x in range(w // 2):
            npx[x, y] = 128 + rnd.randint(-intensity, intensity)
    noise = noise.resize((w, h), Image.BILINEAR)
    noise_rgb = Image.merge('RGB', (noise, noise, noise))
    return ImageChops.overlay(img, noise_rgb)


def vignette(img, strength=0.55):
    w, h = img.size
    mask = Image.new('L', (w, h), 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.ellipse([-w * 0.25, -h * 0.35, w * 1.25, h * 1.3], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(180))
    dark = Image.new('RGB', (w, h), (0, 0, 0))
    return Image.composite(img, dark, mask.point(lambda p: int(255 - (255 - p) * strength)))


def mist_band(draw_img, y_center, thickness, color, alpha=90, blur=40):
    w, h = draw_img.size
    layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.ellipse([-w * 0.1, y_center - thickness / 2, w * 1.1, y_center + thickness / 2],
               fill=(*color, alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    return Image.alpha_composite(draw_img.convert('RGBA'), layer).convert('RGB')


def forest_ridge(size, base_y, canopy_h, color, density=60, seed=0, softness=1.0):
    """遠景の森を「木の集合」ではなく1枚のジャギー稜線として描く（絵巻の山肌のような一体感）。
    canopy_h: 樹冠の最大高さ(px)。density: 起伏の細かさ（大きいほど細かい）。"""
    w, h = size
    rnd = random.Random(seed)
    layer = Image.new('RGBA', size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    n = density
    step = w / n
    pts = [(-20, h + 20)]
    # 低周波（大きなうねり）と高周波（枝葉のギザギザ）を重ねる
    phase = rnd.uniform(0, 10)
    for i in range(n + 1):
        x = i * step
        low = math.sin(i / n * math.pi * rnd.uniform(2.2, 3.4) + phase) * canopy_h * 0.35
        high = rnd.uniform(-1, 1) * canopy_h * 0.5
        y = base_y - canopy_h * 0.5 - low - high * softness
        pts.append((x, y))
    pts.append((w + 20, h + 20))
    d.polygon(pts, fill=color)
    return layer


def mountain_range(size, base_y, peaks, color, jitter=0, seed=0):
    """peaks: list of (x_frac, height_frac) defining ridge points relative to width/height."""
    w, h = size
    rnd = random.Random(seed)
    pts = [(-40, h)]
    for xf, hf in peaks:
        x = xf * w
        y = base_y - hf * h
        if jitter:
            x += rnd.randint(-jitter, jitter)
            y += rnd.randint(-jitter // 2, jitter // 2)
        pts.append((x, y))
    pts.append((w + 40, h))
    layer = Image.new('RGBA', size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.polygon(pts, fill=(*color, 255))
    return layer


def paste_layer(base, layer):
    return Image.alpha_composite(base.convert('RGBA'), layer).convert('RGB')


def rgba(draw_layer):
    return ImageDraw.Draw(draw_layer)


# ---------------------------------------------------------------------------
# シルエット部品（写実の顔は描かない。鎧兜・後ろ姿・遠景中心）
# ---------------------------------------------------------------------------

def draw_kabuto_head(d, cx, cy, r, color):
    """兜（かぶと）の簡易シルエット：半球＋眉庇＋小さな立物"""
    d.pieslice([cx - r, cy - r, cx + r, cy + r], 180, 360, fill=color)
    d.ellipse([cx - r * 1.1, cy - r * 0.15, cx + r * 1.1, cy + r * 0.25], fill=color)
    # 立物（前立て）
    d.polygon([(cx, cy - r * 1.5), (cx - r * 0.18, cy - r * 0.6), (cx + r * 0.18, cy - r * 0.6)],
              fill=color)


def draw_warrior_standing(layer, x, y, scale, color, facing=1, pose='naginata'):
    """大鎧を着た徒歩武者の後ろ姿/横向きシルエット（絵巻風・裾広がりの一体シルエット）。
    脚を分離せず裾（草摺）で覆い、大袖は肩から流れる形にすることで
    プロシージャル特有の「棒立ち」感を抑える。pose: naginata/sword_raised/bow/spear"""
    d = ImageDraw.Draw(layer)
    s = scale
    top = y - 118 * s   # 肩線
    hem = y + 14 * s    # 裾（地面）
    # 胴＋裾：なだらかに広がる一体シルエット（曲線近似の多角形）
    body = [
        (x - 22 * s, top + 6 * s),
        (x - 30 * s, top + 40 * s),
        (x - 46 * s, hem - 30 * s),
        (x - 40 * s, hem),
        (x + 40 * s, hem),
        (x + 46 * s, hem - 30 * s),
        (x + 30 * s, top + 40 * s),
        (x + 22 * s, top + 6 * s),
    ]
    d.polygon(body, fill=color)
    # 大袖（肩から垂れる張り出し。左右非対称にして奥行きを出す）
    d.polygon([
        (x - 20 * s, top), (x - 52 * s * facing, top + 10 * s),
        (x - 58 * s * facing, top + 46 * s), (x - 34 * s * facing, top + 52 * s),
        (x - 24 * s, top + 30 * s),
    ], fill=color)
    d.polygon([
        (x + 20 * s, top), (x + 52 * s * facing, top + 10 * s),
        (x + 58 * s * facing, top + 46 * s), (x + 34 * s * facing, top + 52 * s),
        (x + 24 * s, top + 30 * s),
    ], fill=color)
    # 頭（兜）
    draw_kabuto_head(d, x, top - 10 * s, 17 * s, color)
    if pose == 'naginata':
        d.line([(x + 30 * s * facing, top + 25 * s), (x + 66 * s * facing, top - 78 * s)], fill=color, width=max(2, int(4 * s)))
        d.polygon([(x + 62 * s * facing, top - 76 * s), (x + 80 * s * facing, top - 100 * s), (x + 68 * s * facing, top - 56 * s)], fill=color)
    elif pose == 'sword_raised':
        d.line([(x + 26 * s * facing, top + 8 * s), (x + 56 * s * facing, top - 62 * s)], fill=color, width=max(2, int(4 * s)))
    elif pose == 'bow':
        bx0, bx1 = sorted([x + 6 * s * facing, x + 42 * s * facing])
        start_ang, end_ang = (250, 110) if facing > 0 else (70, 290)
        d.arc([bx0, top - 55 * s, bx1, top + 40 * s], start_ang, end_ang, fill=color, width=max(2, int(3 * s)))
    elif pose == 'spear':
        d.line([(x - 22 * s * facing, top + 45 * s), (x + 52 * s * facing, top - 96 * s)], fill=color, width=max(2, int(3 * s)))
    elif pose == 'kneel':
        pass


def draw_horse_silhouette(layer, x, y, scale, color, facing=1, rearing=False):
    d = ImageDraw.Draw(layer)
    s = scale
    if not rearing:
        body = [
            (x - 55 * s * facing, y - 20 * s), (x - 30 * s * facing, y - 45 * s),
            (x + 40 * s * facing, y - 42 * s), (x + 60 * s * facing, y - 25 * s),
            (x + 55 * s * facing, y + 5 * s), (x - 50 * s * facing, y + 5 * s),
        ]
        d.polygon(body, fill=color)
        # 首・頭
        d.polygon([(x + 42 * s * facing, y - 40 * s), (x + 70 * s * facing, y - 62 * s),
                    (x + 78 * s * facing, y - 50 * s), (x + 52 * s * facing, y - 22 * s)], fill=color)
        # 脚
        for lx in (-40, -15, 15, 38):
            d.line([(x + lx * s * facing, y + 3 * s), (x + lx * s * facing, y + 45 * s)], fill=color, width=max(2, int(5 * s)))
        # 尾
        d.polygon([(x - 52 * s * facing, y - 15 * s), (x - 78 * s * facing, y + 10 * s), (x - 60 * s * facing, y + 15 * s)], fill=color)
    else:
        d.polygon([(x - 30 * s * facing, y + 10 * s), (x - 10 * s * facing, y - 30 * s),
                    (x + 20 * s * facing, y - 70 * s), (x + 40 * s * facing, y - 95 * s),
                    (x + 55 * s * facing, y - 80 * s), (x + 30 * s * facing, y - 45 * s),
                    (x + 15 * s * facing, y - 5 * s), (x + 5 * s * facing, y + 25 * s)], fill=color)
        for lx, ly in ((-10, 10), (10, 20)):
            d.line([(x + lx * s * facing, y + ly * s), (x + lx * s * facing, y + 55 * s)], fill=color, width=max(2, int(5 * s)))


def draw_mounted_warrior(layer, x, y, scale, color, facing=1, pose='naginata', rearing=False):
    draw_horse_silhouette(layer, x, y, scale, color, facing, rearing)
    ry = y - (55 if rearing else 40) * scale
    draw_warrior_standing(layer, x + 5 * scale * facing, ry, scale * 0.9, color, facing, pose)


def draw_boat(layer, x, y, scale, color, sail=True, mast_h=1.0):
    d = ImageDraw.Draw(layer)
    s = scale
    d.polygon([(x - 90 * s, y), (x + 90 * s, y), (x + 65 * s, y + 22 * s), (x - 65 * s, y + 22 * s)], fill=color)
    d.polygon([(x - 90 * s, y), (x - 70 * s, y - 10 * s), (x - 55 * s, y)], fill=color)
    d.polygon([(x + 90 * s, y), (x + 70 * s, y - 10 * s), (x + 55 * s, y)], fill=color)
    if sail:
        mh = 130 * s * mast_h
        d.line([(x, y), (x, y - mh)], fill=color, width=max(2, int(3 * s)))
        d.polygon([(x, y - mh), (x + 46 * s, y - mh + 14 * s), (x + 46 * s, y - 26 * s), (x, y - 12 * s)], fill=(*color[:3],) if len(color) == 3 else color)


def draw_pagoda(layer, x, y, scale, color, tiers=5):
    d = ImageDraw.Draw(layer)
    s = scale
    w0 = 70 * s
    for i in range(tiers):
        t = i / max(1, tiers - 1)
        w = w0 * (1 - 0.14 * i)
        yy = y - i * 34 * s
        d.polygon([(x - w, yy), (x + w, yy), (x + w * 0.72, yy - 22 * s), (x - w * 0.72, yy - 22 * s)], fill=color)
    d.line([(x, y - tiers * 34 * s), (x, y - tiers * 34 * s - 60 * s)], fill=color, width=max(2, int(3 * s)))


def draw_waves(layer, y_base, amp, color, alpha=255, n=40, seed=0):
    w, h = layer.size
    d = ImageDraw.Draw(layer)
    rnd = random.Random(seed)
    pts = [(0, h)]
    step = w / n
    for i in range(n + 1):
        x = i * step
        yy = y_base + math.sin(i * 0.6 + rnd.random()) * amp + rnd.uniform(-amp * 0.15, amp * 0.15)
        pts.append((x, yy))
    pts.append((w, h))
    fill = (*color, alpha) if len(color) == 3 else color
    d.polygon(pts, fill=fill)


def draw_flag(layer, x, y, h, color, facing=1):
    d = ImageDraw.Draw(layer)
    d.line([(x, y), (x, y - h)], fill=color, width=3)
    d.polygon([(x, y - h), (x + 26 * facing, y - h + 10), (x, y - h + 26)], fill=color)


def fire_glow(layer, x, y, r, inner=(255, 200, 120), outer=(140, 30, 10)):
    w, h = layer.size
    fx = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    fd = ImageDraw.Draw(fx)
    steps = 8
    for i in range(steps, 0, -1):
        t = i / steps
        rr = r * t
        col = lerp_color(inner, outer, 1 - t)
        alpha = int(160 * t)
        fd.ellipse([x - rr, y - rr, x + rr, y + rr], fill=(*col, alpha))
    fx = fx.filter(ImageFilter.GaussianBlur(int(r * 0.25)))
    return fx


def embers(layer, x0, x1, y0, y1, n, color=(255, 190, 110), seed=0):
    rnd = random.Random(seed)
    d = ImageDraw.Draw(layer)
    for _ in range(n):
        x = rnd.uniform(x0, x1)
        y = rnd.uniform(y0, y1)
        r = rnd.uniform(1, 3)
        a = rnd.randint(120, 230)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(*color, a))


def snow(layer, n, color=(255, 255, 255), seed=0):
    rnd = random.Random(seed)
    w, h = layer.size
    d = ImageDraw.Draw(layer)
    for _ in range(n):
        x = rnd.uniform(0, w)
        y = rnd.uniform(0, h)
        r = rnd.uniform(1, 2.6)
        a = rnd.randint(140, 230)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(*color, a))


def rain(layer, n, color=(200, 210, 230), seed=0, length=18):
    rnd = random.Random(seed)
    w, h = layer.size
    d = ImageDraw.Draw(layer)
    for _ in range(n):
        x = rnd.uniform(0, w)
        y = rnd.uniform(0, h)
        a = rnd.randint(50, 130)
        d.line([(x, y), (x - length * 0.3, y + length)], fill=(*color, a), width=1)


def birds(layer, xs_ys, color=(30, 30, 30, 220)):
    d = ImageDraw.Draw(layer)
    for x, y, sc in xs_ys:
        d.line([(x - 8 * sc, y), (x, y - 4 * sc), (x + 8 * sc, y)], fill=color, width=max(1, int(2 * sc)))


def finalize(img, out_path, grain=12, vig=0.5, seed=1):
    img = add_paper_grain(img, intensity=grain, seed=seed)
    img = vignette(img, vig)
    img = img.filter(ImageFilter.GaussianBlur(0.4))
    img.save(out_path, 'WEBP', quality=90, method=6)
    print('saved', out_path)
