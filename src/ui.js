'use strict';
// Telas do Punho Livre: inicial, modos, seleção de lutadores,
// configuração de teclas e a partida.

const Game = {
  ctx: null,
  screen: null,
  difficulty: 2,
  setScreen(s) { this.screen = s; if (s.enter) s.enter(); },
  update() {
    // nas partidas as teclas vão para os personagens (na de rede, para o envio)
    const inMatch = this.screen instanceof MatchScreen || this.screen instanceof NetMatchScreen;
    if (!inMatch) for (const c of Input.controllers) c.fetch();
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

function uiImg(path) { return Assets.img(path); }

// menu vertical com a imagem do LF2: metade esquerda normal, metade direita destacada
function drawMenuImage(ctx, D, x, y, active) {
  const bg = D.bg && uiImg(D.bg), pic = uiImg(D.pic);
  if (bg) ctx.drawImage(bg, x, y);
  if (!pic) return;
  ctx.drawImage(pic, 0, 0, D.width, D.height, x, y, D.width, D.height);
  const it = D.item[active];
  if (it) ctx.drawImage(pic, D.width + it[0], it[1], it[2], it[3], x + it[0], y + it[1], it[2], it[3]);
}

function navVertical(n, sel) {
  if (Input.anyHit('up')) { Sound.play('1/m_pass'); return (sel + n - 1) % n; }
  if (Input.anyHit('down')) { Sound.play('1/m_pass'); return (sel + 1) % n; }
  return sel;
}

// ---- carregando ----

class LoadingScreen {
  constructor() { this.p = 0; this.error = null; }
  update() {}
  draw(ctx) {
    menuBackdrop(ctx, 0);
    if (this.error) {
      text(ctx, 'Não encontrei os dados do jogo.', LF.W / 2, 230, { align: 'center', size: 18 });
      text(ctx, 'Rode ./tools/fetch-lf2.sh para baixar e gerar a pasta assets/.', LF.W / 2, 262, { align: 'center', bold: false });
      text(ctx, this.error, LF.W / 2, 300, { align: 'center', bold: false, size: 11, color: '#afdcff', max: 740 });
      return;
    }
    text(ctx, 'Carregando...', LF.W / 2, 250, { align: 'center', size: 16 });
    ctx.fillStyle = '#1e337a';
    ctx.fillRect(247, 275, 300, 10);
    ctx.fillStyle = '#afdcff';
    ctx.fillRect(247, 275, 300 * this.p, 10);
  }
}

// ---- tela inicial ----

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
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 30, 0); ctx.lineTo(x - 170, LF.H); ctx.lineTo(x - 200, LF.H); ctx.fill();
  }
  ctx.restore();
}

