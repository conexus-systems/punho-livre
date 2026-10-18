import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import { AdBannerSlot } from "@/components/AdBannerSlot";
import { CharacterPortrait } from "@/components/CharacterPortrait";
import { MetroButton, MetroHeader, MetroPage } from "@/components/metro";
import { rosterEntries, type RosterEntry } from "@/src/characters/registry";
import { STAGES } from "@/src/game/stages";
import { matchSetup, shuffle } from "@/src/match";
import { TYPE } from "@/src/ui/type";
import { space, useTokens } from "@/src/ui/theme";

const TITLES = { arcade: "Arcade", versus: "Versus CPU", training: "Treino", online: "Online", team: "Equipes 3×3" } as const;
const TEAM_SIZE = 3;

export default function Select() {
  const t = useTokens();
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

  const teamMode = setup.mode === "team";
  const team = setup.team1;

  const confirm = () => {
    if (!cursor) return;
    if (teamMode) {
      const next = [...team, cursor];
      if (next.length < TEAM_SIZE) {
        matchSetup.set({ team1: next });
        return;
      }
      // equipe da CPU: sorteada entre quem sobrou (repete se o elenco for pequeno)
      const rest = shuffle(entries.map((e) => e.id).filter((id) => !next.includes(id)));
      const pool = rest.length >= TEAM_SIZE ? rest : shuffle(entries.map((e) => e.id));
      matchSetup.set({ team1: next, team2: pool.slice(0, TEAM_SIZE), p1: next[0], p2: pool[0] });
      router.replace("/fight");
      return;
    }
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

  const tile = 96;
  return (
    <MetroPage footer={<AdBannerSlot />}>
      <View style={{ flex: 1, flexDirection: "row", gap: space.lg }}>
        <View style={{ width: 240, justifyContent: "space-between", paddingBottom: space.sm }}>
          <MetroHeader
            kicker={TITLES[setup.mode]}
            title={teamMode ? `Lutador ${team.length + 1} de ${TEAM_SIZE}` : picking === 1 ? "Seu lutador" : "Oponente"}
          />
          {teamMode && team.length > 0 ? (
            <View style={{ flexDirection: "row", gap: 4 }} accessibilityLabel={`Equipe: ${team.map((id) => entries.find((e) => e.id === id)?.name ?? id).join(", ")}`}>
              {team.map((id, i) => (
                <CharacterPortrait key={`${id}-${i}`} id={id} size={48} />
              ))}
            </View>
          ) : null}
          {current ? (
            <View style={{ gap: space.xs }}>
              <CharacterPortrait id={current.id} size={150} flip={picking === 2} />
              <Text style={[TYPE.TITLE, { color: t.text }]}>{current.name}</Text>
              <Text style={[TYPE.CAPTION, { color: t.muted }]} numberOfLines={3}>
                {current.bio}
              </Text>
              {current.meta ? (
                <Text style={[TYPE.CAPTION, { color: t.accentText }]} numberOfLines={2}>
                  {current.meta.specials.map((s) => s.name).join(" · ")} · super {current.meta.super.name}
                </Text>
              ) : null}
            </View>
          ) : null}
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <MetroButton
              label="Voltar"
              glyph="back"
              onPress={() => (teamMode && team.length > 0 ? matchSetup.set({ team1: team.slice(0, -1) }) : picking === 2 ? matchSetup.set({ p1: null }) : router.back())}
            />
            <MetroButton
              kind="primary"
              label={teamMode ? (team.length + 1 < TEAM_SIZE ? "Próximo" : "Lutar") : picking === 2 || !needsP2 ? "Lutar" : "Próximo"}
              onPress={confirm}
              disabled={!cursor}
              style={{ flex: 1 }}
            />
          </View>
        </View>

        <View style={{ flex: 1, paddingTop: space.md }}>
          <ScrollView contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {entries.map((e) => {
              const active = e.id === cursor;
              return (
                <Pressable
                  key={e.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Escolher ${e.name}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => setCursor(e.id)}
                  style={{ width: tile, height: tile + 22, backgroundColor: active ? t.accent : t.surface, borderWidth: 2, borderColor: active ? t.accentText : "transparent" }}
                >
                  <CharacterPortrait id={e.id} size={tile - 4} />
                  <Text numberOfLines={1} style={[TYPE.CAPTION, { color: active ? "#FFFFFF" : t.text, paddingHorizontal: 6 }]}>
                    {e.name}
                  </Text>
                  {!e.builtin ? <Text style={[TYPE.KICKER, { position: "absolute", top: 4, right: 4, fontSize: 9, color: active ? "#FFFFFF" : t.accentText }]}>mugen</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
          {setup.mode !== "arcade" && setup.mode !== "online" ? (
            <View style={{ flexDirection: "row", gap: space.md, alignItems: "center", marginTop: space.sm }}>
              <Text style={[TYPE.KICKER, { color: t.muted }]}>cenário</Text>
              {STAGES.map((s) => (
                <Pressable key={s.id} accessibilityRole="radio" accessibilityState={{ checked: setup.stage === s.id }} onPress={() => matchSetup.set({ stage: s.id })} style={{ minHeight: 40, justifyContent: "center" }}>
                  <Text style={[TYPE.BODY, { color: setup.stage === s.id ? t.accentText : t.muted }]}>{s.name.toLowerCase()}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </MetroPage>
  );
}
