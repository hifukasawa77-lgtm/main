# 法務チェックレポート — ZELDA QUEST (game.html)

実施日: 2026-06-02
対象: `/home/user/main/game.html` および `/home/user/main/assets/zelda-like/` 配下全アセット
用途: 個人ポートフォリオ（非商用・GitHub Pages 公開）

---

## サマリー

| レベル | 件数 |
|---|---|
| RED（即時修正必須） | 2件 |
| YELLOW（要対応） | 2件 |
| GREEN（問題なし） | 5件 |

---

## [RED] 即時修正必須

### RED-1: タイトル "ZELDA QUEST" — Nintendo登録商標の直接使用

**対象箇所:**

| ファイル | 行番号 | 内容 |
|---|---|---|
| game.html | 7 | `<title>ZELDA QUEST — ブラウザで遊べるトップビューRPG …` |
| game.html | 12 | `<meta property="og:title" content="ZELDA QUEST — …"` |
| game.html | 18 | `<meta name="twitter:title" content="ZELDA QUEST — …"` |
| game.html | 264 | `ctx.fillText('ZELDA QUEST', …)` （Canvas描画タイトル） |
| game.html | 415 | Twitter シェアURLのパラメータ `text=ZELDA+QUEST` および `hashtags=…ZELDAQUEST` |

**問題内容:**

"ZELDA" は Nintendo of America Inc. の登録商標（米国商標登録番号 2345332、International Class 28）であり、日本・EU等でも同様に商標登録されている。ゲームタイトルへの "ZELDA" の直接使用は商標権侵害を構成するリスクが高い。

Nintendoは非商用・個人利用を問わず知的財産権を積極的に行使する方針を明確にしており、GitHub上のファンゲームへのDMCA申告および削除事例が複数確認されている（例: "The Legend of Zelda: The Missing Link" — 2020年にGitHubから削除）。非商用であることはNintendo商標への侵害抗弁とならない。商標権者は市場での混同（消費性者が公式作品と誤認するリスク）を根拠に、無償配布のファンワークに対しても法的措置を取ることができる。

**修正アクション:**

1. ゲームの独自タイトルを設定し、"ZELDA" の文字列をすべて置換する。
   - 例: "FAHREN QUEST"（ゲーム内世界名 "Fahren Kingdom" を活用）、"BLADE QUEST" 等
2. 修正対象: game.html 7行目（`<title>`）、12行目（og:title）、18行目（twitter:title）、264行目（Canvas描画）、415行目（Twitterシェアリンク）

---

### RED-2: メタタグ "ゼルダ風トップビューRPG" — 商標関連語句による検索誘導リスク

**対象箇所:**

| ファイル | 行番号 | 内容 |
|---|---|---|
| game.html | 8 | `<meta name="description" content="Canvas APIのみで作ったゼルダ風トップビューRPG…"` |
| game.html | 13 | `<meta property="og:description" content="…ゼルダ風トップビューRPG…"` |
| game.html | 19 | `<meta name="twitter:description" content="…ゼルダ風トップビューRPG…"` |

**問題内容:**

"ゼルダ" はNintendoの登録商標 "ゼルダの伝説"（日本商標）に由来する名称であり、メタタグへの使用は検索エンジン上でNintendo IPとの関連性を示唆し、商標的使用（trademark use in commerce）と認定されるリスクがある。特にタイトル "ZELDA QUEST" と組み合わさった状態では、Nintendo公式との混同を招く可能性が高まる。

"ゼルダ風"という表現は業界の慣用的描写として使用されることがあるが、RED-1のタイトル商標侵害と組み合わさると一体のリスクを形成する。タイトルをRED-1の対応で修正した後も、メタ記述は "トップビューアクションRPG" 等の一般的なジャンル用語に置き換えることを強く推奨する。

**修正アクション:**

1. 3箇所のメタdescriptionから "ゼルダ風" を削除し、ジャンル記述（例: "クラシックスタイルのトップビューアクションRPG"）に置き換える。
2. RED-1と同時に対応する。

---

## [YELLOW] 要対応

### YELLOW-1: GPT Image 2.0 生成アセット — 著作権帰属と利用条件

**対象ファイル:**

- `assets/zelda-like/player/gpt-image-2-hero-sheet-v3.png`（他 v1/v2 含む計6ファイル）
- `assets/zelda-like/enemies/gpt-image-2-enemy-sheet-v2.png`（他 pack-a/b/c 含む計7ファイル）
- `assets/zelda-like/bosses/gpt-image-2-boss-sheet-v1.png`（計2ファイル）
- `assets/zelda-like/npcs/gpt-image-2-npc-sheet-v3.png`（他 v1/v2 含む計6ファイル）
- `assets/zelda-like/objects/gpt-image-2-*.png`（計8ファイル）
- `assets/zelda-like/terrain/gpt-image-2-terrain-sheet.png`（計2ファイル）
- `assets/zelda-like/world-map-fahren-25x25.png`（他 jpg/svg 含む関連ファイル）

**確認できた利用条件:**

OpenAIの利用規約（2024年以降の版）は、ユーザーがサービスを通じて生成したアウトプットについてOpenAIが保有する権利をユーザーへ譲渡することを明記しており、商用利用も原則許可されている。GitHub Pages での非商用ポートフォリオ公開はこの条件の範囲内である。

