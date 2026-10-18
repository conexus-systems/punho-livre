/** Cliente do backend do jogo (docs/PROTOCOL.md). */

import { config } from "@/src/config";
import { app, type Player } from "@/src/store";

import { requestJson } from "./http";

export interface CharacterSummary {
  slug: string;
  name: string;
  author: string;
  version: string;
  sha256: string;
  size_bytes: number;
  premium: boolean;
  status: string;
  pack_url: string;
  updated_at: string;
}

export interface MatchSummary {
  id: number;
  opponent: { display_name: string; rating: number } | null;
  my_character: string;
  opponent_character: string;
  result: "win" | "loss" | "draw" | "abandoned" | "void";
  rating_delta: number;
  finished_at: string | null;
}

const url = (p: string) => `${config.apiUrl}${p}`;

export async function fetchMe(): Promise<Player> {
  const { player } = await requestJson<{ player: Player }>(url("/api/v1/me"), { auth: true });
  app.set({ player, premium: app.get().premium || player.premium });
  return player;
}

export async function updateDisplayName(display_name: string): Promise<Player> {
  const { player } = await requestJson<{ player: Player }>(url("/api/v1/me"), {
    method: "PATCH",
    auth: true,
    body: JSON.stringify({ display_name }),
  });
  app.set({ player });
  return player;
}

export async function fetchCatalog(): Promise<CharacterSummary[]> {
  const { characters } = await requestJson<{ characters: CharacterSummary[] }>(url("/api/v1/characters"));
  return characters;
}

/** Corpo cru do pack (o sha256 é calculado sobre estes bytes). */
export async function fetchPackText(c: CharacterSummary): Promise<string> {
  const { accessToken } = await import("./auth");
  const token = c.premium ? await accessToken() : null;
  const res = await fetch(c.pack_url, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).catch(() => {
    throw new Error("Sem conexão com o servidor. Verifique a internet e tente de novo.");
  });
  if (res.status === 402) throw new Error("Personagem premium — assine para baixar.");
  if (!res.ok) throw new Error(`Falha ao baixar ${c.name} (${res.status})`);
  return res.text();
}

export async function submitCharacter(pack: unknown): Promise<CharacterSummary> {
  const { character } = await requestJson<{ character: CharacterSummary }>(url("/api/v1/characters"), {
    method: "POST",
    auth: true,
    body: JSON.stringify({ pack }),
  });
  return character;
}

export interface Season {
  number: number;
  name: string;
  starts_at: string;
  ends_at: string;
}

export interface LeaderboardEntry {
  display_name: string;
  rating: number;
  wins: number;
  losses: number;
  league: string;
}

/** Ranking da temporada (padrão: a atual). */
export async function fetchLeaderboard(season?: number): Promise<{ season: Season; players: LeaderboardEntry[] }> {
  return requestJson<{ season: Season; players: LeaderboardEntry[] }>(
    url(`/api/v1/leaderboard${season ? `?season=${season}` : ""}`),
  );
}

export interface RankedStanding {
  season: Season;
  rating: number;
  deviation: number;
  peak_rating: number;
  league: { key: string; name: string; min_rating: number | null; next_min_rating: number | null };
  placement_remaining: number;
  rank: number | null;
  wins: number;
  losses: number;
  draws: number;
}

/** Rating, liga e posição do jogador na temporada atual. */
export async function fetchRanked(): Promise<RankedStanding> {
  return requestJson<RankedStanding>(url("/api/v1/ranked"), { auth: true });
}

export async function fetchMatches(): Promise<MatchSummary[]> {
  const { matches } = await requestJson<{ matches: MatchSummary[] }>(url("/api/v1/matches"), { auth: true });
  return matches;
}

// ------------------------------------------------------------- admin

export async function fetchPendingCharacters(): Promise<CharacterSummary[]> {
  const { characters } = await requestJson<{ characters: CharacterSummary[] }>(
    url("/api/v1/admin/characters?status=pending"),
    { auth: true },
  );
  return characters;
}

export async function reviewCharacter(slug: string, status: "approved" | "rejected", opts: { premium?: boolean; reason?: string } = {}) {
  await requestJson(url(`/api/v1/admin/characters/${encodeURIComponent(slug)}`), {
    method: "PATCH",
    auth: true,
    body: JSON.stringify({ status, ...opts }),
  });
}
