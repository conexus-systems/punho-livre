'use strict';
// Constantes do jogo. Os valores seguem o comportamento observado do LF2 original
// (documentado pela comunidade LF-Empire e pelo projeto F.LF).

const LF = {
  W: 794,          // largura da janela do LF2
  H: 550,          // altura da janela do LF2
  PANEL_H: 128,    // faixa do painel de vida no topo
  FPS: 30,         // o LF2 roda a 30 quadros (TU) por segundo
  ASSETS: (window.LF2_ASSETS || 'assets/'),
};

const GC = {
  gravity: 1.7,
  min_speed: 1,
  hp_full: 500,
  mp_full: 500,
  mp_start: 200,
  arest: 7,               // descanso padrão do atacante depois de acertar
  zwidth: 12,             // largura padrão de um itr no eixo z
  hit_stop: 3,            // pausa ao acertar alguém
  throw_injury: 10,
  cpoint_vaction: 135,
  fall_value: 20,
  fall_dvy: -6.9,
  fall_ko: 60,
  weapon_vrest: 9,
  recover_fall: -0.45,
  recover_bdefend: -0.5,
  effect_duration: 3,
  heal_max: 100,
  defend_factor: 0.1,
  defend_break: 40,
  combo_timeout: 10,
  combo_gap: 20,          // teclas mais distantes que isso (em TU) não formam combo
  bounce_xy: 13.4,
  bounce_y_limit: 11,
  bounce_y: 4.25,
  weapon_bounce_limit: 8,
  weapon_bounce_vy: -3.7,
  weapon_bounce_vx: 3,
  weapon_bounce_vz: 1.5,
  weapon_soft_bounce_vy: -2,
  weapon_hit_vx: -3,
  weapon_reverse_vx: -0.4,
  weapon_reverse_vy: -2,
  weapon_reverse_vz: -0.4,
  unspecified: -842150451,
  projectiles: [201, 202],   // ataques especiais com física (flechas, armas do Rudolf)
  disappear_shadow: 120,
  disappear_body: 150,
  camera_speed: 1 / 18,
};

// tabelas de consulta: a chave é o limite superior do valor absoluto
const LOOKUP = {
  bounce_absorb: [[9, 1], [14, 4], [20, 10], [40, 20], [60, 30]],
  defend_absorb: [[5, 0], [15, 5]],
  fall_wait180: [[7, 1], [9, 2], [11, 3], [13, 4], [15, 5], [17, 6]],
  fell_friction: [[2, 0], [3, 1], [5, 2], [6, 4], [9, 5], [13, 7], [25, 9]],
};

function lookupAbs(table, x) {
  if (x < 0) x = -x;
  for (const [k, v] of table) if (x <= k) return v;
  return table[table.length - 1][1];
}

function makeArray(t) {
  if (!t) return [];
  return Array.isArray(t) ? t : [t];
}

const COMBO_LIST = [
  { name: 'left', seq: ['left'], keep: true },
  { name: 'right', seq: ['right'], keep: true },
  { name: 'up', seq: ['up'], keep: true },
  { name: 'down', seq: ['down'], keep: true },
  { name: 'def', seq: ['def'], keep: true },
  { name: 'jump', seq: ['jump'], keep: true },
  { name: 'att', seq: ['att'], keep: true },
  { name: 'left-left', seq: ['left', 'left'], maxtime: 9 },
  { name: 'right-right', seq: ['right', 'right'], maxtime: 9 },
  { name: 'jump-att', seq: ['jump', 'att'], maxtime: 0, keep: true },
  { name: 'D<A', seq: ['def', 'left', 'att'], keep: true },
  { name: 'D>A', seq: ['def', 'right', 'att'], keep: true },
  { name: 'DvA', seq: ['def', 'down', 'att'] },
  { name: 'D^A', seq: ['def', 'up', 'att'] },
  { name: 'D<J', seq: ['def', 'left', 'jump'] },
  { name: 'D>J', seq: ['def', 'right', 'jump'] },
  { name: 'DvJ', seq: ['def', 'down', 'jump'] },
  { name: 'D^J', seq: ['def', 'up', 'jump'] },
  { name: 'D<AJ', seq: ['def', 'left', 'att', 'jump'] },
  { name: 'D>AJ', seq: ['def', 'right', 'att', 'jump'] },
  { name: 'DJA', seq: ['def', 'jump', 'att'] },
];
const COMBO_PRIORITY = {};
COMBO_LIST.forEach((c, i) => { COMBO_PRIORITY[c.name] = i; });

const COMBO_TAG = {
  def: 'hit_d', jump: 'hit_j', att: 'hit_a',
  'D<A': 'hit_Fa', 'D>A': 'hit_Fa', DvA: 'hit_Da', 'D^A': 'hit_Ua',
  'D<J': 'hit_Fj', 'D>J': 'hit_Fj', DvJ: 'hit_Dj', 'D^J': 'hit_Uj',
  'D<AJ': 'hit_Fj', 'D>AJ': 'hit_Fj', DJA: 'hit_ja',
};
const COMBO_DIR = { 'D<A': -1, 'D>A': 1, 'D<J': -1, 'D>J': 1, 'D<AJ': -1, 'D>AJ': 1 };

// Gerador pseudoaleatório com semente (para a partida ser reproduzível).
class Random {
  constructor(seed) { this.s = (seed >>> 0) || 0x9e3779b9; }
  next() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}
