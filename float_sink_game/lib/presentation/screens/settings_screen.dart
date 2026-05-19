import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../data/datasources/local_storage.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});
  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _soundsEnabled = true;
  final _ls = LocalStorage();

  @override
  void initState() {
    super.initState();
    _ls.getSoundsEnabled().then((v) => setState(() => _soundsEnabled = v));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A1628),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text('設定', style: TextStyle(color: Colors.white)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => context.go('/menu'),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            color: const Color(0xFF1E2A3A),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: SwitchListTile(
              title: const Text('サウンド', style: TextStyle(color: Colors.white)),
              subtitle: const Text('効果音・BGM', style: TextStyle(color: Colors.white54)),
              value: _soundsEnabled,
              onChanged: (v) {
                setState(() => _soundsEnabled = v);
                _ls.setSoundsEnabled(v);
              },
              activeColor: const Color(0xFF2196F3),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            color: const Color(0xFF1E2A3A),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: ListTile(
              title: const Text('チュートリアルをもう一度', style: TextStyle(color: Colors.white)),
              trailing: const Icon(Icons.chevron_right, color: Colors.white38),
              onTap: () => context.go('/tutorial'),
            ),
          ),
          const SizedBox(height: 24),
          Center(
            child: Text(
              'うかぶ？しずむ？ v1.0.0\n小学校理科「物の浮き沈み」',
              style: const TextStyle(color: Colors.white38, fontSize: 12),
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }
}
