import 'package:flutter/material.dart';
import '../../../data/models/food_item.dart';

class FoodCard extends StatelessWidget {
  final FoodItem food;
  final bool dimmed;

  const FoodCard({super.key, required this.food, this.dimmed = false});

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
    return Opacity(
      opacity: dimmed ? 0.4 : 1.0,
      child: Container(
        width: 72,
        margin: const EdgeInsets.symmetric(horizontal: 4),
        decoration: BoxDecoration(
          color: const Color(0xFF1E2A3A),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF2196F3).withOpacity(0.4)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(_emojis[food.id] ?? '🍴', style: const TextStyle(fontSize: 26)),
            const SizedBox(height: 2),
            Text(food.nameJa,
                style: const TextStyle(color: Colors.white, fontSize: 9),
                textAlign: TextAlign.center),
            Text('${food.volume}L',
                style: TextStyle(
                  color: food.floats ? Colors.lightBlueAccent : Colors.redAccent,
                  fontSize: 9, fontWeight: FontWeight.bold,
                )),
          ],
        ),
      ),
    );
  }
}
