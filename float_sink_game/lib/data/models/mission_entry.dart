class MissionEntry {
  final String id;
  final String text;
  final int bonus;
  bool isCompleted;

  MissionEntry({
    required this.id,
    required this.text,
    required this.bonus,
    this.isCompleted = false,
  });

  factory MissionEntry.fromJson(Map<String, dynamic> json) => MissionEntry(
    id: json['id'] as String,
    text: json['text'] as String,
    bonus: json['bonus'] as int,
  );
}
