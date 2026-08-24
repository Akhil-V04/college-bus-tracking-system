import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../config.dart';
import '../services/api.dart';
import '../services/auth_state.dart';
import 'qr_screen.dart';

// Student view: shows the running bus for the student's route on a live map
// with a stop-by-stop timeline, plus the student's boarding QR.
class StudentHomeScreen extends StatefulWidget {
  const StudentHomeScreen({super.key});

  @override
  State<StudentHomeScreen> createState() => _StudentHomeScreenState();
}

class _StudentHomeScreenState extends State<StudentHomeScreen> {
  bool _loading = true;
  String _error = '';

  Map<String, dynamic>? _student;
  Map<String, dynamic>? _trip;
  Map<String, dynamic>? _busLocation;
  int _currentStopIndex = -1;
  int _filledCount = 0;
  DateTime? _lastUpdate;
  CameraFit? _cameraFit;

  int? _etaMinutesToBoarding;
  Timer? _etaTimer;

  io.Socket? _socket;

  @override
  void initState() {
    super.initState();
    _load();
    _etaTimer = Timer.periodic(const Duration(seconds: 30), (_) => _refreshEta());
  }

  @override
  void dispose() {
    _etaTimer?.cancel();
    _socket?.dispose();
    _socket = null;
    super.dispose();
  }

