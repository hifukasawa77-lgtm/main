#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
from genpei_gen import *

OUT = os.environ.get('GENPEI_OUT', os.path.join(os.path.dirname(__file__), 'out'))
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------------------
# 1. 石橋山 — 1180年8月、夜・雨の山中奇襲
# ---------------------------------------------------------------------------

def _ishibashiyama():
    img = sky_gradient((W, H), [(0, (8, 10, 22)), (0.55, (18, 20, 34)), (1, (34, 34, 46))])
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    # 遠い稜線
    layer = paste_layer(img, mountain_range((W, H), 620, [(0.0, 0.18), (0.25, 0.30), (0.55, 0.22), (0.8, 0.34), (1.0, 0.16)], (14, 16, 26), jitter=10, seed=2))
    layer = layer.convert('RGBA')
    # 森のシルエット層（濃淡3枚、ジャギー稜線として一体描画）
    for i, (basey, ch, dark) in enumerate([(700, 170, (11, 13, 19)), (770, 210, (7, 9, 13)), (860, 240, (3, 4, 7))]):
        layer = paste_layer(layer, forest_ridge((W, H), basey, ch, dark, density=70, seed=10 + i))
    # 松明の光
    for (fx, fy) in [(360, 800), (980, 790), (1240, 815)]:
        layer = paste_layer(layer, fire_glow(layer, fx, fy, 75))
    figs = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw_warrior_standing(figs, 360, 830, 1.15, (12, 12, 16), 1, 'naginata')
    draw_warrior_standing(figs, 470, 845, 1.0, (10, 10, 14), -1, 'sword_raised')
    draw_warrior_standing(figs, 980, 820, 1.2, (14, 14, 18), -1, 'naginata')
    draw_warrior_standing(figs, 1090, 835, 0.95, (10, 10, 14), 1, 'bow')
    draw_warrior_standing(figs, 1240, 850, 1.05, (12, 12, 16), -1, 'spear')
    layer = paste_layer(layer, figs)
    rain_l = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    rain(rain_l, 900, seed=3)
    layer = paste_layer(layer, rain_l)
    mistl = mist_band(layer, 760, 220, (60, 64, 80), alpha=55, blur=60)
    return mistl

# ---------------------------------------------------------------------------
# 2. 富士川 — 1180年10月、秋の夕暮れ・水鳥の羽音に平氏退く
# ---------------------------------------------------------------------------

def _fujikawa():
    img = sky_gradient((W, H), [(0, (40, 34, 58)), (0.45, (128, 84, 76)), (0.72, (224, 148, 92)), (1, (250, 200, 140))])
    layer = img.convert('RGBA')
    # 富士に似た遠景の霊峰（象徴的シルエット、固有名詞を避けた円錐形の山）
    fuji = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    fd = ImageDraw.Draw(fuji)
    fd.polygon([(740, 560), (900, 290), (1060, 560)], fill=(96, 70, 84, 235))
    fd.polygon([(860, 370), (900, 300), (940, 370), (915, 355), (885, 355)], fill=(215, 205, 210, 190))
    layer = paste_layer(layer, fuji)
    layer = paste_layer(layer, mountain_range((W, H), 620, [(0, 0.07), (0.3, 0.12), (0.6, 0.08), (1, 0.14)], (58, 46, 56), jitter=6, seed=4))
    # 川面（水平帯・反射：夕焼けを映す暖色から手前の藍色へ）
    fill_l = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    fld = ImageDraw.Draw(fill_l)
    fld.rectangle([0, 660, W, 900], fill=(70, 58, 74, 255))
    layer = paste_layer(layer, fill_l)
    band = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    for i in range(7):
        yy = 672 + i * 32
        t = i / 6
        col = lerp_color((235, 175, 120), (90, 74, 96), t)
        bd.line([(0, yy), (W, yy)], fill=(*col, 130), width=6)
    layer = paste_layer(layer, band)
    river = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw_waves(river, 700, 9, (200, 150, 110), alpha=90, n=50, seed=5)
    layer = paste_layer(layer, river)
    # 驚いて飛び立つ水鳥の群れ
    bl = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    rnd = random.Random(6)
    flock = [(rnd.uniform(700, 1250), rnd.uniform(180, 420), rnd.uniform(0.8, 1.8)) for _ in range(26)]
    birds(bl, flock, color=(40, 30, 34, 220))
    layer = paste_layer(layer, bl)
    # 遠くの陣幕・幔幕（source of the panic, silhouette tents, far distance small)
    tents = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    td = ImageDraw.Draw(tents)
    for tx in (250, 320, 390):
        td.polygon([(tx, 690), (tx + 40, 640), (tx + 80, 690)], fill=(60, 46, 50, 230))
    layer = paste_layer(layer, tents)
    figs = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw_warrior_standing(figs, 300, 760, 0.55, (46, 36, 40), 1, 'bow')
    draw_warrior_standing(figs, 355, 765, 0.5, (46, 36, 40), -1, 'spear')
    layer = paste_layer(layer, figs)
    grass = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw_waves(grass, 860, 24, (70, 55, 44), alpha=255, n=30, seed=7)
    layer = paste_layer(layer, grass)
    return layer


