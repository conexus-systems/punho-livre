/**
 * Premium via bff-payment (end-user API /v1/me, Bearer = access token do bff-auth).
 * Checkout é web (Mercado Pago/Stripe no BFF) — sem SDK de pagamento no app.
 */

import * as WebBrowser from "expo-web-browser";

import { config } from "@/src/config";
import { app } from "@/src/store";

import { requestJson } from "./http";

interface Entitlement {
  product_slug: string;
  plan_slug: string;
  status: "active" | "inactive" | "expired";
  expires_at: string | null;
}

export async function refreshEntitlements(): Promise<boolean> {
  const { entitlements } = await requestJson<{ entitlements: Entitlement[] }>(
    `${config.paymentsUrl}/v1/me/entitlements?product_slug=${encodeURIComponent(config.productSlug)}`,
    { auth: true },
  );
  const premium = entitlements.some((e) => e.product_slug === config.productSlug && e.status === "active");
  app.set({ premium: premium || app.get().player?.premium === true });
  return premium;
}

/** Abre o checkout do bff-payment e, ao voltar, reconsulta o entitlement. */
export async function startCheckout(planSlug = config.premiumPlan): Promise<boolean> {
  const { checkout_url } = await requestJson<{ checkout_url: string }>(`${config.paymentsUrl}/v1/me/checkouts`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({
      product_slug: config.productSlug,
      plan_slug: planSlug,
      return_url: config.checkoutReturnUrl,
      cancel_url: config.checkoutReturnUrl,
    }),
  });
  await WebBrowser.openAuthSessionAsync(checkout_url, config.checkoutReturnUrl);
  // o webhook do pagamento pode chegar alguns segundos depois
  for (let i = 0; i < 5; i++) {
    if (await refreshEntitlements()) return true;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}
