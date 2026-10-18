'use strict';
// Golpes e animações dos lutadores. Cada quadro tem uma pose (desenhada pelo
// painter.js); o corpo (bdy), os golpes (itr) e o ponto da arma (wpoint) são
// calculados a partir das juntas da pose, então desenho e colisão batem.
//
// A numeração dos quadros segue o protocolo do motor (ver character.js):
//   0-3 parado · 5-8 andando · 9-11 correndo · 12-19 com objeto pesado
//   20-54 arma · 60-75 socos · 79-98 ataques no ar, correndo e no avanço
//   100-109 rolamento · 110-117 defesa e pegar · 120-135 agarrão
//   180-191 queda · 200-206 gelo e fogo · 210-219 pulo, avanço, agachar
//   220-234 dor, tontura, deitado e arremesso · 240+ golpes especiais

const CELL = 96, CX = 48, BASE = 95;
// caixas escritas em relação a uma célula de 80 px com centro em x = 40
const OX = CX - 40;

const P = (lean, af, ab, lf, lb, extra) => ({ lean, af, ab, lf, lb, ...(extra || {}) });

// ---- poses básicas ----
const POSE = {
  guard: [
    P(6, [35, 105], [20, 115], [16, 8], [-14, 10]),
    P(7, [34, 108], [19, 117], [16, 10], [-14, 12]),
    P(8, [33, 110], [18, 119], [16, 12], [-14, 14]),
    P(7, [34, 108], [19, 117], [16, 10], [-14, 12]),
  ],
  walk: [
    P(8, [30, 100], [25, 112], [26, 6], [-22, 18]),
    P(8, [33, 102], [22, 114], [12, 22], [-8, 8]),
    P(8, [36, 104], [19, 116], [-6, 14], [8, 24]),
    P(8, [39, 106], [16, 118], [-20, 18], [24, 6]),
  ],
  run: [
    P(22, [-30, 100], [40, 95], [48, 55], [-38, 30]),
    P(20, [5, 95], [5, 95], [12, 85], [-6, 40]),
    P(22, [40, 95], [-30, 100], [-38, 30], [48, 55]),
  ],
  carry: [
    P(0, [168, 12], [160, 12], [22, 8], [-20, 16]),
    P(0, [168, 12], [160, 12], [10, 20], [-8, 8]),
    P(0, [168, 12], [160, 12], [-6, 14], [8, 22]),
    P(0, [168, 12], [160, 12], [-18, 16], [22, 8]),
  ],
  carryRun: [
    P(10, [168, 12], [160, 12], [45, 50], [-35, 30]),
    P(10, [168, 12], [160, 12], [12, 80], [-6, 40]),
    P(10, [168, 12], [160, 12], [-35, 30], [45, 50]),
  ],
  brake: P(-14, [60, 60], [20, 80], [42, 8], [-30, 40]),
  crouch: P(22, [40, 90], [25, 100], [55, 95], [-15, 75]),
  air: P(4, [70, 80], [-30, 90], [50, 75], [-20, 50]),
  dash: P(32, [-40, 30], [-50, 40], [55, 25], [-45, 45]),
  dashBack: P(-24, [70, 50], [50, 60], [20, 30], [-50, 25]),
  defend: [P(-4, [62, 118], [72, 108], [16, 10], [-16, 12]), P(-12, [60, 120], [70, 110], [22, 12], [-20, 18])],
  broken: [
    P(-22, [120, 20], [150, 10], [24, 8], [-20, 20], { face: 'hurt' }),
    P(-14, [80, 40], [110, 30], [20, 14], [-24, 24], { face: 'hurt' }),
    P(-6, [40, 60], [60, 50], [18, 12], [-16, 16], { face: 'hurt' }),
  ],
  pick: P(55, [40, 10], [20, 30], [60, 100], [-20, 70]),
  hurt: [
    P(-20, [20, 40], [-10, 30], [18, 6], [-22, 14], { face: 'hurt', head: 12 }),
    P(-10, [25, 70], [10, 70], [16, 8], [-18, 14], { face: 'hurt' }),
    P(28, [10, 30], [-20, 30], [10, 20], [-24, 18], { face: 'hurt', head: -10 }),
    P(14, [20, 60], [0, 60], [14, 14], [-18, 14], { face: 'hurt' }),
    P(-32, [60, 30], [40, 20], [26, 14], [-14, 24], { face: 'hurt', head: 20 }),
    P(-16, [40, 40], [20, 50], [20, 10], [-20, 18], { face: 'hurt' }),
  ],
  dizzy: [
    P(-8, [5, 20], [-5, 20], [12, 10], [-12, 12], { face: 'hurt', head: -15, rot: -4 }),
    P(10, [10, 20], [0, 20], [14, 12], [-10, 10], { face: 'hurt', head: -10, rot: 5 }),
  ],
  fallBack: [
    P(-28, [110, 20], [80, 30], [30, 20], [-10, 30], { face: 'hurt', head: 15 }),
    P(-20, [120, 30], [90, 30], [40, 40], [10, 40], { face: 'hurt', rot: -35 }),
    P(-10, [130, 20], [100, 30], [50, 50], [20, 50], { face: 'hurt', rot: -65 }),
    P(0, [110, 20], [90, 30], [40, 40], [20, 40], { face: 'hurt', rot: -85 }),
    P(0, [90, 20], [70, 20], [30, 30], [10, 30], { face: 'hurt', rot: -95 }),
    P(0, [80, 30], [60, 30], [40, 60], [20, 50], { face: 'hurt', rot: -88 }),
  ],
  fallFront: [
    P(30, [-40, 30], [-60, 30], [-10, 20], [-30, 30], { face: 'hurt', head: -15 }),
    P(20, [-60, 30], [-80, 30], [-20, 20], [-40, 30], { face: 'hurt', rot: 35 }),
    P(10, [-80, 20], [-100, 30], [-20, 30], [-40, 30], { face: 'hurt', rot: 65 }),
    P(0, [-90, 20], [-110, 20], [-10, 20], [-30, 20], { face: 'hurt', rot: 85 }),
    P(0, [-100, 10], [-110, 10], [-5, 10], [-20, 10], { face: 'hurt', rot: 95 }),
    P(0, [-80, 30], [-100, 30], [-10, 30], [-30, 40], { face: 'hurt', rot: 88 }),
  ],
  lieBack: P(0, [100, 30], [70, 20], [30, 50], [5, 20], { face: 'hurt', rot: -90 }),
  lieFront: P(0, [-100, 20], [-80, 30], [-5, 10], [-25, 30], { face: 'hurt', rot: 90 }),
  tuck: (r) => P(30, [60, 120], [40, 120], [80, 140], [60, 140], { rot: r }),
  burn: [
    P(-20, [140, 20], [120, 30], [30, 40], [-10, 40], { face: 'hurt', rot: -30, fire: 0 }),
    P(-20, [130, 30], [110, 30], [40, 40], [0, 40], { face: 'hurt', rot: -40, fire: 1 }),
    P(-10, [-60, 20], [-80, 30], [-10, 20], [-30, 30], { face: 'hurt', rot: 40, fire: 2 }),
    P(-10, [-70, 30], [-90, 30], [-10, 30], [-30, 30], { face: 'hurt', rot: 50, fire: 1 }),
  ],
  frozen: P(-6, [40, 60], [20, 60], [14, 8], [-14, 10], { face: 'hurt', ice: true }),
  stiff: P(-6, [40, 60], [20, 60], [14, 8], [-14, 10], { face: 'hurt' }),
  caught: [
    P(-10, [10, 30], [-10, 30], [14, 8], [-14, 10], { face: 'hurt', head: 10 }),
    P(22, [0, 20], [-20, 20], [10, 16], [-20, 16], { face: 'hurt', head: -12 }),
    P(-24, [40, 30], [20, 30], [18, 10], [-16, 16], { face: 'hurt', head: 18 }),
    P(0, [140, 20], [120, 20], [10, 30], [-10, 30], { face: 'hurt', rot: -60 }),
    P(0, [130, 20], [110, 20], [20, 40], [0, 40], { face: 'hurt', rot: -90 }),
  ],
};

