class FoodItem {
  final String id;
  final String nameJa;
  final double density;
  final double volume;
  final double radius;
  final String imagePath;
  final bool floats;
  final String descJa;

  const FoodItem({
    required this.id,
    required this.nameJa,
    required this.density,
    required this.volume,
    required this.radius,
    required this.imagePath,
    required this.floats,
    required this.descJa,
  });

  double get mass => density * volume;

  factory FoodItem.fromJson(Map<String, dynamic> json) => FoodItem(
    id: json['id'] as String,
    nameJa: json['nameJa'] as String,
    density: (json['density'] as num).toDouble(),
    volume: (json['volume'] as num).toDouble(),
    radius: (json['radius'] as num).toDouble(),
    imagePath: json['imagePath'] as String,
    floats: json['floats'] as bool,
    descJa: json['descJa'] as String,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'nameJa': nameJa,
    'density': density,
    'volume': volume,
    'radius': radius,
    'imagePath': imagePath,
    'floats': floats,
    'descJa': descJa,
  };
}
