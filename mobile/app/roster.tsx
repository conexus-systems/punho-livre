import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import { AdBannerSlot } from "@/components/AdBannerSlot";
import { ArcadeButton } from "@/components/ArcadeButton";
import { Screen } from "@/components/Screen";
import { colors, radii, spacing } from "@/constants/theme";
import { install, rosterStore, uninstall } from "@/src/characters/registry";
import { fetchCatalog, fetchPendingCharacters, reviewCharacter, type CharacterSummary } from "@/src/services/api";
import { app } from "@/src/store";

const kb = (n: number) => `${Math.max(1, Math.round(n / 1024))} KB`;

export default function RosterScreen() {
  const installed = rosterStore.use((s) => s.installed);
  const premium = app.use((s) => s.premium);
  const admin = app.use((s) => s.player?.admin === true);
  const [catalog, setCatalog] = useState<CharacterSummary[] | null>(null);
  const [pending, setPending] = useState<CharacterSummary[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setCatalog(await fetchCatalog());
      if (admin) setPending(await fetchPendingCharacters());
    } catch (err) {
      setError((err as Error).message);
      setCatalog([]);
    }
  }, [admin]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (slug: string, fn: () => Promise<void>) => {
    setBusy(slug);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen padded={false}>
      <View style={{ flex: 1, flexDirection: "row", padding: spacing.lg, gap: spacing.xl }}>
        <View style={{ width: 280, gap: spacing.sm }}>
          <Text style={{ color: colors.primary, fontSize: 22, fontWeight: "900" }}>PERSONAGENS</Text>
          <Text style={{ color: colors.inkSecondary, fontSize: 13, lineHeight: 19 }}>
            O MUGEN Arena lê personagens no formato do MUGEN (.def, .air, .cmd, .cns e sprites .sff).
            {"\n\n"}Para enviar um personagem: na pasta do app rode{"\n"}
            <Text style={{ color: colors.ink, fontFamily: "monospace" }}>npm run pack -- pasta/do/char --upload {"<API>"} --token {"<JWT>"}</Text>
            {"\n\n"}Ele passa por revisão e, aprovado, aparece aqui para todos. Envie só personagens que você tem direito de distribuir.
          </Text>
          <ArcadeButton compact label="VOLTAR" onPress={() => router.back()} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xl }}>
          {error ? <Text style={{ color: colors.error }}>{error}</Text> : null}
          {catalog === null ? <ActivityIndicator color={colors.primary} /> : null}
          {catalog?.length === 0 && !error ? <Text style={{ color: colors.inkSecondary }}>Nenhum personagem extra publicado ainda.</Text> : null}
          {catalog?.map((c) => {
            const mine = installed.find((i) => i.slug === c.slug);
            const outdated = mine && mine.sha256 !== c.sha256;
            const locked = c.premium && !premium;
            return (
              <View key={c.slug} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.ink, fontWeight: "900", fontSize: 16 }}>
                    {c.name} {c.premium ? <Text style={{ color: colors.primary, fontSize: 11 }}>PREMIUM</Text> : null}
                  </Text>
                  <Text style={{ color: colors.inkSecondary, fontSize: 12 }}>
                    por {c.author} · v{c.version} · {kb(c.size_bytes)}
                  </Text>
                </View>
                {busy === c.slug ? (
                  <ActivityIndicator color={colors.primary} />
                ) : mine && !outdated ? (
                  <ArcadeButton compact variant="danger" label="REMOVER" onPress={() => void act(c.slug, () => uninstall(c.slug))} />
                ) : locked ? (
                  <ArcadeButton compact variant="primary" label="ASSINAR" onPress={() => router.push("/paywall")} />
                ) : (
                  <ArcadeButton compact variant="primary" label={outdated ? "ATUALIZAR" : "BAIXAR"} onPress={() => void act(c.slug, () => install(c))} />
                )}
              </View>
            );
          })}

          {admin && pending.length > 0 ? (
            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              <Text style={{ color: colors.online, fontWeight: "900" }}>REVISÃO (ADMIN)</Text>
              {pending.map((c) => (
                <View key={`${c.slug}-${c.sha256}`} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surfaceHigh }}>
                  <Text style={{ flex: 1, color: colors.ink }}>
                    {c.name} · {c.author} · {kb(c.size_bytes)}
                  </Text>
                  <ArcadeButton compact variant="primary" label="APROVAR" onPress={() => void act(c.slug, async () => { await reviewCharacter(c.slug, "approved"); await load(); })} />
                  <ArcadeButton compact label="PREMIUM" onPress={() => void act(c.slug, async () => { await reviewCharacter(c.slug, "approved", { premium: true }); await load(); })} />
                  <ArcadeButton compact variant="danger" label="RECUSAR" onPress={() => void act(c.slug, async () => { await reviewCharacter(c.slug, "rejected", { reason: "Não aprovado na revisão" }); await load(); })} />
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </View>
      <AdBannerSlot />
    </Screen>
  );
}
