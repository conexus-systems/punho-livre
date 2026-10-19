'use strict';
// Base de todos os objetos vivos (personagens, armas, ataques especiais):
// quadros, transições com autoridade, física, efeitos e volumes de colisão.

// Transições de quadro. Várias causas (próximo quadro, combo, golpe recebido,
// fogo...) podem pedir uma transição no mesmo TU; cada uma tem uma autoridade
// e só quem tiver autoridade maior ou igual à trava atual consegue mudar.
//   0 natural · 10 movimento/combo · 11 especial · 15 ambiente
//   20 golpe · 21 queda · 22 agarrão · 3x efeitos (fogo, gelo)
class Transistor {
  constructor(obj) {
    this.o = obj;
    this.wait = 1;
    this.nextN = 999;
    this.lock = 0;
    this.lockout = 1;
    this.flipAfter = false;
  }

  _take(au, out) {
    if (!au) au = 0;
    if (au === 99) au = this.lock;
    if (!out) out = 1;
    if (au < this.lock) return false;
    this.lock = au;
    this.lockout = out === 99 ? this.wait : out;
    return true;
  }

  setWait(v, au, out) {
    if (this._take(au, out)) this.wait = Math.max(0, v);
  }

  incWait(v, au, out) {
    if (this._take(au, out)) this.wait = Math.max(0, this.wait + v);
  }

  setNext(v, au, out) {
    if (!this._take(au, out)) return;
    if (v < 0) { v = -v; this.flipAfter = true; }
    this.nextN = v;
  }

  // vai para o quadro F agora (no próximo trans())
  frame(F, au) {
    this.setNext(F, au);
    this.setWait(0, au);
  }

  resetLock(au) {
    if (!au) au = 0;
    if (au === 99) au = this.lock;
    if (au >= this.lock) this.lock = 0;
  }

  next() { return this.nextN; }

  nextFrameData() {
    let n = this.nextN;
    if (n === 999 || n === 1280) n = 0;
    return this.o.data.frame[n];
  }

  trans() {
    const o = this.o;
    const oldlock = this.lock;
    if (--this.lockout === 0) this.lock = 0;
    if (this.wait > 0) { this.wait--; return; }
    let next = this.nextN;
    if (next === 0) return;
    if (next === 1000) {
      o.stateUpdate('destroy');
      o.match.destroyObject(o);
      return;
    }
    if (o.health.hp <= 0 && o.frame.D.state === 14) return;
    if (next === 999 || next === 1280) next = 0;
    const D = o.data.frame[next];
    if (!D) { this.nextN = 0; return; }
    o.frame.PN = o.frame.N;
    o.frame.N = next;
    o.stateUpdate('frame_exit');
    const changed = o.frame.D.state !== D.state;
    if (changed) o.stateUpdate('state_exit');
    o.frame.D = D;
    if (changed) {
      for (const k in o.statemem) delete o.statemem[k];
      const oldSwitch = o.allowSwitch;
      const sw = o.switchTable && o.switchTable[D.state];
      o.allowSwitch = sw !== undefined ? sw : false;
      o.stateUpdate('state_entry');
      if (!this.flipAfter && o.allowSwitch && !oldSwitch && o.con) {
        if (o.con.state.left) o.switchDir(-1);
        if (o.con.state.right) o.switchDir(1);
      }
    }
    if (this.flipAfter) {
      this.flipAfter = false;
      o.switchDir(-o.ps.dir);
    }
    o.frameUpdate();
    // ações disparadas por combo ganham um TU
    if ((oldlock === 10 || oldlock === 11) && this.wait > 0) this.wait -= 1;
  }
}

