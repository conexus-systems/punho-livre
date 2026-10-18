'use strict';
// Teclado, controles de toque e mapeamento de teclas por jogador.

const ACTIONS = ['up', 'down', 'left', 'right', 'attack', 'jump', 'defend'];

// Os códigos T_* vêm dos botões de toque na tela.
const BINDINGS = [
  {
    up: ['KeyW', 'T_up'], down: ['KeyS', 'T_down'], left: ['KeyA', 'T_left'], right: ['KeyD', 'T_right'],
    attack: ['KeyJ', 'KeyF', 'T_a'], jump: ['KeyK', 'KeyG', 'T_j'], defend: ['KeyL', 'KeyH', 'T_d'],
  },
  {
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    attack: ['Numpad1', 'Comma'], jump: ['Numpad2', 'Period'], defend: ['Numpad3', 'Slash'],
  },
];

const BLOCKED_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Slash', 'Backspace']);

const Keys = {
  down: new Set(),
  pressed: new Set(),

  init() {
    window.addEventListener('keydown', (e) => {
      if (BLOCKED_KEYS.has(e.code)) e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
      Sound.init();
      Sound.resume();
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
  },

  set(code, on) {
    if (on) {
      if (!this.down.has(code)) this.pressed.add(code);
      this.down.add(code);
    } else {
      this.down.delete(code);
    }
  },

  endFrame() { this.pressed.clear(); },
  any(codes) { return codes.some((c) => this.down.has(c)); },
  hit(codes) { return codes.some((c) => this.pressed.has(c)); },
};

function emptyInput() {
  const held = {}, pressed = {};
  for (const a of ACTIONS) { held[a] = false; pressed[a] = false; }
  return { held, pressed, run: false, ai: false };
}

function clearInput(inp) {
  for (const a of ACTIONS) { inp.held[a] = false; inp.pressed[a] = false; }
  inp.run = false;
}

function readPlayer(i, inp) {
  const b = BINDINGS[i];
  for (const a of ACTIONS) {
    inp.held[a] = Keys.any(b[a]);
    inp.pressed[a] = Keys.hit(b[a]);
  }
}

// Nos menus, Enter/Espaço confirmam e Esc/Backspace voltam para o jogador 1.
function menuPressed(i, action) {
  if (Keys.hit(BINDINGS[i][action])) return true;
  if (i !== 0) return false;
  if (action === 'attack') return Keys.hit(['Enter', 'Space', 'T_start']);
  if (action === 'defend') return Keys.hit(['Escape', 'Backspace']);
  return false;
}

function anyMenu(action) {
  return menuPressed(0, action) || menuPressed(1, action);
}

// Os botões de toque aparecem só depois do primeiro toque na tela.
function setupTouch() {
  const el = document.getElementById('touch');
  if (!el) return;
  const show = () => {
    el.hidden = false;
    document.body.classList.add('has-touch');
  };
  window.addEventListener('touchstart', show, { once: true, passive: true });
  el.querySelectorAll('[data-key]').forEach((btn) => {
    const code = btn.dataset.key;
    const on = (e) => {
      e.preventDefault();
      if (btn.setPointerCapture) btn.setPointerCapture(e.pointerId);
      Keys.set(code, true);
      btn.classList.add('on');
      Sound.init();
      Sound.resume();
    };
    const off = (e) => {
      e.preventDefault();
      Keys.set(code, false);
      btn.classList.remove('on');
    };
    btn.addEventListener('pointerdown', on);
    btn.addEventListener('pointerup', off);
    btn.addEventListener('pointercancel', off);
    btn.addEventListener('lostpointercapture', off);
  });
}
