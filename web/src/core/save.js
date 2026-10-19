'use strict';
// Salvamento local (ajustes, progresso da História e recordes). Fica no
// armazenamento do aparelho; se ele não estiver disponível, o jogo funciona
// normalmente e só não lembra de nada.

const SAVE_KEY = 'punho.save';

const SAVE_DEFAULTS = {
  settings: { sfx: 8, music: 6, touchOpacity: 6, touchScale: 10, difficulty: 1, vibrate: 1, name: '' },
  progress: { storyBest: 0, storyClears: 0, fights: 0, wins: 0, kos: 0, seconds: 0, bestChars: {} },
};

const Save = {
  data: null,

  load() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { /* sem armazenamento */ }
    const d = JSON.parse(JSON.stringify(SAVE_DEFAULTS));
    if (raw && typeof raw === 'object') {
      for (const k of Object.keys(d.settings)) if (raw.settings && typeof raw.settings[k] === typeof d.settings[k]) d.settings[k] = raw.settings[k];
      for (const k of Object.keys(d.progress)) if (raw.progress && typeof raw.progress[k] === typeof d.progress[k]) d.progress[k] = raw.progress[k];
    }
    this.data = d;
    return d;
  },

  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { /* ignora */ }
  },

  get settings() { return (this.data || this.load()).settings; },
  get progress() { return (this.data || this.load()).progress; },

  resetProgress() {
    this.data.progress = JSON.parse(JSON.stringify(SAVE_DEFAULTS.progress));
    this.save();
  },

  // aplica os ajustes ao resto do jogo (som, dificuldade e botões de toque)
  apply() {
    const s = this.settings;
    Sound.setVolumes(s.sfx / 10, s.music / 10);
    Game.difficulty = s.difficulty;
    const root = document.documentElement.style;
    root.setProperty('--touch-opacity', String(0.25 + (s.touchOpacity / 10) * 0.75));
    root.setProperty('--touch-scale', String(0.7 + (s.touchScale / 10) * 0.3));
  },

  // registra o resultado de uma luta dos jogadores humanos
  record(rows, seconds) {
    const p = this.progress;
    const mine = rows.filter((r) => r.human);
    if (!mine.length) return;
    p.fights++;
    p.seconds += Math.round(seconds);
    for (const r of mine) {
      p.kos += r.kill || 0;
      if (r.win) { p.wins++; if (r.charId) p.bestChars[r.charId] = (p.bestChars[r.charId] || 0) + 1; }
    }
    this.save();
  },
};

// vibração curta ao levar dano, se o aparelho tiver
function buzz(ms) {
  if (Save.settings.vibrate && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignora */ } }
}
