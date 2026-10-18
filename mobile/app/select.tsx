import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import { AdBannerSlot } from "@/components/AdBannerSlot";
import { ArcadeButton } from "@/components/ArcadeButton";
import { CharacterPortrait } from "@/components/CharacterPortrait";
import { Screen } from "@/components/Screen";
import { colors, radii, spacing } from "@/constants/theme";
import { rosterEntries, type RosterEntry } from "@/src/characters/registry";
import { STAGES } from "@/src/game/stages";
import { matchSetup, shuffle } from "@/src/match";

const TITLES = { arcade: "ARCADE", versus: "VERSUS CPU", training: "TREINO", online: "ONLINE" } as const;

export default function Select() {
  const setup = matchSetup.use((s) => s);
  const [entries, setEntries] = useState<RosterEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const needsP2 = setup.mode === "versus" || setup.mode === "training";
  const picking: 1 | 2 = setup.p1 && needsP2 ? 2 : 1;

  useEffect(() => {
    void rosterEntries().then((list) => {
      setEntries(list);
      setCursor((c) => c ?? list[0]?.id ?? null);
    });
  }, []);

  const current = entries.find((e) => e.id === cursor) ?? null;

  const confirm = () => {
    if (!cursor) return;
    if (setup.mode === "online") {
      matchSetup.set({ p1: cursor });
      router.back();
      return;
    }
    if (picking === 1) {
      if (setup.mode === "arcade") {
        const ladder = shuffle(entries.filter((e) => e.id !== cursor).map((e) => e.id)).slice(0, 7);
        matchSetup.set({ p1: cursor, ladder: ladder.slice(1), p2: ladder[0] ?? cursor, stageNo: 1, stage: STAGES[0].id });
        router.replace("/fight");
        return;
      }
      matchSetup.set({ p1: cursor });
      return;
    }
    matchSetup.set({ p2: cursor });
    router.replace("/fight");
  };

  return (
    <Screen padded={false}>
      <View style={{ flex: 1, flexDirection: "row", padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ width: 230, justifyContent: "space-between" }}>
          <View>
            <Text style={{ color: colors.primary, fontWeight: "900", fontSize: 20 }}>{TITLES[setup.mode]}</Text>
            <Text style={{ color: colors.inkSecondary }}>
              {picking === 1 ? "Escolha seu lutador" : "Escolha o oponente (CPU)"}
            </Text>
          </View>
          {current ? (
            <View style={{ alignItems: "center" }}>
              <CharacterPortrait id={current.id} size={170} flip={picking === 2} />
              <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "900" }}>{current.name}</Text>
              <Text style={{ color: colors.inkSecondary, textAlign: "center", fontSize: 12 }} numberOfLines={3}>
                {current.bio}
              </Text>
              {current.meta ? (
                <Text style={{ color: colors.inkSecondary, fontSize: 11, marginTop: 4, textAlign: "center" }}>
                  {current.meta.specials.map((s) => s.name).join(" · ")} · SUPER: {current.meta.super.name}
                </Text>
              ) : null}
            </View>
          ) : null}
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <ArcadeButton compact label="VOLTAR" onPress={() => (picking === 2 ? matchSetup.set({ p1: null }) : router.back())} />
            <ArcadeButton compact variant="primary" label={picking === 2 || !needsP2 ? "LUTAR!" : "PRÓXIMO"} onPress={confirm} disabled={!cursor} style={{ flex: 1 }} />
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {entries.map((e) => {
              const active = e.id === cursor;
              return (
                <Pressable
                  key={e.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Escolher ${e.name}`}
                  onPress={() => setCursor(e.id)}
                  style={{
                    width: 104,
                    height: 124,
                    borderRadius: radii.sm,
                    borderWidth: 3,
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? "#2A2410" : colors.surface,
                    alignItems: "center",
                    overflow: "hidden",
                  }}
                >
                  <CharacterPortrait id={e.id} size={96} />
                  <Text style={{ color: active ? colors.primary : colors.ink, fontWeight: "800", fontSize: 12 }}>{e.name}</Text>
                  {!e.builtin ? (
                    <Text style={{ position: "absolute", top: 4, right: 6, color: colors.online, fontSize: 9, fontWeight: "900" }}>MUGEN</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
          {setup.mode !== "arcade" && setup.mode !== "online" ? (
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
              {STAGES.map((s) => (
                <ArcadeButton key={s.id} compact label={s.name} variant={setup.stage === s.id ? "primary" : "secondary"} onPress={() => matchSetup.set({ stage: s.id })} />
              ))}
            </View>
          ) : null}
        </View>
      </View>
      <AdBannerSlot />
    </Screen>
  );
}