// ---- ataques ----
const ATK = {
  jabA: [P(4, [20, 125], [22, 112], [18, 8], [-16, 12]), P(14, [96, -6], [16, 112], [24, 6], [-20, 14], { dx: 3 }), P(10, [60, 60], [20, 112], [20, 8], [-18, 12], { dx: 2 }), POSE.guard[0]],
  jabB: [P(4, [35, 108], [30, 120], [18, 8], [-16, 12]), P(16, [30, 112], [96, -4], [22, 6], [-22, 14], { dx: 4 }), P(10, [32, 110], [60, 60], [20, 8], [-18, 12], { dx: 2 }), POSE.guard[0]],
  upper: [
    P(26, [-10, 110], [30, 110], [45, 70], [-20, 50], { dy: 0 }),
    P(30, [-30, 90], [30, 110], [50, 80], [-20, 60]),
    P(-6, [165, 10], [20, 100], [20, 6], [-30, 20], { dx: 4, face: 'shout' }),
    P(-10, [170, 5], [10, 100], [16, 6], [-30, 20], { dx: 5 }),
    P(0, [120, 40], [20, 100], [18, 8], [-24, 14], { dx: 3 }),
    P(6, [60, 90], [20, 110], [16, 8], [-16, 12]),
  ],
  jumpKick: [
    P(6, [70, 90], [-30, 100], [70, 100], [30, 110]),
    P(0, [70, 90], [-20, 100], [80, 120], [20, 110]),
    P(-6, [60, 90], [-20, 90], [90, 60], [-10, 80]),
    P(-16, [60, 80], [-30, 90], [98, 0], [-20, 70], { face: 'shout' }),
    P(-14, [60, 80], [-30, 90], [96, 4], [-20, 70]),
    P(6, [50, 90], [-10, 90], [50, 80], [-10, 60]),
  ],
  runHit: [
    P(26, [30, 100], [-10, 100], [40, 50], [-30, 40]),
    P(34, [-40, 60], [50, 80], [50, 60], [-40, 30], { dx: 2 }),
    P(30, [96, -4], [-50, 40], [60, 40], [-40, 20], { dx: 5, face: 'shout' }),
    P(24, [94, -6], [-40, 50], [40, 30], [-30, 30], { dx: 4 }),
    P(12, [60, 60], [10, 80], [30, 20], [-20, 30], { dx: 2 }),
    P(6, [40, 90], [20, 110], [20, 10], [-16, 14]),
  ],
  // golpes com arma leve (a arma aponta para o antebraço + 90°)
  swing: [
    P(-8, [175, -15], [10, 100], [20, 8], [-18, 14]),
    P(-2, [140, -15], [10, 100], [20, 8], [-18, 14]),
    P(14, [85, -25], [-10, 100], [26, 6], [-22, 16], { dx: 3, face: 'shout' }),
    P(18, [40, -35], [-20, 90], [28, 8], [-24, 18], { dx: 3 }),
  ],
  swing2: [
    P(-4, [20, 140], [20, 100], [18, 8], [-18, 12]),
    P(4, [60, 120], [10, 100], [20, 8], [-18, 14]),
    P(16, [100, 10], [-10, 100], [26, 6], [-22, 16], { dx: 3, face: 'shout' }),
    P(18, [100, 50], [-20, 90], [28, 8], [-24, 18], { dx: 3 }),
  ],
  throwLight: [P(-10, [200, -10], [40, 80], [24, 10], [-20, 16]), P(4, [150, -20], [30, 80], [24, 10], [-22, 16]), P(22, [90, -30], [-30, 60], [30, 8], [-26, 20], { dx: 3 })],
  throwHeavy: [P(-14, [175, 10], [168, 10], [20, 10], [-22, 16]), P(28, [95, 0], [90, 0], [34, 10], [-30, 24], { dx: 4 })],
  grab: [
    P(10, [90, 0], [80, 10], [22, 8], [-20, 14]),
    P(6, [100, 15], [60, 80], [18, 8], [-16, 12]),
    P(2, [100, 15], [10, 125], [18, 8], [-18, 14]),
    P(16, [100, 15], [95, -4], [22, 8], [-20, 16], { dx: 3 }),
  ],
  lift: [P(-8, [172, 8], [165, 10], [18, 10], [-18, 14]), P(26, [100, 0], [95, 0], [30, 10], [-28, 22], { dx: 4 }), P(18, [80, 20], [70, 20], [26, 10], [-24, 18])],
};

