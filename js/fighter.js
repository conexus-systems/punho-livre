'use strict';
// Lutador: máquina de estados, golpes, física e reação a danos.

const BASIC = {
  punch1: {
    dur: 16, keys: [[0, 'punchWind'], [4, 'punchHit'], [10, 'punchHit'], [16, 'guard']], next: 'punch2', step: 1.5, sfx: 'whoosh',
    hit: { from: 4, to: 7, x: 6, w: 36, y: 58, h: 24, dmg: 18, kvx: 1.2, fall: 24, stun: 18 },
  },
  punch2: {
    dur: 16, keys: [[0, 'punch2Wind'], [4, 'punch2Hit'], [10, 'punch2Hit'], [16, 'guard']], next: 'kick', step: 1.5, sfx: 'whoosh',
    hit: { from: 4, to: 7, x: 6, w: 36, y: 58, h: 24, dmg: 18, kvx: 1.2, fall: 24, stun: 18 },
  },
  kick: {
    dur: 26, keys: [[0, 'kickWind'], [6, 'kickHit'], [14, 'kickHit'], [26, 'guard']], step: 2, sfx: 'whoosh',
    hit: { from: 6, to: 9, x: 4, w: 44, y: 52, h: 30, dmg: 30, kvx: 5, kvy: 6, fall: 60, knockdown: true, heavy: true },
  },
  runAttack: {
    dur: 28, keys: [[0, 'flyKick'], [22, 'flyKick'], [28, 'land']], keepVel: true, sfx: 'whoosh',
    start: (f) => { f.vy = 4; f.y = 0.1; f.vx = f.facing * f.def.run * 1.1; },
    hit: { from: 2, to: 18, x: 0, w: 42, y: 40, h: 40, dmg: 40, kvx: 7, kvy: 7, knockdown: true, heavy: true },
  },
  jumpAttack: {
    dur: 20, keys: [[0, 'jumpKick']], keepVel: true, sfx: 'whoosh',
    hit: { from: 3, to: 14, x: 0, w: 40, y: 30, h: 44, dmg: 32, kvx: 4, kvy: 5, fall: 60 },
  },
  roll: {
    dur: 22, invuln: 16, keepVel: true, keys: [[0, 'tuck'], [16, 'tuck'], [22, 'crouch']],
    update: (f, w, t) => { f.vx = t < 16 ? f.facing * 6 : f.vx * 0.7; },
  },
  bat1: {
    dur: 22, weapon: true, keys: [[0, 'batWind'], [7, 'batHit'], [16, 'batHit'], [22, 'guard']], next: 'bat2', step: 1.5, sfx: 'whoosh',
    hit: { from: 7, to: 10, x: 0, w: 62, y: 55, h: 44, dmg: 32, kvx: 3, fall: 45, stun: 20 },
  },
  bat2: {
    dur: 26, weapon: true, keys: [[0, 'batWind'], [8, 'batHit'], [18, 'batHit'], [26, 'guard']], step: 2, sfx: 'whoosh',
    hit: { from: 8, to: 11, x: 0, w: 62, y: 55, h: 44, dmg: 40, kvx: 6, kvy: 6, knockdown: true, heavy: true },
  },
  throwItem: {
    dur: 20, keys: [[0, 'throwWind'], [6, 'cast'], [14, 'cast'], [20, 'guard']],
    events: { 6: (f) => f.throwHeld() },
  },
  pick: { dur: 10, keys: [[0, 'crouch'], [10, 'guard']] },
};

const CONTROL_STATES = new Set(['idle', 'walk']);
let NEXT_FIGHTER_ID = 1;

