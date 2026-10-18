'use strict';
// Telas de Ajustes e Sobre. Os ajustes são salvos na hora (ver save.js).

const APP_VERSION = '2.0';

// rótulo de botão: texto escuro sobre o destaque amarelo, claro fora dele
function btnLabel(ctx, s, x, y, on) {
  ctx.font = displayFont(20);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = on ? '#120a1e' : UI.text;
  ctx.fillText(s, x, y + 1);
}

class SettingsScreen {
  constructor() { this.sel = 0; this.t = 0; this.confirm = false; }

  items() {
    const s = Save.settings;
    const pct = (v) => `${v * 10}%`;
    return [
      { k: 'sfx', label: 'Efeitos sonoros', value: pct(s.sfx) },
      { k: 'music', label: 'Música', value: pct(s.music) },
      { k: 'difficulty', label: 'Dificuldade padrão', value: DIFFICULTIES[s.difficulty] },
      { k: 'touchScale', label: 'Tamanho dos botões do celular', value: pct(s.touchScale) },
      { k: 'touchOpacity', label: 'Opacidade dos botões do celular', value: pct(s.touchOpacity) },
      { k: 'vibrate', label: 'Vibração ao apanhar', value: s.vibrate ? 'Ligada' : 'Desligada' },
      { k: 'keys', label: 'Teclas do teclado' },
      { k: 'back', label: 'Voltar' },
    ];
  }

  update() {
    this.t++;
    const items = this.items(), s = Save.settings;
    this.sel = navVertical(items.length, this.sel);
    const it = items[this.sel];
    const d = Input.anyHit('right') ? 1 : Input.anyHit('left') ? -1 : 0;
    if (d) {
      Sound.play('m_pass');
      const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
      if (it.k === 'sfx' || it.k === 'music') s[it.k] = clamp(s[it.k] + d, 0, 10);
      else if (it.k === 'touchScale') s.touchScale = clamp(s.touchScale + d, 0, 10);
      else if (it.k === 'touchOpacity') s.touchOpacity = clamp(s.touchOpacity + d, 0, 10);
      else if (it.k === 'difficulty') s.difficulty = (s.difficulty + d + 4) % 4;
      else if (it.k === 'vibrate') { s.vibrate = s.vibrate ? 0 : 1; if (s.vibrate) buzz(40); }
      Save.save();
      Save.apply();
      if (it.k === 'sfx') Sound.play('hit');
    }
    if (backHit()) { Sound.play('m_cancel'); Game.setScreen(new TitleScreen()); return; }
    if (confirmHit()) {
      Sound.play('m_ok');
      if (it.k === 'keys') Game.setScreen(new ControlsScreen(() => new SettingsScreen()));
      else if (it.k === 'back') Game.setScreen(new TitleScreen());
      else if (it.k === 'vibrate') { s.vibrate = s.vibrate ? 0 : 1; Save.save(); }
    }
  }

  draw(ctx) {
    menuBackdrop(ctx, this.t);
    title(ctx, 'AJUSTES', LF.W / 2, 38, 38, UI.amber);
    const items = this.items(), w = 560, x = (LF.W - w) / 2, y0 = 82, rh = 41;
    panelBox(ctx, x - 14, y0 - 20, w + 28, items.length * rh + 12);
    items.forEach((it, i) => {
      const y = y0 + i * rh + 8, on = i === this.sel;
      if (on) { ctx.fillStyle = 'rgba(255,176,0,0.16)'; ctx.fillRect(x - 8, y - 17, w + 16, 34); }
      if (it.value === undefined) {
        text(ctx, it.label, x + 8, y, { size: 16, color: on ? UI.amber : UI.text });
        if (it.k === 'keys') text(ctx, '›', x + w - 8, y, { align: 'right', size: 20, color: on ? UI.amber : UI.muted });
      } else {
        text(ctx, it.label, x + 8, y, { size: 15, color: on ? UI.text : UI.muted });
        const v = on ? `◀  ${it.value}  ▶` : it.value;
        text(ctx, v, x + w - 8, y, { align: 'right', size: 15, color: on ? UI.amber : UI.text });
      }
    });
    text(ctx, 'Os ajustes são salvos automaticamente.', LF.W / 2, 454, { align: 'center', bold: false, size: 12, color: UI.dim });
  }
}

