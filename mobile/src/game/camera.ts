/**
 * Câmera da luta (só apresentação: fica fora do stepWorld e do WorldState).
 *
 * - segue os dois lutadores com suavização (a câmera da engine, `cameraX`, é o
 *   alvo: ela já respeita as bordas do cenário);
 * - zoom leve conforme a distância (perto = mais perto), que relaxa quando
 *   alguém pula alto para ninguém sair da tela;
 * - "punch" de zoom no golpe forte, especial, super, contra-ataque e K.O.,
 *   puxando um pouco para o ponto do impacto;
 * - tremor de tela com decaimento, proporcional à intensidade do evento.
 *
 * Determinística: `update` roda uma vez por quadro simulado com os eventos do
 * quadro, e o tremor usa um PRNG semeado pelo número do quadro (nada de
 * Math.random ou relógio). O mesmo histórico de quadros dá a mesma câmera —
 * replays e o online ficam iguais na tela também. Com "Reduzir movimento" não
 * há tremor, punch nem zoom por distância.
 */

import type { GameEvent, WorldState } from "@/src/engine/types";

// --------------------------------------------------------- ajustes
/** Fração do caminho até o alvo andada por quadro (x da câmera). */
export const CAM_FOLLOW = 0.22;
/** Suavização do zoom por distância. */
export const CAM_ZOOM_FOLLOW = 0.08;
/** Zoom com os lutadores colados / longe (≥ CAM_FAR). */
export const CAM_ZOOM_NEAR = 1.12;
export const CAM_ZOOM_FAR = 1.0;
export const CAM_NEAR = 50;
export const CAM_FAR = 220;
/** Teto absoluto do zoom (base × punch). */
export const CAM_ZOOM_MAX = 1.3;
/** Pula direto para o alvo se estiver mais longe que isso (troca de round). */
export const CAM_SNAP = 120;
/** Tremor máximo (unidades do mundo) com trauma 1; o tremor é trauma². */
export const SHAKE_MAX = 9;
/** Quanto o trauma cai por quadro. */
export const TRAUMA_DECAY = 0.04;
/** Quanto o punch de zoom encolhe por quadro. */
export const PUNCH_DECAY = 0.84;

/** Trauma (tremor) por nível do golpe: fraco, médio, forte, especial, super. */
export const TRAUMA_BY_LEVEL = [0.18, 0.28, 0.42, 0.5, 0.6] as const;
/** Punch de zoom por nível do golpe (fraco e médio não têm). */
export const PUNCH_BY_LEVEL = [0, 0, 0.035, 0.05, 0.07] as const;
export const TRAUMA_GUARD = 0.12;
export const TRAUMA_COUNTER = 0.25;
export const PUNCH_COUNTER = 0.05;
export const TRAUMA_GUARD_CRUSH = 0.55;
export const PUNCH_GUARD_CRUSH = 0.05;
export const TRAUMA_KO = 0.85;
export const PUNCH_KO = 0.1;
export const PUNCH_SUPER = 0.08;
export const TRAUMA_MAX_MODE = 0.35;

/** Transformação final do quadro, em pixels da tela. */
export interface CameraView {
  /** x do mundo no centro (antes do zoom). */
  x: number;
  /** Escala aplicada em volta de (pivotX, pivotY). */
  zoom: number;
  pivotX: number;
  pivotY: number;
  /** Deslocamento do tremor em pixels. */
  shakeX: number;
  shakeY: number;
}

/** Geometria do renderer: pixels por unidade e linha do chão na tela. */
export interface Viewport {
  width: number;
  height: number;
  /** Pixels por unidade do mundo (zoom 1). */
  k: number;
  /** y da tela onde fica o chão (y = 0 do mundo). */
  groundPx: number;
  /** Faixa do HUD no topo (px): cabeças não devem passar dela. */
  hudPx: number;
}

