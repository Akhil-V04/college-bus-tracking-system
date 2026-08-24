import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:geolocator/geolocator.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../config.dart';
import '../services/api.dart';
import '../services/auth_state.dart';

// ---- Foreground service handler ----
// While the driver's trip is running, the app runs a foreground service so the
// OS does not kill GPS streaming when the screen is locked or the app is
// backgrounded. A moving vehicle spends most of a trip with the phone in the
// driver's pocket or on a mount — if streaming stopped there, the live map and
// ETA would freeze for everyone on the bus. The notification also gives the
// driver a quick "still tracking" reassurance.
class DriverForegroundHandler extends TaskHandler {
  @override
  Future<void> onStart(DateTime timestamp, TaskStarter starter) async {}

  @override
  void onRepeatEvent(DateTime timestamp) {}

  @override
  Future<void> onDestroy(DateTime timestamp) async {}
}

// ---- Driver home screen ----
class DriverHomeScreen extends StatefulWidget {
  const DriverHomeScreen({super.key});

  @override
  State<DriverHomeScreen> createState() => _DriverHomeScreenState();
}

class _DriverHomeScreenState extends State<DriverHomeScreen> {
  bool _loadingBus = true;
  Map<String, dynamic>? _bus;
  String _busError = '';

  int? _tripId;
  bool _streaming = false;
  DateTime? _lastSent;
  int _filledCount = 0;

  StreamSubscription<Position>? _positionSub;
  io.Socket? _socket;
  final _scanController = MobileScannerController();

  @override
  void initState() {
    super.initState();
    _loadBus();
  }

  @override
  void dispose() {
    _stopStreaming();
    super.dispose();
  }

  Future<void> _loadBus() async {
    final state = context.read<AuthState>();
    setState(() => _loadingBus = true);
    try {
      final driverId = state.userId;
      if (driverId == null) {
        setState(() {
          _busError = 'Not authenticated as a driver';
          _loadingBus = false;
        });
        return;
      }
      final data = await Api.get('/buses/by-driver/$driverId');
      setState(() {
        _bus = data;
        _loadingBus = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _busError = e.statusCode == 404
            ? 'No bus assigned to your account yet — ask the admin.'
            : e.message;
        _loadingBus = false;
      });
    } catch (e) {
      setState(() {
        _busError = 'Could not reach the server';
        _loadingBus = false;
      });
    }
  }

  Future<void> _startTrip() async {
    final busId = _bus?['id'];
    if (busId == null) return;
    setState(() => _loadingBus = true);
    try {
      final data = await Api.post('/trips/start', body: {'busId': busId});
      setState(() {
        _tripId = data['tripId'];
        _filledCount = 0;
        _loadingBus = false;
      });
      _connectSocket();
      _startStreaming();
    } on ApiException catch (e) {
      setState(() {
        _busError = e.message;
        _loadingBus = false;
      });
    } catch (e) {
      setState(() {
        _busError = 'Could not reach the server';
        _loadingBus = false;
      });
    }
  }

  Future<void> _endTrip() async {
    if (_tripId == null) return;
    try {
      await Api.post('/trips/$_tripId/end');
    } catch (_) {}
    _stopStreaming();
    setState(() {
      _tripId = null;
      _filledCount = 0;
    });
  }

  void _connectSocket() {
    _socket?.dispose();
    final socket = io.io(
      Config.socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .build(),
    );
    socket.connect();
    _socket = socket;
  }

