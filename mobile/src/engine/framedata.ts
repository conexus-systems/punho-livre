/**
 * Frame data medida na própria engine.
 *
 * Para cada golpe (estado alcançável por um ChangeState do `[Statedef -1]`) a
 * medição põe o personagem no estado e roda `stepWorld` contra um boneco:
 *
 * - **no vazio** (boneco longe): startup, quadros ativos, recuperação, custo de barra
 *   e invencibilidade;
 * - **no acerto** (boneco colado, parado): vantagem, dano, número de acertos, derrubada;
 * - **na defesa** (boneco colado segurando para trás — e para baixo se o golpe for
 *   baixo): vantagem e dano na defesa.
 *
 * Nada aqui muda a engine: só monta mundos, chama `changeState`/`stepWorld` e lê o
 * estado. Sem relógio nem `Math.random` — mesma entrada, mesma tabela.
 *
 * Convenções (as de jogo de luta):
 * - quadro 1 = o primeiro frame do golpe (o do comando);
 * - startup = primeiro quadro em que o golpe pode acertar (Clsn1 com HitDef armado, ou o
 *   frame em que o projétil nasce);
 * - ativos = do primeiro ao último quadro com Clsn1 armado (golpes de vários acertos
 *   contam o intervalo todo);
 * - total = quadros até voltar a ter controle; recuperação = total − (startup + ativos − 1);
 * - vantagem = (quadro em que o boneco recupera o controle) − (quadro em que o atacante
 *   recupera). Positivo = o atacante age primeiro. A pausa de super não conta como quadro.
 */

import { currentFrame } from "./anim";
import { getAnim, loadCharacter, type CharacterPack } from "./character";
import { changeState, type Roster } from "./fighter";
import { Btn } from "./input";
import { parseIni } from "./mugen/ini";
import type { CharacterData, FighterState, HitDefState, StateType, WorldState } from "./types";
import { Key } from "./types";
import { createWorld, stepWorld } from "./world";

export type MoveKind = "normal" | "especial" | "super";
export type HitLevel = "alto" | "médio" | "baixo" | "imbloqueável";

export interface MoveInfo {
  /** Estado de entrada. */
  state: number;
  /** Nome (rótulo do `[State -1, ...]` ou postura + botão nos normais). */
  name: string;
  /** Comandos do .cmd que levam ao estado (ex.: ["x", "holddown"]). */
  commands: string[];
  kind: MoveKind;
  /** Postura de partida: S em pé, C agachado, A no ar. */
  stance: StateType;
  /** `power >= N` exigido pelo comando (0 se nenhum). */
  powerRequired: number;
}

export interface FrameData {
  state: number;
  name: string;
  command: string;
  kind: MoveKind;
  stance: StateType;
  /** null quando o golpe não arma ataque (ex.: teleporte, postura de contra-golpe). */
  startup: number | null;
  active: number | null;
  recovery: number | null;
  total: number | null;
  projectile: boolean;
  /** Vantagem no acerto / na defesa (null = não mediu: aéreo, não acertou...). */
  onHit: number | null;
  onBlock: number | null;
  /** O acerto derruba (o boneco fica deitado). */
  knockdown: boolean;
  /** Distância entre os eixos em que o acerto/defesa foi medido (null = não acertou o boneco em pé). */
  distance: number | null;
  /** Dano total no acerto (com a escala de combo da engine) e na defesa. */
  damage: number;
  chip: number;
  hits: number;
  level: HitLevel | null;
  /** Barra gasta (diferença negativa de power no vazio) e barra exigida pelo comando. */
  meterCost: number;
  meterRequired: number;
  /** Barra ganha no vazio (poweradd do estado). */
  meterGain: number;
  /** Quadros com NotHitBy desde o quadro 1 ("1-7"), ou null. */
  invincible: string | null;
}

// ------------------------------------------------------------- golpes

const BUTTONS = ["x", "y", "z", "a", "b", "c", "s"];
const STANCE_NAME: Record<string, string> = { S: "em pé", C: "agachado", A: "no ar", L: "deitado" };