  List<dynamic> get _routeStops {
    final route = _student?['route'];
    final stops = route?['routeStops'] as List<dynamic>? ?? const [];
    final copy = List.of(stops)
      ..sort((a, b) => ((a['sequenceOrder'] as num?) ?? 0)
          .compareTo((b['sequenceOrder'] as num?) ?? 0));
    return copy;
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final student = await Api.getMe();
      final trips = await Api.getActiveTrips();

      // Find the running trip for this student's route.
      Map<String, dynamic>? trip;
      for (final t in trips) {
        final route = t['route'];
        if (route != null && route['id'] == student['routeId']) {
          trip = t;
          break;
        }
      }

      _filledCount = trip?['filledCount'] ?? 0;
      _trip = trip;
      _student = student;

      if (trip != null) {
        final loc = trip['latestLocation'];
        int idx = (loc != null && loc['currentStopIndex'] is int)
            ? loc['currentStopIndex']
            : -1;
        if (loc != null && idx < 0) {
          idx = _nearestStopIndex(
            (loc['latitude'] as num).toDouble(),
            (loc['longitude'] as num).toDouble(),
          );
        }
        _busLocation = loc;
        _currentStopIndex = idx;
        _computeCamera();
      }

      if (!mounted) return;
      setState(() => _loading = false);
      if (trip != null) {
        _connectSocket(trip['tripId']);
        _refreshEta();
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not reach the server';
        _loading = false;
      });
    }
  }

  // Which stop index is closest to the bus right now (used when the backend has
  // not yet advanced the stop counter).
  int _nearestStopIndex(double lat, double lng) {
    final stops = _routeStops;
    if (stops.isEmpty) return 0;
    const distance = Distance();
    double best = double.infinity;
    int bestIdx = 0;
    for (int i = 0; i < stops.length; i++) {
      final stop = stops[i]['stop'];
      final d = distance(
        LatLng((stop['latitude'] as num).toDouble(), (stop['longitude'] as num).toDouble()),
        LatLng(lat, lng),
      );
      if (d < best) {
        best = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  void _computeCamera() {
    final points = <LatLng>[
      for (final rs in _routeStops)
        LatLng(
          ((rs['stop']['latitude'] as num)).toDouble(),
          ((rs['stop']['longitude'] as num)).toDouble(),
        ),
    ];
    final loc = _busLocation;
    if (loc != null && loc['latitude'] is num) {
      points.add(LatLng(
        (loc['latitude'] as num).toDouble(),
        (loc['longitude'] as num).toDouble(),
      ));
    }
    if (points.isEmpty) {
      _cameraFit = null;
      return;
    }
    _cameraFit = CameraFit.bounds(
      bounds: LatLngBounds.fromPoints(points),
      padding: const EdgeInsets.all(48),
    );
  }

  LatLng _defaultCenter() {
    final loc = _busLocation;
    if (loc != null && loc['latitude'] is num) {
      return LatLng((loc['latitude'] as num).toDouble(), (loc['longitude'] as num).toDouble());
    }
    final stop = _student?['boardingStop'];
    if (stop != null && stop['latitude'] is num) {
      return LatLng((stop['latitude'] as num).toDouble(), (stop['longitude'] as num).toDouble());
    }
    if (_routeStops.isNotEmpty) {
      final s = _routeStops.first['stop'];
      return LatLng((s['latitude'] as num).toDouble(), (s['longitude'] as num).toDouble());
    }
    return const LatLng(17.385, 78.4867); // Hyderabad fallback
  }

  void _connectSocket(int tripId) {
    _socket?.dispose();
    final socket = io.io(
      Config.socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .build(),
    );
    socket.onConnect((_) {
      socket.emit('join:trip', {'tripId': tripId});
    });
    socket.on('bus:update', (data) {
      if (!mounted || data == null) return;
      final d = data as Map<String, dynamic>;
      final idx = d['currentStopIndex'];
      setState(() {
        _busLocation = d;
        _lastUpdate = DateTime.now();
        if (idx is int && idx >= 0) _currentStopIndex = idx;
      });
    });
    socket.on('occupancy:update', (data) {
      if (!mounted || data == null) return;
      final d = data as Map<String, dynamic>;
      if (d['filledCount'] is int) {
        setState(() => _filledCount = d['filledCount']);
      }
    });
    socket.connect();
    _socket = socket;
  }

  // Refresh the predicted arrival time at the student's boarding stop.
  Future<void> _refreshEta() async {
    final trip = _trip;
    final boardingId = _student?['boardingStopId'];
    if (trip == null || boardingId == null) return;
    try {
      final eta = await Api.getTripEta(trip['tripId'] as int);
      int? minutes;
      for (final s in (eta['stops'] as List? ?? const [])) {
        if (s['stopId'] == boardingId) {
          final m = s['etaMinutes'];
          minutes = m is int ? m : null;
          break;
        }
      }
      if (!mounted) return;
      setState(() => _etaMinutesToBoarding = minutes);
    } catch (_) {
      // ETA is a nice-to-have — never block the UI on it.
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Student'),
        actions: [
          IconButton(
            onPressed: () async {
              await context.read<AuthState>().logout();
              if (context.mounted) {
                Navigator.of(context).pushReplacementNamed('/login');
              }
            },
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: 400, child: Center(child: CircularProgressIndicator())),
        ],
      );
    }
    if (_error.isNotEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: 200),
          Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                const Icon(Icons.error_outline, size: 48, color: Colors.grey),
                const SizedBox(height: 12),
                Text(_error, textAlign: TextAlign.center),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: _load,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Retry'),
                ),
              ],
            ),
          ),
        ],
      );
    }

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      children: [
        _studentCard(),
        const SizedBox(height: 12),
        if (_trip == null) _noTripCard() else ..._tripCards(),
      ],
    );
  }

  List<Widget> _tripCards() => [
        _mapCard(),
        const SizedBox(height: 12),
        _tripStatusCard(),
        const SizedBox(height: 12),
        _timelineCard(),
        const SizedBox(height: 12),
        _qrButton(),
      ];

  Widget _studentCard() {
    final student = _student;
    final route = student?['route'];
    final boarding = student?['boardingStop'];
    return Card(
      child: ListTile(
        leading: const CircleAvatar(child: Icon(Icons.person)),
        title: Text(student?['name'] ?? 'Student'),
        subtitle: Text(
          '${student?['rollNo'] ?? ''}  ·  Route ${route?['routeNo'] ?? '—'}\n'
          'Boarding: ${boarding?['name'] ?? '—'}',
        ),
        isThreeLine: true,
      ),
    );
  }

  Widget _noTripCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            const Icon(Icons.directions_bus_outlined, size: 48, color: Colors.grey),
            const SizedBox(height: 12),
            const Text(
              'No bus is running on your route right now.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 4),
            Text(
              'Pull down to refresh.',
              style: TextStyle(color: Colors.grey.shade600),
            ),
          ],
        ),
      ),
    );
  }

  Widget _mapCard() {
    final stops = _routeStops;
    if (stops.isEmpty) return const SizedBox.shrink();

    final markers = <Marker>[
      for (int i = 0; i < stops.length; i++) _stopMarker(i, stops[i]),
      if (_busMarker() != null) _busMarker()!,
    ];

    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            height: 280,
            child: FlutterMap(
              options: MapOptions(
                initialCameraFit: _cameraFit,
                initialCenter: _defaultCenter(),
                initialZoom: 13,
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.college.bustracker',
                ),
                if (stops.length > 1)
                  PolylineLayer(
                    polylines: [
                      Polyline(
                        points: [
                          for (final rs in stops)
                            LatLng(
                              ((rs['stop']['latitude'] as num)).toDouble(),
                              ((rs['stop']['longitude'] as num)).toDouble(),
                            ),
                        ],
                        strokeWidth: 4,
                        color: Colors.blue,
                      ),
                    ],
                  ),
                MarkerLayer(markers: markers),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Text(
              'Route ${_trip?['route']?['name'] ?? ''} — ${_trip?['bus']?['busNo'] ?? ''}',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  Marker _stopMarker(int index, Map<String, dynamic> routeStop) {
    final stop = routeStop['stop'];
    final isCurrent = index == _currentStopIndex;
    final isPassed = index < _currentStopIndex;

    Color color;
    IconData icon;
    if (isCurrent) {
      color = Colors.blue;
      icon = Icons.navigation;
    } else if (isPassed) {
      color = Colors.green;
      icon = Icons.check_circle;
    } else {
      color = Colors.grey;
      icon = Icons.circle;
    }

    return Marker(
      point: LatLng(
        (stop['latitude'] as num).toDouble(),
        (stop['longitude'] as num).toDouble(),
      ),
      width: isCurrent ? 40 : 28,
      height: isCurrent ? 40 : 28,
      child: Container(
        decoration: BoxDecoration(
          color: isCurrent ? Colors.blue : Colors.white,
          shape: BoxShape.circle,
          border: Border.all(color: color, width: 2),
          boxShadow: isCurrent
              ? [BoxShadow(color: Colors.blue.shade300, blurRadius: 8, spreadRadius: 2)]
              : null,
        ),
        child: Icon(icon, size: isCurrent ? 22 : 14, color: isCurrent ? Colors.white : color),
      ),
    );
  }

  Marker? _busMarker() {
    final loc = _busLocation;
    if (loc == null || loc['latitude'] is! num) return null;
    return Marker(
      point: LatLng(
        (loc['latitude'] as num).toDouble(),
        (loc['longitude'] as num).toDouble(),
      ),
      width: 44,
      height: 44,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.blue.shade700,
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white, width: 3),
          boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 6)],
        ),
        child: const Icon(Icons.directions_bus, color: Colors.white, size: 26),
      ),
    );
  }

  Widget _tripStatusCard() {
    final trip = _trip!;
    final bus = trip['bus'];
    final driver = trip['driver'];
    final capacity = bus?['capacity'] ?? 0;
    final time = _lastUpdate == null
        ? '—'
        : '${_lastUpdate!.hour.toString().padLeft(2, '0')}:'
            '${_lastUpdate!.minute.toString().padLeft(2, '0')}:'
            '${_lastUpdate!.second.toString().padLeft(2, '0')}';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.people, size: 20),
                const SizedBox(width: 8),
                Text(
                  'Occupancy: $_filledCount / $capacity',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text('Driver: ${driver?['name'] ?? '—'}'),
            Text('Location updated: $time', style: TextStyle(color: Colors.grey.shade600)),
            if (_etaMinutesToBoarding != null) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.blue.shade50,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  'Your bus arrives in ~$_etaMinutesToBoarding min',
                  style: TextStyle(fontWeight: FontWeight.w600, color: Colors.blue.shade800),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _timelineCard() {
    final stops = _routeStops;
    if (stops.isEmpty) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Text('No stops defined for this route.'),
        ),
      );
    }
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Stops on this route',
                style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            for (int i = 0; i < stops.length; i++) _stopRow(i, stops[i]),
          ],
        ),
      ),
    );
  }

  Widget _stopRow(int index, Map<String, dynamic> routeStop) {
    final stop = routeStop['stop'];
    final isCurrent = index == _currentStopIndex;
    final isPassed = index < _currentStopIndex;
    final isBoarding = stop['id'] == _student?['boardingStopId'];

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(
            isCurrent
                ? Icons.navigation
                : isPassed
                    ? Icons.check_circle
                    : Icons.circle_outlined,
            size: 20,
            color: isCurrent
                ? Colors.blue
                : isPassed
                    ? Colors.green
                    : Colors.grey,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              stop['name'],
              style: TextStyle(
                fontWeight: isCurrent ? FontWeight.w700 : FontWeight.w400,
                color: isCurrent ? Colors.blue.shade800 : null,
              ),
            ),
          ),
          if (isBoarding)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.amber.shade100,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text('Your stop',
                  style: TextStyle(fontSize: 12, color: Colors.amber.shade900)),
            ),
          if (isCurrent)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.blue.shade100,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text('Bus here',
                  style: TextStyle(fontSize: 12, color: Colors.blue.shade900)),
            ),
        ],
      ),
    );
  }

  Widget _qrButton() {
    return FilledButton.icon(
      onPressed: () {
        final student = _student;
        if (student == null) return;
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => QrScreen(
              rollNo: student['rollNo']?.toString() ?? '',
              name: student['name']?.toString() ?? '',
            ),
          ),
        );
      },
      icon: const Icon(Icons.qr_code_2),
      label: const Text('Show My QR'),
    );
  }
}
