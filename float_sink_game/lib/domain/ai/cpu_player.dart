import 'dart:math';
import '../../data/models/food_item.dart';
import '../../data/models/mission.dart';

enum AIDifficulty { easy, normal, hard }

class CPUPlayer {
  final AIDifficulty difficulty;
  final _rng = Random();

  CPUPlayer({required this.difficulty});

  FoodItem selectFood(List<FoodItem> available, Mission? mission) {
    if (available.isEmpty) return available.first;
    switch (difficulty) {
      case AIDifficulty.easy:
        return available[_rng.nextInt(available.length)];
      case AIDifficulty.normal:
        return _rng.nextDouble() < 0.7
            ? _selectOptimal(available, mission)
            : available[_rng.nextInt(available.length)];
      case AIDifficulty.hard:
        return _selectOptimal(available, mission);
    }
  }

  FoodItem _selectOptimal(List<FoodItem> available, Mission? mission) {
    if (mission == null) {
      return available.reduce((a, b) => a.volume > b.volume ? a : b);
    }
    switch (mission.type) {
      case MissionType.floatCount:
      case MissionType.specificFood:
        final floaters = available.where((f) => f.floats).toList();
        if (floaters.isEmpty) return available[_rng.nextInt(available.length)];
        return floaters.reduce((a, b) => a.volume > b.volume ? a : b);
      case MissionType.sinkCount:
        final sinkers = available.where((f) => !f.floats).toList();
        if (sinkers.isEmpty) return available[_rng.nextInt(available.length)];
        return sinkers.reduce((a, b) => a.volume > b.volume ? a : b);
      case MissionType.waterLevelAbove:
      case MissionType.mixedCondition:
        return available.reduce((a, b) => a.volume > b.volume ? a : b);
    }
  }

  Duration get thinkTime => switch (difficulty) {
    AIDifficulty.easy   => const Duration(seconds: 3),
    AIDifficulty.normal => const Duration(seconds: 2),
    AIDifficulty.hard   => const Duration(seconds: 1),
  };
}
