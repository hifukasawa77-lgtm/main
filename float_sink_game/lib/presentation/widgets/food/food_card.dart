import 'package:flutter/material.dart';
import '../../../data/models/food_item.dart';

class FoodCard extends StatelessWidget {
  final FoodItem food;
  final bool dimmed;

  const FoodCard({super.key, required this.food, this.dimmed = false});

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
    return Opacity(
      opacity: dimmed ? 0.4 : 1.0,
      child: Container(
        width: 72,
        margin: const EdgeInsets.symmetric(horizontal: 4),
        decoration: BoxDecoration(
          color: const Color(0xFF1E2A3A),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
              color: const Color(0xFF2196F3).withOpacity(0.4)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(_emojis[food.id] ?? '🍴',
                style: const TextStyle(fontSize: 28)),
            const SizedBox(height: 4),
            Text(
              food.nameJa,
              style: const TextStyle(color: Colors.white, fontSize: 10),
              textAlign: TextAlign.center,
            ),
            Text(
              'ρ=${food.density.toStringAsFixed(2)}',
              style: TextStyle(
                color: food.floats
                    ? Colors.lightBlueAccent
                    : Colors.redAccent,
                fontSize: 9,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
