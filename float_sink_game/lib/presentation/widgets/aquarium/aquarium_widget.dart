import 'package:flutter/material.dart';
import '../../../presentation/providers/game_state_provider.dart';
import '../../../domain/physics/physics_body.dart';
import 'water_painter.dart';
import 'ripple_painter.dart';

class AquariumWidget extends StatelessWidget {
  final GameState gameState;
  final double wavePhase;

  const AquariumWidget({super.key, required this.gameState, required this.wavePhase});

  static const _emojis = {
    'garlic':'🧄','cherry':'🍒','blueberry':'🫐','grapes':'🍇','strawberry':'🍓',
    'kiwi':'🥝','lemon':'🍋','lime':'🟢','peach':'🍑','pepper':'🫑',
    'carrot':'🥕','plum':'🔴','onion':'🧅','orange':'🍊','tomato':'🍅',
    'fig':'🟣','pear':'🍐','cucumber':'🥒','mango':'🥭','banana':'🍌',
    'apple':'🍎','potato':'🥔','sweetpotato':'🍠','eggplant':'🍆','corn':'🌽',
    'pomelo':'🌕','pineapple':'🍍','daikon':'🥖','broccoli':'🥦',
    'coconut':'🥥','cabbage':'🥬','watermelon':'🍉',
  };

  @override
  Widget build(BuildContext context) {
    final isDanger = gameState.isDanger;
    final isOverflow = gameState.isOverflow;

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF0D47A1).withOpacity(0.15),
        border: Border.all(
          color: isDanger ? Colors.redAccent : const Color(0xFF1565C0),
          width: isDanger ? 4 : 3,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: isDanger ? [
          BoxShadow(color: Colors.red.withOpacity(0.3), blurRadius: 12, spreadRadius: 2),
        ] : null,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(13),
        child: LayoutBuilder(builder: (context, constraints) {
          final w = constraints.maxWidth;
          final h = constraints.maxHeight;
          return Stack(
            clipBehavior: Clip.hardEdge,
            children: [
              Positioned.fill(
                child: CustomPaint(
                  painter: WaterPainter(water: gameState.water, wavePhase: wavePhase),
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
              ...gameState.bodies.map((body) => _buildFoodItem(body, w, h)),
              if (isOverflow)
                Positioned.fill(
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.red.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(13),
                    ),
                    child: const Center(
                      child: Text('あふれる！💦', style: TextStyle(
                        color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold,
                      )),
                    ),
                  ),
                ),
            ],
          );
        }),
      ),
    );
  }

  Widget _buildFoodItem(PhysicsBody body, double tankW, double tankH) {
    final emoji = _emojis[body.food.id] ?? '🍴';
    final fontSize = body.food.radius * 1.3;
    final left = (body.x / 300.0 * tankW) - body.food.radius;
    final top = (body.y / 400.0 * tankH) - body.food.radius;

    return Positioned(
      left: left,
      top: top,
      child: Opacity(
        opacity: body.isSettled ? 1.0 : 0.9,
        child: Text(emoji, style: TextStyle(fontSize: fontSize)),
      ),
    );
  }
}
