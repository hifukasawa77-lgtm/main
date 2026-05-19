import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../data/datasources/local_storage.dart';
import '../providers/game_state_provider.dart';

class ResultScreen extends ConsumerStatefulWidget {
  final bool cleared;
  final String missionTitle;

  const ResultScreen({super.key, required this.cleared, required this.missionTitle});

  @override
  ConsumerState<ResultScreen> createState() => _ResultScreenState();
}

class _ResultScreenState extends ConsumerState<ResultScreen> {
  @override
  void initState() {
    super.initState();
    _saveResult();
  }

  Future<void> _saveResult() async {
    final ls = LocalStorage();
    final count = await ls.getResultScreenCount();
    await ls.setResultScreenCount(count + 1);
    final score = ref.read(gameStateProvider).score;
    final total = await ls.getTotalScore();
    await ls.setTotalScore(total + score);
  }

  static const _emojis = {
    'garlic':'🧄','cherry':'🍒','blueberry':'🫐','grapes':'🍇','strawberry':'🍓',
    'kiwi':'🥝','lemon':'🍋','lime':'🟢','peach':'🍑','pepper':'🫑',
    'carrot':'🥕','plum':'🔴','onion':'🧅','orange':'🍊','tomato':'🍅',
    'fig':'🟣','pear':'🍐','cucumber':'🥒','mango':'🥭','banana':'🍌',
    'apple':'🍎','potato':'🥔','sweetpotato':'🍠','eggplant':'🍆','corn':'🌽',
    'pomelo':'🌕','pineapple':'🍍','daikon':'🥖','broccoli':'🥦',
    'coconut':'🥥','cabbage':'🥬','watermelon':'🍉',
  };

  @override
  Widget build(BuildContext context) {
    final gameState = ref.watch(gameStateProvider);
    final bodies = gameState.bodies;
    final score = gameState.score;

    return Scaffold(
      backgroundColor: const Color(0xFF0A1628),
      body: SafeArea(child: Column(children: [
        const SizedBox(height: 24),
        Text(
          widget.cleared ? '🎉 クリア！' : '📊 結果',
          style: TextStyle(
            color: widget.cleared ? Colors.amberAccent : Colors.white,
            fontSize: 32, fontWeight: FontWeight.bold,
          ),
        ).animate().scale().fadeIn(),
        Text('$score 点', style: const TextStyle(
          color: Colors.amberAccent, fontSize: 48, fontWeight: FontWeight.w900,
        )).animate().fadeIn(delay: 200.ms),
        const SizedBox(height: 8),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Text('🌊 ${gameState.floatingCount}個浮かんだ  ',
              style: const TextStyle(color: Colors.lightBlueAccent, fontSize: 14)),
          Text('⬇️ ${gameState.sinkingCount}個沈んだ',
              style: const TextStyle(color: Colors.redAccent, fontSize: 14)),
        ]),
        const SizedBox(height: 16),
        Expanded(
          child: bodies.isEmpty
              ? const Center(child: Text('食材が投入されませんでした',
                  style: TextStyle(color: Colors.white54)))
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: bodies.length,
                  itemBuilder: (_, i) {
                    final b = bodies[i];
                    final f = b.food;
                    return Card(
                      color: const Color(0xFF1E2A3A),
                      margin: const EdgeInsets.only(bottom: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      child: ListTile(
                        leading: Text(_emojis[f.id] ?? '🍴',
                            style: const TextStyle(fontSize: 28)),
                        title: Row(children: [
                          Text(f.nameJa, style: const TextStyle(
                              color: Colors.white, fontWeight: FontWeight.bold)),
                          const SizedBox(width: 8),
                          Text(
                            b.isFloating ? '🌊 うかいた' : '⬇️ しずんだ',
                            style: TextStyle(
                              color: b.isFloating ? Colors.lightBlueAccent : Colors.redAccent,
                              fontSize: 12,
                            ),
                          ),
                        ]),
                        subtitle: Text(
                          '密度: ${f.density.toStringAsFixed(2)} / ${f.volume}L  ${f.descJa}',
                          style: const TextStyle(color: Colors.white38, fontSize: 10),
                          maxLines: 2, overflow: TextOverflow.ellipsis,
                        ),
                        isThreeLine: true,
                      ),
                    ).animate().fadeIn(delay: Duration(milliseconds: 80 * i));
                  },
                ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            Expanded(child: OutlinedButton(
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Color(0xFF2196F3)),
                minimumSize: const Size(double.infinity, 52),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () {
                ref.read(gameStateProvider.notifier).reset();
                context.go('/freeplay');
              },
              child: const Text('もう一度', style: TextStyle(color: Colors.lightBlueAccent)),
            )),
            const SizedBox(width: 12),
            Expanded(child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2196F3),
                minimumSize: const Size(double.infinity, 52),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () {
                ref.read(gameStateProvider.notifier).reset();
                context.go('/menu');
              },
              child: const Text('タイトルへ', style: TextStyle(color: Colors.white)),
            )),
          ]),
        ),
      ])),
    );
  }
}
