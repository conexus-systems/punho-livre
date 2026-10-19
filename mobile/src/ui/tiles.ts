/**
 * Modelo do Iniciar com Live Tiles (porte de `tiles/TileModel.kt` + `TilePacking.kt`).
 * Tamanhos em células de bloco pequeno: pequeno 1×1, médio 2×2, largo 4×2, grande 4×4.
 * Posições nunca são guardadas: o empacotamento deriva da ordem.
 */

export type TileSize = "small" | "medium" | "wide" | "large";

export const TILE_CELLS: Record<TileSize, { columns: number; rows: number }> = {
  small: { columns: 1, rows: 1 },
  medium: { columns: 2, rows: 2 },
  wide: { columns: 4, rows: 2 },
  large: { columns: 4, rows: 4 },
};

export interface Placed<T> {
  item: T;
  col: number;
  row: number;
  columns: number;
  rows: number;
}

/**
 * Empacota em ordem, primeira posição livre de cima para baixo e da esquerda para a
 * direita, numa grade de `columns` colunas (blocos maiores que a grade são reduzidos).
 */
export function pack<T extends { size: TileSize }>(items: T[], columns: number): { placed: Placed<T>[]; rows: number } {
  const used: boolean[][] = [];
  const free = (r: number, c: number) => !(used[r]?.[c] ?? false);
  const placed: Placed<T>[] = [];
  for (const item of items) {
    const cells = TILE_CELLS[item.size];
    const w = Math.min(cells.columns, columns);
    const h = cells.rows;
    let done = false;
    for (let r = 0; !done; r++) {
      for (let c = 0; c + w <= columns && !done; c++) {
        let fits = true;
        for (let dr = 0; dr < h && fits; dr++) for (let dc = 0; dc < w && fits; dc++) fits = free(r + dr, c + dc);
        if (!fits) continue;
        for (let dr = 0; dr < h; dr++) {
          used[r + dr] ??= [];
          for (let dc = 0; dc < w; dc++) used[r + dr][c + dc] = true;
        }
        placed.push({ item, col: c, row: r, columns: w, rows: h });
        done = true;
      }
    }
  }
  return { placed, rows: used.length };
}

/** Próximo tamanho no ciclo do modo de edição: pequeno → médio → largo → grande → pequeno. */
export function nextSize(size: TileSize, allowed: TileSize[] = ["small", "medium", "wide", "large"]): TileSize {
  const cycle = (["small", "medium", "wide", "large"] as TileSize[]).filter((s) => allowed.includes(s));
  if (cycle.length === 0) return "medium";
  return cycle[(cycle.indexOf(size) + 1) % cycle.length];
}
