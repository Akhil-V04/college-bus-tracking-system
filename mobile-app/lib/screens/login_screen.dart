import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:provider/provider.dart';

import '../config.dart';
import '../services/api.dart';
import '../services/auth_state.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool _isDriver = true;
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _loading = false;
  String _error = '';

  @override
  void dispose() {
    _phoneController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _passwordLogin() async {
    final auth = context.read<AuthState>();
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final data = await Api.loginPassword(
        role: 'driver',
        identifier: _phoneController.text.trim(),
        password: _passwordController.text,
      );
      final token = data['token'] as String;
      final id = data['id'] as int?;
      Api.setAuth(token: token, role: 'driver');
      await auth.login(token: token, role: AuthRole.driver, userId: id);
      if (!mounted) return;
      Navigator.of(context).pushReplacementNamed('/driver');    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Could not reach the server');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _googleLogin() async {
    final auth = context.read<AuthState>();
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final googleUser = await GoogleSignIn(
        scopes: ['email', 'profile'],
        serverClientId: Config.googleClientId.isEmpty ? null : Config.googleClientId,
      ).signIn();
      if (googleUser == null) return;

      final gauth = await googleUser.authentication;
      final idToken = gauth.idToken;
      if (idToken == null) {
        setState(() => _error = 'Google sign-in did not return an id token');
        return;
      }

      final data = await Api.loginGoogle(role: 'student', idToken: idToken);
      final token = data['token'] as String;
      final id = data['id'] as int?;
      Api.setAuth(token: token, role: 'student');
      await auth.login(token: token, role: AuthRole.student, userId: id);
      if (!mounted) return;
      Navigator.of(context).pushReplacementNamed('/student');
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Could not reach the server');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Bus Tracking',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 24),

                SegmentedButton<bool>(
                  segments: const [
                    ButtonSegment(value: true, label: Text('Driver')),
                    ButtonSegment(value: false, label: Text('Student')),
                  ],
                  selected: {_isDriver},
                  onSelectionChanged: (s) => setState(() => _isDriver = s.first),
                ),
                const SizedBox(height: 24),

                if (_error.isNotEmpty) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(_error, style: TextStyle(color: Colors.red.shade700)),
                  ),
                  const SizedBox(height: 16),
                ],

                if (_isDriver) ...[
                  TextField(
                    controller: _phoneController,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                      labelText: 'Phone number',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _passwordController,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'Password',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: _loading ? null : _passwordLogin,
                    child: _loading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Sign in as Driver'),
                  ),
                ] else ...[
                  const Text(
                    'Sign in with your college Google account.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.grey),
                  ),
                  const SizedBox(height: 16),
                  OutlinedButton.icon(
                    onPressed: Config.googleClientId.isEmpty ? null : _googleLogin,
                    icon: const Icon(Icons.g_mobiledata),
                    label: const Text('Sign in with Google'),
                  ),
                  if (Config.googleClientId.isEmpty)
                    const Padding(
                      padding: EdgeInsets.only(top: 8),
                      child: Text(
                        'Set googleClientId in lib/config.dart to enable',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                    ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
