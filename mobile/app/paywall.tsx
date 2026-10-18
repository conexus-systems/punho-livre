import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import { MetroButton, MetroHeader, MetroPage, MetroProgress, MetroRow } from "@/components/metro";
import { startCheckout } from "@/src/services/payments";
import { app } from "@/src/store";
import { TYPE } from "@/src/ui/type";
import { space, useTokens } from "@/src/ui/theme";

const PLANS = [
  { slug: "premium-mensal", title: "Mensal", note: "Cancele quando quiser" },
  { slug: "premium-anual", title: "Anual", note: "Melhor custo" },
];

/** Paywall CONEXUS: checkout web do bff-payment (sem SDK de pagamento no app). */
export default function Paywall() {
  const t = useTokens();
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
    <MetroPage>
      <MetroHeader title="Premium" actions={<MetroButton kind="text" label="Continuar grátis" onPress={() => router.back()} />} />
      <ScrollView contentContainerStyle={{ gap: space.sm, maxWidth: 640, paddingBottom: space.lg }}>
        <MetroRow glyph="close" title="Sem anúncios" secondary="Nem banner nos menus, nem anúncio entre lutas." />
        <MetroRow glyph="characters" title="Personagens exclusivos" secondary="Os marcados como premium no catálogo." />
        <MetroRow glyph="arcade" title="Continues ilimitados no Arcade" secondary="Sem precisar assistir anúncio." />
        <Text style={[TYPE.CAPTION, { color: t.muted }]}>Pagamento no site seguro da CONEXUS (Pix, cartão ou cripto).</Text>
        {premium ? <Text style={[TYPE.SUBTITLE, { color: t.accentText }]}>Você já é Premium.</Text> : null}
        {busy ? <MetroProgress /> : null}
        {message ? <Text style={[TYPE.BODY, { color: t.text }]}>{message}</Text> : null}
        <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.sm }}>
          {PLANS.map((p) => (
            <MetroButton key={p.slug} kind="primary" label={`Assinar ${p.title.toLowerCase()} no site`} glyph="premium" disabled={busy || premium} onPress={() => void buy(p.slug)} />
          ))}
        </View>
        <Text style={[TYPE.CAPTION, { color: t.muted }]}>{PLANS.map((p) => `${p.title}: ${p.note}`).join(" · ")}</Text>
      </ScrollView>
    </MetroPage>
  );
}
