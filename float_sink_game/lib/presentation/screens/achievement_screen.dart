import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/achievement_provider.dart';

class AchievementScreen extends ConsumerWidget {
  const AchievementScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(achievementProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF0A1628),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text('実績・バッジ', style: TextStyle(color: Colors.white)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => context.go('/menu'),
        ),
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e', style: const TextStyle(color: Colors.white))),
        data: (achievements) => GridView.builder(
          padding: const EdgeInsets.all(16),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.1,
          ),
          itemCount: achievements.length,
          itemBuilder: (_, i) {
            final a = achievements[i];
            return Container(
              decoration: BoxDecoration(
                color: a.isUnlocked ? const Color(0xFF1E3A5F) : Colors.grey[850],
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: a.isUnlocked ? const Color(0xFF2196F3) : Colors.transparent,
                ),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(a.isUnlocked ? a.iconEmoji : '❓',
                      style: const TextStyle(fontSize: 36)),
                  const SizedBox(height: 8),
                  Text(
                    a.isUnlocked ? a.titleJa : '???',
                    style: TextStyle(
                      color: a.isUnlocked ? Colors.white : Colors.grey,
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  if (a.isUnlocked && a.unlockedAt != null)
                    Text(
                      '${a.unlockedAt!.month}/${a.unlockedAt!.day}',
                      style: const TextStyle(color: Colors.white38, fontSize: 10),
                    ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}
