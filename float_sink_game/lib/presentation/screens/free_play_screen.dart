import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../data/models/food_item.dart';
import '../../data/models/level.dart';
import '../../data/models/mission_entry.dart';
import '../../data/repositories/food_repository.dart';
import '../../data/repositories/level_repository.dart';
import '../../data/repositories/mission_pool_repository.dart';
import '../providers/game_state_provider.dart';
import '../widgets/aquarium/aquarium_widget.dart';
import '../widgets/food/food_draggable.dart';
import '../widgets/hud/water_level_gauge.dart';

class FreePlayScreen extends ConsumerStatefulWidget {
  const FreePlayScreen({super.key});
  @override
  ConsumerState<FreePlayScreen> createState() => _FreePlayScreenState();
}

class _FreePlayScreenState extends ConsumerState<FreePlayScreen>
    with SingleTickerProviderStateMixin {
  late final Ticker _waveTicker;
  double _wavePhase = 0.0;
  List<FoodItem> _foods = [];
  GameLevel? _level;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _waveTicker = createTicker((_) => setState(() => _wavePhase += 0.05))..start();
    _init();
  }

  Future<void> _init() async {
    final foods = await FoodRepository().getFoods();
    final levels = await LevelRepository().getLevels();
    final missions = await MissionPoolRepository().getRandomMissions(2);
    final level = levels.first;
    final preItems = foods.where((f) => level.preItemIds.contains(f.id)).toList();
    if (mounted) {
      setState(() { _foods = foods; _level = level; _loading = false; });
      ref.read(gameStateProvider.notifier).startLevel(level, missions, preItems);
    }
  }

  @override
  void dispose() {
    _waveTicker.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final gameState = ref.watch(gameStateProvider);
    final visibleFoods = _foods.where((f) => f.tier == 1).toList();

    return Scaffold(
      backgroundColor: const Color(0xFF0A1628),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () { ref.read(gameStateProvider.notifier).reset(); context.go('/menu'); },
        ),
        title: Text(
          _level?.nameJa ?? 'フリープレイ',
          style: const TextStyle(color: Colors.white, fontSize: 16),
        ),
        actions: [
          Center(child: Text(
            '${gameState.score}点',
            style: const TextStyle(color: Colors.amberAccent, fontSize: 18, fontWeight: FontWeight.bold),
          )),
          const SizedBox(width: 8),
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white70),
            onPressed: () => _init(),
          ),
          TextButton(
            onPressed: () { ref.read(gameStateProvider.notifier).reset(); context.go('/result'); },
            child: const Text('終了', style: TextStyle(color: Colors.lightBlueAccent)),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                child: Column(children: [
                  WaterLevelGauge(waterLevelPercent: gameState.water.fillPercent),
                  const SizedBox(height: 4),
                  Row(children: [
                    Text(
                      '💧 ${(gameState.water.fillPercent * (_level?.capacity ?? 160)).toStringAsFixed(0)}L / ${_level?.capacity ?? 160}L',
                      style: const TextStyle(color: Colors.white54, fontSize: 11),
                    ),
                    const Spacer(),
                    Text(
                      '🌊 ${gameState.floatingCount}個浮 / ⬇️ ${gameState.sinkingCount}個沈',
                      style: const TextStyle(color: Colors.white54, fontSize: 11),
                    ),
                  ]),
                ]),
              ),
              if (gameState.currentMissions.isNotEmpty)
                _MissionBar(missions: gameState.currentMissions),
              Expanded(
                flex: 6,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  child: DragTarget<FoodItem>(
                    onWillAcceptWithDetails: (_) => !gameState.isOverflow && gameState.bodies.length < 20,
                    onAcceptWithDetails: (details) {
                      final box = context.findRenderObject() as RenderBox?;
                      final local = box?.globalToLocal(details.offset) ?? Offset.zero;
                      ref.read(gameStateProvider.notifier).dropFood(details.data, local.dx);
                    },
                    builder: (context, candidates, _) => AquariumWidget(
                      gameState: gameState,
                      wavePhase: _wavePhase,
                    ),
                  ),
                ),
              ),
              SizedBox(
                height: 110,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                  itemCount: visibleFoods.length,
                  itemBuilder: (_, i) => FoodDraggable(food: visibleFoods[i]),
                ),
              ),
            ]),
    );
  }
}

class _MissionBar extends StatelessWidget {
  final List<MissionEntry> missions;
  const _MissionBar({required this.missions});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
      child: Row(
        children: missions.map((m) => Expanded(
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 2),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: m.isCompleted
                  ? const Color(0xFF1B5E20).withOpacity(0.8)
                  : const Color(0xFF1E2A3A),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: m.isCompleted ? Colors.greenAccent : Colors.white24,
              ),
            ),
            child: Row(children: [
              Expanded(
                child: Text(
                  m.text,
                  style: TextStyle(
                    color: m.isCompleted ? Colors.greenAccent : Colors.white70,
                    fontSize: 10,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Text(
                '+${m.bonus}',
                style: TextStyle(
                  color: m.isCompleted ? Colors.greenAccent : Colors.white38,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ]),
          ),
        )).toList(),
      ),
    );
  }
}