// ---- utilidades de geometria dos quadros ----

const ri = (v) => Math.round(v);

function boxAround(pts, pad) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { kind: 0, x: ri(x0 - pad), y: ri(y0 - pad), w: ri(x1 - x0 + 2 * pad), h: ri(y1 - y0 + 2 * pad) };
}

function bodyBox(J) {
  const h = BODY.HEAD;
  const pts = [J.pelvis, J.neck, J.chest, J.kf, J.kb, J.af, J.ab, J.tf, J.tb,
    [J.head[0] - h, J.head[1] - h], [J.head[0] + h, J.head[1] + h]];
  const b = boxAround(pts, 2);
  b.w = Math.max(b.w, 20);
  return b;
}

// itr centrado numa junta (`at`), avançado `fx` px para a frente
function hitAt(J, spec) {
  const { at = 'hf', w = 26, h = 16, fx = 0, fy = 0, ...rest } = spec;
  const p = J[at];
  return { kind: 0, x: ri(p[0] - w / 2 + fx), y: ri(p[1] - h / 2 + fy), w, h, ...rest };
}

// ângulo da arma (0..15) a partir da direção do antebraço
function weaponIndex(dir) {
  return ((Math.round((180 - dir) / 22.5) % 16) + 16) % 16;
}

// ---- construção de um lutador ----

class FighterBuilder {
  constructor(def) {
    this.def = def;
    this.frame = {};
    this.poses = [];
    this.keys = new Map();
    this.specials = {};   // tag -> quadro inicial
    this.objects = [];    // bolas criadas por este lutador
  }

  pic(pose) {
    const k = JSON.stringify(pose);
    if (!this.keys.has(k)) { this.keys.set(k, this.poses.length); this.poses.push(pose); }
    return this.keys.get(k);
  }

  joints(pose) { return placePose(pose, (this.def.look.scale || 1) * FIGHTER_SCALE, CX, BASE); }

  // o: { name, state, wait, next, pose, itr: [spec], bdy, wp, carry, cp, op, ...campos }
  F(n, o) {
    const J = this.joints(o.pose);
    const f = {
      name: o.name || '', state: o.state, wait: o.wait ?? 1, next: o.next ?? 999,
      pic: this.pic(o.pose), centerx: CX, centery: BASE,
    };
    for (const k of ['dvx', 'dvy', 'dvz', 'mp', 'hit_a', 'hit_d', 'hit_j', 'sound', 'land']) if (o[k] !== undefined) f[k] = o[k];
    if (o.bdy !== false) f.bdy = o.bdy || bodyBox(J);
    if (o.itr) {
      const list = (Array.isArray(o.itr) ? o.itr : [o.itr]).map((s) => (s.x !== undefined ? s : hitAt(J, s)));
      f.itr = list.length === 1 ? list[0] : list;
    }
    if (o.wp !== false) {
      if (o.carry) {
        const x = (J.hf[0] + J.hb[0]) / 2, y = Math.min(J.hf[1], J.hb[1]);
        f.wpoint = { kind: 1, x: ri(x), y: ri(y - 2), weaponact: 10, attacking: 0, cover: 0, dvx: o.wp?.dvx || 0, dvy: o.wp?.dvy || 0, dvz: o.wp?.dvz || 0 };
      } else {
        f.wpoint = { kind: 1, x: ri(J.hf[0]), y: ri(J.hf[1]), weaponact: 20 + weaponIndex(J.faf + 90), attacking: 0, cover: 0, dvx: 0, dvy: 0, dvz: 0, ...(o.wp || {}) };
      }
    }
    if (o.cp) f.cpoint = typeof o.cp === 'function' ? o.cp(J) : o.cp;
    if (o.op) f.opoint = typeof o.op === 'function' ? o.op(J) : o.op;
    this.frame[n] = f;
    return f;
  }

  chain(first, list, common) {
    const defined = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
    list.forEach((o, i) => this.F(first + i, { next: i < list.length - 1 ? first + i + 1 : (common.last ?? 999), ...common, ...defined(o) }));
  }
}

// cpoint de quem agarra: a vítima fica presa na mão da frente
const grabPoint = (extra) => (J) => ({ kind: 1, x: ri(J.hf[0] + 2), y: ri(J.hf[1]), hurtable: 1, decrease: 0, throwvz: GC.unspecified, throwinjury: GC.unspecified, ...extra });
// cpoint da vítima: o ponto preso é o pescoço
const heldPoint = (extra) => (J) => ({ kind: 2, x: ri(J.neck[0]), y: ri(J.neck[1] + 2), ...extra });