  void _startStreaming() {
    if (_tripId == null) return;
    // Foreground service keeps the app alive in the background.
    FlutterForegroundTask.init(
      androidNotificationOptions: AndroidNotificationOptions(
        channelId: 'bus_tracking',
        channelName: 'Bus Trip',
        channelDescription: 'Streaming live location for the active bus trip',
      ),
      iosNotificationOptions: const IOSNotificationOptions(),
      foregroundTaskOptions: ForegroundTaskOptions(
        eventAction: ForegroundTaskEventAction.nothing(),
      ),
    );
    FlutterForegroundTask.startService(
      notificationTitle: 'Bus trip running',
      notificationText: 'Streaming location to students...',
      callback: startCallback,
    );

    setState(() => _streaming = true);
    _lastSent = null;

    _positionSub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 20, // send when moved ~20m
        timeLimit: Duration.zero,
      ),
    ).listen(
      (pos) {
        _emitLocation(pos);
        setState(() => _lastSent = DateTime.now());
      },
      onError: (e) {
        debugPrint('GPS error: $e');
      },
    );

    // Fallback ticker so we also emit when the bus is stationary but time
    // passes (every 8s) — "8 seconds OR 20m, whichever comes first".
    Timer.periodic(const Duration(seconds: 8), (_) {
      if (!_streaming || _tripId == null) return;
      Geolocator.getCurrentPosition().then(_emitLocation);
    });
  }

  void _emitLocation(Position pos) {
    if (_tripId == null || _socket == null) return;
    _socket!.emit('driver:location', {
      'tripId': _tripId,
      'latitude': pos.latitude,
      'longitude': pos.longitude,
    });
  }

  void _stopStreaming() {
    _streaming = false;
    _positionSub?.cancel();
    _positionSub = null;
    _socket?.dispose();
    _socket = null;
    FlutterForegroundTask.stopService();
  }

  // ---- QR scan ----
  Future<void> _openScanner() async {
    if (_tripId == null) return;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => Scaffold(
          appBar: AppBar(title: const Text('Scan Student QR')),
          body: MobileScanner(
            controller: _scanController,
            onDetect: (barcodeCapture) {
              final barcodes = barcodeCapture.barcodes;
              if (barcodes.isEmpty) return;
              final raw = barcodes.first.rawValue;
              if (raw == null || raw.isEmpty) return;
              _handleScan(raw);
            },
          ),
        ),
      ),
    );
  }

  Future<void> _handleScan(String rollNo) async {
    if (_tripId == null) return;
    try {
      final data = await Api.post('/trips/$_tripId/board', body: {'rollNo': rollNo});
      setState(() => _filledCount = data['filledCount']);
      if (mounted) {
        _showMessage(
          'Boarded: ${data['name']} (${data['rollNo']})',
          isError: false,
        );
      }
    } on ApiException catch (e) {
      if (mounted) _showMessage(e.message, isError: true);
    } catch (e) {
      if (mounted) _showMessage('Could not reach the server', isError: true);
    }
  }

  void _showMessage(String msg, {required bool isError}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: isError ? Colors.red : Colors.green,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Driver'),
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
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: _loadingBus
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                children: [
                  _busCard(),
                  const SizedBox(height: 16),
                  _tripControls(),
                  const SizedBox(height: 16),
                  _statusCard(),
                  if (_tripId != null) ...[
                    const SizedBox(height: 16),
                    _boardingCard(),
                  ],
                ],
              ),
      ),
    );
  }

  Widget _busCard() {
    if (_bus == null) {
      return Card(
        child: ListTile(
          leading: const Icon(Icons.directions_bus),
          title: Text(_busError.isEmpty ? 'Loading bus...' : _busError),
        ),
      );
    }
    final route = _bus!['route'];
    return Card(
      child: ListTile(
        leading: const Icon(Icons.directions_bus),
        title: Text('Bus ${_bus!['busNo']}'),
        subtitle: Text(route != null ? 'Route ${route['routeNo']} — ${route['name']}' : 'No route'),
      ),
    );
  }

  Widget _tripControls() {
    if (_tripId == null) {
      return SizedBox(
        width: double.infinity,
        child: FilledButton.icon(
          onPressed: _bus == null ? null : _startTrip,
          icon: const Icon(Icons.play_arrow),
          label: const Text('Start Trip'),
        ),
      );
    }
    return Row(
      children: [
        Expanded(
          child: FilledButton.icon(
            onPressed: _openScanner,
            icon: const Icon(Icons.qr_code_scanner),
            label: const Text('Scan Student'),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: OutlinedButton.icon(
            onPressed: _endTrip,
            icon: const Icon(Icons.stop),
            label: const Text('End Trip'),
          ),
        ),
      ],
    );
  }

  Widget _statusCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _streaming
                  ? 'Streaming location...'
                  : _tripId != null
                      ? 'Ready'
                      : 'Not in a trip',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            Text(
              _lastSent == null
                  ? 'Last sent: —'
                  : 'Last sent: ${_lastSent!.hour.toString().padLeft(2, '0')}:${_lastSent!.minute.toString().padLeft(2, '0')}:${_lastSent!.second.toString().padLeft(2, '0')}',
              style: TextStyle(color: Colors.grey.shade600),
            ),
          ],
        ),
      ),
    );
  }

  Widget _boardingCard() {
    final capacity = _bus?['capacity'] ?? 0;
    return Card(
      child: ListTile(
        leading: const Icon(Icons.people),
        title: Text('Boarded: $_filledCount / $capacity'),
        subtitle: const Text('Scans update this count automatically'),
      ),
    );
  }
}

// Needed by flutter_foreground_task for the callback signature.
void startCallback() {
  FlutterForegroundTask.setTaskHandler(DriverForegroundHandler());
}
