class FoodItem {
  final String id;
  final String nameJa;
  final double density;
  final int volume;
  final int tier;
  final double radius;
  final bool floats;
  final String descJa;

  const FoodItem({
    required this.id,
    required this.nameJa,
    required this.density,
    required this.volume,
    required this.tier,
    required this.radius,
    required this.floats,
    required this.descJa,
  });

  double get mass => density * volume;
  double get displaceVolume => floats ? volume * density : volume.toDouble();

  factory FoodItem.fromJson(Map<String, dynamic> json) => FoodItem(
    id: json['id'] as String,
    nameJa: json['nameJa'] as String,
    density: (json['density'] as num).toDouble(),
    volume: json['volume'] as int,
    tier: json['tier'] as int,
    radius: (json['radius'] as num).toDouble(),
    floats: json['floats'] as bool,
    descJa: json['descJa'] as String,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'nameJa': nameJa,
    'density': density,
    'volume': volume,
    'tier': tier,
    'radius': radius,
    'floats': floats,
    'descJa': descJa,
  };
}

double foodRadius(int volume) {
  final t = (volume - 2) / (25 - 2);
  return (0.85 + t * 3.6) * 16;
}
