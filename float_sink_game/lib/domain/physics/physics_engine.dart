import 'physics_body.dart';
import 'water_simulation.dart';

class PhysicsEngine {
  static const double waterDensity = 1.0;
  static const double gravity = 9.8;
  static const double damping = 0.85;
  static const double frameTime = 1.0 / 60;

  double calculateNetForce(PhysicsBody body, double waterSurfaceY) {
    final bodyTop = body.y - body.food.radius;
    final bodyBottom = body.y + body.food.radius;

    if (bodyTop >= waterSurfaceY) {
      body.submergedRatio = 0.0;
    } else if (bodyBottom <= waterSurfaceY) {
      body.submergedRatio = 1.0;
    } else {
      body.submergedRatio = ((waterSurfaceY - bodyTop) / (body.food.radius * 2)).clamp(0.0, 1.0);
    }

    final buoyancy = waterDensity * body.food.density * body.submergedRatio * body.food.radius;
    final gravityForce = body.food.density * body.food.radius;
    return buoyancy - gravityForce;
  }

  void step(List<PhysicsBody> bodies, WaterSimulation water) {
    for (final body in bodies) {
      if (body.isSettled) continue;

      final netForce = calculateNetForce(body, water.surfaceY);
      body.velocityY -= netForce * frameTime * gravity;
      body.velocityY *= damping;
      body.y += body.velocityY;

      if (body.y + body.food.radius >= water.tankBottom) {
        body.y = water.tankBottom - body.food.radius;
        body.velocityY = 0.0;
        if (body.food.density >= waterDensity) {
          body.isSettled = true;
          body.isFloating = false;
        }
      }

      if (body.velocityY.abs() < 0.2 && body.submergedRatio > 0.0) {
        body.isSettled = true;
        body.isFloating = body.food.density < waterDensity;
      }
    }
  }
}