**残存するリスク:**

1. **著作権保護なし（公有）**: AIが生成した画像には人間の創作性がなく、各国著作権法（米国著作権局の2025年1月レポート、日本の文化庁ガイドライン）上、著作権保護を受けない可能性が高い。ユーザーは排他的権利を持たない（他者も同等の画像を利用可能）。個人ポートフォリオ用途では実害は限定的。
2. **非侵害の無保証**: OpenAIは生成アウトプットが第三者の権利を侵害しないことを保証しない。ただしREADME.mdのプロンプト記録に「no copyrighted Zelda/Nintendo likeness」と明示されており、意図的な侵害回避の証跡として有効。
3. **"ゼルダ"関連プロンプトのリスク**: README.mdのプロンプト記録上、生成時にNintendo IPを排除する指示が明示されている点は評価できる。ただし視覚的類似性（キャラクターの外観・世界観）が問題になるケースは著作権ではなく不競法（unfair competition）の文脈で生じ得る。現時点では過度な類似性の証拠はない。

**推奨対応:**

1. README.mdに「GPT Image 2 生成物はOpenAI利用規約に基づきユーザーに帰属。著作権保護の有無に関する法的判断は専門家に委ねる」旨を追記する。
2. プロンプト記録（README.mdの各セクション）は削除せずに保持する（証跡として有効）。
3. アセットの外観がNintendo IPと著しく類似していると判断した場合は、Graphic-Designerエージェントへ再生成を依頼する。

---

### YELLOW-2: Kenney Roguelike/RPG Pack — game.html での実際の使用状況確認

**対象ファイル:** `assets/zelda-like/kenney_roguelike-rpg-pack/`（License.txt 含む）

**確認結果:**

- ライセンス: Creative Commons Zero (CC0) — 著作権放棄。帰属表示不要、商用利用・改変・再配布すべて自由。
- game.html 内での参照: `assets/zelda-like/kenney_roguelike-rpg-pack/` へのパス参照は **ゼロ件**。game.htmlが使用しているアセットは `world-map-fahren-badon-25x25.svg`（SVGファイル）のみ。
- README.md記載の `Spritesheet/roguelikeSheet_transparent.png` への参照も game.html には存在しない。

**問題内容:**

Kenney素材自体はCC0であり法的問題はない。ただし README.md が「`zelda_like.html`」を参照しているのに対し、実際のゲームファイルは `game.html` であり、ドキュメントとコードの整合性が取れていない。将来的に誤解を生む可能性がある。

**推奨対応:**

1. README.mdの参照ファイル名を `zelda_like.html` から `game.html` に修正する（軽微な文書整合性対応）。
2. Kenney パックがゲームで使用されていない場合、不要ファイルとしてリポジトリ容量削減のため削除を検討する（法的義務ではない）。

---

## [GREEN] 問題なし

| 対象 | ライセンス | 確認事項 |
|---|---|---|
| 外部ライブラリ（CDN） | なし | game.htmlはCanvas APIのみで実装。外部ライブラリ依存ゼロ。問題なし。 |
| システムフォント（monospace） | OS付属 | `font: 'bold 40px monospace'` — OSシステムフォント。ライセンス問題なし。 |
| ゲームメカニクス（トップビューRPG） | 該当なし | トップビューRPGはジャンル共通。メカニクス自体は著作権保護の対象外。問題なし。 |
| Kenney Roguelike/RPG Pack（素材） | CC0 | Creative Commons Zero。帰属表示不要、商用利用可。License.txtがリポジトリ内に保持されている。問題なし。 |
| 音楽・効果音 | なし | game.htmlに音楽・SEなし。JASRAC/NexTone管理楽曲リスクなし。問題なし。 |

---

## 修正優先順位と推奨アクション一覧

| 優先度 | 対象 | アクション | 担当 |
|---|---|---|---|
| 1（即時） | game.html タイトル "ZELDA QUEST" 全5箇所 | "FAHREN QUEST"等の独自タイトルへ置換 | Code-Generator |
| 2（即時） | game.html メタdescription "ゼルダ風" 3箇所 | "トップビューアクションRPG"等のジャンル表記へ置換 | Code-Generator |
| 3（推奨） | assets/zelda-like/README.md ファイル名誤記 | `zelda_like.html` → `game.html` に修正 | Code-Generator |
| 4（任意） | assets/zelda-like/README.md OpenAI利用規約注記 | GPT Image 2アウトプット利用条件の簡潔な注記を追加 | Code-Generator |

---

## 注意事項

- 本レポートはAIによる一次確認であり、法的効力を持ちません。
- Nintendo商標に関する最終的な法的判断（侵害成否・リスク許容範囲）は弁護士・弁理士への相談を推奨します。
- 「個人ポートフォリオ = 非商用」の解釈は一般的に成立しますが、GitHub Pages経由での公開は不特定多数に向けた公衆送信であり、商標上の「使用」（trademark use）に該当しうる点に注意してください。
- GPT Image 2生成アセットの著作権保護有無については、各国の法制度・判例が現在も形成中であり、本レポートの判断は2026年6月時点の情報に基づくものです。

---

*チェック実施: Legal-Checker エージェント / 2026-06-02*