/**
 * Lista os golpes de um pack: ChangeState do `[Statedef -1]` (no .cmd ou nos .cns) para
 * estados de ataque (200–4999). Corrida, recuo e estados do sistema ficam de fora.
 */
export function listMoves(pack: CharacterPack, ch: CharacterData = loadCharacter(pack)): MoveInfo[] {
  const byState = new Map<number, MoveInfo>();
  const texts = Object.entries(pack.files)
    .filter(([name]) => /\.(cmd|cns|st\d*)$/i.test(name))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .sort(([a], [b]) => Number(/\.cmd$/i.test(b)) - Number(/\.cmd$/i.test(a)))
    .map(([, t]) => t);
  for (const text of texts) {
    for (const sec of parseIni(text)) {
      const m = /^state\s+-1\s*(?:,\s*(.*))?$/.exec(sec.lower);
      if (!m) continue;
      const label = /,\s*(.*)$/.exec(sec.name)?.[1]?.trim() ?? "";
      let type = "";
      let value = Number.NaN;
      const commands: string[] = [];
      let powerRequired = 0;
      let air = false;
      for (const l of sec.lines) {
        if (l.key === "type") type = l.value.toLowerCase();
        else if (l.key === "value") value = /^\s*\d+\s*$/.test(l.value) ? Number(l.value) : Number.NaN;
        else if (l.key && /^trigger(all|\d+)$/.test(l.key)) {
          for (const c of l.value.matchAll(/command\s*=\s*"([^"]+)"/gi)) commands.push(c[1].toLowerCase());
          const pw = /power\s*>=\s*(\d+)/i.exec(l.value);
          if (pw) powerRequired = Math.max(powerRequired, Number(pw[1]));
          if (/statetype\s*=\s*a\b/i.test(l.value)) air = true;
        }
      }
      if (type !== "changestate" || !Number.isFinite(value) || value < 200 || value >= 5000) continue;
      const sd = ch.states[value];
      if (!sd || sd.moveType === "H") continue;
      const kind: MoveKind = value >= 3000 || powerRequired > 0 ? "super" : value >= 1000 ? "especial" : "normal";
      // postura de partida vem do comando (statetype = A / holddown), não do estado (um especial
      // que sobe começa no chão)
      const stance: StateType = air ? "A" : commands.includes("holddown") || (sd.type === "C" && !commands.length) ? "C" : "S";
      const prev = byState.get(value);
      if (prev) {
        for (const c of commands) if (!prev.commands.includes(c)) prev.commands.push(c);
        prev.powerRequired = Math.max(prev.powerRequired, powerRequired);
        continue;
      }
      const isGeneric = kind === "normal" && (/^normal\b/i.test(label) || label === "");
      byState.set(value, { state: value, name: isGeneric ? "" : label, commands: [...new Set(commands)], kind, stance, powerRequired });
    }
  }
  const out = [...byState.values()].sort((a, b) => a.state - b.state);
  for (const m of out) if (!m.name) m.name = `${STANCE_NAME[m.stance]} ${buttonsOf(m) || m.state}`;
  return out;
}

function buttonsOf(m: MoveInfo): string {
  return m.commands.filter((c) => BUTTONS.includes(c)).join("/");
}

/** Comando legível: botões dos normais ("2+x" agachado) ou o nome do comando do especial. */
function commandLabel(m: MoveInfo): string {
  const buttons = buttonsOf(m);
  const motion = m.commands.filter((c) => !BUTTONS.includes(c) && !c.startsWith("hold"));
  if (m.kind === "normal") return `${m.stance === "C" ? "↓+" : m.stance === "A" ? "(ar) " : ""}${buttons}`;
  return motion.join(" / ") || buttons;
}

// ------------------------------------------------------------- simulação

const FAR = 280;
/** Passo (em unidades) ao procurar a distância em que o golpe acerta. */
const RANGE_STEP = 6;
const MAX_FRAMES = 600;