class Living {
  constructor(match, id, team) {
    const obj = Assets.obj(id);
    this.match = match;
    this.id = id;
    this.data = obj.data;
    this.type = obj.type;
    this.name = this.data.bmp.name;
    this.team = team;
    this.uid = -1;
    this.sheet = match.sheet(id);
    this.spw = this.sheet.w;
    this.statemem = {};
    this.health = { hp: 100, mp: 100 };
    this.frame = { PN: 0, N: 0, D: this.data.frame[0], ani: { i: 0, up: true } };
    const mass = Assets.prop(id, 'mass');
    this.mass = mass !== undefined && mass !== null ? mass : 1;
    this.ps = { sx: 0, sy: 0, sz: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, zz: 0, dir: 1, fric: 1 };
    this.trans = new Transistor(this);
    this.itr = { arest: 0, vrest: {}, attacker: null };
    this.effect = { num: -99, dvx: 0, dvy: 0, stuck: false, oscillate: 0, oi: 1, blink: false, bi: 0, super: false, timein: 0, timeout: 0, heal: 0 };
    this.visible = true;
    this.shadowVisible = !Assets.prop(id, 'no_shadow');
    this.hidden = false;      // escondido pelo efeito de piscar
    this.allowSwitch = true;
    this.catching = null;
    this.con = null;
  }

  // ---- máquina de estados ----

  stateUpdate(event, a, b, c, d) {
    const S = this.states;
    let r1, r2;
    if (S.generic) r1 = S.generic.call(this, event, a, b, c, d);
    const sp = S[this.frame.D.state];
    if (sp) r2 = sp.call(this, event, a, b, c, d);
    return r1 || r2;
  }

  state() { return this.frame.D.state; }

  setup() { this.stateUpdate('setup'); }

  frameUpdate() {
    this.ps.fric = 1;
    if (!this.stateUpdate('frame_force')) this.frameForce();
    this.trans.setWait(this.frame.D.wait, 99);
    this.trans.setNext(this.frame.D.next, 99);
    this.stateUpdate('frame');
    if (this.frame.D.sound) {
      Sound.play(this.frame.D.sound);
      if (this.type === 'character' && (this.frame.D.sound === 'step' || this.frame.D.sound === 'land')) this.match.puff(this.ps.x - this.ps.dir * 6, this.ps.z, 2);
    }
  }

  frameForce() {
    const D = this.frame.D, ps = this.ps;
    if (D.dvx) {
      const avx = Math.abs(ps.vx);
      if (ps.y < 0 || avx < D.dvx) ps.vx = ps.dir * D.dvx;
      if (D.dvx < 0) ps.vx -= ps.dir;
    }
    if (D.dvz) ps.vz = this.dirv() * D.dvz;
    if (D.dvy) ps.vy += D.dvy;
    if (D.dvx === 550) ps.vx = 0;
    if (D.dvy === 550) ps.vy = 0;
    if (D.dvz === 550) ps.vz = 0;
  }

  // ---- ciclo por TU ----

  transit() {
    if (this.con && this.comboUpdate) this.comboUpdate();
    const stuck = this.effect.timein < 0 && this.effect.stuck;
    if (!stuck) this.trans.trans();
    this.effect.timein--;
    if (!(this.effect.timein < 0 && this.effect.stuck)) this.stateUpdate('transit');
  }

  TU() {
    if (!this.stateUpdate('TU_force')) this.frameForce();
    const ef = this.effect;
    if (ef.timein < 0) {
      if (ef.oscillate) ef.oi = -ef.oi;
      else if (ef.blink) { this.hidden = (ef.bi % 4) < 2; ef.bi++; }
      if (ef.timeout === 0) {
        ef.num = -99;
        ef.stuck = false;
        ef.oscillate = 0;
        if (ef.blink) { ef.blink = false; ef.bi = 0; this.hidden = false; }
        ef.super = false;
      } else if (ef.timeout === -1) {
        if (ef.dvx) this.ps.vx = ef.dvx;
        if (ef.dvy) this.ps.vy = ef.dvy;
        ef.dvx = 0;
        ef.dvy = 0;
      }
      ef.timeout--;
    }
    if (!(ef.timein < 0 && ef.stuck)) this.stateUpdate('TU');
    if (this.health.hp <= 0 && !this.dead) {
      this.stateUpdate('die');
      this.dead = true;
    }
    if (this.match.leaving(this)) this.stateUpdate('leaving');
    for (const k in this.itr.vrest) {
      if (this.itr.vrest[k] > 0) this.itr.vrest[k]--;
      else delete this.itr.vrest[k];
    }
    if (this.itr.arest > 0) this.itr.arest--;
  }

