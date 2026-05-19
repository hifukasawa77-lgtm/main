import 'dart:math';

class Ripple {
  final double x;
  final DateTime startTime;
  double radius = 0.0;
  double opacity = 1.0;
  static const double maxRadius = 60.0;
  static const double duration = 1.0;

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
  final int capacity;
  int waterVol;
  double sinkerVol;
  double floaterSubVol;
  List<Ripple> ripples = [];

  final double tankHeight;
  final double tankWidth;

  WaterSimulation({
    required this.capacity,
    required this.waterVol,
    required this.tankHeight,
    required this.tankWidth,
  }) : sinkerVol = 0.0,
       floaterSubVol = 0.0;

  double get fillPercent =>
      ((waterVol + sinkerVol) / capacity).clamp(0.0, 1.0);

  double get totalVolPercent =>
      ((sinkerVol + floaterSubVol) / capacity).clamp(0.0, 1.0);

  double get surfaceY => tankHeight * (1.0 - fillPercent);

  double get waterLevelPercent => fillPercent;

  bool get isDanger => totalVolPercent >= 0.80;

  bool get isOverflow => totalVolPercent >= 1.0;

  void addSinker(double vol) {
    sinkerVol += vol;
    ripples.add(Ripple(x: tankWidth / 2, startTime: DateTime.now()));
  }

  void addFloater(double displaceVol) {
    floaterSubVol += displaceVol;
    ripples.add(Ripple(x: tankWidth / 2, startTime: DateTime.now()));
  }

  void removeSinker(double vol) {
    sinkerVol = (sinkerVol - vol).clamp(0.0, double.infinity);
  }

  void removeFloater(double displaceVol) {
    floaterSubVol = (floaterSubVol - displaceVol).clamp(0.0, double.infinity);
  }

  void reset({required int newCapacity, required int newWaterVol}) {
    sinkerVol = 0.0;
    floaterSubVol = 0.0;
    ripples.clear();
  }

  void updateRipples(double dt) {
    ripples.removeWhere((r) => r.isExpired);
    for (final r in ripples) r.update(dt);
  }
}
