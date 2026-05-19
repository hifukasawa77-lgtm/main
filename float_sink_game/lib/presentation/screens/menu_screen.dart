import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';

class MenuScreen extends StatelessWidget {
  const MenuScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final items = [
      {'label': 'フリープレイ', 'icon': Icons.play_circle_outline, 'route': '/freeplay', 'emoji': '🌊'},
      {'label': 'ミッション', 'icon': Icons.assignment, 'route': '/missions', 'emoji': '🎯'},
      {'label': 'AI対戦', 'icon': Icons.android, 'route': '/battle', 'emoji': '🤖'},
      {'label': '実績', 'icon': Icons.emoji_events, 'route': '/achievements', 'emoji': '🏆'},
      {'label': '設定', 'icon': Icons.settings, 'route': '/settings', 'emoji': '⚙️'},
    ];

    return Scaffold(
      backgroundColor: const Color(0xFF0A1628),
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 40),
            const Text('💧', style: TextStyle(fontSize: 56))
                .animate().fadeIn().scale(),
            const SizedBox(height: 12),
            const Text(
              'うかぶ？しずむ？',
              style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold),
            ),
            const Text('浮力パズルゲーム', style: TextStyle(color: Colors.white38, fontSize: 14)),
            const SizedBox(height: 40),
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                itemCount: items.length,
                itemBuilder: (context, i) {
                  final item = items[i];
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF1E2A3A),
                        minimumSize: const Size(double.infinity, 60),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        side: const BorderSide(color: Color(0xFF2196F3), width: 0.5),
                      ),
                      onPressed: () => context.go(item['route'] as String),
                      child: Row(
                        children: [
                          Text(item['emoji'] as String, style: const TextStyle(fontSize: 24)),
                          const SizedBox(width: 16),
                          Text(
                            item['label'] as String,
                            style: const TextStyle(color: Colors.white, fontSize: 18),
                          ),
                          const Spacer(),
                          const Icon(Icons.chevron_right, color: Colors.white38),
                        ],
                      ),
                    ).animate().slideX(begin: -0.3, delay: Duration(milliseconds: 80 * i), duration: 300.ms),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
