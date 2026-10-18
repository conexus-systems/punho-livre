/**
 * Áudio no navegador (WebAudio): o PCM sintetizado vira AudioBuffer direto,
 * sem WAV. O contexto só começa a tocar depois do primeiro toque/tecla
 * (regra dos navegadores); `unlock()` cuida disso.
 */

import type { AudioBackend } from "./director";
import { music, SAMPLE_RATE, sfx, type SfxName } from "./synth";

export class WebAudio implements AudioBackend {
  private ctx: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private musicSrc: AudioBufferSourceNode | null = null;
  private musicGain: GainNode | null = null;

  /** Cria/retoma o contexto; chame num toque ou tecla. */
  unlock(): void {
    if (typeof window === "undefined") return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx ??= new Ctor();
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private buffer(key: string, make: () => Float32Array): AudioBuffer | null {
    if (!this.ctx) return null;
    let b = this.buffers.get(key);
    if (!b) {
      const pcm = make();
      b = this.ctx.createBuffer(1, pcm.length, SAMPLE_RATE);
      b.copyToChannel(pcm as Float32Array<ArrayBuffer>, 0);
      this.buffers.set(key, b);
    }
    return b;
  }

  private start(b: AudioBuffer, volume: number, loop = false): [AudioBufferSourceNode, GainNode] | null {
    if (!this.ctx) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = b;
    src.loop = loop;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(this.ctx.destination);
    src.start();
    return [src, gain];
  }

  playSfx(name: SfxName, volume: number): void {
    const b = this.buffer(`sfx:${name}`, () => sfx(name));
    if (b) this.start(b, volume * 0.8);
  }

  playClip(key: string, uri: string, volume: number): void {
    if (!this.ctx) return;
    const hit = this.buffers.get(`clip:${key}`);
    if (hit) {
      this.start(hit, volume);
      return;
    }
    const ctx = this.ctx;
    void fetch(uri)
      .then((r) => r.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .then((b) => {
        this.buffers.set(`clip:${key}`, b);
        this.start(b, volume);
      })
      .catch(() => undefined);
  }

  playMusic(stageId: string, volume: number): void {
    this.stopMusic();
    const b = this.buffer(`music:${stageId}`, () => music(stageId));
    if (!b) return;
    const started = this.start(b, volume, true);
    if (started) [this.musicSrc, this.musicGain] = started;
  }

  stopMusic(): void {
    try {
      this.musicSrc?.stop();
    } catch {
      // já parado
    }
    this.musicSrc = null;
    this.musicGain = null;
  }

  setMusicVolume(volume: number): void {
    if (this.musicGain) this.musicGain.gain.value = volume;
  }
}
