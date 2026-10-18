'use strict';
// Ataques especiais: bolas de energia, flechas, colunas de gelo, redemoinhos...
// Estados: 3000 bola voando (rebate e se anula com outras) · 3001-3004 variações
//          3005/3006 bolas fortes · 1002 projéteis com física · 15 redemoinho

const BALL_STATES = {
  generic(event, a, b) {
    const $ = this;
    switch (event) {
      case 'TU':
        $.interaction();
        $.dynamics();
        // hit_a é quanto de "vida" a bola perde por TU; ao zerar vai para hit_d
        if ($.frame.D.hit_a) $.health.hp -= $.frame.D.hit_a;
        break;
      case 'frame':
        for (const op of makeArray($.frame.D.opoint)) $.match.createObject(op, $);
        if ($.frame.N === 15) $.trans.frame(1000);
        break;
      case 'frame_force':
      case 'TU_force':
        if ($.frame.D.hit_j) $.ps.vz = $.frame.D.hit_j - 50;
        break;
      case 'leaving':
        if ($.match.leaving($, 200)) $.trans.frame(1000);
        break;
      case 'hit':
      case 'hit_others':
        if ($.data.bmp.weapon_broken_sound) Sound.play($.data.bmp.weapon_broken_sound);
        break;
      case 'die':
        $.trans.frame($.frame.D.hit_d);
        break;
    }
    return BALL_STATES.chase.call($, event, a, b);
  },

  // bolas que perseguem o alvo (hit_Fa 1/2) ou disparam em linha reta (hit_Fa 10)
  chase(event) {
    const $ = this;
    if (event !== 'TU') return;
    const fa = $.frame.D.hit_Fa;
    if ((fa === 1 || fa === 2) && $.health.hp > 0) {
      const T = $.chaseTarget();
      if (T) {
        const dx = T.ps.x - $.ps.x, dz = T.ps.z - $.ps.z;
        if ($.ps.vx * (dx >= 0 ? 1 : -1) < 14) $.ps.vx += (dx >= 0 ? 1 : -1) * 0.7;
        if ($.ps.vz * (dz >= 0 ? 1 : -1) < 2.2) $.ps.vz += (dz >= 0 ? 1 : -1) * 0.4;
        $.switchDir($.ps.vx >= 0 ? 1 : -1);
      }
    }
    if (fa === 10) {
      $.ps.vx = ($.ps.vx > 0 ? 1 : -1) * 17;
      $.ps.vz = 0;
    }
  },

  1002(event) { // projéteis com física (flechas)
    const $ = this;
    if (event === 'state_entry') $.nobounce = $.parent && $.parent.ps.y === 0;
    if (event === 'hit_others') { $.ps.vx = 0; $.trans.frame(10); }
    if (event === 'TU') {
      const ps = $.ps;
      if (ps.y === 0 && ps.vy > 0) {
        if ($.nobounce) $.trans.frame(1000);
        else if ($.speed() > GC.weapon_bounce_limit) {
          $.trans.frame(10);
          ps.vy = GC.weapon_bounce_vy;
          if (ps.vx) ps.vx = (ps.vx > 0 ? 1 : -1) * GC.weapon_bounce_vx;
          if (ps.vz) ps.vz = (ps.vz > 0 ? 1 : -1) * GC.weapon_bounce_vz;
        }
      }
    }
  },

  3000(event, ITR, att) {
    const $ = this;
    const myItr = makeArray($.frame.D.itr)[0] || {};
    const attItr = att && att.frame ? makeArray(att.frame.D.itr)[0] || {} : {};
    const isBall = att && att.type === 'specialattack';
    switch (event) {
      case 'hit_others':
        if (ITR.effect === 3 && isBall && att.state() === 3000 && attItr.effect !== 3 && attItr.effect !== 2) return;
        if (ITR.effect !== 3 && ITR.effect !== 2 && isBall && attItr.effect === 3) {
          $.ps.vx = 0;
          $.trans.frame(1000);
          $.match.createObject({ kind: 1, x: 41, y: 50, action: 0, dvx: 0, dvy: 0, oid: 209, facing: 0 }, att);
          return true;
        }
        $.ps.vx = 0;
        $.trans.frame(10);
        break;
      case 'hit':
        if (myItr.kind === 14) { $.trans.setWait(0, 20); return true; }
        if (att.team === $.team && att.ps.dir === $.ps.dir) return false;
        if (myItr.effect === 3 && isBall && att.state() === 3000 && attItr.effect !== 3 && attItr.effect !== 2) return true;
        if (isBall) {
          if (myItr.effect !== 3 && myItr.effect !== 2 && ITR.effect === 3) {
            $.ps.vx = 0;
            $.trans.frame(1000);
            $.match.createObject({ kind: 1, x: 41, y: 50, action: 0, dvx: 0, dvy: 0, oid: 209, facing: 0 }, att);
            return true;
          }
          if (ITR.kind === 0) { $.ps.vx = 0; $.trans.frame(20); return true; }
        }
        if (att.state && att.state() === 19) { $.ps.vx = 0; $.trans.frame(20); return true; }
        if (ITR.kind === 0 || ITR.kind === 9) {
          // rebatida: muda de time e volta
          $.ps.vx = 0;
          $.team = att.team;
          $.trans.frame(30);
          $.trans.trans(); $.TU(); $.trans.trans(); $.TU();
          return true;
        }
        break;
      case 'state_exit':
        if (Assets.prop($.id, 'shatter')) $.brokenEffect(212);
        break;
    }
  },

  3006(event, ITR, att) {
    const $ = this;
    const isBall = att && att.type === 'specialattack';
    switch (event) {
      case 'hit_others':
        if (isBall && (att.state() === 3005 || att.state() === 3006)) {
          $.trans.frame(10);
          $.ps.vx = 0; $.ps.vz = 0;
          return true;
        }
        break;
      case 'hit':
        if (ITR.kind === 9) { $.ps.vx *= -1; $.ps.z += 0.3; return true; }
        if (isBall && (att.state() === 3005 || att.state() === 3006)) {
          $.trans.frame(20);
          $.ps.vx = 0; $.ps.vz = 0;
          return true;
        }
        if (isBall && att.state() === 3000) { $.ps.vx = ($.ps.vx > 0 ? -1 : 1) * 7; return true; }
        if (ITR.kind === 0) {
          $.ps.vx = ($.ps.vx > 0 ? -1 : 1);
          if (ITR.bdefend && ITR.bdefend > GC.defend_break) $.health.hp = 0;
          return true;
        }
        break;
    }
  },

  15(event) { // redemoinho
    if (event === 'TU') this.ps.vx = this.dirh() * this.frame.D.dvx;
  },
};