# ---------------------------------------------------------------------------
# 3. 倶利伽羅峠 — 1183年5月、夜・断崖の谷へ平氏を追い落とす（火牛の計）
# ---------------------------------------------------------------------------

def _kurikara():
    img = sky_gradient((W, H), [(0, (8, 10, 22)), (0.5, (20, 20, 32)), (1, (52, 38, 34))])
    layer = img.convert('RGBA')
    # 両側の断崖（峡谷。中央の谷を広く見せる）
    left_cliff = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(left_cliff)
    ld.polygon([(0, 0), (300, 0), (170, 420), (70, 720), (0, 820)], fill=(14, 12, 16, 255))
    for i in range(6):
        ld.line([(30 + i * 34, 40), (10 + i * 20, 700)], fill=(24, 20, 22, 140), width=4)
    layer = paste_layer(layer, left_cliff)
    right_cliff = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    rd = ImageDraw.Draw(right_cliff)
    rd.polygon([(W, 0), (W - 300, 0), (W - 190, 380), (W - 90, 680), (W, 800)], fill=(11, 9, 13, 255))
    for i in range(6):
        rd.line([(W - 30 - i * 34, 40), (W - 10 - i * 20, 660)], fill=(20, 16, 18, 140), width=4)
    layer = paste_layer(layer, right_cliff)
    # 谷底の平氏本陣（松明が多数、大混乱）
    valley = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    vd = ImageDraw.Draw(valley)
    vd.polygon([(0, 800), (W, 790), (W, H), (0, H)], fill=(6, 5, 7, 255))
    layer = paste_layer(layer, valley)
    rnd = random.Random(19)
    camp_fires = [(rnd.uniform(340, 1260), rnd.uniform(760, 860), rnd.uniform(30, 60)) for _ in range(9)]
    for fx, fy, r in camp_fires:
        layer = paste_layer(layer, fire_glow(layer, fx, fy, r))
    tents = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    td = ImageDraw.Draw(tents)
    for tx in (420, 520, 700, 860, 1020, 1140):
        td.polygon([(tx, 800), (tx + 34, 758), (tx + 68, 800)], fill=(16, 12, 12, 255))
    layer = paste_layer(layer, tents)
    embers_l = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    embers(embers_l, 340, 1280, 300, 800, 160, seed=8)
    layer = paste_layer(layer, embers_l)
    # 崖上に構える源氏の武者（勢揃い、シルエット）
    ridge_figs = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw_warrior_standing(ridge_figs, 210, 470, 1.0, (10, 9, 12), 1, 'naginata')
    draw_warrior_standing(ridge_figs, 265, 500, 0.9, (10, 9, 12), 1, 'spear')
    draw_warrior_standing(ridge_figs, 1350, 440, 1.05, (9, 8, 11), -1, 'naginata')
    draw_warrior_standing(ridge_figs, 1300, 500, 0.9, (9, 8, 11), -1, 'bow')
    layer = paste_layer(layer, ridge_figs)
    # 谷へ落ちる火牛（角に松明をくくられた牛）と平氏の武者のシルエット
    fall_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    fgd = ImageDraw.Draw(fall_layer)
    for (cx, cy, sc) in [(430, 470, 1.0), (610, 560, 0.85), (860, 630, 0.95), (1080, 540, 0.8)]:
        fgd.ellipse([cx - 40 * sc, cy - 22 * sc, cx + 40 * sc, cy + 22 * sc], fill=(6, 6, 6, 255))
        fgd.polygon([(cx + 34 * sc, cy - 6 * sc), (cx + 58 * sc, cy - 14 * sc), (cx + 44 * sc, cy + 8 * sc)], fill=(6, 6, 6, 255))
        fgd.line([(cx - 24 * sc, cy - 20 * sc), (cx - 34 * sc, cy - 42 * sc)], fill=(6, 6, 6, 255), width=4)
        fgd.line([(cx - 10 * sc, cy - 20 * sc), (cx - 18 * sc, cy - 40 * sc)], fill=(6, 6, 6, 255), width=4)
        layer = paste_layer(layer, fire_glow(layer, cx - 30 * sc, cy - 42 * sc, 26 * sc))
        layer = paste_layer(layer, fire_glow(layer, cx - 14 * sc, cy - 40 * sc, 24 * sc))
    layer = paste_layer(layer, fall_layer)
    mistl = mist_band(layer, 560, 200, (40, 32, 30), alpha=45, blur=70)
    return mistl


# ---------------------------------------------------------------------------
# 4. 宇治川 — 1184年1月、冬・急流を渡る先陣争い
# ---------------------------------------------------------------------------

