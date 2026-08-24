import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config.dart';

// Thin HTTP wrapper around the backend REST API. Throws ApiException with a
// user-friendly message on non-2xx responses.
class ApiException implements Exception {
  final int statusCode;
  final String message;
  ApiException(this.statusCode, this.message);
  @override
  String toString() => message;
}

class Api {
  static String _token = '';
  static String _role = '';

  static void setAuth({required String token, required String role}) {
    _token = token;
    _role = role;
  }

  static void clearAuth() {
    _token = '';
    _role = '';
  }

  static String get role => _role;

  static Map<String, String> _headers() => {
        'Content-Type': 'application/json',
        if (_token.isNotEmpty) 'Authorization': 'Bearer $_token',
      };

  static Future<Map<String, dynamic>> _handle(http.Response res) async {
    final decoded = res.body.isEmpty ? <String, dynamic>{} : jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      if (decoded is Map) {
        return decoded.map((k, v) => MapEntry(k.toString(), v));
      }
      return {'data': decoded};
    }
    final message =
        decoded is Map && decoded['error'] != null ? decoded['error'].toString() : 'Request failed';
    throw ApiException(res.statusCode, message);
  }

  static Future<Map<String, dynamic>> get(String path) async {
    final res = await http.get(Uri.parse('${Config.backendHost}$path'), headers: _headers());
    return _handle(res);
  }

  static Future<Map<String, dynamic>> post(String path, {Map<String, dynamic>? body}) async {
    final res = await http.post(Uri.parse('${Config.backendHost}$path'),
        headers: _headers(), body: body == null ? null : jsonEncode(body));
    return _handle(res);
  }

  // ---- Auth ----

  // Driver/admin password login. identifier = phone (driver) or email (admin).
  static Future<Map<String, dynamic>> loginPassword({
    required String role,
    required String identifier,
    required String password,
  }) async {
    final res = await http.post(
      Uri.parse('${Config.backendHost}/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'role': role, 'identifier': identifier, 'password': password}),
    );
    return _handle(res);
  }

  // Student/advisor Google login.
  static Future<Map<String, dynamic>> loginGoogle({
    required String role,
    required String idToken,
  }) async {
    final res = await http.post(
      Uri.parse('${Config.backendHost}/auth/google'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'role': role, 'idToken': idToken}),
    );
    return _handle(res);
  }

  // ---- Student ----

  // GET /students/me — the logged-in student's profile, route and stops.
  static Future<Map<String, dynamic>> getMe() async {
    return get('/students/me');
  }

  // GET /trips/active — every RUNNING trip with route + latest location.
  // Returns a List (the backend sends a bare JSON array).
  static Future<List<dynamic>> getActiveTrips() async {
    final res = await http.get(
      Uri.parse('${Config.backendHost}/trips/active'),
      headers: _headers(),
    );
    final decoded = res.body.isEmpty ? null : jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      if (decoded is List) return decoded;
      return const [];
    }
    final message = decoded is Map && decoded['error'] != null
        ? decoded['error'].toString()
        : 'Request failed';
    throw ApiException(res.statusCode, message);
  }

  // GET /trips/:id/eta — predicted arrival at each remaining stop.
  static Future<Map<String, dynamic>> getTripEta(int tripId) async {
    return get('/trips/$tripId/eta');
  }
}
