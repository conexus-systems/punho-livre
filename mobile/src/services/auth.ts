/**
 * Login via bff-auth (OAuth2 Authorization Code + PKCE, cliente público).
 * Não há senha nem Devise aqui: o bff-auth é a fonte da verdade da identidade.
 *
 * - authorize: GET  {AUTH}/oauth/authorize (S256)
 * - token:     POST {AUTH}/oauth/token     (authorization_code | refresh_token; refresh rotaciona)
 * - revoke:    POST {AUTH}/oauth/revoke    (token = refresh_token)
 * Access token: JWT RS256 de 15 min, `aud` = client_id deste app.
 */

import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";

import { config } from "@/src/config";
import { app, type Session } from "@/src/store";

import { decodeJwt } from "./jwt";

const STORE_KEY = "mugen-arena.session";

export const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: `${config.authUrl}/oauth/authorize`,
  tokenEndpoint: `${config.authUrl}/oauth/token`,
  revocationEndpoint: `${config.authUrl}/oauth/revoke`,
};

export function authRequestConfig(): AuthSession.AuthRequestConfig {
  return {
    clientId: config.authClientId,
    redirectUri: config.redirectUri,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    scopes: [],
  };
}

function sessionFrom(token: AuthSession.TokenResponse): Session {
  const claims = decodeJwt(token.accessToken);
  return {
    accessToken: token.accessToken,
    refreshToken: token.refreshToken ?? null,
    expiresAt: Date.now() + (token.expiresIn ?? 900) * 1000,
    sub: String(claims.sub ?? ""),
    email: typeof claims.email === "string" ? claims.email : null,
    name: typeof claims.name === "string" ? claims.name : null,
  };
}

async function persist(session: Session | null): Promise<void> {
  app.set({ session });
  if (session) await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(session));
  else await SecureStore.deleteItemAsync(STORE_KEY);
}

export async function restoreSession(): Promise<void> {
  const raw = await SecureStore.getItemAsync(STORE_KEY).catch(() => null);
  if (!raw) return;
  try {
    app.set({ session: JSON.parse(raw) as Session });
  } catch {
    await SecureStore.deleteItemAsync(STORE_KEY);
  }
}

/** Troca o `code` do redirect por tokens (o verifier PKCE vem do AuthRequest). */
export async function completeLogin(code: string, codeVerifier: string): Promise<Session> {
  const token = await AuthSession.exchangeCodeAsync(
    {
      clientId: config.authClientId,
      code,
      redirectUri: config.redirectUri,
      extraParams: { code_verifier: codeVerifier },
    },
    discovery,
  );
  const session = sessionFrom(token);
  await persist(session);
  return session;
}

let refreshing: Promise<Session | null> | null = null;

/** Access token válido (renova com o refresh token se faltar < 60 s). */
export async function accessToken(): Promise<string | null> {
  const s = app.get().session;
  if (!s) return null;
  if (s.expiresAt - Date.now() > 60_000) return s.accessToken;
  if (!s.refreshToken) return null;
  refreshing ??= (async () => {
    try {
      const token = await AuthSession.refreshAsync(
        { clientId: config.authClientId, refreshToken: s.refreshToken ?? undefined },
        discovery,
      );
      const next = sessionFrom(token);
      if (!next.refreshToken) next.refreshToken = s.refreshToken;
      await persist(next);
      return next;
    } catch {
      // refresh inválido/expirado (30 dias) → precisa logar de novo
      await persist(null);
      return null;
    } finally {
      refreshing = null;
    }
  })();
  const next = await refreshing;
  return next?.accessToken ?? null;
}

export async function logout(): Promise<void> {
  const s = app.get().session;
  if (s?.refreshToken) {
    try {
      await AuthSession.revokeAsync(
        { token: s.refreshToken, clientId: config.authClientId, tokenTypeHint: AuthSession.TokenTypeHint.RefreshToken },
        discovery,
      );
    } catch {
      // o bff-auth sempre responde 200; falha de rede não impede o logout local
    }
  }
  await persist(null);
  app.set({ player: null });
}
