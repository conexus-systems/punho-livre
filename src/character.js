'use strict';
// Personagem do LF2: estados (parado, andando, correndo, pulando, defendendo,
// agarrando, caindo...), combos, golpes, agarrões e armas.
//
// Quadros importantes (padrão dos dados do LF2):
//   0-3 parado · 5-8 andando · 9-11 correndo · 12-19 com objeto pesado
//   20-58 golpes e arremessos com arma · 60-73 socos · 80-91 ataques no ar/correndo
//   100-109 rolamento · 110-114 defesa · 115-117 pegar arma · 120-144 agarrão
//   180-191 queda · 200-206 gelo e fogo · 210-219 pulo, avanço, agachar · 220-234 dor, deitado

const CHAR_SWITCH = { 0: true, 1: true, 2: false, 3: false, 4: true, 5: false, 6: false, 7: true, 8: false,
  9: false, 10: false, 11: false, 12: false, 13: false, 14: false, 15: false, 16: false };

const CHAR_STATES = {
  generic(event, K) {
    const $ = this;
    switch (event) {
      case 'frame': {
        const D = $.frame.D;
        if (D.mp) {
          if ($.data.frame[$.frame.PN] && $.data.frame[$.frame.PN].next === $.frame.N) {
            // quadro alcançado pelo `next`: mp negativo consome MP continuamente
            if (D.mp < 0) {
              $.health.mp += D.mp;
              $.health.mp_usage -= D.mp;
              if ($.health.mp < 0) {
                $.health.mp = 0;
                $.trans.frame(D.hit_d);
              }
            }
          } else {
            const dmp = D.mp % 1000, dhp = Math.floor(D.mp / 1000) * 10;
            $.health.mp -= dmp;
            $.health.mp_usage += dmp;
            $.injury(dhp);
          }
        }
        $.opoint();
        break;
      }
      case 'TU': {
        $.disappearTU();
        if (!$.stateUpdate('post_interaction')) $.postInteraction();
        const ps = $.ps;
        if (ps.y === 0 && ps.vy === 0 && $.frame.N === 212 && $.frame.PN !== 211) {
          $.trans.frame(999);
        } else if (ps.y === 0 && ps.vy > 0) {
          // caiu no chão
          const r = $.stateUpdate('fell_onto_ground');
          if (r) $.trans.frame(r, 15);
          else {
            ps.vy = 0;
            $.linearFriction(lookupAbs(LOOKUP.fell_friction, ps.vx), lookupAbs(LOOKUP.fell_friction, ps.vz));
          }
        } else if (ps.y + ps.vy >= 0 && ps.vy > 0) {
          // vai tocar o chão
          const r = $.stateUpdate('fall_onto_ground');
          if (r) $.trans.frame(r, 15);
          else if ($.state() === 13) { /* congelado: cai parado */ }
          else if ($.frame.N === 212) $.trans.frame(215, 15);
          else $.trans.frame(219, 15);
        }
        const t = $.match.time;
        // recuperação natural de vida (até o limite escuro) e de MP
        if (t % 12 === 0 && $.health.hp > 0 && $.health.hp < $.health.hp_bound) $.health.hp++;
        if ($.health.hp > 0 && $.effect.heal > 0 && t % 8 === 0) {
          if ($.health.hp + 8 <= $.health.hp_bound) $.health.hp += 8;
          $.effect.heal -= 8;
        }
        if (t % 3 === 0 && $.health.mp < $.health.mp_full && !$.dead) {
          const lost = $.health.hp_full - Math.min($.health.hp, $.health.hp_full);
          $.health.mp = Math.min($.health.mp_full, $.health.mp + 1 + Math.floor(lost / 100));
        }
        if ($.health.fall > 0) $.health.fall += GC.recover_fall;
        if ($.health.bdefend > 0) $.health.bdefend += GC.recover_bdefend;
        if (--$.combo.timeout === 0) {
          if (['def', 'jump', 'att', 'left-left', 'right-right'].includes($.combo.name)) $.combo.name = null;
        }
        break;
      }
      case 'transit':
        $.dynamics();
        $.wpoint();
        break;
      case 'combo':
        switch (K) {
          case 'left': case 'right': case 'left-left': case 'right-right':
            break;
          default: {
            if (K === 'DJA' && $.transformed) { $.revertTransform(); return 1; }
            const tag = COMBO_TAG[K];
            if (tag && $.frame.D[tag]) {
              if (!$.idUpdate('generic_combo', K, tag)) {
                const dir = COMBO_DIR[K];
                if (dir) $.switchDir(dir);
                $.trans.frame($.frame.D[tag], 11);
                return 1;
              }
            }
          }
        }
        break;
      case 'post_combo':
        $.preInteraction();
        break;
      case 'state_exit':
        if ($.combo.name === 'left-left' || $.combo.name === 'right-right') $.combo.name = null;
        break;
    }
  },

  0(event, K) { // parado
    const $ = this;
    const heavy = $.hold && $.hold.type === 'heavyweapon';
    switch (event) {
      case 'frame':
        if (heavy) $.trans.frame(12);
        break;
      case 'combo': {
        if (['left', 'right', 'up', 'down', 'jump', null].includes(K)) {
          const dx = $.con.state.left !== $.con.state.right, dz = $.con.state.up !== $.con.state.down;
          if (dx || dz) {
            const b = $.data.bmp;
            if (heavy) {
              if (dx) $.ps.vx = $.dirh() * b.heavy_walking_speed;
              $.ps.vz = $.dirv() * b.heavy_walking_speedz;
            } else {
              if (K !== 'jump') $.trans.frame(5, 5);
              if (dx) $.ps.vx = $.dirh() * b.walking_speed;
              $.ps.vz = $.dirv() * b.walking_speedz;
            }
          }
        }
        switch (K) {
          case 'left-left': case 'right-right':
            $.trans.frame(heavy ? 16 : 9, 10);
            return 1;
          case 'def':
            if (heavy) return 1;
            $.trans.frame(110, 10);
            return 1;
          case 'jump':
            if (heavy) {
              const hj = $.prop('heavy_weapon_jump');
              if (hj) $.trans.frame(hj, 10);
              return 1;
            }
            $.trans.frame(210, 10);
            return 1;
          case 'att': {
            if ($.hold) {
              const dx = $.con.state.left !== $.con.state.right, wid = $.hold.id;
              if ($.hold.type === 'heavyweapon') { $.trans.frame(50, 10); return 1; }
              if ($.hold.type === 'drink') { $.trans.frame(55, 10); return 1; }
              if (Assets.prop(wid, 'just_throw') || (dx && Assets.prop(wid, 'stand_throw'))) { $.trans.frame(45, 10); return 1; }
              if (Assets.prop(wid, 'attackable')) { $.trans.frame($.match.random() < 0.5 ? 20 : 25, 10); return 1; }
            }
            // soco forte se houver alguém atordoado (itr kind 6) ao alcance
            const sp = makeArray(($.data.frame[72] && $.data.frame[72].itr) || ($.data.frame[73] && $.data.frame[73].itr))[0];
            if (sp && $.match.query($.volume(sp), $, { tag: 'itr:6', notTeam: $.team }).length) {
              $.trans.frame(70, 10);
              return 1;
            }
            $.trans.frame($.match.random() < 0.5 ? 60 : 65, 10);
            return 1;
          }
        }
        break;
      }
    }
  },

  1(event, K) { // andando
    const $ = this;
    const heavy = $.hold && $.hold.type === 'heavyweapon';
    let dx = 0, dz = 0;
    if ($.con.state.left) dx -= 1;
    if ($.con.state.right) dx += 1;
    if ($.con.state.up) dz -= 1;
    if ($.con.state.down) dz += 1;
    switch (event) {
      case 'frame':
        if (heavy) {
          if (dx || dz) $.aniOscillate(12, 15);
          else $.trans.setNext($.frame.N);
        } else $.aniOscillate(5, 8);
        $.trans.setWait($.data.bmp.walking_frame_rate - 1);
        break;
      case 'TU': {
        const xf = 1 - ($.dirv() ? 1 : 0) * (2 / 7), b = $.data.bmp;
        if (heavy) {
          if (dx) $.ps.vx = xf * $.dirh() * b.heavy_walking_speed;
          $.ps.vz = $.dirv() * b.heavy_walking_speedz;
        } else {
          if (dx) $.ps.vx = xf * $.dirh() * b.walking_speed;
          $.ps.vz = $.dirv() * b.walking_speedz;
          if (!dx && !dz && $.trans.next() !== 999) {
            $.trans.setNext(999);
            $.trans.setWait(1, 1, 2);
          }
        }
        break;
      }
      case 'state_entry':
        $.trans.setWait(0);
        break;
      case 'combo':
        if (dx !== 0 && dx !== $.dirh()) $.switchDir(-$.dirh());
        if (!dx && !dz && !$.statemem.released) {
          $.statemem.released = true;
          $.unitFriction();
        }
        if (K) return CHAR_STATES[0].call($, event, K);
        break;
    }
  },

  2(event, K) { // correndo
    const $ = this;
    const heavy = $.hold && $.hold.type === 'heavyweapon';
    switch (event) {
      case 'frame':
        $.aniOscillate(heavy ? 16 : 9, heavy ? 18 : 11);
        $.trans.setWait($.data.bmp.running_frame_rate);
      // continua no TU
      case 'TU': {
        const xf = 1 - ($.dirv() ? 1 : 0) * (1 / 7), b = $.data.bmp;
        $.ps.vx = xf * $.dirh() * (heavy ? b.heavy_running_speed : b.running_speed);
        $.ps.vz = $.dirv() * (heavy ? b.heavy_running_speedz : b.running_speedz);
        break;
      }
      case 'combo':
        switch (K) {
          case 'left': case 'right': case 'left-left': case 'right-right': {
            const d = K.startsWith('left') ? -1 : 1;
            if (d !== $.ps.dir) { $.trans.frame(heavy ? 19 : 218, 10); return 1; }
            break;
          }
          case 'def':
            if (heavy) return 1;
            $.trans.frame(102, 10);
            return 1;
          case 'jump':
            if (heavy) {
              const hd = $.prop('heavy_weapon_dash');
              if (hd) $.trans.frame(hd, 10);
              return 1;
            }
            $.trans.frame(213, 10);
            return 1;
          case 'att':
            if ($.hold) {
              if ($.hold.type === 'heavyweapon') { $.trans.frame(50, 10); return 1; }
              const dx = $.con.state.left !== $.con.state.right;
              if (dx && Assets.prop($.hold.id, 'run_throw')) { $.trans.frame(45, 10); return 1; }
              if (Assets.prop($.hold.id, 'attackable')) { $.trans.frame(35, 10); return 1; }
            }
            $.trans.frame(85, 10);
            return 1;
        }
        break;
    }
  },

  3(event, K) { // ataques
    const $ = this;
    switch (event) {
      case 'frame':
        if ($.frame.D.next === 999 && $.ps.y < 0) $.trans.setNext(212);
        if ($.frame.N === 253) $.idUpdate('state3_fly_crash');
        $.idUpdate('state3_frame');
        break;
      case 'hit_stop':
        return $.idUpdate('state3_hit_stop');
      case 'frame_force':
        return $.idUpdate('state3_frame_force');
      case 'TU': {
        // flauta / redemoinho do Henry (itr kind 10/11): levanta todos ao redor
        const itrs = makeArray($.frame.D.itr);
        if (itrs.some((I) => I.kind === 10 || I.kind === 11) && $.match.time % 2 === 0) {
          const I = makeArray($.data.frame[251] && $.data.frame[251].itr)[0];
          if (!I) break;
          for (const T of $.match.live) {
            if (T === $ || T.uid < 0) continue;
            const zd = Math.abs(T.ps.z - $.ps.z), xd = Math.abs(T.ps.x - $.ps.x);
            if (xd * xd + 4 * zd * zd >= 150 * 150) continue;
            if (T.ps.y < 0 || T.type === 'character' || $.match.random() < 0.15) {
              if (T.type === 'character' && T.hold) T.dropWeapon(0, 0);
              if ($.attacked(T.hit(I, $, { x: $.ps.x, y: $.ps.y, z: $.ps.z }, $.volume(I)))) T.arestUpdate(I);
            }
          }
        }
        break;
      }
    }
  },

  4(event, K) { // pulo
    const $ = this;
    switch (event) {
      case 'frame':
        $.statemem.frameTU = true;
        if ($.frame.PN === 80 || $.frame.PN === 81) $.statemem.attlock = 2;
        break;
      case 'TU':
        if ($.statemem.frameTU) {
          $.statemem.frameTU = false;
          if ($.frame.N === 212 && $.frame.PN === 211) {
            let dx = 0;
            if ($.con.state.left) dx -= 1;
            if ($.con.state.right) dx += 1;
            const b = $.data.bmp;
            $.ps.vx = dx * (b.jump_distance - 1);
            $.ps.vz = $.dirv() * (b.jump_distancez - 1);
            $.ps.vy = b.jump_height;
          }
        }
        if ($.statemem.attlock) $.statemem.attlock--;
        break;
      case 'combo':
        if ((K === 'att' || $.con.state.att) && !$.statemem.attlock && $.frame.N === 212) {
          if ($.hold) {
            const dx = $.con.state.left !== $.con.state.right;
            if (dx && Assets.prop($.hold.id, 'jump_throw')) $.trans.frame(52, 10);
            else if (Assets.prop($.hold.id, 'attackable')) $.trans.frame(30, 10);
          } else $.trans.frame(80, 10);
          return 1;
        }
        break;
    }
  },

  5(event, K) { // avanço (dash)
    const $ = this;
    switch (event) {
      case 'state_entry':
        if (($.frame.PN >= 9 && $.frame.PN <= 11) || $.frame.PN === 215) {
          const b = $.data.bmp;
          $.ps.vx = $.dirh() * (b.dash_distance - 1) * ($.frame.N === 213 ? 1 : -1);
          $.ps.vz = $.dirv() * (b.dash_distancez - 1);
          $.ps.vy = b.dash_height;
        }
        break;
      case 'combo':
        if (K === 'att' || $.con.state.att) {
          if ($.prop('dash_backattack') || $.dirh() === ($.ps.vx > 0 ? 1 : -1)) {
            if ($.hold && Assets.prop($.hold.id, 'attackable')) $.trans.frame(40, 10);
            else $.trans.frame(90, 10);
            $.allowSwitch = false;
            if (K === 'att') return 1;
          }
        }
        if (K === 'left' || K === 'right') {
          const d = K === 'left' ? -1 : 1;
          if (d !== $.ps.dir) {
            if ($.dirh() === ($.ps.vx > 0 ? 1 : -1)) {
              if ($.frame.N === 213) $.trans.frame(214, 0);
              if ($.frame.N === 216) $.trans.frame(217, 0);
            } else {
              if ($.frame.N === 214) $.trans.frame(213, 0);
              if ($.frame.N === 217) $.trans.frame(216, 0);
            }
            $.switchDir(d);
            return 1;
          }
        }
        break;
    }
  },

  6(event) { // rolamento
    const $ = this;
    switch (event) {
      case 'TU':
        if ($.frame.N === 100 || $.frame.N === 108) $.ps.vy = 0;
        break;
      case 'frame':
        if ($.frame.N === 100 || $.frame.N === 108) $.trans.setWait(1);
        break;
      case 'fall_onto_ground':
        if ($.frame.N === 101 || $.frame.N === 109) return 215;
        break;
    }
  },

  7(event) { // defendendo
    if (event === 'frame' && this.frame.N === 111) this.trans.incWait(4);
  },

  8(event) { // defesa quebrada
    const $ = this;
    if (event === 'frame_force' || event === 'TU_force') {
      const D = $.frame.D;
      if (D.dvx && ($.ps.vx > 0 ? 1 : -1) !== $.dirh()) {
        const avx = Math.abs($.ps.vx), d = 2 * ($.ps.vx > 0 ? 1 : -1);
        if ($.ps.y < 0 || avx < D.dvx) $.ps.vx = d * D.dvx;
        if (D.dvx < 0) $.ps.vx -= d;
      }
    }
  },

  9(event, K) { // agarrando
    const $ = this;
    switch (event) {
      case 'state_entry':
        $.statemem.stateTU = true;
        $.statemem.counter = 43;
        $.statemem.attacks = 0;
        break;
      case 'state_exit':
        $.catching = null;
        $.ps.zz = 0;
        break;
      case 'frame':
        switch ($.frame.N) {
          case 123: $.statemem.attacks++; $.statemem.counter += 3; $.trans.incWait(1); break;
          case 233: case 234: $.trans.incWait(-1); break;
          case 240: $.idUpdate('rudolf_transform'); break;
        }
        if ($.catching && $.frame.D.cpoint) {
          $.catching.caughtB($.point($.frame.D.cpoint), $.frame.D.cpoint, $.ps.dir, $.dirv());
        }
        break;
      case 'TU':
        if ($.catching && $.cpointKind() === 1 && $.catching.cpointKind() === 2 && $.statemem.stateTU) {
          $.statemem.stateTU = false;
          const cp = $.frame.D.cpoint;
          if (cp.injury) {
            if ($.attacked($.catching.hit(cp, $, { x: $.ps.x, y: $.ps.y, z: $.ps.z }, null))) $.trans.incWait(1, 10, 99);
          }
          const cover = cp.cover !== undefined ? cp.cover : 0;
          $.ps.zz = cover === 0 || cover === 10 ? 1 : -1;
          if (cp.dircontrol === 1) {
            if ($.con.state.left) $.switchDir(-1);
            if ($.con.state.right) $.switchDir(1);
          }
        }
        break;
      case 'post_combo':
        if ($.catching) $.statemem.counter--;
        if ($.statemem.counter <= 0 && !($.frame.N === 122 && $.statemem.attacks === 4)) {
          if (($.frame.N === 121 || $.frame.N === 122) && $.catching) {
            $.catching.caughtRelease();
            $.trans.frame(999, 15);
          }
        }
        break;
      case 'combo':
        if (K === 'att') {
          const cp = $.frame.D.cpoint;
          if (cp && (cp.taction || cp.aaction) && $.catching) {
            const dx = $.con.state.left !== $.con.state.right, dy = $.con.state.up !== $.con.state.down;
            if ((dx || dy) && cp.taction) {
              if (cp.taction < 0) { $.switchDir(-$.ps.dir); $.trans.frame(-cp.taction, 10); }
              else $.trans.frame(cp.taction, 10);
              $.statemem.counter += 10;
            } else if (cp.aaction) $.trans.frame(cp.aaction, 10);
            const nf = $.data.frame[$.trans.next()];
            if (nf && nf.cpoint) $.catching.caughtThrow(nf.cpoint, $.dirv());
          }
          return 1;
        }
        if (K === 'jump' && $.frame.N === 121 && $.frame.D.cpoint && $.frame.D.cpoint.jaction) {
          $.trans.frame($.frame.D.cpoint.jaction, 10);
          return 1;
        }
        break;
    }
  },

  10(event) { // sendo agarrado
    const $ = this;
    switch (event) {
      case 'state_exit':
        $.catching = null;
        $.caught = null;
        $.caughtThrowZ = null;
        break;
      case 'frame':
        $.statemem.frameTU = true;
        $.trans.setWait(99, 10, 99);
        break;
      case 'TU':
        if ($.frame.N === 135) $.ps.vy = 0;
        if ($.cpointKind() === 2 && $.catching && $.catching.cpointKind() === 1) {
          if ($.statemem.frameTU && $.caught) {
            $.statemem.frameTU = false;
            const { hold, cpoint, adir, vdir } = $.caught;
            if (cpoint.vaction) $.trans.frame(cpoint.vaction, 22);
            if (cpoint.throwvx) {
              const dvx = cpoint.throwvx, dvy = cpoint.throwvy;
              let dvz = cpoint.throwvz;
              if (dvx) $.ps.vx = adir * dvx;
              if (dvy) $.ps.vy = dvy;
              if (dvz === GC.unspecified) dvz = 0;
              if (dvz) $.ps.vz = dvz;
              $.ps.vz *= $.caughtThrowZ !== null && $.caughtThrowZ !== undefined ? $.caughtThrowZ : vdir;
              $.caughtThrowInjury = cpoint.throwinjury !== GC.unspecified && cpoint.throwinjury !== undefined ? cpoint.throwinjury : GC.throw_injury;
              $.setPos($.ps.x + $.ps.vx, $.ps.y + $.ps.vy * 2, $.ps.z + $.ps.vz);
            } else {
              if (cpoint.dircontrol === undefined) $.switchDir(cpoint.cover && cpoint.cover >= 10 ? adir : -adir);
              $.coincideXY(hold, $.point($.frame.D.cpoint));
            }
          }
        } else if ($.catching) {
          $.trans.frame(212, 10);
        }
        break;
    }
  },

  11(event) { // machucado
    const $ = this;
    if (event === 'state_entry') $.trans.incWait(0, 20);
    if (event === 'frame' && [221, 223, 225].includes($.frame.N)) $.trans.setNext(999);
  },

  12(event, K) { // caindo
    const $ = this;
    switch (event) {
      case 'frame':
        if ($.effect.dvy <= 0) {
          switch ($.frame.N) {
            case 180:
              $.trans.setNext(181);
              $.trans.setWait(lookupAbs(LOOKUP.fall_wait180, $.effect.dvy));
              break;
            case 181: {
              $.trans.setNext(182);
              if ($.ps.vy === 0) $.ps.vy = 5;
              const vy = Math.abs($.ps.vy);
              $.trans.setWait(vy <= 4 ? 2 : vy < 7 ? 3 : 4);
              break;
            }
            case 182: $.trans.setNext(183); break;
            case 186: if ($.ps.vy === 0) $.ps.vy = 5; $.trans.setNext(187); break;
            case 187: $.trans.setNext(188); break;
            case 188: $.trans.setNext(189); break;
          }
        } else if ($.frame.N === 180) {
          $.trans.setNext(185);
          $.trans.setWait(1);
        } else if ($.frame.N === 186) {
          $.trans.setNext(191);
        }
        break;
      case 'fell_onto_ground':
      case 'fall_onto_ground': {
        if ($.caughtThrowInjury > 0) {
          $.injury($.caughtThrowInjury);
          $.caughtThrowInjury = null;
        }
        Sound.play('1/016');
        const ps = $.ps, N = $.frame.N;
        if ($.speed() > GC.bounce_xy || ps.vy > GC.bounce_y_limit) {
          $.linearFriction(lookupAbs(LOOKUP.bounce_absorb, ps.vx), lookupAbs(LOOKUP.bounce_absorb, ps.vz));
          ps.vy = -GC.bounce_y;
          if ((N >= 203 && N <= 206) || (N >= 180 && N <= 185)) return 185;
          if (N >= 186 && N <= 191) return 191;
        } else {
          if ((N >= 203 && N <= 206) || (N >= 180 && N <= 185)) return 230;
          if (N >= 186 && N <= 191) return 231;
        }
        break;
      }
      case 'combo':
        if (($.frame.N === 182 || $.frame.N === 188) && K === 'jump') {
          if ($.health.fall < GC.fall_ko && $.health.hp > 0) {
            $.trans.frame($.frame.N === 182 ? 100 : 108);
            if ($.ps.vx) $.ps.vx = 5 * ($.ps.vx > 0 ? 1 : -1);
            if ($.ps.vy === 0) $.ps.vy = 5;
            if ($.ps.vz) $.ps.vz = 2 * ($.ps.vz > 0 ? 1 : -1);
          }
        }
        return 1;
    }
  },

  13(event) { // congelado
    if (event === 'state_exit') this.brokenEffect(212);
  },

  14(event) { // deitado
    const $ = this;
    switch (event) {
      case 'state_entry':
        $.health.fall = 0;
        $.health.bdefend = 0;
        if ($.health.hp <= 0) {
          $.die();
          if ($.removeOnDeath) $.counter.deadBlink = 0;
        }
        break;
      case 'state_exit':
        $.effect.timein = 0;
        $.effect.timeout = 30;
        $.effect.blink = true;
        $.effect.super = true;
        break;
    }
  },

  15(event, K) { // vários: parar de correr, agachar, arremessos...
    const $ = this;
    switch (event) {
      case 'frame':
        switch ($.frame.N) {
          case 19:
            if ($.hold && $.hold.type === 'heavyweapon') $.trans.setNext(12);
            break;
          case 215:
            $.trans.incWait(-1);
            break;
          case 219:
            if (!$.idUpdate('state15_crouch')) {
              if ($.frame.PN === 105) $.unitFriction();
              else if ([216, 90, 91, 92].includes($.frame.PN)) $.trans.incWait(-1);
            }
            break;
          case 54:
            if ($.frame.D.next === 999 && $.ps.y < 0) $.trans.setNext(212);
            break;
          case 257:
            $.idUpdate('state1280_disappear');
            break;
        }
        break;
      case 'combo':
        if ($.frame.N === 215) {
          if (K === 'def') { $.trans.frame(102, 10); return 1; }
          if (K === 'jump') {
            let dx = 0;
            if ($.con.state.left) dx -= 1;
            if ($.con.state.right) dx += 1;
            if (dx) { $.trans.frame(213, 10); $.switchDir(dx); }
            else if ($.ps.vx === 0) { $.trans.incWait(2, 10, 99); $.trans.setNext(210, 10); }
            else if (($.ps.vx > 0 ? 1 : -1) === $.dirh()) $.trans.frame(213, 10);
            else $.trans.frame(214, 10);
            return 1;
          }
        }
        break;
    }
  },

  16() {}, // tonto (pode ser agarrado)

  17(event) { // bebendo
    const $ = this;
    if (event === 'TU' && $.hold && $.hold.type === 'drink') {
      const w = $.hold, isMilk = w.id === 122;
      if ($.match.time % 2 === 0) {
        if (isMilk) { $.health.hp = Math.min($.health.hp_bound, $.health.hp + 2); $.health.mp = Math.min($.health.mp_full, $.health.mp + 1); }
        else $.health.mp = Math.min($.health.mp_full, $.health.mp + 4);
      }
      w.health.hp -= 4;
      if (w.health.hp <= 0) { $.dropWeapon(0, 0); $.trans.frame(999, 15); }
    }
  },

  18(event, K) { // pegando fogo
    if (event === 'frame') this.brokenEffect(302, 1);
    if (event === 'fall_onto_ground') this.brokenEffect(302);
    if (event === 'fall_onto_ground' || event === 'fell_onto_ground') return CHAR_STATES[12].call(this, event, K);
  },

  19(event) { // corrida em chamas do Firen
    if (event === 'TU') this.ps.vz = this.dirv() * this.data.bmp.running_speedz;
  },

  301(event) { // Deep
    const $ = this;
    switch (event) {
      case 'frame_force': if ($.frame.N !== 290) return 1; break;
      case 'TU': $.ps.vz = $.dirv() * $.data.bmp.walking_speedz; break;
      case 'hit_stop': $.effectStuck(1, 2); $.trans.incWait(1); return 1;
    }
  },

  400(event) { // teletransporte até o inimigo mais próximo
    const $ = this;
    if (event === 'frame') {
      const t = $.match.queryAll($, { notTeam: $.team, type: 'character', sort: 'distance' })[0];
      if (t) { $.ps.x = t.ps.x - 120 * $.dirh(); $.ps.y = 0; $.ps.z = t.ps.z; }
    }
  },

  401(event) { // teletransporte até o aliado mais distante
    const $ = this;
    if (event === 'frame') {
      const t = $.match.queryAll($, { team: $.team, type: 'character', sort: 'distance' }).pop();
      if (t) { $.ps.x = t.ps.x + 60 * $.dirh(); $.ps.y = 0; $.ps.z = t.ps.z; }
    }
  },

  501(event) { // Rudolf
    const $ = this;
    if (event === 'frame' && $.frame.N === 298 && $.trans.next() === 999) $.idUpdate('rudolf_transform');
  },

  1700(event) { // cura
    if (event === 'frame') this.effect.heal = GC.heal_max;
  },
};