interface Bench {
  w: WorldState;
  roster: Roster;
}

function bench(roster: Roster, attacker: string, dummy: string, dist: number): Bench {
  const w = createWorld({ chars: [attacker, dummy], stageId: "framedata", seed: 1, roundsToWin: 9, roundTime: -1 }, roster);
  for (let i = 0; i < 400 && w.roundState !== 2; i++) stepWorld(w, [0, 0], roster);
  const [a, b] = w.fighters;
  a.x = -dist / 2;
  b.x = dist / 2;
  // um frame parado para separar/encostar os corpos
  stepWorld(w, [0, 0], roster);
  for (const p of w.fighters) {
    p.power = 0;
    p.life = p.lifeMax;
  }
  return { w, roster };
}

/** Sobe no pulo neutro até alguns frames depois de sair do chão (para golpes aéreos). */
function jump(b: Bench): void {
  const p = b.w.fighters[0];
  for (let i = 0; i < 40 && p.stateNo !== 50; i++) stepWorld(b.w, [Btn.U, 0], b.roster);
  for (let i = 0; i < 4; i++) stepWorld(b.w, [0, 0], b.roster);
}

/** Boneco já segurando para trás (sem "apertar" no último instante, para não virar Just Defend). */
function holdBack(d: FighterState, low: boolean): number {
  const rel = Key.B | (low ? Key.D : 0);
  d.inputs.fill(rel);
  // lado direito, virado para a esquerda: trás = direita
  const raw = (d.facing === 1 ? Btn.L : Btn.R) | (low ? Btn.D : 0);
  d.rawInput = raw;
  return raw;
}

function enter(b: Bench, m: MoveInfo, power: number): void {
  const p = b.w.fighters[0];
  p.power = power;
  if (m.stance === "C") p.stateType = "C";
  changeState(p, b.w, b.roster, m.state);
}

interface Trace {
  /** Quadro (1-based, sem contar pausa de super) após o qual o atacante recuperou o controle. */
  atkRecover: number | null;
  defRecover: number | null;
  firstActive: number | null;
  lastActive: number | null;
  projectile: boolean;
  hitDef: HitDefState | null;
  hits: number;
  guards: number;
  minPower: number;
  maxPower: number;
  knockdown: boolean;
  invincible: number[];
}

function clsn1Armed(b: Bench, p: FighterState): boolean {
  if (!p.hitDefActive || !p.hitDef) return false;
  const ch = b.roster[p.charId];
  return currentFrame(p, getAnim(ch, p.anim)).clsn1.length > 0;
}

function run(b: Bench, dummyInput: number, startPower: number, frames = MAX_FRAMES): Trace {
  const { w, roster } = b;
  const [p, d] = w.fighters;
  const t: Trace = {
    atkRecover: null,
    defRecover: null,
    firstActive: null,
    lastActive: null,
    projectile: false,
    hitDef: null,
    hits: 0,
    guards: 0,
    minPower: startPower,
    maxPower: startPower,
    knockdown: false,
    invincible: [],
  };
  let n = 0;
  let defLost = false;
  for (let guard = 0; guard < frames * 4 && n < frames; guard++) {
    const frozen = w.superPause > 0;
    const projBefore = w.projectiles.filter((pr) => pr.owner === 0).length;
    stepWorld(w, [0, dummyInput], roster);
    if (frozen) continue;
    n++;
    for (const e of w.events) {
      if (e.side !== 0) continue;
      if (e.kind === "hit") t.hits++;
      else if (e.kind === "guard") t.guards++;
    }
    t.minPower = Math.min(t.minPower, p.power);
    t.maxPower = Math.max(t.maxPower, p.power);
    if (p.notHitBy > 0 && t.atkRecover === null) t.invincible.push(n);

    const mine = w.projectiles.filter((pr) => pr.owner === 0);
    const spawned = mine.length > projBefore;
    if (spawned && t.atkRecover === null) {
      t.projectile = true;
      if (t.firstActive === null) t.firstActive = n;
      t.hitDef ??= mine[mine.length - 1].hitDef;
    }
    if (t.atkRecover === null && clsn1Armed(b, p)) {
      if (t.firstActive === null || !t.projectile) {
        t.firstActive ??= n;
        t.lastActive = n;
      }
      t.hitDef ??= p.hitDef;
    }
    if (t.atkRecover === null && p.ctrl) t.atkRecover = n;
    if (!d.ctrl) defLost = true;
    if (d.stateType === "L") t.knockdown = true;
    if (defLost && t.defRecover === null && d.ctrl && d.stateType !== "L") t.defRecover = n;
    const projectilesDone = !w.projectiles.some((pr) => pr.owner === 0);
    if (t.atkRecover !== null && (t.defRecover !== null || !defLost) && projectilesDone) break;
  }
  return t;
}

