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
    _incrementResultCount();
  }

  Future<void> _incrementResultCount() async {
    final ls = LocalStorage();
    final count = await ls.getResultScreenCount();
    await ls.setResultScreenCount(count + 1);
  }

  @override
  Widget build(BuildContext context) {
    final bodies = ref.watch(gameStateProvider).bodies;

    const emojis = {
      'apple': '🍎', 'carrot': '🥕', 'cucumber': '🥒',
      'potato': '🥔', 'tomato': '🍅', 'lemon': '🍋',
      'watermelon': '🍉', 'broccoli': '🥦', 'radish': '🍠',
      'orange': '🍊',
    };

    return Scaffold(
      backgroundColor: const Color(0xFF0A1628),
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 24),
            Text(
              widget.cleared ? '🎉 クリア！' : '📊 結果',
              style: TextStyle(
                color: widget.cleared ? Colors.amberAccent : Colors.white,
                fontSize: 32, fontWeight: FontWeight.bold,
              ),
            ).animate().scale().fadeIn(),
            if (widget.missionTitle.isNotEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Text(widget.missionTitle,
                    style: const TextStyle(color: Colors.white54, fontSize: 14)),
              ),
            const SizedBox(height: 16),
            Expanded(
              child: bodies.isEmpty
                  ? const Center(child: Text('食材が投入されませんでした', style: TextStyle(color: Colors.white54)))
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: bodies.length,
                      itemBuilder: (_, i) {
                        final body = bodies[i];
                        final f = body.food;
                        return Card(
                          color: const Color(0xFF1E2A3A),
                          margin: const EdgeInsets.only(bottom: 8),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          child: ListTile(
                            leading: Text(emojis[f.id] ?? '🍴', style: const TextStyle(fontSize: 28)),
                            title: Row(children: [
                              Text(f.nameJa, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                              const SizedBox(width: 8),
                              Text(
                                body.isFloating ? '🌊 うかいた' : '⬇️ しずんだ',
                                style: TextStyle(
                                  color: body.isFloating ? Colors.lightBlueAccent : Colors.redAccent,
                                  fontSize: 12,
                                ),
                              ),
                            ]),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('密度: ${f.density.toStringAsFixed(2)}',
                                    style: const TextStyle(color: Colors.white54, fontSize: 11)),
                                Text(f.descJa,
                                    style: const TextStyle(color: Colors.white38, fontSize: 11),
                                    maxLines: 2, overflow: TextOverflow.ellipsis),
                              ],
                            ),
                            isThreeLine: true,
                          ),
                        ).animate().fadeIn(delay: Duration(milliseconds: 100 * i));
                      },
                    ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
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
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
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
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
