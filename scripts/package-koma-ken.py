#!/usr/bin/env python3
"""降魔七星剣の確認用ZIPを作成する（公開・Git操作は行わない）。"""
import argparse
import hashlib
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
PREFIX = "koma-ken-preview/"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="出力ZIPのパス")
    args = parser.parse_args()
    sources = [ROOT / "koma_ken.html", ROOT / "assets/js/frame-guard.js"]
    sources.extend(sorted(p for p in (ROOT / "assets/koma-ken").rglob("*") if p.is_file()))
    files = {p.relative_to(ROOT).as_posix(): p.read_bytes() for p in sources}
    files["index.html"] = """<!doctype html>
<html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>降魔七星剣 確認版 / Preview</title>
<style>body{max-width:640px;margin:40px auto;padding:20px;background:#0e0c14;color:#eee;font:16px/1.8 sans-serif}a{color:#b9d8ff}a:focus-visible{outline:2px solid white}</style>
<h1>降魔七星剣 / Shichisei-Ken</h1><p>全13面の確認版。最初は無音です。<br>13-stage preview. Sound starts off.</p>
<p><a href="koma_ken.html">ゲームを開く / Play</a></p>
<p>矢印キーで移動、Spaceで跳ぶ、Zで斬る、Xで道具、Enterで休止。タッチ操作にも対応。<br>Arrows: move · Space: jump · Z: sword · X: item · Enter: pause. Touch controls supported.</p>
<p>保存は各面の開始時点です。詳しい操作はゲーム画面下の説明、または休止中にXで確認できます。</p>
<p>確認手順はREADME.txt、技術的な検証結果はassets/koma-ken/README.mdを参照してください。</p></html>
""".encode("utf-8")
    files["README.txt"] = """降魔七星剣 確認版 / Shichisei-Ken Preview

ZIPをすべて展開し、index.html または koma_ken.html をブラウザーで開いてください。
展開したフォルダー構成を変えずに使用してください。インストールやAPIキーは不要です。
初期状態は無音。画面下の音設定で効果音またはBGM付きに変更できます。

保存はこのブラウザー内の「面の開始時点」です。新しい冒険は上書きします。
ファイルを直接開く際の保存動作はブラウザーによって異なります。
「自動保存できません」と表示される場合は、同じフォルダーで次のコマンドを実行し、
http://localhost:8000/ を開いてください（Pythonが必要です）。
  python -m http.server 8000 --bind 127.0.0.1

実機で確認する項目:
1. 縦向き・横向きで画面とボタンが重ならず、短いタップと同時押しが効く。
2. 別アプリに切り替えると休止し、音が停止する。戻っても勝手に再開しない。
3. 無音・効果音のみ・BGM付きと音量0が反映され、聴感上の音量が適切。
4. 新しい面に進んで再読込し、「続きから」がその面の入口を復元する。
5. 休止中の手引・アイテム使用・タイトルへの復帰を操作できる。
6. 通常プレイで全編を通し、難しすぎる箇所・操作しづらい箇所を記録する。
   特に鬼面の女・岩坊主・墓地・魔寺・空の天狗を確認する。

自動操作での個別走破・個別ボス撃破と、人が通常条件で全編をクリアできることは別です。
検証内容と残る制約は assets/koma-ken/README.md に記載しています。
manifest.json に各同梱ファイルのSHA-256を記録しています。
このZIPの作成では公開・コミット・pushは行いません。
""".encode("utf-8")
    manifest = {name: hashlib.sha256(data).hexdigest() for name, data in sorted(files.items())}
    files["manifest.json"] = json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(args.output, "w", compression=ZIP_DEFLATED) as archive:
        for name, data in sorted(files.items()):
            archive.writestr(PREFIX + name, data)
    print(f"{args.output}: {len(files)} files, {args.output.stat().st_size} bytes")


if __name__ == "__main__":
    main()