// Ajustes específicos de alguns personagens (comportamentos fixos no LF2 original).
const CHAR_ID_UPDATES = {
  1(event, K, tag) { // Deep
    const $ = this;
    switch (event) {
      case 'state3_frame':
        if ($.frame.N === 267) { $.ps.vy += 1; return 1; }
        break;
      case 'state15_crouch':
        if ($.frame.PN >= 267 && $.frame.PN <= 272) $.trans.incWait(-1);
        break;
      case 'generic_combo':
        if (tag === 'hit_Fj') $.switchDir(K === 'D>J' || K === 'D>AJ' ? 1 : -1);
        break;
    }
  },
  5(event) { // Rudolf
    const $ = this;
    switch (event) {
      case 'state3_frame':
        if ($.frame.N >= 273 && $.frame.N <= 276) $.ps.vy = -6.8;
        break;
      case 'rudolf_transform': {
        const target = $.catching ? $.catching.id : $.transformInto;
        if (target && target !== 5) $.transformTo(target);
        break;
      }
      case 'state1280_disappear':
        if ($.frame.N === 257) {
          $.visible = false;
          $.effect.super = true;
          $.counter.disappear = 0;
        }
        break;
    }
  },
  6(event, K, tag) { // Louis: a transformação em Louis EX não existe nos dados 1.9
    if (event === 'generic_combo' && tag === 'hit_ja') return 1;
  },
  10(event) { // Woody
    if (event === 'state3_fly_crash') this.trans.setWait(0);
  },
  11(event) { // Davis
    const $ = this;
    if (event === 'state3_hit_stop') {
      switch ($.frame.N) {
        case 271: case 276: case 280: $.effectStuck(1, 2); $.trans.incWait(1); return 1;
        case 273: $.effectStuck(0, 2); return 1;
      }
    }
    if (event === 'state3_frame_force' && [275, 278, 279].includes($.frame.N)) return 1;
  },
};

