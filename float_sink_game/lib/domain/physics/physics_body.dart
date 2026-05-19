import '../../data/models/food_item.dart';

class PhysicsBody {
  final FoodItem food;
  double x;
  double y;
  double velocityY;
  double submergedRatio;
  bool isSettled;
  bool isFloating;

  PhysicsBody({
    required this.food,
    required this.x,
    required this.y,
    this.velocityY = 0.0,
    this.submergedRatio = 0.0,
    this.isSettled = false,
    this.isFloating = false,
  });
}
