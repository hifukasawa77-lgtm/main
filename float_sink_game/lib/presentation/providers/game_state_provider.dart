import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/food_item.dart';
import '../../data/models/level.dart';
import '../../data/models/mission_entry.dart';
import '../../domain/physics/physics_body.dart';
import '../../domain/physics/physics_engine.dart';
import '../../domain/physics/water_simulation.dart';

enum GamePhase { idle, playing, animating, overflow, result }

class GameState {
  final List<PhysicsBody> bodies;
  final WaterSimulation water;
  final GamePhase phase;
  final int score;
  final GameLevel? currentLevel;
  final List<MissionEntry> currentMissions;
  final int floatingCount;
  final int sinkingCount;

  const GameState({
    required this.bodies,
    required this.water,
    required this.phase,
    required this.score,
    required this.currentLevel,
    required this.currentMissions,
    required this.floatingCount,
    required this.sinkingCount,
  });

  GameState copyWith({
    List<PhysicsBody>? bodies,
    WaterSimulation? water,
    GamePhase? phase,
    int? score,
    GameLevel? currentLevel,
    List<MissionEntry>? currentMissions,
    int? floatingCount,
    int? sinkingCount,
  }) => GameState(
    bodies: bodies ?? this.bodies,
    water: water ?? this.water,
    phase: phase ?? this.phase,
    score: score ?? this.score,
    currentLevel: currentLevel ?? this.currentLevel,
    currentMissions: currentMissions ?? this.currentMissions,
    floatingCount: floatingCount ?? this.floatingCount,
    sinkingCount: sinkingCount ?? this.sinkingCount,
  );

  int get totalVol => bodies.fold(0, (s, b) => s + b.food.volume);
  double get fillPercent => water.fillPercent;
  bool get isDanger => water.isDanger;
  bool get isOverflow => water.isOverflow;
}

class GameStateNotifier extends Notifier<GameState> {
  final PhysicsEngine _engine = PhysicsEngine();
  Timer? _timer;

  static WaterSimulation _defaultWater() => WaterSimulation(
    capacity: 160,
    waterVol: 35,
    tankHeight: 400,
    tankWidth: 300,
  );

  @override
  GameState build() => GameState(
    bodies: [],
    water: _defaultWater(),
    phase: GamePhase.idle,
    score: 0,
    currentLevel: null,
    currentMissions: [],
    floatingCount: 0,
    sinkingCount: 0,
  );

  void startLevel(GameLevel level, List<MissionEntry> missions, List<FoodItem> preItems) {
    _timer?.cancel();
    _timer = null;
    final water = WaterSimulation(
      capacity: level.capacity,
      waterVol: level.waterVol,
      tankHeight: 400,
      tankWidth: 300,
    );
    final bodies = <PhysicsBody>[];
    double sinkerVol = 0, floaterVol = 0;
    for (final food in preItems) {
      final body = PhysicsBody(
        food: food,
        x: 150.0,
        y: food.floats ? water.surfaceY - food.radius * 0.3 : 400 - food.radius,
        isSettled: true,
        isFloating: food.floats,
      );
      bodies.add(body);
      if (food.floats) floaterVol += food.displaceVolume;
      else sinkerVol += food.volume;
    }
    water.sinkerVol = sinkerVol;
    water.floaterSubVol = floaterVol;

    state = GameState(
      bodies: bodies,
      water: water,
      phase: GamePhase.playing,
      score: 0,
      currentLevel: level,
      currentMissions: missions,
      floatingCount: bodies.where((b) => b.isFloating).length,
      sinkingCount: bodies.where((b) => !b.isFloating).length,
    );
  }

  void dropFood(FoodItem food, double dropX) {
    if (state.isOverflow) return;
    final body = PhysicsBody(
      food: food,
      x: dropX.clamp(food.radius, 300 - food.radius),
      y: -food.radius * 2,
      velocityY: 0.0,
    );
    if (food.floats) {
      state.water.addFloater(food.displaceVolume);
    } else {
      state.water.addSinker(food.volume.toDouble());
    }
    final newBodies = [...state.bodies, body];
    state = state.copyWith(bodies: newBodies, phase: GamePhase.animating);
    _startLoop();
  }

  void _startLoop() {
    _timer ??= Timer.periodic(const Duration(milliseconds: 16), _onTick);
  }

  void _onTick(Timer _) {
    _engine.step(state.bodies, state.water);
    state.water.updateRipples(1 / 60);

    final floatingCount = state.bodies.where((b) => b.isFloating && b.isSettled).length;
    final sinkingCount = state.bodies.where((b) => !b.isFloating && b.isSettled).length;
    final allSettled = state.bodies.isNotEmpty && state.bodies.every((b) => b.isSettled);

    final score = floatingCount + sinkingCount;

    final updatedMissions = state.currentMissions.map((m) {
      if (m.isCompleted) return m;
      final completed = _checkMission(m.id, state.bodies, state.water.totalVolPercent * 100);
      if (completed) m.isCompleted = true;
      return m;
    }).toList();

    final missionBonus = updatedMissions.where((m) => m.isCompleted).fold(0, (s, m) => s + m.bonus);
    final totalScore = score + missionBonus;

    final phase = state.isOverflow
        ? GamePhase.overflow
        : (allSettled ? GamePhase.playing : GamePhase.animating);

    state = state.copyWith(
      bodies: List.from(state.bodies),
      floatingCount: floatingCount,
      sinkingCount: sinkingCount,
      score: totalScore,
      currentMissions: updatedMissions,
      phase: phase,
    );
  }

  bool _checkMission(String id, List<PhysicsBody> bodies, double fillPct) {
    final settled = bodies.where((b) => b.isSettled).toList();
    switch (id) {
      case 'float5': return settled.where((b) => b.isFloating).length >= 5;
      case 'sink5':  return settled.where((b) => !b.isFloating).length >= 5;
      case 'wmelon': return settled.any((b) => b.food.id == 'watermelon');
      case 'ten':    return settled.length >= 10;
      case 'big3':   return settled.where((b) => b.food.volume >= 10).length >= 3;
      case 'small5': return settled.where((b) => b.food.volume <= 5).length >= 5;
      case 'fruit5':
        const fruits = {'apple','banana','orange','peach','grapes','strawberry','lemon',
          'cherry','kiwi','mango','pear','watermelon','blueberry','plum','fig','pomelo','coconut'};
        return settled.where((b) => fruits.contains(b.food.id)).length >= 5;
      case 'noover': return fillPct <= 80;
      default: return false;
    }
  }

  void reset() {
    _timer?.cancel();
    _timer = null;
    state = build();
  }

  @override
  void dispose() {
    _timer?.cancel();
  }
}

final gameStateProvider = NotifierProvider<GameStateNotifier, GameState>(GameStateNotifier.new);