function buildMoveset(B) {
  const st = B.def.stats;
  const pw = st.power || 1;
  const hit = (inj, o) => ({ injury: ri(inj * pw), bdefend: 16, dvx: 2, ...o });

  // parado, andando, correndo
  POSE.guard.forEach((p, i) => B.F(i, { name: 'standing', state: 0, pose: p, wait: [6, 4, 6, 8][i], next: i < 3 ? i + 1 : 999 }));
  const catchItr = { kind: 1, at: 'chest', w: 26, h: 60, fx: 14, catchingact: [120, 120], caughtact: [130, 130] };
  POSE.walk.forEach((p, i) => B.F(5 + i, { name: 'walking', state: 1, pose: p, wait: 3, itr: catchItr }));
  POSE.run.forEach((p, i) => B.F(9 + i, { name: 'running', state: 2, pose: p, wait: 3, next: 0, sound: i === 1 ? 'step' : undefined }));
  POSE.carry.forEach((p, i) => B.F(12 + i, { name: 'heavy_walk', state: 1, pose: p, wait: 3, next: 0, carry: true }));
  POSE.carryRun.forEach((p, i) => B.F(16 + i, { name: 'heavy_run', state: 2, pose: p, wait: 3, next: 0, carry: true }));
  B.F(19, { name: 'heavy_stop', state: 15, pose: P(-12, [168, 12], [160, 12], [40, 10], [-28, 30]), wait: 6, dvx: 2, carry: true, sound: 'step' });

  // arma leve: golpe normal (20 e 25), no pulo (30), correndo (35), no avanço (40)
  const swing = (first, poses, att, extra = {}) => B.chain(first, poses.map((p, i) => ({
    pose: p, wp: { attacking: i >= 2 ? att : 0 }, sound: i === 1 ? 'swing' : undefined, wait: i === 3 ? 2 : 1, ...extra,
  })), { name: 'weapon_attack', state: 3 });
  swing(20, ATK.swing, 1);
  swing(25, ATK.swing2, 1);
  swing(30, ATK.swing.map((p) => ({ ...p, lf: [60, 80], lb: [-10, 60] })), 2);
  swing(35, ATK.swing2.map((p) => ({ ...p, lean: p.lean + 10, lf: [45, 30], lb: [-30, 30] })), 3, { dvx: 5 });
  swing(40, ATK.swing.map((p) => ({ ...p, lf: [70, 60], lb: [-30, 50] })), 4);
  // arremessos de arma
  B.chain(45, ATK.throwLight.map((p, i) => ({ pose: p, wait: [3, 1, 8][i], sound: i === 1 ? 'swing' : undefined,
    wp: i === 2 ? { dvx: 18, dvy: -3, dvz: 3 } : {} })), { name: 'throw_weapon', state: 15 });
  B.chain(50, ATK.throwHeavy.map((p, i) => ({ pose: p, wait: [4, 8][i], carry: true, sound: i === 1 ? 'swing' : undefined,
    wp: i === 1 ? { dvx: 12, dvy: -5, dvz: 2 } : {} })), { name: 'throw_heavy', state: 15 });
  B.chain(52, ATK.throwLight.map((p, i) => ({ pose: { ...p, lf: [60, 80], lb: [-10, 60] }, wait: [3, 1, 8][i], sound: i === 1 ? 'swing' : undefined,
    dvy: i === 1 ? -2 : undefined, wp: i === 2 ? { dvx: 16, dvy: 7, dvz: 3 } : {} })), { name: 'sky_throw', state: 15 });

  // socos
  const punch = (first, poses, at) => B.chain(first, poses.map((p, i) => ({
    pose: p, wait: 1, dvx: i >= 1 ? 2 : undefined, sound: i === 1 ? 'swing' : undefined,
    itr: i === 0 ? { kind: 2, at: 'pelvis', w: 36, h: 22, fy: -8, fx: 10, vrest: 1 }
      : i === 1 ? { at, w: 30, h: 16, fx: -4, ...hit(st.punch || 18) } : undefined,
  })), { name: 'punch', state: 3 });
  punch(60, ATK.jabA, 'hf');
  punch(65, ATK.jabB, 'hb');
  // soco forte (inimigo tonto): 72/73 também servem para o motor achar o alcance
  B.chain(70, ATK.upper.map((p, i) => ({
    pose: p, wait: [2, 1, 2, 1, 2, 2][i], dvx: i === 2 ? 3 : undefined, sound: i === 2 ? 'swing' : undefined,
    itr: i === 2 || i === 3 ? { at: 'hf', w: 34, h: 40, ...hit(42, { dvx: 4, dvy: -11, fall: 70, arest: 15, bdefend: 60 }) } : undefined,
  })), { name: 'super_punch', state: 3 });

  // chute no pulo (80) e no avanço (90)
  const kick = (first, inj, dvx) => B.chain(first, ATK.jumpKick.slice(0, 5).map((p, i) => ({
    pose: p, wait: [1, 1, 1, 3, 2][i], sound: i === 1 ? 'swing' : undefined,
    itr: i >= 3 ? { at: 'tf', w: 34, h: 18, fx: -6, ...hit(inj, { dvx, dvy: -5, fall: 70, arest: 12, bdefend: 40 }) } : undefined,
  })), { name: 'air_kick', state: 3, last: first === 80 ? 79 : 96 });
  kick(80, st.kick || 40, 9);
  B.F(79, { name: 'air_kick_end', state: 3, pose: ATK.jumpKick[5], wait: 3 });
  kick(90, (st.kick || 40) * 1.4, 13);
  B.F(96, { name: 'dash_kick_end', state: 3, pose: ATK.jumpKick[5], wait: 3, next: 96 });
  B.F(95, { name: 'dash_defend', state: 7, pose: POSE.defend[0], wait: 2, next: 0 });

  // ataque correndo
  B.chain(85, ATK.runHit.slice(0, 5).map((p, i) => ({
    pose: p, wait: [2, 1, 2, 3, 2][i], dvx: [undefined, 14, 10, 6, undefined][i], sound: i === 1 ? 'swing' : undefined,
    itr: i === 2 || i === 3 ? { at: 'hf', w: 40, h: 34, fx: -8, ...hit(st.run || 45, { dvx: 12, fall: 70, vrest: 8, bdefend: 60 }) } : undefined,
  })), { name: 'run_attack', state: 3, last: 97 });
  B.F(97, { name: 'run_attack', state: 3, pose: ATK.runHit[5], wait: 2, next: 98 });
  B.F(98, { name: 'run_attack', state: 3, pose: POSE.guard[0], wait: 1 });

  // rolamentos
  B.F(100, { name: 'roll', state: 6, pose: POSE.tuck(-90), wait: 2, next: 101, sound: 'jump', bdy: false });
  B.F(101, { name: 'roll', state: 6, pose: POSE.tuck(-200), wait: 6, next: 0, bdy: false });
  const pickRoll = { kind: 7, at: 'pelvis', w: 16, h: 26, vrest: 1 };
  [0, 90, 180, 270, 360, 450].forEach((r, i) => B.F(102 + i, {
    name: 'dash_roll', state: 6, pose: POSE.tuck(r + 30), wait: 2, dvx: 9, next: i === 2 ? 219 : i === 5 ? 219 : 103 + i,
    itr: pickRoll, bdy: false, hit_a: undefined,
  }));
  B.F(108, { name: 'roll_back', state: 6, pose: POSE.tuck(60), wait: 3, next: 109, sound: 'jump', bdy: false });
  B.F(109, { name: 'roll_back', state: 6, pose: POSE.tuck(180), wait: 6, next: 0, bdy: false });

  // defesa e pegar armas
  B.F(110, { name: 'defend', state: 7, pose: POSE.defend[0], wait: 12 });
  B.F(111, { name: 'defend', state: 7, pose: POSE.defend[1], wait: 0, next: 110 });
  const brokeItr = { kind: 6, x: OX - 6, y: BASE - 65, w: 86, h: 66, vrest: 1 };
  POSE.broken.forEach((p, i) => B.F(112 + i, { name: 'broken_defend', state: 8, pose: p, wait: [1, 2, 3][i], next: i < 2 ? 113 + i : 999, dvx: -2, itr: brokeItr }));
  B.F(115, { name: 'pick_light', state: 15, pose: POSE.pick, wait: 4, sound: 'pick' });
  B.F(116, { name: 'pick_heavy', state: 15, pose: POSE.pick, wait: 2, next: 117, sound: 'pick' });
  B.F(117, { name: 'pick_heavy', state: 15, pose: P(10, [150, 30], [140, 30], [30, 50], [-20, 40]), wait: 2, carry: true });

  // agarrão: 120 agarra, 121 segura, 122-123 soca, 232-234 arremessa
  B.F(120, { name: 'catching', state: 9, pose: ATK.grab[0], wait: 2, next: 121, sound: 'grab', cp: grabPoint({ vaction: 130 }) });
  B.F(121, { name: 'catching', state: 9, pose: ATK.grab[1], wait: 0, next: 0, cp: grabPoint({ vaction: 130, aaction: 122, taction: -232 }) });
  B.F(122, { name: 'catching', state: 9, pose: ATK.grab[2], wait: 4, next: 123, cp: grabPoint({ vaction: 130 }) });
  B.F(123, { name: 'catching', state: 9, pose: ATK.grab[3], wait: 4, next: 121, sound: 'hit', cp: grabPoint({ vaction: 131, injury: ri(14 * pw) }) });
  B.F(232, { name: 'throw', state: 9, pose: ATK.lift[0], wait: 3, next: 233, cp: (J) => ({ kind: 1, x: ri((J.hf[0] + J.hb[0]) / 2), y: ri(Math.min(J.hf[1], J.hb[1]) - 6), vaction: 134, throwvz: GC.unspecified, throwinjury: GC.unspecified, dircontrol: 1 }) });
  B.F(233, { name: 'throw', state: 9, pose: ATK.lift[1], wait: 1, next: 234, sound: 'swing', cp: (J) => ({ kind: 1, x: ri(J.hf[0] + 8), y: ri(J.hf[1]), vaction: 181, throwvx: 12, throwvy: -7, throwvz: 3, throwinjury: ri(32 * pw) }) });
  B.F(234, { name: 'throw', state: 9, pose: ATK.lift[2], wait: 4 });
  // sendo agarrado
  B.F(130, { name: 'caught', state: 10, pose: POSE.caught[0], wait: 3, next: 0, cp: heldPoint({ fronthurtact: 131, backhurtact: 132 }) });
  B.F(131, { name: 'caught', state: 10, pose: POSE.caught[1], wait: 3, next: 0, cp: heldPoint({ fronthurtact: 132, backhurtact: 132 }) });
  B.F(132, { name: 'caught', state: 10, pose: POSE.caught[2], wait: 3, next: 0, cp: heldPoint({ fronthurtact: 131, backhurtact: 131 }) });
  B.F(133, { name: 'caught', state: 10, pose: POSE.caught[3], wait: 3, next: 0, cp: (J) => ({ kind: 2, x: ri(J.pelvis[0]), y: ri(J.pelvis[1]) }) });
  B.F(134, { name: 'caught', state: 10, pose: POSE.caught[4], wait: 3, next: 0, cp: (J) => ({ kind: 2, x: ri(J.pelvis[0]), y: ri(J.pelvis[1]) }) });
  B.F(135, { name: 'caught', state: 10, pose: POSE.caught[4], wait: 3, next: 0, cp: (J) => ({ kind: 2, x: ri(J.pelvis[0]), y: ri(J.pelvis[1]) }) });

  // quedas: corpos arremessados atingem quem estiver no caminho (itr kind 4)
  const bodyHit = { kind: 4, at: 'chest', w: 36, h: 30, dvx: 2, fall: 70, vrest: 20, bdefend: 10, injury: 25 };
  POSE.fallBack.forEach((p, i) => B.F(180 + i, { name: 'falling', state: 12, pose: p, wait: 3, next: 0, itr: i < 4 ? bodyHit : undefined }));
  POSE.fallFront.forEach((p, i) => B.F(186 + i, { name: 'falling', state: 12, pose: p, wait: 3, next: 0, itr: i < 4 ? bodyHit : undefined }));

  // gelo e fogo
  B.F(200, { name: 'ice', state: 15, pose: POSE.stiff, wait: 2, next: 201 });
  B.F(201, { name: 'ice', state: 13, pose: POSE.frozen, wait: 90, next: 202, itr: { kind: 14, x: OX + 18, y: BASE - 69, w: 44, h: 68, vrest: 1 } });
  B.F(202, { name: 'ice', state: 15, pose: POSE.stiff, wait: 1, next: 182, dvx: -4, dvy: -3 });
  const fireItr = { kind: 0, at: 'chest', w: 30, h: 24, dvx: -6, dvy: -6, fall: 70, vrest: 10, bdefend: 16, injury: 25, effect: 20 };
  POSE.burn.forEach((p, i) => B.F(203 + i, { name: 'fire', state: 18, pose: p, wait: 1, next: i % 2 === 0 ? 204 + i : 202 + i, itr: fireItr }));

  // pulo, avanço, agachar
  B.F(210, { name: 'jump', state: 4, pose: POSE.crouch, wait: 1, next: 211 });
  B.F(211, { name: 'jump', state: 4, pose: POSE.crouch, wait: 1, next: 212, sound: 'jump' });
  B.F(212, { name: 'jump', state: 4, pose: POSE.air, wait: 1, next: 0 });
  B.F(213, { name: 'dash', state: 5, pose: POSE.dash, wait: 8, next: 216 });
  B.F(214, { name: 'dash', state: 5, pose: POSE.dashBack, wait: 8, next: 217 });
  B.F(216, { name: 'dash', state: 5, pose: { ...POSE.dash, lf: [40, 50] }, wait: 2, next: 0 });
  B.F(217, { name: 'dash', state: 5, pose: { ...POSE.dashBack, lb: [-30, 40] }, wait: 2, next: 0 });
  B.F(215, { name: 'crouch', state: 15, pose: POSE.crouch, wait: 2, sound: 'land' });
  B.F(218, { name: 'stop_running', state: 15, pose: POSE.brake, wait: 5, dvx: 1, sound: 'step' });
  B.F(219, { name: 'crouch', state: 15, pose: POSE.crouch, wait: 2, sound: 'land' });

  // dor e tontura
  POSE.hurt.forEach((p, i) => B.F(220 + i, { name: 'injured', state: 11, pose: p, wait: i % 2 ? 3 : 2, next: i % 2 ? 999 : 221 + i }));
  const dizzyItr = { kind: 6, x: OX + 6, y: BASE - 67, w: 86, h: 68, vrest: 1 };
  [0, 1, 0, 1].forEach((k, i) => B.F(226 + i, { name: 'dizzy', state: 16, pose: POSE.dizzy[k], wait: 7, next: i < 3 ? 227 + i : 999, itr: dizzyItr }));
  B.F(230, { name: 'lying', state: 14, pose: POSE.lieBack, wait: 30, next: 219, bdy: false });
  B.F(231, { name: 'lying', state: 14, pose: POSE.lieFront, wait: 30, next: 219, bdy: false });

  // golpes especiais
  for (const sp of B.def.specials) SPECIALS[sp.type](B, sp);
  // quadros de onde os especiais podem começar
  const tags = B.specials;
  for (const n of [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 110]) Object.assign(B.frame[n], tags);
}

