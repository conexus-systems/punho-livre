/**
 * Tipos da engine. Tudo que entra em `WorldState` é dado puro (números,
 * strings, arrays, objetos simples) para poder ser clonado a cada frame pelo
 * rollback do netcode. Dados imutáveis do personagem ficam em `CharacterData`.
 */

import type { Expr } from "./expr";

export type StateType = "S" | "C" | "A" | "L";
export type MoveType = "I" | "A" | "H";
export type Physics = "S" | "C" | "A" | "N";

export interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface AnimFrame {
  group: number;
  index: number;
  ox: number;
  oy: number;
  /** -1 = infinito */
  time: number;
  flipH: boolean;
  flipV: boolean;
  clsn1: Box[];
  clsn2: Box[];
}

export interface Animation {
  id: number;
  frames: AnimFrame[];
  loopStart: number;
  /** Soma dos tempos dos frames finitos. */
  totalTime: number;
  /** Algum frame tem tempo -1. */
  infinite: boolean;
  /** Tick (desde o início) em que cada elemento começa. */
  starts: number[];
}

// ---------------------------------------------------------------- comandos

export const Key = {
  U: 1,
  D: 2,
  B: 4,
  F: 8,
  a: 16,
  b: 32,
  c: 64,
  x: 128,
  y: 256,
  z: 512,
  s: 1024,
} as const;

export const DIR_MASK = 15;
export const BUTTON_MASK = 2032;

export interface CommandElement {
  /** Bits relativos (U/D/B/F/botões) que compõem o elemento. */
  keys: number;
  /** Direção do elemento (0 se só botões). */
  dir: number;
  /** Botões do elemento. */
  buttons: number;
  hold: boolean; // "/"
  release: boolean; // "~"
  releaseTime: number;
  anyDir: boolean; // "$"
  strict: boolean; // ">"
}

export interface CommandDef {
  name: string;
  elements: CommandElement[];
  time: number;
  bufferTime: number;
}

// --------------------------------------------------------------- estados

export interface Controller {
  type: string;
  label: string;
  /** triggerall: todos precisam ser verdadeiros. */
  triggerAll: Expr[];
  /** trigger1..N: dentro do mesmo N é AND; entre Ns é OR. */
  triggers: Expr[][];
  /** Parâmetros como expressões (valor dividido por vírgulas de topo). */
  params: Record<string, Expr[]>;
  /** Parâmetros crus (flags como `attr`, `hitflag`, `guardflag`). */
  raw: Record<string, string>;
  persistent: number;
  ignoreHitPause: boolean;
  /** Índice único dentro do estado, usado para `persistent`. */
  index: number;
  /** Chave "estado:índice" em `FighterState.fired` (montada uma vez, no primeiro uso). */
  firedKey?: string;
}

export interface StateDef {
  no: number;
  type?: StateType;
  moveType?: MoveType;
  physics?: Physics;
  anim?: Expr;
  velset?: Expr[];
  ctrl?: Expr;
  powerAdd?: Expr;
  faceP2?: Expr;
  hitDefPersist: boolean;
  moveHitPersist: boolean;
  controllers: Controller[];
}

export interface CharacterStyle {
  /** Cores usadas pelo renderizador vetorial quando não há sprites. */
  body: string;
  accent: string;
  skin: string;
  trim: string;
  /** Efeito dos golpes especiais. */
  energy: string;
}

export interface SpriteSheet {
  /** Uma ou mais páginas PNG (URL https ou data URI). */
  atlas: string | string[];
  /** Pixels do atlas por unidade do MUGEN (padrão 1, como no MUGEN). */
  scale?: number;
  /** "grupo,índice" → [x, y, w, h, axisX, axisY, página?] */
  frames: Record<string, number[]>;
}

export interface CharacterData {
  id: string;
  name: string;
  displayName: string;
  author: string;
  version: string;
  /** Constantes de [Data]/[Size]/[Velocity]/[Movement] achatadas: "velocity.walk.fwd.x". */
  consts: Record<string, number>;
  anims: Record<number, Animation>;
  states: Record<number, StateDef>;
  commands: CommandDef[];
  style: CharacterStyle;
  sprites: SpriteSheet | null;
  /** Controladores não suportados encontrados ao carregar (para diagnóstico). */
  unsupported: string[];
}

// ------------------------------------------------------------ estado vivo

export interface GetHitVars {
  damage: number;
  hitTime: number;
  slideTime: number;
  ctrlTime: number;
  xvel: number;
  yvel: number;
  yaccel: number;
  fall: number;
  fallXVel: number;
  fallYVel: number;
  fallRecover: number;
  animType: number;
  groundType: number;
  airType: number;
  guarded: number;
  hitCount: number;
  /** Ticks restantes de hitstun (descontado fora do hitpause). */
  hitTimeLeft: number;
}

export interface HitDefState {
  attrState: string; // "S" | "C" | "A" combinados
  attrKind: string; // "NA", "SP", "HT"...
  damage: number;
  guardDamage: number;
  animType: number;
  airAnimType: number;
  guardFlag: string;
  hitFlag: string;
  pauseP1: number;
  pauseP2: number;
  guardPauseP1: number;
  guardPauseP2: number;
  groundType: number;
  airType: number;
  groundSlideTime: number;
  groundHitTime: number;
  guardSlideTime: number;
  guardHitTime: number;
  guardCtrlTime: number;
  groundVelX: number;
  groundVelY: number;
  guardVelX: number;
  airVelX: number;
  airVelY: number;
  airGuardVelX: number;
  airGuardVelY: number;
  airHitTime: number;
  airFall: number;
  fall: number;
  fallXVel: number;
  fallYVel: number;
  fallRecover: number;
  yaccel: number;
  getPower: number;
  givePower: number;
  p1StateNo: number;
  kill: boolean;
  guardKill: boolean;
  /** Intensidade visual do impacto 0..2 (light/medium/hard). */
  sparkLevel: number;
}