class Fighter {
  constructor(w, key, o = {}) {
    const d = CHARACTERS[key];
    this.w = w; this.id = NEXT_FIGHTER_ID++; this.key = key; this.def = d; this.name = o.name || d.name;
    prepLook(d.look);
    this.team = o.team || 100 + this.id;
    this.x = o.x ?? 200; this.y = 0; this.z = o.z ?? DEPTH / 2;
    this.vx = 0; this.vy = 0; this.vz = 0; this.facing = o.facing || 1;
    this.maxHp = Math.round(d.hp * (o.hpMul || 1)); this.hp = this.maxHp;
    this.maxMp = 100; this.mp = o.mp ?? 50;
    this.state = 'idle'; this.t = 0; this.move = null; this.moveT = 0; this.moveKey = null;
    this.input = emptyInput(); this.ai = null; this.player = o.player ?? -1;
    this.fallMeter = 0; this.defMeter = 0; this.hitstop = 0; this.invuln = 0; this.flash = 0; this.invisible = 0;
    this.burn = 0; this.shock = 0; this.frozenT = 0; this.frozenPose = null; this.stunT = 0; this.hurtAlt = false;
    this.holding = null; this.dead = false; this.deadT = 0; this.gone = false; this.bounced = false;
    this.hitLog = new Map(); this.swing = 0; this.queued = false; this.airAttack = false; this.dashJump = false;
    this.buffer = []; this.lastTap = { dir: 0, t: -99 }; this.frame = 0; this.walkPhase = 0;
    this.forceSpecial = null; this.entering = false; this.boss = !!o.boss; this.victory = false; this.fades = !!o.fades;
    this.stats = { dmg: 0, kills: 0, taken: 0 }; this.lastAttacker = null;
  }

  get size() { return this.def.size || 1; }
  get height() { return 78 * this.size; }
  get isHuman() { return this.player >= 0; }

  setState(s) {
    this.state = s;
    this.t = 0;
    if (s !== 'move') this.move = null;
  }

  startMove(m, key) {
    this.move = m; this.moveKey = key; this.moveT = 0; this.swing++; this.queued = false;
    this.state = 'move'; this.t = 0;
    if (m.cost) this.mp -= m.cost;
    if (m.invuln) this.invuln = Math.max(this.invuln, m.invuln);
    if (m.start) m.start(this, this.w);
    if (m.sfx) Sound.play(m.sfx);
  }

  // ---- entrada e golpes especiais (D + direção + A/J) ----

  recordInputs() {
    const p = this.input.pressed, b = this.buffer, t = this.frame;
    if (p.defend) b.push({ k: 'D', t });
    if (p.up) b.push({ k: 'U', t });
    if (p.down) b.push({ k: 'V', t });
    if (p.left) b.push({ k: 'L', t });
    if (p.right) b.push({ k: 'R', t });
    if (p.jump) b.push({ k: 'J', t });
    if (p.attack) b.push({ k: 'A', t });
    while (b.length > 10 || (b.length && t - b[0].t > 40)) b.shift();
  }

  specialKey(trigger) {
    const buf = this.buffer, now = this.frame;
    let dir = null;
    for (let i = buf.length - 2; i >= 0; i--) {
      const e = buf[i];
      if (now - e.t > 30) break;
      if (e.k === 'A' || e.k === 'J') return null;
      if (!dir) {
        if ('LRUV'.includes(e.k)) dir = e.k;
      } else if (e.k === 'D') {
        return { dir, key: 'D' + ({ L: '>', R: '>', U: '^', V: 'v' })[dir] + trigger };
      }
    }
    return null;
  }

  trySpecial(trigger) {
    let key = null, dir = null;
    if (this.forceSpecial) {
      key = this.forceSpecial;
      this.forceSpecial = null;
    } else if (trigger) {
      const r = this.specialKey(trigger);
      if (r) { key = r.key; dir = r.dir; }
    }
    if (!key) return false;
    const m = this.def.specials[key];
    if (!m) return false;
    if (this.mp < m.cost) {
      if (this.isHuman) this.w.fx('text', this.x, this.y + this.height + 18, this.z, { text: 'SEM MP', color: '#7fc4ff', size: 14, life: 30 });
      return false;
    }
    if (dir === 'L') this.facing = -1;
    else if (dir === 'R') this.facing = 1;
    this.buffer.length = 0;
    this.vx = 0; this.vz = 0;
    this.startMove(m, key);
    return true;
  }

  // ---- atualização ----

