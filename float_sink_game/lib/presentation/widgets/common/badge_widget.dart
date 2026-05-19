import 'package:flutter/material.dart';
import '../../../data/models/achievement.dart';

class BadgeWidget extends StatelessWidget {
  final Achievement achievement;

  const BadgeWidget({super.key, required this.achievement});

  @override
  Widget build(BuildContext context) {
    return Card(
      color: achievement.isUnlocked ? const Color(0xFF1E3A5F) : Colors.grey[800],
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              achievement.isUnlocked ? achievement.iconEmoji : '❓',
              style: const TextStyle(fontSize: 32),
            ),
            const SizedBox(height: 8),
            Text(
              achievement.isUnlocked ? achievement.titleJa : '???',
              style: TextStyle(
                color: achievement.isUnlocked ? Colors.white : Colors.grey,
                fontSize: 12,
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