// lista de opções com destaque; devolve a área de cada item (toque/clique)
function drawMenuList(ctx, items, sel, y0, gap = 40) {
  items.forEach((it, i) => {
    const y = y0 + i * gap, on = i === sel;
    if (on) {
      ctx.fillStyle = '#ffb000';
      ctx.beginPath();
      ctx.moveTo(LF.W / 2 - 150, y - 17); ctx.lineTo(LF.W / 2 + 160, y - 17);
      ctx.lineTo(LF.W / 2 + 150, y + 17); ctx.lineTo(LF.W / 2 - 160, y + 17);
      ctx.fill();
    }
    ctx.font = `28px ${LOGO_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = on ? '#120a1e' : (it.disabled ? '#5b5f86' : '#e9ebff');
    ctx.fillText(it.name, LF.W / 2, y + 1);
  });
}

const TITLE_ITEMS = [{ name: 'Jogar' }, { name: 'Jogar em rede' }, { name: 'Controles' }];

class TitleScreen {
  constructor() { this.sel = 0; this.t = 0; }
  update() {
    this.t++;
    this.sel = navVertical(TITLE_ITEMS.length, this.sel);
    if (Input.anyHit('att') || Input.code('Enter')) {
      Sound.init();
      Sound.play('1/m_ok');
      if (this.sel === 0) Game.setScreen(new ModeScreen());
      else if (this.sel === 1) Game.setScreen(new NetScreen());
      else Game.setScreen(new ControlsScreen());
    }
  }
  draw(ctx) {
    menuBackdrop(ctx, this.t);
    drawLogo(ctx, LF.W / 2, 170, 1, this.t);
    drawMenuList(ctx, TITLE_ITEMS, this.sel, 330);
    const k = Input.keys[0];
    text(ctx, `1P: ${keyName(k.up)} ${keyName(k.down)} ${keyName(k.left)} ${keyName(k.right)} mover · ${keyName(k.att)} ataque · ${keyName(k.jump)} pulo · ${keyName(k.def)} defesa`,
      LF.W / 2, 478, { align: 'center', bold: false, size: 12, color: '#9aa3d8' });
    text(ctx, 'Lutadores, cenários e sons originais de Little Fighter 2 © Marti Wong & Starsky Wong', LF.W / 2, 526, { align: 'center', bold: false, size: 10, color: '#5b5f86' });
  }
}

// ---- escolha do modo ----

const MODES = [
  { key: 'vs', name: 'Versus', desc: 'Todos contra todos ou em times, até 8 lutadores.' },
  { key: 'stage', name: 'História', desc: 'Avance pelas fases enfrentando bandidos e chefes.' },
  { key: 'demo', name: 'Demonstração', desc: 'Assista aos computadores lutando.' },
  { key: 'back', name: 'Voltar', desc: '' },
];

class ModeScreen {
  constructor() { this.sel = 0; this.t = 0; }
  update() {
    this.t++;
    this.sel = navVertical(MODES.length, this.sel);
    if (Input.anyHit('jump') || Input.code('Escape')) { Sound.play('1/m_cancel'); Game.setScreen(new TitleScreen()); return; }
    if (Input.anyHit('att') || Input.code('Enter')) {
      Sound.play('1/m_ok');
      const m = MODES[this.sel].key;
      if (m === 'back') Game.setScreen(new TitleScreen());
      else if (m === 'demo') startDemo();
      else Game.setScreen(new SelectScreen(m));
    }
  }
  draw(ctx) {
    menuBackdrop(ctx, this.t);
    drawLogo(ctx, LF.W / 2, 130, 0.62, this.t);
    drawMenuList(ctx, MODES, this.sel, 260);
    text(ctx, MODES[this.sel].desc, LF.W / 2, 440, { align: 'center', bold: false, color: '#9aa3d8' });
  }
}

// ---- seleção de lutadores (8 vagas, como no LF2) ----

function characterList() {
  const order = [11, 10, 9, 8, 7, 6, 5, 4, 2, 1, 50, 51, 52, 53, 54, 30];
  const chars = Assets.data.objects.filter((o) => o.type === 'character');
  return chars.sort((a, b) => {
    const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}

const DIFFICULTIES = ['Fácil', 'Normal', 'Difícil', 'Maluco!'];
const STAGE_NAMES = ['Fase 1', 'Fase 2', 'Fase 3', 'Fase 4', 'Fase 5'];

class SelectScreen {
  constructor(mode, keep) {
    this.mode = mode;
    this.chars = characterList();
    this.t = 0;
    this.slots = keep ? keep.slots : [...Array(8)].map(() => ({ use: false, step: 0, type: 'human', team: 0, sel: -1, player: -1 }));
    this.step = keep ? 3 : 0;
    this.bg = keep ? keep.bg : -1;
    this.stage = keep ? keep.stage : 0;
    this.dialogSel = 0;
    this.numComputers = 0;
    this.howMany = { low: 0, high: 0, sel: 0 };
    this.settingComputer = -1;
    this.done = 0;
    if (keep) this.rollRandom();
  }

  bgList() { return Assets.backgrounds; }

  // jogador humano p ocupa a vaga p (como no LF2 local)
  update() {
    this.t++;
    if (this.step === 0) this.updateHumans();
    else if (this.step === 1) this.updateHowMany();
    else if (this.step === 2) this.updateComputers();
    else this.updateDialog();
  }

  cycleChar(s, d) {
    const n = this.chars.length;
    s.sel += d;
    if (s.sel >= n) s.sel = s.type === 'human' ? -1 : 0;
    if (s.sel < (s.type === 'human' ? -1 : 0)) s.sel = n - 1;
  }

  updateHumans() {
    if (Input.code('Escape')) { Game.setScreen(new ModeScreen()); return; }
    for (let p = 0; p < 4; p++) {
      const s = this.slots[p];
      if (Input.hit(p, 'att')) {
        if (!s.use) { s.use = true; s.type = 'human'; s.player = p; s.step = 0; }
        if (s.step < 3) s.step++;
        if (this.mode === 'stage' && s.step === 2) { s.team = 1; s.step = 3; }
        Sound.play('1/m_join');
        const humans = this.slots.filter((x) => x.use);
        if (humans.length && humans.every((x) => x.step === 3)) this.enterHowMany();
      }
      if (Input.hit(p, 'jump') && s.use) {
        s.step--;
        if (this.mode === 'stage' && s.step === 2) s.step = 1;
        if (s.step <= 0) { s.use = false; s.step = 0; }
        Sound.play('1/m_cancel');
      }
      if (s.step === 1) {
        if (Input.hit(p, 'left')) this.cycleChar(s, -1);
        if (Input.hit(p, 'right')) this.cycleChar(s, 1);
      } else if (s.step === 2) {
        if (Input.hit(p, 'left')) s.team = (s.team + 4) % 5;
        if (Input.hit(p, 'right')) s.team = (s.team + 1) % 5;
      }
    }
  }

  enterHowMany() {
    const used = this.slots.filter((s) => s.use);
    let low = 0;
    const high = 8 - used.length;
    if (this.mode === 'stage') { low = 0; }
    else {
      // sem adversário humano é preciso ao menos um computador
      const t = used[0].team;
      if (used.length === 1 || used.every((s) => s.team === t && t !== 0)) low = 1;
    }
    this.howMany = { low, high: this.mode === 'stage' ? Math.min(high, 3) : high, sel: low };
    this.step = 1;
  }

  updateHowMany() {
    const H = this.howMany;
    if (Input.anyHit('left')) H.sel = H.sel > H.low ? H.sel - 1 : H.high;
    if (Input.anyHit('right')) H.sel = H.sel < H.high ? H.sel + 1 : H.low;
    if (Input.anyHit('jump')) {
      for (const s of this.slots) if (s.use) s.step = this.mode === 'stage' ? 1 : 2;
      this.step = 0;
      Sound.play('1/m_cancel');
      return;
    }
    if (Input.anyHit('att')) {
      Sound.play('1/m_ok');
      this.numComputers = H.sel;
      this.done = 0;
      this.step = 2;
      this.nextComputer();
    }
  }

  nextComputer() {
    if (this.done === this.numComputers) { this.enterDialog(); return; }
    const i = this.slots.findIndex((s) => !s.use);
    if (i < 0) { this.enterDialog(); return; }
    this.settingComputer = i;
    Object.assign(this.slots[i], { use: true, step: 1, type: 'computer', team: this.mode === 'stage' ? 1 : 0, sel: -1, player: -1 });
    // computadores também podem ser aleatórios: o padrão é o primeiro da lista
    this.slots[i].sel = 0;
  }

  updateComputers() {
    const s = this.slots[this.settingComputer];
    if (!s) { this.enterDialog(); return; }
    if (Input.anyHit('att')) {
      s.step++;
      if (this.mode === 'stage' && s.step === 2) s.step = 3;
      Sound.play('1/m_join');
      if (s.step === 3) { this.done++; this.nextComputer(); }
    }
    if (Input.anyHit('jump')) {
      if (s.step > 1) s.step--;
      Sound.play('1/m_cancel');
    }
    if (s.step === 1) {
      if (Input.anyHit('left')) this.cycleChar(s, -1);
      if (Input.anyHit('right')) this.cycleChar(s, 1);
    } else if (s.step === 2) {
      if (Input.anyHit('left')) s.team = (s.team + 4) % 5;
      if (Input.anyHit('right')) s.team = (s.team + 1) % 5;
    }
  }

  enterDialog() {
    this.step = 3;
    for (const s of this.slots) s.random = s.use && s.sel === -1;
    this.rollRandom();
  }

  rollRandom() {
    for (const s of this.slots) if (s.random) s.pick = Math.floor(Math.random() * this.chars.length);
  }

  dialogData() { return Assets.data.ui[this.mode === 'stage' ? 'stage_mode_dialog' : 'vs_mode_dialog'] || Assets.data.ui.vs_mode_dialog; }

  updateDialog() {
    const D = this.dialogData();
    this.dialogSel = navVertical(D.item.length, this.dialogSel);
    const dir = Input.anyHit('right') ? 1 : Input.anyHit('left') ? -1 : 0;
    if (dir) {
      if (this.dialogSel === 3) {
        if (this.mode === 'stage') this.stage = (this.stage + dir + 5) % 5;
        else {
          const n = this.bgList().length;
          this.bg = ((this.bg + 1 + dir + n + 1) % (n + 1)) - 1;
        }
      }
      if (this.dialogSel === 4) Game.difficulty = (Game.difficulty + dir + 4) % 4;
    }
    if (Input.anyHit('att')) {
      Sound.play('1/m_ok');
      switch (this.dialogSel) {
        case 0: this.fight(); break;
        case 1: Game.setScreen(new SelectScreen(this.mode)); break;
        case 2: this.rollRandom(); break;
        case 3:
          if (this.mode === 'stage') this.stage = (this.stage + 1) % 5;
          else { const n = this.bgList().length; this.bg = ((this.bg + 2) % (n + 1)) - 1; }
          break;
        case 4: Game.difficulty = (Game.difficulty + 1) % 4; break;
        case 5: Game.setScreen(new TitleScreen()); break;
      }
    }
  }

  charOf(s) {
    const i = s.sel === -1 ? s.pick : s.sel;
    return this.chars[i] || this.chars[0];
  }

  fight() {
    const keep = { slots: this.slots, bg: this.bg, stage: this.stage };
    const players = [];
    this.slots.forEach((s, i) => {
      if (!s.use) return;
      const c = this.charOf(s);
      const human = s.type === 'human';
      players.push({
        id: c.id,
        team: s.team ? s.team : 100 + i,
        con: human ? Input.controllers[s.player] : new Controller(),
        player: human ? s.player : -1,
        ai: human ? null : Game.difficulty,
        name: human ? `${s.player + 1}P` : 'COM',
      });
    });
    const back = () => Game.setScreen(new SelectScreen(this.mode, keep));
    if (this.mode === 'stage') {
      startStage(players, this.stage, back);
    } else {
      const list = this.bgList();
      const bg = this.bg < 0 ? list[Math.floor(Math.random() * list.length)].id : list[this.bg].id;
      startMatch({ players, bg, mode: 'vs', onEnd: back });
    }
  }

  // ---- desenho ----

  draw(ctx) {
    const S = Assets.data.ui.character_selection;
    ctx.fillStyle = S.bg_color;
    ctx.fillRect(0, 0, LF.W, LF.H);
    const pic = uiImg(S.pic);
    if (pic) ctx.drawImage(pic, 0, 0);
    text(ctx, this.mode === 'stage' ? 'História' : 'Versus', 60, 38, { size: 14, color: '#afdcff' });
    for (let i = 0; i < 8; i++) this.drawSlot(ctx, i);
    if (this.step === 1) this.drawHowMany(ctx);
    if (this.step === 3) this.drawDialog(ctx);
    if (this.step === 0) text(ctx, 'ATAQUE entra/confirma · PULO volta · ←/→ escolhe', LF.W / 2, 520, { align: 'center', bold: false, size: 12, color: '#afdcff' });
  }

  drawSlot(ctx, i) {
    const S = Assets.data.ui.character_selection, s = this.slots[i];
    const x = S.posx[i % 4], row = i < 4 ? 0 : 4;
    const by = S.posy[row], ty = [S.posy[row + 1], S.posy[row + 2], S.posy[row + 3]];
    const W = S.box_width, H = S.box_height, TW = S.text.box_width, TH = S.text.box_height;
    const blink = Math.floor(this.t / 6) % 2 === 0 ? S.text.color[0] : S.text.color[1];
    const stat = s.type === 'human' ? S.text.color[2] : S.text.color[3];
    const cx = x + TW / 2;
    if (!s.use) {
      if (this.step === 0) {
        const w = uiImg(S.waiting.pic);
        if (w) ctx.drawImage(w, (Math.floor(this.t / 8) % 2) * W, 0, W, H, x, by, W, H);
        text(ctx, 'Join?', cx, ty[0] + TH / 2, { align: 'center', color: blink });
      }
      return;
    }
    const step = s.step;
    // "Random" só revela o lutador sorteado no menu final
    const c = s.sel >= 0 ? this.chars[s.sel] : (this.step === 3 && s.random ? this.chars[s.pick] : null);
    if (step >= 1) {
      const img = c ? uiImg(c.data.bmp.head) : uiImg(S.random.pic);
      if (img) ctx.drawImage(img, x, by, W, H);
    } else {
      const w = uiImg(S.waiting.pic);
      if (w) ctx.drawImage(w, (Math.floor(this.t / 8) % 2) * W, 0, W, H, x, by, W, H);
    }
    const name = s.type === 'human' ? `${s.player + 1}P` : 'Computer';
    text(ctx, step === 0 ? 'Join?' : name, cx, ty[0] + TH / 2, { align: 'center', color: step <= 1 && this.isActive(s) ? (step === 0 ? blink : stat) : stat, max: TW });
    if (step >= 1) {
      const fname = c ? c.name : 'Random';
      text(ctx, fname, cx, ty[1] + TH / 2, { align: 'center', color: step === 1 && this.isActive(s) ? blink : stat, max: TW });
    }
    if (step >= 2 && this.mode !== 'stage') {
      text(ctx, s.team === 0 ? 'Independent' : `Team ${s.team}`, cx, ty[2] + TH / 2, { align: 'center', color: step === 2 && this.isActive(s) ? blink : stat, max: TW });
    }
  }

  isActive(s) {
    if (this.step === 0) return s.type === 'human';
    if (this.step === 2) return this.slots[this.settingComputer] === s;
    return false;
  }

  drawHowMany(ctx) {
    const D = Assets.data.ui.how_many_computer_players, H = this.howMany;
    const bg = uiImg(D.bg);
    if (bg) ctx.drawImage(bg, D.x, D.y);
    for (let i = 0; i <= 7; i++) {
      const x = D.x + D.item_x + i * D.item_space, y = D.y + D.item_y;
      text(ctx, String(i), x + D.item_width / 2, y + D.item_height / 2, { align: 'center', color: i >= H.low && i <= H.high ? D.active_color : D.inactive_color });
      if (i === H.sel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, D.item_width, D.item_height); }
    }
  }

  drawDialog(ctx) {
    const D = this.dialogData();
    const x = Math.round((LF.W - D.width) / 2), y = Math.round((LF.H - D.height) / 2);
    drawMenuImage(ctx, D, x, y, this.dialogSel);
    const t1 = D.text[0], t2 = D.text[1];
    const bgName = this.mode === 'stage' ? STAGE_NAMES[this.stage] : (this.bg < 0 ? 'Random' : this.bgList()[this.bg].name);
    text(ctx, bgName, x + t1[0] + 3, y + t1[1] + t1[3] / 2, { color: D.text_color, bold: false, max: t1[2] - 4 });
    text(ctx, DIFFICULTIES[Game.difficulty], x + t2[0] + 3, y + t2[1] + t2[3] / 2, { color: D.text_color, bold: false, max: t2[2] - 4 });
  }
}

// ---- configuração de teclas ----

class ControlsScreen {
  constructor() { this.p = 0; this.a = 0; this.waiting = false; this.okSel = false; }
  update() {
    if (this.waiting) return;
    if (Input.code('Escape')) { Input.save(); Game.setScreen(new TitleScreen()); return; }
    if (Input.code('ArrowUp')) this.a = (this.a + KEY_ACTIONS.length) % (KEY_ACTIONS.length + 1);
    if (Input.code('ArrowDown')) this.a = (this.a + 1) % (KEY_ACTIONS.length + 1);
    if (Input.code('ArrowLeft')) this.p = (this.p + 3) % 4;
    if (Input.code('ArrowRight')) this.p = (this.p + 1) % 4;
    if (Input.code('Enter')) {
      if (this.a === KEY_ACTIONS.length) { Input.save(); Sound.play('1/m_ok'); Game.setScreen(new TitleScreen()); return; }
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
    const S = Assets.data.ui.settings;
    ctx.fillStyle = S.bg_color;
    ctx.fillRect(0, 0, LF.W, LF.H);
    const pic = uiImg(S.pic);
    if (pic) ctx.drawImage(pic, 0, 0);
    const x0 = 70, y0 = 170, cw = 160, rh = 30;
    ctx.fillStyle = S.leftmost_column_bg_color;
    ctx.fillRect(x0 - 10, y0 - 22, 110, rh * 8 + 8);
    for (let p = 0; p < 4; p++) {
      text(ctx, `Player ${p + 1}`, x0 + 120 + p * cw, y0 - 8, { color: p === this.p ? '#fff' : '#9b9bff' });
    }
    KEY_ACTIONS.forEach((a, i) => {
      const y = y0 + 18 + i * rh;
      text(ctx, KEY_LABELS[a], x0, y, { color: S.leftmost_column_text_color });
      for (let p = 0; p < 4; p++) {
        const on = p === this.p && i === this.a;
        if (on) { ctx.fillStyle = this.waiting ? '#ff9b9b' : '#5068c0'; ctx.fillRect(x0 + 110 + p * cw, y - 11, cw - 12, 22); }
        text(ctx, on && this.waiting ? 'aperte uma tecla' : keyName(Input.keys[p][a]), x0 + 120 + p * cw, y, { color: '#fff', bold: false });
      }
    });
    const ok = S.ok_button, okImg = uiImg(ok.pic);
    if (okImg) ctx.drawImage(okImg, this.a === KEY_ACTIONS.length ? ok.width : 0, 0, ok.width, ok.height, ok.x, ok.y, ok.width, ok.height);
    text(ctx, 'Setas escolhem · Enter troca a tecla · Delete apaga · Esc sai e salva', LF.W / 2, 500, { align: 'center', bold: false, size: 12, color: '#afdcff' });
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
  const n = 4;
  const players = [];
  for (let i = 0; i < n; i++) {
    players.push({ id: chars[Math.floor(Math.random() * chars.length)].id, team: 100 + i, con: new Controller(), ai: 3, name: 'COM' });
  }
  const bgs = Assets.backgrounds;
  const m = startMatch({
    players, bg: bgs[Math.floor(Math.random() * bgs.length)].id, mode: 'demo',
    onEnd: () => Game.setScreen(new ModeScreen()),
  });
  m.demo = true;
}
