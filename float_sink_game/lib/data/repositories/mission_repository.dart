import 'dart:convert';
import 'package:flutter/services.dart';
import '../datasources/local_storage.dart';
import '../models/mission.dart';

class MissionRepository {
  final LocalStorage _storage;
  MissionRepository({LocalStorage? storage}) : _storage = storage ?? LocalStorage();

  Future<List<Mission>> getMissions() async {
    final jsonStr = await rootBundle.loadString('assets/data/missions.json');
    final list = jsonDecode(jsonStr) as List<dynamic>;
    final missions = list
        .map((e) => Mission.fromJson(e as Map<String, dynamic>))
        .toList();
    final cleared = await _storage.getMissionsCleared();
    for (final m in missions) {
      m.isCleared = cleared.contains(m.id);
    }
    return missions;
  }

  Future<void> markCleared(String missionId) async {
    final cleared = await _storage.getMissionsCleared();
    if (!cleared.contains(missionId)) {
      cleared.add(missionId);
      await _storage.setMissionsCleared(cleared);
    }
  }
}
