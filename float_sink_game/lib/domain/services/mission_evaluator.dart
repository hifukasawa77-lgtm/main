import '../../data/models/mission.dart';
import '../physics/physics_body.dart';
import '../physics/water_simulation.dart';

class MissionEvaluator {
  bool evaluate(Mission mission, List<PhysicsBody> bodies, WaterSimulation water) {
    switch (mission.type) {
      case MissionType.floatCount:
        return bodies.where((b) => b.isFloating && b.isSettled).length >= mission.targetValue;
      case MissionType.sinkCount:
        return bodies.where((b) => !b.isFloating && b.isSettled).length >= mission.targetValue;
      case MissionType.waterLevelAbove:
        return water.waterLevelPercent >= mission.targetValue;
      case MissionType.specificFood:
        final required = mission.requiredFoodIds ?? [];
        final floatingIds = bodies
            .where((b) => b.isFloating && b.isSettled)
            .map((b) => b.food.id)
            .toSet();
        return required.every((id) => floatingIds.contains(id));
      case MissionType.mixedCondition:
        final floatOk = bodies.where((b) => b.isFloating && b.isSettled).length >= 4;
        final waterOk = water.waterLevelPercent >= mission.targetValue;
        return floatOk && waterOk;
    }
  }
}