def _ujigawa():
    img = sky_gradient((W, H), [(0, (70, 78, 92)), (0.5, (120, 128, 138)), (1, (176, 178, 178))])
    layer = img.convert('RGBA')
    layer = paste_layer(layer, mountain_range((W, H), 560, [(0, 0.10), (0.3, 0.16), (0.6, 0.09), (1, 0.13)], (128, 132, 138), jitter=8, seed=9))
    layer = paste_layer(layer, forest_ridge((W, H), 610, 90, (96, 100, 108), density=60, seed=12))
    # 川面（急流・波しぶき）
    river = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw_waves(river, 660, 26, (150, 158, 164), alpha=255, n=48, seed=13)
    layer = paste_layer(layer, river)
    foam = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    fd = ImageDraw.Draw(foam)
    rnd = random.Random(14)
    for _ in range(140):
        x = rnd.uniform(0, W)
        y = rnd.uniform(660, 880)
        r = rnd.uniform(2, 7)
        fd.ellipse([x - r, y - r * 0.4, x + r, y + r * 0.4], fill=(235, 238, 240, rnd.randint(90, 180)))
    layer = paste_layer(layer, foam)
    # 川を渡る騎馬武者（先陣争い＝2騎並走）
    figs = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw_mounted_warrior(figs, 620, 760, 1.3, (34, 30, 34), 1, 'naginata', rearing=False)
    draw_mounted_warrior(figs, 820, 780, 1.3, (28, 26, 30), 1, 'sword_raised', rearing=False)
    layer = paste_layer(layer, figs)
    splash = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(splash)
    for (sx, sy) in [(560, 800), (760, 820), (900, 810)]:
        for i in range(10):
            a = rnd.uniform(0, math.pi)
            r = rnd.uniform(10, 40)
            sd.ellipse([sx + math.cos(a) * r - 3, sy - math.sin(a) * r * 0.6 - 3, sx + math.cos(a) * r + 3, sy - math.sin(a) * r * 0.6 + 3], fill=(230, 235, 238, 200))
    layer = paste_layer(layer, splash)
    reeds = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    rd2 = ImageDraw.Draw(reeds)
    for _ in range(60):
        x = rnd.uniform(0, 260)
        y = rnd.uniform(820, 900)
        rd2.line([(x, y), (x + rnd.uniform(-8, 8), y - rnd.uniform(40, 90))], fill=(70, 74, 60, 220), width=2)
    layer = paste_layer(layer, reeds)
    return layer


# ---------------------------------------------------------------------------
# 5. 一ノ谷（鵯越） — 1184年2月、夜明け・断崖の逆落とし
# ---------------------------------------------------------------------------

def _ichinotani():
    img = sky_gradient((W, H), [(0, (46, 42, 78)), (0.4, (130, 96, 108)), (0.75, (230, 160, 120)), (1, (250, 205, 160))])
    layer = img.convert('RGBA')
    # 海（画面下、遠景）
    sea = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw_waves(sea, 700, 10, (150, 120, 130), alpha=200, n=40, seed=15)
    layer = paste_layer(layer, sea)
    band = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    bd.rectangle([0, 700, W, 900], fill=(90, 78, 100, 140))
    layer = paste_layer(layer, band)
    # 平家方の陣・幕（浜辺）
    tents = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    td = ImageDraw.Draw(tents)
    for tx in (900, 1000, 1100, 1200):
        td.polygon([(tx, 780), (tx + 46, 720), (tx + 92, 780)], fill=(60, 40, 42, 230))
    layer = paste_layer(layer, tents)
    # 切り立った崖（画面左から中央にかけて急峻に落ちる）
    cliff = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    cd = ImageDraw.Draw(cliff)
    cd.polygon([(0, 0), (760, 0), (560, 340), (420, 520), (260, 680), (0, 760)], fill=(58, 44, 50, 255))
    # 崖の岩肌の筋
    for i in range(10):
        x0 = 60 + i * 70
        cd.line([(x0, 30 + i * 8), (x0 - 140, 700 - i * 30)], fill=(40, 30, 34, 120), width=3)
    layer = paste_layer(layer, cliff)
    # 逆落としの騎馬武者たち（斜めに連なる）
    figs = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    path = [(300, 260, 0.55), (360, 340, 0.62), (420, 430, 0.72), (470, 520, 0.85), (520, 610, 0.95)]
    for (px, py, sc) in path:
        draw_mounted_warrior(figs, px, py, sc, (30, 22, 24), 1, 'naginata')
    layer = paste_layer(layer, figs)
    return layer


# ---------------------------------------------------------------------------
# 6. 屋島 — 1185年2月、夕・海辺の陣を焼き討ちして誘い出す
# ---------------------------------------------------------------------------

def _yashima():
    img = sky_gradient((W, H), [(0, (40, 34, 60)), (0.45, (140, 86, 82)), (0.75, (232, 140, 90)), (1, (250, 190, 130))])
    layer = img.convert('RGBA')
    layer = paste_layer(layer, mountain_range((W, H), 560, [(0, 0.10), (0.35, 0.15), (0.7, 0.08), (1, 0.12)], (90, 66, 74), jitter=8, seed=16))
    sea = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw_waves(sea, 620, 14, (200, 120, 90), alpha=220, n=44, seed=17)
    layer = paste_layer(layer, sea)
    seafill = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sfd = ImageDraw.Draw(seafill)
    sfd.rectangle([0, 620, W, 900], fill=(120, 78, 84, 160))
    layer = paste_layer(layer, seafill)
    # 平家の軍船（沖）
    boats = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for (bx, by, sc) in [(1150, 560, 0.9), (1300, 600, 0.7), (980, 610, 0.6)]:
        draw_boat(boats, bx, by, sc, (40, 30, 32, 255))
    layer = paste_layer(layer, boats)
    # 浜辺の民家が燃える（義経の陽動）
    for (fx, fy, r) in [(300, 660, 90), (380, 680, 60)]:
        layer = paste_layer(layer, fire_glow(layer, fx, fy, r))
    smoke = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(smoke)
    sd.ellipse([220, 400, 460, 640], fill=(40, 34, 34, 90))
    smoke = smoke.filter(ImageFilter.GaussianBlur(40))
    layer = paste_layer(layer, smoke)
    house = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    hd = ImageDraw.Draw(house)
    hd.polygon([(260, 700), (320, 640), (380, 700)], fill=(20, 14, 14, 255))
    hd.rectangle([270, 700, 370, 740], fill=(20, 14, 14, 255))
    layer = paste_layer(layer, house)
    # 波打ち際の騎馬武者
    figs = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw_mounted_warrior(figs, 700, 780, 1.15, (34, 26, 26), 1, 'bow')
    draw_mounted_warrior(figs, 820, 800, 1.1, (30, 24, 24), 1, 'naginata')
    layer = paste_layer(layer, figs)
    return layer


