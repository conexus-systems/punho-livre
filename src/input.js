'use strict';
// Teclado, controles por jogador e detector de combos (sequências de teclas).

const KEY_ACTIONS = ['up', 'down', 'left', 'right', 'att', 'jump', 'def'];
const KEY_LABELS = { up: 'Cima', down: 'Baixo', left: 'Esquerda', right: 'Direita', att: 'Ataque', jump: 'Pulo', def: 'Defesa' };

// Padrões: o 1P usa W X A D para mover, S ataca, Q pula e Z defende.
const DEFAULT_KEYS = [
  { up: 'KeyW', down: 'KeyX', left: 'KeyA', right: 'KeyD', att: 'KeyS', jump: 'KeyQ', def: 'KeyZ' },
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', att: 'Enter', jump: 'ShiftRight', def: 'ControlRight' },
  { up: 'KeyI', down: 'Comma', left: 'KeyJ', right: 'KeyL', att: 'KeyK', jump: 'KeyU', def: 'KeyM' },
  { up: 'Numpad8', down: 'Numpad2', left: 'Numpad4', right: 'Numpad6', att: 'Numpad5', jump: 'Numpad9', def: 'Numpad0' },
];
const TOUCH_KEYS = { up: 'T_up', down: 'T_down', left: 'T_left', right: 'T_right', att: 'T_att', jump: 'T_jump', def: 'T_def' };

function keyName(code) {
  if (!code) return '—';
  return code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, '↑').replace('↑Up', '↑').replace('↑Down', '↓')
    .replace('↑Left', '←').replace('↑Right', '→').replace('Numpad', 'Num ').replace('Right', ' Dir.').replace('Left', ' Esq.')
    .replace('Control', 'Ctrl').replace('Comma', ',').replace('Period', '.').replace('Slash', '/').replace('Semicolon', ';');
}

// Um controle: guarda quais teclas estão apertadas e repassa os eventos, em ordem,
// a quem estiver ouvindo (o detector de combos do personagem), uma vez por TU.
class Controller {
  constructor() {
    this.state = {};
    this.buf = [];
    this.children = [];
    for (const a of KEY_ACTIONS) this.state[a] = false;
  }
  key(K, down) { this.buf.push([K, down]); }
  fetch() {
    for (const [K, down] of this.buf) {
      for (const c of this.children) c.key(K, down);
      this.state[K] = down;
    }
    this.buf.length = 0;
  }
  clear() {
    this.buf.length = 0;
    for (const a of KEY_ACTIONS) this.state[a] = false;
  }
  // usado pela IA
  press(K) { if (this.state[K]) this.key(K, false); this.key(K, true); this.key(K, false); }
  hold(K, on) { if (!!this.state[K] !== on) this.key(K, on); }
}

class ComboDecoder {
  constructor(con, onCombo) {
    this.con = con;
    this.onCombo = onCombo;
    this.seq = [];
    this.time = 1;
    con.children.push(this);
  }
  key(K, down) {
    if (!down || this.con.state[K]) return; // ignora repetição automática
    const seq = this.seq;
    if (seq.length && this.time - seq[seq.length - 1].t > GC.combo_gap) seq.length = 0;
    seq.push({ k: K, t: this.time });
    if (seq.length > 12) seq.shift();
    for (const C of COMBO_LIST) {
      const n = C.seq.length, j = seq.length - n;
      if (j < 0) continue;
      let ok = true;
      for (let k = 0; k < n; k++) {
        if (C.seq[k] !== seq[j + k].k) { ok = false; break; }
      }
      if (ok && C.maxtime !== undefined && seq[seq.length - 1].t - seq[j].t > C.maxtime) ok = false;
      if (ok) {
        this.onCombo(C.name);
        if (!C.keep) seq.length = 0;
      }
    }
  }
  frame() { this.time++; }
  detach() {
    const i = this.con.children.indexOf(this);
    if (i >= 0) this.con.children.splice(i, 1);
  }
}

