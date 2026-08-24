import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

// Shows the student's roll number as a QR code. The driver scans this with the
// scanner in the driver app, which calls POST /trips/:id/board with the rollNo.
class QrScreen extends StatelessWidget {
  const QrScreen({super.key, required this.rollNo, required this.name});

  final String rollNo;
  final String name;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Boarding QR')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(name, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 4),
              Text('Roll No. $rollNo',
                  style: Theme.of(context).textTheme.bodyMedium),
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey.shade300),
                ),
                child: QrImageView(
                  data: rollNo,
                  version: QrVersions.auto,
                  size: 240,
                  backgroundColor: Colors.white,
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'Show this QR to the driver while boarding.',
                style: TextStyle(color: Colors.grey),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
