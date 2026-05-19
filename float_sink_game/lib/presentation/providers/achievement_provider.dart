import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/achievement.dart';
import '../../data/repositories/achievement_repository.dart';

class AchievementNotifier extends AsyncNotifier<List<Achievement>> {
  @override
  Future<List<Achievement>> build() async {
    final repo = AchievementRepository();
    return repo.getAchievements();
  }

  Future<void> unlock(String achievementId) async {
    final repo = AchievementRepository();
    await repo.unlock(achievementId);
    final current = state.value ?? [];
    state = AsyncData(current.map((a) {
      if (a.id == achievementId) {
        a.isUnlocked = true;
        a.unlockedAt = DateTime.now();
      }
      return a;
    }).toList());
  }
}

final achievementProvider =
    AsyncNotifierProvider<AchievementNotifier, List<Achievement>>(
        AchievementNotifier.new);
