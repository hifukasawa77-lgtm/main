import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme.dart';
import 'core/router.dart';

class FloatSinkApp extends ConsumerWidget {
  const FloatSinkApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'うかぶ？しずむ？',
      debugShowCheckedModeBanner: false,
      theme: FloatSinkTheme.lightTheme,
      routerConfig: AppRouter.router,
    );
  }
}
