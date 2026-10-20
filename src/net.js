'use strict';
// Jogo em rede. Todos os aparelhos simulam a mesma partida ("lockstep"):
// cada um envia as próprias teclas marcadas com o quadro em que valem
// (alguns quadros à frente, para dar tempo de chegarem) e só avança um
// quadro quando já tem as teclas de todos os jogadores para ele.

const NET_DELAY = 4;            // quadros de atraso das teclas (~130 ms)
const NET_HASH_EVERY = 60;      // a cada 2 s os aparelhos comparam o estado

const Net = {
  ws: null,
  slot: -1,
  code: '',
  room: null,
  onMessage: null,

  server() {
    try { return localStorage.getItem('pl.server') || ''; } catch (e) { return ''; }
  },

  url(addr) {
    addr = addr.trim().replace(/\/+$/, '');
    if (/^wss?:\/\//.test(addr)) return addr.replace(/\/ws$/, '') + '/ws';
    if (/^https?:\/\//.test(addr)) return addr.replace(/^http/, 'ws').replace(/\/ws$/, '') + '/ws';
    // endereços locais (IP, localhost ou com porta) usam ws://; domínios usam wss://
    const local = /^(localhost|\d+\.\d+\.\d+\.\d+)(:\d+)?$/.test(addr) || /:\d+$/.test(addr);
    const secure = location.protocol === 'https:' || !local;
    return `${secure ? 'wss' : 'ws'}://${addr}/ws`;
  },

  connect(addr, first) {
    this.close();
    return new Promise((resolve, reject) => {
      let ws;
      try { ws = new WebSocket(this.url(addr)); } catch (e) { reject(new Error('Endereço do servidor inválido.')); return; }
      this.ws = ws;
      const timer = setTimeout(() => { ws.close(); reject(new Error('O servidor não respondeu.')); }, 8000);
      ws.onopen = () => { clearTimeout(timer); ws.send(JSON.stringify(first)); resolve(); };
      ws.onerror = () => { clearTimeout(timer); reject(new Error('Não foi possível conectar ao servidor.')); };
      ws.onclose = () => { if (this.ws === ws) { this.ws = null; if (this.onMessage) this.onMessage({ t: 'closed' }); } };
      ws.onmessage = (e) => {
        let m;
        try { m = JSON.parse(e.data); } catch (err) { return; }
        if (m.t === 'joined') { this.slot = m.slot; this.code = m.code; }
        if (m.t === 'room') this.room = m;
        if (this.onMessage) this.onMessage(m);
      };
    });
  },

  send(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); },

  close() {
    if (this.ws) { const ws = this.ws; this.ws = null; try { ws.close(); } catch (e) { /* já fechado */ } }
    this.room = null;
    this.slot = -1;
  },

  isHost() { return this.room && this.room.host === this.slot; },
};

// ---- tela de conexão (formulário HTML por cima do jogo) ----

class NetScreen {
  constructor() { this.t = 0; }

  enter() {
    const f = document.getElementById('netform');
    this.form = f;
    f.hidden = false;
    const $ = (id) => document.getElementById(id);
    const server = $('net-server'), name = $('net-name'), code = $('net-code'), status = $('net-status');
    let saved = Net.server();
    if (!saved && /^https?:$/.test(location.protocol)) saved = location.host;
    server.value = saved;
    try { name.value = localStorage.getItem('pl.name') || ''; } catch (e) { /* sem armazenamento */ }
    status.textContent = '';
    const go = (first) => {
      if (!server.value.trim()) { status.textContent = 'Informe o endereço do servidor.'; server.focus(); return; }
      try {
        localStorage.setItem('pl.server', server.value.trim());
        localStorage.setItem('pl.name', name.value.trim());
      } catch (e) { /* sem armazenamento */ }
      status.textContent = 'Conectando...';
      Net.onMessage = (m) => {
        if (m.t === 'error') status.textContent = m.msg;
        if (m.t === 'joined') { this.leave(); Game.setScreen(new NetLobbyScreen()); }
      };
      Net.connect(server.value, { ...first, name: name.value.trim() }).catch((e) => { status.textContent = e.message; });
    };
    $('net-create').onclick = () => go({ t: 'create' });
    $('net-join').onclick = () => {
      if (!/^[A-Za-z]{4}$/.test(code.value.trim())) { status.textContent = 'O código da sala tem 4 letras.'; code.focus(); return; }
      go({ t: 'join', code: code.value.trim().toUpperCase() });
    };
    $('net-back').onclick = () => { this.leave(); Net.close(); Game.setScreen(new TitleScreen()); };
    f.onsubmit = (e) => e.preventDefault();
    setTimeout(() => (server.value ? name : server).focus(), 50);
  }

  leave() {
    if (this.form) this.form.hidden = true;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  update() {
    this.t++;
    if (Input.code('Escape')) { this.leave(); Net.close(); Game.setScreen(new TitleScreen()); }
  }
  draw(ctx) {
    menuBackdrop(ctx, this.t);
    drawLogo(ctx, LF.W / 2, 90, 0.45, this.t);
  }
}

// ---- sala de espera ----

class NetLobbyScreen {
  constructor() {
    this.t = 0;
    this.chars = characterList();
    this.row = 0;
    this.me = { char: -1, team: 0, ready: false };
    this.msg = '';
    Net.onMessage = (m) => this.onMessage(m);
    const mine = Net.room && Net.room.players.find((p) => p.slot === Net.slot);
    if (mine) this.me = { char: mine.char, team: mine.team, ready: false };
    this.sendPick();
  }

  onMessage(m) {
    if (m.t === 'start') startNetMatch(m.setup, m.seed);
    if (m.t === 'closed') { this.msg = 'Conexão perdida com o servidor.'; this.closed = true; }
    if (m.t === 'error') this.msg = m.msg;
  }

  rows() {
    const r = ['char', 'team'];
    if (Net.isHost()) r.push('cpus', 'difficulty', 'bg', 'fight');
    else r.push('ready');
    return r;
  }

  sendPick() { Net.send({ t: 'pick', char: this.me.char, team: this.me.team, ready: this.me.ready || Net.isHost() }); }

  update() {
    this.t++;
    if (Input.code('Escape') || this.closed && Input.anyHit('att')) {
      Net.close();
      Game.setScreen(new TitleScreen());
      return;
    }
    if (!Net.room) return;
    const rows = this.rows(), n = rows.length;
    if (Input.hit(0, 'up') || Input.hit(1, 'up')) this.row = (this.row + n - 1) % n;
    if (Input.hit(0, 'down') || Input.hit(1, 'down')) this.row = (this.row + 1) % n;
    this.row = Math.min(this.row, n - 1);
    const d = (Input.hit(0, 'right') || Input.hit(1, 'right')) ? 1 : (Input.hit(0, 'left') || Input.hit(1, 'left')) ? -1 : 0;
    const att = Input.hit(0, 'att') || Input.hit(1, 'att') || Input.code('Enter');
    const S = { ...Net.room.settings };
    const row = rows[this.row];
    if (d) {
      Sound.play('m_pass');
      if (row === 'char') {
        const N = this.chars.length;
        this.me.char = ((this.me.char + 1 + d + N + 1) % (N + 1)) - 1;
        this.me.ready = false;
        this.sendPick();
      } else if (row === 'team') {
        this.me.team = (this.me.team + d + 5) % 5;
        this.me.ready = false;
        this.sendPick();
      } else if (row === 'cpus') { S.cpus = Math.max(0, Math.min(8 - Net.room.players.length, S.cpus + d)); Net.send({ t: 'settings', ...S }); }
      else if (row === 'difficulty') { S.difficulty = (S.difficulty + d + 4) % 4; Net.send({ t: 'settings', ...S }); }
      else if (row === 'bg') {
        const B = Assets.backgrounds.length;
        S.bg = ((S.bg + 1 + d + B + 1) % (B + 1)) - 1;
        Net.send({ t: 'settings', ...S });
      }
    }
    if (att) {
      if (row === 'ready') { this.me.ready = !this.me.ready; this.sendPick(); Sound.play('m_join'); }
      if (row === 'fight') this.fight();
    }
  }

  fight() {
    const room = Net.room, S = room.settings;
    if (!room.players.every((p) => p.ready || p.slot === Net.slot)) { this.msg = 'Espere todos marcarem "pronto".'; return; }
    const total = room.players.length + S.cpus;
    const teams = new Set(room.players.map((p) => p.team || 'solo' + p.slot));
    for (let i = 0; i < S.cpus; i++) teams.add('cpu' + i);
    if (total < 2 || teams.size < 2) { this.msg = 'É preciso ter pelo menos dois lados na luta.'; return; }
    const pick = (c) => (c >= 0 && this.chars[c] ? this.chars[c].id : this.chars[Math.floor(Math.random() * this.chars.length)].id);
    const players = room.players.map((p) => ({ slot: p.slot, id: pick(p.char), team: p.team || 100 + p.slot, name: p.name }));
    for (let i = 0; i < S.cpus; i++) players.push({ slot: -1, id: pick(-1), team: 110 + i, name: 'COM' });
    const bgs = Assets.backgrounds;
    const bg = S.bg < 0 ? bgs[Math.floor(Math.random() * bgs.length)].id : bgs[S.bg].id;
    Net.send({ t: 'start', setup: { players, bg, difficulty: S.difficulty } });
    Sound.play('m_ok');
  }

  draw(ctx) {
    menuBackdrop(ctx, this.t);
    ctx.font = `30px ${LOGO_FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffb000';
    ctx.fillText('SALA', 40, 44);
    ctx.font = `46px ${LOGO_FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(Net.code || '----', 110, 44);
    text(ctx, 'Passe este código para os amigos entrarem', 250, 46, { bold: false, size: 13, color: '#9aa3d8' });
    if (!Net.room) { text(ctx, 'Entrando...', LF.W / 2, 270, { align: 'center' }); return; }
    const room = Net.room;
    // jogadores
    for (let s = 0; s < 4; s++) {
      const p = room.players.find((q) => q.slot === s);
      const x = 40 + s * 182, y = 72;
      ctx.fillStyle = p ? 'rgba(20,26,60,0.95)' : 'rgba(20,26,60,0.45)';
      ctx.fillRect(x, y, 170, 160);
      if (!p) { text(ctx, 'Vaga livre', x + 85, y + 80, { align: 'center', bold: false, color: '#5b5f86' }); continue; }
      const c = p.char >= 0 ? this.chars[p.char] : null;
      const img = c ? Assets.img(c.data.bmp.head) : null;
      if (img) ctx.drawImage(img, x + 49, y + 8, 72, 72);
      else title(ctx, '?', x + 85, y + 44, 56, UI.amber);
      const me = p.slot === Net.slot;
      text(ctx, p.name + (me ? ' (você)' : ''), x + 85, y + 98, { align: 'center', color: me ? '#ffb000' : '#ffffff', max: 160 });
      text(ctx, c ? c.name : 'Aleatório', x + 85, y + 118, { align: 'center', bold: false, max: 160 });
      text(ctx, (p.team ? `Time ${p.team}` : 'Independente') + (room.host === p.slot ? ' · anfitrião' : ''), x + 85, y + 138, { align: 'center', bold: false, size: 12, color: '#9aa3d8' });
      if (p.ready && room.host !== p.slot) text(ctx, 'PRONTO', x + 85, y + 152, { align: 'center', color: '#66d17a' });
    }
    // opções do jogador local
    const S = room.settings, rows = this.rows();
    const labels = {
      char: ['Seu lutador', this.me.char >= 0 ? this.chars[this.me.char].name : 'Aleatório'],
      team: ['Seu time', this.me.team ? `Time ${this.me.team}` : 'Independente'],
      cpus: ['Computadores', String(S.cpus)],
      difficulty: ['Dificuldade', DIFFICULTIES[S.difficulty]],
      bg: ['Cenário', S.bg < 0 ? 'Aleatório' : Assets.backgrounds[S.bg].name],
      ready: ['Pronto', this.me.ready ? 'Sim' : 'Não'],
      fight: ['LUTAR!', ''],
    };
    rows.forEach((r, i) => {
      const y = 256 + i * 26, on = i === this.row;
      if (on) { ctx.fillStyle = 'rgba(255,176,0,0.2)'; ctx.fillRect(180, y - 12, 434, 24); }
      const [k, v] = labels[r];
      if (r === 'fight') {
        ctx.font = `24px ${LOGO_FONT}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = on ? '#ffb000' : '#ffffff';
        ctx.fillText(k, LF.W / 2, y + 1);
      } else {
        text(ctx, k, 196, y, { color: on ? '#ffffff' : '#9aa3d8' });
        text(ctx, (on ? '◀ ' : '') + v + (on ? ' ▶' : ''), 598, y, { align: 'right', color: on ? '#ffb000' : '#ffffff' });
      }
    });
    if (!Net.isHost()) text(ctx, 'O anfitrião escolhe cenário e computadores e começa a luta.', LF.W / 2, 256 + rows.length * 26 + 2, { align: 'center', bold: false, size: 12, color: '#9aa3d8' });
    if (this.msg) text(ctx, this.msg, LF.W / 2, 432, { align: 'center', color: '#ff9b9b' });
    text(ctx, '↑/↓ escolhe · ←/→ muda · Ataque confirma · Esc sai da sala', LF.W / 2, 456, { align: 'center', bold: false, size: 12, color: '#5b5f86' });
  }
}

// ---- partida em rede ----

function hashMatch(m) {
  let h = m.time | 0;
  for (const o of m.live) {
    const v = [o.uid, Math.round(o.ps.x * 10), Math.round(o.ps.y * 10), Math.round(o.ps.z * 10), o.frame.N, Math.round(o.health.hp)];
    for (const x of v) h = (Math.imul(h, 31) + (x | 0)) | 0;
  }
  return h;
}

function startNetMatch(setup, seed) {
  for (const c of Input.controllers) c.clear();
  const cons = {};
  const players = setup.players.map((p) => {
    const human = p.slot >= 0;
    const con = new Controller();
    if (human) cons[p.slot] = con;
    return {
      id: p.id, team: p.team, con,
      player: human ? p.slot : -1,
      ai: human ? null : setup.difficulty,
      name: human ? p.name : 'COM',
    };
  });
  const m = new Match({ players, bg: setup.bg, mode: 'vs', seed, net: true, onEnd: () => {
    Net.send({ t: 'lobby' });
    Game.setScreen(new NetLobbyScreen());
  } });
  m.net = true;
  Game.setScreen(new NetMatchScreen(m, cons));
}

class NetMatchScreen {
  constructor(match, cons) {
    this.match = match;
    this.cons = cons;                      // slot -> controle daquele jogador
    this.slots = Object.keys(cons).map(Number);
    this.inputs = {};                      // quadro -> { slot: eventos }
    this.frame = 0;                        // próximo quadro a simular
    this.sendF = NET_DELAY;                // próximo quadro para o qual mando minhas teclas
    this.hashes = {};
    this.desync = false;
    this.stall = 0;
    this.notice = '';
    for (let f = 0; f < NET_DELAY; f++) {
      this.inputs[f] = {};
      for (const s of this.slots) this.inputs[f][s] = [];
    }
    Net.onMessage = (m) => this.onMessage(m);
  }

  onMessage(m) {
    if (m.t === 'in') {
      (this.inputs[m.f] = this.inputs[m.f] || {})[m.s] = m.ev;
    } else if (m.t === 'hash') {
      const mine = this.hashes[m.f];
      if (mine !== undefined && mine !== m.h) this.desync = true;
      else (this.remoteHash = this.remoteHash || {})[m.f] = m.h;
    } else if (m.t === 'left') {
      this.notice = 'Um jogador saiu da partida.';
      this.leaveT = 60;
    } else if (m.t === 'closed') {
      this.notice = 'Conexão perdida com o servidor.';
      this.leaveT = 60;
    } else if (m.t === 'start') {
      startNetMatch(m.setup, m.seed);
    }
  }

  ready(f) {
    const inp = this.inputs[f];
    return inp && this.slots.every((s) => inp[s] !== undefined);
  }

  update() {
    const m = this.match;
    if (this.leaveT !== undefined) {
      if (--this.leaveT <= 0) { m.ended = true; Game.setScreen(Net.ws ? new NetLobbyScreen() : new TitleScreen()); }
      return;
    }
    if (Input.code('Escape')) {
      Net.close();
      Game.setScreen(new TitleScreen());
      return;
    }
    if (m.summary) {
      if (m.time > m.gameoverAt + 60 && (Input.anyHit('att') || Input.anyHit('jump'))) m.end();
      // a partida acabou: segue simulando os efeitos finais sem esperar ninguém
      return;
    }
    // minhas teclas desde o último TU valem para o quadro sendF
    const local = Input.controllers[0];
    const ev = local.buf.splice(0);
    for (const [K, down] of ev) local.state[K] = down;
    if (this.sendF <= this.frame + NET_DELAY) {
      const evs = (this.pending || []).concat(ev);
      this.pending = null;
      (this.inputs[this.sendF] = this.inputs[this.sendF] || {})[Net.slot] = evs;
      Net.send({ t: 'in', f: this.sendF, ev: evs });
      this.sendF++;
    } else {
      this.pending = (this.pending || []).concat(ev);
    }
    // simula os quadros que já têm as teclas de todos (até 3 por TU para recuperar atraso)
    let n = 0;
    while (n < 3 && this.ready(this.frame)) {
      const inp = this.inputs[this.frame];
      for (const s of this.slots) for (const e of inp[s]) this.cons[s].key(e[0], e[1]);
      m.frame();
      delete this.inputs[this.frame];
      this.frame++;
      n++;
      if (this.frame % NET_HASH_EVERY === 0) {
        const h = hashMatch(m);
        this.hashes[this.frame] = h;
        if (this.remoteHash && this.remoteHash[this.frame] !== undefined && this.remoteHash[this.frame] !== h) this.desync = true;
        Net.send({ t: 'hash', f: this.frame, h });
      }
      if (m.ended) return;
    }
    this.stall = n ? 0 : this.stall + 1;
  }

  draw(ctx) {
    this.match.draw(ctx);
    if (this.stall > 15) text(ctx, 'Aguardando os outros jogadores...', LF.W / 2, 300, { align: 'center', size: 16, shadow: '#000' });
    if (this.desync) text(ctx, 'Partida dessincronizada', LF.W - 10, LF.H - 14, { align: 'right', size: 12, color: '#ff9b9b', shadow: '#000' });
    if (this.notice) text(ctx, this.notice, LF.W / 2, 300, { align: 'center', size: 18, shadow: '#000' });
    text(ctx, `Sala ${Net.code}`, 10, LF.H - 14, { size: 12, color: '#ffffff', shadow: '#000' });
  }
}
