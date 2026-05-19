import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../data/models/food_item.dart';
import '../../data/models/mission.dart';
import '../../data/repositories/food_repository.dart';
import '../../domain/services/mission_evaluator.dart';
import '../providers/game_state_provider.dart';
import '../providers/mission_provider.dart';
import '../widgets/aquarium/aquarium_widget.dart';
import '../widgets/food/food_draggable.dart';
import '../widgets/hud/water_level_gauge.dart';
import '../widgets/hud/mission_panel.dart';

class MissionPlayScreen extends ConsumerStatefulWidget {
  final String missionId;
  const MissionPlayScreen({super.key, required this.missionId});

  @override
  ConsumerState<MissionPlayScreen> createState() => _MissionPlayScreenState();
}

class _MissionPlayScreenState extends ConsumerState<MissionPlayScreen>
    with SingleTickerProviderStateMixin {
  late final Ticker _waveTicker;
  double _wavePhase = 0.0;
  List<FoodItem> _foods = [];
  bool _loading = true;
  bool _cleared = false;

  Timer? _evalTimer;
  Timer? _countdownTimer;
  int _remainingSeconds = 0;

  final _evaluator = MissionEvaluator();

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

  Mission? _findMission(MissionState missionState) {
    final matches = missionState.missions
        .where((m) => m.id == widget.missionId);
    return matches.isNotEmpty ? matches.first : null;
  }

  void _startEvalLoop(Mission mission) {
    _evalTimer?.cancel();
    _evalTimer = Timer.periodic(const Duration(milliseconds: 16), (_) {
      if (_cleared) return;
      final gameState = ref.read(gameStateProvider);
      if (gameState.bodies.isEmpty) return;
      final ok = _evaluator.evaluate(
          mission, gameState.bodies, gameState.water);
      if (ok) {
        _cleared = true;
        _evalTimer?.cancel();
        _countdownTimer?.cancel();
        _handleCleared(mission);
      }
    });
  }

  void _startCountdown(Mission mission) {
    if (mission.timeLimit <= 0) return;
    setState(() => _remainingSeconds = mission.timeLimit);
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => _remainingSeconds--);
      if (_remainingSeconds <= 0) {
        _countdownTimer?.cancel();
        _evalTimer?.cancel();
        if (!_cleared) {
          _handleTimeUp(mission);
        }
      }
    });
  }

  Future<void> _handleCleared(Mission mission) async {
    await ref.read(missionProvider.notifier).markCleared(widget.missionId);
    if (mounted) {
      context.go('/result', extra: {
        'cleared': true,
        'missionTitle': mission.titleJa,
      });
    }
  }

  void _handleTimeUp(Mission mission) {
    if (!mounted) return;
    context.go('/result', extra: {
      'cleared': false,
      'missionTitle': mission.titleJa,
    });
  }

  @override
  void dispose() {
    _waveTicker.dispose();
    _evalTimer?.cancel();
    _countdownTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final gameState = ref.watch(gameStateProvider);
    final missionAsync = ref.watch(missionProvider);

    return missionAsync.when(
      loading: () => const Scaffold(
        backgroundColor: Color(0xFF0A1628),
        body: Center(child: CircularProgressIndicator()),
      ),
      error: (e, _) => Scaffold(
        backgroundColor: const Color(0xFF0A1628),
        body: Center(
            child: Text('エラー: $e',
                style: const TextStyle(color: Colors.white))),
      ),
      data: (missionState) {
        final mission = _findMission(missionState);
        if (mission == null) {
          return Scaffold(
            backgroundColor: const Color(0xFF0A1628),
            body: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text('ミッションが見つかりません',
                      style: TextStyle(color: Colors.white)),
                  TextButton(
                    onPressed: () => context.go('/missions'),
                    child: const Text('戻る',
                        style: TextStyle(color: Colors.lightBlueAccent)),
                  ),
                ],
              ),
            ),
          );
        }

        if (_evalTimer == null && !_cleared) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (!mounted || _evalTimer != null) return;
            _startEvalLoop(mission);
            if (mission.timeLimit > 0 && _countdownTimer == null) {
              _startCountdown(mission);
            }
          });
        }

        final displaySeconds = mission.timeLimit > 0
            ? _remainingSeconds
            : mission.timeLimit;

        return Scaffold(
          backgroundColor: const Color(0xFF0A1628),
          appBar: AppBar(
            backgroundColor: Colors.transparent,
            elevation: 0,
            title: Text(mission.titleJa,
                style: const TextStyle(color: Colors.white, fontSize: 15)),
            leading: IconButton(
              icon: const Icon(Icons.arrow_back, color: Colors.white),
              onPressed: () {
                _evalTimer?.cancel();
                _countdownTimer?.cancel();
                context.go('/missions');
              },
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.refresh, color: Colors.white70),
                onPressed: () {
                  _cleared = false;
                  _evalTimer?.cancel();
                  _evalTimer = null;
                  _countdownTimer?.cancel();
                  _countdownTimer = null;
                  ref.read(gameStateProvider.notifier).reset();
                  setState(() {});
                },
              ),
            ],
          ),
          body: Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 4),
                child: MissionPanel(
                  mission: mission,
                  remainingSeconds: displaySeconds,
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 4),
                child: WaterLevelGauge(
                    waterLevelPercent:
                        gameState.water.waterLevelPercent),
              ),
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    Text('🌊 浮く: ${gameState.floatingCount}',
                        style: const TextStyle(
                            color: Colors.lightBlueAccent,
                            fontSize: 12)),
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
                      final box = context.findRenderObject()
                          as RenderBox?;
                      final local =
                          box?.globalToLocal(details.offset) ??
                              Offset.zero;
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
                    ? const Center(
                        child: CircularProgressIndicator())
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
      },
    );
  }
}
