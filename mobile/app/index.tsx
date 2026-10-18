import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import { AdBannerSlot } from "@/components/AdBannerSlot";
import { ArcadeButton } from "@/components/ArcadeButton";
import { CharacterPortrait } from "@/components/CharacterPortrait";
import { Screen } from "@/components/Screen";
import { colors, spacing } from "@/constants/theme";
import { BUILTIN_ORDER } from "@/src/characters/builtin.generated";
import { matchSetup, type Mode } from "@/src/match";
import { app } from "@/src/store";

function go(mode: Mode) {
  matchSetup.set({ mode, p1: null, p2: null, ladder: [], stageNo: 0, continues: 0, online: null });
  router.push(mode === "online" ? "/online" : "/select");
}

export default function Menu() {
  const player = app.use((s) => s.player);
  const session = app.use((s) => s.session);
  const premium = app.use((s) => s.premium);
  const [hero, setHero] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setHero((h) => (h + 1) % BUILTIN_ORDER.length), 2500);
    return () => clearInterval(t);
  }, []);

  return (
    <Screen padded={false}>
      <View style={{ flex: 1, flexDirection: "row" }}>
        <View style={{ flex: 1.1, justifyContent: "center", paddingLeft: spacing.xxl }}>
          <Text style={{ color: colors.primary, fontSize: 44, fontWeight: "900", letterSpacing: 2 }}>MUGEN</Text>
          <Text style={{ color: colors.accent, fontSize: 30, fontWeight: "900", letterSpacing: 8, marginTop: -8 }}>ARENA</Text>
          <Text style={{ color: colors.inkSecondary, marginTop: spacing.sm }}>
            {session ? `Lutador: ${player?.display_name ?? session.name ?? "…"}${player ? ` · ${player.rating} pts` : ""}` : "Jogando como convidado"}
            {premium ? "  ·  PREMIUM" : ""}
          </Text>
          <View style={{ flexDirection: "row", marginTop: spacing.lg }}>
            <CharacterPortrait id={BUILTIN_ORDER[hero]} size={150} />
            <CharacterPortrait id={BUILTIN_ORDER[(hero + 3) % BUILTIN_ORDER.length]} size={150} flip />
          </View>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: spacing.xl, paddingRight: spacing.xxl, gap: spacing.sm }}>
          <ArcadeButton variant="primary" label="ARCADE" sublabel="Enfrente o elenco inteiro" onPress={() => go("arcade")} />
          <ArcadeButton variant="online" label="ONLINE" sublabel="Ranqueada ou sala com amigo" onPress={() => go("online")} />
          <ArcadeButton label="VERSUS CPU" sublabel="Escolha você e o oponente" onPress={() => go("versus")} />
          <ArcadeButton label="TREINO" sublabel="Caixas de colisão e barra cheia" onPress={() => go("training")} />
          <ArcadeButton label="PERSONAGENS" sublabel="Baixar e enviar personagens MUGEN" onPress={() => router.push("/roster")} />
          <ArcadeButton label="PERFIL & RANKING" onPress={() => router.push("/profile")} />
          {!premium ? <ArcadeButton variant="danger" label="PREMIUM" sublabel="Sem anúncios + personagens exclusivos" onPress={() => router.push("/paywall")} /> : null}
        </ScrollView>
      </View>
      <AdBannerSlot />
    </Screen>
  );
}
