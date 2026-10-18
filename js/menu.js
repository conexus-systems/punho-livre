'use strict';
// Telas: título, seleção de personagens, controles, luta e resultados.

const Game = {
  ctx: null,
  screen: null,
  settings: { diff: 1, cpus: 1, cpuTeam: 0, bg: -1 },
  lastPicks: null,

  init(ctx) {
    this.ctx = ctx;
    this.toTitle();
  },

  setScreen(s) { this.screen = s; },
  toTitle() { this.setScreen(new TitleScreen()); },

  update() {
    if (Keys.hit(['KeyM'])) Sound.muted = !Sound.muted;
    this.screen.update();
  },

  draw() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    this.screen.draw(ctx);
    if (Sound.muted) txt(ctx, 'SOM DESLIGADO (M)', VIEW_W - 10, VIEW_H - 10, { size: 12, align: 'right', color: '#8f93b8' });
  },

  startWorld(mode, opt) {
    const w = new World(opt);
    w.setMode(mode);
    this.setScreen(new BattleScreen(w));
  },

  finishBattle(w, result) { this.setScreen(new ResultsScreen(result)); },
};

function wrapText(ctx, s, x, y, maxW, lineH, o) {
  ctx.font = `${o.weight || ''} ${o.size || 16}px ${o.font || FONT_UI}`;
  const words = s.split(' ');
  let line = '';
  for (const wd of words) {
    const test = line ? line + ' ' + wd : wd;
    if (ctx.measureText(test).width > maxW && line) {
      txt(ctx, line, x, y, o);
      line = wd; y += lineH;
    } else line = test;
  }
  if (line) txt(ctx, line, x, y, o);
  return y + lineH;
}

function drawLogo(ctx, cx, y, scale = 1) {
  ctx.save();
  ctx.translate(cx, y);
  ctx.scale(scale, scale);
  ctx.rotate(-0.04);
  txt(ctx, 'MUGEN', 6, 6, { size: 92, font: FONT_DISPLAY, align: 'center', color: '#b8261e' });
  txt(ctx, 'MUGEN', 0, 0, { size: 92, font: FONT_DISPLAY, align: 'center', color: '#f4f1ff', stroke: '#14121c', strokeW: 10 });
  txt(ctx, 'BRAWL', 64, 66, { size: 58, font: FONT_DISPLAY, align: 'center', color: '#14121c', stroke: '#14121c', strokeW: 12 });
  txt(ctx, 'BRAWL', 60, 62, { size: 58, font: FONT_DISPLAY, align: 'center', color: '#ffb000' });
  ctx.restore();
}

