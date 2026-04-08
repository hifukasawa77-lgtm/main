# hide_0001

日本の民間伝承をテーマにしたインタラクティブなゲームコレクション

## ? プロジェクト概要

このリポジトリには、日本の妖怪や伝統的なゲームをインスピレーションにした、3つの異なるゲーム体験が含まれています。

## ? プロジェクト構成

### **shogi_rpg_enhanced.jsx** - 将棋RPGゲーム
- **概要**: 将棋の駒を使用したパズルRPG
- **機能**:
  - 9×9のボード上での駒の移動とマッチング
  - 日本の妖怪を敵として登場（ざしき童子、河童、天狗、鬼、九尾の狐など）
  - 難易度設定（イージー、ノーマル、ハード）
  - ショップシステム（回復アイテム、防具、攻撃道具など80種類以上）
  - ディリーミッション、ランキング、妖怪図鑑収集
- **技術**: React、SVG、Web Audio API
- **ファイルサイズ**: 3430行（要リファクタリング）

### **game.html** - ダンジョンタイルゲーム
- **概要**: ローグライク風ダンジョンRPG
- **機能**:
  - タイルベース移動システム
  - スライム、コウモリ、ボスエネミーとのバトル
  - キーアイテムとドアロック機構
  - マップ生成と複数ステージ
- **技術**: Vanilla JavaScript + Canvas API

### **index.html** - ポートフォリオサイト
- **概要**: 個人のポートフォリオページ
- **機能**:
  - 自己紹介、スキルセクション
  - プロジェクトショーケース
  - コンタクト情報
  - レスポンシブデザイン
- **技術**: HTML5、CSS3、Vanilla JavaScript

### **SakuraLikeEditor/** - Windows向けテキストエディター（サクラエディター風）
- **概要**: Windows 11対応のWPFテキストエディター
- **機能**:
  - タブ編集 / 開く・保存
  - 行番号 / 折り返し / 検索・置換 / ズーム
  - 文字コード（UTF-8 / Shift-JIS(CP932) など）
- **技術**: .NET 8 + WPF

## ? 使用方法

1. `index.html` をブラウザで開く（ポートフォリオサイト）
2. `game.html` をブラウザで開く（ダンジョンゲーム）
3. `shogi_rpg_enhanced.jsx` は React環境で実行
4. `SakuraLikeEditor/` は `dotnet run --project SakuraLikeEditor/SakuraLikeEditor.csproj` で起動

## ? 技術スタック

- **Frontend**: React, HTML5, CSS3, JavaScript ES6+
- **Graphics**: SVG, Canvas API
- **Audio**: Web Audio API
- **Storage**: LocalStorage（スコア、実績保存）

## ? 今後の改善提案

- [ ] shogi_rpg_enhanced.jsx をコンポーネント分割して保守性向上
- [ ] CSS-in-JSライブラリの導入（styled-components等）
- [ ] ゲームUIのアクセシビリティ向上
- [ ] 日本語テキストの文字化け対策（UTF-8統一）
- [ ] ユニットテストの追加
- [ ] API統合（オンラインランキング等）

## ? ライセンス

MIT

## ? Author

hide

