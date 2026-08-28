import type { ExpoConfig } from "expo/config";

import versionConfig from "./app-version.json";

const base: ExpoConfig = {
  name: "Ray Mobile",
  owner: "listerinepaks",
  slug: "ray-mobile",
  version: "1.2.0",
  orientation: "portrait",
  icon: "../visual/icon.png",
  scheme: "raymobile",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "Ray uses your location to show today's sunrise and sunset times.",
      NSCameraUsageDescription: "Ray uses your camera so you can capture photos for moments.",
      NSPhotoLibraryUsageDescription:
        "Ray uses your photo library so you can add photos to moments.",
      NSUserNotificationUsageDescription:
        "Ray sends notifications for friend moments and social activity.",
      ITSAppUsesNonExemptEncryption: false,
    },
    bundleIdentifier: "com.listerinepaks.raymobile",
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "../visual/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    predictiveBackGestureEnabled: false,
    permissions: [
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_FINE_LOCATION",
    ],
    package: "com.listerinepaks.raymobile",
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-font",
    "expo-image",
    "expo-location",
    "expo-image-picker",
    "expo-notifications",
    "expo-secure-store",
    "expo-sharing",
    [
      "expo-splash-screen",
      {
        image: "../visual/splash-icon.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff",
      },
    ],
    "expo-status-bar",
    "expo-web-browser",
    "@react-native-community/datetimepicker",
  ],
  experiments: {
    typedRoutes: true,
  },
};
const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
const baseExtra = (base.extra ?? {}) as Record<string, unknown>;
const baseEas = (baseExtra.eas ?? {}) as Record<string, unknown>;

const config: ExpoConfig = {
  ...base,
  extra: {
    ...baseExtra,
    eas: {
      ...baseEas,
      ...(easProjectId ? { projectId: easProjectId } : {}),
    },
  },
  version: versionConfig.version,
  ios: {
    ...base.ios,
    buildNumber: versionConfig.iosBuildNumber,
  },
  android: {
    ...base.android,
    versionCode: versionConfig.androidVersionCode,
  },
};

export default config;
