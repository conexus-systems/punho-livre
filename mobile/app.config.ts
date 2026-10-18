import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "MUGEN Arena",
  slug: "mugen-arena",
  version: "0.5.0",
  orientation: "landscape",
  userInterfaceStyle: "dark",
  scheme: ["br.com.conexus.mugenarena", "mugenarena"],
  backgroundColor: "#0B0B12",
  ios: {
    bundleIdentifier: "br.com.conexus.mugenarena",
    supportsTablet: true,
    requireFullScreen: true,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: "br.com.conexus.mugenarena",
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
