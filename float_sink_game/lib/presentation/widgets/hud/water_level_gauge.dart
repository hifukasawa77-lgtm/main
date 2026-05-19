import 'package:flutter/material.dart';

class WaterLevelGauge extends StatelessWidget {
  final double waterLevelPercent;

  const WaterLevelGauge({super.key, required this.waterLevelPercent});

  @override
  Widget build(BuildContext context) {
    final pct = (waterLevelPercent * 100).toStringAsFixed(0);
    final color = waterLevelPercent >= 0.80
        ? Colors.lightBlueAccent
        : const Color(0xFF2196F3);
    return Row(
      children: [
        const Icon(Icons.water, color: Colors.lightBlue, size: 18),
        const SizedBox(width: 4),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: waterLevelPercent.clamp(0.0, 1.0),
              backgroundColor: Colors.white12,
              valueColor: AlwaysStoppedAnimation<Color>(color),
              minHeight: 10,
            ),
          ),
        ),
        const SizedBox(width: 6),
        Text('$pct%',
            style: const TextStyle(color: Colors.white70, fontSize: 12)),
      ],
    );
  }
}
