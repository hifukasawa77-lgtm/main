import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import '../../data/datasources/local_storage.dart';

class TutorialScreen extends StatefulWidget {
  const TutorialScreen({super.key});
  @override
  State<TutorialScreen> createState() => _TutorialScreenState();
}

class _TutorialScreenState extends State<TutorialScreen> {
  int _step = 0;

  static const _steps = [
    {'emoji': '🍎', 'title': '食材を選ぼう', 'desc': '下の食材パネルから食材を選んで、上にドラッグしてね。いろんな食材があるよ！'},
    {'emoji': '🌊', 'title': '水槽に落とそう', 'desc': '水槽の上でドロップすると食材が落ちるよ！水に入ると何が起きるかな？'},
    {'emoji': '⚖️', 'title': '浮く？沈む？', 'desc': '密度（ρ）が1より小さい食材は浮くよ。密度は「重さ÷体積」のことだよ！'},
    {'emoji': '🏆', 'title': 'ミッションに挑戦！', 'desc': 'ミッションモードでいろんな課題にチャレンジしよう！全クリアできるかな？'},
  ];

  @override
  Widget build(BuildContext context) {
    final step = _steps[_step];
    final isLast = _step == _steps.length - 1;

    return Scaffold(
      backgroundColor: const Color(0xFF0A1628),
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(_steps.length, (i) => Container(
                width: i == _step ? 24 : 8,
                height: 8,
                margin: const EdgeInsets.symmetric(horizontal: 4),
                decoration: BoxDecoration(
                  color: i == _step ? const Color(0xFF2196F3) : Colors.white24,
                  borderRadius: BorderRadius.circular(4),
                ),
              )),
            ),
            Expanded(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(step['emoji']!, style: const TextStyle(fontSize: 80))
                          .animate(key: ValueKey(_step)).fadeIn().scale(),
                      const SizedBox(height: 32),
                      Text(
                        step['title']!,
                        style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                        textAlign: TextAlign.center,
                      ).animate(key: ValueKey('t$_step')).fadeIn(delay: 200.ms),
                      const SizedBox(height: 16),
                      Text(
                        step['desc']!,
                        style: const TextStyle(color: Colors.white70, fontSize: 16, height: 1.6),
                        textAlign: TextAlign.center,
                      ).animate(key: ValueKey('d$_step')).fadeIn(delay: 400.ms),
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(24),
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2196F3),
                  minimumSize: const Size(double.infinity, 56),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                onPressed: () async {
                  if (isLast) {
                    await LocalStorage().setTutorialCompleted(true);
                    if (context.mounted) context.go('/menu');
                  } else {
                    setState(() => _step++);
                  }
                },
                child: Text(
                  isLast ? 'はじめる！' : '次へ',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
