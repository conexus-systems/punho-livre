import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { colors } from "@/constants/theme";
import { initRegistry } from "@/src/characters/registry";
import { fetchMe } from "@/src/services/api";
import { initAds } from "@/src/services/ads";
import { restoreSession } from "@/src/services/auth";
import { refreshEntitlements } from "@/src/services/payments";
import { app } from "@/src/store";

WebBrowser.maybeCompleteAuthSession();

export default function RootLayout() {
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    (async () => {
      await Promise.all([restoreSession(), initRegistry()]);
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
      <StatusBar hidden />
      {booted ? (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: "fade" }} />
      ) : (
        <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}
    </SafeAreaProvider>
  );
}