/** Hash inteiro → [0, 1). Determinístico, sem estado. */
export function noise(frame: number, salt: number): number {
  let h = Math.imul(frame | 0, 0x9e3779b1) ^ Math.imul(salt | 0, 0x85ebca6b);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export class FightCamera {
  /** Sem tremor, punch nem zoom por distância. */
  reduceMotion = false;
  x = 0;
  /** Zoom por distância (suavizado). */
  zoom = 1;
  /** Punch de zoom (somado ao zoom, decai rápido). */
  punch = 0;
  /** Ponto (mundo) para onde o punch puxa. */
  focusX = 0;
  focusY = -60;
  trauma = 0;
  /** Quadro do mundo da última atualização (semente do tremor). */
  frame = -1;
  /** Posição dos lutadores no último quadro (para o enquadramento). */
  private fighters: [number, number, number, number] = [0, 0, 0, 0];
  private started = false;

  /** Um quadro simulado: segue os lutadores e reage aos eventos do quadro. */
  update(w: WorldState, events: readonly GameEvent[]): void {
    const [a, b] = w.fighters;
    this.frame = w.frame;
    this.fighters = [a.x, a.y, b.x, b.y];
    const target = w.cameraX;
    const roundStart = w.roundState === 1 && w.roundStateTime <= 1;
    if (!this.started || roundStart || Math.abs(target - this.x) > CAM_SNAP) {
      this.started = true;
      this.x = target;
      this.zoom = this.zoomTarget(Math.abs(a.x - b.x));
      this.punch = 0;
      this.trauma = 0;
    } else {
      this.x += (target - this.x) * CAM_FOLLOW;
      this.zoom += (this.zoomTarget(Math.abs(a.x - b.x)) - this.zoom) * CAM_ZOOM_FOLLOW;
    }

    this.trauma = Math.max(0, this.trauma - TRAUMA_DECAY);
    this.punch *= PUNCH_DECAY;
    if (this.punch < 0.002) this.punch = 0;
    if (this.reduceMotion) {
      this.trauma = 0;
      this.punch = 0;
      return;
    }
    for (const e of events) this.react(e);
  }

  private zoomTarget(dist: number): number {
    if (this.reduceMotion) return 1;
    const t = clamp((dist - CAM_NEAR) / (CAM_FAR - CAM_NEAR), 0, 1);
    return CAM_ZOOM_NEAR + (CAM_ZOOM_FAR - CAM_ZOOM_NEAR) * t;
  }

  private kick(trauma: number, punch: number, x: number, y: number): void {
    this.trauma = Math.min(1, this.trauma + trauma);
    if (punch > this.punch) {
      this.punch = punch;
      this.focusX = x;
      this.focusY = y;
    }
  }

  private react(e: GameEvent): void {
    const lvl = clamp(Math.round(e.level), 0, TRAUMA_BY_LEVEL.length - 1);
    switch (e.kind) {
      case "hit":
        this.kick(TRAUMA_BY_LEVEL[lvl], PUNCH_BY_LEVEL[lvl], e.x, e.y);
        break;
      case "guard":
        this.kick(TRAUMA_GUARD + lvl * 0.02, 0, e.x, e.y);
        break;
      case "counter":
        this.kick(TRAUMA_COUNTER, PUNCH_COUNTER, e.x, e.y);
        break;
      case "guardcrush":
        this.kick(TRAUMA_GUARD_CRUSH, PUNCH_GUARD_CRUSH, e.x, e.y);
        break;
      case "ko":
        this.kick(TRAUMA_KO, PUNCH_KO, e.x, e.y - 50);
        break;
      case "super":
        this.kick(0.15, PUNCH_SUPER, e.x, e.y);
        break;
      case "max":
        this.kick(TRAUMA_MAX_MODE, 0.04, e.x, e.y);
        break;
      default:
        break;
    }
  }

  /**
   * Transformação para a tela. O zoom nunca tira um lutador do quadro (nem
   * enfia a cabeça no HUD) e nunca fica abaixo de 1; com tremor, cresce o
   * mínimo para a borda do cenário não aparecer.
   */
  view(vp: Viewport): CameraView {
    const { width: W, height: H, k, groundPx } = vp;
    const shakeAmp = this.reduceMotion ? 0 : SHAKE_MAX * this.trauma * this.trauma * k;
    // tremor: alterna o lado a cada quadro (lê como vibração) com força variável
    const alt = this.frame % 2 === 0 ? 1 : -1;
    const shakeX = shakeAmp > 0 ? shakeAmp * alt * (0.55 + 0.45 * noise(this.frame, 1)) : 0;
    const shakeY = shakeAmp > 0 ? shakeAmp * 0.6 * (noise(this.frame, 2) * 2 - 1) : 0;

    // pivô: meio do corpo, puxado para o impacto durante o punch
    const pull = this.punch > 0 ? clamp(this.punch / 0.08, 0, 1) * 0.5 : 0;
    const baseX = (x: number) => (x - this.x) * k + W / 2;
    const baseY = (y: number) => groundPx + y * k;
    const pivotX = clamp(W / 2 + (baseX(this.focusX) - W / 2) * pull, W * 0.3, W * 0.7);
    const pivotY = clamp(baseY(-60) + (baseY(this.focusY) - baseY(-60)) * pull, H * 0.35, H * 0.75);

    let zoom = Math.min(CAM_ZOOM_MAX, this.zoom + this.punch);
    // enquadramento: os dois lutadores (com folga) dentro da tela, cabeças abaixo do HUD
    const margin = 34 * k;
    const [ax, ay, bx, by] = this.fighters;
    for (const [fx, fy] of [
      [ax, ay],
      [bx, by],
    ]) {
      const dx = baseX(fx) - pivotX;
      if (dx > 0) zoom = Math.min(zoom, (W - margin - pivotX) / dx);
      else if (dx < 0) zoom = Math.min(zoom, (pivotX - margin) / -dx);
      const dy = baseY(fy - 95) - pivotY; // topo da cabeça
      if (dy < 0) zoom = Math.min(zoom, (pivotY - vp.hudPx) / -dy);
    }
    zoom = Math.max(1, zoom);
    // tremor sem mostrar a borda: (zoom - 1) × distância do pivô à borda ≥ deslocamento
    const reachX = Math.min(pivotX, W - pivotX);
    const reachY = Math.min(pivotY, H - pivotY);
    if (shakeAmp > 0) zoom = Math.max(zoom, 1 + Math.abs(shakeX) / reachX, 1 + Math.abs(shakeY) / reachY);
    return { x: this.x, zoom, pivotX, pivotY, shakeX, shakeY };
  }

  /** Estado completo (testes de determinismo). */
  snapshot(): number[] {
    return [this.x, this.zoom, this.punch, this.focusX, this.focusY, this.trauma, this.frame];
  }
}
