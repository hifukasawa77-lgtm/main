import 'dart:convert';
import 'package:flutter/services.dart';
import '../models/level.dart';

class LevelRepository {
  Future<List<GameLevel>> getLevels() async {
    final json = jsonDecode(await rootBundle.loadString('assets/data/levels.json')) as List;
    return json.map((e) => GameLevel.fromJson(e as Map<String, dynamic>)).toList();
  }
}
