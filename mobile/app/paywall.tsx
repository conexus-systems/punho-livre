import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import { Screen } from "@/components/Screen";
import { colors, minTouch, radii, spacing } from "@/constants/theme";
import { startCheckout } from "@/src/services/payments";
import { app } from "@/src/store";

const PLANS = [
  { slug: "premium-mensal", title: "Mensal", price: "Assinatura mensal", note: "Cancele quando quiser" },
  { slug: "premium-anual", title: "Anual", price: "Assinatura anual", note: "Melhor custo" },
];

/** Paywall CONEXUS: checkout web do bff-payment (sem SDK de pagamento no app). */
export default function Paywall() {
  const session = app.use((s) => s.session);
  const premium = app.use((s) => s.premium);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const buy = async (plan: string) => {
    if (!session) {
      router.push("/profile");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const ok = await startCheckout(plan);
      setMessage(ok ? "Premium ativado. Valeu!" : "Pagamento ainda não confirmado — volte em instantes.");
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}>
        <Text style={{ fontSize: 28, fontWeight: "900", color: colors.primary }}>MUGEN ARENA PREMIUM</Text>
        <Text style={{ fontSize: 15, lineHeight: 22, color: colors.inkSecondary }}>
          Sem anúncios · personagens exclusivos do catálogo · continues ilimitados no arcade.{"\n"}
          Pagamento no site seguro da CONEXUS (Pix, cartão).
        </Text>
        {premium ? <Text style={{ color: colors.success, fontWeight: "800" }}>Você já é Premium.</Text> : null}
        {busy ? <ActivityIndicator color={colors.primary} /> : null}
        {message ? <Text style={{ color: colors.ink }}>{message}</Text> : null}
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          {PLANS.map((p) => (
            <Pressable
              key={p.slug}
              accessibilityRole="button"
              accessibilityLabel={`Assinar plano ${p.title} no site`}
              disabled={busy || premium}
              onPress={() => void buy(p.slug)}
              style={{ flex: 1, borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.surface, borderRadius: radii.sm, padding: spacing.card, minHeight: minTouch, opacity: premium ? 0.5 : 1 }}
            >
              <Text style={{ fontSize: 12, color: colors.inkSecondary }}>{p.title.toUpperCase()}</Text>
              <Text style={{ fontSize: 22, fontWeight: "800", color: colors.ink }}>{p.price}</Text>
              <Text style={{ fontSize: 12, color: colors.inkSecondary, marginTop: 4 }}>{p.note} · Assinar no site</Text>
            </Pressable>
          ))}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Continuar grátis" onPress={() => router.back()} style={{ minHeight: minTouch, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.primary, fontWeight: "600" }}>Continuar grátis (com anúncios)</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
