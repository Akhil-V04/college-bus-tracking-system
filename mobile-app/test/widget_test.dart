import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:mobile_app/main.dart';

void main() {
  testWidgets('App boots and shows the login screen', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const BusTrackingApp());
    await tester.pumpAndSettle();

    expect(find.text('Bus Tracking'), findsOneWidget);
  });
}