# ---------------------------------------------------------------------------
# 7. 壇ノ浦 — 1185年3月、荒天の海峡・水軍の激突
# ---------------------------------------------------------------------------

def _dannoura():
    img = sky_gradient((W, H), [(0, (30, 34, 40)), (0.5, (58, 68, 74)), (1, (96, 110, 108))])
    layer = img.convert('RGBA')
    cloud = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    cd = ImageDraw.Draw(cloud)
    rnd = random.Random(18)
    for _ in range(10):
        cx = rnd.uniform(0, W)
        cy = rnd.uniform(40, 220)
        cw = rnd.uniform(180, 420)
        cd.ellipse([cx - cw, cy - cw * 0.25, cx + cw, cy + cw * 0.25], fill=(20, 24, 28, 90))
    cloud = cloud.filter(ImageFilter.GaussianBlur(30))
    layer = paste_layer(layer, cloud)
    # 荒れる海（渦潮を思わせる同心円の波紋を重ねる）
    sea = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sfd = ImageDraw.Draw(sea)
    sfd.rectangle([0, 480, W, H], fill=(40, 58, 60, 255))
    layer = paste_layer(layer, sea)
    for i in range(8):
        draw_waves(layer.convert('RGBA'), 520 + i * 46, 16 - i, (60 + i * 6, 82 + i * 5, 84 + i * 4), alpha=200, n=50, seed=20 + i)
    # 上のdraw_wavesはlayerに直接描いていないため、レイヤー合成をやり直す
    wave_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for i in range(9):
        draw_waves(wave_layer, 520 + i * 44, 14, (70 + i * 5, 92 + i * 4, 92 + i * 3), alpha=160, n=54, seed=30 + i)
    layer = paste_layer(layer, wave_layer)
    whirl = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    wd = ImageDraw.Draw(whirl)
    for r in range(30, 220, 26):
        wd.arc([800 - r, 640 - r * 0.4, 800 + r, 640 + r * 0.4], 20, 320, fill=(30, 40, 42, 140), width=4)
    layer = paste_layer(layer, whirl)
    # 両軍の軍船と旗指物
    boats = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for (bx, by, sc, col) in [(340, 660, 1.0, (28, 20, 20, 255)), (520, 720, 0.85, (24, 18, 18, 255)),
                               (1080, 650, 1.05, (18, 22, 26, 255)), (1260, 710, 0.8, (16, 20, 24, 255)),
                               (760, 780, 0.7, (20, 16, 16, 255))]:
        draw_boat(boats, bx, by, sc, col)
    layer = paste_layer(layer, boats)
    flags = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw_flag(flags, 340, 590, 70, (170, 20, 24, 255), 1)
    draw_flag(flags, 1080, 570, 70, (230, 230, 230, 255), -1)
    layer = paste_layer(layer, flags)
    return layer


# ---------------------------------------------------------------------------
# イベント絵 8枚
# ---------------------------------------------------------------------------

