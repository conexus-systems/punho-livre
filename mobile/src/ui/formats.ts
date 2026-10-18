/**
 * Formatos pt-BR (porte de `ui/Formats.kt`), sem depender do Intl do Hermes.
 */

export function number(value: number, decimals = 0): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [int, frac] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${value < 0 ? "-" : ""}${grouped}${frac ? `,${frac}` : ""}`;
}

export function percent(ratio: number, decimals = 0): string {
  return `${number(ratio * 100, decimals)}%`;
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${number(n / 1024, n < 10 * 1024 ? 1 : 0)} KB`;
  return `${number(n / (1024 * 1024), 1)} MB`;
}

/** "1 vitória" / "3 vitórias". */
export function count(n: number, one: string, many: string): string {
  return `${number(n)} ${n === 1 ? one : many}`;
}

/** Tempo relativo curto: "agora", "há 5 min", "há 2 h", "ontem", "há 3 dias", ou a data. */
export function relative(iso: string | number | Date, now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.round((now - t) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d} dias`;
  return shortDate(t);
}

export function shortDate(t: number | Date): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Sinal explícito para variação de rating: "+16", "-12", "0". */
export function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}
