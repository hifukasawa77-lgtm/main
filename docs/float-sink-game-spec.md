# 仕様書：うかぶ？しずむ？ — 浮力パズルゲーム

**バージョン**: 1.0.0  
**作成日**: 2026-05-19  
**対象プラットフォーム**: iOS / Android（Flutter）

---

## 目次

1. [要件定義書](#1-要件定義書)
2. [基本設計書](#2-基本設計書)
3. [詳細設計書](#3-詳細設計書)

---

# 1. 要件定義書

## 1.1 背景・目的

小学校理科「物の浮き沈み」単元に対応した教育的モバイルゲーム。  
アルキメデスの原理（浮力 = ρ_fluid × V_displaced × g）をインタラクティブに体験させることで、科学的思考力を楽しみながら養う。  
対象ユーザーは小学生〜中学生（保護者の見守り利用を含む）。

## 1.2 対象ユーザー

| 区分 | 年齢層 | 利用シーン |
|------|--------|-----------|
| メインターゲット | 8〜14歳 | 自由遊び・宿題補助 |
| サブターゲット | 保護者・教師 | 学習管理・授業補助ツール |

## 1.3 機能要件一覧（MoSCoW法）

### Must（必須）

| ID | 機能 | 説明 |
|----|------|------|
| F-001 | メインゲームプレイ | 水槽に野菜・果物をドラッグ＆ドロップし、浮く/沈むをリアルタイムで確認 |
| F-002 | 物理演算（浮力） | アルキメデスの原理に基づく密度計算・水位変化・浮力/重力のリアルタイム計算 |
| F-003 | 食材データベース | 最低10種の食材（密度・体積・形状データ付き） |
| F-004 | ミッションモード | 条件達成型の課題（水位〇%以上、〇個浮かせる等） |
| F-005 | 実績システム | バッジ収集・解除条件の管理 |
| F-006 | チュートリアル | 初回起動時の操作説明（スキップ可能） |
| F-007 | 結果表示 | 各食材が浮いた/沈んだ理由を密度と共に表示 |

### Should（重要）

| ID | 機能 | 説明 |
|----|------|------|
| F-008 | AI対戦モード | CPUが食材を選び、先に目標達成した方が勝ち |
| F-009 | 着水・波紋エフェクト | 食材投入時のアニメーション演出 |
| F-010 | 落下アニメーション | 重力に従った自然な落下表現 |
| F-011 | 進捗保存 | ミッション達成状況・実績のローカル保存 |
| F-012 | サウンドエフェクト | 着水音・浮上音・ミッション達成音 |

### Could（あれば良い）

| ID | 機能 | 説明 |
|----|------|------|
| F-013 | 食材追加（将来拡張） | DLC or アップデートで食材を追加する仕組み |
| F-014 | スコアランキング | ローカルまたはオンラインのハイスコア |
| F-015 | 学習レポート | 保護者向けに正解率・プレイ時間を表示 |
| F-016 | 多言語対応 | 日本語・英語切り替え |

### Won't（今回スコープ外）

| ID | 機能 | 理由 |
|----|------|------|
| F-017 | オンラインマルチプレイ | バックエンド構築が必要、初版スコープ外 |
| F-018 | AR機能 | 実装コスト過大 |
| F-019 | アカウント連携（SNS） | プライバシーポリシー対応が複雑 |

## 1.4 非機能要件

| 区分 | 要件 |
|------|------|
| パフォーマンス | 60fps維持（物理演算込み）。起動3秒以内（コールドスタート） |
| セキュリティ | 個人情報収集なし。COPPA準拠（13歳未満対応） |
| 互換性 | iOS 14.0以上 / Android 8.0（API 26）以上 |
| アクセシビリティ | 文字サイズ: 最小14sp。色覚補助は任意拡張 |
| ストア申請 | App Store / Google Play のガイドライン準拠 |
| オフライン | 全機能オフラインで動作すること |
| ファイルサイズ | APK/IPA: 50MB以内（素材圧縮を含む） |

## 1.5 制約条件

- ビルドツール: Flutter + Dart のみ（pubspec.yaml管理）
- 物理エンジン: Flame + Forge2D（Box2D物理）を採用。複雑性に応じてカスタムCanvasPainterへ移行可
- サードパーティ依存: pub.dev パッケージのみ許可
- 課金機能: 初版は不要（広告なし、完全無料）

## 1.6 画面一覧

| 画面ID | 画面名 | 遷移元 |
|--------|--------|--------|
| S-001 | スプラッシュ画面 | アプリ起動 |
| S-002 | タイトル / メニュー画面 | スプラッシュ後 |
| S-003 | チュートリアル画面 | タイトル（初回のみ） |
| S-004 | フリープレイ画面 | メニュー |
| S-005 | ミッション選択画面 | メニュー |
| S-006 | ミッションゲームプレイ画面 | ミッション選択 |
| S-007 | AI対戦画面 | メニュー |
| S-008 | 実績・バッジ画面 | メニュー |
| S-009 | 結果・解説画面 | プレイ終了後 |
| S-010 | 設定画面 | メニュー（歯車アイコン） |

## 1.7 ゲームフロー

```
[起動]
  → スプラッシュ（ロゴ・タイトル表示、2秒）
  → [初回?] → チュートリアル → タイトルメニュー
  → [既存] → タイトルメニュー

[タイトルメニュー]
  ├─ フリープレイ → 食材選択 → プレイ → 結果・解説
  ├─ ミッション → ステージ選択 → プレイ → 合否判定 → 実績解除? → 結果
  ├─ AI対戦 → 対戦設定 → 対戦プレイ → 勝敗表示
  ├─ 実績 → バッジ一覧
  └─ 設定 → サウンド/言語等

[ゲームプレイ共通フロー]
  食材パネルから選択 → ドラッグ → 水槽上でドロップ
  → 落下アニメーション → 着水エフェクト
  → 浮力計算 → 浮く/沈むアニメーション
  → 密度・判定テキスト表示
  → ミッション条件チェック → 達成なら結果画面へ
```

---

# 2. 基本設計書

## 2.1 アーキテクチャ

**採用パターン**: Riverpod + Repository パターン

```
┌─────────────────────────────────────────────┐
│                   UI Layer                   │
│  (Flutter Widgets / Flame GameWidget)        │
└─────────────────┬───────────────────────────┘
                  │ 状態購読 (ref.watch)
┌─────────────────▼───────────────────────────┐
│              State Layer (Riverpod)          │
│  GameStateNotifier / MissionNotifier         │
│  AchievementNotifier / AudioNotifier         │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│             Domain / Logic Layer             │
│  PhysicsEngine / FoodDatabase                │
│  MissionEvaluator / AchievementService       │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│            Data Layer (Repository)           │
│  LocalStorageRepository (SharedPreferences)  │
│  FoodDataSource (静的JSON)                   │
└─────────────────────────────────────────────┘
```

## 2.2 ファイル・ディレクトリ構成

```
float_sink_game/                    ← Flutterプロジェクトルート
├── android/                        ← Android固有ファイル（自動生成）
├── ios/                            ← iOS固有ファイル（自動生成）
├── assets/
│   ├── images/
│   │   ├── foods/                  ← 食材スプライト（PNG, 256x256）
│   │   │   ├── apple.png
│   │   │   ├── carrot.png
│   │   │   ├── cucumber.png
│   │   │   ├── potato.png
│   │   │   ├── tomato.png
│   │   │   ├── lemon.png
│   │   │   ├── watermelon.png
│   │   │   ├── broccoli.png
│   │   │   ├── radish.png
│   │   │   └── orange.png
│   │   ├── ui/                     ← UIパーツ（ボタン・バッジ等）
│   │   └── backgrounds/            ← 背景画像
│   ├── audio/
│   │   ├── splash.mp3              ← 着水音
│   │   ├── float.mp3               ← 浮上音
│   │   ├── sink.mp3                ← 沈む音
│   │   ├── mission_clear.mp3
│   │   └── bgm_main.mp3
│   └── data/
│       ├── foods.json              ← 食材マスターデータ
│       └── missions.json           ← ミッション定義
├── lib/
│   ├── main.dart                   ← エントリーポイント
│   ├── app.dart                    ← MaterialApp + Riverpod設定
│   ├── core/
│   │   ├── constants.dart          ← 定数（重力・水密度・色等）
│   │   ├── theme.dart              ← アプリカラーテーマ
│   │   └── router.dart             ← go_router ルーティング定義
│   ├── data/
│   │   ├── models/
│   │   │   ├── food_item.dart      ← 食材データモデル
│   │   │   ├── mission.dart        ← ミッションデータモデル
│   │   │   └── achievement.dart    ← 実績データモデル
│   │   ├── datasources/
│   │   │   ├── food_data_source.dart    ← JSONから食材読み込み
│   │   │   └── local_storage.dart       ← SharedPreferences操作
│   │   └── repositories/
│   │       ├── food_repository.dart
│   │       ├── mission_repository.dart
│   │       └── achievement_repository.dart
│   ├── domain/
│   │   ├── physics/
│   │   │   ├── physics_engine.dart      ← 浮力計算エンジン
│   │   │   ├── water_simulation.dart    ← 水位・波紋シミュレーション
│   │   │   └── physics_body.dart       ← 物体の物理状態
│   │   ├── services/
│   │   │   ├── mission_evaluator.dart   ← ミッション達成判定
│   │   │   └── achievement_service.dart ← 実績解除判定
│   │   └── ai/
│   │       └── cpu_player.dart         ← AI対戦ロジック
│   ├── presentation/
│   │   ├── providers/               ← Riverpod プロバイダー
│   │   │   ├── game_state_provider.dart
│   │   │   ├── mission_provider.dart
│   │   │   ├── achievement_provider.dart
│   │   │   └── audio_provider.dart
│   │   ├── screens/
│   │   │   ├── splash_screen.dart
│   │   │   ├── title_screen.dart
│   │   │   ├── tutorial_screen.dart
│   │   │   ├── free_play_screen.dart
│   │   │   ├── mission_select_screen.dart
│   │   │   ├── game_play_screen.dart   ← ゲームメイン画面（共通）
│   │   │   ├── ai_battle_screen.dart
│   │   │   ├── achievement_screen.dart
│   │   │   ├── result_screen.dart
│   │   │   └── settings_screen.dart
│   │   ├── widgets/
│   │   │   ├── aquarium/
│   │   │   │   ├── aquarium_widget.dart     ← 水槽描画ウィジェット
│   │   │   │   ├── water_painter.dart       ← CustomPainter: 水面
│   │   │   │   └── ripple_painter.dart      ← CustomPainter: 波紋
│   │   │   ├── food/
│   │   │   │   ├── food_card.dart           ← 食材選択カード
│   │   │   │   ├── food_draggable.dart      ← ドラッグ操作
│   │   │   │   └── food_sprite.dart         ← ゲーム内食材表示
│   │   │   ├── hud/
│   │   │   │   ├── water_level_gauge.dart   ← 水位ゲージ
│   │   │   │   ├── mission_panel.dart       ← ミッション状態表示
│   │   │   │   └── density_tooltip.dart     ← 密度・判定ツールチップ
│   │   │   └── common/
│   │   │       ├── animated_button.dart
│   │   │       └── badge_widget.dart
│   │   └── game/                    ← Flame GameWidget関連（物理重視の場合）
│   │       ├── float_sink_game.dart  ← FlameGame サブクラス
│   │       ├── aquarium_component.dart
│   │       └── food_component.dart
├── test/
│   ├── physics_engine_test.dart
│   ├── mission_evaluator_test.dart
│   └── food_repository_test.dart
└── pubspec.yaml
```

## 2.3 pubspec.yaml 主要パッケージ

```yaml
name: float_sink_game
description: 浮力物理パズルゲーム「うかぶ？しずむ？」
version: 1.0.0+1

environment:
  sdk: ">=3.0.0 <4.0.0"

dependencies:
  flutter:
    sdk: flutter
  flame: ^1.17.0            # ゲームエンジン（アニメーション・スプライト管理）
  forge2d: ^0.14.0          # Box2D物理エンジン（Flameと統合）
  riverpod: ^2.5.0          # 状態管理
  flutter_riverpod: ^2.5.0
  go_router: ^13.0.0        # 画面遷移
  shared_preferences: ^2.2.0 # ローカルストレージ
  just_audio: ^0.9.37       # サウンド再生
  flutter_animate: ^4.5.0   # UIアニメーション補助

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0

flutter:
  assets:
    - assets/images/foods/
    - assets/images/ui/
    - assets/images/backgrounds/
    - assets/audio/
    - assets/data/
```

## 2.4 物理演算設計

### 採用方針

**カスタムCanvasPainter方式**を基本採用とする（Forge2Dは教育目的の浮力表現に対してオーバースペックであり、カスタム実装の方が密度・水位変化を直感的に制御できるため）。

物体数が多い（5個以上同時）場合のみForge2Dへ移行可能な設計とする。

### 浮力計算モデル

```
【基本変数】
- ρ_w: 水の密度 = 1000.0 kg/m³
- ρ_f: 食材密度（food_item.dartで定義）
- V_f: 食材体積（m³換算係数でゲーム座標に変換）
- g: 重力加速度 = 9.8 m/s²

【浮力計算】
水中に沈んでいる体積: V_sub = V_f × min(1.0, 沈下率)
浮力: F_buoyancy = ρ_w × V_sub × g
重力: F_gravity = ρ_f × V_f × g

【平衡判定】
F_buoyancy > F_gravity → 浮く（ρ_f < ρ_w）
F_buoyancy < F_gravity → 沈む（ρ_f > ρ_w）
F_buoyancy ≈ F_gravity → 境界（ρ_f ≈ ρ_w ± 0.02）

【水位変化】
水槽底面積: A_tank（ゲーム座標でピクセル²）
水位上昇: Δh = V_f_pixel / A_tank（投入した物体の体積分）
  ※沈んだ物体は全体積分、浮いた物体は水中沈下部分の体積分だけ上昇
```

### 食材マスターデータ（assets/data/foods.json）

```json
[
  {
    "id": "apple",
    "nameJa": "りんご",
    "density": 0.85,
    "volume": 0.000350,
    "radius": 40,
    "imagePath": "assets/images/foods/apple.png",
    "floats": true,
    "descJa": "りんごは密度が0.85なので水より軽く、水に浮きます。"
  },
  {
    "id": "carrot",
    "nameJa": "にんじん",
    "density": 1.02,
    "volume": 0.000200,
    "radius": 30,
    "imagePath": "assets/images/foods/carrot.png",
    "floats": false,
    "descJa": "にんじんは密度が1.02なので水より重く、沈みます。"
  },
  {
    "id": "cucumber",
    "nameJa": "きゅうり",
    "density": 0.96,
    "volume": 0.000300,
    "radius": 35,
    "imagePath": "assets/images/foods/cucumber.png",
    "floats": true,
    "descJa": "きゅうりはほぼ水と同じ密度ですが、わずかに軽いので浮きます。"
  },
  {
    "id": "potato",
    "nameJa": "じゃがいも",
    "density": 1.10,
    "volume": 0.000250,
    "radius": 35,
    "imagePath": "assets/images/foods/potato.png",
    "floats": false,
    "descJa": "じゃがいもは密度1.10で水より重いので沈みます。"
  },
  {
    "id": "tomato",
    "nameJa": "トマト",
    "density": 0.97,
    "volume": 0.000200,
    "radius": 32,
    "imagePath": "assets/images/foods/tomato.png",
    "floats": false,
    "descJa": "トマトは水とほぼ同じ密度ですが、わずかに重いため沈みます（演出上ゆっくり沈みます）。"
  },
  {
    "id": "lemon",
    "nameJa": "レモン",
    "density": 0.82,
    "volume": 0.000180,
    "radius": 30,
    "imagePath": "assets/images/foods/lemon.png",
    "floats": true,
    "descJa": "レモンは密度0.82なので軽く、水に浮きます。"
  },
  {
    "id": "watermelon",
    "nameJa": "すいか",
    "density": 0.92,
    "volume": 0.005000,
    "radius": 70,
    "imagePath": "assets/images/foods/watermelon.png",
    "floats": true,
    "descJa": "すいかは大きいですが密度が0.92なので丸ごと浮きます。"
  },
  {
    "id": "broccoli",
    "nameJa": "ブロッコリー",
    "density": 0.64,
    "volume": 0.000400,
    "radius": 45,
    "imagePath": "assets/images/foods/broccoli.png",
    "floats": true,
    "descJa": "ブロッコリーは空気を多く含むため密度が低く、よく浮きます。"
  },
  {
    "id": "radish",
    "nameJa": "大根",
    "density": 1.00,
    "volume": 0.000600,
    "radius": 40,
    "imagePath": "assets/images/foods/radish.png",
    "floats": false,
    "descJa": "大根は水とほぼ同じ密度1.00です。ゲームでは「沈む」判定となります。"
  },
  {
    "id": "orange",
    "nameJa": "みかん",
    "density": 0.84,
    "volume": 0.000220,
    "radius": 32,
    "imagePath": "assets/images/foods/orange.png",
    "floats": true,
    "descJa": "みかんは皮を含めた密度が0.84なので浮きます。"
  }
]
```

## 2.5 画面遷移図

```
[SplashScreen]
     |（2秒後）
     ↓
[TitleScreen]
 ├─ [フリープレイ]──→ [FreePlayScreen]
 │                        ↓（終了ボタン）
 │                    [ResultScreen]
 │
 ├─ [ミッション]───→ [MissionSelectScreen]
 │                        ↓（ステージ選択）
 │                    [GamePlayScreen（ミッション）]
 │                        ↓（達成/失敗）
 │                    [ResultScreen]
 │
 ├─ [AI対戦]───────→ [AIBattleScreen]
 │                        ↓（勝敗決定）
 │                    [ResultScreen]
 │
 ├─ [実績]─────────→ [AchievementScreen]
 │
 └─ [設定]─────────→ [SettingsScreen]
```

## 2.6 データフロー

```
[foods.json] → FoodDataSource → FoodRepository → GameStateNotifier
                                                       ↓
[ユーザー操作: ドラッグ&ドロップ] → GamePlayScreen → PhysicsEngine
                                                       ↓
                                              WaterSimulation（水位更新）
                                                       ↓
                                              MissionEvaluator（達成判定）
                                                       ↓
                                              AchievementService（バッジ解除）
                                                       ↓
                                         LocalStorageRepository（進捗保存）
```

---

# 3. 詳細設計書

## 3.1 データモデル

### FoodItem（lib/data/models/food_item.dart）

```dart
// JSONデシリアライズ対応のfreezeモデル（またはシンプルクラス）
class FoodItem {
  final String id;
  final String nameJa;
  final double density;     // kg/m³（水=1000.0 をゲーム内では 1.0 に正規化）
  final double volume;      // m³（ゲーム座標変換係数を乗算して使用）
  final double radius;      // ゲーム内ピクセル半径
  final String imagePath;
  final bool floats;        // 正解フラグ（密度<1.0）
  final String descJa;      // 解説文（結果画面で表示）

  const FoodItem({...});

  factory FoodItem.fromJson(Map<String, dynamic> json) => FoodItem(
    id: json['id'] as String,
    nameJa: json['nameJa'] as String,
    density: (json['density'] as num).toDouble(),
    volume: (json['volume'] as num).toDouble(),
    radius: (json['radius'] as num).toDouble(),
    imagePath: json['imagePath'] as String,
    floats: json['floats'] as bool,
    descJa: json['descJa'] as String,
  );
}
```

### PhysicsBody（lib/domain/physics/physics_body.dart）

```dart
// ゲーム内で動く食材1個の物理状態
class PhysicsBody {
  final FoodItem food;
  double x;              // 水槽内X座標（ピクセル）
  double y;              // 水槽内Y座標（ピクセル）
  double velocityY;      // Y方向速度（px/frame）
  double submergedRatio; // 水中に沈んでいる割合（0.0〜1.0）
  bool isSettled;        // 静止したか
  bool isFloating;       // 浮いているか

  PhysicsBody({
    required this.food,
    required this.x,
    required this.y,
    this.velocityY = 0.0,
    this.submergedRatio = 0.0,
    this.isSettled = false,
    this.isFloating = false,
  });
}
```

### Mission（lib/data/models/mission.dart）

```dart
enum MissionType {
  waterLevelAbove,   // 水位を〇%以上にする
  floatCount,        // 〇個浮かせる
  sinkCount,         // 〇個沈める
  specificFood,      // 特定食材を入れる
  mixedCondition,    // 複合条件
}

class Mission {
  final String id;
  final String titleJa;
  final String descJa;
  final MissionType type;
  final double targetValue;      // 条件値（%またはカウント）
  final List<String>? requiredFoodIds;  // 特定食材ID（任意）
  final int timeLimit;           // 秒（0=無制限）
  final String badgeId;          // クリア時に解除するバッジID
  bool isCleared;

  Mission({...});

  factory Mission.fromJson(Map<String, dynamic> json) => ...;
}
```

### Achievement（lib/data/models/achievement.dart）

```dart
class Achievement {
  final String id;
  final String titleJa;
  final String descJa;
  final String iconPath;
  bool isUnlocked;
  DateTime? unlockedAt;

  Achievement({...});
}
```

## 3.2 物理エンジン実装

### PhysicsEngine（lib/domain/physics/physics_engine.dart）

```dart
class PhysicsEngine {
  // 定数
  static const double waterDensity = 1.0;   // 正規化（実際は1000 kg/m³）
  static const double gravity = 9.8;         // m/s²
  static const double damping = 0.85;        // 減衰係数（振動収束用）
  static const double frameTime = 1.0 / 60; // 60fps

  // 浮力計算
  // 戻り値: 合力（正=上方向、負=下方向）、単位はゲーム内力単位
  double calculateNetForce(PhysicsBody body, double waterSurfaceY) {
    // submergedRatioを更新
    final bodyTop = body.y - body.food.radius;
    final bodyBottom = body.y + body.food.radius;
    // 水面より下にある割合を計算
    if (bodyTop >= waterSurfaceY) {
      body.submergedRatio = 0.0;
    } else if (bodyBottom <= waterSurfaceY) {
      body.submergedRatio = 1.0;
    } else {
      body.submergedRatio = (waterSurfaceY - bodyTop) / (body.food.radius * 2);
    }

    final buoyancy = waterDensity * body.food.density * body.submergedRatio * body.food.radius;
    final gravityForce = body.food.density * body.food.radius;
    return buoyancy - gravityForce; // 正なら浮力優勢
  }

  // 1フレーム分の物理演算を全物体に適用
  void step(List<PhysicsBody> bodies, WaterSimulation water) {
    for (final body in bodies) {
      if (body.isSettled) continue;

      final netForce = calculateNetForce(body, water.surfaceY);
      body.velocityY -= netForce * frameTime * gravity; // Y軸は下が正
      body.velocityY *= damping;
      body.y += body.velocityY;

      // 着底判定
      if (body.y + body.food.radius >= water.tankBottom) {
        body.y = water.tankBottom - body.food.radius;
        body.velocityY = 0.0;
        if (body.food.density >= waterDensity) body.isSettled = true;
      }

      // 静止判定（速度が閾値以下）
      if (body.velocityY.abs() < 0.2 && body.submergedRatio > 0.0) {
        body.isSettled = true;
        body.isFloating = body.food.density < waterDensity;
      }
    }
  }
}
```

### WaterSimulation（lib/domain/physics/water_simulation.dart）

```dart
class WaterSimulation {
  double baseWaterHeight;    // 初期水位（ピクセル）
  double tankWidth;          // 水槽幅（ピクセル）
  double tankBottom;         // 水槽底Y座標（ピクセル）
  double surfaceY;           // 現在の水面Y座標（ピクセル、画面上方が小）
  double waterLevelPercent;  // 水位割合（0.0〜1.0）
  List<Ripple> ripples;      // 波紋リスト

  WaterSimulation({...});

  // 食材投入時の水位上昇計算
  void addFood(PhysicsBody body) {
    // 水中体積 = π × r² × (沈下長さ) （球体近似）
    final submergedVolume = body.food.radius * body.food.radius * 3.14159 * body.submergedRatio;
    final rise = submergedVolume / tankWidth; // 水槽断面積で割る
    baseWaterHeight += rise;
    surfaceY = tankBottom - baseWaterHeight;
    waterLevelPercent = baseWaterHeight / tankBottom;
    // 波紋を追加
    ripples.add(Ripple(x: body.x, startTime: DateTime.now()));
  }

  // 食材除去時の水位低下
  void removeFood(PhysicsBody body) { ... }

  // 波紋の更新（毎フレーム呼び出し）
  void updateRipples(double dt) {
    ripples.removeWhere((r) => r.isExpired);
    for (final r in ripples) r.update(dt);
  }
}

// 波紋データ
class Ripple {
  final double x;
  final DateTime startTime;
  double radius = 0.0;
  double opacity = 1.0;
  static const double maxRadius = 80.0;
  static const double duration = 1.2; // 秒

  Ripple({required this.x, required this.startTime});

  bool get isExpired => elapsed >= duration;
  double get elapsed =>
      DateTime.now().difference(startTime).inMilliseconds / 1000.0;

  void update(double dt) {
    final t = elapsed / duration;
    radius = maxRadius * t;
    opacity = 1.0 - t;
  }
}
```

## 3.3 各画面の実装仕様

### GamePlayScreen（lib/presentation/screens/game_play_screen.dart）

**役割**: フリープレイ・ミッションモード共通のゲームプレイ画面

**レイアウト**（縦画面固定）:
```
┌─────────────────────────┐
│  [ミッションパネル]       │  ← HUD: MissionPanel（ミッション時のみ表示）
│  水位: ███░░░ 60%        │  ← HUD: WaterLevelGauge
├─────────────────────────┤
│                          │
│     [ 水  槽  ]           │  ← AquariumWidget（CustomPainterで描画）
│   🍎  🥦               │     高さ: 画面の55%
│       🥕(沈)            │
│  ≈≈≈≈≈≈≈≈≈≈≈≈≈        │  ← 波紋アニメーション
│  ■■■■■■■■■■■       │
├─────────────────────────┤
│  [食材パネル] ← 横スクロール │  ← FoodCard × 10種
└─────────────────────────┘
```

**Widget構成**:
```dart
Scaffold
  └─ Column
      ├─ HUDRow（MissionPanel + WaterLevelGauge）
      ├─ Expanded
      │   └─ DragTarget<FoodItem>（水槽全体がドロップ対象）
      │       └─ AquariumWidget（CustomPainter）
      └─ FoodSelectionPanel（横スクロール）
          └─ ListView.builder
              └─ FoodDraggable（各食材カード）
```

**状態管理**:
- `gameStateProvider`: 水槽内の食材リスト・水位・ゲームフェーズ
- `ref.watch(gameStateProvider)` で AquariumWidget を毎フレーム再描画
- `Ticker` (SingleTickerProviderStateMixin) で60fps更新ループを実装

### AquariumWidget（lib/presentation/widgets/aquarium/aquarium_widget.dart）

```dart
class AquariumWidget extends StatelessWidget {
  // CustomPainter に physicsState を渡して描画
  // - WaterPainter: 水面・水中の半透明青描画
  // - RipplePainter: 波紋（円）のフェードアウトアニメ
  // - 各PhysicsBodyの食材スプライト（Image.asset）を重ねる
}
```

**CustomPainter分割方針**:

| Painter | 担当 | `shouldRepaint` 条件 |
|---------|------|---------------------|
| WaterPainter | 水面・水中領域 | 水位変化時 |
| RipplePainter | 波紋の円 | 毎フレーム（波紋アニメ中） |
| FoodPainter | 食材スプライト | 食材座標変化時 |

### FoodDraggable（lib/presentation/widgets/food/food_draggable.dart）

```dart
// Draggableウィジェット
Draggable<FoodItem>(
  data: foodItem,
  child: FoodCard(food: foodItem),           // パネル内の表示
  feedback: FoodSprite(food: foodItem),       // ドラッグ中の半透明スプライト
  childWhenDragging: FoodCard(food: foodItem, dimmed: true), // ドラッグ中の元位置
  onDragCompleted: () { /* 成功時 */ },
)

// DragTarget（水槽側）
DragTarget<FoodItem>(
  onWillAccept: (_) => !water.isOverflow,   // 溢れ防止
  onAccept: (food) {
    ref.read(gameStateProvider.notifier).dropFood(food, dropPosition);
  },
  builder: (context, candidateData, rejectedData) => AquariumWidget(...),
)
```

### ResultScreen（lib/presentation/screens/result_screen.dart）

**表示内容**:
- ミッション達成/失敗バナー（アニメーション付き）
- 投入した食材ごとのカード（浮いた/沈んだ + 密度値 + 解説文）
- 新規解除バッジの表示
- 「もう一度」「タイトルへ」ボタン

### TutorialScreen（lib/presentation/screens/tutorial_screen.dart）

**チュートリアルステップ**（合計4ステップ）:
1. 「食材を選んでドラッグしてね」→ 食材パネルをハイライト
2. 「水槽の上でドロップしてみよう」→ 水槽をハイライト
3. 「密度が1より小さいと浮くよ」→ 解説テキスト + アニメ
4. 「ミッションに挑戦してみよう！」→ 完了

## 3.4 状態管理（Riverpod Provider）

### GameStateNotifier（lib/presentation/providers/game_state_provider.dart）

```dart
enum GamePhase { idle, playing, animating, result }

class GameState {
  final List<PhysicsBody> bodies;      // 水槽内の食材（物理状態付き）
  final WaterSimulation water;         // 水シミュレーション状態
  final GamePhase phase;
  final int floatingCount;
  final int sinkingCount;

  GameState({...});
}

class GameStateNotifier extends Notifier<GameState> {
  @override
  GameState build() => GameState(
    bodies: [],
    water: WaterSimulation(/* 初期値 */),
    phase: GamePhase.idle,
    floatingCount: 0,
    sinkingCount: 0,
  );

  // 食材投入処理
  void dropFood(FoodItem food, Offset position) {
    final body = PhysicsBody(food: food, x: position.dx, y: 0.0);
    state = state.copyWith(bodies: [...state.bodies, body]);
    _startFallAnimation(body);
  }

  // 落下・着水・安定化アニメーションループ
  void _startFallAnimation(PhysicsBody body) {
    // Ticker で毎フレーム PhysicsEngine.step() を呼び出し
    // 安定したら MissionEvaluator で達成判定
  }

  // 全リセット
  void reset() { state = build(); }
}
```

## 3.5 AI対戦モード

### CPUPlayer（lib/domain/ai/cpu_player.dart）

**AIレベル設定**:

| レベル | 選択ロジック |
|--------|-------------|
| かんたん | ランダムに食材を選ぶ（正解率50%前後） |
| ふつう | 密度データを参照し、ミッション条件に有利な食材を確率70%で選択 |
| むずかしい | 最適食材を100%正確に選択し、タイミングも最速 |

```dart
class CPUPlayer {
  final AIDifficulty difficulty;

  // 次に投入する食材を決定して返す
  FoodItem selectFood(List<FoodItem> available, Mission mission) {
    switch (difficulty) {
      case AIDifficulty.easy:
        return available[Random().nextInt(available.length)];
      case AIDifficulty.normal:
        return Random().nextDouble() < 0.7
            ? _selectOptimal(available, mission)
            : available[Random().nextInt(available.length)];
      case AIDifficulty.hard:
        return _selectOptimal(available, mission);
    }
  }

  FoodItem _selectOptimal(List<FoodItem> available, Mission mission) {
    // ミッションタイプに応じて最適食材を返す
    // floatCount → density < 1.0 かつ 最大体積
    // waterLevel → 最大体積の食材
    // sinkCount  → density > 1.0 かつ 最大体積
  }

  // CPUの操作を遅延実行（かんたん: 3秒, ふつう: 2秒, むずかしい: 1秒）
  Duration get thinkTime => switch (difficulty) {
    AIDifficulty.easy   => const Duration(seconds: 3),
    AIDifficulty.normal => const Duration(seconds: 2),
    AIDifficulty.hard   => const Duration(seconds: 1),
  };
}
```

## 3.6 実績システム

### AchievementService（lib/domain/services/achievement_service.dart）

**定義済みバッジ一覧**:

| ID | 名前 | 解除条件 |
|----|------|---------|
| first_float | はじめてのうき | 初めて食材を浮かせる |
| all_floaters | 全員浮かせ隊 | 浮く食材10種を全て浮かせる |
| water_master | みずのまほうつかい | 水位80%以上を達成 |
| science_kid | かがくのたまご | 全ミッション50%クリア |
| buoyancy_expert | うきのはかせ | 全ミッションクリア |
| ai_winner | AIにかった！ | AI対戦に1回勝つ |
| density_genius | みつどのてんさい | 密度を説明できた（結果画面を10回表示） |

```dart
class AchievementService {
  // ゲーム状態の変化を受けて、解除すべき実績を返す
  List<Achievement> checkAchievements(
    GameState gameState,
    List<Achievement> currentAchievements,
  ) { ... }
}
```

## 3.7 ミッション定義（assets/data/missions.json）

```json
[
  {
    "id": "mission_001",
    "titleJa": "3つ浮かせよう",
    "descJa": "水槽に食材を入れて、3つ以上を浮かせてください",
    "type": "floatCount",
    "targetValue": 3,
    "timeLimit": 0,
    "badgeId": "first_float"
  },
  {
    "id": "mission_002",
    "titleJa": "水位70%",
    "descJa": "水位を70%以上にしてください",
    "type": "waterLevelAbove",
    "targetValue": 0.70,
    "timeLimit": 0,
    "badgeId": ""
  },
  {
    "id": "mission_003",
    "titleJa": "沈む食材を5つ",
    "descJa": "5つの食材を沈めてください",
    "type": "sinkCount",
    "targetValue": 5,
    "timeLimit": 60,
    "badgeId": ""
  },
  {
    "id": "mission_004",
    "titleJa": "りんごとレモン",
    "descJa": "りんごとレモンを両方浮かせてください",
    "type": "specificFood",
    "targetValue": 2,
    "requiredFoodIds": ["apple", "lemon"],
    "timeLimit": 0,
    "badgeId": ""
  },
  {
    "id": "mission_005",
    "titleJa": "水位80%以上・浮く4個",
    "descJa": "水位80%以上にしながら、4つ以上の食材を浮かせてください",
    "type": "mixedCondition",
    "targetValue": 0.80,
    "timeLimit": 90,
    "badgeId": "water_master"
  }
]
```

## 3.8 アニメーション仕様

| アニメーション | 実装方法 | 詳細 |
|--------------|---------|------|
| 落下 | PhysicsEngine + Ticker | 重力 + 空気抵抗（velocityY × 0.98/frame）、上から投入点まで自由落下 |
| 着水エフェクト | RipplePainter + flutter_animate | 波紋が外側に広がり1.2秒でフェードアウト。2〜3個の同心円 |
| 浮上アニメーション | PhysicsEngine（浮力計算） | 水面付近でバウンド後、浮力=重力の平衡位置で振動収束 |
| 沈下アニメーション | PhysicsEngine（重力計算） | 徐々に加速しつつ底に着底、減衰バウンド |
| ミッション達成バナー | flutter_animate（slide + fade） | 上から降下して3秒表示後フェードアウト |
| バッジ解除 | flutter_animate（scale + glow） | バッジが拡大縮小しながら輝くエフェクト |
| 水面の揺れ | WaterPainter（sin波） | 着水後3秒間、sin波で表面を描画。周期0.5秒 |

## 3.9 ローカルストレージ設計

**SharedPreferences キー一覧**:

| キー | 型 | 説明 |
|------|-----|------|
| `missions_cleared` | List<String> | クリア済みミッションID一覧 |
| `achievements_unlocked` | List<String> | 解除済みバッジID一覧 |
| `achievement_unlocked_at` | Map<String,String> | バッジ解除日時 |
| `tutorial_completed` | bool | チュートリアル完了フラグ |
| `result_screen_count` | int | 結果画面表示回数（実績判定用） |
| `ai_win_count` | int | AI対戦勝利回数 |
| `sounds_enabled` | bool | サウンドON/OFF |

## 3.10 ディレクトリ構成（AppStore/PlayStore申請対応）

```
float_sink_game/
├── android/
│   └── app/
│       ├── src/main/AndroidManifest.xml   ← パーミッション最小化（ネット不要）
│       └── build.gradle                   ← minSdk 26, targetSdk 34
├── ios/
│   └── Runner/
│       ├── Info.plist                     ← NSPhotoLibraryUsageDescription等 記載
│       └── Assets.xcassets/AppIcon.appiconset/  ← 全サイズアイコン
├── lib/ （上記参照）
├── assets/ （上記参照）
├── test/
├── pubspec.yaml
├── pubspec.lock
├── analysis_options.yaml
└── README.md
```

**申請時チェックリスト**:
- [ ] プライバシーポリシーURL（COPPA準拠、個人情報収集なし）
- [ ] スクリーンショット: iPhone 6.5インチ / iPad 12.9インチ / Android 各サイズ
- [ ] アプリアイコン: 1024x1024 PNG（iOS）/ 512x512 PNG（Android）
- [ ] コンテンツレーティング: 全年齢（4+）
- [ ] 広告識別子: 不使用（IDFA不要）

---

## Generatorへの実装指示

### 実装優先順位

1. **フェーズ1（コア物理）**: `physics_engine.dart`, `water_simulation.dart`, `physics_body.dart`, `food_item.dart`, `food_data_source.dart`
2. **フェーズ2（ゲーム画面）**: `game_play_screen.dart`, `aquarium_widget.dart`, `water_painter.dart`, `ripple_painter.dart`, `food_draggable.dart`, `game_state_provider.dart`
3. **フェーズ3（ミッション・実績）**: `mission.dart`, `mission_evaluator.dart`, `achievement.dart`, `achievement_service.dart`, `mission_provider.dart`
4. **フェーズ4（その他画面）**: `title_screen.dart`, `tutorial_screen.dart`, `result_screen.dart`, `mission_select_screen.dart`, `achievement_screen.dart`
5. **フェーズ5（AI対戦・設定）**: `cpu_player.dart`, `ai_battle_screen.dart`, `settings_screen.dart`

### 実装上の注意点

- `PhysicsEngine.step()` はゲームループ（Ticker）から毎フレーム呼び出すこと
- `WaterPainter` は `shouldRepaint` を水位値の変化のみでtrueにし、不要な再描画を防ぐこと
- 食材スプライト画像は `Image` クラスで事前ロードし、Painterに渡すこと（Painter内でのasset読み込みは禁止）
- `submergedRatio` の更新は `PhysicsEngine.calculateNetForce()` 内で行い、外部から直接変更しないこと
- AI対戦の操作タイミングには必ず `Future.delayed(cpu.thinkTime, ...)` を使い、即時実行しないこと
- SharedPreferences の読み書きはすべて `LocalStorageRepository` 経由とし、画面から直接呼ばないこと