  update() {
    const w = this.w;
    this.frame++;
    this.recordInputs();
    if (this.hitstop > 0) {
      this.hitstop--;
      if (this.state === 'move' && this.move.next && this.input.pressed.attack) this.queued = true;
      return;
    }
    if (this.flash > 0) this.flash--;
    if (this.invuln > 0) this.invuln--;
    if (this.invisible > 0) this.invisible--;
    if (this.fallMeter > 0) this.fallMeter = Math.max(0, this.fallMeter - 0.5);
    if (this.defMeter > 0) this.defMeter = Math.max(0, this.defMeter - 0.5);
    if (!this.dead) this.mp = Math.min(this.maxMp, this.mp + (this.hp < this.maxHp * 0.3 ? 0.11 : 0.065));
    if (this.burn > 0) {
      this.burn--;
      if (this.frame % 3 === 0) w.fx('flame', this.x + rand(-10, 10), this.y + rand(10, this.height * 0.8), this.z);
    }
    if (this.shock > 0) {
      this.shock--;
      if (this.frame % 5 === 0) w.fx('zap', this.x, this.y + rand(20, this.height), this.z);
    }
    this.t++;

    switch (this.state) {
      case 'idle':
      case 'walk': this.groundControl(); break;
      case 'run': this.runControl(); break;
      case 'skid':
        if (this.t % 4 === 0) w.fx('dust', this.x, 0, this.z);
        if (this.t > 10) this.setState('idle');
        break;
      case 'jumpsquat':
        if (this.t >= 4) {
          const h = this.input.held;
          const mx = (h.right ? 1 : 0) - (h.left ? 1 : 0), mz = (h.down ? 1 : 0) - (h.up ? 1 : 0);
          if (mx) this.facing = mx;
          this.vx = mx * this.def.speed * 1.3;
          this.vz = mz * this.def.speed * 0.6;
          this.vy = this.def.jump; this.y = 0.1;
          this.dashJump = false; this.airAttack = false;
          this.setState('air');
        }
        break;
      case 'air': this.airControl(); break;
      case 'land':
        this.vx *= 0.8; this.vz *= 0.8;
        if (this.t >= (this.dashJump ? 10 : 5)) this.setState('idle');
        break;
      case 'defend': {
        const p = this.input.pressed;
        this.vx *= 0.7; this.vz *= 0.7;
        if (this.forceSpecial || p.attack || p.jump) {
          if (this.trySpecial(p.attack ? 'A' : p.jump ? 'J' : null)) break;
        }
        if (p.left) this.facing = -1;
        if (p.right) this.facing = 1;
        if (!this.input.held.defend && this.t > 8) this.setState('idle');
        break;
      }
      case 'defendHit':
        if (this.t > 10) this.setState(this.input.held.defend ? 'defend' : 'idle');
        break;
      case 'hurt':
        if (this.t >= this.stunT) this.setState('idle');
        break;
      case 'fall': break;
      case 'lying':
        if (this.dead) { this.deadT++; break; }
        if (this.t >= (this.isHuman ? 40 : 52)) this.setState('getup');
        break;
      case 'getup':
        if (this.t >= 14) { this.setState('idle'); this.invuln = Math.max(this.invuln, 30); }
        break;
      case 'frozen':
        if (--this.frozenT <= 0) {
          Sound.play('shatter');
          w.fx('shards', this.x, this.y + 40, this.z);
          this.setState(this.y > 0 ? 'air' : 'idle');
        }
        break;
      case 'move': this.moveControl(); break;
    }
    this.physics();
  }

  groundControl() {
    const inp = this.input, h = inp.held, p = inp.pressed, d = this.def;
    if (this.victory) { this.vx = 0; this.vz = 0; return; }
    if (this.forceSpecial && this.trySpecial(null)) return;
    if ((p.attack && this.trySpecial('A')) || (p.jump && this.trySpecial('J'))) return;
    if (p.attack) { this.attack(); return; }
    if (p.jump) { this.vx *= 0.3; this.vz *= 0.3; this.setState('jumpsquat'); return; }
    if (h.defend) { this.vx = 0; this.vz = 0; this.setState('defend'); return; }
    const mx = (h.right ? 1 : 0) - (h.left ? 1 : 0), mz = (h.down ? 1 : 0) - (h.up ? 1 : 0);
    if (p.left || p.right) {
      const dir = p.right ? 1 : -1;
      if (this.lastTap.dir === dir && this.frame - this.lastTap.t < 15) {
        this.facing = dir;
        this.lastTap.t = -99;
        this.setState('run');
        return;
      }
      this.lastTap = { dir, t: this.frame };
    }
    if (inp.run && mx) { this.facing = mx; this.setState('run'); return; }
    if (mx) this.facing = mx;
    this.vx = mx * d.speed;
    this.vz = mz * d.speed * 0.65;
    if (mx || mz) {
      if (this.state !== 'walk') this.setState('walk');
      this.walkPhase += 0.2 + d.speed * 0.02;
    } else if (this.state !== 'idle') {
      this.setState('idle');
    }
  }