class Character extends Living {
  constructor(match, id, team, con, opts = {}) {
    super(match, id, team);
    this.states = CHAR_STATES;
    this.switchTable = CHAR_SWITCH;
    this.floorBound = true;
    this.con = con;
    this.combo = { name: null, timeout: 0 };
    this.hold = null;
    const hp = Assets.prop(id, 'hp') || GC.hp_full;
    this.health = {
      hp, hp_full: hp, hp_bound: hp, hp_lost: 0,
      mp: GC.mp_start, mp_full: GC.mp_full, mp_usage: 0, fall: 0, bdefend: 0,
    };
    this.stat = { attack: 0, picking: 0, kill: 0 };
    this.counter = { disappear: -1, deadBlink: -1 };
    this.player = opts.player ?? -1;
    this.removeOnDeath = !!opts.removeOnDeath;
    this.parent = opts.parent || null;
    this.label = opts.label || this.name;
    if (con) {
      this.decoder = new ComboDecoder(con, (K) => {
        if ((K === 'left' || K === 'right') && this.allowSwitch) this.switchDir(K === 'left' ? -1 : 1);
        if (this.combo.timeout === GC.combo_timeout && COMBO_PRIORITY[K] < COMBO_PRIORITY[this.combo.name]) return;
        this.combo.name = K;
        this.combo.timeout = GC.combo_timeout;
      });
    }
    // trans.frame verifica se há MP suficiente para o quadro de destino
    const trans = this.trans;
    trans.frame = (F, au) => {
      if (F === 0 || F === 999) { trans.setNext(F, au); trans.setWait(0, au); return; }
      const nf = this.data.frame[Math.abs(F)];
      if (!nf) return;
      const dmp = nf.mp > 0 ? nf.mp % 1000 : 0;
      if (this.health.mp - dmp >= 0) { trans.setNext(F, au); trans.setWait(0, au); }
    };
    this.setup();
  }

