/**
 * Leitor genérico dos arquivos de texto do MUGEN (.def, .air, .cmd, .cns).
 *
 * Todos seguem o mesmo esqueleto: seções `[Nome]`, linhas `chave = valor` e
 * comentários iniciados por `;`. A ordem das seções é preservada porque .cns e
 * .cmd repetem `[State n]` várias vezes.
 */

export interface IniLine {
  readonly raw: string;
  /** Chave em minúsculas (antes do primeiro `=`), ou null se a linha não tem `=`. */
  readonly key: string | null;
  readonly value: string;
  readonly lineNo: number;
}

export interface IniSection {
  /** Nome como escrito, sem colchetes (ex.: "Statedef 200", "Begin Action 0"). */
  readonly name: string;
  readonly lower: string;
  readonly lines: IniLine[];
}

export function stripComment(line: string): string {
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inString = !inString;
    else if (ch === ";" && !inString) return line.slice(0, i);
  }
  return line;
}

export function parseIni(text: string): IniSection[] {
  const sections: IniSection[] = [];
  let current: IniSection | null = null;
  const rows = text.replace(/^﻿/, "").split(/\r\n|\r|\n/);

  rows.forEach((row, idx) => {
    const line = stripComment(row).trim();
    if (line === "") return;

    if (line.startsWith("[")) {
      const end = line.indexOf("]");
      const name = (end > 0 ? line.slice(1, end) : line.slice(1)).trim();
      current = { name, lower: name.toLowerCase().replace(/\s+/g, " "), lines: [] };
      sections.push(current);
      return;
    }
    if (!current) return;

    const eq = line.indexOf("=");
    if (eq > 0) {
      (current as IniSection).lines.push({
        raw: line,
        key: line.slice(0, eq).trim().toLowerCase().replace(/\s+/g, ""),
        value: line.slice(eq + 1).trim(),
        lineNo: idx + 1,
      });
    } else {
      (current as IniSection).lines.push({ raw: line, key: null, value: line, lineNo: idx + 1 });
    }
  });

  return sections;
}

/** Primeira ocorrência de cada chave da seção (como o MUGEN faz em [Info]/[Files]/[Data]). */
export function sectionMap(section: IniSection | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!section) return out;
  for (const l of section.lines) {
    if (l.key !== null && !(l.key in out)) out[l.key] = l.value;
  }
  return out;
}

export function findSection(sections: IniSection[], lowerName: string): IniSection | undefined {
  return sections.find((s) => s.lower === lowerName);
}

/** Remove aspas externas: `"Kung Fu Man"` → `Kung Fu Man`. */
export function unquote(value: string): string {
  const v = value.trim();
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1);
  return v;
}

/** Divide por vírgulas que não estão dentro de parênteses, colchetes ou aspas. */
export function splitTopLevel(value: string, sep = ","): string[] {
  const out: string[] = [];
  let depth = 0;
  let inString = false;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === '"') inString = !inString;
    else if (inString) continue;
    else if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (ch === sep && depth === 0) {
      out.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(value.slice(start).trim());
  return out;
}

export function parseNumberList(value: string): number[] {
  return splitTopLevel(value).map((v) => {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  });
}
