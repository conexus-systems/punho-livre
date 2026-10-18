/**
 * Modo simples de controle (docs/CONTROLS.md).
 *
 * O jogador tem direcional + 4 botões: Soco, Chute, Especial e Super. Tudo é
 * traduzido aqui para **entradas normais** (bits U/D/L/R + botões), as mesmas
 * que um jogador no modo clássico produziria. A engine não sabe de onde veio
 * a entrada; por isso continua determinística e funciona igual no online (só
 * os bits trafegam, docs/PROTOCOL.md).
 *
 * - Especial + direção (neutro, frente, trás, baixo) → um dos 4 especiais.
 * - Super (com 1 estoque) → super; baixo + Super (com 2 estoques) → super 2.
 * - Toques repetidos no Soco → auto-combo curto, derivado das ligações
 *   (cancels) que o próprio .cmd do personagem define.
 * - Chute → D (chute forte); com frente/trás colado vira arremesso, como no
 *   clássico.
 */

import type { CharacterMeta } from "@/src/characters/types";
import { evaluate, toNum, type EvalContext, type Expr, type Value } from "@/src/engine/expr";
import { matchCommand } from "@/src/engine/mugen/cmd";
import { Btn, toRelative } from "@/src/engine/input";
import { Key, type CharacterData, type CommandDef, type Controller, type FighterState } from "@/src/engine/types";

import { findCommand, macroFromCommand, MacroPlayer, motionCommands, type Macro } from "./macros";

// ------------------------------------------------------------- bits crus

/**
 * Botões virtuais do modo simples. Ficam acima dos bits da engine (≥ 1<<16)
 * para trafegar no mesmo `inputRef` do toque sem colidir com U/D/L/R/botões.
 * Nunca chegam na engine: `SimpleController.step` os converte.
 */
export const SimpleBtn = {
  punch: 1 << 16,
  kick: 1 << 17,
  special: 1 << 18,
  super: 1 << 19,
} as const;

export const SIMPLE_MASK = SimpleBtn.punch | SimpleBtn.kick | SimpleBtn.special | SimpleBtn.super;
const DIRS = Btn.U | Btn.D | Btn.L | Btn.R;

export type SpecialSlot = "neutral" | "forward" | "back" | "down";
export const SLOTS: readonly SpecialSlot[] = ["neutral", "forward", "back", "down"];
export const SLOT_LABEL: Record<SpecialSlot, string> = { neutral: "neutro", forward: "frente", back: "trás", down: "baixo" };

export interface KitMove {
  name: string;
  cmd: string;
}

/** Um passo do auto-combo: aperta um botão (normal) ou faz um comando (especial). */
export type ComboStep = { kind: "button"; key: "x" | "y" | "z" | "a" | "b" | "c"; state: number } | { kind: "command"; cmd: string; state: number };

/** Nome dos botões da engine para a ajuda (x y z socos, a b c chutes). */
export const KEY_NAME: Record<"x" | "y" | "z" | "a" | "b" | "c", string> = {
  x: "soco fraco",
  y: "soco médio",
  z: "soco forte",
  a: "chute fraco",
  b: "chute médio",
  c: "chute forte",
};

export interface SimpleKit {
  specials: Record<SpecialSlot, KitMove | null>;
  /** Especiais que só saem no ar (statetype = A), pelas mesmas direções. */
  airSpecials: Record<SpecialSlot, KitMove | null>;
  super: KitMove | null;
  super2: KitMove | null;
  combo: ComboStep[];
}

// ------------------------------------------------------------ especiais

/** Direção "característica" do comando: meia-lua para frente → frente etc. */
export function classifyMotion(cmd: CommandDef): SpecialSlot {
  const dirs = cmd.elements.map((e) => e.dir).filter((d) => d !== 0);
  if (dirs.length === 2 && dirs[0] === Key.D && dirs[1] === Key.D) return "down";
  // shoryuken (F, D, DF): o "neutro" do modo simples, o antiaéreo
  if (dirs[0] === Key.F && dirs.includes(Key.D)) return "neutral";
  const last = dirs[dirs.length - 1] ?? 0;
  if (last & Key.F) return "forward";
  if (last & Key.B) return "back";
  if (last === Key.D) return "down";
  return "neutral";
}