  idUpdate(event, K, tag) {
    const f = CHAR_ID_UPDATES[this.id];
    return f ? f.call(this, event, K, tag) : undefined;
  }

  destroy() { if (this.decoder) this.decoder.detach(); }

  comboUpdate() {
    let K = this.combo.name || null;
    if (K === 'jump-att') K = 'jump';
    const S = this.states[this.frame.D.state];
    let r1, r2;
    if (S) r1 = S.call(this, 'combo', K);
    if (!r1) r2 = this.states.generic.call(this, 'combo', K);
    if (S) S.call(this, 'post_combo');
    this.states.generic.call(this, 'post_combo');
    if (this.combo.name === 'jump-att') {
      if (r1 || r2) this.combo.name = 'att';
    } else if (r1 || r2 || ['left', 'right', 'up', 'down'].includes(K)) {
      this.combo.name = null;
    }
  }

  blockedXZ() {
    const off = { x: this.ps.vx, y: 0, z: this.ps.vz };
    for (const b of this.volBody(off)) {
      b.zwidth = 0;
      if (this.match.query(b, this, { tag: 'itr:14' }).length) return true;
    }
    return false;
  }

  disappearTU() {
    const c = this.counter;
    if (c.disappear >= 0) {
      c.disappear++;
      if (c.disappear >= GC.disappear_shadow && c.disappear < GC.disappear_body) this.shadowVisible = Math.floor(c.disappear / 2) % 2 === 0;
      if (c.disappear === GC.disappear_body) {
        this.effect.blink = true; this.effect.timein = 0; this.effect.timeout = 30;
        this.shadowVisible = true; this.visible = true; this.effect.super = false;
      }
      if (c.disappear > GC.disappear_body) c.disappear = -1;
    }
    if (c.deadBlink >= 0) {
      if (c.deadBlink === 0) this.effect.blink = true;
      c.deadBlink++;
      if (c.deadBlink >= 30) {
        c.deadBlink = -1;
        this.visible = false;
        this.match.destroyObject(this);
      }
    }
  }

