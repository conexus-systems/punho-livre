import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { MetroProgress } from "@/components/metro";
import { initRegistry } from "@/src/characters/registry";
import { fetchMe } from "@/src/services/api";
import { initAds } from "@/src/services/ads";
import { restoreSession } from "@/src/services/auth";
import { refreshEntitlements } from "@/src/services/payments";
import { bootSkia } from "@/src/platform/skiaBoot";
import { loadSettings } from "@/src/settings";
import { app } from "@/src/store";
import { loadTheme, useTokens } from "@/src/ui/theme";

WebBrowser.maybeCompleteAuthSession();

export default function RootLayout() {
  const [booted, setBooted] = useState(false);
  const t = useTokens();

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => undefined);
    (async () => {
      await Promise.all([bootSkia(), loadTheme(), loadSettings(), restoreSession(), initRegistry()]);
      setBooted(true);
      if (app.get().session) {
        // perfil (backend) e premium (bff-payment) em paralelo; falha de rede não bloqueia o jogo offline
        await Promise.allSettled([fetchMe(), refreshEntitlements()]);
      }
      await initAds();
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar hidden style={t.mode === "dark" ? "light" : "dark"} />
      {booted ? (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg }, animation: "fade" }} />
      ) : (
        <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}>
          <MetroProgress />
        </View>
      )}
    </SafeAreaProvider>
  );
}
