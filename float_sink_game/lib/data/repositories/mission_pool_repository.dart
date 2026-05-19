import 'dart:convert';
import 'dart:math';
import 'package:flutter/services.dart';
import '../models/mission_entry.dart';

class MissionPoolRepository {
  Future<List<MissionEntry>> getRandomMissions(int count) async {
    final json = jsonDecode(await rootBundle.loadString('assets/data/missions_pool.json')) as List;
    final all = json.map((e) => MissionEntry.fromJson(e as Map<String, dynamic>)).toList();
    all.shuffle(Random());
    return all.take(count).toList();
  }
}
