/**
 * Áudio no aparelho (expo-audio). Os sons são sintetizados uma vez e gravados
 * como WAV no cache do app; cada efeito tem alguns tocadores em rodízio para
 * poder se sobrepor (vários golpes seguidos).
 */

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { Directory, File, Paths } from "expo-file-system";

import type { AudioBackend } from "./director";
import { music, sfx, SFX_NAMES, toWav, type SfxName } from "./synth";

const VOICES = 3;

function cacheDir(): Directory {
  const dir = new Directory(Paths.cache, "audio");
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function wavFile(name: string, make: () => Float32Array): string {
  const file = new File(cacheDir(), `${name}.wav`);
  if (!file.exists) file.writeSync(toWav(make()));
  return file.uri;
}

function dataUriFile(key: string, uri: string): string {
  const safe = key.replace(/[^a-z0-9_,-]/gi, "_");
  const file = new File(cacheDir(), `clip-${safe}.wav`);
  if (!file.exists) {
    const b64 = uri.slice(uri.indexOf(",") + 1);
    const bin = globalThis.atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    file.writeSync(bytes);
  }
  return file.uri;
}

export class NativeAudio implements AudioBackend {
  private pools = new Map<string, { players: AudioPlayer[]; next: number }>();
  private music: AudioPlayer | null = null;

  async init(): Promise<void> {
    await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers" }).catch(() => undefined);
    // efeitos prontos antes da primeira luta
    for (const name of SFX_NAMES) this.pool(name, () => wavFile(`sfx-${name}`, () => sfx(name)));
  }

  private pool(key: string, uri: () => string) {
    let p = this.pools.get(key);
    if (!p) {
      const u = uri();
      p = { players: Array.from({ length: VOICES }, () => createAudioPlayer({ uri: u })), next: 0 };
      this.pools.set(key, p);
    }
    return p;
  }

  private fire(key: string, uri: () => string, volume: number): void {
    try {
      const p = this.pool(key, uri);
      const player = p.players[p.next];
      p.next = (p.next + 1) % p.players.length;
      player.volume = volume;
      void player.seekTo(0);
      player.play();
    } catch {
      // som é enfeite: falha não para a luta
    }
  }

  playSfx(name: SfxName, volume: number): void {
    this.fire(name, () => wavFile(`sfx-${name}`, () => sfx(name)), volume);
  }

  playClip(key: string, uri: string, volume: number): void {
    this.fire(`clip:${key}`, () => dataUriFile(key, uri), volume);
  }

  playMusic(stageId: string, volume: number): void {
    this.stopMusic();
    try {
      const uri = wavFile(`music-${stageId}-v1`, () => music(stageId));
      const player = createAudioPlayer({ uri });
      player.loop = true;
      player.volume = volume;
      player.play();
      this.music = player;
    } catch {
      this.music = null;
    }
  }

  stopMusic(): void {
    if (!this.music) return;
    try {
      this.music.pause();
      this.music.remove();
    } catch {
      // já liberado
    }
    this.music = null;
  }

  setMusicVolume(volume: number): void {
    if (this.music) this.music.volume = volume;
  }
}