  attack() {
    if (this.tryPickup()) return;
    if (this.holding) {
      if (ITEM_DEFS[this.holding.kind].weapon) this.startMove(BASIC.bat1, 'bat1');
      else this.startMove(BASIC.throwItem, 'throw');
      return;
    }
    this.startMove(BASIC.punch1, 'punch1');
  }

  runControl() {
    const inp = this.input, h = inp.held, p = inp.pressed, d = this.def;
    if (this.forceSpecial && this.trySpecial(null)) return;
    if ((p.attack && this.trySpecial('A')) || (p.jump && this.trySpecial('J'))) return;
    if (p.attack) {
      if (this.holding) this.startMove(BASIC.throwItem, 'throw');
      else if (!this.tryPickup()) this.startMove(BASIC.runAttack, 'runAttack');
      return;
    }
    if (p.jump) {
      this.vy = d.jump * 0.8; this.y = 0.1;
      this.vx = this.facing * d.run * 1.2;
      this.dashJump = true; this.airAttack = false;
      this.setState('air');
      return;
    }
    if (p.defend) { this.startMove(BASIC.roll, 'roll'); return; }
    if ((this.facing > 0 && h.left) || (this.facing < 0 && h.right) || (inp.ai && !inp.run)) {
      this.setState('skid');
      return;
    }
    this.vx = this.facing * d.run;
    this.vz = ((h.down ? 1 : 0) - (h.up ? 1 : 0)) * d.speed * 0.5;
    this.walkPhase += 0.32;
    if (this.t % 9 === 0) this.w.fx('dust', this.x - this.facing * 10, 0, this.z);
  }

  airControl() {
    const p = this.input.pressed;
    if (p.attack && !this.airAttack) {
      this.airAttack = true;
      if (this.holding) this.startMove(BASIC.throwItem, 'throw');
      else this.startMove(BASIC.jumpAttack, 'jumpAttack');
    }
  }

  moveControl() {
    const m = this.move, w = this.w;
    const t = ++this.moveT;
    if (m.next && this.input.pressed.attack && t > 3) this.queued = true;
    if (m.update) m.update(this, w, t);
    if (m.events && m.events[t]) m.events[t](this, w);
    if (this.state !== 'move') return;
    if (m.hit && m.hit.rehit && t > m.hit.from && t <= m.hit.to && (t - m.hit.from) % m.hit.rehit === 0) this.swing++;
    if (m.step && t === (m.hit ? m.hit.from - 1 : 1)) this.vx = this.facing * m.step;
    if (!m.keepVel && this.y <= 0) { this.vx *= 0.82; this.vz *= 0.82; }
    if (t >= m.dur) {
      if (this.queued && m.next) {
        // segurar uma arma muda a sequência para os golpes de bastão
        const next = m.next === 'punch2' && this.holding ? 'bat1' : m.next;
        this.startMove(BASIC[next], next);
        return;
      }
      if (this.y > 0) { this.setState('air'); this.airAttack = true; }
      else this.setState('idle');
    }
  }

  physics() {
    const w = this.w;
    this.x += this.vx;
    this.z += this.vz;
    if (this.y > 0 || this.vy > 0) {
      this.y += this.vy;
      this.vy -= GRAVITY * (this.state === 'fall' ? 0.9 : 1);
      if (this.y <= 0) {
        const vy = this.vy;
        this.y = 0; this.vy = 0;
        this.onLand(vy);
      }
    } else if (!CONTROL_STATES.has(this.state) && this.state !== 'run' && this.state !== 'move') {
      this.vx *= 0.85;
      this.vz *= 0.85;
    }
    const b = w.bounds;
    if (!this.entering) this.x = clamp(this.x, b.min, b.max);
    else if (this.x > b.min + 10 && this.x < b.max - 10) this.entering = false;
    this.z = clamp(this.z, 0, DEPTH);
  }

