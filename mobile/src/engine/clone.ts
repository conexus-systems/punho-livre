/** Cópia profunda de dados puros (o estado do mundo é só objetos, arrays e primitivos). */
export function deepClone<T>(v: T): T {
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) {
    // listas do estado são homogêneas: as de primitivos (entradas, vars) copiam direto
    if (v.length === 0 || v[0] === null || typeof v[0] !== "object") return v.slice() as T;
    const out = new Array(v.length);
    for (let i = 0; i < v.length; i++) out[i] = deepClone(v[i]);
    return out as T;
  }
  const out: Record<string, unknown> = {};
  for (const k in v as Record<string, unknown>) out[k] = deepClone((v as Record<string, unknown>)[k]);
  return out as T;
}

/** Hash FNV-1a de 32 bits do estado (detecção de dessincronia no online). */
export function checksum(v: unknown): number {
  let h = 0x811c9dc5;
  const feed = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  };
  const walk = (x: unknown): void => {
    if (x === null || x === undefined) feed("n");
    else if (typeof x === "number") feed(Number.isInteger(x) ? `${x}` : x.toFixed(4));
    else if (typeof x === "string") feed(x);
    else if (typeof x === "boolean") feed(x ? "t" : "f");
    else if (Array.isArray(x)) {
      feed("[");
      for (const i of x) walk(i);
      feed("]");
    } else if (typeof x === "object") {
      for (const k of Object.keys(x as object).sort()) {
        if (k === "events") continue;
        feed(k);
        walk((x as Record<string, unknown>)[k]);
      }
    }
  };
  walk(v);
  return h >>> 0;
}
