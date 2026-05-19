import 'physics_body.dart';
import 'water_simulation.dart';

class PhysicsEngine {
  static const double gravity = 980.0;
  static const double damping = 0.6;
  static const double frameTime = 1.0 / 60;

  void step(List<PhysicsBody> bodies, WaterSimulation water) {
    for (final body in bodies) {
      if (body.isSettled) continue;

      final waterSurfaceY = water.surfaceY;
      final bodyBottom = body.y + body.food.radius;

      if (bodyBottom < waterSurfaceY) {
        body.velocityY += gravity * frameTime;
        body.y += body.velocityY * frameTime;
      } else {
        if (body.food.floats) {
          body.velocityY -= gravity * frameTime * 0.8;
          body.velocityY *= 0.85;
          body.y += body.velocityY * frameTime;

          final targetY = waterSurfaceY - body.food.radius * 0.3;
          if (body.y < targetY && body.velocityY.abs() < 5) {
            body.y = targetY;
            body.velocityY = 0;
            body.isSettled = true;
            body.isFloating = true;
          }
          if (body.y < targetY) body.y = targetY;
        } else {
          body.velocityY += gravity * frameTime * 0.3;
          body.velocityY *= 0.92;
          body.y += body.velocityY * frameTime;

          final bottom = water.tankHeight - body.food.radius;
          if (body.y >= bottom) {
            body.y = bottom;
            body.velocityY = 0;
            body.isSettled = true;
            body.isFloating = false;
          }
        }
      }
    }
  }
}