  // ---- dano ----

  // ITR: o itr (ou cpoint) que acertou; att: atacante; attps: posição do atacante; rect: área do golpe
  hit(ITR, att, attps, rect) {
    const $ = this;
    if (!$.vrestTest(att.uid)) return false;
    let accept = false, defended = false, efDvx = 0, efDvy = 0, inj = 0;
    const st = $.state();
    const front = (attps.x > $.ps.x) === ($.ps.dir === 1);

    const falldown = () => {
      if (ITR.dvy === undefined) efDvy = GC.fall_dvy;
      $.health.fall = 0;
      $.ps.vy = 0;
      if (front && ITR.dvx < 0 && ITR.bdefend >= 60) $.trans.frame(186, 21);
      else $.trans.frame(front ? 180 : 186, 21);
    };
    const fall = () => {
      $.health.fall += ITR.fall !== undefined ? ITR.fall : GC.fall_value;
      const f = $.health.fall;
      if ($.state() === 13 || $.ps.y < 0 || $.ps.vy < 0 || $.health.hp - inj <= 0) falldown();
      else if (f > 0 && f <= 20) $.trans.frame(220, 20);
      else if (f > 20 && f <= 30) $.trans.frame(222, 20);
      else if (f > 30 && f <= 40) $.trans.frame(224, 20);
      else if (f > 40 && f <= 60) $.trans.frame(226, 20);
      else if (f > GC.fall_ko) falldown();
    };

    if (st === 10) { // sendo agarrado
      const hurtable = $.catching ? $.catching.cpointHurtable() : 1;
      if (hurtable) { accept = true; fall(); }
      if (!(hurtable === 0 && $.catching !== att)) {
        accept = true;
        inj += Math.abs(ITR.injury || 0);
        if (ITR.injury > 0) {
          $.effectCreate(0, GC.effect_duration);
          const cp = $.frame.D.cpoint || {};
          const tar = ITR.vaction ? ITR.vaction : (front ? cp.fronthurtact : cp.backhurtact);
          if (tar) $.trans.frame(tar, 20);
        }
      }
    } else if (st === 14) {
      // deitado: não recebe golpes
    } else if (st === 19 && att.state && att.state() === 3000) {
      return false;
    } else if (ITR.kind === undefined || ITR.kind === 0 || ITR.kind === 4 || ITR.kind === 9) {
      accept = true;
      const compen = $.ps.y === 0 ? 1 : 0;
      const attdir = att.ps.vx === 0 ? att.dirh() : (att.ps.vx > 0 ? 1 : -1);
      efDvx = ITR.dvx ? attdir * (ITR.dvx - compen) : 0;
      efDvy = ITR.dvy ? ITR.dvy : 0;
      const effectnum = ITR.effect !== undefined ? ITR.effect : 0;
      if (st === 13 && effectnum === 30) return false;
      if ((st === 18 || st === 19) && (effectnum === 20 || effectnum === 21)) return false;
      if (st === 7 && front) {
        if (ITR.injury) inj += GC.defend_factor * ITR.injury;
        if (ITR.bdefend) $.health.bdefend += ITR.bdefend;
        $.trans.frame($.health.bdefend > GC.defend_break ? 112 : 111, 20);
        if (efDvx) efDvx += (efDvx > 0 ? -1 : 1) * lookupAbs(LOOKUP.defend_absorb, efDvx);
        efDvy = 0;
        if ($.health.hp - inj <= 0) falldown();
        else defended = true;
      } else {
        if ($.hold && $.hold.type === 'heavyweapon') $.dropWeapon(0, 0);
        if (ITR.injury) inj += ITR.injury;
        $.health.bdefend = 45;
        fall();
      }
      let vanish = GC.effect_duration - 1;
      if ($.trans.next() === 111) vanish = 3;
      if ($.trans.next() === 112) vanish = 4;
      $.effectCreate(effectnum, vanish, efDvx, efDvy);
      // efeitos especiais: sangue, fogo, gelo
      if (defended) {
        if (effectnum === 0 || effectnum === 1) Sound.play('1/002');
      } else {
        switch (effectnum) {
          case 0: case 1:
            if ($.trans.next() === 180 || $.trans.next() === 186) $.dropWeapon(efDvx, efDvy);
            if (rect) $.visualEffect(effectnum, rect, attps.x < $.ps.x, $.health.fall > 0 ? 0 : 1, true);
            break;
          case 2: case 21: case 22: case 23:
            $.dropWeapon(efDvx, efDvy);
          // continua
          case 20:
            $.trans.frame(203, 36);
            Sound.play('1/070');
            break;
          case 3: case 30:
            $.dropWeapon(efDvx, efDvy);
            if ($.state() !== 13) { $.trans.frame(200, 38); Sound.play('1/065'); }
            else { $.trans.frame(182, 21); Sound.play('1/066'); }
            break;
          case 4:
            $.dropWeapon(efDvx, efDvy);
            break;
        }
      }
    } else if (ITR.kind === 10 || ITR.kind === 11) {
      $.fluteForce();
      if (st === 12) { inj = ITR.injury * 2; accept = true; }
    } else if (ITR.kind === 15) {
      $.whirlwindForce(rect);
    } else if (ITR.kind === 16) {
      $.trans.frame(200, 38);
      inj = ITR.injury;
      accept = true;
    }

    if (accept) {
      $.itr.attacker = att;
      $.vrestUpdate(att.uid, ITR);
    }
    $.injury(inj);
    return accept ? inj : false;
  }

