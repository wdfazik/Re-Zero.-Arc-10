import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'screens/home_screen.dart';
import 'services/reading_repository.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final preferences = await SharedPreferences.getInstance();
  runApp(ReZeroReaderApp(preferences: preferences));
}

class ReZeroReaderApp extends StatefulWidget {
  const ReZeroReaderApp({super.key, required this.preferences});

  final SharedPreferences preferences;

  @override
  State<ReZeroReaderApp> createState() => _ReZeroReaderAppState();
}

class _ReZeroReaderAppState extends State<ReZeroReaderApp> {
  static const _themeModeKey = 'settings:themeMode';

  late ThemeMode _themeMode;
  late final ReadingRepository _repository;

  @override
  void initState() {
    super.initState();
    _repository = ReadingRepository(preferences: widget.preferences);
    _themeMode = _readThemeMode();
  }

  ThemeMode _readThemeMode() {
    final saved = widget.preferences.getString(_themeModeKey);
    return saved == ThemeMode.light.name ? ThemeMode.light : ThemeMode.dark;
  }

  Future<void> _toggleTheme() async {
    final nextMode = _themeMode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark;
    setState(() => _themeMode = nextMode);
    await widget.preferences.setString(_themeModeKey, nextMode.name);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Re:Zero · Арка 10',
      themeMode: _themeMode,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.light,
        colorSchemeSeed: const Color(0xFF8A5E1A),
        scaffoldBackgroundColor: const Color(0xFFF0EBE0),
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        colorSchemeSeed: const Color(0xFFC8A46A),
        scaffoldBackgroundColor: const Color(0xFF080C14),
      ),
      home: HomeScreen(
        repository: _repository,
        isDarkMode: _themeMode == ThemeMode.dark,
        onToggleTheme: _toggleTheme,
      ),
    );
  }
}
