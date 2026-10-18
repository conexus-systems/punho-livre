import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";

import { CharacterPortrait } from "@/components/CharacterPortrait";
import { MetroButton, MetroEmpty, MetroHeader, MetroPage, MetroPivot, MetroProgress, MetroTextField } from "@/components/metro";
import { install, isInstalled, rosterEntries } from "@/src/characters/registry";
import { matchSetup } from "@/src/match";
import { cancelMatchmaking, findMatch, onlineStore } from "@/src/net/online";
import { leagueName, nextLeague } from "@/src/net/leagues";
import { fetchCatalog, fetchRanked, type RankedStanding } from "@/src/services/api";
import { app } from "@/src/store";
import { count, number, shortDate } from "@/src/ui/formats";
import { TYPE } from "@/src/ui/type";
import { space, useTokens } from "@/src/ui/theme";

export default function Online() {
  const t = useTokens();
  const session = app.use((s) => s.session);
  const player = app.use((s) => s.player);
  const p1 = matchSetup.use((s) => s.p1);
  const phase = onlineStore.use((s) => s.phase);
  const [pivot, setPivot] = useState(0);
  const [code, setCode] = useState("");
  const [sha, setSha] = useState<string | null>(null);
  const [preparing, setPreparing] = useState<string | null>(null);
  const [standing, setStanding] = useState<RankedStanding | null>(null);

  useEffect(() => {
    if (session) void fetchRanked().then((s) => setStanding(s?.season && s?.league ? s : null)).catch(() => setStanding(null));
  }, [session]);

  useEffect(() => {
    if (!p1) return;
    void rosterEntries().then((list) => setSha(list.find((e) => e.id === p1)?.sha256 ?? null));
  }, [p1]);

  // pareado: garante que temos o personagem do oponente e vai para a luta
  useEffect(() => {
    if (phase.kind !== "matched") return;
    const m = phase.match;
    (async () => {
      try {
        if (!isInstalled(m.opponent.character, m.opponent.pack_sha256)) {
          setPreparing(`Baixando ${m.opponent.character}…`);
          const catalog = await fetchCatalog();
          const entry = catalog.find((c) => c.slug === m.opponent.character && c.sha256 === m.opponent.pack_sha256);
          if (!entry) throw new Error("O oponente usa um personagem que não está no catálogo.");
          await install(entry);
        }
        matchSetup.set({ mode: "online", online: m });
        router.replace("/fight");
      } catch (err) {
        onlineStore.set({ phase: { kind: "error", message: (err as Error).message } });
      } finally {
        setPreparing(null);
      }
    })();
  }, [phase]);

  useEffect(
    () => () => {
      const k = onlineStore.get().phase.kind;
      if (k === "queued" || k === "room" || k === "connecting") cancelMatchmaking();
    },
    [],
  );

  if (!session) {
    return (
      <MetroPage>
        <MetroHeader title="Online" />
        <MetroEmpty
          title="Online precisa da sua conta CONEXUS"
          detail="Ela guarda rating, histórico e os personagens que você envia."
          action={
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <MetroButton kind="primary" label="Entrar" glyph="profile" onPress={() => router.push("/profile")} />
              <MetroButton label="Voltar" glyph="back" onPress={() => router.back()} />
            </View>
          }
        />
      </MetroPage>
    );
  }

  const busy = phase.kind === "connecting" || phase.kind === "queued" || phase.kind === "room" || preparing !== null;
  const ready = Boolean(p1 && sha);
  const start = (mode: "ranked" | "room", roomCode?: string) => {
    if (!p1 || !sha) return;
    void findMatch({ mode, roomCode, character: p1, sha256: sha });
  };

  return (
    <MetroPage>
      <View style={{ flex: 1, flexDirection: "row", gap: space.lg }}>
        <View style={{ width: 220, gap: space.sm }}>
          <MetroHeader title="Online" subtitle={`${player?.display_name ?? session.name ?? ""} · ${player ? number(player.rating) : "…"} pts`} />
          {p1 ? <CharacterPortrait id={p1} size={140} /> : null}
          <MetroButton label={p1 ? "Trocar lutador" : "Escolher lutador"} glyph="characters" onPress={() => router.push("/select")} disabled={busy} />
          <MetroButton kind="text" label="Voltar" onPress={() => router.back()} />
        </View>

        <View style={{ flex: 1, paddingTop: space.sm }}>
          {busy ? (
            <View style={{ gap: space.md, paddingTop: space.lg }}>
              <MetroProgress />
              <Text style={[TYPE.SUBTITLE, { color: t.text }]}>
                {preparing ??
                  (phase.kind === "room" ? "Sala criada. Passe o código:" : phase.kind === "queued" ? "Procurando oponente com rating parecido (a faixa abre com a espera)…" : "Conectando…")}
              </Text>
              {phase.kind === "room" ? (
                <Text selectable style={[TYPE.DISPLAY, { color: t.accentText, letterSpacing: 8 }]}>
                  {phase.code}
                </Text>
              ) : null}
              <MetroButton label="Cancelar" onPress={cancelMatchmaking} style={{ alignSelf: "flex-start" }} />
            </View>
          ) : (
            <MetroPivot sections={["Ranqueada", "Sala"]} index={pivot} onChange={setPivot}>
              {phase.kind === "error" ? <Text style={[TYPE.BODY, { color: t.danger, marginBottom: space.sm }]}>{phase.message}</Text> : null}
              {pivot === 0 ? (
                <View style={{ gap: space.md }}>
                  {standing ? (
                    <View style={{ gap: space.xs }}>
                      <Text style={[TYPE.CAPTION, { color: t.muted }]}>
                        {standing.season.name} · até {shortDate(new Date(standing.season.ends_at))}
                      </Text>
                      <Text style={[TYPE.TITLE, { color: t.accentText }]}>{standing.league.name}</Text>
                      <Text style={[TYPE.BODY, { color: t.text }]}>
                        {number(standing.rating)} pts
                        {standing.placement_remaining > 0
                          ? ` · faltam ${count(standing.placement_remaining, "partida", "partidas")} de colocação`
                          : standing.league.next_min_rating
                            ? ` · ${leagueName(nextLeague(standing.league.key))} em ${number(standing.league.next_min_rating)}`
                            : ""}
                        {standing.rank ? ` · ${standing.rank}º lugar` : ""}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={[TYPE.BODY, { color: t.muted }]}>
                    Pareamento pelo rating da temporada (Glicko-2): a faixa abre com a espera e, depois de 30 s, vale qualquer oponente.
                    O resultado só conta quando os dois aparelhos relatam o mesmo vencedor. Netcode com rollback: o jogo prevê o
                    oponente e corrige sem travar.
                  </Text>
                  <MetroButton kind="primary" label="Procurar partida" glyph="online" onPress={() => start("ranked")} disabled={!ready} style={{ alignSelf: "flex-start" }} />
                  {!ready ? <Text style={[TYPE.CAPTION, { color: t.muted }]}>Escolha um lutador primeiro.</Text> : null}
                </View>
              ) : (
                <View style={{ gap: space.md, maxWidth: 420 }}>
                  <Text style={[TYPE.BODY, { color: t.muted }]}>Jogue com um amigo: crie a sala e passe o código, ou entre com o código dele. Salas não mudam o rating.</Text>
                  <MetroButton kind="primary" label="Criar sala" glyph="room" onPress={() => start("room")} disabled={!ready} style={{ alignSelf: "flex-start" }} />
                  <MetroTextField
                    label="Código da sala"
                    value={code}
                    onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                    autoCapitalize="characters"
                    placeholder="ABCD12"
                    clearable
                  />
                  <MetroButton label="Entrar na sala" onPress={() => start("room", code)} disabled={!ready || code.length < 4} style={{ alignSelf: "flex-start" }} />
                </View>
              )}
            </MetroPivot>
          )}
        </View>
      </View>
    </MetroPage>
  );
}
