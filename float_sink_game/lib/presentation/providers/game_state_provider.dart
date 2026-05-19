import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/food_item.dart';
import '../../domain/physics/physics_body.dart';
import '../../domain/physics/physics_engine.dart';
import '../../domain/physics/water_simulation.dart';

enum GamePhase { idle, playing, animating, result }

class GameState {
  final List<PhysicsBody> bodies;
  final WaterSimulation water;
  final GamePhase phase;
  final int floatingCount;
  final int sinkingCount;

  const GameState({
    required this.bodies,
    required this.water,
    required this.phase,
    required this.floatingCount,
    required this.sinkingCount,
  });

  GameState copyWith({
    List<PhysicsBody>? bodies,
    WaterSimulation? water,
    GamePhase? phase,
    int? floatingCount,
    int? sinkingCount,
  }) =>
      GameState(
        bodies: bodies ?? this.bodies,
        water: water ?? this.water,
        phase: phase ?? this.phase,
        floatingCount: floatingCount ?? this.floatingCount,
        sinkingCount: sinkingCount ?? this.sinkingCount,
      );
}

class GameStateNotifier extends Notifier<GameState> {
  final PhysicsEngine _engine = PhysicsEngine();
  Timer? _timer;

  @override
  GameState build() => GameState(
        bodies: [],
        water: WaterSimulation(tankWidth: 300, tankHeight: 440),
        phase: GamePhase.idle,
        floatingCount: 0,
        sinkingCount: 0,
      );

  void dropFood(FoodItem food, double dropX) {
    final body = PhysicsBody(
      food: food,
      x: dropX.clamp(food.radius, 300 - food.radius),
      y: 0.0,
    );
    final newBodies = [...state.bodies, body];
    state.water.addFood(body);
    state = state.copyWith(bodies: newBodies, phase: GamePhase.animating);
    _startLoop();
  }

  void _startLoop() {
    _timer ??= Timer.periodic(const Duration(milliseconds: 16), _onTick);
  }

  void _onTick(Timer _) {
    _engine.step(state.bodies, state.water);
    state.water.updateRipples(1 / 60);

    final floatingCount =
        state.bodies.where((b) => b.isFloating && b.isSettled).length;
    final sinkingCount =
        state.bodies.where((b) => !b.isFloating && b.isSettled).length;
    final allSettled = state.bodies.isNotEmpty &&
        state.bodies.every((b) => b.isSettled);

    state = state.copyWith(
      bodies: List.from(state.bodies),
      floatingCount: floatingCount,
      sinkingCount: sinkingCount,
      phase: allSettled ? GamePhase.playing : GamePhase.animating,
    );
  }

  void reset() {
    _timer?.cancel();
    _timer = null;
    state = build();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}

final gameStateProvider =
    NotifierProvider<GameStateNotifier, GameState>(GameStateNotifier.new);
