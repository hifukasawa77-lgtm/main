class Achievement {
  final String id;
  final String titleJa;
  final String descJa;
  final String iconEmoji;
  bool isUnlocked;
  DateTime? unlockedAt;

  Achievement({
    required this.id,
    required this.titleJa,
    required this.descJa,
    required this.iconEmoji,
    this.isUnlocked = false,
    this.unlockedAt,
  });
}

const List<Map<String, String>> kAchievementDefs = [
  {'id': 'first_float',     'titleJa': 'はじめてのうき',     'descJa': '初めて食材を浮かせた',           'iconEmoji': '🌊'},
  {'id': 'all_floaters',    'titleJa': '全員浮かせ隊',       'descJa': '浮く食材10種を全て浮かせた',     'iconEmoji': '🏆'},
  {'id': 'water_master',    'titleJa': 'みずのまほうつかい', 'descJa': '水位80%以上を達成した',          'iconEmoji': '💧'},
  {'id': 'science_kid',     'titleJa': 'かがくのたまご',     'descJa': '全ミッションの50%をクリアした',  'iconEmoji': '🥚'},
  {'id': 'buoyancy_expert', 'titleJa': 'うきのはかせ',       'descJa': '全ミッションをクリアした',        'iconEmoji': '🔬'},
  {'id': 'ai_winner',       'titleJa': 'AIにかった！',       'descJa': 'AI対戦に1回勝った',              'iconEmoji': '🤖'},
  {'id': 'density_genius',  'titleJa': 'みつどのてんさい',   'descJa': '結果画面を10回表示した',          'iconEmoji': '🧠'},
];
