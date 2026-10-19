import { Platform } from "react-native";

const env = (key: string, fallback: string): string => {
  const v = process.env[key];
  return v && v.trim() !== "" ? v.trim() : fallback;
};

export const config = {
  apiUrl: env("EXPO_PUBLIC_API_URL", "https://mugen-arena.conexus-systems.com.br").replace(/\/$/, ""),
  authUrl: env("EXPO_PUBLIC_AUTH_URL", "https://auth.conexus-systems.com.br").replace(/\/$/, ""),
  authClientId: env("EXPO_PUBLIC_AUTH_CLIENT_ID", "mugen-arena-mobile"),
  /** Número do projeto do Google Cloud ligado ao app no Play Console (Play Integrity). */
  playCloudProject: env("EXPO_PUBLIC_PLAY_CLOUD_PROJECT", ""),
  /** Redirect nativo (esquema reverse-DNS exigido pelo bff-auth para clientes públicos). */
  redirectUri: "br.com.conexus.bamba://oauth/callback",
};

export function cableUrl(token: string): string {
  const base = config.apiUrl.replace(/^http/, "ws");
  return `${base}/cable?token=${encodeURIComponent(token)}`;
}

export const isIOS = Platform.OS === "ios";
