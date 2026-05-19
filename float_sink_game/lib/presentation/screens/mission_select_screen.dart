import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/mission_provider.dart';

class MissionSelectScreen extends ConsumerWidget {
  const MissionSelectScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final missionAsync = ref.watch(missionProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF0A1628),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text('ミッション', style: TextStyle(color: Colors.white)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => context.go('/menu'),
        ),
      ),
      body: missionAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('エラー: $e', style: const TextStyle(color: Colors.white))),
        data: (state) => ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: state.missions.length,
          itemBuilder: (context, i) {
            final m = state.missions[i];
            return Card(
              color: m.isCleared ? Colors.grey[800] : const Color(0xFF1E2A3A),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              margin: const EdgeInsets.only(bottom: 12),
              child: ListTile(
                leading: Text(m.isCleared ? '✅' : '🎯', style: const TextStyle(fontSize: 28)),
                title: Text(m.titleJa, style: TextStyle(color: m.isCleared ? Colors.grey : Colors.white, fontWeight: FontWeight.bold)),
                subtitle: Text(m.descJa, style: const TextStyle(color: Colors.white54, fontSize: 12)),
                trailing: const Icon(Icons.chevron_right, color: Colors.white38),
                onTap: () {
                  ref.read(missionProvider.notifier).selectMission(m);
                  context.go('/mission/${m.id}');
                },
              ),
            );
          },
        ),
      ),
    );
  }
}