function levelOf(hd: HitDefState | null): HitLevel | null {
  if (!hd) return null;
  const g = hd.guardFlag;
  const high = g.includes("H") || g.includes("M");
  const low = g.includes("L") || g.includes("M");
  if (high && low) return "médio";
  if (high) return "alto";
  if (low) return "baixo";
  return "imbloqueável";
}

function ranges(frames: number[]): string | null {
  if (!frames.length) return null;
  const out: string[] = [];
  let start = frames[0];
  let prev = frames[0];
  for (const f of [...frames.slice(1), Number.NaN]) {
    if (f === prev + 1) {
      prev = f;
      continue;
    }
    out.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = prev = f;
  }
  return out.join(",");
}

/**
 * Mede um golpe. `dummy` é o personagem que apanha (padrão: o próprio).
 * Os três mundos (vazio, acerto, defesa) são independentes.
 */
export function measureMove(roster: Roster, charId: string, m: MoveInfo, dummy = charId): FrameData {
  const power = Math.max(m.powerRequired, 0) + 1000;

  // vazio: boneco longe
  const whiffB = bench(roster, charId, dummy, FAR);
  if (m.stance === "A") jump(whiffB);
  // no vazio nada acerta o boneco (projéteis voam até sumir)
  whiffB.w.fighters[1].notHitBy = MAX_FRAMES * 8;
  const startPower = power;
  enter(whiffB, m, startPower);
  const whiff = run(whiffB, 0, startPower);

  const startup = whiff.firstActive;
  const active = startup !== null && !whiff.projectile && whiff.lastActive !== null ? whiff.lastActive - startup + 1 : null;
  const air = m.stance === "A";
  const total = air ? null : whiff.atkRecover;
  const recovery = total !== null && startup !== null ? total - (startup + (active ?? 1) - 1) : null;
  const level = levelOf(whiff.hitDef);

  let onHit: number | null = null;
  let onBlock: number | null = null;
  let damage = 0;
  let chip = 0;
  let hits = 0;
  let knockdown = false;
  let distance: number | null = null;
  if (!air && startup !== null) {
    // do encostado para longe, até o golpe acertar o boneco parado
    let dist = 1;
    for (let tries = 0; tries < 40; tries++) {
      const hitB = bench(roster, charId, dummy, dist);
      const [a, d] = hitB.w.fighters;
      const gap = Math.round(d.x - a.x);
      const life0 = d.life;
      enter(hitB, m, power);
      const hit = run(hitB, 0, power);
      if (hit.hits > 0) {
        distance = gap;
        damage = life0 - d.life;
        hits = hit.hits;
        knockdown = hit.knockdown;
        if (hit.atkRecover !== null && hit.defRecover !== null) onHit = hit.defRecover - hit.atkRecover;
        break;
      }
      dist = gap + RANGE_STEP;
      if (dist > FAR) break;
    }

    if (level !== "imbloqueável" && distance !== null) {
      const blockB = bench(roster, charId, dummy, distance);
      const d = blockB.w.fighters[1];
      const raw = holdBack(d, level === "baixo");
      const lifeB = d.life;
      enter(blockB, m, power);
      const block = run(blockB, raw, power);
      chip = lifeB - d.life;
      if (block.guards > 0 && block.hits === 0 && block.atkRecover !== null && block.defRecover !== null) onBlock = block.defRecover - block.atkRecover;
    }
  }

  return {
    state: m.state,
    name: m.name,
    command: commandLabel(m),
    kind: m.kind,
    stance: m.stance,
    startup,
    active,
    recovery,
    total,
    projectile: whiff.projectile,
    onHit,
    onBlock,
    knockdown,
    distance,
    damage,
    chip,
    hits,
    level,
    meterCost: Math.max(0, startPower - whiff.minPower),
    meterRequired: m.powerRequired,
    meterGain: Math.max(0, whiff.maxPower - startPower),
    invincible: ranges(whiff.invincible),
  };
}

