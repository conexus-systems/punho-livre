'use strict';
// Inteligência artificial: produz a mesma estrutura de entrada que um jogador humano.

const AI_LEVELS = [
  { name: 'Fácil', react: 22, aggr: 0.4, block: 0.05, special: 0.12, combo: 0.45, dodge: 0.08 },
  { name: 'Normal', react: 12, aggr: 0.65, block: 0.2, special: 0.22, combo: 0.8, dodge: 0.3 },
  { name: 'Difícil', react: 6, aggr: 0.9, block: 0.38, special: 0.32, combo: 1, dodge: 0.55 },
];

class AIBrain {
  constructor(f, level) {
    this.f = f;
    this.level = clamp(level, 0, AI_LEVELS.length - 1);
    this.L = AI_LEVELS[this.level];
    this.think = randi(10, 30);
    this.target = null;
    this.retarget = 0;
    this.defendT = 0;
    this.airAttackT = 0;
    this.seen = new WeakSet();
    this.zBias = rand(-8, 8);
  }

  update(w) {
    const f = this.f, inp = f.input, L = this.L;
    inp.ai = true;
    for (const a of ACTIONS) inp.pressed[a] = false;
    if (f.dead || w.over) { clearInput(inp); return; }

    const canAct = f.state === 'idle' || f.state === 'walk' || f.state === 'run';

    // ataque aéreo agendado depois de um pulo
    if (this.airAttackT > 0 && --this.airAttackT === 0 && f.state === 'air') inp.pressed.attack = true;

    // desviar de projéteis que vêm na direção da CPU
    for (const p of w.projectiles) {
      if (p.dead || p.team === f.team || this.seen.has(p) || p.d.ground) continue;
      const dx = p.x - f.x;
      if (Math.abs(p.z - f.z) < 22 && Math.abs(dx) < 170 && sign(p.vx) === -sign(dx)) {
        this.seen.add(p);
        if (canAct && Math.random() < L.dodge) {
          if (Math.random() < 0.5) {
            inp.pressed.jump = true;
          } else {
            f.facing = sign(dx);
            this.defendT = 20;
          }
          return;
        }
      }
    }

    if (this.defendT > 0) {
      this.defendT--;
      inp.held.defend = true;
      inp.held.left = inp.held.right = inp.held.up = inp.held.down = false;
      inp.run = false;
      return;
    }
    inp.held.defend = false;

    if (--this.think > 0) return;
    this.think = L.react + randi(0, 5);
    this.decide(w, canAct);
  }

  goTo(x, z, tol = 6) {
    const f = this.f, h = f.input.held;
    const dx = x - f.x, dz = z - f.z;
    if (Math.abs(dx) > tol) h[dx > 0 ? 'right' : 'left'] = true;
    if (Math.abs(dz) > 5) h[dz > 0 ? 'down' : 'up'] = true;
    if (Math.abs(dx) > 260 && Math.random() < 0.7) f.input.run = true;
    else if (Math.abs(dx) < 120) f.input.run = false;
  }

  decide(w, canAct) {
    const f = this.f, inp = f.input, h = inp.held, p = inp.pressed, L = this.L;
    h.left = h.right = h.up = h.down = false;
    if (f.state !== 'run') inp.run = false;

    if (f.state === 'move') {
      if (f.move.next && Math.random() < L.combo) p.attack = true;
      return;
    }
    if (!canAct && f.state !== 'defend') return;

    if (--this.retarget <= 0 || !this.target || this.target.dead || this.target.gone) {
      this.target = w.nearestEnemy(f, true);
      this.retarget = 60;
    }
    const tg = this.target;
    if (!tg) {
      this.goTo((w.bounds.min + w.bounds.max) / 2, DEPTH / 2, 60);
      return;
    }

    // itens: garrafa quando ferido, bastão quando desarmado
    const wantHeal = f.hp < f.maxHp * 0.55;
    const item = w.items.find((i) => {
      if (i.dead || i.holder || i.thrown || i.y > 4 || Math.abs(i.x - f.x) > 320) return false;
      const d = ITEM_DEFS[i.kind];
      if (d.heal) return (d.heal.hp && wantHeal) || (d.heal.mp && f.mp < 40);
      return !f.holding && this.level > 0;
    });
    if (item && Math.random() < 0.8) {
      if (Math.abs(item.x - f.x) < 22 && Math.abs(item.z - f.z) < 12 && canAct) p.attack = true;
      else this.goTo(item.x, item.z, 10);
      return;
    }

    const dx = tg.x - f.x, dz = tg.z - f.z, adx = Math.abs(dx), adz = Math.abs(dz);
    const tgDown = tg.state === 'lying' || tg.state === 'getup' || tg.invisible > 0;

    // golpes especiais
    if (canAct && !tgDown && Math.random() < L.special) {
      const opts = Object.entries(f.def.specials).filter(([, m]) => m.ai && m.cost <= f.mp &&
        adx >= m.ai.min && adx <= m.ai.max && adz <= m.ai.z &&
        (!m.ai.escape || f.hp < f.maxHp * 0.45));
      if (opts.length) {
        const [key, m] = choice(opts);
        f.facing = m.ai.escape ? -sign(dx) : sign(dx);
        f.forceSpecial = key;
        return;
      }
    }

    // inimigo caído: reposiciona e espera ele levantar
    if (tgDown) {
      const away = adx < 90 ? f.x - sign(dx) * 40 : f.x;
      this.goTo(away, tg.z + this.zBias, 10);
      return;
    }

    // defender quando o alvo ataca de perto
    if (tg.state === 'move' && adx < 95 && adz < 20 && Math.random() < L.block) {
      f.facing = sign(dx);
      this.defendT = 14;
      h.defend = true;
      return;
    }

    const weapon = f.holding && ITEM_DEFS[f.holding.kind].weapon;
    const reach = 42 * f.size + (weapon ? 20 : 0);

    // segurando pedra: arremessa quando alinhado
    if (f.holding && !weapon && adz < 14 && adx < 420) {
      f.facing = sign(dx);
      p.attack = true;
      return;
    }

    if (adx < reach && adz < 12) {
      if (sign(dx) !== f.facing) { h[dx > 0 ? 'right' : 'left'] = true; return; }
      if (Math.random() < L.aggr) p.attack = true;
      else if (Math.random() < 0.3) h[dx > 0 ? 'left' : 'right'] = true;
      return;
    }

    // voadora ou pulo com chute de média distância
    if (adz < 12 && adx > 70 && adx < 150 && canAct && Math.random() < 0.1 * L.aggr) {
      f.facing = sign(dx);
      h[dx > 0 ? 'right' : 'left'] = true;
      p.jump = true;
      this.airAttackT = 9;
      return;
    }
    if (f.state === 'run' && adz < 14 && adx < 120 && Math.random() < 0.5) {
      p.attack = true;
      return;
    }

    this.goTo(tg.x - sign(dx) * reach * 0.8, tg.z + (adx > 120 ? this.zBias : 0));
  }
}
