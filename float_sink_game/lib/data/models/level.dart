class GameLevel {
  final int id;
  final String nameJa;
  final int capacity;
  final int waterVol;
  final int goal;
  final String color;
  final String icon;
  final List<String> preItemIds;

  const GameLevel({
    required this.id,
    required this.nameJa,
    required this.capacity,
    required this.waterVol,
    required this.goal,
    required this.color,
    required this.icon,
    required this.preItemIds,
  });

  factory GameLevel.fromJson(Map<String, dynamic> json) => GameLevel(
    id: json['id'] as int,
    nameJa: json['nameJa'] as String,
    capacity: json['capacity'] as int,
    waterVol: json['waterVol'] as int,
    goal: json['goal'] as int,
    color: json['color'] as String,
    icon: json['icon'] as String,
    preItemIds: (json['preItemIds'] as List<dynamic>).cast<String>(),
  );
}
