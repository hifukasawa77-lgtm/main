import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import '../../data/datasources/local_storage.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(seconds: 2), _navigate);
  }

  Future<void> _navigate() async {
    if (!mounted) return;
    final ls = LocalStorage();
    final done = await ls.getTutorialCompleted();
    if (mounted) context.go(done ? '/menu' : '/tutorial');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A1628),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('💧', style: TextStyle(fontSize: 72))
                .animate().fadeIn(duration: 600.ms).scale(),
            const SizedBox(height: 24),
            const Text(
              'うかぶ？しずむ？',
              style: TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.bold),
            ).animate().fadeIn(delay: 300.ms, duration: 600.ms),
            const SizedBox(height: 8),
            const Text(
              '浮力パズルゲーム',
              style: TextStyle(color: Colors.white54, fontSize: 16),
            ).animate().fadeIn(delay: 600.ms, duration: 600.ms),
          ],
        ),
      ),
    );
  }
}
