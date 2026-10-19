import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "BAMBA",
  slug: "bamba",
  version: "0.5.1",
  orientation: "landscape",
  userInterfaceStyle: "dark",
  scheme: ["br.com.conexus.bamba", "bamba"],
  backgroundColor: "#0B0B12",
  ios: {
    bundleIdentifier: "br.com.conexus.bamba",
    supportsTablet: true,
    requireFullScreen: true,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: "br.com.conexus.bamba",
    // jogo pago, sem anúncios: nada de identificador de publicidade
    blockedPermissions: ["com.google.android.gms.permission.AD_ID"],
  },
  extra: {
    eas: { projectId: process.env.EAS_PROJECT_ID ?? "00000000-0000-0000-0000-000000000000" },
  },
  plugins: [
    "expo-router",
    "expo-status-bar",
    "expo-web-browser",
    "expo-secure-store",
    [
      "expo-screen-orientation",
      { initialOrientation: "LANDSCAPE" },
    ],
    [
      "expo-build-properties",
      { android: { minSdkVersion: 24 }, ios: { deploymentTarget: "16.4" } },
    ],
  ],
  experiments: { typedRoutes: false },
};

export default config;