/**
 * O especial sai mesmo com o comando completo? Um .cmd pode ter um comando
 * "engolido" por outro listado antes no [Statedef -1] (ex.: meia-volta
 * B, DB, D, DF, F + soco também completa a meia-lua D, DF, F + soco). Aqui a
 * macro do comando é reconhecida contra TODOS os comandos do personagem, quadro
 * a quadro, e o [Statedef -1] decide qual estado venceria.
 */
export function reachable(ch: CharacterData, cmdName: string, power = 0, air = false): boolean {
  const cmd = findCommand(ch, cmdName);
  if (!cmd) return false;
  const want = probeChangeState(ch, { stateNo: 0, ctrl: true, moveContact: 0, commands: new Set([cmd.name]), power, air });
  if (want === null) return false;
  const hist = macroFromCommand(cmd);
  for (let now = 0; now < hist.length; now++) {
    const h = (ago: number) => hist[now - ago] ?? 0;
    const active = new Set<string>();
    for (const c of ch.commands) if (matchCommand(c, h)) active.add(c.name);
    if (!active.has(cmd.name)) continue;
    return probeChangeState(ch, { stateNo: 0, ctrl: true, moveContact: 0, commands: active, power, air }) === want;
  }
  return false;
}

/** Distribui até 4 especiais nas direções; o que sobrar ocupa as vagas livres, na ordem. */
export function assignSpecials(ch: CharacterData, moves: KitMove[], air = false): Record<SpecialSlot, KitMove | null> {
  const out: Record<SpecialSlot, KitMove | null> = { neutral: null, forward: null, back: null, down: null };
  const seen = new Set<string>();
  const unique = moves.filter((m) => {
    const key = m.cmd.toLowerCase();
    if (seen.has(key) || !reachable(ch, key, 0, air)) return false;
    seen.add(key);
    return true;
  });
  const leftover: KitMove[] = [];
  for (const raw of unique) {
    // o nome é o do estado que de fato sai (no ar o mesmo comando pode ser outro golpe)
    const label = probeController(ch, { stateNo: 0, ctrl: true, moveContact: 0, commands: new Set([raw.cmd.toLowerCase()]), air })?.label;
    const m = label && !/^normal\b/i.test(label) ? { ...raw, name: label } : raw;
    const slot = classifyMotion(findCommand(ch, m.cmd)!);
    if (out[slot]) leftover.push(m);
    else out[slot] = m;
  }
  for (const m of leftover) {
    const free = SLOTS.find((s) => !out[s]);
    if (free) out[free] = m;
  }
  return out;
}

// ------------------------------------------------------------ auto-combo

interface Probe {
  stateNo: number;
  ctrl: boolean;
  moveContact: number;
  commands: ReadonlySet<string>;
  /** Barra (padrão 0; supers pedem `power >= 1000`). */
  power?: number;
  /** No ar (statetype = A). */
  air?: boolean;
}

/** Contexto falso para avaliar os gatilhos do [Statedef -1] sem rodar a luta. */
function probeContext(pr: Probe): EvalContext {
  const ctx: EvalContext = {
    ident(name) {
      switch (name) {
        case "stateno":
          return pr.stateNo;
        case "prevstateno":
          return 0;
        case "ctrl":
          return pr.ctrl ? 1 : 0;
        case "movecontact":
        case "movehit":
          return pr.moveContact;
        case "moveguarded":
        case "movereversed":
          return 0;
        case "statetype":
          return pr.air ? "a" : "s";
        case "movetype":
          return pr.stateNo >= 200 && pr.stateNo < 5000 ? "a" : "i";
        case "roundstate":
          return 2;
        case "life":
        case "lifemax":
          return 1000;
        case "power":
          return pr.power ?? 0;
        case "alive":
          return 1;
        default:
          // letras soltas são literais ("statetype = S"); o resto vale 0
          return name.length <= 1 ? undefined : 0;
      }
    },
    call(name, args) {
      if ((name === "ifelse" || name === "cond") && args.length >= 3) return toNum(args[0]) !== 0 ? args[1] : args[2];
      if (name === "abs") return Math.abs(toNum(args[0] ?? 0));
      return 0;
    },
    command: (name) => pr.commands.has(name),
    animElem: () => false,
    redirect: () => null,
  };
  return ctx;
}

function truthy(v: Value): boolean {
  return typeof v === "string" ? v.length > 0 : v !== 0;
}

