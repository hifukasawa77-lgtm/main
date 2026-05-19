import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../data/models/food_item.dart';
import '../../data/repositories/food_repository.dart';
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
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _waveTicker = createTicker((_) {
      setState(() => _wavePhase += 0.05);
    })
      ..start();
    _loadFoods();
  }

  Future<void> _loadFoods() async {
    final foods = await FoodRepository().getFoods();
    if (mounted) {
      setState(() {
        _foods = foods;
        _loading = false;
      });
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

    return Scaffold(
      backgroundColor: const Color(0xFF0A1628),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title:
            const Text('フリープレイ', style: TextStyle(color: Colors.white)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => context.go('/menu'),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white70),
            onPressed: () => ref.read(gameStateProvider.notifier).reset(),
          ),
          TextButton(
            onPressed: () => context.go('/result'),
            child: const Text('終了',
                style: TextStyle(color: Colors.lightBlueAccent)),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: WaterLevelGauge(
                waterLevelPercent: gameState.water.waterLevelPercent),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Text('🌊 浮く: ${gameState.floatingCount}',
                    style: const TextStyle(
                        color: Colors.lightBlueAccent, fontSize: 12)),
                const SizedBox(width: 16),
                Text('⬇️ 沈む: ${gameState.sinkingCount}',
                    style: const TextStyle(
                        color: Colors.redAccent, fontSize: 12)),
              ],
            ),
          ),
          Expanded(
            flex: 6,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: DragTarget<FoodItem>(
                onWillAcceptWithDetails: (_) =>
                    gameState.bodies.length < 8,
                onAcceptWithDetails: (details) {
                  final box =
                      context.findRenderObject() as RenderBox?;
                  final local =
                      box?.globalToLocal(details.offset) ?? Offset.zero;
                  ref
                      .read(gameStateProvider.notifier)
                      .dropFood(details.data, local.dx);
                },
                builder: (context, candidates, rejected) =>
                    AquariumWidget(
                  gameState: gameState,
                  wavePhase: _wavePhase,
                ),
              ),
            ),
          ),
          SizedBox(
            height: 110,
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : ListView.builder(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 8),
                    itemCount: _foods.length,
                    itemBuilder: (_, i) =>
                        FoodDraggable(food: _foods[i]),
                  ),
          ),
        ],
      ),
    );
  }
}
