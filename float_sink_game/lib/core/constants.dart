// 物理定数
const double kWaterDensity = 1000.0; // kg/m³
const double kGravity = 9.8; // m/s²
const double kTankWidth = 300.0; // 仮想水槽幅(px)
const double kTankHeight = 400.0; // 仮想水槽高さ(px)
const double kInitialWaterLevel = 0.45; // 初期水位（0.0〜1.0）

// アニメーション定数
const Duration kFallDuration = Duration(milliseconds: 600);
const Duration kRippleDuration = Duration(milliseconds: 800);
const Duration kFloatDuration = Duration(milliseconds: 400);

// ゲーム定数
const int kMaxFoodsInTank = 8;
const double kVolumeScale = 0.001; // m³換算スケール

// 食材絵文字
const Map<String, String> kFoodEmojis = {
  'apple': '🍎',
  'carrot': '🥕',
  'cucumber': '🥒',
  'potato': '🥔',
  'tomato': '🍅',
  'lemon': '🍋',
  'watermelon': '🍉',
  'broccoli': '🥦',
  'radish': '🍠',
  'orange': '🍊',
};