function fires(c: Controller, ctx: EvalContext): boolean {
  const all = (list: Expr[]) => list.every((e) => truthy(evaluate(e, ctx)));
  if (!all(c.triggerAll)) return false;
  return c.triggers.some((group) => group.length > 0 && all(group));
}

/** Para qual estado o [Statedef -1] mandaria o lutador nesta situação (null = nenhum). */
export function probeChangeState(ch: CharacterData, pr: Probe): number | null {
  return probeController(ch, pr)?.state ?? null;
}

/** Como `probeChangeState`, devolvendo também o rótulo do controlador ("[State -1, Kaze Ha]" → "Kaze Ha"). */
export function probeController(ch: CharacterData, pr: Probe): { state: number; label: string } | null {
  const sd = ch.states[-1];
  if (!sd) return null;
  const ctx = probeContext(pr);
  for (const c of sd.controllers) {
    if (c.type !== "changestate") continue;
    try {
      if (!fires(c, ctx)) continue;
      const v = c.params["value"]?.[0];
      return v ? { state: Math.trunc(toNum(evaluate(v, ctx))), label: c.label } : null;
    } catch {
      // gatilho que depende da luta de verdade: ignora
    }
  }
  return null;
}

/** Ligações tentadas (normais em pé). Empate de alcance: o primeiro da lista. */
const CHAIN_KEYS = ["y", "b", "z", "c", "a"] as const;
const MAX_NORMALS = 3;
/** Ordem de desempate do especial que fecha o combo. */
const FINISHER_ORDER: SpecialSlot[] = ["forward", "neutral", "back", "down"];

/** Alcance do golpe do estado: ponta mais à frente das caixas de ataque (Clsn1) da animação. */
export function stateReach(ch: CharacterData, stateNo: number): number {
  const sd = ch.states[stateNo];
  if (!sd?.anim) return -1;
  let animNo: number;
  try {
    animNo = Math.trunc(toNum(evaluate(sd.anim, probeContext({ stateNo, ctrl: false, moveContact: 0, commands: new Set() }))));
  } catch {
    return -1;
  }
  let reach = -1;
  for (const fr of ch.anims[animNo]?.frames ?? []) for (const b of fr.clsn1) reach = Math.max(reach, b.x1, b.x2);
  return reach;
}

/**
 * Auto-combo curto: soco fraco → ligações em pé que o .cmd permite cancelar
 * com o golpe acertando → especial que cancela o último normal.
 *
 * Cada acerto empurra o oponente para trás; por isso a próxima ligação tem que
 * alcançar MAIS longe que a anterior (senão erra no vazio). Entre as possíveis,
 * vai a de maior alcance; até 3 normais.
 */
export function deriveCombo(ch: CharacterData, specials: Record<SpecialSlot, KitMove | null>): ComboStep[] {
  const first = probeChangeState(ch, { stateNo: 0, ctrl: true, moveContact: 0, commands: new Set(["x"]) });
  if (first === null || first < 200 || first >= 1000) return [];
  const steps: ComboStep[] = [{ kind: "button", key: "x", state: first }];
  const visited = new Set([first]);
  let cur = first;
  let reach = stateReach(ch, first);
  while (steps.length < MAX_NORMALS) {
    let best: { key: (typeof CHAIN_KEYS)[number]; state: number; reach: number } | null = null;
    for (const key of CHAIN_KEYS) {
      const to = probeChangeState(ch, { stateNo: cur, ctrl: false, moveContact: 1, commands: new Set([key]) });
      if (to === null || to < 200 || to >= 1000 || visited.has(to)) continue;
      const r = stateReach(ch, to);
      if (r > reach && (!best || r > best.reach)) best = { key, state: to, reach: r };
    }
    if (!best) break;
    steps.push({ kind: "button", key: best.key, state: best.state });
    visited.add(best.state);
    cur = best.state;
    reach = best.reach;
  }
  // fecha com o especial que alcança mais longe (projétil primeiro): o oponente já foi empurrado
  let finisher: { cmd: string; state: number; score: number } | null = null;
  for (const slot of FINISHER_ORDER) {
    const move = specials[slot];
    if (!move) continue;
    const cmd = move.cmd.toLowerCase();
    const to = probeChangeState(ch, { stateNo: cur, ctrl: false, moveContact: 1, commands: new Set([cmd]) });
    if (to === null || to < 1000) continue;
    const projectile = ch.states[to]?.controllers.some((c) => c.type === "projectile") ?? false;
    const score = projectile ? 10_000 : stateReach(ch, to);
    if (!finisher || score > finisher.score) finisher = { cmd, state: to, score };
  }
  if (finisher) steps.push({ kind: "command", cmd: finisher.cmd, state: finisher.state });
  return steps;
}