  injury(inj) {
    if (!inj) return;
    const h = this.health;
    h.hp -= inj;
    h.hp_lost += inj;
    h.hp_bound -= Math.ceil(inj / 3);
  }

  heal(amount) { this.effect.heal = amount; return true; }

  attacked(inj) {
    if (inj === true) return true;
    if (inj > 0) {
      (this.parent || this).stat.attack += inj;
      return true;
    }
    return false;
  }

  die() {
    const a = this.itr.attacker;
    if (a && a.killed) a.killed();
  }

  killed() { (this.parent || this).stat.kill++; }

  fluteForce() {
    const ps = this.ps;
    this.effect.super = true;
    ps.vx = 0; ps.vz = 0;
    if (ps.y > -140) ps.vy = ps.vy <= 0 ? -7.5 : -ps.vy / 2;
    else if (ps.y > -160) ps.vy -= this.mass / 2;
    else if (ps.y > -180) ps.vy += this.mass / 2;
    this.trans.frame(ps.vy > 0 ? 181 : 182, 20);
  }

  whirlwindForce(rect) {
    const ps = this.ps;
    ps.vy -= 2 / this.mass;
    const cx = rect.x + rect.vx + rect.w * 0.5;
    ps.vx -= (ps.x - cx > 0 ? 1 : -1) * 2 / this.mass;
    ps.vz -= (ps.z - rect.z > 0 ? 1 : -1) * 0.5 / this.mass;
  }

