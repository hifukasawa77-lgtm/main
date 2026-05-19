import 'package:flutter/material.dart';
import '../../../domain/physics/water_simulation.dart';

class RipplePainter extends CustomPainter {
  final List<Ripple> ripples;
  final double waterSurfaceY;

  const RipplePainter({required this.ripples, required this.waterSurfaceY});

  @override
  void paint(Canvas canvas, Size size) {
    for (final ripple in ripples) {
      final paint = Paint()
        ..color = Colors.white.withOpacity(ripple.opacity * 0.6)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5;
      canvas.drawCircle(Offset(ripple.x, waterSurfaceY), ripple.radius, paint);
      if (ripple.radius > 15) {
        canvas.drawCircle(
          Offset(ripple.x, waterSurfaceY),
          ripple.radius * 0.6,
          paint..color = Colors.white.withOpacity(ripple.opacity * 0.3),
        );
      }
    }
  }

  @override
  bool shouldRepaint(RipplePainter old) => ripples.isNotEmpty;
}
