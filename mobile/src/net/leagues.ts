/** Ligas da ranqueada (as faixas valem no servidor: web/app/services/ranked/leagues.rb). */

export const LEAGUE_NAMES: Record<string, string> = {
  placement: "Em colocação",
  bronze: "Bronze",
  prata: "Prata",
  ouro: "Ouro",
  platina: "Platina",
  diamante: "Diamante",
  mestre: "Mestre",
};

const ORDER = ["bronze", "prata", "ouro", "platina", "diamante", "mestre"];

/** Liga seguinte (null em Mestre ou em colocação). */
export function nextLeague(key: string): string | null {
  const i = ORDER.indexOf(key);
  return i >= 0 && i < ORDER.length - 1 ? ORDER[i + 1] : null;
}

export function leagueName(key: string | undefined | null): string {
  return (key && LEAGUE_NAMES[key]) || "—";
}
