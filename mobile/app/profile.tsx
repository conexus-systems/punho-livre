import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import * as AuthSession from "expo-auth-session";

import { ArcadeButton } from "@/components/ArcadeButton";
import { Screen } from "@/components/Screen";
import { colors, radii, spacing } from "@/constants/theme";
import { fetchLeaderboard, fetchMatches, fetchMe, updateDisplayName, type MatchSummary } from "@/src/services/api";
import { authRequestConfig, completeLogin, discovery, logout } from "@/src/services/auth";
import { refreshEntitlements } from "@/src/services/payments";
import { app } from "@/src/store";

const RESULT = { win: "Vitória", loss: "Derrota", draw: "Empate", abandoned: "Abandono" } as const;

export default function Profile() {
  const session = app.use((s) => s.session);
  const player = app.use((s) => s.player);
  const premium = app.use((s) => s.premium);
  const settings = app.use((s) => s.settings);
  const [request, response, promptAsync] = AuthSession.useAuthRequest(authRequestConfig(), discovery);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [board, setBoard] = useState<{ display_name: string; rating: number; wins: number; losses: number }[]>([]);
  const [history, setHistory] = useState<MatchSummary[]>([]);

  useEffect(() => {
    if (response?.type !== "success" || !request?.codeVerifier) {
      if (response?.type === "error") setError(response.error?.message ?? "Falha no login.");
      return;
    }
    setBusy(true);
    (async () => {
      try {
        await completeLogin(response.params.code, request.codeVerifier!);
        await Promise.allSettled([fetchMe(), refreshEntitlements()]);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(false);
      }
    })();
  }, [response, request]);

  useEffect(() => {
    void fetchLeaderboard().then(setBoard).catch(() => undefined);
    if (session) void fetchMatches().then(setHistory).catch(() => undefined);
  }, [session]);

  useEffect(() => setName(player?.display_name ?? ""), [player?.display_name]);

  const setSetting = <K extends keyof typeof settings>(k: K, v: (typeof settings)[K]) =>
    app.set((s) => ({ settings: { ...s.settings, [k]: v } }));

  return (
    <Screen padded={false}>
      <View style={{ flex: 1, flexDirection: "row", padding: spacing.lg, gap: spacing.xl }}>
        <ScrollView style={{ width: 320, flexGrow: 0 }} contentContainerStyle={{ gap: spacing.sm }}>
          <Text style={{ color: colors.primary, fontSize: 22, fontWeight: "900" }}>PERFIL</Text>
          {error ? <Text style={{ color: colors.error }}>{error}</Text> : null}
          {busy ? <ActivityIndicator color={colors.primary} /> : null}
          {session ? (
            <>
              <Text style={{ color: colors.ink }}>{session.email ?? session.name}</Text>
              <Text style={{ color: colors.inkSecondary }}>
                Rating {player?.rating ?? "…"} · {player?.wins ?? 0}V / {player?.losses ?? 0}D · {premium ? "Premium" : "Gratuito"}
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  maxLength={20}
                  accessibilityLabel="Nome de lutador"
                  style={{ flex: 1, minHeight: 44, borderRadius: radii.sm, borderWidth: 2, borderColor: colors.border, color: colors.ink, paddingHorizontal: spacing.md }}
                />
                <ArcadeButton compact label="SALVAR" disabled={!name.trim() || name === player?.display_name} onPress={() => void updateDisplayName(name.trim()).catch((e) => setError(e.message))} />
              </View>
              {!premium ? <ArcadeButton variant="primary" label="SEJA PREMIUM" onPress={() => router.push("/paywall")} /> : null}
              <ArcadeButton variant="danger" label="SAIR DA CONTA" onPress={() => void logout()} />
            </>
          ) : (
            <>
              <Text style={{ color: colors.inkSecondary, lineHeight: 20 }}>
                Entre com sua conta CONEXUS para jogar online, entrar no ranking e enviar personagens.
              </Text>
              <ArcadeButton variant="primary" label="ENTRAR" disabled={!request || busy} onPress={() => void promptAsync()} />
            </>
          )}

          <Text style={{ color: colors.primary, fontWeight: "900", marginTop: spacing.lg }}>CONFIGURAÇÕES</Text>
          <Row label="Botões de especial (assistido)">
            <Switch value={settings.assist} onValueChange={(v) => setSetting("assist", v)} />
          </Row>
          <Row label="Vibração">
            <Switch value={settings.vibration} onValueChange={(v) => setSetting("vibration", v)} />
          </Row>
          <Row label={`Dificuldade CPU: ${["", "fácil", "normal", "difícil"][settings.difficulty]}`}>
            <ArcadeButton compact label="TROCAR" onPress={() => setSetting("difficulty", ((settings.difficulty % 3) + 1) as 1 | 2 | 3)} />
          </Row>
          <Row label={`Atraso de input online: ${settings.inputDelay} frames`}>
            <ArcadeButton compact label="TROCAR" onPress={() => setSetting("inputDelay", settings.inputDelay >= 4 ? 1 : settings.inputDelay + 1)} />
          </Row>
          <ArcadeButton compact label="VOLTAR" onPress={() => router.back()} />
        </ScrollView>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: spacing.xs }}>
          <Text style={{ color: colors.online, fontWeight: "900", fontSize: 18 }}>RANKING</Text>
          {board.map((p, i) => (
            <Text key={`${p.display_name}-${i}`} style={{ color: i < 3 ? colors.primary : colors.ink }}>
              {i + 1}. {p.display_name} — {p.rating} ({p.wins}V/{p.losses}D)
            </Text>
          ))}
          {session ? (
            <>
              <Text style={{ color: colors.online, fontWeight: "900", fontSize: 18, marginTop: spacing.lg }}>ÚLTIMAS PARTIDAS</Text>
              {history.length === 0 ? <Text style={{ color: colors.inkSecondary }}>Nenhuma partida online ainda.</Text> : null}
              {history.map((m) => (
                <Text key={m.id} style={{ color: m.result === "win" ? colors.success : m.result === "loss" ? colors.error : colors.inkSecondary }}>
                  {RESULT[m.result]} · {m.my_character} vs {m.opponent_character} ({m.opponent?.display_name ?? "?"}) {m.rating_delta > 0 ? `+${m.rating_delta}` : m.rating_delta}
                </Text>
              ))}
            </>
          ) : null}
        </ScrollView>
      </View>
    </Screen>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 }}>
      <Text style={{ color: colors.ink, flex: 1 }}>{label}</Text>
      {children}
    </View>
  );
}