  // ---- interações ----

  // antes da transição: agarrar e pegar armas (usa o itr do próximo quadro)
  preInteraction() {
    const $ = this;
    for (const ITR of makeArray($.trans.nextFrameData() && $.trans.nextFrameData().itr)) {
      if (![1, 2, 3, 7].includes(ITR.kind)) continue;
      const vol = $.volume(ITR);
      vol.zwidth = 0;
      const hits = $.match.query(vol, $, { tag: 'body' });
      if (ITR.kind === 1 || ITR.kind === 3) {
        for (const T of hits) {
          if (T.team === $.team || T.type !== 'character') continue;
          if (!((ITR.kind === 1 && T.state() === 16) || ITR.kind === 3) || $.itr.arest) continue;
          const dir = T.caughtA(ITR, $, { x: $.ps.x, y: $.ps.y, z: $.ps.z });
          if (dir) {
            $.arestUpdate(ITR);
            $.trans.frame(ITR.catchingact[dir === 'front' ? 0 : 1], 10);
            $.catching = T;
            break;
          }
        }
      } else if (!$.hold && (ITR.kind === 2 || (ITR.kind === 7 && $.con.state.att))) {
        for (const T of hits) {
          if (ITR.kind === 7 && T.type === 'heavyweapon') continue;
          if (!['lightweapon', 'heavyweapon', 'drink'].includes(T.type)) continue;
          if (T.pick($)) {
            $.stat.picking++;
            $.arestUpdate(ITR);
            if (ITR.kind === 2) $.trans.frame(T.type === 'heavyweapon' ? 116 : 115, 10);
            $.hold = T;
            break;
          }
        }
      }
    }
  }