/** Kit do modo simples de um personagem (nativo: meta.json; importado: comandos de movimento do .cmd). */
export function simpleKit(ch: CharacterData, meta?: CharacterMeta | null): SimpleKit {
  let moves: KitMove[];
  let sup: KitMove | null = null;
  let sup2: KitMove | null = null;
  if (meta) {
    moves = meta.specials;
    sup = reachable(ch, meta.super.cmd, 3000) ? meta.super : null;
    sup2 = meta.super2 && reachable(ch, meta.super2.cmd, 3000) ? meta.super2 : null;
  } else {
    const motions = motionCommands(ch);
    const isSuper = (c: CommandDef) => /super|hyper/i.test(c.name) || c.elements.length >= 6;
    const supers = motions.filter(isSuper);
    moves = motions
      .filter((c) => !isSuper(c))
      .slice(0, 4)
      .map((c) => ({ name: c.name.toUpperCase(), cmd: c.name }));
    sup = supers[0] && reachable(ch, supers[0].name, 3000) ? { name: supers[0].name.toUpperCase(), cmd: supers[0].name } : null;
  }
  const specials = assignSpecials(ch, moves);
  const airSpecials = assignSpecials(ch, moves, true);
  return { specials, airSpecials, super: sup, super2: sup2, combo: deriveCombo(ch, specials) };
}

// ------------------------------------------------------------- execução

/** O que o controlador precisa saber do próprio lutador (lido do mundo local, como a IA faz). */
export interface SimpleContext {
  facing: 1 | -1;
  power: number;
  ctrl: boolean;
  /** Estado atual e se o golpe já encostou (para o auto-combo esperar a hora de cancelar). */
  stateNo: number;
  moveContact: number;
  /** No ar: o Especial usa os especiais aéreos. */
  air: boolean;
  /** Congelamento do impacto: apertos durante ele se perdem, então o combo espera acabar. */
  hitPause: number;
}

/** Contexto do lutador local, lido do mundo (local/previsto no online). */
export function simpleContextOf(me: FighterState): SimpleContext {
  return { facing: me.facing, power: me.power, ctrl: me.ctrl, stateNo: me.stateNo, moveContact: me.moveContact, hitPause: me.hitPause, air: me.stateType === "A" };
}

/** Frames entre toques para o auto-combo continuar. */
export const COMBO_WINDOW = 40;
/** Quanto um toque adiantado fica guardado esperando o golpe anterior encostar. */
export const COMBO_BUFFER = 18;

const KEY_BITS = { x: Btn.x, y: Btn.y, z: Btn.z, a: Btn.a, b: Btn.b, c: Btn.c } as const;

function buttonMacro(bit: number): Macro {
  return [bit, bit, bit, 0];
}

/** Direção relativa do direcional (absoluto) → vaga de especial. */
export function slotFor(raw: number, facing: 1 | -1): SpecialSlot {
  if (raw & Btn.D) return "down";
  const fwd = facing === 1 ? Btn.R : Btn.L;
  const back = facing === 1 ? Btn.L : Btn.R;
  if (raw & fwd) return "forward";
  if (raw & back) return "back";
  return "neutral";
}

/**
 * Traduz, frame a frame, os bits crus do modo simples em entradas da engine.
 * Determinístico: mesma sequência de bits crus + mesmo contexto ⇒ mesma saída.
 */
export class SimpleController {
  private macro = new MacroPlayer();
  private prev = 0;
  private tick = 0;
  private comboStep = -1;
  private lastTap = -Infinity;
  /** Passo do combo esperando o golpe anterior encostar. */
  private pending: { step: number; until: number } | null = null;
  /** Nome do último golpe disparado (para a interface/testes). */
  lastFired: string | null = null;

  constructor(
    private ch: CharacterData,
    public kit: SimpleKit,
  ) {}