def _mochihito_decree():
    """令旨伝達 — 1180年、以仁王の令旨が諸国の源氏へ。夜・邸内、使者が令旨を武士へ渡す"""
    img = sky_gradient((W, H), [(0, (28, 22, 24)), (0.6, (52, 38, 34)), (1, (74, 52, 42))])
    layer = img.convert('RGBA')
    # 柱・御簾（簡略な邸内シルエット。奥行きを出す縦材）
    room = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    rd = ImageDraw.Draw(room)
    for px in (90, 1510):
        rd.rectangle([px - 26, 0, px + 26, 860], fill=(20, 14, 12, 255))
    rd.rectangle([0, 780, W, 900], fill=(30, 22, 18, 255))
    layer = paste_layer(layer, room)
    # 行灯の灯り（人物を照らす位置に）
    layer = paste_layer(layer, fire_glow(layer, 700, 700, 220, inner=(255, 214, 150), outer=(150, 90, 40)))
    layer = paste_layer(layer, fire_glow(layer, 1220, 760, 130, inner=(255, 210, 150), outer=(140, 80, 30)))
    andon = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ad2 = ImageDraw.Draw(andon)
    ad2.rectangle([1195, 700, 1245, 820], fill=(60, 46, 34, 255))
    ad2.polygon([(1190, 700), (1220, 670), (1250, 700)], fill=(60, 46, 34, 255))
    layer = paste_layer(layer, andon)
    figs = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    fd = ImageDraw.Draw(figs)
    # 公家装束の使者（束帯・立烏帽子、正座し令旨を捧げ持つ）→ 大きめの温かい色で描く
    cx, cy = 640, 780
    fd.polygon([(cx - 90, cy + 70), (cx - 55, cy - 90), (cx + 55, cy - 90), (cx + 90, cy + 70)], fill=(56, 40, 34, 255))
    fd.ellipse([cx - 26, cy - 150, cx + 26, cy - 96], fill=(56, 40, 34, 255))
    fd.polygon([(cx - 8, cy - 174), (cx + 16, cy - 192), (cx + 22, cy - 148)], fill=(56, 40, 34, 255))  # 立烏帽子
    fd.polygon([(cx + 60, cy - 40), (cx + 130, cy - 60), (cx + 128, cy - 10), (cx + 58, cy + 10)], fill=(56, 40, 34, 255))  # 差し出す腕/袖
    # 令旨（巻物）— 画面の視線を集める最も明るい要素
    scroll = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    scd = ImageDraw.Draw(scroll)
    scd.rounded_rectangle([cx + 110, cy - 66, cx + 220, cy - 30], radius=10, fill=(238, 214, 165, 255))
    scd.ellipse([cx + 100, cy - 70, cx + 126, cy - 26], fill=(200, 170, 110, 255))
    scd.ellipse([cx + 200, cy - 70, cx + 226, cy - 26], fill=(200, 170, 110, 255))
    layer = paste_layer(layer, fire_glow(layer, cx + 160, cy - 48, 70, inner=(255, 250, 225), outer=(210, 175, 100)))
    layer = paste_layer(layer, scroll)
    # 拝受する武士（片膝をつき頭を垂れる。大鎧の袖を伏せた姿）
    kx, ky = 940, 790
    fd.polygon([(kx - 70, ky + 60), (kx - 84, ky - 60), (kx + 30, ky - 76), (kx + 78, ky + 30), (kx + 20, ky + 60)], fill=(30, 22, 20, 255))
    fd.ellipse([kx - 108, ky - 118, kx - 52, ky - 62], fill=(30, 22, 20, 255))
    fd.polygon([(kx - 116, ky - 96), (kx - 150, ky - 60), (kx - 100, ky - 40)], fill=(30, 22, 20, 255))  # 大袖
    layer = paste_layer(layer, figs)
    return layer


def _kiyomori_death():
    """清盛の死 — 1181年2月、熱病に倒れる。夜・病間、屏風と空の鎧掛け"""
    img = sky_gradient((W, H), [(0, (8, 6, 8)), (0.6, (18, 10, 10)), (1, (34, 14, 12))])
    layer = img.convert('RGBA')
    # 屏風（金地に見立てた明暗の帯）
    byobu = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(byobu)
    for i, x0 in enumerate(range(180, 1420, 210)):
        shade = 30 + (i % 2) * 10
        bd.polygon([(x0, 220), (x0 + 190, 200), (x0 + 190, 720), (x0, 740)], fill=(shade + 10, shade, shade - 4, 235))
        bd.line([(x0, 220), (x0, 740)], fill=(10, 8, 8, 200), width=3)
    layer = paste_layer(layer, byobu)
    # 空の鎧掛け（覇者の不在を象徴）
    stand = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(stand)
    ax, ay = 1180, 640
    sd.line([(ax, ay - 160), (ax, ay + 60)], fill=(10, 8, 8, 255), width=8)
    sd.line([(ax - 70, ay - 120), (ax + 70, ay - 120)], fill=(10, 8, 8, 255), width=8)
    sd.polygon([(ax - 60, ay - 110), (ax - 70, ay + 10), (ax + 70, ay + 10), (ax + 60, ay - 110)], fill=(22, 16, 14, 220))
    layer = paste_layer(layer, stand)
    # 病間の火鉢（発熱＝業火の伝承を象徴する赤い光）
    layer = paste_layer(layer, fire_glow(layer, 560, 760, 130, inner=(255, 140, 80), outer=(120, 20, 10)))
    brazier = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    brd = ImageDraw.Draw(brazier)
    brd.ellipse([500, 780, 620, 820], fill=(20, 14, 12, 255))
    layer = paste_layer(layer, brazier)
    embers_l = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    embers(embers_l, 480, 660, 600, 780, 60, color=(255, 140, 90), seed=21)
    layer = paste_layer(layer, embers_l)
    # 臥す衾（布団）のシルエット
    futon = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ftd = ImageDraw.Draw(futon)
    ftd.ellipse([760, 760, 1080, 830], fill=(14, 10, 10, 255))
    layer = paste_layer(layer, futon)
    return layer


