import { Platform } from "react-native";

const env = (key: string, fallback: string): string => {
  const v = process.env[key];
  return v && v.trim() !== "" ? v.trim() : fallback;
};

export const config = {
  apiUrl: env("EXPO_PUBLIC_API_URL", "https://mugen-arena.conexus-systems.com.br").replace(/\/$/, ""),
  authUrl: env("EXPO_PUBLIC_AUTH_URL", "https://auth.conexus-systems.com.br").replace(/\/$/, ""),
  paymentsUrl: env("EXPO_PUBLIC_PAYMENTS_URL", "https://payments.conexus-systems.com.br").replace(/\/$/, ""),
  authClientId: env("EXPO_PUBLIC_AUTH_CLIENT_ID", "mugen-arena-mobile"),
  productSlug: env("EXPO_PUBLIC_PRODUCT_SLUG", "mugen-arena"),
  premiumPlan: env("EXPO_PUBLIC_PREMIUM_PLAN", "premium-mensal"),
  /** Redirect nativo (esquema reverse-DNS exigido pelo bff-auth para clientes públicos). */
  redirectUri: "br.com.conexus.mugenarena://oauth/callback",
  checkoutReturnUrl: "br.com.conexus.mugenarena:/checkout/done",
  adsTest: env("EXPO_PUBLIC_ADS_TEST", "1") === "1",
};

export function cableUrl(token: string): string {
  const base = config.apiUrl.replace(/^http/, "ws");
  return `${base}/cable?token=${encodeURIComponent(token)}`;
}

export const isIOS = Platform.OS === "ios";
