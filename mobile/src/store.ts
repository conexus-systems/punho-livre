import { useSyncExternalStore } from "react";

/** Store mínima (sem dependências) com seletor para React. */
export function createStore<T extends object>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch: Partial<T> | ((s: T) => Partial<T>)) {
      const next = typeof patch === "function" ? patch(state) : patch;
      state = { ...state, ...next };
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    use<R>(selector: (s: T) => R): R {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      return useSyncExternalStore(this.subscribe, () => selector(state), () => selector(state));
    },
  };
}

export interface Player {
  id: number;
  conexus_user_id: string;
  display_name: string;
  email: string | null;
  rating: number;
  wins: number;
  losses: number;
  premium: boolean;
  admin: boolean;
}

export interface Session {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
  /** Claims do JWT do bff-auth. */
  sub: string;
  email: string | null;
  name: string | null;
}

export interface AppState {
  session: Session | null;
  player: Player | null;
  /** Entitlement ativo no bff-payment para o produto. */
  premium: boolean;
  /** Partidas offline concluídas desde o último interstitial. */
  matchesSinceAd: number;
  settings: {
    assist: boolean;
    vibration: boolean;
    difficulty: 1 | 2 | 3;
    inputDelay: number;
    /** Botões da luta: 4 do padrão SNK (A B C D + A+B e C+D) ou os 6 do MUGEN. */
    buttons: "snk" | "mugen";
  };
}

export const app = createStore<AppState>({
  session: null,
  player: null,
  premium: false,
  matchesSinceAd: 0,
  settings: { assist: true, vibration: true, difficulty: 2, inputDelay: 2, buttons: "snk" },
});