  // ---- física ----

  dirh() { return this.ps.dir; }

  dirv() {
    if (!this.con) return 0;
    return (this.con.state.down ? 1 : 0) - (this.con.state.up ? 1 : 0);
  }

  switchDir(d) { this.ps.dir = d; }

  setPos(x, y, z) {
    const ps = this.ps, D = this.frame.D, bg = this.match.bg;
    ps.x = x; ps.y = y; ps.z = clampZ(z, bg);
    this.updateScreenPos();
  }

  updateScreenPos() {
    const ps = this.ps, D = this.frame.D;
    ps.sx = ps.dir === 1 ? ps.x - D.centerx : ps.x + D.centerx - this.spw;
    ps.sy = ps.y - D.centery;
    ps.sz = ps.z;
  }

  dynamics() {
    const ps = this.ps, bg = this.match.bg;
    if (!this.blockedXZ()) {
      ps.x += ps.vx;
      ps.z += ps.vz;
    } else {
      ps.x += ps.vx * 0.1;
      ps.z += ps.vz * 0.1;
    }
    if (this.floorBound) {
      if (ps.x < 0) ps.x = 0;
      if (ps.x > bg.width) ps.x = bg.width;
      const b = this.match.bound; // trecho liberado no Stage Mode
      if (b && this.team === b.team) ps.x = Math.max(b.min, Math.min(b.max, ps.x));
    }
    ps.z = clampZ(ps.z, bg);
    ps.y += ps.vy;
    if (ps.y > 0) ps.y = 0;
    this.updateScreenPos();
    if (ps.y === 0 && this.mass > 0) {
      if (ps.vx) ps.vx += (ps.vx > 0 ? -1 : 1) * ps.fric;
      if (ps.vz) ps.vz += (ps.vz > 0 ? -1 : 1) * ps.fric;
      if (ps.vx !== 0 && ps.vx > -GC.min_speed && ps.vx < GC.min_speed) ps.vx = 0;
      if (ps.vz !== 0 && ps.vz > -GC.min_speed && ps.vz < GC.min_speed) ps.vz = 0;
    }
    if (ps.y < 0) ps.vy += this.mass * GC.gravity;
  }

  unitFriction() {
    const ps = this.ps;
    if (ps.y === 0) {
      if (ps.vx) ps.vx += ps.vx > 0 ? -1 : 1;
      if (ps.vz) ps.vz += ps.vz > 0 ? -1 : 1;
    }
  }

  linearFriction(x, z) {
    const ps = this.ps;
    if (x && ps.vx) ps.vx += ps.vx > 0 ? -x : x;
    if (z && ps.vz) ps.vz += ps.vz > 0 ? -z : z;
  }

  speed() { return Math.sqrt(this.ps.vx * this.ps.vx + this.ps.vy * this.ps.vy); }

  blockedXZ() { return false; }

  // ---- volumes ----

  // converte um retângulo dos dados (x, y, w, h relativos ao sprite) em volume do mundo
  volume(O, off) {
    const ps = this.ps;
    if (!O) return { x: ps.sx, y: ps.sy, z: ps.sz, vx: 0, vy: 0, w: 0, h: 0, zwidth: 0, data: {} };
    const vx = ps.dir === 1 ? O.x : this.spw - O.x - O.w;
    return {
      x: ps.sx + (off ? off.x : 0), y: ps.sy + (off ? off.y : 0), z: ps.sz + (off ? off.z : 0),
      vx, vy: O.y, w: O.w, h: O.h, zwidth: O.zwidth ? O.zwidth : GC.zwidth, data: O,
    };
  }

  volBody(off) {
    if (this.effect.super) return [];
    const B = this.frame.D.bdy;
    if (!B) return [];
    return makeArray(B).map((b) => this.volume(b, off));
  }

  volItr(kind) {
    return makeArray(this.frame.D.itr).filter((i) => i.kind == kind).map((i) => this.volume(i));
  }

