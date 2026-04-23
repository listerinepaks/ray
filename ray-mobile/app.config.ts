import type { ExpoConfig } from "expo/config";

import appJson from "./app.json";
import versionConfig from "./app-version.json";

const base = (appJson as { expo: ExpoConfig }).expo;

const config: ExpoConfig = {
  ...base,
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
