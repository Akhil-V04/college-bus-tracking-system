// Central place to switch the backend host.
//
// - Android emulator: use 10.0.2.2 (the emulator's alias for the host machine's
//   localhost). This is the default so `flutter run` on an emulator works.
// - Real phone on the same Wi-Fi: replace with your laptop's LAN IP, e.g.
//   http://192.168.1.42:4000
// - iOS simulator: http://localhost:4000 works.
class Config {
  static const String backendHost = 'http://10.0.2.2:4000';
  static const String socketUrl = 'http://10.0.2.2:4000';

  // Android client ID from Google Cloud Console (used by google_sign_in).
  // TODO: replace with your real client ID. Keep empty to disable the button.
  static const String googleClientId = '';
}