  /** Troca de personagem (equipes): refaz o kit. */
  setCharacter(ch: CharacterData, kit: SimpleKit): void {
    this.ch = ch;
    this.kit = kit;
    this.reset();
  }

  reset(): void {
    this.macro.clear();
    this.prev = 0;
    this.comboStep = -1;
    this.lastTap = -Infinity;
    this.pending = null;
  }

  get busy(): boolean {
    return this.macro.busy;
  }

  private playCommand(cmdName: string, facing: 1 | -1): boolean {
    const cmd = findCommand(this.ch, cmdName);
    if (!cmd) return false;
    this.macro.play(macroFromCommand(cmd), facing);
    this.lastFired = cmd.name;
    return true;
  }

  private playStep(i: number, ctx: SimpleContext): void {
    const step = this.kit.combo[i];
    if (!step) return;
    if (step.kind === "button") {
      this.macro.play(buttonMacro(KEY_BITS[step.key]), ctx.facing);
      this.lastFired = step.key;
    } else this.playCommand(step.cmd, ctx.facing);
  }

  /** Quadros da macro do passo antes do botão final (a meia-lua pode ser feita durante o congelamento do impacto). */
  private lead(i: number): number {
    const step = this.kit.combo[i];
    if (!step || step.kind === "button") return 0;
    const cmd = findCommand(this.ch, step.cmd);
    return cmd ? Math.max(0, macroFromCommand(cmd).length - 3) : 0;
  }

  /**
   * O golpe anterior do combo já pode ser cancelado ou acabou (voltou o
   * controle). Apertos durante o congelamento do impacto se perdem, então o
   * botão final do passo tem que cair depois dele.
   */
  private ready(ctx: SimpleContext, step: number): boolean {
    return ctx.ctrl || (ctx.moveContact > 0 && ctx.hitPause <= this.lead(step));
  }

  step(raw: number, ctx: SimpleContext): number {
    this.tick++;
    const pressed = raw & ~this.prev;
    this.prev = raw;
    const dir = raw & DIRS;

    if (pressed & SimpleBtn.super) {
      const two = (raw & Btn.D) !== 0 && this.kit.super2 && ctx.power >= 2000;
      const move = two ? this.kit.super2 : ctx.power >= 1000 ? this.kit.super : null;
      if (move) {
        this.pending = null;
        this.playCommand(move.cmd, ctx.facing);
      }
    } else if (pressed & SimpleBtn.special) {
      const slot = slotFor(raw, ctx.facing);
      const set = ctx.air ? this.kit.airSpecials : this.kit.specials;
      // vaga vazia: cai no neutro, senão no primeiro que existir
      const move = set[slot] ?? set.neutral ?? SLOTS.map((s) => set[s]).find(Boolean) ?? null;
      if (move) {
        this.pending = null;
        this.playCommand(move.cmd, ctx.facing);
      }
    } else if (pressed & SimpleBtn.punch) {
      if (dir !== 0 || this.kit.combo.length === 0) {
        // com direção, o soco é o A de sempre (agachado, andando); a direção continua segura
        const rel = toRelative(dir | Btn.x, ctx.facing);
        this.macro.play([rel, rel, rel], ctx.facing);
        this.comboStep = -1;
        this.lastFired = "x";
      } else if (this.pending || this.macro.busy) {
        // já tem um passo esperando ou saindo: o toque extra só mantém o combo vivo
        this.lastTap = this.tick;
      } else {
        const next = this.tick - this.lastTap <= COMBO_WINDOW && this.comboStep + 1 < this.kit.combo.length ? this.comboStep + 1 : 0;
        this.lastTap = this.tick;
        this.comboStep = next;
        if (next === 0 || this.ready(ctx, next)) {
          this.pending = null;
          this.playStep(next, ctx);
        } else this.pending = { step: next, until: this.tick + COMBO_BUFFER };
      }
    }

    if (this.pending && !this.macro.busy) {
      if (this.tick > this.pending.until) this.pending = null;
      else if (this.ready(ctx, this.pending.step)) {
        const s = this.pending.step;
        this.pending = null;
        this.playStep(s, ctx);
      }
    }

    const m = this.macro.next();
    if (m !== null) return m;
    // Chute = D (chute forte); segurar funciona como no clássico
    return dir | (raw & SimpleBtn.kick ? Btn.c : 0);
  }
}
