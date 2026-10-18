/**
 * Transforma o que acontece na luta em som: eventos do mundo (golpe, defesa,
 * K.O., MAX...), mudanças de estado (pulo, pouso, golpe começando) e PlaySnd
 * dos personagens importados. Não toca nada sozinho: chama o `AudioBackend`
 * da plataforma (app: expo-audio; web: WebAudio).
 */

import type { CharacterData, GameEvent, WorldState } from "@/src/engine/types";

import type { SfxName } from "./synth";

export interface AudioBackend {
  playSfx(name: SfxName, volume: number): void;
  /** Som de um personagem importado (data URI WAV do pack). */
  playClip(key: string, uri: string, volume: number): void;
  playMusic(stageId: string, volume: number): void;
  stopMusic(): void;
  setMusicVolume(volume: number): void;
}

export interface AudioPrefs {
  music: boolean;
  sfx: boolean;
}

/** Sons comuns do MUGEN (fight.snd, prefixo "F") mapeados para os nossos. */
function commonSound(group: number, index: number): SfxName | null {
  if (group === 5) return index <= 0 ? "hitLight" : index === 1 ? "hitMedium" : "hitHard";
  if (group === 6) return "guard";
  if (group === 7) return "land";
  if (group === 40) return "jump";
  if (group === 52) return "land";
  if (group === 0) return "whoosh";
  return null;
}

export class AudioDirector {
  private last: number[] = [];
  private musicFor: string | null = null;

  constructor(
    private readonly backend: AudioBackend,
    private prefs: AudioPrefs = { music: true, sfx: true },
  ) {}

  setPrefs(prefs: AudioPrefs): void {
    this.prefs = prefs;
    if (!prefs.music) this.stopMusic();
  }

  startMusic(stageId: string): void {
    if (!this.prefs.music || this.musicFor === stageId) return;
    this.musicFor = stageId;
    this.backend.playMusic(stageId, 0.5);
  }

  stopMusic(): void {
    this.musicFor = null;
    this.backend.stopMusic();
  }

  /** Música mais baixa durante pausas e painéis. */
  duck(on: boolean): void {
    if (this.musicFor) this.backend.setMusicVolume(on ? 0.15 : 0.5);
  }

  private play(name: SfxName, volume = 1): void {
    if (this.prefs.sfx) this.backend.playSfx(name, volume);
  }

  /** Chamado uma vez por frame simulado, com os eventos desse frame. */
  update(world: WorldState, events: GameEvent[], roster: Record<string, CharacterData>): void {
    if (!this.prefs.sfx) {
      this.last = world.fighters.map((f) => f.stateNo);
      return;
    }
    for (const e of events) {
      switch (e.kind) {
        case "hit":
          this.play(e.level >= 2 ? "hitHard" : e.level === 1 ? "hitMedium" : "hitLight");
          break;
        case "guard":
          this.play("guard", 0.8);
          break;
        case "ko":
          this.play("ko");
          break;
        case "round":
          this.play("gong", 0.8);
          break;
        case "fight":
          this.play("fight");
          break;
        case "super":
          this.play("super");
          break;
        case "max":
          this.play("powerup");
          break;
        case "counter":
          this.play("counter");
          break;
        case "justdefend":
          this.play("justdefend");
          break;
        case "guardcrush":
          this.play("guardcrush");
          break;
        case "throw":
          this.play("grab");
          break;
        case "tech":
          this.play("tech");
          break;
        case "sound": {
          if (!e.snd) break;
          if (e.common) {
            const name = commonSound(e.snd[0], e.snd[1]);
            if (name) this.play(name, 0.8);
            break;
          }
          const key = `${e.snd[0]},${e.snd[1]}`;
          const uri = e.charId ? roster[e.charId]?.sounds?.[key] : undefined;
          if (uri) this.backend.playClip(`${e.charId}:${key}`, uri, 0.9);
          break;
        }
      }
    }
    // pulo, pouso, golpes e projéteis saindo: pelas trocas de estado
    world.fighters.forEach((f, i) => {
      const prev = this.last[i];
      if (prev !== undefined && prev !== f.stateNo) {
        if (f.stateNo === 40) this.play("jump", 0.6);
        else if (f.stateNo === 52) this.play("land", 0.6);
        else if (f.moveType === "A" && f.stateNo >= 200 && f.stateNo < 1000) this.play("whoosh", 0.5);
        else if (f.stateNo >= 1000 && f.stateNo < 3000) this.play("whoosh", 0.7);
      }
    });
    if (world.projectiles.some((p) => p.age === 1)) this.play("projectile", 0.6);
    this.last = world.fighters.map((f) => f.stateNo);
  }
}
