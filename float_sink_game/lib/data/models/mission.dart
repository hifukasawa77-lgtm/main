enum MissionType { waterLevelAbove, floatCount, sinkCount, specificFood, mixedCondition }

class Mission {
  final String id;
  final String titleJa;
  final String descJa;
  final MissionType type;
  final double targetValue;
  final List<String>? requiredFoodIds;
  final int timeLimit;
  final String badgeId;
  bool isCleared;

  Mission({
    required this.id,
    required this.titleJa,
    required this.descJa,
    required this.type,
    required this.targetValue,
    this.requiredFoodIds,
    required this.timeLimit,
    required this.badgeId,
    this.isCleared = false,
  });

  factory Mission.fromJson(Map<String, dynamic> json) => Mission(
    id: json['id'] as String,
    titleJa: json['titleJa'] as String,
    descJa: json['descJa'] as String,
    type: MissionType.values.byName(json['type'] as String),
    targetValue: (json['targetValue'] as num).toDouble(),
    requiredFoodIds: (json['requiredFoodIds'] as List<dynamic>?)?.cast<String>(),
    timeLimit: json['timeLimit'] as int,
    badgeId: json['badgeId'] as String? ?? '',
  );
}
