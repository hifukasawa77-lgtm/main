import 'dart:math';
import 'package:flutter/material.dart';
import '../../../domain/physics/water_simulation.dart';

class WaterPainter extends CustomPainter {
  final WaterSimulation water;
  final double wavePhase;

  const WaterPainter({required this.water, required this.wavePhase});

  @override
  void paint(Canvas canvas, Size size) {
    final waterPaint = Paint()..color = const Color(0x992196F3);
    final path = Path();
    path.moveTo(0, water.surfaceY);
    for (double x = 0; x <= size.width; x += 4) {
      final y = water.surfaceY + sin((x / size.width * 2 * pi) + wavePhase) * 3;
      path.lineTo(x, y);
    }
    path.lineTo(size.width, size.height);
    path.lineTo(0, size.height);
    path.close();
    canvas.drawPath(path, waterPaint);

    final linePaint = Paint()
      ..color = const Color(0xFF64B5F6)
      ..strokeWidth = 2.0
      ..style = PaintingStyle.stroke;
    final surfacePath = Path();
    surfacePath.moveTo(0, water.surfaceY + sin(wavePhase) * 3);
    for (double x = 4; x <= size.width; x += 4) {
      final y = water.surfaceY + sin((x / size.width * 2 * pi) + wavePhase) * 3;
      surfacePath.lineTo(x, y);
    }
    canvas.drawPath(surfacePath, linePaint);
  }

  @override
  bool shouldRepaint(WaterPainter old) =>
      old.water.surfaceY != water.surfaceY || old.wavePhase != wavePhase;
}
