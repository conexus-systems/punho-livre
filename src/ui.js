'use strict';
// Telas do Punho Livre: inicial, modos, seleção de lutadores, ajustes da
// partida, controles e a partida.

const Game = {
  ctx: null,
  screen: null,
  difficulty: 1,
  setScreen(s) {
    this.screen = s;
    if (s.enter) s.enter();
    if (!(s instanceof LoadingScreen)) Music.play(trackFor(s));
    TouchSpecials.update(s instanceof MatchScreen || s instanceof NetMatchScreen ? s.match : null);
  },
  update() {
    // nas partidas as teclas vão para os personagens (na de rede, para o envio)
    Input.pollPads();
    const inMatch = this.screen instanceof MatchScreen || this.screen instanceof NetMatchScreen;
    if (!inMatch) for (const c of Input.controllers) c.fetch();
    else TouchSpecials.poll(this.screen instanceof NetMatchScreen ? Net.slot : 0);
    if (Input.code('KeyM') && !(this.screen instanceof ControlsScreen)) Sound.muted = !Sound.muted;
    this.screen.update();
  },
  draw() { this.screen.draw(this.ctx); },
};

function text(ctx, s, x, y, o = {}) {
  ctx.font = `${o.bold === false ? '' : 'bold '}${o.size || 13}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.base || 'middle';
  if (o.shadow) {
    ctx.fillStyle = o.shadow;
    ctx.fillText(s, x + 1, y + 1, o.max);
  }
  ctx.fillStyle = o.color || '#fff';
  ctx.fillText(s, x, y, o.max);
}

// texto quebrado em linhas de até `w` px
function wrapText(ctx, s, x, y, w, lh, o) {
  ctx.font = `${o.bold === false ? '' : 'bold '}${o.size || 13}px Arial, Helvetica, sans-serif`;
  let line = '', yy = y;
  for (const word of s.split(' ')) {
    const t = line ? line + ' ' + word : word;
    if (ctx.measureText(t).width > w && line) { text(ctx, line, x, yy, o); line = word; yy += lh; } else line = t;
  }
  if (line) text(ctx, line, x, yy, o);
}

function setDifficulty(v) {
  Game.difficulty = v;
  Save.settings.difficulty = v;
  Save.save();
}

function navVertical(n, sel) {
  if (Input.anyHit('up')) { Sound.play('m_pass'); return (sel + n - 1) % n; }
  if (Input.anyHit('down')) { Sound.play('m_pass'); return (sel + 1) % n; }
  return sel;
}

const confirmHit = () => Input.anyHit('att') || Input.code('Enter');
const backHit = () => Input.anyHit('jump') || Input.code('Escape');

// fundo das telas de menu: noite azul-escura com faixas diagonais
function menuBackdrop(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 0, LF.H);
  g.addColorStop(0, '#0b1030');
  g.addColorStop(1, '#1b0f2e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LF.W, LF.H);
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = '#ffb000';
  for (let i = -8; i < 20; i++) {
    const x = i * 70 + ((t * 0.5) % 70);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 30, 0); ctx.lineTo(x - 140, LF.H); ctx.lineTo(x - 170, LF.H); ctx.fill();
  }
  ctx.restore();
}

// lista de opções com destaque em faixa inclinada
function drawMenuList(ctx, items, sel, y0, gap = 40) {
  items.forEach((it, i) => {
    const y = y0 + i * gap, on = i === sel;
    if (on) {
      ctx.fillStyle = UI.amber;
      ctx.beginPath();
      ctx.moveTo(LF.W / 2 - 150, y - 17); ctx.lineTo(LF.W / 2 + 160, y - 17);
      ctx.lineTo(LF.W / 2 + 150, y + 17); ctx.lineTo(LF.W / 2 - 160, y + 17);
      ctx.fill();
    }
    ctx.font = displayFont(28);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = on ? '#120a1e' : UI.text;
    ctx.fillText(it.name, LF.W / 2, y + 1);
  });
}

// ---- carregando ----

class LoadingScreen {
  constructor() { this.p = 0; this.error = null; }
  update() {}
  draw(ctx) {
    menuBackdrop(ctx, 0);
    if (this.error) {
      text(ctx, 'Não foi possível montar o jogo.', LF.W / 2, 200, { align: 'center', size: 18 });
      text(ctx, this.error, LF.W / 2, 270, { align: 'center', bold: false, size: 11, color: '#afdcff', max: 740 });
      return;
    }
    text(ctx, 'Carregando...', LF.W / 2, 215, { align: 'center', size: 16 });
    ctx.fillStyle = '#1e337a';
    ctx.fillRect(247, 240, 300, 10);
    ctx.fillStyle = UI.amber;
    ctx.fillRect(247, 240, 300 * this.p, 10);
  }
}

// lutador parado (animação de respiração) desenhado em tamanho grande nos menus
const idleSheets = {};
function drawIdleFighter(ctx, id, x, feetY, scale, flip, t) {
  const o = Assets.obj(id);
  if (!o) return;
  const sheet = idleSheets[id] || (idleSheets[id] = new SpriteSheet(o.data.bmp));
  const F = o.data.frame[[0, 1, 2, 3, 2, 1][Math.floor(t / 7) % 6]];
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(x, feetY);
  ctx.scale(flip ? -scale : scale, scale);
  sheet.draw(ctx, F.pic, -F.centerx, -F.centery, false);
  ctx.restore();
}

// ---- tela inicial ----

const TITLE_ITEMS = [{ name: 'Jogar' }, { name: 'Jogar em rede' }, { name: 'Ajustes' }, { name: 'Sobre' }];

class TitleScreen {
  constructor() { this.sel = 0; this.t = 0; }
  update() {
    this.t++;
    this.sel = navVertical(TITLE_ITEMS.length, this.sel);
    if (confirmHit()) {
      Sound.init();
      Sound.play('m_ok');
      if (this.sel === 0) Game.setScreen(new ModeScreen());
      else if (this.sel === 1) Game.setScreen(new NetScreen());
      else if (this.sel === 2) Game.setScreen(new SettingsScreen());
      else Game.setScreen(new AboutScreen());
    }
  }
  draw(ctx) {
    menuBackdrop(ctx, this.t);
    // os lutadores do elenco nas laterais (dois por vez, trocam a cada ~8 s)
    const cast = [1, 2, 3, 4, 5, 6, 7, 8], k = Math.floor(this.t / 240) % 4;
    drawIdleFighter(ctx, cast[k * 2 % 8], 112, 430, 2.5, false, this.t);
    drawIdleFighter(ctx, cast[(k * 2 + 5) % 8], LF.W - 112, 430, 2.5, true, this.t + 20);
    drawLogo(ctx, LF.W / 2, 124, 0.8, this.t);
    drawMenuList(ctx, TITLE_ITEMS, this.sel, 262, 40);
    if (!Input.touchActive) {
      const k = Input.keys[0];
      text(ctx, `1P: ${keyName(k.up)} ${keyName(k.down)} ${keyName(k.left)} ${keyName(k.right)} move · ${keyName(k.att)} ataca · ${keyName(k.jump)} pula · ${keyName(k.def)} defende`,
        LF.W / 2, 446, { align: 'center', bold: false, size: 12, color: UI.muted });
    }
  }
}

// ---- escolha do modo ----

const MODES = [
  { key: 'vs', name: 'Versus', desc: 'Todos contra todos ou em times, até 8 lutadores.' },
  { key: 'stage', name: 'História', desc: 'Atravesse 5 fases enfrentando bandidos e chefes.' },
  { key: 'training', name: 'Treino', desc: 'Pratique golpes num boneco, com MP infinito.' },
  { key: 'howto', name: 'Como jogar', desc: 'Controles, golpes e dicas.' },
  { key: 'demo', name: 'Demonstração', desc: 'Assista aos computadores lutando.' },
  { key: 'back', name: 'Voltar', desc: '' },
];

class ModeScreen {
  constructor() { this.sel = 0; this.t = 0; }
  update() {
    this.t++;
    this.sel = navVertical(MODES.length, this.sel);
    if (backHit()) { Sound.play('m_cancel'); Game.setScreen(new TitleScreen()); return; }
    if (confirmHit()) {
      Sound.play('m_ok');
      const m = MODES[this.sel].key;
      if (m === 'back') Game.setScreen(new TitleScreen());
      else if (m === 'demo') startDemo();
      else if (m === 'howto') Game.setScreen(new HowToScreen());
      else Game.setScreen(new SelectScreen(m));
    }
  }
  draw(ctx) {
    menuBackdrop(ctx, this.t);
    drawLogo(ctx, LF.W / 2, 76, 0.42, this.t);
    drawMenuList(ctx, MODES, this.sel, 168, 40);
    text(ctx, MODES[this.sel].desc, LF.W / 2, 438, { align: 'center', bold: false, color: UI.muted });
  }
}

// ---- lutadores e golpes ----

function characterList() {
  const order = [1, 2, 3, 4, 5, 6, 7, 8, 30];
  const chars = Assets.data.objects.filter((o) => o.type === 'character');
  return chars.sort((a, b) => {
    const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}

const SPECIAL_CMDS = [
  ['hit_Fa', 'D → A', ['def', 'F', 'att']], ['hit_Ua', 'D ↑ A', ['def', 'up', 'att']], ['hit_Da', 'D ↓ A', ['def', 'down', 'att']],
  ['hit_Fj', 'D → J', ['def', 'F', 'jump']], ['hit_Uj', 'D ↑ J', ['def', 'up', 'jump']], ['hit_Dj', 'D ↓ J', ['def', 'down', 'jump']],
  ['hit_ja', 'D J A', ['def', 'jump', 'att']],
];

// golpes especiais de um lutador, com uma descrição curta do que fazem
function specialsOf(c) {
  const out = [];
  const f0 = c.data.frame[0];
  for (const [tag, cmd, seq] of SPECIAL_CMDS) {
    const start = f0 && f0[tag];
    if (!start || !c.data.frame[start]) continue;
    const k = classifySpecial(c.data, start);
    const def = ROSTER.find((r) => r.id === c.id), named = def && def.specials.find((x) => x.tag === tag);
    const kind = named ? named.label : k.heal ? 'Cura' : k.teleport ? 'Teleporte' : k.ranged ? 'Disparo' : 'Golpe forte';
    out.push({ tag, cmd, seq, kind, cost: k.cost });
  }
  return out;
}

const DIFFICULTIES = ['Fácil', 'Normal', 'Difícil', 'Maluco!'];
const TEAM_LABELS = ['Sem time', 'Time 1', 'Time 2', 'Time 3', 'Time 4'];
const TEAM_COLORS = ['#c9cbe8', '#ff6b5e', '#5aa9ff', '#66d17a', '#ffc94a'];

// ---- seleção de lutadores ----
// Cada jogador (até 4 no mesmo aparelho) entra com ATAQUE, escolhe o lutador na
// grade, depois o time, e fica pronto. Com todos prontos aparecem os ajustes.

class SelectScreen {
  constructor(mode, keep) {
    this.mode = mode;
    this.chars = characterList();
    this.t = 0;
    this.cells = this.chars.length + 1; // a última é "Aleatório"
    this.players = keep ? keep.players : [0, 1, 2, 3].map((p) => ({ p, state: 'off', cur: p, team: 0, pick: null }));
    this.settings = keep ? keep.settings : { cpus: mode === 'stage' ? 0 : 1, cpuTeam: 0, bg: -1, stage: 0 };
    this.phase = keep && mode !== 'training' ? 'settings' : 'pick';
    if (keep && mode === 'training') for (const p of this.players) if (p.state === 'ready') p.state = 'char';
    this.sel = 0;
    this.msg = '';
  }

  joined() { return this.players.filter((p) => p.state !== 'off'); }

  update() {
    this.t++;
    if (this.phase === 'pick') this.updatePick();
    else this.updateSettings();
  }

  moveCursor(pl, dx, dy) {
    const perRow = 10, n = this.cells;
    let c = pl.cur;
    if (dx) c = (c + dx + n) % n;
    if (dy) {
      const next = c + dy * perRow;
      if (next >= 0 && next < n) c = next;
    }
    pl.cur = c;
    Sound.play('m_pass');
  }

  updatePick() {
    if (Input.code('Escape')) { Game.setScreen(new ModeScreen()); return; }
    for (const pl of this.players) {
      const P = (a) => Input.hit(pl.p, a) || (pl.p === 0 && a === 'att' && Input.code('Enter'));
      if (pl.state === 'off') {
        if (P('att')) { pl.state = 'char'; Sound.play('m_join'); }
        continue;
      }
      if (P('jump')) {
        Sound.play('m_cancel');
        if (pl.state === 'char') {
          if (pl.p === 0 && this.joined().length === 1) { Game.setScreen(new ModeScreen()); return; }
          pl.state = 'off';
        } else if (pl.state === 'team') pl.state = 'char';
        else pl.state = this.mode !== 'vs' ? 'char' : 'team';
        continue;
      }
      if (pl.state === 'char') {
        if (P('left')) this.moveCursor(pl, -1, 0);
        if (P('right')) this.moveCursor(pl, 1, 0);
        if (P('up')) this.moveCursor(pl, 0, -1);
        if (P('down')) this.moveCursor(pl, 0, 1);
        if (P('att')) { pl.state = this.mode !== 'vs' ? 'ready' : 'team'; Sound.play('m_join'); }
      } else if (pl.state === 'team') {
        if (P('left')) { pl.team = (pl.team + 4) % 5; Sound.play('m_pass'); }
        if (P('right')) { pl.team = (pl.team + 1) % 5; Sound.play('m_pass'); }
        if (P('att')) { pl.state = 'ready'; Sound.play('m_join'); }
      }
    }
    const j = this.joined();
    if (j.length && j.every((p) => p.state === 'ready')) {
      if (this.mode === 'training') { this.fight(); return; }
      this.phase = 'settings';
      this.sel = 0;
      this.msg = '';
      Sound.play('m_ok');
    }
  }

  settingItems() {
    const S = this.settings, humans = this.joined().length;
    const items = [];
    if (this.mode === 'stage') {
      items.push({ k: 'cpus', label: 'Aliados (computador)', value: String(S.cpus), max: Math.min(3, 4 - humans) });
      const open = Math.min(STAGES.length, Save.progress.storyBest + 1);
      S.stage = Math.min(S.stage, open - 1);
      items.push({ k: 'stage', label: 'Começar na fase', value: `${S.stage + 1} de ${open} liberada${open > 1 ? 's' : ''}` });
    } else {
      items.push({ k: 'cpus', label: 'Computadores', value: String(S.cpus), max: 8 - humans });
      items.push({ k: 'cpuTeam', label: 'Time dos computadores', value: S.cpuTeam ? TEAM_LABELS[S.cpuTeam] : 'Cada um por si' });
      items.push({ k: 'bg', label: 'Cenário', value: S.bg < 0 ? 'Sorteado' : Assets.backgrounds[S.bg].name });
    }
    items.push({ k: 'diff', label: 'Dificuldade', value: DIFFICULTIES[Game.difficulty] });
    items.push({ k: 'fight', label: 'LUTAR!' });
    items.push({ k: 'back', label: 'Trocar lutadores' });
    return items;
  }

  updateSettings() {
    const items = this.settingItems();
    this.sel = Math.min(navVertical(items.length, this.sel), items.length - 1);
    const it = items[this.sel], S = this.settings;
    const d = Input.anyHit('right') ? 1 : Input.anyHit('left') ? -1 : 0;
    if (d) {
      Sound.play('m_pass');
      this.msg = '';
      if (it.k === 'cpus') S.cpus = Math.max(0, Math.min(it.max, S.cpus + d));
      if (it.k === 'cpuTeam') S.cpuTeam = (S.cpuTeam + d + 5) % 5;
      if (it.k === 'bg') { const n = Assets.backgrounds.length; S.bg = ((S.bg + 1 + d + n + 1) % (n + 1)) - 1; }
      if (it.k === 'stage') { const open = Math.min(STAGES.length, Save.progress.storyBest + 1); S.stage = (S.stage + d + open) % open; }
      if (it.k === 'diff') setDifficulty((Game.difficulty + d + 4) % 4);
    }
    if (backHit()) { this.unready(); return; }
    if (confirmHit()) {
      if (it.k === 'fight') this.fight();
      else if (it.k === 'back') this.unready();
      else if (it.k === 'diff') setDifficulty((Game.difficulty + 1) % 4);
    }
  }

  unready() {
    Sound.play('m_cancel');
    this.phase = 'pick';
    for (const p of this.joined()) p.state = 'char';
  }

  charAt(cur) { return cur < this.chars.length ? this.chars[cur] : null; }

  fight() {
    const S = this.settings, humans = this.joined();
    if (this.mode === 'training') {
      const keep = { players: this.players, settings: S };
      const players = humans.map((pl) => ({ id: (this.charAt(pl.cur) || this.chars[0]).id, team: 1, con: Input.controllers[pl.p], player: pl.p, name: `${pl.p + 1}P` }));
      players.push({ id: 30, team: 2, con: new Controller(), name: 'Boneco', panel: true });
      Sound.play('m_ok');
      const bg = (Assets.backgrounds.find((b) => b.name === 'Dojô') || Assets.backgrounds[0]).id;
      startMatch({ players, bg, mode: 'training', weapons: false, onEnd: () => Game.setScreen(new SelectScreen('training', keep)) });
      return;
    }
    const rnd = () => this.chars.filter((c) => c.id !== 30)[Math.floor(Math.random() * (this.chars.length - 1))];
    const players = humans.map((pl) => {
      const c = this.charAt(pl.cur) || rnd();
      return { id: c.id, team: this.mode === 'stage' ? 1 : (pl.team || 100 + pl.p), con: Input.controllers[pl.p], player: pl.p, name: `${pl.p + 1}P` };
    });
    for (let i = 0; i < S.cpus; i++) {
      players.push({ id: rnd().id, team: this.mode === 'stage' ? 1 : (S.cpuTeam || 110 + i), con: new Controller(), ai: Game.difficulty, name: 'COM' });
    }
    if (this.mode !== 'stage') {
      const teams = new Set(players.map((p) => p.team));
      if (players.length < 2 || teams.size < 2) {
        this.msg = players.length < 2 ? 'Adicione computadores ou mais jogadores.' : 'Todos estão no mesmo time: mude os times.';
        Sound.play('m_cancel');
        return;
      }
    }
    Sound.play('m_ok');
    const keep = { players: this.players, settings: S };
    const back = () => Game.setScreen(new SelectScreen(this.mode, keep));
    if (this.mode === 'stage') startStage(players, S.stage, back);
    else {
      const list = Assets.backgrounds;
      const bg = S.bg < 0 ? list[Math.floor(Math.random() * list.length)].id : list[S.bg].id;
      startMatch({ players, bg, mode: 'vs', onEnd: back });
    }
  }

  // ---- desenho ----

  draw(ctx) {
    menuBackdrop(ctx, this.t);
    title(ctx, 'ESCOLHA SEU LUTADOR', 28, 26, 28, UI.text, 'left');
    title(ctx, { stage: 'HISTÓRIA', training: 'TREINO', vs: 'VERSUS' }[this.mode], LF.W - 28, 26, 22, UI.amber, 'right');
    this.drawGrid(ctx);
    for (let i = 0; i < 4; i++) this.drawCard(ctx, this.players[i], 22 + i * 190, 142, 180, 296);
    const hint = Input.touchActive ? 'A entra e confirma · J volta · direcional escolhe'
      : `1P: ${keyName(Input.keys[0].att)} entra e confirma · ${keyName(Input.keys[0].jump)} volta · 2P: ${keyName(Input.keys[1].att)} entra`;
    text(ctx, hint, LF.W / 2, 456, { align: 'center', bold: false, size: 12, color: UI.muted });
    if (this.phase === 'settings') this.drawSettings(ctx);
  }

  drawGrid(ctx) {
    const cw = 70, gap = 6, x0 = (LF.W - (10 * cw + 9 * gap)) / 2, y0 = 54;
    for (let i = 0; i < this.cells; i++) {
      const x = x0 + (i % 10) * (cw + gap), y = y0 + Math.floor(i / 10) * (cw + gap);
      const c = this.charAt(i);
      ctx.fillStyle = UI.panel;
      ctx.fillRect(x, y, cw, cw);
      if (c) {
        const img = Assets.img(c.data.bmp.head);
        if (img) ctx.drawImage(img, x + 2, y + 2, cw - 4, cw - 4);
        ctx.fillStyle = 'rgba(5,8,20,0.7)';
        ctx.fillRect(x, y + cw - 16, cw, 16);
        text(ctx, c.name, x + cw / 2, y + cw - 8, { align: 'center', size: 11, max: cw - 4 });
      } else {
        title(ctx, '?', x + cw / 2, y + cw / 2 - 6, 48, UI.amber);
        text(ctx, 'Aleatório', x + cw / 2, y + cw - 8, { align: 'center', size: 11 });
      }
      // cursores dos jogadores
      const here = this.players.filter((p) => p.state !== 'off' && p.cur === i);
      here.forEach((p, k) => {
        const col = UI.players[p.p], inset = k * 4;
        ctx.strokeStyle = col;
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 1.5 + inset, y + 1.5 + inset, cw - 3 - inset * 2, cw - 3 - inset * 2);
        ctx.fillStyle = col;
        ctx.fillRect(x + k * 22, y - 9, 22, 12);
        text(ctx, `${p.p + 1}P`, x + k * 22 + 11, y - 3, { align: 'center', size: 10, color: '#120a1e' });
      });
    }
  }

  drawCard(ctx, pl, x, y, w, h) {
    const col = UI.players[pl.p];
    panelBox(ctx, x, y, w, h, col);
    if (pl.state === 'off') {
      title(ctx, `${pl.p + 1}P`, x + w / 2, y + 100, 44, col);
      const blink = Math.floor(this.t / 20) % 2 === 0;
      text(ctx, 'Aperte ATAQUE', x + w / 2, y + 146, { align: 'center', size: 14, color: blink ? UI.text : UI.muted });
      text(ctx, 'para entrar', x + w / 2, y + 164, { align: 'center', size: 14, color: blink ? UI.text : UI.muted });
      if (!Input.touchActive) text(ctx, `tecla ${keyName(Input.keys[pl.p].att)}`, x + w / 2, y + 192, { align: 'center', bold: false, size: 12, color: UI.dim });
      return;
    }
    const c = this.charAt(pl.cur);
    const img = c ? Assets.img(c.data.bmp.head) : null;
    if (img) ctx.drawImage(img, x + 8, y + 10, 72, 72);
    else title(ctx, '?', x + 44, y + 46, 56, UI.amber);
    title(ctx, c ? c.name : 'Aleatório', x + 88, y + 26, 22, UI.text, 'left');
    text(ctx, `${pl.p + 1}P`, x + 88, y + 50, { size: 12, color: col });
    if (this.mode === 'vs') {
      const choosing = pl.state === 'team';
      const tl = TEAM_LABELS[pl.team];
      text(ctx, choosing ? `◀ ${tl} ▶` : tl, x + 88, y + 70, { size: 12, color: choosing ? UI.amber : TEAM_COLORS[pl.team] });
    }
    // descrição e golpes especiais
    const def = c && ROSTER.find((r) => r.id === c.id);
    wrapText(ctx, def ? def.desc : 'Um lutador é sorteado quando a luta começa.', x + 10, y + 100, w - 20, 15, { bold: false, size: 12, color: UI.muted });
    if (c) {
      const sp = specialsOf(c);
      text(ctx, sp.length ? 'Especiais' : 'Sem golpes especiais', x + 10, y + 148, { size: 11, color: UI.muted });
      sp.slice(0, 5).forEach((s, k) => {
        const yy = y + 168 + k * 30;
        text(ctx, s.kind, x + 10, yy, { size: 13, color: UI.text, max: w - 20 });
        text(ctx, s.cmd, x + 10, yy + 14, { size: 11, color: UI.amber });
      });
    }
    const st = pl.state === 'ready' ? ['PRONTO', UI.good] : pl.state === 'team' ? ['Escolha o time', UI.amber] : ['Escolha o lutador', UI.amber];
    text(ctx, st[0], x + w / 2, y + h - 14, { align: 'center', size: 13, color: st[1] });
  }

  drawSettings(ctx) {
    ctx.fillStyle = 'rgba(5,8,20,0.7)';
    ctx.fillRect(0, 0, LF.W, LF.H);
    const items = this.settingItems();
    const w = 470, rh = 36, h = 70 + items.length * rh + (this.msg ? 26 : 8);
    const x = (LF.W - w) / 2, y = (LF.H - h) / 2;
    panelBox(ctx, x, y, w, h, UI.amber);
    title(ctx, 'AJUSTES DA PARTIDA', LF.W / 2, y + 30, 26, UI.text);
    items.forEach((it, i) => {
      const yy = y + 70 + i * rh, on = i === this.sel;
      if (on) { ctx.fillStyle = 'rgba(255,176,0,0.16)'; ctx.fillRect(x + 12, yy - 15, w - 24, 30); }
      if (it.value === undefined) {
        title(ctx, it.label, LF.W / 2, yy, it.k === 'fight' ? 26 : 20, on ? UI.amber : UI.text);
      } else {
        text(ctx, it.label, x + 28, yy, { size: 15, color: on ? UI.text : UI.muted });
        text(ctx, on ? `◀  ${it.value}  ▶` : it.value, x + w - 28, yy, { align: 'right', size: 15, color: on ? UI.amber : UI.text });
      }
    });
    if (this.msg) text(ctx, this.msg, LF.W / 2, y + h - 18, { align: 'center', size: 13, color: '#ff9b9b' });
  }
}

// ---- controles ----

class ControlsScreen {
  constructor(back) { this.p = 0; this.a = 0; this.waiting = false; this.t = 0; this.back = back || (() => new TitleScreen()); }
  update() {
    this.t++;
    if (this.waiting) return;
    const n = KEY_ACTIONS.length + 1;
    if (Input.code('Escape') || Input.anyHit('jump') && this.a === n - 1) { Input.save(); Game.setScreen(this.back()); return; }
    if (Input.code('ArrowUp') || Input.hit(0, 'up')) this.a = (this.a + n - 1) % n;
    if (Input.code('ArrowDown') || Input.hit(0, 'down')) this.a = (this.a + 1) % n;
    if (Input.code('ArrowLeft') || Input.hit(0, 'left')) this.p = (this.p + 3) % 4;
    if (Input.code('ArrowRight') || Input.hit(0, 'right')) this.p = (this.p + 1) % 4;
    if (Input.code('Enter') || Input.hit(0, 'att')) {
      if (this.a === n - 1) { Input.save(); Sound.play('m_ok'); Game.setScreen(this.back()); return; }
      this.waiting = true;
      Input.listeners.push((code) => {
        Input.listeners.pop();
        this.waiting = false;
        if (code === 'Escape') return;
        for (const k of Input.keys) for (const a of KEY_ACTIONS) if (k[a] === code) k[a] = '';
        Input.keys[this.p][KEY_ACTIONS[this.a]] = code;
        Input.pressed.clear();
      });
    }
    if (Input.code('Backspace') || Input.code('Delete')) Input.keys[this.p][KEY_ACTIONS[this.a]] = '';
    if (Input.code('KeyR') && Input.down.has('ShiftLeft')) Input.keys = DEFAULT_KEYS.map((k) => ({ ...k }));
  }
  draw(ctx) {
    menuBackdrop(ctx, this.t);
    title(ctx, 'CONTROLES', LF.W / 2, 34, 34, UI.amber);
    const x0 = 60, y0 = 84, cw = 162, rh = 34;
    panelBox(ctx, x0 - 16, y0 - 26, LF.W - 2 * (x0 - 16), rh * KEY_ACTIONS.length + 46);
    for (let p = 0; p < 4; p++) {
      text(ctx, `Jogador ${p + 1}`, x0 + 120 + p * cw, y0, { color: p === this.p ? UI.players[p] : UI.muted });
    }
    KEY_ACTIONS.forEach((a, i) => {
      const y = y0 + 30 + i * rh;
      text(ctx, KEY_LABELS[a], x0, y, { color: UI.muted });
      for (let p = 0; p < 4; p++) {
        const on = p === this.p && i === this.a;
        if (on) { ctx.fillStyle = this.waiting ? '#7a2a3a' : 'rgba(255,176,0,0.25)'; ctx.fillRect(x0 + 110 + p * cw, y - 13, cw - 14, 26); }
        text(ctx, on && this.waiting ? 'aperte uma tecla' : keyName(Input.keys[p][a]), x0 + 120 + p * cw, y, { color: UI.text, bold: false });
      }
    });
    const okY = y0 + 30 + KEY_ACTIONS.length * rh + 22, on = this.a === KEY_ACTIONS.length;
    if (on) { ctx.fillStyle = UI.amber; ctx.fillRect(LF.W / 2 - 80, okY - 16, 160, 32); }
    title(ctx, 'SALVAR', LF.W / 2, okY, 22, on ? '#120a1e' : UI.text);
    text(ctx, 'Setas escolhem · Enter troca a tecla · Delete apaga · Esc salva e sai', LF.W / 2, 448, { align: 'center', bold: false, size: 12, color: UI.muted });
  }
}

// ---- partida ----

class MatchScreen {
  constructor(match) { this.match = match; }
  update() { this.match.frame(); }
  draw(ctx) { this.match.draw(ctx); }
}

function startMatch(opts) {
  for (const c of Input.controllers) c.clear();
  const m = new Match(opts);
  Game.setScreen(new MatchScreen(m));
  return m;
}

function startDemo() {
  const chars = characterList().filter((c) => c.id !== 30);
  const players = [];
  for (let i = 0; i < 4; i++) {
    players.push({ id: chars[Math.floor(Math.random() * chars.length)].id, team: 100 + i, con: new Controller(), ai: 2, name: 'COM' });
  }
  const bgs = Assets.backgrounds;
  const m = startMatch({
    players, bg: bgs[Math.floor(Math.random() * bgs.length)].id, mode: 'demo',
    onEnd: () => Game.setScreen(new ModeScreen()),
  });
  m.demo = true;
}
