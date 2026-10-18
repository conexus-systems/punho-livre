import { useEffect, useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { AdBannerSlot } from "@/components/AdBannerSlot";
import { ArcadeButton } from "@/components/ArcadeButton";
import { CharacterPortrait } from "@/components/CharacterPortrait";
import { Screen } from "@/components/Screen";
import { colors, radii, spacing } from "@/constants/theme";
import { install, isInstalled, rosterEntries } from "@/src/characters/registry";
import { matchSetup } from "@/src/match";
import { cancelMatchmaking, findMatch, onlineStore } from "@/src/net/online";
import { fetchCatalog } from "@/src/services/api";
import { app } from "@/src/store";

export default function Online() {
  const session = app.use((s) => s.session);
  const player = app.use((s) => s.player);
  const p1 = matchSetup.use((s) => s.p1);
  const phase = onlineStore.use((s) => s.phase);
  const [code, setCode] = useState("");
  const [sha, setSha] = useState<string | null>(null);
  const [preparing, setPreparing] = useState<string | null>(null);

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

  useEffect(() => () => {
    const k = onlineStore.get().phase.kind;
    if (k === "queued" || k === "room" || k === "connecting") cancelMatchmaking();
  }, []);

  if (!session) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md }}>
          <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "900" }}>Online precisa de login</Text>
          <Text style={{ color: colors.inkSecondary, textAlign: "center", maxWidth: 420 }}>
            Sua conta CONEXUS guarda rating, histórico e personagens enviados.
          </Text>
          <ArcadeButton variant="primary" label="ENTRAR" onPress={() => router.push("/profile")} />
          <ArcadeButton label="VOLTAR" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const busy = phase.kind === "connecting" || phase.kind === "queued" || phase.kind === "room" || preparing !== null;
  const start = (mode: "ranked" | "room", roomCode?: string) => {
    if (!p1 || !sha) return;
    void findMatch({ mode, roomCode, character: p1, sha256: sha });
  };

  return (
    <Screen padded={false}>
      <View style={{ flex: 1, flexDirection: "row", padding: spacing.lg, gap: spacing.xl }}>
        <View style={{ width: 220, alignItems: "center", justifyContent: "center", gap: spacing.sm }}>
          {p1 ? <CharacterPortrait id={p1} size={160} /> : <View style={{ width: 160, height: 160, borderRadius: radii.md, backgroundColor: colors.surface }} />}
          <ArcadeButton compact label={p1 ? "TROCAR LUTADOR" : "ESCOLHER LUTADOR"} onPress={() => router.push("/select")} disabled={busy} />
          <Text style={{ color: colors.inkSecondary }}>
            {player?.display_name ?? session.name} · {player?.rating ?? "…"} pts
          </Text>
        </View>

        <View style={{ flex: 1, justifyContent: "center", gap: spacing.md }}>
          <Text style={{ color: colors.online, fontSize: 24, fontWeight: "900" }}>ONLINE</Text>

          {busy ? (
            <View style={{ gap: spacing.sm, alignItems: "flex-start" }}>
              <ActivityIndicator color={colors.online} />
              <Text style={{ color: colors.ink, fontSize: 16 }}>
                {preparing ??
                  (phase.kind === "room"
                    ? `Sala criada! Passe o código para seu amigo: ${phase.code}`
                    : phase.kind === "queued"
                      ? "Procurando oponente com rating parecido…"
                      : "Conectando…")}
              </Text>
              {phase.kind === "room" ? (
                <Text selectable style={{ color: colors.primary, fontSize: 40, fontWeight: "900", letterSpacing: 6 }}>
                  {phase.code}
                </Text>
              ) : null}
              <ArcadeButton label="CANCELAR" onPress={cancelMatchmaking} />
            </View>
          ) : (
            <>
              {phase.kind === "error" ? <Text style={{ color: colors.error }}>{phase.message}</Text> : null}
              <ArcadeButton variant="online" label="PARTIDA RANQUEADA" sublabel="Vale rating (Elo)" onPress={() => start("ranked")} disabled={!p1 || !sha} />
              <ArcadeButton label="CRIAR SALA" sublabel="Gera um código para um amigo" onPress={() => start("room")} disabled={!p1 || !sha} />
              <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
                <TextInput
                  value={code}
                  onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                  placeholder="CÓDIGO"
                  placeholderTextColor={colors.inkSecondary}
                  autoCapitalize="characters"
                  accessibilityLabel="Código da sala"
                  style={{ flex: 1, minHeight: 44, borderRadius: radii.sm, borderWidth: 2, borderColor: colors.border, color: colors.ink, paddingHorizontal: spacing.md, fontSize: 18, fontWeight: "800", letterSpacing: 4 }}
                />
                <ArcadeButton label="ENTRAR NA SALA" onPress={() => start("room", code)} disabled={!p1 || !sha || code.length < 4} />
              </View>
              <ArcadeButton compact label="VOLTAR" onPress={() => router.back()} />
            </>
          )}
        </View>
      </View>
      <AdBannerSlot />
    </Screen>
  );
}
