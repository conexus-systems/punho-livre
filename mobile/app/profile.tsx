import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as AuthSession from "expo-auth-session";

import { MetroButton, MetroDialog, MetroEmpty, MetroGroup, MetroHeader, MetroPage, MetroPivot, MetroProgress, MetroRow, MetroTextField } from "@/components/metro";
import { leagueName } from "@/src/net/leagues";
import { fetchLeaderboard, fetchMatches, fetchMe, fetchRanked, updateDisplayName, type LeaderboardEntry, type MatchSummary, type RankedStanding, type Season } from "@/src/services/api";
import { authRequestConfig, completeLogin, discovery, logout } from "@/src/services/auth";
import { app } from "@/src/store";
import { count, number, relative, shortDate, signed } from "@/src/ui/formats";
import { validate } from "@/src/ui/rules";
import { TYPE } from "@/src/ui/type";
import { space, useTokens } from "@/src/ui/theme";

const RESULT = { win: "Vitória", loss: "Derrota", draw: "Empate", abandoned: "Abandono", void: "Anulada" } as const;

export default function Profile() {
  const t = useTokens();
  const params = useLocalSearchParams<{ tab?: string }>();
  const session = app.use((s) => s.session);
  const player = app.use((s) => s.player);
  const [request, response, promptAsync] = AuthSession.useAuthRequest(authRequestConfig(), discovery);
  const [pivot, setPivot] = useState(Number(params.tab ?? 0) || 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [board, setBoard] = useState<{ season: Season | null; players: LeaderboardEntry[] } | null>(null);
  const [standing, setStanding] = useState<RankedStanding | null>(null);
  const [history, setHistory] = useState<MatchSummary[] | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    if (response?.type === "error") setError(response.error?.message ?? "Falha no login.");
    if (response?.type !== "success" || !request?.codeVerifier) return;
    setBusy(true);
    (async () => {
      try {
        await completeLogin(response.params.code, request.codeVerifier!);
        await Promise.allSettled([fetchMe()]);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(false);
      }
    })();
  }, [response, request]);

  useEffect(() => {
    void fetchLeaderboard()
      .then((b) => setBoard({ season: b?.season ?? null, players: Array.isArray(b?.players) ? b.players : [] }))
      .catch(() => setBoard({ season: null, players: [] }));
    if (session) void fetchRanked().then((s) => setStanding(s?.season && s?.league ? s : null)).catch(() => setStanding(null));
    if (session) void fetchMatches().then(setHistory).catch(() => setHistory([]));
  }, [session]);

  useEffect(() => setName(player?.display_name ?? ""), [player?.display_name]);
  const nameError = name === player?.display_name ? null : validate(name, "o nome", true, 20);

  return (
    <MetroPage>
      <MetroHeader title="Perfil" actions={<MetroButton kind="text" label="Voltar" onPress={() => router.back()} />} />
      <MetroPivot sections={["Conta", "Ranking", "Partidas"]} index={pivot} onChange={setPivot}>
        <ScrollView contentContainerStyle={{ paddingBottom: space.lg, gap: space.sm, maxWidth: 640 }}>
          {pivot === 0 ? (
            <>
              {error ? <Text style={[TYPE.BODY, { color: t.danger }]}>{error}</Text> : null}
              {busy ? <MetroProgress /> : null}
              {session ? (
                <>
                  <Text style={[TYPE.TITLE, { color: t.text }]}>{player?.display_name ?? session.name ?? "Lutador"}</Text>
                  <Text style={[TYPE.BODY, { color: t.muted }]}>
                    {session.email ?? ""}
                  </Text>
                  <Text style={[TYPE.BODY, { color: t.text }]}>
                    Rating <Text style={{ color: t.accentText }}>{player ? number(player.rating) : "…"}</Text> · {count(player?.wins ?? 0, "vitória", "vitórias")} ·{" "}
                    {count(player?.losses ?? 0, "derrota", "derrotas")}
                  </Text>
                  {standing ? (
                    <Text style={[TYPE.BODY, { color: t.muted }]}>
                      {standing.season.name}: <Text style={{ color: t.accentText }}>{standing.league.name}</Text>
                      {standing.placement_remaining > 0
                        ? ` · faltam ${count(standing.placement_remaining, "partida", "partidas")} de colocação`
                        : `${standing.rank ? ` · ${standing.rank}º lugar` : ""} · recorde ${number(standing.peak_rating)}`}
                    </Text>
                  ) : null}
                  <View style={{ maxWidth: 360, marginTop: space.md }}>
                    <MetroTextField label="Nome de lutador" value={name} onChangeText={setName} maxLength={24} error={nameError} help="Aparece no ranking e para o oponente." />
                  </View>
                  <View style={{ flexDirection: "row", gap: space.sm }}>
                    <MetroButton kind="primary" label="Salvar nome" disabled={!!nameError || name === player?.display_name} onPress={() => void updateDisplayName(name.trim()).catch((e) => setError(e.message))} />
                    <MetroButton label="Sair da conta" onPress={() => setConfirmLogout(true)} />
                  </View>
                </>
              ) : (
                <MetroEmpty
                  title="Entre com sua conta CONEXUS"
                  detail="Para jogar online, entrar no ranking e enviar personagens. O jogo offline funciona sem conta."
                  action={<MetroButton kind="primary" label="Entrar" glyph="profile" disabled={!request || busy} onPress={() => void promptAsync()} style={{ alignSelf: "flex-start" }} />}
                />
              )}
            </>
          ) : null}

          {pivot === 1 ? (
            board === null ? (
              <MetroProgress />
            ) : board.players.length === 0 ? (
              <MetroEmpty
                title="Ranking vazio"
                detail="Termine as 5 partidas de colocação da ranqueada para entrar no placar da temporada."
              />
            ) : (
              <>
                {board.season ? <MetroGroup title={`${board.season.name} · até ${shortDate(new Date(board.season.ends_at))}`} /> : null}
                {board.players.map((p, i) => (
                  <MetroRow
                    key={`${p.display_name}-${i}`}
                    title={`${i + 1}. ${p.display_name}`}
                    secondary={`${leagueName(p.league)} · ${count(p.wins, "vitória", "vitórias")} · ${count(p.losses, "derrota", "derrotas")}`}
                    right={number(p.rating)}
                    selected={p.display_name === player?.display_name}
                    glyph={i < 3 ? "ranking" : undefined}
                  />
                ))}
              </>
            )
          ) : null}

          {pivot === 2 ? (
            !session ? (
              <MetroEmpty title="Entre para ver suas partidas" action={<MetroButton label="Ir para Conta" onPress={() => setPivot(0)} style={{ alignSelf: "flex-start" }} />} />
            ) : history === null ? (
              <MetroProgress />
            ) : history.length === 0 ? (
              <MetroEmpty title="Nenhuma partida online ainda" action={<MetroButton kind="primary" label="Jogar online" onPress={() => router.replace("/online")} style={{ alignSelf: "flex-start" }} />} />
            ) : (
              <>
                <MetroGroup title="Recentes" />
                {history.map((m) => (
                  <MetroRow
                    key={m.id}
                    title={`${RESULT[m.result]} · ${m.my_character} vs ${m.opponent_character}`}
                    secondary={`${m.opponent?.display_name ?? "?"}${m.finished_at ? ` · ${relative(m.finished_at)}` : ""}`}
                    right={<Text style={[TYPE.BODY, { color: m.rating_delta > 0 ? t.accentText : m.rating_delta < 0 ? t.danger : t.muted }]}>{signed(m.rating_delta)}</Text>}
                    glyph="history"
                  />
                ))}
              </>
            )
          ) : null}
        </ScrollView>
      </MetroPivot>

      <MetroDialog
        visible={confirmLogout}
        title="Sair da conta?"
        message="O jogo offline continua funcionando. Para jogar online, entre de novo."
        positive="Sair da conta"
        negative="Cancelar"
        onPositive={() => {
          setConfirmLogout(false);
          void logout();
        }}
        onNegative={() => setConfirmLogout(false)}
      />
    </MetroPage>
  );
}
