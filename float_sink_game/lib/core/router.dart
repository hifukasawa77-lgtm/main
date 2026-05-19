import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../presentation/screens/splash_screen.dart';
import '../presentation/screens/menu_screen.dart';
import '../presentation/screens/tutorial_screen.dart';
import '../presentation/screens/free_play_screen.dart';
import '../presentation/screens/mission_select_screen.dart';
import '../presentation/screens/mission_play_screen.dart';
import '../presentation/screens/battle_screen.dart';
import '../presentation/screens/achievement_screen.dart';
import '../presentation/screens/result_screen.dart';
import '../presentation/screens/settings_screen.dart';

class AppRouter {
  static final router = GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(path: '/', builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/menu', builder: (_, __) => const MenuScreen()),
      GoRoute(path: '/tutorial', builder: (_, __) => const TutorialScreen()),
      GoRoute(path: '/freeplay', builder: (_, __) => const FreePlayScreen()),
      GoRoute(path: '/missions', builder: (_, __) => const MissionSelectScreen()),
      GoRoute(
        path: '/mission/:id',
        builder: (_, state) =>
            MissionPlayScreen(missionId: state.pathParameters['id'] ?? ''),
      ),
      GoRoute(path: '/battle', builder: (_, __) => const BattleScreen()),
      GoRoute(path: '/achievements', builder: (_, __) => const AchievementScreen()),
      GoRoute(
        path: '/result',
        builder: (_, state) {
          final extra = state.extra as Map<String, dynamic>? ?? {};
          return ResultScreen(
            cleared: extra['cleared'] as bool? ?? false,
            missionTitle: extra['missionTitle'] as String? ?? '',
          );
        },
      ),
      GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),
    ],
    errorBuilder: (_, state) => Scaffold(
      body: Center(child: Text('ページが見つかりません: ${state.error}')),
    ),
  );
}
