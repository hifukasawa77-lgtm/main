import 'package:flutter/material.dart';
import '../../../data/models/food_item.dart';
import 'food_card.dart';

class FoodDraggable extends StatelessWidget {
  final FoodItem food;
  final bool disabled;

  const FoodDraggable({super.key, required this.food, this.disabled = false});

  @override
  Widget build(BuildContext context) {
    if (disabled) return FoodCard(food: food, dimmed: true);
    return Draggable<FoodItem>(
      data: food,
      feedback: Material(
        color: Colors.transparent,
        child: Opacity(opacity: 0.8, child: FoodCard(food: food)),
      ),
      childWhenDragging: FoodCard(food: food, dimmed: true),
      child: FoodCard(food: food),
    );
  }
}
