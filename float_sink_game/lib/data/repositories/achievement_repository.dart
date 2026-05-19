import '../datasources/local_storage.dart';
import '../models/achievement.dart';

class AchievementRepository {
  final LocalStorage _storage;
  AchievementRepository({LocalStorage? storage}) : _storage = storage ?? LocalStorage();

  Future<List<Achievement>> getAchievements() async {
    final unlocked = await _storage.getAchievementsUnlocked();
    return kAchievementDefs.map((def) {
      final isUnlocked = unlocked.contains(def['id']);
      return Achievement(
        id: def['id']!,
        titleJa: def['titleJa']!,
        descJa: def['descJa']!,
        iconEmoji: def['iconEmoji']!,
        isUnlocked: isUnlocked,
        unlockedAt: null,
      );
    }).toList();
  }

  Future<void> unlock(String achievementId) async {
    final unlocked = await _storage.getAchievementsUnlocked();
    if (!unlocked.contains(achievementId)) {
      unlocked.add(achievementId);
      await _storage.setAchievementsUnlocked(unlocked);
    }
  }
}
