'use strict';
// Armas leves (bastão, enxada, espada de gelo), pesadas (pedra, caixa) e bebidas.
// Estados: 1000 na mão · 1001 no ar parado · 1002 arremessada · 1003/1004 no chão
//          2000 pesada no ar · 2001 na mão · 2004 no chão

const WEAPON_STATES = {
  generic(event) {
    const $ = this;
    switch (event) {
      case 'TU': {
        $.interaction();
        if ($.state() !== 1001 && $.state() !== 2001) $.dynamics();
        const ps = $.ps;
        if (ps.y === 0 && ps.vy > 0) {
          if ($.speed() > GC.weapon_bounce_limit) {
            if ($.heavy) ps.vy = GC.weapon_bounce_vy;
            else { ps.vy = 0; $.trans.frame(70); }
            if (ps.vx) ps.vx = (ps.vx > 0 ? 1 : -1) * GC.weapon_bounce_vx;
            if (ps.vz) ps.vz = (ps.vz > 0 ? 1 : -1) * GC.weapon_bounce_vz;
            $.health.hp -= $.data.bmp.weapon_drop_hurt || 0;
          } else {
            $.team = 0;
            ps.vy = 0;
            $.trans.frame($.heavy ? 21 : 70);
          }
          ps.zz = 0;
        }
        break;
      }
      case 'die':
        $.trans.frame(1000);
        if ($.data.bmp.weapon_broken_sound) Sound.play($.data.bmp.weapon_broken_sound);
        $.brokenEffect($.id);
        if ($.holder) { $.holder.hold = null; $.holder = null; }
        break;
      case 'leaving':
        if ($.match.leaving($, 200)) $.trans.frame(1000);
        break;
    }
  },
  1003(event) {
    const $ = this;
    if (event === 'frame' && $.frame.N === 70 && !$.frame.D.sound && $.data.bmp.weapon_drop_sound) Sound.play($.data.bmp.weapon_drop_sound);
  },
  1004(event) {
    if (event === 'frame' && this.frame.N === 64) this.team = 0;
  },
  2000(event) {
    const $ = this;
    if (event === 'frame' && $.frame.N === 21) {
      $.trans.setNext(20);
      if (!$.frame.D.sound && $.data.bmp.weapon_drop_sound) Sound.play($.data.bmp.weapon_drop_sound);
    }
  },
  2004(event) {
    if (event === 'frame' && this.frame.N === 20) this.team = 0;
  },
};

class Weapon extends Living {
  constructor(match, id, team = 0) {
    super(match, id, team);
    this.states = WEAPON_STATES;
    this.heavy = this.type === 'heavyweapon';
    this.light = !this.heavy;
    this.holder = null;
    this.pre = null;
    this.health.hp = this.data.bmp.weapon_hp || 100;
    this.setup();
  }

  init(T) {
    if (T.opoint.kind === 2) {
      T.parent.hold = this;
      this.pick(T.parent);
    }
  }

  // arma arremessada ou caindo acerta quem estiver no caminho
  interaction() {
    const $ = this;
    if ($.team === 0 || !($.heavy || $.state() === 1002)) return;
    for (const I of makeArray($.frame.D.itr)) {
      if (I.kind !== 0) continue;
      const vol = $.volume(I);
      vol.zwidth = 0;
      for (const T of $.match.query(vol, $, { tag: 'body', notTeam: $.team })) {
        if ($.itr.arest) break;
        if ($.attacked(T.hit(I, $, { x: $.ps.x, y: $.ps.y, z: $.ps.z }, vol))) {
          const ps = $.ps, vx = ps.vx === 0 ? 0 : ps.vx > 0 ? 1 : -1;
          if ($.light) { ps.vx = vx * GC.weapon_hit_vx; ps.vy = 0; }
          $.arestUpdate(I);
          $.effect.dvx = 0;
          $.effect.dvy = 0;
          $.effectStuck(0, $.light ? 2 : 4);
        }
      }
    }
  }

