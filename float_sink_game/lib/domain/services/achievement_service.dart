import '../../data/models/achievement.dart';
import '../../data/models/mission.dart';
import '../physics/physics_body.dart';
import '../physics/water_simulation.dart';

class AchievementService {
  List<String> checkAchievements({
    required List<PhysicsBody> bodies,
    required WaterSimulation water,
    required List<Achievement> current,
    required List<Mission> missions,
    required int resultScreenCount,
    required int aiWinCount,
  }) {
    final unlocked = <String>[];
    final unlockedIds = current.where((a) => a.isUnlocked).map((a) => a.id).toSet();

    void check(String id, bool condition) {
      if (!unlockedIds.contains(id) && condition) unlocked.add(id);
    }

    check('first_float', bodies.any((b) => b.isFloating));
    check('all_floaters',
        bodies.where((b) => b.isFloating && b.isSettled).map((b) => b.food.id).toSet().length >= 10);
    check('water_master', water.waterLevelPercent >= 0.80);
    final cleared = missions.where((m) => m.isCleared).length;
    check('science_kid', missions.isNotEmpty && cleared >= missions.length / 2);
    check('buoyancy_expert', missions.isNotEmpty && cleared >= missions.length);
    check('ai_winner', aiWinCount >= 1);
    check('density_genius', resultScreenCount >= 10);

    return unlocked;
  }
}