// ---- golpes especiais ----
// Cada um recebe o construtor e { tag, at (quadro inicial), mp, ... } e registra B.specials[tag].

let nextBallId = 200;

function makeBall(B, o) {
  const id = nextBallId++;
  B.objects.push({ id, type: 'specialattack', name: '', ball: o });
  return id;
}

const SPECIALS = {
  // bola de energia (fogo, gelo, raio...) disparada para a frente; ataque de novo dispara outra
  blast(B, sp) {
    const n = sp.at, ball = makeBall(B, { color: sp.color, style: sp.style || 'orb', effect: sp.effect || 0, injury: sp.injury || 35,
      fall: sp.fall ?? 30, speed: sp.speed || 12, chase: false, multi: sp.multi || 0, broken: sp.style === 'shard' });
    const poses = [
      P(-4, [-40, 100], [-30, 110], [26, 10], [-20, 18], { face: 'shout' }),
      P(-6, [-60, 110], [-50, 120], [28, 12], [-22, 20]),
      P(16, [94, 0], [88, 10], [30, 8], [-26, 18], { dx: 3, face: 'shout', open: true }),
      P(14, [92, 0], [86, 10], [30, 8], [-26, 18], { dx: 3, open: true }),
      P(6, [50, 80], [30, 100], [20, 10], [-18, 14]),
    ];
    const facing = sp.multi ? 30 : 0;
    B.chain(n, poses.map((p, i) => ({
      pose: p, wait: [1, 2, 1, 3, 2][i], mp: i === 0 ? sp.mp : undefined, sound: i === 2 ? (sp.sound || 'blast') : undefined,
      op: i === 2 ? (J) => ({ kind: 1, x: ri(J.hf[0] + 10), y: ri(J.hf[1]), action: 0, dvx: 0, dvy: 0, oid: ball, facing }) : undefined,
      hit_a: i === 3 ? n : undefined,
    })), { name: 'blast', state: 3 });
    B.specials[sp.tag] = n;
  },

  // bola que persegue o inimigo mais próximo
  chase(B, sp) {
    const n = sp.at, ball = makeBall(B, { color: sp.color, style: 'orb', effect: 0, injury: sp.injury || 30, fall: 40, speed: 6, chase: true });
    const poses = [
      P(-8, [150, 40], [140, 40], [20, 10], [-18, 14], { face: 'shout', open: true }),
      P(-10, [170, 10], [160, 10], [20, 10], [-18, 14], { open: true }),
      P(8, [110, 10], [100, 10], [24, 8], [-20, 16], { dx: 2, open: true }),
      P(6, [60, 70], [40, 80], [20, 8], [-18, 14]),
    ];
    B.chain(n, poses.map((p, i) => ({
      pose: p, wait: [2, 2, 3, 3][i], mp: i === 0 ? sp.mp : undefined, sound: i === 2 ? 'blast' : undefined,
      op: i === 2 ? (J) => ({ kind: 1, x: ri(J.hf[0] + 6), y: ri(J.hf[1] - 6), action: 0, dvx: 0, dvy: -2, oid: ball, facing: 0 }) : undefined,
      hit_a: i === 2 ? n : undefined,
    })), { name: 'chase', state: 3 });
    B.specials[sp.tag] = n;
  },

  // gancho subindo: arremessa para cima
  uppercut(B, sp) {
    const n = sp.at, inj = sp.injury || 55;
    const poses = [
      P(30, [-20, 100], [30, 110], [55, 95], [-20, 70]),
      P(-4, [160, 10], [20, 100], [30, 40], [-30, 60], { dx: 3, face: 'shout' }),
      P(-10, [172, 5], [10, 100], [10, 40], [-20, 70]),
      P(-6, [170, 5], [10, 100], [10, 50], [-20, 70]),
      P(10, [120, 40], [20, 100], [40, 70], [-10, 60]),
    ];
    const big = { at: 'chest', w: 44, h: 64, fx: 20, fy: -6, injury: inj, dvx: 3, dvy: -13, fall: 70, vrest: 12, bdefend: 60, effect: sp.effect || 0 };
    B.chain(n, poses.map((p, i) => ({
      pose: p, wait: [2, 2, 2, 3, 3][i], mp: i === 0 ? sp.mp : undefined,
      dvx: i === 1 ? 5 : undefined, dvy: i === 1 ? -12 : undefined, sound: i === 1 ? 'swing' : undefined,
      itr: i === 1 || i === 2 ? big : undefined,
    })), { name: 'uppercut', state: 3 });
    B.specials[sp.tag] = n;
  },

  // avanço com rajada de socos (ou chutes) e um golpe final
  rush(B, sp) {
    const n = sp.at, kicks = sp.kicks;
    const a = (k) => (kicks
      ? P(-6, [60, 80], [-20, 90], k ? [96, 0] : [-20, 40], k ? [-20, 40] : [96, 0], { dx: 3 })
      : P(16, k ? [96, -4] : [40, 110], k ? [30, 112] : [96, -4], [26, 6], [-24, 16], { dx: 4 }));
    const poses = [P(20, [-30, 100], [30, 110], [40, 60], [-30, 40], { face: 'shout' }), a(1), a(0), a(1), a(0), a(1), a(0),
      kicks ? P(-14, [60, 80], [-30, 90], [110, 0], [-20, 60], { face: 'shout', dx: 4 }) : P(-8, [165, 10], [20, 100], [24, 6], [-30, 20], { face: 'shout', dx: 4 }),
      P(6, [50, 80], [20, 100], [20, 10], [-16, 14])];
    const small = (at) => ({ at, w: 34, h: 22, fx: -2, injury: Math.round((sp.injury || 10) * 0.45), dvx: 3, fall: 5, vrest: 3, bdefend: 12 });
    const last = { at: kicks ? 'tf' : 'hf', w: 36, h: 30, injury: Math.round((sp.injury || 10) * 2.5), dvx: 10, dvy: -8, fall: 70, vrest: 15, bdefend: 60 };
    B.chain(n, poses.map((p, i) => ({
      pose: p, wait: i === 0 ? 2 : i === 8 ? 4 : 1, mp: i === 0 ? sp.mp : undefined,
      dvx: i === 0 ? 12 : i < 7 ? 5 : undefined, sound: i % 2 === 1 ? 'swing' : undefined,
      itr: i >= 1 && i <= 6 ? small(kicks ? (i % 2 ? 'tf' : 'tb') : (i % 2 ? 'hf' : 'hb')) : i === 7 ? last : undefined,
    })), { name: 'rush', state: 3 });
    B.specials[sp.tag] = n;
  },

  // investida de ombro
  charge(B, sp) {
    const n = sp.at;
    const p = (k) => P(36, [60, 90], [-40, 60], k ? [60, 50] : [-30, 30], k ? [-30, 30] : [60, 50], { dx: 4, face: 'shout' });
    const poses = [P(20, [40, 110], [-20, 80], [40, 60], [-30, 40]), p(1), p(0), p(1), p(0), P(10, [40, 90], [10, 100], [30, 20], [-20, 20])];
    const hitbox = { at: 'shoulder', w: 30, h: 50, fx: 8, fy: 10, injury: sp.injury || 50, dvx: 14, dvy: -6, fall: 70, vrest: 15, bdefend: 70 };
    B.chain(n, poses.map((pp, i) => ({
      pose: pp, wait: i === 0 ? 3 : i === 5 ? 4 : 2, mp: i === 0 ? sp.mp : undefined, dvx: i >= 1 && i <= 4 ? 15 : undefined,
      sound: i === 1 ? 'swing' : i === 3 ? 'step' : undefined, itr: i >= 1 && i <= 4 ? hitbox : undefined,
    })), { name: 'charge', state: 3 });
    B.specials[sp.tag] = n;
  },

  // pula e soca o chão: ondas de choque para os dois lados
  slam(B, sp) {
    const n = sp.at, wave = makeBall(B, { color: sp.color, style: 'wave', effect: sp.effect || 0, injury: Math.round((sp.injury || 40) * 0.7), fall: 70, speed: 9, ground: true });
    const poses = [
      P(20, [150, 30], [140, 30], [55, 95], [-20, 70]),
      P(0, [170, 10], [165, 10], [40, 60], [-10, 50], { face: 'shout' }),
      P(30, [120, 10], [110, 10], [60, 80], [0, 70]),
      P(50, [20, 10], [10, 10], [60, 100], [-20, 80], { face: 'shout' }),
      P(40, [10, 20], [0, 20], [60, 100], [-20, 80]),
      P(10, [40, 80], [20, 90], [30, 30], [-20, 30]),
    ];
    const ground = { kind: 0, x: OX - 30, y: BASE - 30, w: 140, h: 30, injury: Math.round((sp.injury || 40) * 0.6), dvx: 6, dvy: -9, fall: 70, vrest: 15, bdefend: 60, effect: sp.effect || 0 };
    B.chain(n, poses.map((p, i) => ({
      pose: p, wait: [2, 3, 30, 2, 4, 3][i], mp: i === 0 ? sp.mp : undefined, dvy: i === 1 ? -10 : i === 2 ? 3 : undefined, dvx: i === 1 ? 3 : undefined,
      next: i === 2 ? n + 2 : undefined, land: i === 2 ? n + 3 : undefined,
      sound: i === 3 ? 'slam' : i === 1 ? 'jump' : undefined, itr: i === 3 ? ground : undefined,
      op: i === 3 ? [
        { kind: 1, x: OX + 70, y: BASE - 5, action: 0, dvx: 0, dvy: 0, oid: wave, facing: 0 },
        { kind: 1, x: OX + 10, y: BASE - 5, action: 0, dvx: 0, dvy: 0, oid: wave, facing: 1 },
      ] : undefined,
    })), { name: 'slam', state: 3 });
    B.specials[sp.tag] = n;
  },

  // some e reaparece atrás do inimigo mais próximo com um chute
  teleport(B, sp) {
    const n = sp.at;
    B.F(n, { name: 'vanish', state: 15, pose: P(10, [150, 30], [140, 30], [30, 60], [-20, 50], { open: true }), wait: 3, next: n + 1, mp: sp.mp, sound: 'teleport' });
    B.F(n + 1, { name: 'vanish', state: 400, pose: POSE.crouch, wait: 2, next: n + 2, bdy: false });
    const k = { at: 'tf', w: 36, h: 22, fx: -6, injury: sp.injury || 40, dvx: 10, dvy: -6, fall: 70, vrest: 15, bdefend: 50 };
    B.chain(n + 2, [ATK.jumpKick[2], ATK.jumpKick[3], ATK.jumpKick[4], ATK.jumpKick[5]].map((p, i) => ({
      pose: p, wait: [1, 2, 3, 3][i], dvx: i < 2 ? 10 : undefined, sound: i === 1 ? 'swing' : undefined, itr: i === 1 || i === 2 ? k : undefined,
    })), { name: 'ghost_kick', state: 3 });
    B.specials[sp.tag] = n;
  },

  // cura: medita e recupera vida
  heal(B, sp) {
    const n = sp.at;
    const p = (k) => P(0, [100, 70 + k * 6], [95, 75 + k * 6], [30, 60], [-30, 60], { open: true, glow: sp.color });
    B.F(n, { name: 'heal', state: 15, pose: p(0), wait: 3, next: n + 1, mp: sp.mp, sound: 'heal' });
    B.F(n + 1, { name: 'heal', state: 1700, pose: p(1), wait: 10, next: n + 2 });
    B.F(n + 2, { name: 'heal', state: 15, pose: p(2), wait: 10, next: 999 });
    B.specials[sp.tag] = n;
  },

  // giro com chutes para os dois lados
  spin(B, sp) {
    const n = sp.at;
    const turn = (k) => P(-6, [100, 40], [80, 40], k % 2 ? [-95, 0] : [95, 0], [-10, 50], { face: 'shout' });
    const around = { kind: 0, x: OX - 20, y: BASE - 60, w: 120, h: 40, injury: sp.injury || 26, dvx: 8, dvy: -7, fall: 50, vrest: 6, bdefend: 30, effect: sp.effect || 0 };
    const poses = [POSE.crouch, turn(0), turn(1), turn(0), turn(1), turn(0), POSE.crouch];
    B.chain(n, poses.map((p, i) => ({
      pose: p, wait: i === 0 ? 2 : i === 6 ? 3 : 2, mp: i === 0 ? sp.mp : undefined, dvy: i === 1 ? -6 : undefined, dvx: i >= 1 && i <= 5 ? 3 : undefined,
      sound: i % 2 === 1 ? 'swing' : undefined, itr: i >= 1 && i <= 5 ? around : undefined,
    })), { name: 'spin', state: 3 });
    B.specials[sp.tag] = n;
  },

  // explosão de gelo em volta (congela)
  frost(B, sp) {
    const n = sp.at;
    const ring = { kind: 0, x: OX - 24, y: BASE - 50, w: 128, h: 50, injury: sp.injury || 30, dvx: 4, dvy: -4, fall: 40, vrest: 20, bdefend: 40, effect: 30 };
    const poses = [P(10, [150, 30], [140, 30], [30, 30], [-20, 30]), P(40, [20, 10], [10, 10], [60, 100], [-20, 80], { face: 'shout', open: true, frost: 1 }),
      P(40, [20, 10], [10, 10], [60, 100], [-20, 80], { open: true, frost: 2 }), P(20, [60, 60], [40, 60], [40, 60], [-20, 40])];
    B.chain(n, poses.map((p, i) => ({
      pose: p, wait: [3, 2, 4, 4][i], mp: i === 0 ? sp.mp : undefined, sound: i === 1 ? 'freeze' : undefined, itr: i === 1 || i === 2 ? ring : undefined,
    })), { name: 'frost', state: 3 });
    B.specials[sp.tag] = n;
  },
};
