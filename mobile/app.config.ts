import type { ExpoConfig } from "expo/config";

// IDs de teste oficiais do Google. Em produção, defina as variáveis no EAS.
const ADMOB_ANDROID_APP_ID = process.env.ADMOB_ANDROID_APP_ID ?? "ca-app-pub-3940256099942544~3347511713";
const ADMOB_IOS_APP_ID = process.env.ADMOB_IOS_APP_ID ?? "ca-app-pub-3940256099942544~1458002511";

const config: ExpoConfig = {
  name: "MUGEN Arena",
  slug: "mugen-arena",
  version: "0.3.1",
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
      "expo-tracking-transparency",
      {
        userTrackingPermission:
          "Usamos este identificador para mostrar anúncios mais relevantes e manter o MUGEN Arena gratuito.",
      },
    ],
    [
      "react-native-google-mobile-ads",
      {
        androidAppId: ADMOB_ANDROID_APP_ID,
        iosAppId: ADMOB_IOS_APP_ID,
        delayAppMeasurementInit: true,
        userTrackingUsageDescription:
          "Usamos este identificador para mostrar anúncios mais relevantes e manter o MUGEN Arena gratuito.",
      },
    ],
    [
      "expo-build-properties",
      { android: { minSdkVersion: 24 }, ios: { deploymentTarget: "16.4" } },
    ],
  ],
  experiments: { typedRoutes: false },
};

export default config;