// ---- Sobre: versão, números do jogador, privacidade e créditos ----

class AboutScreen {
  constructor() { this.sel = 0; this.t = 0; this.confirm = false; }

  update() {
    this.t++;
    if (backHit() && !this.confirm) { Sound.play('m_cancel'); Game.setScreen(new TitleScreen()); return; }
    if (this.confirm) {
      if (Input.anyHit('left') || Input.anyHit('right') || Input.anyHit('up') || Input.anyHit('down')) this.sel = this.sel ? 0 : 1;
      if (backHit()) { this.confirm = false; Sound.play('m_cancel'); }
      else if (confirmHit()) {
        if (this.sel === 1) { Save.resetProgress(); Sound.play('m_ok'); }
        this.confirm = false;
      }
      return;
    }
    if (Input.anyHit('down') || Input.anyHit('up')) { this.sel = this.sel ? 0 : 1; Sound.play('m_pass'); }
    if (confirmHit()) {
      Sound.play('m_ok');
      if (this.sel === 0) Game.setScreen(new TitleScreen());
      else { this.confirm = true; this.sel = 0; }
    }
  }

  draw(ctx) {
    menuBackdrop(ctx, this.t);
    title(ctx, 'SOBRE', LF.W / 2, 34, 36, UI.amber);
    const p = Save.progress;
    const min = Math.floor(p.seconds / 60);
    const lines = [
      [`Punho Livre ${APP_VERSION}`, 18, UI.text],
      ['Lutadores, golpes, cenários, efeitos e sons criados para este jogo.', 13, UI.muted],
      ['Este app não coleta dados pessoais e não tem anúncios.', 13, UI.muted],
      ['No jogo em rede, só o seu apelido e as teclas vão ao servidor escolhido.', 13, UI.muted],
    ];
    lines.forEach(([s, size, color], i) => text(ctx, s, LF.W / 2, 78 + i * 22, { align: 'center', size, color, bold: i === 0 }));
    panelBox(ctx, 150, 180, 494, 150, UI.amber);
    title(ctx, 'SEU PROGRESSO', LF.W / 2, 204, 22, UI.text);
    const stats = [['Lutas', p.fights], ['Vitórias', p.wins], ['Nocautes', p.kos], ['Tempo de jogo', `${min} min`],
      ['Fase mais avançada', `${Math.min(STAGES.length, p.storyBest + 1)} de ${STAGES.length}`], ['História concluída', `${p.storyClears}×`]];
    stats.forEach(([k, v], i) => {
      const col = i % 2, row = Math.floor(i / 2);
      text(ctx, k, 176 + col * 240, 238 + row * 28, { size: 13, color: UI.muted });
      text(ctx, String(v), 176 + col * 240 + 220 - (col ? 20 : 0), 238 + row * 28, { align: 'right', size: 14, color: UI.text });
    });
    const opts = ['Voltar', 'Apagar progresso'];
    opts.forEach((o, i) => {
      const on = !this.confirm && i === this.sel, y = 372 + i * 38;
      if (on) { ctx.fillStyle = UI.amber; ctx.fillRect(LF.W / 2 - 120, y - 15, 240, 30); }
      btnLabel(ctx, o, LF.W / 2, y, on);
    });
    if (this.confirm) {
      ctx.fillStyle = 'rgba(5,8,20,0.82)'; ctx.fillRect(0, 0, LF.W, LF.H);
      panelBox(ctx, 200, 150, 394, 150, UI.bad);
      text(ctx, 'Apagar todo o progresso?', LF.W / 2, 190, { align: 'center', size: 18 });
      text(ctx, 'Lutas, vitórias e fases liberadas voltam a zero.', LF.W / 2, 216, { align: 'center', bold: false, size: 13, color: UI.muted });
      ['Não', 'Sim, apagar'].forEach((o, i) => {
        const on = i === this.sel, x = LF.W / 2 + (i ? 80 : -80);
        if (on) { ctx.fillStyle = i ? UI.bad : UI.amber; ctx.fillRect(x - 70, 250 - 15, 140, 30); }
        btnLabel(ctx, o, x, 250, on);
      });
    }
  }
}

// ---- Como jogar: três páginas curtas ----

class HowToScreen {
  constructor() { this.page = 0; this.t = 0; }