  onLand(vy) {
    const w = this.w, s = this.state;
    if (s === 'air') {
      this.setState('land');
      Sound.play('land');
      this.vx *= this.dashJump ? 0.6 : 0.2;
      this.vz *= 0.3;
    } else if (s === 'move') {
      this.setState('land');
      this.vx *= 0.4;
    } else if (s === 'fall') {
      if (vy < -7 && !this.bounced) {
        this.vy = -vy * 0.32; this.y = 0.1; this.bounced = true; this.vx *= 0.6;
        Sound.play('fall');
        w.fx('dust', this.x, 0, this.z);
        w.shake = Math.max(w.shake, 3);
      } else {
        this.setState('lying');
        this.bounced = false;
        Sound.play('land');
        w.fx('dust', this.x, 0, this.z);
        if (this.dead) Sound.play('ko');
      }
    }
  }

  // ---- dano ----

  receiveHit(h, src, dir) {
    if (this.dead || this.gone || this.invuln > 0 || this.invisible > 0) return false;
    if (this.state === 'lying' || this.state === 'getup') return false;
    if (h.onlyGround && this.y > 20) return false;
    const w = this.w;
    let dmg = h.dmg * (src ? src.def.power || 1 : 1) / (this.def.armor || 1);

    if ((this.state === 'defend' || this.state === 'defendHit') && this.facing === -dir && !h.unblockable) {
      this.defMeter += h.bdef ?? h.dmg * 1.2;
      if (this.defMeter < 70) {
        this.applyDamage(Math.min(dmg * 0.1, this.hp - 1), src);
        this.vx = dir * (1.5 + (h.kvx || 1) * 0.4);
        this.setState('defendHit');
        this.hitstop = 4;
        Sound.play('block');
        w.fx('block', this.x - dir * 12, this.y + 50 * this.size, this.z);
        return 'block';
      }
      this.defMeter = 0;
      dmg *= 0.6;
      w.fx('text', this.x, this.y + this.height + 16, this.z, { text: 'DEFESA QUEBRADA', color: '#ffd84a', size: 14, life: 40 });
    }

    this.applyDamage(dmg, src);
    this.flash = 7;
    this.fallMeter += h.fall ?? 25;
    if (this.holding && (h.knockdown || this.fallMeter >= 100 || this.hp <= 0)) this.dropItem();

    const frozen = this.state === 'frozen';
    if (frozen) {
      this.frozenT = 0;
      Sound.play('shatter');
      w.fx('shards', this.x, this.y + 40, this.z);
    }
    if (h.effect === 'ice' && !frozen && this.hp > 0) {
      this.frozenPose = this.getPose();
      this.move = null;
      this.setState('frozen');
      this.frozenT = h.freeze || 100;
      this.vx = dir * 1.5;
      this.fallMeter = 0;
      Sound.play('freeze');
      return 'hit';
    }
    if (h.effect === 'fire') this.burn = 70;
    if (h.effect === 'shock') this.shock = 40;

    const knock = this.hp <= 0 || frozen || h.knockdown || this.fallMeter >= 100 || this.y > 0;
    this.facing = -dir;
    if (knock) {
      this.fallMeter = 0;
      this.vx = dir * (h.kvx ?? 4);
      this.vy = Math.max(h.kvy ?? 6, 3.5) + (frozen ? 2 : 0);
      this.y = Math.max(this.y, 0.1);
      this.vz = 0;
      this.bounced = false;
      this.setState('fall');
    } else {
      this.vx = dir * (h.kvx ?? 1.5);
      this.vz = 0;
      this.stunT = h.stun || 18;
      this.hurtAlt = !this.hurtAlt;
      this.setState('hurt');
    }
    return 'hit';
  }

  applyDamage(dmg, src) {
    dmg = Math.round(dmg);
    if (dmg <= 0) return;
    this.hp -= dmg;
    this.stats.taken += dmg;
    if (src && src !== this) {
      src.stats.dmg += dmg;
      this.lastAttacker = src;
    }
    if (this.hp <= 0 && !this.dead) {
      this.hp = 0;
      this.dead = true;
      if (this.lastAttacker) this.lastAttacker.stats.kills++;
      this.w.onDeath(this);
    }
  }

  // ---- itens ----

