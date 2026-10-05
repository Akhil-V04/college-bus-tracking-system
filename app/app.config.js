module.exports = {
  expo: {
    name: "College Bus Manage",
    slug: "college-bus-tracker",
    version: "1.1.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    scheme: "college-bus",
    userInterfaceStyle: "dark",
    newArchEnabled: true,
    splash: {
      backgroundColor: "#090F16"
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.college.bustracker",
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "This app needs location access to track your college bus in real time.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "Background location is needed to keep sharing bus GPS while driving.",
        UIBackgroundModes: ["location"]
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#090F16"
      },
      package: "com.college.bustracker",
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION"
      ],
      config: {
        googleMaps: {
          apiKey: process.env.MOBILE_GOOGLE_MAPS_API_KEY
        }
      }
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Allow College Bus Manage to use your location to share live bus position during trips.",
          "isAndroidBackgroundLocationEnabled": true,
          "isAndroidForegroundServiceEnabled": true
        }
      ]
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      eas: {
        projectId: "c90f7a3b-9002-43cd-bac2-8bd6d5f811f6"
      }
    }
  }
};