  hit(ITR, att, attps, rect) {
    const $ = this;
    if ($.holder || $.itr.vrest[att.uid]) return false;
    if (ITR.kind === 15) { $.whirlwind(rect); return true; }
    if (ITR.kind === 10 || ITR.kind === 11) { $.flute(); return true; }
    let accept = false;
    const fall = ITR.fall !== undefined ? ITR.fall : GC.fall_value;
    const ps = $.ps;
    if ($.light) {
      if ($.state() === 1002) {
        accept = true;
        if ((att.dirh() > 0) !== (ps.vx > 0)) ps.vx *= GC.weapon_reverse_vx;
        ps.vy *= GC.weapon_reverse_vy;
        ps.vz *= GC.weapon_reverse_vz;
        $.team = att.team;
      } else if ($.state() === 1004 && (att.type === 'lightweapon' || att.type === 'heavyweapon')) {
        accept = true;
        ps.vx = (att.ps.vx ? (att.ps.vx > 0 ? 1 : -1) : 0) * GC.weapon_bounce_vx;
        ps.vz = (att.ps.vz ? (att.ps.vz > 0 ? 1 : -1) : 0) * GC.weapon_bounce_vz;
      }
    } else if ($.state() === 2004) {
      accept = true;
      if (fall < 30) $.effectCreate(0, GC.effect_duration);
      else if (fall < GC.fall_ko) ps.vy = GC.weapon_soft_bounce_vy;
      else {
        ps.vy = GC.weapon_bounce_vy;
        if (att.ps.vx) ps.vx = (att.ps.vx > 0 ? 1 : -1) * GC.weapon_bounce_vx;
        if (att.ps.vz) ps.vz = (att.ps.vz > 0 ? 1 : -1) * GC.weapon_bounce_vz;
        $.trans.frame(999);
      }
    } else if ($.state() === 2000 && fall >= GC.fall_ko) {
      accept = true;
      if ((att.dirh() > 0) !== (ps.vx > 0)) ps.vx *= GC.weapon_reverse_vx;
      ps.vy *= GC.weapon_reverse_vy;
      ps.vz *= GC.weapon_reverse_vz;
      $.team = att.team;
    }
    if (accept) {
      if (rect) $.visualEffect(0, rect, attps.x < ps.x, fall < GC.fall_ko ? 1 : 2);
      if (ITR.vrest) $.itr.vrest[att.uid] = ITR.vrest;
      if (ITR.injury) $.health.hp -= ITR.injury;
      if ($.data.bmp.weapon_hit_sound) Sound.play($.data.bmp.weapon_hit_sound);
    }
    return accept;
  }

  // na mão do personagem: segue o wpoint e, se for o caso, ataca ou é arremessada
  act(att, wp, holdpoint) {
    const $ = this, result = {};
    if ($.data.frame[wp.weaponact]) {
      $.trans.frame(wp.weaponact);
      $.trans.trans();
    }
    const fD = $.frame.D;
    if (fD.wpoint && fD.wpoint.kind === 2) {
      if (wp.dvx) $.ps.vx = att.dirh() * wp.dvx;
      if (wp.dvz) $.ps.vz = att.dirv() * wp.dvz;
      if (wp.dvy) $.ps.vy = wp.dvy;
      if ($.ps.vx || $.ps.vy || $.ps.vz) {
        const imx = $.light ? 58 : 48, imy = $.light ? -15 : -40;
        $.setPos(att.ps.x + att.dirh() * imx, att.ps.y + imy, att.ps.z + $.ps.vz);
        $.ps.zz = 1;
        $.trans.frame($.light ? 40 : 999);
        $.trans.trans();
        $.holder = null;
        $.shadowVisible = true;
        result.thrown = true;
      } else {
        $.ps.zz = wp.cover === 1 ? -1 : 1;
        $.switchDir(att.ps.dir);
        $.ps.z = att.ps.z;
        $.updateScreenPos();
        $.coincideXY(holdpoint, $.point(fD.wpoint));
      }
      if ($.light && wp.attacking) {
        for (const I of makeArray(fD.itr)) {
          if (I.kind !== 5) continue;
          const vol = $.volume(I);
          vol.zwidth = 0;
          for (const T of $.match.query(vol, [$, att], { tag: 'body', notTeam: $.team })) {
            if (att.itr.arest) break;
            const list = $.data.weapon_strength_list;
            const citr = list && list[wp.attacking] ? list[wp.attacking] : I;
            if ($.attacked(T.hit(citr, att, { x: att.ps.x, y: att.ps.y, z: att.ps.z }, vol))) {
              if (citr.vrest) result.vrest = citr.vrest;
              if (citr.arest) result.arest = citr.arest;
              result.hit = T.uid;
            }
          }
        }
      }
    }
    return result;
  }

  drop(dvx, dvy) {
    this.team = 0;
    this.holder = null;
    if (dvx) this.ps.vx = dvx * 0.5;
    if (dvy) this.ps.vy = dvy * 0.2;
    this.ps.zz = 0;
    this.trans.frame(999);
    this.shadowVisible = true;
  }

  pick(att) {
    if (this.holder) return false;
    this.holder = att;
    this.pre = att;
    this.team = att.team;
    this.shadowVisible = false;
    return true;
  }

  attacked(inj) {
    if (this.pre) return this.pre.attacked(inj);
    return inj !== false;
  }

  killed() { if (this.pre) this.pre.killed(); }

  whirlwind(rect) {
    const ps = this.ps;
    ps.vy -= 2 / this.mass;
    const cx = rect.x + rect.vx + rect.w * 0.5;
    ps.vx -= (ps.x - cx > 0 ? 1 : -1) * 2 / this.mass;
    ps.vz -= (ps.z - rect.z > 0 ? 1 : -1) * 0.5 / this.mass;
  }

  flute() {
    const ps = this.ps;
    this.effect.super = true;
    ps.vx = 0; ps.vz = 0;
    if (ps.y > -140) ps.vy = ps.vy <= 0 ? -7.5 : -ps.vy / 2;
    else if (ps.y > -160) ps.vy -= this.mass / 2;
    else if (ps.y > -180) ps.vy += this.mass / 2;
    if (this.light && this.frame.N >= 55) this.trans.frame(40, 20);
    if (this.heavy && this.frame.N >= 5) this.trans.frame(1, 20);
  }
}
