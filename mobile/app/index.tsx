import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";

import { CharacterPortrait } from "@/components/CharacterPortrait";
import { LiveTile, MetroPage } from "@/components/metro";
import { BUILTIN, BUILTIN_ORDER } from "@/src/characters/builtin.generated";
import { rosterStore } from "@/src/characters/registry";
import { matchSetup, type Mode } from "@/src/match";
import { app } from "@/src/store";
import { count, number } from "@/src/ui/formats";
import { AppMark, type GlyphName } from "@/src/ui/glyphs";
import { pack, type TileSize } from "@/src/ui/tiles";
import { TYPE } from "@/src/ui/type";
import { space, useTokens } from "@/src/ui/theme";

interface StartTile {
  id: string;
  title: string;
  size: TileSize;
  glyph: GlyphName;
  onPress: () => void;
  back?: React.ReactNode;
  color?: string;
}

function play(mode: Mode) {
  matchSetup.set({ mode, p1: null, p2: null, ladder: [], stageNo: 0, continues: 0, online: null, team1: [], team2: [] });
  router.push(mode === "online" ? "/online" : "/select");
}

/** Iniciar (W10M): Live Tiles planos no destaque, empacotados em colunas. */
export default function Start() {
  const t = useTokens();
  const { width, height } = useWindowDimensions();
  const player = app.use((s) => s.player);
  const session = app.use((s) => s.session);
  const installed = rosterStore.use((s) => s.installed);
  const [hero, setHero] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setHero((h) => (h + 1) % BUILTIN_ORDER.length), 6000);
    return () => clearInterval(id);
  }, []);

  const gap = 6;
  const rowsVisible = 4; // 4 células de altura cabem em paisagem
  const cell = Math.floor((height - 140 - gap * (rowsVisible - 1)) / rowsVisible);
  const columns = Math.max(4, Math.floor((width - space.lg * 2 - 220 + gap) / (cell + gap)));

  const champion = BUILTIN_ORDER[hero];
  const portraitBack = (id: string, caption: string) => (
    <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-end", justifyContent: "center" }}>
      <CharacterPortrait id={id} size={cell * 2 - 8} />
      <Text style={[TYPE.CAPTION, { position: "absolute", top: 6, left: 8, color: "#FFFFFF" }]}>{caption}</Text>
    </View>
  );

  const tiles: StartTile[] = useMemo(() => {
    const list: StartTile[] = [
      { id: "arcade", title: "Arcade", size: "wide", glyph: "arcade", onPress: () => play("arcade"), back: portraitBack(champion, BUILTIN[champion].meta.name) },
      {
        id: "online",
        title: "Online",
        size: "medium",
        glyph: "online",
        onPress: () => play("online"),
        back: (
          <View style={{ flex: 1, padding: 8, justifyContent: "center" }}>
            <Text style={[TYPE.TITLE, { color: "#FFFFFF" }]}>{player ? number(player.rating) : "—"}</Text>
            <Text style={[TYPE.CAPTION, { color: "#FFFFFF" }]}>{player ? `${count(player.wins, "vitória", "vitórias")}` : "entre para jogar"}</Text>
          </View>
        ),
      },
      { id: "versus", title: "Versus CPU", size: "medium", glyph: "versus", onPress: () => play("versus") },
      { id: "team", title: "Equipes 3×3", size: "medium", glyph: "team", onPress: () => play("team") },
      { id: "training", title: "Treino", size: "small", glyph: "training", onPress: () => play("training") },
      { id: "settings", title: "Ajustes", size: "small", glyph: "settings", onPress: () => router.push("/settings") },
      {
        id: "roster",
        title: "Personagens",
        size: "wide",
        glyph: "characters",
        onPress: () => router.push("/roster"),
        back: (
          <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-end" }}>
            {BUILTIN_ORDER.slice(0, 4).map((id) => (
              <CharacterPortrait key={id} id={id} size={cell * 1.6} />
            ))}
            <Text style={[TYPE.CAPTION, { position: "absolute", top: 6, left: 8, color: "#FFFFFF" }]}>
              {count(BUILTIN_ORDER.length + installed.length, "lutador", "lutadores")}
            </Text>
          </View>
        ),
      },
      { id: "profile", title: session ? player?.display_name ?? "Perfil" : "Entrar", size: "medium", glyph: "profile", onPress: () => router.push("/profile") },
      { id: "ranking", title: "Ranking", size: "small", glyph: "ranking", onPress: () => router.push({ pathname: "/profile", params: { tab: "1" } }) },
    ];
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [champion, player, session, installed.length, cell]);

  const { placed, rows } = pack(tiles, columns);

  return (
    <MetroPage>
      <View style={{ flex: 1, flexDirection: "row", gap: space.lg }}>
        <View style={{ width: 200, paddingTop: space.md, justifyContent: "space-between", paddingBottom: space.md }}>
          <View style={{ gap: space.sm }}>
            <AppMark size={40} color={t.accent} />
            <Text style={[TYPE.KICKER, { color: t.text }]}>BAMBA</Text>
            <Text style={[TYPE.HEADER, { color: t.text }]}>Iniciar</Text>
          </View>
          <Text style={[TYPE.CAPTION, { color: t.muted }]}>
            {session ? `${player?.display_name ?? session.name ?? ""}${player ? ` · ${number(player.rating)} pts` : ""}` : "Jogando como convidado"}
          </Text>
        </View>
        <ScrollView contentContainerStyle={{ paddingVertical: space.md }}>
          <View style={{ width: columns * (cell + gap) - gap, height: rows * (cell + gap) - gap }}>
            {placed.map((p) => (
              <View key={p.item.id} style={{ position: "absolute", left: p.col * (cell + gap), top: p.row * (cell + gap) }}>
                <LiveTile
                  title={p.item.title}
                  size={p.item.size}
                  cell={cell}
                  gap={gap}
                  glyph={p.item.glyph}
                  onPress={p.item.onPress}
                  back={p.item.back}
                  color={p.item.color}
                  flipEvery={5000 + (p.col + p.row) * 900}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </MetroPage>
  );
}
