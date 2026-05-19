import 'package:flutter/material.dart';
import '../../../data/models/mission.dart';

class MissionPanel extends StatelessWidget {
  final Mission mission;
  final int remainingSeconds;

  const MissionPanel(
      {super.key, required this.mission, required this.remainingSeconds});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFF1E2A3A),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(mission.titleJa,
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.bold)),
                Text(mission.descJa,
                    style: const TextStyle(
                        color: Colors.white54, fontSize: 10),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
          if (mission.timeLimit > 0)
            Text(
              '${remainingSeconds}s',
              style: TextStyle(
                color: remainingSeconds <= 10
                    ? Colors.redAccent
                    : Colors.white70,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
        ],
      ),
    );
  }
}