export interface FighterState {
  side: 0 | 1;
  charId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  life: number;
  lifeMax: number;
  power: number;
  powerMax: number;
  stateNo: number;
  prevStateNo: number;
  stateTime: number;
  stateType: StateType;
  moveType: MoveType;
  physics: Physics;
  ctrl: boolean;
  anim: number;
  animElem: number;
  animElemTime: number;
  animTick: number;
  hitDef: HitDefState | null;
  /** HitDef armado e ainda sem contato. */
  hitDefActive: boolean;
  moveContact: number;
  moveHit: number;
  moveGuarded: number;
  hitPause: number;
  getHit: GetHitVars;
  /** Controladores `persistent = 0` já disparados neste estado ("estado:índice"). */
  fired: Record<string, number>;
  vars: number[];
  fvars: number[];
  sysvars: number[];
  sysfvars: number[];
  /** Histórico circular de entradas relativas (Key bits). */
  inputs: number[];
  inputHead: number;
  /** Último input absoluto (U/D/L/R/botões) — usado para movimentos internos. */
  rawInput: number;
  /** Comando → último frame em que ainda está ativo. */
  cmdActive: Record<string, number>;
  /** Hits sofridos no combo atual. */
  comboHits: number;
  comboDamage: number;
  notHitBy: number;
  roundsWon: number;
  attackMul: number;
  defenceMul: number;
  // ---- sistema SNK (ver snk.ts)
  /** Ticks restantes do modo MAX (0 = desligado). */
  maxTime: number;
  /** Duração total do MAX atual (para a barra do HUD). */
  maxTotal: number;
  /** Medidor de defesa: chega a 0 → guard crush. */
  guardMeter: number;
  /** Ticks até o medidor de defesa voltar a encher. */
  guardRegenDelay: number;
  /** Arremesso em andamento: 1 para frente, -1 para trás (0 = nenhum). */
  throwDir: number;
}

export interface ProjectileState {
  id: number;
  projId: number;
  owner: 0 | 1;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  facing: 1 | -1;
  anim: number;
  hitAnim: number;
  animElem: number;
  animElemTime: number;
  animTick: number;
  removeTime: number;
  age: number;
  hitDef: HitDefState;
  /** "flying" → "hit" (tocando projhitanim) → removido. */
  phase: "flying" | "hit";
  hitTicksLeft: number;
}

export type GameEventKind =
  | "hit"
  | "guard"
  | "ko"
  | "round"
  | "fight"
  | "super"
  /** Sistema SNK: textos e efeitos do HUD. */
  | "counter"
  | "justdefend"
  | "guardcrush"
  | "max"
  | "guardcancel"
  | "throw"
  | "tech";

export interface GameEvent {
  kind: GameEventKind;
  x: number;
  y: number;
  side: 0 | 1;
  level: number;
  frame: number;
}

/**
 * RoundState como no MUGEN: 0 pré-intro, 1 intro, 2 luta, 3 pré-fim (KO/tempo), 4 fim.
 */
export interface WorldState {
  frame: number;
  rng: number;
  roundNo: number;
  roundState: 0 | 1 | 2 | 3 | 4;
  roundStateTime: number;
  /** Ticks restantes do relógio (99 s × 60). -1 = infinito. */
  timer: number;
  /** Duração do round em ticks (-1 = infinito). */
  roundTicks: number;
  /** Modo treino: vida/barra regeneram e não há KO. */
  training: boolean;
  fighters: [FighterState, FighterState];
  projectiles: ProjectileState[];
  nextProjectileId: number;
  roundsToWin: number;
  /** -1 em andamento, 0/1 vencedor, 2 empate. */
  roundWinner: -1 | 0 | 1 | 2;
  matchWinner: -1 | 0 | 1 | 2;
  cameraX: number;
  /** Pausa de super (congela o mundo, exceto quem a iniciou). */
  superPause: number;
  superPauseOwner: -1 | 0 | 1;
  events: GameEvent[];
  stageId: string;
  /** Batalha de equipes (KOF): null no 1 contra 1. */
  teams: [TeamState, TeamState] | null;
}

export interface TeamState {
  /** Ids dos personagens, na ordem de entrada. */
  members: string[];
  /** Índice de quem está lutando (= quantos já caíram). */
  index: number;
}

export interface MatchConfig {
  chars: [string, string];
  stageId: string;
  seed: number;
  roundsToWin: number;
  /** Segundos por round; -1 infinito (treino). */
  roundTime: number;
  /** Treino: vida regenera, sem KO. */
  training?: boolean;
  /**
   * Batalha de equipes estilo KOF (eliminação): cada lado entra com até 3
   * lutadores; quem vence fica com a vida que tinha (mais uma recuperação) e
   * quem perde é substituído pelo próximo. `chars` é ignorado quando presente.
   */
  teams?: [string[], string[]];
}
