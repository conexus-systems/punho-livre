import { useEffect, useState } from "react";
import { View } from "react-native";
import { router, Stack, usePathname } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MetroProgress } from "@/components/metro";
import { TelemetryConsentDialog } from "@/components/TelemetryConsentDialog";
import { initAudio } from "@/src/audio";
import { initRegistry } from "@/src/characters/registry";
import { fetchMe } from "@/src/services/api";
import { initAds } from "@/src/services/ads";
import { restoreSession } from "@/src/services/auth";
import { installCrashHandler, sendPendingCrash, setCurrentScreen } from "@/src/services/crash";
import { loadDevOptions } from "@/src/services/devOptions";
import { refreshEntitlements } from "@/src/services/payments";
import { initTelemetry } from "@/src/services/telemetry";
import { watchOnlineQueue } from "@/src/services/telemetryWatchers";
import { bootSkia } from "@/src/platform/skiaBoot";
import { loadSettings } from "@/src/settings";
import { app } from "@/src/store";
import { loadTheme, useTokens } from "@/src/ui/theme";

WebBrowser.maybeCompleteAuthSession();
// o quanto antes: falhas do próprio boot também ficam registradas
installCrashHandler();

export default function RootLayout() {
  const [booted, setBooted] = useState(false);
  const [askTelemetry, setAskTelemetry] = useState(false);
  const t = useTokens();
  const pathname = usePathname();

  useEffect(() => setCurrentScreen(pathname), [pathname]);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => undefined);
    (async () => {
      await Promise.all([bootSkia(), loadTheme(), loadSettings(), restoreSession(), initRegistry(), initTelemetry(), loadDevOptions()]);
      setBooted(true);
      sendPendingCrash();
      watchOnlineQueue();
      void initAudio();
      if (app.get().session) {
        // perfil (backend) e premium (bff-payment) em paralelo; falha de rede não bloqueia o jogo offline
        await Promise.allSettled([fetchMe(), refreshEntitlements()]);
      }
      await initAds();
      // depois do consentimento de anúncios (UMP/ATT), para não empilhar diálogos
      setAskTelemetry(true);
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar hidden style={t.mode === "dark" ? "light" : "dark"} />
      {booted ? (
        <ErrorBoundary onReset={() => router.replace("/")}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg }, animation: "fade" }} />
          <TelemetryConsentDialog ready={askTelemetry} />
        </ErrorBoundary>
      ) : (
        <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}>
          <MetroProgress />
        </View>
      )}
    </SafeAreaProvider>
  );
}