def _nanto_shoutou():
    """南都焼討 — 1180年12月、冬・夜。奈良の大寺が炎上する"""
    img = sky_gradient((W, H), [(0, (10, 6, 6)), (0.5, (40, 16, 12)), (1, (80, 30, 16))])
    layer = img.convert('RGBA')
    layer = paste_layer(layer, forest_ridge((W, H), 700, 60, (18, 10, 8), density=50, seed=22))
    # 五重塔（南都の大寺を象徴。固有名詞は使わず一般化した伽藍）
    pag = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw_pagoda(pag, 760, 700, 1.7, (14, 8, 7, 255), tiers=5)
    draw_pagoda(pag, 1120, 720, 1.1, (12, 7, 6, 255), tiers=5)
    layer = paste_layer(layer, pag)
    # 金堂（切妻屋根の大堂）
    hall = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    hd = ImageDraw.Draw(hall)
    hd.polygon([(280, 760), (520, 660), (760, 760)], fill=(12, 7, 6, 255))
    hd.rectangle([320, 760, 720, 820], fill=(12, 7, 6, 255))
    layer = paste_layer(layer, hall)
    # 炎上
    for fx, fy, r in [(760, 560, 140), (500, 700, 110), (1120, 560, 100), (620, 780, 90)]:
        layer = paste_layer(layer, fire_glow(layer, fx, fy, r, inner=(255, 200, 110), outer=(160, 30, 10)))
    embers_l = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    embers(embers_l, 260, 1300, 200, 780, 220, seed=23)
    layer = paste_layer(layer, embers_l)
    smoke = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(smoke)
    for _ in range(6):
        rnd = random.Random(24)
        cx = rnd.uniform(400, 1200)
        cy = rnd.uniform(80, 420)
        cw = rnd.uniform(140, 300)
        sd.ellipse([cx - cw, cy - cw * 0.5, cx + cw, cy + cw * 0.5], fill=(20, 14, 12, 110))
    smoke = smoke.filter(ImageFilter.GaussianBlur(40))
    layer = paste_layer(layer, smoke)
    return layer


def _miyako_ochi():
    """都落ち — 1183年7月、夏・夕。安徳天皇と三種の神器を奉じ平氏一門が都を落ちる"""
    img = sky_gradient((W, H), [(0, (48, 40, 56)), (0.5, (150, 100, 90)), (0.8, (235, 165, 110)), (1, (250, 205, 150))])
    layer = img.convert('RGBA')
    layer = paste_layer(layer, mountain_range((W, H), 600, [(0, 0.1), (0.4, 0.16), (0.7, 0.09), (1, 0.13)], (110, 82, 84), jitter=8, seed=25))
    layer = paste_layer(layer, forest_ridge((W, H), 660, 60, (86, 62, 60), density=60, seed=26))
    road = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    rd = ImageDraw.Draw(road)
    rd.polygon([(600, 660), (1000, 660), (1420, 900), (200, 900)], fill=(150, 120, 100, 200))
    layer = paste_layer(layer, road)
    dust = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    dd = ImageDraw.Draw(dust)
    dd.ellipse([500, 620, 1120, 780], fill=(200, 160, 120, 70))
    dust = dust.filter(ImageFilter.GaussianBlur(50))
    layer = paste_layer(layer, dust)
    # 落ちゆく行列：牛車・徒歩の供・騎馬の武者・旗
    figs = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    fd = ImageDraw.Draw(figs)
    # 牛車（御所車）
    cx, cy = 760, 760
    fd.rectangle([cx - 50, cy - 70, cx + 50, cy - 10], fill=(30, 22, 20, 255))
    fd.polygon([(cx - 50, cy - 70), (cx, cy - 100), (cx + 50, cy - 70)], fill=(30, 22, 20, 255))
    fd.ellipse([cx - 66, cy - 16, cx - 26, cy + 24], outline=(30, 22, 20, 255), width=6)
    fd.ellipse([cx + 26, cy - 16, cx + 66, cy + 24], outline=(30, 22, 20, 255), width=6)
    fd.line([(cx - 50, cy - 20), (cx - 130, cy + 10)], fill=(30, 22, 20, 255), width=6)
    # 牛
    fd.ellipse([cx - 190, cy - 20, cx - 120, cy + 20], fill=(24, 18, 16, 255))
    for (wx, wy, sc, pose) in [(500, 800, 1.0, 'naginata'), (1020, 790, 1.0, 'bow'), (1160, 810, 0.9, 'sword_raised')]:
        draw_mounted_warrior(figs, wx, wy, sc, (26, 20, 18), 1, pose)
    for (wx, wy, sc) in [(360, 830, 0.6), (1300, 840, 0.55)]:
        draw_warrior_standing(figs, wx, wy, sc, (24, 18, 16), 1, 'spear')
    layer = paste_layer(layer, figs)
    flag = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw_flag(flag, 1020, 700, 60, (150, 24, 24, 255), 1)
    layer = paste_layer(layer, flag)
    return layer


