import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class LocalStorage {
  Future<List<String>> getMissionsCleared() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('missions_cleared');
    if (raw == null) return [];
    return (jsonDecode(raw) as List<dynamic>).cast<String>();
  }

  Future<void> setMissionsCleared(List<String> ids) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('missions_cleared', jsonEncode(ids));
  }

  Future<List<String>> getAchievementsUnlocked() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getStringList('achievements_unlocked') ?? [];
  }

  Future<void> setAchievementsUnlocked(List<String> ids) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList('achievements_unlocked', ids);
  }

  Future<bool> getTutorialCompleted() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool('tutorial_completed') ?? false;
  }

  Future<void> setTutorialCompleted(bool v) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('tutorial_completed', v);
  }

  Future<int> getResultScreenCount() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt('result_screen_count') ?? 0;
  }

  Future<void> setResultScreenCount(int v) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('result_screen_count', v);
  }

  Future<int> getAiWinCount() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt('ai_win_count') ?? 0;
  }

  Future<void> setAiWinCount(int v) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('ai_win_count', v);
  }

  Future<bool> getSoundsEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool('sounds_enabled') ?? true;
  }

  Future<void> setSoundsEnabled(bool v) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('sounds_enabled', v);
  }
}
