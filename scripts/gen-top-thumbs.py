#!/usr/bin/env python3
"""トップページ（index.html）のゲームカード用サムネを、表示幅に合った小さい WebP として作る。

    python3 scripts/gen-top-thumbs.py          # 生成し、index.html のカード内 <img> の参照を差し替える
    python3 scripts/gen-top-thumbs.py --check  # 生成物が原画より古い／参照が原画のまま、を検出（非0終了）

- 原画（assets/<game>/...）は**触らない**。ゲーム本体が drawImage の source-rect で原寸を前提に使っている
  ことがあり、縮小すると無言で絵が消える（CLAUDE.md「解像度は変えない」）。ここで作るのは別ファイルの写し。
- 出力: assets/thumbs/<原画パスを - でつないだ名前>（幅 720px 以下・q82・アルファ保持）。
  カードの表示幅は最大 ~380px なので、2倍密度の画面でも 720px で足りる。
- 対象: カード内の <img src="assets/...webp"> のうち 60KB を超えるもの。
"""
import os
import re
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, 'index.html')
OUT_DIR = 'assets/thumbs'
MAX_W = 720
MIN_BYTES = 60_000


def thumb_path(src: str) -> str:
    rel = src[len('assets/'):]
    return f"{OUT_DIR}/{rel.replace('/', '-')}"


def main() -> int:
    check = '--check' in sys.argv
    html = open(INDEX, encoding='utf-8').read()
    start = html.index('<div class="works-grid">')
    end = html.index('<section id="tools"')
    grid = html[start:end]

    problems = []
    replaced = 0

    def repl(m: re.Match) -> str:
        nonlocal replaced
        tag, src = m.group(0), m.group(1)
        if src.startswith(OUT_DIR + '/'):
            return tag  # 差し替え済み（写しの実在は下で確認）
        full = os.path.join(ROOT, src)
        if not os.path.exists(full) or os.path.getsize(full) <= MIN_BYTES:
            return tag
        dst = thumb_path(src)
        dst_full = os.path.join(ROOT, dst)
        if check:
            problems.append(f'参照が原画のまま: {src}')
            return tag
        im = Image.open(full)
        w, h = im.size
        if w > MAX_W:
            nh = round(h * MAX_W / w)
            im = im.resize((MAX_W, nh), Image.LANCZOS)
        os.makedirs(os.path.dirname(dst_full), exist_ok=True)
        im.save(dst_full, 'WEBP', quality=82, method=6)
        nw, nh = im.size
        new = tag.replace(f'src="{src}"', f'src="{dst}"')
        # 縦横比の予約（CLS対策）を新しい寸法に合わせる。比は同じ
        new = re.sub(r'\bwidth="\d+"', f'width="{nw}"', new)
        new = re.sub(r'\bheight="\d+"', f'height="{nh}"', new)
        replaced += 1
        print(f'  {os.path.getsize(full)//1024:>4}KB → {os.path.getsize(dst_full)//1024:>3}KB  {dst}')
        return new

    new_grid = re.sub(r'<img[^>]*src="(assets/[^"]+\.webp)"[^>]*>', repl, grid)

    # 生成済みの写しが原画より古くないか（原画を差し替えたのに写しが古いまま、を拾う）
    for src in re.findall(r'src="(' + OUT_DIR + r'/[^"]+)"', new_grid):
        if not os.path.exists(os.path.join(ROOT, src)):
            problems.append(f'写しが無い: {src}')

    if check:
        if problems:
            print('❌ top-thumbs:\n  ' + '\n  '.join(problems) + '\n  → python3 scripts/gen-top-thumbs.py')
            return 1
        print('✅ top-thumbs: カードのサムネはすべて軽量版を参照')
        return 0

    open(INDEX, 'w', encoding='utf-8').write(html[:start] + new_grid + html[end:])
    print(f'✅ {replaced} 枚を軽量版へ差し替え')
    return 0


if __name__ == '__main__':
    sys.exit(main())