def _atsumori():
    """敦盛最期 — 1184年2月、寒明けの浜。笛の名手・敦盛が呼び返される刹那"""
    img = sky_gradient((W, H), [(0, (54, 46, 76)), (0.45, (140, 108, 118)), (0.75, (232, 170, 130)), (1, (250, 210, 165))])
    layer = img.convert('RGBA')
    fill_l = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    fd0 = ImageDraw.Draw(fill_l)
    fd0.rectangle([0, 660, W, 790], fill=(96, 108, 128, 190))
    layer = paste_layer(layer, fill_l)
    sea = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw_waves(sea, 700, 14, (150, 140, 150), alpha=160, n=44, seed=27)
    layer = paste_layer(layer, sea)
    foam = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    fmd = ImageDraw.Draw(foam)
    fmd.line([(0, 782), (W, 776)], fill=(235, 232, 220, 200), width=5)
    layer = paste_layer(layer, foam)
    beach = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(beach)
    bd.rectangle([0, 780, W, H], fill=(196, 176, 150, 255))
    layer = paste_layer(layer, beach)
    figs = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    # 波打ち際へ馬を進める敦盛（若武者。小柄・軽装で描き分ける）
    draw_mounted_warrior(figs, 1080, 830, 0.9, (40, 32, 34), 1, 'sword_raised')
    # 呼びとめる熊谷（追う武者、少し後方）
    draw_mounted_warrior(figs, 780, 850, 1.0, (30, 24, 24), 1, 'naginata')
    layer = paste_layer(layer, figs)
    # 波間の水鳥（静けさの演出）
    bl = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    birds(bl, [(300, 300, 1.0), (340, 320, 0.9), (260, 330, 0.8)], color=(60, 40, 44, 200))
    layer = paste_layer(layer, bl)
    return layer


def _nasu_no_yoichi():
    """那須与一の扇 — 1185年2月、屋島の海上。揺れる扇を弓で射抜く"""
    img = sky_gradient((W, H), [(0, (60, 96, 140)), (0.45, (140, 176, 190)), (0.8, (225, 210, 170)), (1, (245, 225, 190))])
    layer = img.convert('RGBA')
    sea = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw_waves(sea, 660, 16, (60, 120, 130), alpha=230, n=48, seed=28)
    layer = paste_layer(layer, sea)
    fill_l = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    fd0 = ImageDraw.Draw(fill_l)
    fd0.rectangle([0, 660, W, H], fill=(40, 92, 104, 255))
    layer = paste_layer(layer, fill_l)
    foam = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    fmd = ImageDraw.Draw(foam)
    rnd = random.Random(29)
    for _ in range(120):
        x = rnd.uniform(0, W)
        y = rnd.uniform(660, 880)
        r = rnd.uniform(2, 6)
        fmd.ellipse([x - r, y - r * 0.4, x + r, y + r * 0.4], fill=(220, 235, 235, rnd.randint(90, 170)))
    layer = paste_layer(layer, foam)
    # 扇を掲げた小舟（平家方）
    boat_l = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw_boat(boat_l, 1180, 700, 0.85, (26, 20, 18, 255), sail=False)
    bpd = ImageDraw.Draw(boat_l)
    pole_x, pole_top = 1180, 560
    bpd.line([(pole_x, 690), (pole_x, pole_top)], fill=(20, 16, 14, 255), width=4)
    bpd.polygon([(pole_x, pole_top), (pole_x + 46, pole_top + 8), (pole_x + 36, pole_top + 44), (pole_x - 4, pole_top + 30)], fill=(210, 30, 30, 255))
    layer = paste_layer(layer, boat_l)
    # 波間で弓を引く与一（騎馬・海に乗り入れる）
    figs = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw_mounted_warrior(figs, 480, 800, 1.15, (24, 20, 18), 1, 'bow')
    layer = paste_layer(layer, figs)
    # 矢のライン（扇へ向かう軌跡）
    arrow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ad = ImageDraw.Draw(arrow)
    ad.line([(560, 730), (1120, 610)], fill=(30, 26, 22, 220), width=3)
    ad.polygon([(1120, 610), (1104, 616), (1112, 600)], fill=(30, 26, 22, 220))
    layer = paste_layer(layer, arrow)
    bl2 = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    birds(bl2, [(1300, 300, 1.0), (1340, 330, 0.9)], color=(40, 40, 40, 200))
    layer = paste_layer(layer, bl2)
    return layer


def _antoku_suibotsu():
    """安徳天皇入水 — 1185年3月、壇ノ浦。荒天の海に小舟が沈む（遠景・象徴表現、写実描写を避ける）"""
    img = sky_gradient((W, H), [(0, (24, 26, 34)), (0.5, (52, 60, 66)), (1, (90, 100, 100))])
    layer = img.convert('RGBA')
    cloud = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    cd = ImageDraw.Draw(cloud)
    rnd = random.Random(30)
    for _ in range(8):
        cx = rnd.uniform(0, W)
        cy = rnd.uniform(30, 200)
        cw = rnd.uniform(200, 460)
        cd.ellipse([cx - cw, cy - cw * 0.22, cx + cw, cy + cw * 0.22], fill=(16, 20, 24, 100))
    cloud = cloud.filter(ImageFilter.GaussianBlur(34))
    layer = paste_layer(layer, cloud)
    sea = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sfd = ImageDraw.Draw(sea)
    sfd.rectangle([0, 460, W, H], fill=(34, 50, 52, 255))
    layer = paste_layer(layer, sea)
    wave_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for i in range(9):
        draw_waves(wave_layer, 500 + i * 46, 16, (56 + i * 5, 78 + i * 4, 80 + i * 3), alpha=170, n=52, seed=40 + i)
    layer = paste_layer(layer, wave_layer)
    # 遠く沈みゆく小舟（御座船）と、静かに沈む三種の神器を思わせる淡い光。人物の写実描写は行わない
    boat_l = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw_boat(boat_l, 800, 660, 0.55, (18, 20, 20, 210), sail=False)
    layer = paste_layer(layer, boat_l)
    glow = fire_glow(layer, 800, 700, 60, inner=(230, 225, 200), outer=(70, 90, 90))
    layer = paste_layer(layer, glow)
    ripple = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    rpd = ImageDraw.Draw(ripple)
    for r in range(20, 140, 20):
        rpd.arc([800 - r, 690 - r * 0.35, 800 + r, 690 + r * 0.35], 0, 360, fill=(80, 100, 100, 120), width=3)
    layer = paste_layer(layer, ripple)
    # 波間に漂う旗（赤地、平氏の敗北を静かに示す）
    flag_l = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    fld = ImageDraw.Draw(flag_l)
    fld.polygon([(430, 700), (470, 690), (466, 720), (426, 726)], fill=(150, 30, 30, 220))
    layer = paste_layer(layer, flag_l)
    return layer