  point(a, prefix) {
    const ps = this.ps;
    const ax = prefix ? a[prefix + 'x'] : a.x, ay = prefix ? a[prefix + 'y'] : a.y;
    return { x: ps.dir === 1 ? ps.sx + ax : ps.sx + this.spw - ax, y: ps.sy + ay, z: ps.sz + ay };
  }

  // move (em x/z) para que o ponto b, que pertence a mim, fique sobre o ponto a
  coincideXZ(a, b) {
    const ps = this.ps;
    ps.x += a.x - b.x;
    ps.z += a.z - b.z;
    this.updateScreenPos();
  }

  coincideXY(a, b) {
    const ps = this.ps;
    ps.x += a.x - b.x;
    ps.y += a.y - b.y;
    this.updateScreenPos();
  }

  // ---- efeitos de golpe ----

  effectCreate(num, duration, dvx, dvy) {
    const ef = this.effect;
    if (num < ef.num) return;
    const osc = Assets.prop(num + 300, 'oscillate');
    if (osc) ef.oscillate = osc;
    ef.stuck = true;
    if (dvx !== undefined) ef.dvx = dvx;
    if (dvy !== undefined) ef.dvy = dvy;
    if (ef.num >= 0) {
      if (ef.timein > 0) ef.timein = 0;
      if (duration > ef.timeout) ef.timeout = duration;
    } else {
      ef.timein = 0;
      ef.timeout = duration;
    }
    ef.num = num;
  }

  effectStuck(timein, timeout) {
    const ef = this.effect;
    if (!ef.stuck || ef.num <= -1) {
      ef.num = -1;
      ef.stuck = true;
      ef.timein = timein;
      ef.timeout = timeout;
    }
  }

  visualEffect(num, rect, righttip, variant, withSound) {
    this.match.visualEffect(num + 300, {
      x: rect.x + rect.vx + (righttip ? rect.w : 0),
      y: rect.y + rect.vy + rect.h / 2,
      z: Math.max(rect.z, this.ps.z),
    }, variant, withSound);
  }

  brokenEffect(id, n = 8) {
    const body = this.volBody()[0];
    for (let i = 0; i < n; i++) this.match.brokenEffect(id, { x: this.ps.x, y: this.ps.y, z: this.ps.z }, i, body);
  }

  // anima indo e voltando entre os quadros a e b
  aniOscillate(a, b) {
    const f = this.frame;
    if (f.ani.i < a || f.ani.i > b) { f.ani.up = true; f.ani.i = a + 1; }
    if (f.ani.i < b && f.ani.up) this.trans.setNext(f.ani.i++);
    else if (f.ani.i > a && !f.ani.up) this.trans.setNext(f.ani.i--);
    if (f.ani.i === b) f.ani.up = false;
    if (f.ani.i === a) f.ani.up = true;
  }

  arestUpdate(I) {
    if (I && I.arest) this.itr.arest = I.arest;
    else if (!I || !I.vrest) this.itr.arest = GC.arest;
  }

  vrestTest(uid) { return !this.itr.vrest[uid]; }

  vrestUpdate(uid, I) {
    if (I && I.vrest) this.itr.vrest[uid] = I.vrest;
  }

  prop(key) { return Assets.prop(this.id, key); }

  // ---- desenho ----

  draw(ctx, camX) {
    if (!this.visible || this.hidden) return;
    let x = this.ps.sx - camX;
    if (this.effect.oscillate && this.effect.timein < 0) x += this.effect.oscillate * this.effect.oi;
    this.sheet.draw(ctx, this.frame.D.pic, x, this.ps.sy + this.ps.sz, this.ps.dir === -1);
  }
}

function clampZ(z, bg) {
  if (z < bg.zboundary[0]) return bg.zboundary[0];
  if (z > bg.zboundary[1]) return bg.zboundary[1];
  return z;
}

function intersect(A, B) {
  const al = A.x + A.vx, at = A.y + A.vy, ar = al + A.w, ab = at + A.h;
  const bl = B.x + B.vx, bt = B.y + B.vy, br = bl + B.w, bb = bt + B.h;
  if (ab < bt || at > bb || ar < bl || al > br) return false;
  return A.z - A.zwidth <= B.z + B.zwidth && A.z + A.zwidth >= B.z - B.zwidth;
}