  pages() {
    const k = Input.keys[0];
    const touch = Input.touchActive;
    return [
      {
        title: 'Controles',
        rows: touch ? [
          ['Direcional', 'move (8 direções). Levar o dedo até a borda faz correr.'],
          ['A', 'ataca. Toques seguidos fazem combos.'],
          ['J', 'pula. Segure uma direção para pular para o lado.'],
          ['D', 'defende. Com o direcional e A/J faz os golpes especiais.'],
          ['Botões laranja', 'fazem o golpe especial inteiro com um toque.'],
          ['Controle bluetooth', 'A ataca, B pula, X defende, Start pausa.'],
        ] : [
          ['Mover', `${keyName(k.up)} ${keyName(k.left)} ${keyName(k.down)} ${keyName(k.right)}. Toque duplo para frente corre.`],
          ['Ataque', `${keyName(k.att)}. Toques seguidos fazem combos.`],
          ['Pulo', `${keyName(k.jump)}. Segure uma direção para pular para o lado.`],
          ['Defesa', `${keyName(k.def)}. Com direção e Ataque/Pulo faz especiais.`],
          ['Pausa', 'Esc (ou Start no controle).'],
          ['Controle bluetooth', 'A ataca, B pula, X defende, Start pausa.'],
        ],
      },
      {
        title: 'Golpes',
        rows: [
          ['Especiais', 'Defesa + direção + Ataque ou Pulo, em sequência rápida. Gastam MP.'],
          ['Correndo', 'Ataque durante a corrida dá um golpe longo; Defesa rola para o lado.'],
          ['No ar', 'Ataque durante o pulo ou o avanço acerta com um chute.'],
          ['Agarrar', 'Ande até um inimigo tonto: soque com Ataque, arremesse com direção + Ataque.'],
          ['Armas', 'Ataque perto de uma arma a pega. Bastões batem; pedra e caixa se arremessam.'],
          ['Defender', 'Defesa reduz o dano, mas golpes fortes quebram a guarda.'],
        ],
      },
      {
        title: 'Dicas',
        rows: [
          ['Vida escura', 'A parte escura da barra volta aos poucos se você não apanhar mais.'],
          ['MP', 'Recupera sozinho e mais rápido quanto mais vida você perdeu.'],
          ['Quedas', 'Aperte Pulo no ar ao cair para rolar e se levantar sem apanhar.'],
          ['Times', 'No Versus, jogadores do mesmo time não se machucam.'],
          ['História', 'Cada fase vencida libera a próxima. Chefes aparecem no fim.'],
          ['Treino', 'Boneco que não cai, com MP infinito, para aprender os especiais.'],
        ],
      },
    ];
  }

  update() {
    this.t++;
    const n = this.pages().length;
    if (Input.anyHit('right') || Input.anyHit('att') || Input.code('Enter')) {
      if (this.page < n - 1) { this.page++; Sound.play('m_pass'); } else { Sound.play('m_ok'); Game.setScreen(new ModeScreen()); }
    }
    if (Input.anyHit('left')) { this.page = Math.max(0, this.page - 1); Sound.play('m_pass'); }
    if (backHit()) { Sound.play('m_cancel'); Game.setScreen(new ModeScreen()); }
  }

  draw(ctx) {
    menuBackdrop(ctx, this.t);
    const pg = this.pages()[this.page];
    title(ctx, `COMO JOGAR · ${pg.title.toUpperCase()}`, LF.W / 2, 36, 32, UI.amber);
    const x = 70, w = LF.W - 140;
    panelBox(ctx, x - 14, 70, w + 28, 330);
    pg.rows.forEach(([k, v], i) => {
      const y = 100 + i * 50;
      text(ctx, k, x, y, { size: 15, color: UI.amber });
      wrapText(ctx, v, x + 160, y - 8, w - 170, 17, { bold: false, size: 14, color: UI.text });
    });
    for (let i = 0; i < this.pages().length; i++) {
      ctx.fillStyle = i === this.page ? UI.amber : UI.dim;
      ctx.beginPath(); ctx.arc(LF.W / 2 + (i - 1) * 20, 424, 5, 0, Math.PI * 2); ctx.fill();
    }
    text(ctx, this.page < 2 ? '▶ próxima página · Esc volta' : 'Esc ou ▶ voltam ao menu', LF.W / 2, 450, { align: 'center', bold: false, size: 12, color: UI.muted });
  }
}