def _koromogawa():
    """衣川 — 1189年4月、奥州・雪残る山峡の館。義経最期の地"""
    img = sky_gradient((W, H), [(0, (40, 40, 60)), (0.5, (98, 92, 108)), (1, (168, 160, 164))])
    layer = img.convert('RGBA')
    layer = paste_layer(layer, mountain_range((W, H), 560, [(0, 0.12), (0.3, 0.20), (0.6, 0.13), (1, 0.22)], (120, 118, 128), jitter=10, seed=31))
    layer = paste_layer(layer, mountain_range((W, H), 640, [(0, 0.06), (0.4, 0.11), (0.75, 0.07), (1, 0.10)], (150, 148, 154), jitter=6, seed=32))
    # 雪化粧（山肌の白）
    snowcap = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    scd = ImageDraw.Draw(snowcap)
    for (px, py) in [(260, 470), (700, 430), (1180, 460), (1420, 490)]:
        scd.polygon([(px - 60, py + 30), (px, py - 40), (px + 60, py + 30)], fill=(230, 230, 234, 200))
    layer = paste_layer(layer, snowcap)
    layer = paste_layer(layer, forest_ridge((W, H), 700, 90, (56, 54, 60), density=60, seed=33))
    # 川
    river = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw_waves(river, 760, 8, (170, 174, 176), alpha=200, n=40, seed=34)
    layer = paste_layer(layer, river)
    fillriver = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    frd = ImageDraw.Draw(fillriver)
    frd.rectangle([0, 760, W, 830], fill=(140, 146, 150, 160))
    layer = paste_layer(layer, fillriver)
    # 高館（衣川館）— 木造の館。天守閣ではなく板葺きの質素な館として描く
    house = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    hd = ImageDraw.Draw(house)
    hx, hy = 780, 620
    hd.polygon([(hx - 130, hy + 60), (hx - 130, hy), (hx, hy - 70), (hx + 130, hy), (hx + 130, hy + 60)], fill=(46, 40, 38, 255))
    hd.rectangle([hx - 110, hy + 20, hx + 110, hy + 60], fill=(38, 32, 30, 255))
    hd.polygon([(hx - 150, hy + 60), (hx - 130, hy - 4), (hx - 110, hy + 60)], fill=(40, 34, 32, 255))
    hd.polygon([(hx + 110, hy + 60), (hx + 130, hy - 4), (hx + 150, hy + 60)], fill=(40, 34, 32, 255))
    # 柵・囲い
    for fx in range(hx - 220, hx + 240, 26):
        hd.line([(fx, hy + 70), (fx, hy + 30)], fill=(30, 26, 24, 255), width=4)
    layer = paste_layer(layer, house)
    # 立ち上る煙
    smoke = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    smd = ImageDraw.Draw(smoke)
    smd.ellipse([hx - 40, hy - 160, hx + 60, hy - 40], fill=(70, 66, 66, 90))
    smoke = smoke.filter(ImageFilter.GaussianBlur(30))
    layer = paste_layer(layer, smoke)
    # 館を守る孤影の武者（垣の上、後ろ姿）
    figs = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw_warrior_standing(figs, hx - 150, hy + 20, 0.8, (26, 22, 22), 1, 'naginata')
    layer = paste_layer(layer, figs)
    snow_l = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    snow(snow_l, 220, seed=35)
    layer = paste_layer(layer, snow_l)
    return layer


if __name__ == '__main__':
    scenes = {
        'ishibashiyama.webp': (_ishibashiyama, 11),
        'fujikawa.webp': (_fujikawa, 12),
        'kurikara.webp': (_kurikara, 13),
        'ujigawa.webp': (_ujigawa, 14),
        'ichinotani.webp': (_ichinotani, 15),
        'yashima.webp': (_yashima, 16),
        'dannoura.webp': (_dannoura, 17),
        'mochihito-decree.webp': (_mochihito_decree, 18),
        'kiyomori-death.webp': (_kiyomori_death, 19),
        'nanto-shoutou.webp': (_nanto_shoutou, 20),
        'miyako-ochi.webp': (_miyako_ochi, 21),
        'atsumori.webp': (_atsumori, 22),
        'nasu-no-yoichi.webp': (_nasu_no_yoichi, 23),
        'antoku-suibotsu.webp': (_antoku_suibotsu, 24),
        'koromogawa.webp': (_koromogawa, 25),
    }
    for name, (fn, seed) in scenes.items():
        img = fn()
        finalize(img, os.path.join(OUT, name), seed=seed)