// Teclado global: traduz códigos de tecla para (jogador, ação).
const Input = {
  keys: DEFAULT_KEYS.map((k) => ({ ...k })),
  controllers: [0, 1, 2, 3].map(() => new Controller()),
  down: new Set(),
  pressed: new Set(),   // códigos apertados neste quadro (menus)
  listeners: [],        // tela de configuração de teclas
  touchActive: false,

  init() {
    try {
      const saved = JSON.parse(localStorage.getItem('punho.keys') || 'null');
      if (Array.isArray(saved) && saved.length === 4) this.keys = saved;
    } catch (e) { /* sem armazenamento local */ }
    window.addEventListener('keydown', (e) => {
      // digitando num campo de texto (formulário do jogo em rede)
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (this.listeners.length) { e.preventDefault(); this.listeners[this.listeners.length - 1](e.code); return; }
      if (this.isGameKey(e.code) || /^(Arrow|F\d)/.test(e.code) || e.code === 'Space') e.preventDefault();
      this.setKey(e.code, true);
      Sound.init();
    });
    window.addEventListener('keyup', (e) => this.setKey(e.code, false));
    window.addEventListener('blur', () => { for (const c of [...this.down]) this.setKey(c, false); });
  },

  save() {
    try { localStorage.setItem('punho.keys', JSON.stringify(this.keys)); } catch (e) { /* ignora */ }
  },

  isGameKey(code) {
    return this.keys.some((k) => Object.values(k).includes(code));
  },

  setKey(code, on) {
    if (on) {
      if (this.down.has(code)) return;
      this.down.add(code);
      this.pressed.add(code);
    } else {
      if (!this.down.has(code)) return;
      this.down.delete(code);
    }
    for (let p = 0; p < 4; p++) {
      for (const a of KEY_ACTIONS) {
        if (this.keys[p][a] === code || (p === 0 && TOUCH_KEYS[a] === code) || code === `G${p}_${a}`) this.controllers[p].key(a, on);
      }
    }
  },

  // ação do jogador p apertada neste quadro (para os menus)
  hit(p, action) {
    if (this.pressed.has(this.keys[p][action]) || this.pressed.has(`G${p}_${action}`)) return true;
    return p === 0 && this.pressed.has(TOUCH_KEYS[action]);
  },
  anyHit(action) { return [0, 1, 2, 3].some((p) => this.hit(p, action)); },
  code(c) { return this.pressed.has(c); },
  endFrame() { this.pressed.clear(); },

  // Controles bluetooth/USB: o controle de índice i joga como o jogador i+1.
  // A e Y atacam, B pula, X defende, Start pausa. Direcional ou analógico esquerdo movem.
  pollPads() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad || !pad.connected || pad.index > 3) continue;
      const b = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
      const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0, dz = 0.5;
      const want = {
        left: b(14) || ax < -dz, right: b(15) || ax > dz, up: b(12) || ay < -dz, down: b(13) || ay > dz,
        att: b(0) || b(3), jump: b(1), def: b(2) || b(4) || b(5) || b(6) || b(7),
      };
      for (const a of KEY_ACTIONS) this.setKey(`G${pad.index}_${a}`, want[a]);
      this.setKey(`G${pad.index}_start`, b(9));
      if (this.down.has(`G${pad.index}_start`) && this.pressed.has(`G${pad.index}_start`)) this.setKey('Escape', true), this.setKey('Escape', false);
    }
  },
};

