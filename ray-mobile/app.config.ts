import type { ExpoConfig } from "expo/config";

import appJson from "./app.json";
import versionConfig from "./app-version.json";

const base = (appJson as { expo: ExpoConfig }).expo;
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
