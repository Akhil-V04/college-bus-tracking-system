import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'screens/login_screen.dart';
import 'screens/driver_home_screen.dart';
import 'screens/student_home_screen.dart';
import 'services/auth_state.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const BusTrackingApp());
}

class BusTrackingApp extends StatelessWidget {
  const BusTrackingApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AuthState(),
      child: const _Root(),
    );
  }
}

// Restores the stored session before deciding where to land.
class _Root extends StatefulWidget {
  const _Root();

  @override
  State<_Root> createState() => _RootState();
}

class _RootState extends State<_Root> {
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    _restore();
  }

  Future<void> _restore() async {
    await context.read<AuthState>().restore();
    if (mounted) setState(() => _ready = true);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Bus Tracking',
      theme: ThemeData(colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue)),
      initialRoute: '/',
      routes: {
        '/': (_) => _ready
            ? Consumer<AuthState>(
                builder: (context, auth, _) {
                  if (!auth.isLoggedIn) return const LoginScreen();
                  return auth.role == AuthRole.driver
                      ? const DriverHomeScreen()
                      : const StudentHomeScreen();
                },
              )
            : const Scaffold(body: Center(child: CircularProgressIndicator())),
        '/login': (_) => const LoginScreen(),
        '/driver': (_) => const DriverHomeScreen(),
        '/student': (_) => const StudentHomeScreen(),
      },
    );
  }
}