class Ball extends Living {
  constructor(match, id, team) {
    super(match, id, team);
    this.states = BALL_STATES;
    this.health.hp = Assets.prop(id, 'hp') || GC.hp_full;
    if (!GC.projectiles.includes(id)) this.mass = 0;
    this.setup();
  }

  init(T) {
    const op = T.opoint;
    this.parent = T.parent;
    this.ps.z = T.z;
    this.updateScreenPos();
    this.coincideXY(T.pos, this.point(this.frame.D, 'center'));
    let face = op.facing;
    if (face >= 20) face %= 10;
    let dir;
    if (face === 0) dir = T.dir;
    else if (face === 1) dir = -T.dir;
    else if (face >= 2 && face <= 10) dir = 1;
    else dir = -1;
    this.switchDir(dir);
    this.trans.frame(op.action === 0 ? 999 : op.action);
    this.trans.trans();
    this.ps.vx = this.dirh() * op.dvx;
    this.ps.vy = op.dvy;
    this.ps.vz = this.frame.D.dvx ? T.dvz : 0;
  }

  interaction() {
    const $ = this;
    if ($.team === 0) return;
    for (const I of makeArray($.frame.D.itr)) {
      const vol = $.volume(I);
      const zw = Assets.prop($.id, 'zwidth');
      vol.zwidth = zw || 0;
      for (const T of $.match.query(vol, $, { tag: 'body' })) {
        if ([0, 9, 15, 16].includes(I.kind)) {
          if (T.type === 'character' && T.team === $.team) continue;
          if (I.kind === 0 && T.type !== 'character' && T.team === $.team && T.ps.dir === $.ps.dir) continue;
          if ($.itr.arest) continue;
          if ($.attacked(T.hit(I, $, { x: $.ps.x, y: $.ps.y, z: $.ps.z }, vol))) {
            $.arestUpdate(I);
            $.stateUpdate('hit_others', I, T);
            if (I.arest) break;
            if (T.type === 'character' && I.kind === 9) $.health.hp = 0; // escudo se desfaz ao tocar alguém
          }
        } else if (I.kind === 8 && T.type === 'character') {
          if (T.heal(I.injury)) $.trans.frame(I.dvx);
        }
      }
    }
  }

  hit(ITR, att, attps, rect) {
    if (this.itr.vrest[att.uid]) return false;
    if (ITR && ITR.vrest) this.itr.vrest[att.uid] = ITR.vrest;
    return this.stateUpdate('hit', ITR, att, attps, rect);
  }

  attacked(inj) { return this.parent ? this.parent.attacked(inj) : !!inj; }
  killed() { if (this.parent) this.parent.killed(); }

  chaseTarget() {
    if (!this.chased) this.chased = {};
    const list = this.match.queryAll(this, { type: 'character', notTeam: this.team }).filter((c) => !c.dead);
    if (!list.length) return null;
    const dist = (o) => { const dx = o.ps.x - this.ps.x, dz = o.ps.z - this.ps.z; return Math.sqrt(dx * dx + dz * dz); };
    const score = (o) => dist(o) + 500 * (this.chased[o.uid] || 0);
    list.sort((a, b) => score(a) - score(b));
    const t = list[0];
    this.chased[t.uid] = (this.chased[t.uid] || 0) + 1;
    return t;
  }
}
