import 'package:flutter/material.dart';
import '../../../presentation/providers/game_state_provider.dart';
import 'water_painter.dart';
import 'ripple_painter.dart';

class AquariumWidget extends StatelessWidget {
  final GameState gameState;
  final double wavePhase;

  const AquariumWidget(
      {super.key, required this.gameState, required this.wavePhase});

  static const _emojis = {
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

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF0D47A1).withOpacity(0.2),
        border: Border.all(color: const Color(0xFF1565C0), width: 3),
        borderRadius: BorderRadius.circular(8),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(5),
        child: LayoutBuilder(builder: (context, constraints) {
          return Stack(
            children: [
              Positioned.fill(
                child: CustomPaint(
                  painter:
                      WaterPainter(water: gameState.water, wavePhase: wavePhase),
                ),
              ),
              Positioned.fill(
                child: CustomPaint(
                  painter: RipplePainter(
                    ripples: gameState.water.ripples,
                    waterSurfaceY: gameState.water.surfaceY,
                  ),
                ),
              ),
              ...gameState.bodies.map((body) {
                final emoji = _emojis[body.food.id] ?? '🍴';
                final fontSize = body.food.radius * 1.4;
                return Positioned(
                  left: body.x - body.food.radius,
                  top: body.y - body.food.radius,
                  child: Opacity(
                    opacity: body.isSettled ? 1.0 : 0.85,
                    child: Text(emoji, style: TextStyle(fontSize: fontSize)),
                  ),
                );
              }),
            ],
          );
        }),
      ),
    );
  }
}
