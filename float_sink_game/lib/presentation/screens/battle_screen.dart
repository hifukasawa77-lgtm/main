import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../data/datasources/local_storage.dart';
import '../../data/models/food_item.dart';
import '../../data/repositories/food_repository.dart';
import '../../domain/ai/cpu_player.dart';

class BattleScreen extends StatefulWidget {
  const BattleScreen({super.key});
  @override
  State<BattleScreen> createState() => _BattleScreenState();
}

class _BattleScreenState extends State<BattleScreen> {
  AIDifficulty? _difficulty;
  List<FoodItem> _foods = [];
  List<FoodItem> _playerFoods = [];
  List<FoodItem> _cpuFoods = [];
  bool _gameOver = false;
  String _result = '';
  CPUPlayer? _cpu;

  final _targetFloat = 3;

  @override
  void initState() {
    super.initState();
    FoodRepository().getFoods().then((f) => setState(() => _foods = f));
  }

  void _startGame(AIDifficulty diff) {
    setState(() {
      _difficulty = diff;
      _cpu = CPUPlayer(difficulty: diff);
      _playerFoods = [];
      _cpuFoods = [];
      _gameOver = false;
    });
  }

  void _playerPick(FoodItem food) {
    if (_gameOver) return;
    setState(() => _playerFoods.add(food));
    _checkWin();
    if (!_gameOver) _cpuTurn();
  }

  Future<void> _cpuTurn() async {
    final cpu = _cpu!;
    await Future.delayed(cpu.thinkTime);
    if (!mounted || _gameOver) return;
    final pick = cpu.selectFood(_foods, null);
    setState(() => _cpuFoods.add(pick));
    _checkWin();
  }

  void _checkWin() {
    final playerFloat = _playerFoods.where((f) => f.floats).length;
    final cpuFloat = _cpuFoods.where((f) => f.floats).length;
    if (playerFloat >= _targetFloat) {
      setState(() { _gameOver = true; _result = '🎉 あなたの勝ち！'; });
      _recordWin();
    } else if (cpuFloat >= _targetFloat) {
      setState(() { _gameOver = true; _result = '🤖 AIの勝ち…'; });
    }
  }

  Future<void> _recordWin() async {
    final ls = LocalStorage();
    final w = await ls.getAiWinCount();
    await ls.setAiWinCount(w + 1);
  }

  static const _emojis = {
    'apple': '🍎', 'carrot': '🥕', 'cucumber': '🥒', 'potato': '🥔',
    'tomato': '🍅', 'lemon': '🍋', 'watermelon': '🍉', 'broccoli': '🥦',
    'radish': '🍠', 'orange': '🍊',
  };

  @override
  Widget build(BuildContext context) {
    if (_difficulty == null) {
      return Scaffold(
        backgroundColor: const Color(0xFF0A1628),
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          leading: IconButton(icon: const Icon(Icons.arrow_back, color: Colors.white), onPressed: () => context.go('/menu')),
          title: const Text('AI対戦', style: TextStyle(color: Colors.white)),
        ),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('難易度を選んでね', style: TextStyle(color: Colors.white, fontSize: 22)),
              const SizedBox(height: 32),
              for (final d in AIDifficulty.values)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 40),
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1E2A3A),
                      minimumSize: const Size(double.infinity, 56),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    onPressed: () => _startGame(d),
                    child: Text(
                      switch(d) { AIDifficulty.easy => 'かんたん', AIDifficulty.normal => 'ふつう', AIDifficulty.hard => 'むずかしい' },
                      style: const TextStyle(color: Colors.white, fontSize: 18),
                    ),
                  ),
                ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0A1628),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: Colors.white), onPressed: () => context.go('/menu')),
        title: const Text('AI対戦', style: TextStyle(color: Colors.white)),
      ),
      body: Column(
        children: [
          if (_gameOver)
            Container(
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF1E2A3A),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(children: [
                Text(_result, style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
                const SizedBox(height: 12),
                ElevatedButton(
                  onPressed: () => context.go('/menu'),
                  child: const Text('タイトルへ'),
                ),
              ]),
            ),
          Expanded(
            child: Row(
              children: [
                Expanded(child: _buildSide('あなた', _playerFoods, _playerFoods.where((f) => f.floats).length)),
                Container(width: 1, color: Colors.white24),
                Expanded(child: _buildSide('AI', _cpuFoods, _cpuFoods.where((f) => f.floats).length)),
              ],
            ),
          ),
          if (!_gameOver) SizedBox(
            height: 120,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.all(8),
              children: _foods.map((f) => GestureDetector(
                onTap: () => _playerPick(f),
                child: Container(
                  width: 64,
                  margin: const EdgeInsets.symmetric(horizontal: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E2A3A),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_emojis[f.id] ?? '🍴', style: const TextStyle(fontSize: 28)),
                      Text(f.nameJa, style: const TextStyle(color: Colors.white, fontSize: 9), textAlign: TextAlign.center),
                    ],
                  ),
                ),
              )).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSide(String label, List<FoodItem> foods, int floatCount) {
    return Container(
      color: const Color(0xFF0D1B2A),
      padding: const EdgeInsets.all(8),
      child: Column(
        children: [
          Text('$label ($floatCount/$_targetFloat 浮かせた)',
              style: const TextStyle(color: Colors.white, fontSize: 12)),
          const Divider(color: Colors.white24),
          Expanded(
            child: Wrap(
              children: foods.map((f) => Padding(
                padding: const EdgeInsets.all(4),
                child: Text(_emojis[f.id] ?? '🍴', style: const TextStyle(fontSize: 28)),
              )).toList(),
            ),
          ),
        ],
      ),
    );
  }
}
