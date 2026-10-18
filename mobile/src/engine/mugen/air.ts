/**
 * Parser de animações .air do MUGEN.
 *
 *   [Begin Action 200]
 *   Clsn2Default: 1
 *    Clsn2[0] = -10, 0, 10, -80
 *   Clsn1: 1
 *    Clsn1[0] = 15, -60, 50, -50
 *   200,0, 0,0, 3
 *   200,1, 0,0, 4, H
 *   Loopstart
 *   200,2, 0,0, -1
 */

import type { Animation, AnimFrame, Box } from "../types";
import { parseIni, parseNumberList, stripComment } from "./ini";

function box(values: number[]): Box {
  const [ax = 0, ay = 0, bx = 0, by = 0] = values;
  return { x1: Math.min(ax, bx), y1: Math.min(ay, by), x2: Math.max(ax, bx), y2: Math.max(ay, by) };
}

export function finalizeAnimation(id: number, frames: AnimFrame[], loopStart: number): Animation {
  const starts: number[] = [];
  let total = 0;
  let infinite = false;
  for (const f of frames) {
    starts.push(total);
    if (f.time < 0) infinite = true;
    else total += f.time;
  }
  return {
    id,
    frames,
    loopStart: Math.min(loopStart, Math.max(0, frames.length - 1)),
    totalTime: total,
    infinite,
    starts,
  };
}

export function parseAir(text: string): Record<number, Animation> {
  const anims: Record<number, Animation> = {};

  for (const section of parseIni(text)) {
    const m = /^begin action\s+(-?\d+)/.exec(section.lower);
    if (!m) continue;
    const id = Number.parseInt(m[1], 10);

    const frames: AnimFrame[] = [];
    let loopStart = 0;
    let defClsn1: Box[] = [];
    let defClsn2: Box[] = [];
    let nextClsn1: Box[] | null = null;
    let nextClsn2: Box[] | null = null;
    // Para onde vão as próximas linhas "ClsnN[i] = ..."
    let target: { list: Box[]; kind: 1 | 2; isDefault: boolean } | null = null;

    for (const line of section.lines) {
      const raw = stripComment(line.raw).trim();
      const lower = raw.toLowerCase();

      const header = /^clsn([12])(default)?\s*:\s*(\d+)/.exec(lower);
      if (header) {
        const kind = header[1] === "1" ? 1 : 2;
        const isDefault = header[2] !== undefined;
        const list: Box[] = [];
        if (isDefault) {
          if (kind === 1) defClsn1 = list;
          else defClsn2 = list;
        } else if (kind === 1) nextClsn1 = list;
        else nextClsn2 = list;
        target = { list, kind, isDefault };
        continue;
      }

      const boxLine = /^clsn([12])\s*\[\s*\d+\s*\]\s*=\s*(.+)$/.exec(lower);
      if (boxLine) {
        if (target) target.list.push(box(parseNumberList(boxLine[2])));
        continue;
      }

      if (lower.startsWith("loopstart")) {
        loopStart = frames.length;
        continue;
      }

      if (/^-?\d/.test(lower)) {
        const parts = lower.split(",").map((p) => p.trim());
        const nums = parts.slice(0, 5).map((p) => Number.parseFloat(p));
        const flags = (parts[5] ?? "").toUpperCase();
        frames.push({
          group: nums[0] ?? 0,
          index: nums[1] ?? 0,
          ox: nums[2] ?? 0,
          oy: nums[3] ?? 0,
          time: Number.isFinite(nums[4]) ? nums[4] : -1,
          flipH: flags.includes("H"),
          flipV: flags.includes("V"),
          clsn1: nextClsn1 ?? defClsn1,
          clsn2: nextClsn2 ?? defClsn2,
        });
        nextClsn1 = null;
        nextClsn2 = null;
        target = null;
      }
    }

    if (frames.length > 0) anims[id] = finalizeAnimation(id, frames, loopStart);
  }

  return anims;
}

const fmtNum = (v: number) => (Number.isInteger(v) ? `${v}` : `${Math.round(v * 1000) / 1000}`);
const fmtBox = (b: Box) => `${fmtNum(b.x1)}, ${fmtNum(b.y1)}, ${fmtNum(b.x2)}, ${fmtNum(b.y2)}`;

/**
 * Escreve animações no formato .air (inverso de `parseAir`). Cada quadro leva as
 * próprias caixas (`Clsn2: n` / `Clsn1: n`), sem `Clsn2Default`, para o arquivo
 * poder ser editado quadro a quadro. `header` vira comentário no topo.
 */
export function serializeAir(anims: Record<number, Animation>, header?: string): string {
  const out: string[] = [];
  if (header) {
    for (const line of header.split("\n")) out.push(`; ${line}`.trimEnd());
    out.push("");
  }
  for (const id of Object.keys(anims).map(Number).sort((a, b) => a - b)) {
    const a = anims[id];
    out.push(`[Begin Action ${id}]`);
    a.frames.forEach((f, i) => {
      if (i === a.loopStart && a.loopStart > 0) out.push("Loopstart");
      if (f.clsn2.length) {
        out.push(`Clsn2: ${f.clsn2.length}`);
        f.clsn2.forEach((b, j) => out.push(` Clsn2[${j}] = ${fmtBox(b)}`));
      }
      if (f.clsn1.length) {
        out.push(`Clsn1: ${f.clsn1.length}`);
        f.clsn1.forEach((b, j) => out.push(` Clsn1[${j}] = ${fmtBox(b)}`));
      }
      const flags = `${f.flipH ? "H" : ""}${f.flipV ? "V" : ""}`;
      out.push(`${f.group}, ${f.index}, ${fmtNum(f.ox)}, ${fmtNum(f.oy)}, ${f.time}${flags ? `, ${flags}` : ""}`);
    });
    out.push("");
  }
  return out.join("\n");
}
