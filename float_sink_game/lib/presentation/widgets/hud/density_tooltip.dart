import 'package:flutter/material.dart';
import '../../../data/models/food_item.dart';

class DensityTooltip extends StatelessWidget {
  final FoodItem food;
  final bool isFloating;

  const DensityTooltip(
      {super.key, required this.food, required this.isFloating});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFF1A237E).withOpacity(0.9),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(food.nameJa,
              style: const TextStyle(
                  color: Colors.white, fontWeight: FontWeight.bold)),
          Text('密度: ${food.density.toStringAsFixed(2)}',
              style: const TextStyle(color: Colors.white70, fontSize: 12)),
          Text(
            isFloating ? '🌊 うかびます！' : '⬇️ しずみます',
            style: TextStyle(
                color: isFloating
                    ? Colors.lightBlueAccent
                    : Colors.redAccent),
          ),
        ],
      ),
    );
  }
}
