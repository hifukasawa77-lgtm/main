import 'dart:math';
import 'physics_body.dart';

class Ripple {
  final double x;
  final DateTime startTime;
  double radius = 0.0;
  double opacity = 1.0;
  static const double maxRadius = 80.0;
  static const double duration = 1.2;

  Ripple({required this.x, required this.startTime});

  bool get isExpired => elapsed >= duration;
  double get elapsed =>
      DateTime.now().difference(startTime).inMilliseconds / 1000.0;

  void update(double dt) {
    final t = (elapsed / duration).clamp(0.0, 1.0);
    radius = maxRadius * t;
    opacity = 1.0 - t;
  }
}

class WaterSimulation {
  final double tankWidth;
  final double tankHeight;
  double tankBottom;
  double baseWaterHeight;
  double surfaceY;
  double waterLevelPercent;
  List<Ripple> ripples = [];

  WaterSimulation({required this.tankWidth, required this.tankHeight})
      : tankBottom = tankHeight,
        baseWaterHeight = tankHeight * 0.45,
        surfaceY = tankHeight - tankHeight * 0.45,
        waterLevelPercent = 0.45;

  void addFood(PhysicsBody body) {
    final submergedVolume = body.food.radius * body.food.radius * pi * body.submergedRatio;
    final rise = submergedVolume / tankWidth;
    baseWaterHeight = (baseWaterHeight + rise).clamp(0.0, tankHeight);
    surfaceY = tankBottom - baseWaterHeight;
    waterLevelPercent = baseWaterHeight / tankHeight;
    ripples.add(Ripple(x: body.x, startTime: DateTime.now()));
  }

  void removeFood(PhysicsBody body) {
    final submergedVolume = body.food.radius * body.food.radius * pi * body.submergedRatio;
    final drop = submergedVolume / tankWidth;
    baseWaterHeight = (baseWaterHeight - drop).clamp(0.0, tankHeight);
    surfaceY = tankBottom - baseWaterHeight;
    waterLevelPercent = baseWaterHeight / tankHeight;
  }

  void updateRipples(double dt) {
    ripples.removeWhere((r) => r.isExpired);
    for (final r in ripples) {
      r.update(dt);
    }
  }
}