  tryPickup() {
    if (this.holding) return false;
    const it = this.w.items.find((i) => !i.dead && !i.holder && !i.thrown && i.y < 4 &&
      Math.abs(i.x - this.x) < 30 && Math.abs(i.z - this.z) < 16);
    if (!it) return false;
    const d = ITEM_DEFS[it.kind];
    if (d.heal) {
      if (d.heal.hp) this.hp = Math.min(this.maxHp, this.hp + d.heal.hp);
      if (d.heal.mp) this.mp = Math.min(this.maxMp, this.mp + d.heal.mp);
      it.dead = true;
      Sound.play('drink');
      this.w.fx('text', this.x, this.y + this.height + 14, this.z, { text: d.label, color: d.color, size: 18 });
    } else {
      this.holding = it;
      it.holder = this;
      Sound.play('pick');
    }
    this.vx = 0; this.vz = 0;
    this.startMove(BASIC.pick, 'pick');
    return true;
  }

  dropItem() {
    const it = this.holding;
    if (!it) return;
    this.holding = null;
    it.holder = null;
    it.x = this.x; it.y = this.y + 40; it.z = this.z;
    it.vx = rand(-2, 2); it.vy = 4; it.vz = 0;
    it.thrown = false;
  }

  throwHeld() {
    const it = this.holding;
    if (!it) return;
    this.holding = null;
    it.holder = null;
    it.x = this.x + this.facing * 20; it.y = this.y + 50 * this.size; it.z = this.z;
    it.vx = this.facing * 12; it.vy = this.y > 0 ? 1 : 3.2; it.vz = 0;
    it.thrown = true; it.thrower = this; it.team = this.team; it.hitSet = new Set();
    Sound.play('throw');
  }

  // ---- desenho ----

  getPose() {
    switch (this.state) {
      case 'move': {
        const m = this.move;
        const p = keyPose(m.keys, this.moveT);
        if (m.spin) return Object.assign({}, p, { rot: this.moveT * m.spin, hipY: -45 });
        return p;
      }
      case 'idle': return this.victory ? POSES.victory : idlePose(this.frame + this.id * 17);
      case 'walk': return walkPose(this.walkPhase);
      case 'run': return runPose(this.walkPhase);
      case 'skid': return POSES.skid;
      case 'jumpsquat':
      case 'land':
      case 'getup': return POSES.land;
      case 'air': return this.vy > 2 ? POSES.jump : POSES.jumpDown;
      case 'defend':
      case 'defendHit': return POSES.defend;
      case 'hurt': return this.hurtAlt ? POSES.hurt2 : POSES.hurt1;
      case 'frozen': return this.frozenPose || POSES.hurt1;
      case 'fall': return Object.assign({}, POSES.fall, { rot: clamp(-15 - this.t * 5, -80, -15) });
      case 'lying': return POSES.lie;
    }
    return POSES.guard;
  }

  draw(ctx, cam) {
    if (this.gone) return;
    const sx = this.x - cam.x, sy = FLOOR_Y + this.z - this.y;
    ctx.save();
    if (this.invisible > 0) ctx.globalAlpha = this.isHuman ? 0.35 : 0.12;
    if (this.dead && this.deadT > 60 && this.fades) ctx.globalAlpha = this.deadT % 8 < 4 ? 0.25 : 0.8;
    const flash = this.flash > 0 && this.flash % 3 !== 0;
    drawFigure(ctx, sx, sy, this.facing, this.getPose(), this.def.look, this.size, {
      flash, holding: this.holding && this.holding.kind,
    });
    ctx.restore();

    if (this.state === 'frozen') {
      const s = this.size, wd = 46 * s, ht = 92 * s;
      ctx.save();
      ctx.fillStyle = 'rgba(170,225,255,0.45)';
      ctx.strokeStyle = 'rgba(235,250,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx - wd / 2, sy); ctx.lineTo(sx - wd / 2 - 4, sy - ht * 0.6); ctx.lineTo(sx - wd / 2 + 6, sy - ht);
      ctx.lineTo(sx + wd / 2 - 2, sy - ht + 8); ctx.lineTo(sx + wd / 2 + 4, sy - ht * 0.4); ctx.lineTo(sx + wd / 2, sy);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      seg(ctx, [sx - wd / 4, sy - ht * 0.8, sx - wd / 4 + 6, sy - ht * 0.55], 2, 'rgba(255,255,255,0.75)');
      ctx.restore();
    }
  }
}