export interface CharacterFrameData {
  id: string;
  name: string;
  moves: FrameData[];
}

/** Frame data de todos os golpes de um personagem já carregado em `roster`. */
export function characterFrameData(roster: Roster, pack: CharacterPack, dummy = pack.id): CharacterFrameData {
  const ch = roster[pack.id];
  return { id: pack.id, name: ch.displayName, moves: listMoves(pack, ch).map((m) => measureMove(roster, pack.id, m, dummy)) };
}

// ------------------------------------------------------------- texto

const sign = (v: number | null) => (v === null ? "—" : v > 0 ? `+${v}` : `${v}`);
const num = (v: number | null) => (v === null ? "—" : `${v}`);

/** Tabela Markdown de um personagem. */
export function frameDataMarkdown(fd: CharacterFrameData, dummyName?: string): string {
  const head = [
    `# ${fd.name} — frame data`,
    "",
    "> Gerado por `npm run framedata` (scripts/framedata) simulando a engine. Não edite à mão.",
    `> Boneco: ${dummyName ?? fd.name}, parado no centro, colado no atacante (acerto/defesa) ou longe (vazio).`,
    "> Vantagem = quadro em que o boneco volta a agir − quadro em que o atacante volta a agir (positivo = atacante primeiro).",
    "> KD = derruba (vantagem contada até o boneco levantar). Golpes aéreos: vantagem depende da altura do pulo (não medida).",
    "> \"—\" no acerto/defesa = o golpe não encosta no boneco em pé (ou defendendo) a nenhuma distância, ou não ataca.",
    "> Barra: −N = custo; +N = ganho só por usar o golpe (sem acertar). Dist. = distância entre os eixos em que o acerto foi medido.",
    "",
  ];
  const rows = [
    "| Golpe | Comando | Estado | Startup | Ativos | Recup. | Total | Acerto | Defesa | Dano | Defesa (dano) | Acertos | Nível | Barra | Invencível | Dist. |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---|---:|",
  ];
  for (const kind of ["normal", "especial", "super"] as const) {
    const list = fd.moves.filter((m) => m.kind === kind);
    if (!list.length) continue;
    rows.push(`| **${kind === "normal" ? "Normais" : kind === "especial" ? "Especiais" : "Supers"}** | | | | | | | | | | | | | | | |`);
    for (const m of list) {
      const meter = m.meterCost > 0 ? `−${m.meterCost}` : m.meterGain > 0 ? `+${m.meterGain}` : "0";
      rows.push(
        `| ${m.name} | \`${m.command}\` | ${m.state} | ${num(m.startup)} | ${m.projectile ? "proj." : num(m.active)} | ${num(m.recovery)} | ${num(m.total)} | ${sign(m.onHit)}${m.knockdown ? " KD" : ""} | ${sign(m.onBlock)} | ${m.damage} | ${m.chip} | ${m.hits} | ${m.level ?? "—"} | ${meter} | ${m.invincible ?? "—"} | ${num(m.distance)} |`,
      );
    }
  }
  return `${[...head, ...rows].join("\n")}\n`;
}