function setupTouch() {
  const el = document.getElementById('touch');
  if (!el) return;
  window.addEventListener('touchstart', () => {
    el.hidden = false;
    document.body.classList.add('has-touch');
    Input.touchActive = true;
    Sound.init();
    // no navegador do celular: tela cheia e deitado (no app isso já é fixo)
    const root = document.documentElement;
    if (!window.AndroidApp && root.requestFullscreen && !document.fullscreenElement) {
      root.requestFullscreen({ navigationUI: 'hide' })
        .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'))
        .catch(() => {});
    }
  }, { once: true, passive: true });

  // direcional único: o ângulo do dedo vira até duas direções (8 sentidos)
  const pad = el.querySelector('.dpad');
  if (pad) {
    const knob = pad.querySelector('.knob');
    const held = { T_up: false, T_down: false, T_left: false, T_right: false };
    let running = false;
    const set = (code, on) => { if (held[code] !== on) { held[code] = on; Input.setKey(code, on); } };
    const update = (e) => {
      const r = pad.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const dist = Math.hypot(dx, dy), dead = r.width * 0.16;
      let x = 0, y = 0;
      if (dist > dead) {
        const a = Math.atan2(dy, dx), sector = Math.round(a / (Math.PI / 4));
        x = [-1, -1, 0, 1, 1, 1, 0, -1, -1][sector + 4];
        y = [0, -1, -1, -1, 0, 1, 1, 1, 0][sector + 4];
      }
      set('T_left', x < 0); set('T_right', x > 0); set('T_up', y < 0); set('T_down', y > 0);
      // dedo na borda do direcional = correr (o mesmo que tocar duas vezes na direção)
      const edge = x !== 0 && dist > r.width * 0.4;
      if (edge && !running) {
        const code = x < 0 ? 'T_left' : 'T_right';
        Input.setKey(code, false);
        Input.setKey(code, true);
      }
      running = edge;
      const k = Math.min(1, dist / (r.width / 2)) * r.width * 0.28;
      knob.style.transform = dist > 1 ? `translate(${(dx / dist) * k}px, ${(dy / dist) * k}px)` : '';
    };
    const release = () => {
      for (const c in held) set(c, false);
      running = false;
      knob.style.transform = '';
      pad.classList.remove('on');
    };
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { pad.setPointerCapture(e.pointerId); } catch (err) { /* ponteiro já liberado */ }
      pad.classList.add('on');
      Sound.init();
      update(e);
    });
    pad.addEventListener('pointermove', (e) => { if (pad.classList.contains('on')) update(e); });
    pad.addEventListener('pointerup', release);
    pad.addEventListener('pointercancel', release);
    pad.addEventListener('lostpointercapture', release);
  }
  el.querySelectorAll('[data-key]').forEach((btn) => {
    const code = btn.dataset.key;
    const on = (e) => {
      e.preventDefault();
      try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ponteiro já liberado */ }
      Input.setKey(code, true);
      btn.classList.add('on');
      Sound.init();
    };
    const off = (e) => {
      e.preventDefault();
      Input.setKey(code, false);
      btn.classList.remove('on');
    };
    btn.addEventListener('pointerdown', on);
    btn.addEventListener('pointerup', off);
    btn.addEventListener('pointercancel', off);
    btn.addEventListener('lostpointercapture', off);
  });
}

// Botões de golpes especiais na tela de toque: cada um digita a sequência
// (defesa, direção, ataque/pulo) no controle do 1P, como se fosse apertada.
const TouchSpecials = {
  el: null,
  match: null,
  ch: null,
  id: -1,
  update(match) {
    this.el = this.el || document.querySelector('#touch .specials');
    this.match = match && !match.demo ? match : null;
    this.ch = null;
    this.id = -1;
    if (this.el) { this.el.replaceChildren(); this.el.hidden = true; }
  },
  // chamado a cada quadro durante a partida
  poll(slot) {
    if (!this.el || !this.match) return;
    const ch = this.match.characters().find((c) => c.player === slot);
    if (!ch) return;
    if (ch !== this.ch || ch.id !== this.id) this.build(ch);
    for (const b of this.el.children) b.classList.toggle('low', ch.health.mp < Number(b.dataset.cost));
  },
  build(ch) {
    this.ch = ch;
    this.id = ch.id;
    const list = specialsOf({ id: Assets.obj(ch.id).base || ch.id, data: ch.data }).slice(0, 4);
    this.el.replaceChildren(...list.map((sp) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.cost = sp.cost;
      b.setAttribute('aria-label', `${sp.kind} (${sp.cmd})`);
      b.innerHTML = `<small>${sp.cmd.replace(/ /g, '')}</small>${sp.kind}`;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); this.fire(sp.seq); });
      return b;
    }));
    this.el.hidden = !list.length;
  },
  fire(seq) {
    const ch = this.ch, con = Input.controllers[0];
    if (!ch) return;
    Sound.init();
    const keys = seq.map((k) => (k === 'F' ? (ch.ps.dir === -1 ? 'left' : 'right') : k));
    const held = new Set(KEY_ACTIONS.filter((a) => Input.down.has(TOUCH_KEYS[a]) || Input.down.has(Input.keys[0][a])));
    for (const k of keys) {
      if (held.has(k)) con.key(k, false);
      con.key(k, true);
      con.key(k, false);
    }
    // devolve as teclas que o jogador continua segurando
    for (const k of new Set(keys)) if (held.has(k)) con.key(k, true);
  },
};
