import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/mission.dart';
import '../../data/repositories/mission_repository.dart';

class MissionState {
  final List<Mission> missions;
  final Mission? currentMission;
  final bool isCompleted;

  const MissionState({
    required this.missions,
    this.currentMission,
    this.isCompleted = false,
  });

  MissionState copyWith({
    List<Mission>? missions,
    Mission? currentMission,
    bool? isCompleted,
  }) =>
      MissionState(
        missions: missions ?? this.missions,
        currentMission: currentMission ?? this.currentMission,
        isCompleted: isCompleted ?? this.isCompleted,
      );
}

class MissionNotifier extends AsyncNotifier<MissionState> {
  @override
  Future<MissionState> build() async {
    final repo = MissionRepository();
    final missions = await repo.getMissions();
    return MissionState(missions: missions);
  }

  void selectMission(Mission mission) {
    final current = state.value;
    if (current == null) return;
    state = AsyncData(
        current.copyWith(currentMission: mission, isCompleted: false));
  }

  Future<void> markCleared(String missionId) async {
    final repo = MissionRepository();
    await repo.markCleared(missionId);
    final current = state.value;
    if (current == null) return;
    final updated = current.missions.map((m) {
      if (m.id == missionId) m.isCleared = true;
      return m;
    }).toList();
    state = AsyncData(current.copyWith(missions: updated, isCompleted: true));
  }
}

final missionProvider =
    AsyncNotifierProvider<MissionNotifier, MissionState>(MissionNotifier.new);
