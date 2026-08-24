import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum AuthRole { driver, student }

// App-wide auth state. Persists token + role in shared_preferences so the app
// stays logged in across restarts. Exposed to the widget tree via Provider.
class AuthState extends ChangeNotifier {
  String _token = '';
  AuthRole? _role;
  int? _userId;

  String get token => _token;
  AuthRole? get role => _role;
  int? get userId => _userId;
  bool get isLoggedIn => _token.isNotEmpty && _role != null;

  Future<void> restore() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    final role = prefs.getString('role');
    final userId = prefs.getInt('userId');
    if (token != null && token.isNotEmpty && role != null) {
      _token = token;
      _role = role == 'driver' ? AuthRole.driver : AuthRole.student;
      _userId = userId;
      notifyListeners();
    }
  }

  Future<void> login({
    required String token,
    required AuthRole role,
    int? userId,
  }) async {
    _token = token;
    _role = role;
    _userId = userId;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('token', token);
    await prefs.setString('role', role == AuthRole.driver ? 'driver' : 'student');
    if (userId != null) await prefs.setInt('userId', userId);
    notifyListeners();
  }

  Future<void> logout() async {
    _token = '';
    _role = null;
    _userId = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('role');
    await prefs.remove('userId');
    notifyListeners();
  }
}