function stripedBackdrop(ctx, t, tint) {
  ctx.fillStyle = '#0f1124';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = tint;
  for (let i = -10; i < 30; i++) {
    const x = i * 60 + (t * 0.4) % 60;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 26, 0); ctx.lineTo(x - 154, VIEW_H); ctx.lineTo(x - 180, VIEW_H); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

class BattleScreen {
  constructor(w) { this.w = w; }
  update() { this.w.update(); }
  draw(ctx) { this.w.draw(ctx); }
}

// ---- título ----

class TitleScreen {
  constructor() {
    this.sel = 0; this.t = 0;
    this.newDemo();
  }

  newDemo() {
    const w = new World({ bg: choice(BG_KEYS), demo: true, stageW: 1100 });
    const keys = PLAYABLE.slice().sort(() => Math.random() - 0.5).slice(0, 3);
    w.setMode(new VSMode(keys.map((k) => ({ key: k, ai: 2 })), () => this.newDemo()));
    this.demo = w;
  }

  items() {
    return ['MODO VS', 'MODO HISTÓRIA', 'SOBREVIVÊNCIA', 'CONTROLES', `SOM: ${Sound.muted ? 'DESLIGADO' : 'LIGADO'}`];
  }

  update() {
    this.t++;
    this.demo.update();
    const n = this.items().length;
    if (anyMenu('up')) { this.sel = (this.sel + n - 1) % n; Sound.play('menu'); }
    if (anyMenu('down')) { this.sel = (this.sel + 1) % n; Sound.play('menu'); }
    if (anyMenu('attack')) {
      Sound.init(); Sound.resume();
      Sound.play('select');
      switch (this.sel) {
        case 0: Game.setScreen(new SelectScreen('vs')); break;
        case 1: Game.setScreen(new SelectScreen('story')); break;
        case 2: Game.setScreen(new SelectScreen('survival')); break;
        case 3: Game.setScreen(new ControlsScreen()); break;
        case 4: Sound.muted = !Sound.muted; break;
      }
    }
  }

  draw(ctx) {
    this.demo.draw(ctx);
    const g = ctx.createLinearGradient(0, 0, VIEW_W, 0);
    g.addColorStop(0, 'rgba(12,13,30,0.92)');
    g.addColorStop(0.55, 'rgba(12,13,30,0.55)');
    g.addColorStop(1, 'rgba(12,13,30,0.1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    drawLogo(ctx, 230, 130);
    txt(ctx, 'Pancadaria 2.5D para 1 ou 2 jogadores', 62, 236, { size: 17, weight: 700, color: '#c9cbe8' });
    this.items().forEach((s, i) => {
      const sel = i === this.sel, y = 300 + i * 42;
      if (sel) {
        ctx.fillStyle = '#ffb000';
        ctx.fillRect(56, y - 27, 290, 36);
      }
      txt(ctx, s, 70, y, { size: 22, font: FONT_DISPLAY, color: sel ? '#14121c' : '#e9ebff' });
    });
    txt(ctx, 'W/S ou ↑/↓ para escolher · J ou Enter para confirmar', 62, VIEW_H - 18, { size: 14, color: '#8f93b8' });
  }
}

// ---- controles ----

class ControlsScreen {
  constructor() { this.t = 0; }

  update() {
    this.t++;
    if (this.t > 5 && (anyMenu('attack') || anyMenu('defend') || anyMenu('jump'))) { Sound.play('back'); Game.toTitle(); }
  }

  draw(ctx) {
    stripedBackdrop(ctx, this.t, '#ffb000');
    txt(ctx, 'CONTROLES', 40, 64, { size: 40, font: FONT_DISPLAY, color: '#ffb000' });
    const col = (x, title, color, rows) => {
      txt(ctx, title, x, 112, { size: 20, font: FONT_DISPLAY, color });
      rows.forEach(([k, v], i) => {
        txt(ctx, k, x, 146 + i * 27, { size: 16, weight: 700, color: '#ffffff' });
        txt(ctx, v, x + 128, 146 + i * 27, { size: 16, color: '#c9cbe8' });
      });
    };
    col(40, '1P', PLAYER_COLORS[0], [['Mover', 'W A S D'], ['Ataque (A)', 'J  ou  F'], ['Pulo (J)', 'K  ou  G'], ['Defesa (D)', 'L  ou  H']]);
    col(330, '2P', PLAYER_COLORS[1], [['Mover', 'Setas'], ['Ataque (A)', 'Num 1  ou  ,'], ['Pulo (J)', 'Num 2  ou  .'], ['Defesa (D)', 'Num 3  ou  /']]);
    col(640, 'GERAL', '#ffb000', [['Pausa', 'Esc  ou  P'], ['Som', 'M'], ['Menus', 'Enter confirma'], ['', 'Esc volta']]);

    const tips = [
      ['Correr', 'toque duas vezes ← ou →'],
      ['Combo', 'A, A, A (o terceiro golpe derruba)'],
      ['Voadora', 'correndo + A  ·  pulo + A no ar'],
      ['Rolamento', 'correndo + D'],
      ['Especiais', 'D, depois direção, depois A ou J  (ex.: D → A)'],
      ['Itens', 'A perto do item pega; A segurando pedra arremessa;'],
      ['', 'correndo ou no ar + A arremessa o bastão. Garrafas curam.'],
      ['Defesa', 'segure D de frente para o golpe. Defesa demais quebra.'],
    ];
    txt(ctx, 'COMO LUTAR', 40, 292, { size: 20, font: FONT_DISPLAY, color: '#ffb000' });
    tips.forEach(([k, v], i) => {
      txt(ctx, k, 40, 324 + i * 25, { size: 15, weight: 700, color: '#ffffff' });
      txt(ctx, v, 168, 324 + i * 25, { size: 15, color: '#c9cbe8' });
    });
    txt(ctx, 'Pressione qualquer botão para voltar', VIEW_W - 30, VIEW_H - 18, { size: 14, align: 'right', color: '#8f93b8' });
  }
}

// ---- seleção de personagens ----

const ROSTER = [...PLAYABLE, 'random'];
const MODE_NAMES = { vs: 'MODO VS', story: 'MODO HISTÓRIA', survival: 'SOBREVIVÊNCIA' };

class SelectScreen {
  constructor(mode) {
    this.mode = mode; this.t = 0; this.phase = 'pick'; this.cfgSel = 0; this.warn = '';
    const prev = Game.lastPicks;
    this.slots = [0, 1].map((p) => ({
      player: p,
      state: p === 0 ? 'char' : (prev && prev[1].joined ? 'char' : 'off'),
      cur: prev ? prev[p].cur : p,
      team: prev ? prev[p].team : 0,
      anim: 0,
    }));
  }

  active() { return this.slots.filter((s) => s.state !== 'off'); }

  update() {
    this.t++;
    for (const s of this.slots) s.anim++;
    if (this.phase === 'pick') this.updatePick();
    else this.updateConfig();
  }

  updatePick() {
    const N = ROSTER.length;
    for (const s of this.slots) {
      const P = (a) => menuPressed(s.player, a);
      if (s.state === 'off') {
        if (P('attack')) { s.state = 'char'; Sound.play('select'); }
        continue;
      }
      const back = P('defend') || P('jump');
      if (s.state === 'char') {
        if (P('left')) { s.cur = (s.cur + N - 1) % N; Sound.play('menu'); s.anim = 0; }
        if (P('right')) { s.cur = (s.cur + 1) % N; Sound.play('menu'); s.anim = 0; }
        if (P('attack')) { s.state = this.mode === 'vs' ? 'team' : 'ready'; Sound.play('select'); }
        else if (back) {
          Sound.play('back');
          if (s.player === 0) { Game.toTitle(); return; }
          s.state = 'off';
        }
      } else if (s.state === 'team') {
        if (P('left')) { s.team = (s.team + 4) % 5; Sound.play('menu'); }
        if (P('right')) { s.team = (s.team + 1) % 5; Sound.play('menu'); }
        if (P('attack')) { s.state = 'ready'; Sound.play('select'); }
        else if (back) { s.state = 'char'; Sound.play('back'); }
      } else if (s.state === 'ready' && back) {
        s.state = this.mode === 'vs' ? 'team' : 'char';
        Sound.play('back');
      }
    }
    const act = this.active();
    if (act.length && act.every((s) => s.state === 'ready')) {
      this.phase = 'config'; this.cfgSel = 0; this.warn = '';
    }
  }

  configItems() {
    const st = Game.settings;
    const diff = { label: 'Dificuldade', value: AI_LEVELS[st.diff].name, change: (d) => { st.diff = clamp(st.diff + d, 0, 2); } };
    if (this.mode !== 'vs') return [diff, { label: 'COMEÇAR!', go: true }];
    const humans = this.active().length;
    st.cpus = clamp(st.cpus, 0, 8 - humans);
    return [
      { label: 'Computadores', value: String(st.cpus), change: (d) => { st.cpus = clamp(st.cpus + d, 0, 8 - humans); } },
      { label: 'Time dos computadores', value: st.cpuTeam ? TEAM_NAMES[st.cpuTeam] : 'Cada um por si', change: (d) => { st.cpuTeam = (st.cpuTeam + d + 5) % 5; } },
      diff,
      { label: 'Cenário', value: st.bg < 0 ? 'Aleatório' : BACKGROUNDS[BG_KEYS[st.bg]].name, change: (d) => { st.bg = ((st.bg + 1 + d + BG_KEYS.length + 1) % (BG_KEYS.length + 1)) - 1; } },
      { label: 'LUTAR!', go: true },
    ];
  }

  updateConfig() {
    const items = this.configItems(), n = items.length;
    const any = (a) => menuPressed(0, a) || menuPressed(1, a);
    if (any('up')) { this.cfgSel = (this.cfgSel + n - 1) % n; Sound.play('menu'); }
    if (any('down')) { this.cfgSel = (this.cfgSel + 1) % n; Sound.play('menu'); }
    const it = items[this.cfgSel];
    if (it.change) {
      if (any('left')) { it.change(-1); Sound.play('menu'); this.warn = ''; }
      if (any('right')) { it.change(1); Sound.play('menu'); this.warn = ''; }
    }
    if (any('attack') && it.go) this.start();
    else if (any('defend') || any('jump')) {
      Sound.play('back');
      this.phase = 'pick';
      for (const s of this.active()) s.state = this.mode === 'vs' ? 'team' : 'char';
    }
  }

  start() {
    const st = Game.settings;
    const act = this.active();
    Game.lastPicks = this.slots.map((s) => ({ cur: s.cur, team: s.team, joined: s.state !== 'off' }));
    const pickKey = (s) => (ROSTER[s.cur] === 'random' ? choice(PLAYABLE) : ROSTER[s.cur]);
    const humans = act.map((s) => ({ key: pickKey(s), player: s.player, team: s.team || undefined }));
    Sound.play('go');
    if (this.mode === 'vs') {
      const all = humans.slice();
      for (let i = 0; i < st.cpus; i++) all.push({ key: choice(PLAYABLE), ai: st.diff, team: st.cpuTeam || undefined });
      const teams = new Set(all.map((f, i) => f.team || 'solo' + i));
      if (all.length < 2 || teams.size < 2) {
        this.warn = 'Precisa de pelo menos dois lados na luta: adicione computadores ou mude os times.';
        Sound.play('back');
        return;
      }
      // humanos e CPUs alternam lados da arena
      const order = [];
      const cpus = all.slice(humans.length);
      for (let i = 0; i < Math.max(humans.length, cpus.length); i++) {
        if (humans[i]) order.push(humans[i]);
        if (cpus[i]) order.push(cpus[i]);
      }
      const bg = st.bg < 0 ? choice(BG_KEYS) : BG_KEYS[st.bg];
      Game.startWorld(new VSMode(order, (w, r) => Game.finishBattle(w, r)), { bg, stageW: 1400 });
    } else if (this.mode === 'story') {
      Game.startWorld(new StoryMode(humans, st.diff), { bg: STORY[0].bg, stageW: SEG_W * 3 });
    } else {
      Game.startWorld(new SurvivalMode(humans, st.diff), { bg: choice(BG_KEYS), stageW: 1400 });
    }
  }

  draw(ctx) {
    stripedBackdrop(ctx, this.t, '#5a7bff');
    txt(ctx, 'ESCOLHA SEU LUTADOR', 30, 52, { size: 32, font: FONT_DISPLAY, color: '#ffffff' });
    txt(ctx, MODE_NAMES[this.mode], VIEW_W - 30, 52, { size: 18, font: FONT_DISPLAY, align: 'right', color: '#ffb000' });

    const CW = 118, GAP = 12, x0 = (VIEW_W - (ROSTER.length * CW + (ROSTER.length - 1) * GAP)) / 2, cy = 72, CH = 150;
    ROSTER.forEach((key, i) => {
      const x = x0 + i * (CW + GAP);
      const grd = ctx.createLinearGradient(0, cy, 0, cy + CH);
      if (key === 'random') {
        grd.addColorStop(0, '#3a3f6e'); grd.addColorStop(1, '#1a1c38');
      } else {
        const look = prepLook(CHARACTERS[key].look);
        grd.addColorStop(0, shade(look.shirt, 0.25)); grd.addColorStop(1, shade(look.shirt, -0.6));
      }
      ctx.fillStyle = grd;
      ctx.fillRect(x, cy, CW, CH);
      ctx.save();
      ctx.beginPath(); ctx.rect(x, cy, CW, CH); ctx.clip();
      if (key === 'random') {
        txt(ctx, '?', x + CW / 2, cy + 105, { size: 84, font: FONT_DISPLAY, align: 'center', color: '#c9cbe8' });
      } else {
        drawFigure(ctx, x + CW / 2, cy + CH - 14, 1, idlePose(this.t + i * 20), CHARACTERS[key].look, 1.32 * (CHARACTERS[key].size || 1));
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(10,12,28,0.75)';
      ctx.fillRect(x, cy + CH - 24, CW, 24);
      txt(ctx, key === 'random' ? 'ALEATÓRIO' : CHARACTERS[key].name.toUpperCase(), x + CW / 2, cy + CH - 7, { size: 14, font: FONT_DISPLAY, align: 'center', color: '#ffffff' });
      // cursores dos jogadores
      this.slots.forEach((s) => {
        if (s.state === 'off' || s.cur !== i) return;
        const c = PLAYER_COLORS[s.player], inset = s.player * 4;
        ctx.strokeStyle = c; ctx.lineWidth = 4;
        ctx.strokeRect(x + 2 + inset, cy + 2 + inset, CW - 4 - inset * 2, CH - 4 - inset * 2);
        ctx.fillStyle = c;
        ctx.fillRect(x + (s.player ? CW - 34 : 0), cy - 16, 34, 16);
        txt(ctx, `${s.player + 1}P`, x + (s.player ? CW - 17 : 17), cy - 3, { size: 12, font: FONT_DISPLAY, align: 'center', color: '#14121c' });
      });
    });

    this.slots.forEach((s, i) => this.drawSlot(ctx, s, 30 + i * 460, 244, 440, 284));
    if (this.phase === 'config') this.drawConfig(ctx);
  }

  drawSlot(ctx, s, x, y, w, h) {
    const c = PLAYER_COLORS[s.player];
    ctx.fillStyle = 'rgba(20,23,48,0.92)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, 4);
    if (s.state === 'off') {
      txt(ctx, `${s.player + 1}P`, x + w / 2, y + 120, { size: 48, font: FONT_DISPLAY, align: 'center', color: c });
      const blink = this.t % 60 < 40;
      if (blink) txt(ctx, 'Pressione ATAQUE para entrar', x + w / 2, y + 160, { size: 18, weight: 700, align: 'center', color: '#ffffff' });
      txt(ctx, s.player === 1 ? 'Num 1 ou vírgula' : 'J ou Enter', x + w / 2, y + 186, { size: 14, align: 'center', color: '#8f93b8' });
      return;
    }
    const key = ROSTER[s.cur];
    const ready = s.state === 'ready';
    if (key === 'random') {
      txt(ctx, '?', x + 80, y + 210, { size: 120, font: FONT_DISPLAY, align: 'center', color: '#5a5f8e' });
      txt(ctx, 'ALEATÓRIO', x + 170, y + 50, { size: 26, font: FONT_DISPLAY, color: '#ffffff' });
      wrapText(ctx, 'Um lutador surpresa é sorteado quando a luta começa.', x + 170, y + 80, w - 186, 20, { size: 15, color: '#c9cbe8' });
    } else {
      const d = CHARACTERS[key];
      const pose = ready ? POSES.victory : (s.anim < 20 ? keyPose([[0, 'punchWind'], [6, 'punchHit'], [20, 'guard']], s.anim) : idlePose(this.t));
      drawFigure(ctx, x + 82, y + h - 30, 1, pose, d.look, 2.2 * (d.size || 1));
      txt(ctx, d.name.toUpperCase(), x + 170, y + 46, { size: 28, font: FONT_DISPLAY, color: '#ffffff' });
      txt(ctx, d.title, x + 170, y + 68, { size: 15, weight: 700, color: c });
      let yy = wrapText(ctx, d.desc, x + 170, y + 92, w - 186, 18, { size: 14, color: '#c9cbe8' });
      const stats = [['Vida', d.hp / 600], ['Força', d.power / 1.2], ['Velocidade', d.speed / 3.8]];
      stats.forEach(([n, v], k) => {
        const by = yy + k * 17;
        txt(ctx, n, x + 170, by + 9, { size: 12, color: '#8f93b8' });
        ctx.fillStyle = '#2a2e58'; ctx.fillRect(x + 250, by, 160, 9);
        ctx.fillStyle = '#ffb000'; ctx.fillRect(x + 250, by, 160 * clamp(v, 0, 1), 9);
      });
      yy += 58;
      Object.entries(d.specials).forEach(([k, m], j) => {
        txt(ctx, specialLabel(k), x + 170, yy + j * 19, { size: 14, weight: 700, color: '#ffffff' });
        txt(ctx, `${m.name} · ${m.cost} MP`, x + 230, yy + j * 19, { size: 14, color: '#c9cbe8' });
      });
    }
    if (this.mode === 'vs') {
      const choosing = s.state === 'team';
      const label = (choosing ? '◀ ' : '') + TEAM_NAMES[s.team] + (choosing ? ' ▶' : '');
      txt(ctx, label, x + w - 14, y + 26, { size: 15, weight: 700, align: 'right', color: choosing && this.t % 40 < 26 ? '#ffffff' : TEAM_COLORS[s.team] });
    }
    if (ready) {
      ctx.save();
      ctx.translate(x + 82, y + 60);
      ctx.rotate(-0.12);
      txt(ctx, 'PRONTO!', 0, 0, { size: 26, font: FONT_DISPLAY, align: 'center', color: '#ffb000', stroke: '#14121c', strokeW: 6 });
      ctx.restore();
    } else {
      const hint = s.state === 'team' ? '←/→ escolhe o time · ATAQUE confirma' : '←/→ escolhe · ATAQUE confirma';
      txt(ctx, hint, x + 14, y + h - 10, { size: 12, color: '#8f93b8' });
    }
  }

  drawConfig(ctx) {
    ctx.fillStyle = 'rgba(8,10,24,0.78)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const items = this.configItems();
    const w = 560, h = 90 + items.length * 44 + (this.warn ? 30 : 0), x = (VIEW_W - w) / 2, y = (VIEW_H - h) / 2;
    ctx.fillStyle = '#171b38';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#ffb000';
    ctx.fillRect(x, y, w, 4);
    txt(ctx, 'AJUSTES DA PARTIDA', x + 24, y + 44, { size: 22, font: FONT_DISPLAY, color: '#ffffff' });
    items.forEach((it, i) => {
      const yy = y + 90 + i * 44, sel = i === this.cfgSel;
      if (sel) { ctx.fillStyle = 'rgba(255,176,0,0.16)'; ctx.fillRect(x + 12, yy - 28, w - 24, 38); }
      if (it.go) {
        txt(ctx, it.label, x + w / 2, yy, { size: 22, font: FONT_DISPLAY, align: 'center', color: sel ? '#ffb000' : '#ffffff' });
      } else {
        txt(ctx, it.label, x + 28, yy, { size: 18, weight: 700, color: sel ? '#ffffff' : '#c9cbe8' });
        txt(ctx, (sel ? '◀  ' : '') + it.value + (sel ? '  ▶' : ''), x + w - 28, yy, { size: 18, weight: 700, align: 'right', color: sel ? '#ffb000' : '#ffffff' });
      }
    });
    if (this.warn) wrapText(ctx, this.warn, x + 28, y + h - 30, w - 56, 18, { size: 14, color: '#ff8a7a' });
  }
}

// ---- resultados ----

class ResultsScreen {
  constructor(r) {
    this.r = r; this.t = 0;
    const f = r.fighters.slice();
    f.sort((a, b) => (b.player >= 0) - (a.player >= 0) || (a.dead - b.dead) || b.stats.dmg - a.stats.dmg);
    this.rows = f.slice(0, 8);
  }

  update() {
    this.t++;
    if (this.t > 30 && (anyMenu('attack') || anyMenu('defend'))) {
      Sound.play('select');
      if (this.r.mode === 'vs' && anyMenu('attack')) Game.setScreen(new SelectScreen('vs'));
      else Game.toTitle();
    }
  }

  draw(ctx) {
    stripedBackdrop(ctx, this.t, '#ffb000');
    txt(ctx, this.r.title, VIEW_W / 2, 70, { size: 40, font: FONT_DISPLAY, align: 'center', color: '#ffb000', stroke: '#14121c', strokeW: 6 });
    if (this.r.sub) txt(ctx, this.r.sub, VIEW_W / 2, 102, { size: 18, weight: 700, align: 'center', color: '#c9cbe8' });
    const cols = [['LUTADOR', 90, 'left'], ['DANO CAUSADO', 520, 'right'], ['NOCAUTES', 640, 'right'], ['DANO SOFRIDO', 790, 'right'], ['SITUAÇÃO', 900, 'right']];
    cols.forEach(([n, x, a]) => txt(ctx, n, x, 140, { size: 12, weight: 700, align: a, color: '#8f93b8' }));
    this.rows.forEach((f, i) => {
      const y = 152 + i * 44;
      ctx.fillStyle = i % 2 ? 'rgba(30,34,64,0.7)' : 'rgba(22,25,50,0.7)';
      ctx.fillRect(40, y, 880, 40);
      ctx.drawImage(portrait(f.key, 34), 46, y + 3);
      const label = f.player >= 0 ? `${f.player + 1}P` : f.boss ? 'CHEFE' : 'COM';
      const lc = f.player >= 0 ? PLAYER_COLORS[f.player] : '#8f93b8';
      txt(ctx, f.name, 90, y + 26, { size: 18, weight: 700, color: '#ffffff' });
      txt(ctx, label, 90 + ctx.measureText(f.name).width + 10, y + 26, { size: 13, weight: 700, color: lc });
      const win = this.r.winners ? this.r.winners.includes(f) : !f.dead;
      const vals = [String(f.stats.dmg), String(f.stats.kills), String(f.stats.taken)];
      vals.forEach((v, k) => txt(ctx, v, cols[k + 1][1], y + 26, { size: 18, weight: 700, align: 'right', color: '#e9ebff' }));
      txt(ctx, win ? (this.r.winners ? 'VENCEU' : 'DE PÉ') : 'K.O.', 900, y + 26, { size: 15, font: FONT_DISPLAY, align: 'right', color: win ? '#66d17a' : '#ff6b5e' });
    });
    const msg = this.r.mode === 'vs' ? 'ATAQUE: nova luta · DEFESA: menu principal' : 'Pressione ATAQUE para voltar ao menu';
    if (this.t > 30) txt(ctx, msg, VIEW_W / 2, VIEW_H - 22, { size: 16, weight: 700, align: 'center', color: '#ffffff' });
  }
}