  // depois da transição: golpes do quadro atual
  postInteraction() {
    const $ = this;
    for (const ITR of makeArray($.frame.D.itr)) {
      if (ITR.kind !== 0 && ITR.kind !== 4) continue;
      const vol = $.volume(ITR);
      vol.zwidth = 0;
      for (const T of $.match.query(vol, $, { tag: 'body' })) {
        let can = true;
        const ef = ITR.effect;
        if (ITR.kind === 0 && T.type === 'character' && T.team === $.team) can = false;
        if (ef === 4 && !(T.type !== 'character' && T.state() === 3000)) can = false;
        if ((ef === 20 || ef === 21 || ef === 22) && T.type !== 'character') can = false;
        if ((ef === 21 || ef === 22) && $.state() === 18 && T.team === $.team) can = false;
        if (ITR.kind === 4) {
          const a = $.itr.attacker;
          if (!a || a.uid === T.uid || (a.parent && a.parent.uid === T.uid) || (a.holder && a.holder.uid === T.uid)) can = false;
        }
        if (!can || $.itr.arest) continue;
        if ($.attacked(T.hit(ITR, $, { x: $.ps.x, y: $.ps.y, z: $.ps.z }, vol))) {
          $.arestUpdate(ITR);
          if (!$.stateUpdate('hit_stop')) {
            if ([86, 87, 91].includes($.frame.N)) { $.effectStuck(0, 2); $.trans.incWait(1); }
            else $.effectStuck(0, GC.hit_stop);
          }
          if (ITR.arest) break;
        }
      }
    }
  }

  // arma na mão segue o wpoint do quadro
  wpoint() {
    const $ = this;
    if (!$.hold) return;
    const wp = $.frame.D.wpoint;
    if (!wp) return;
    if (wp.kind === 1) {
      const act = $.hold.act($, wp, $.point(wp));
      if (act.thrown) $.hold = null;
      if (act.hit !== undefined) {
        $.arestUpdate(act);
        $.trans.incWait(GC.hit_stop, 10);
      }
    } else if (wp.kind === 3) {
      $.dropWeapon();
    }
  }

  opoint() {
    const $ = this;
    const ops = makeArray($.frame.D.opoint);
    for (const op of ops) {
      if (op.oid === 5) { // clones (Rudolf)
        const n = Math.floor(Math.abs(op.facing) / 10);
        for (let i = 0; i < n; i++) $.match.spawnClone($, i);
        continue;
      }
      if (Math.abs(op.facing) > 10) $.match.createMultiple(op, $, Math.floor(op.facing / 10), op.dvz || 3);
      else $.match.createObject(op, $);
    }
  }

  dropWeapon(dvx, dvy) {
    if (this.hold) {
      this.hold.drop(dvx, dvy);
      this.hold = null;
    }
  }

  // ---- protocolo de agarrão ----

  caughtA(ITR, att, attps) {
    const $ = this;
    if (!((ITR.kind === 1 && $.state() === 16) || ITR.kind === 3)) return null;
    const front = (attps.x > $.ps.x) === ($.ps.dir === 1);
    $.trans.frame(ITR.caughtact[front ? 0 : 1], 22);
    $.health.fall = 0;
    $.catching = att;
    $.itr.attacker = att;
    $.dropWeapon();
    return front ? 'front' : 'back';
  }

  caughtB(hold, cpoint, adir, vdir) {
    this.caught = { hold, cpoint, adir, vdir };
  }

  cpointKind() { return this.frame.D.cpoint ? this.frame.D.cpoint.kind : 0; }

  cpointHurtable() {
    const cp = this.frame.D.cpoint;
    return cp && cp.hurtable !== undefined ? cp.hurtable : 0;
  }

  caughtThrow(cpoint, vdir) {
    this.trans.frame(cpoint.vaction !== undefined ? cpoint.vaction : GC.cpoint_vaction, 22);
    this.caughtThrowZ = vdir;
  }

  caughtRelease() {
    this.catching = null;
    this.trans.frame(181, 22);
    this.effect.dvx = 3;
    this.effect.dvy = -3;
    this.effect.timein = -1;
    this.effect.timeout = 0;
  }

  // ---- transformação do Rudolf ----

  transformTo(id) {
    if (!Assets.obj(id) || Assets.obj(id).type !== 'character') return;
    if (!this.transformed) this.originalId = this.id;
    this.transformed = id !== this.originalId;
    this.transformInto = id;
    this.swapData(id);
    this.match.createObject({ kind: 1, x: 41, y: 70, action: 70, dvx: 0, dvy: 0, oid: 204, facing: 0 }, this);
  }

  revertTransform() {
    if (!this.transformed) return;
    this.transformed = false;
    this.swapData(this.originalId);
    this.match.createObject({ kind: 1, x: 41, y: 70, action: 70, dvx: 0, dvy: 0, oid: 204, facing: 0 }, this);
  }

  swapData(id) {
    this.id = id;
    this.data = Assets.obj(id).data;
    this.name = this.data.bmp.name;
    this.sheet = this.match.sheet(id);
    this.spw = this.sheet.w;
    this.frame.N = 0;
    this.frame.D = this.data.frame[0];
    this.trans.frame(999, 99);
    this.updateScreenPos();
  }
}
