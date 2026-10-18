'use strict';
// Jogador controlado pelo computador. Aperta teclas num controle virtual, igual a
// um humano, então usa as mesmas regras de combos e golpes especiais dos dados.

const AI_LEVELS = [
  { name: 'Fácil', act: 0.35, special: 0.08, defend: 0.05, dodge: 0.1, roll: 0.1, combo: 0.4 },
  { name: 'Normal', act: 0.6, special: 0.16, defend: 0.18, dodge: 0.3, roll: 0.35, combo: 0.7 },
  { name: 'Difícil', act: 0.85, special: 0.26, defend: 0.32, dodge: 0.55, roll: 0.7, combo: 0.9 },
  { name: 'Maluco!', act: 1, special: 0.38, defend: 0.5, dodge: 0.8, roll: 0.95, combo: 1 },
];

const SPECIAL_KEYS = [
  ['hit_Fa', ['def', 'F', 'att']], ['hit_Ua', ['def', 'up', 'att']], ['hit_Da', ['def', 'down', 'att']],
  ['hit_Fj', ['def', 'F', 'jump']], ['hit_Uj', ['def', 'up', 'jump']], ['hit_Dj', ['def', 'down', 'jump']],
  ['hit_ja', ['def', 'jump', 'att']],
];

// Classifica um golpe especial seguindo a cadeia de quadros a partir do quadro inicial.
function classifySpecial(data, start) {
  let n = start, ranged = false, melee = false, teleport = false, heal = false, cost = 0, reach = 0;
  const seen = new Set();
  for (let k = 0; k < 24 && data.frame[n] && !seen.has(n); k++) {
    seen.add(n);
    const D = data.frame[n];
    if (k === 0 && D.mp > 0) cost = D.mp % 1000;
    if (D.opoint) ranged = true;
    if (D.state === 400) teleport = true;
    if (D.state === 1700) heal = true;
    for (const I of makeArray(D.itr)) {
      if (I.kind === 0) { melee = true; reach = Math.max(reach, I.x + I.w - D.centerx); }
      if (I.kind === 8) heal = true;
    }
    if (D.next === 999 || D.next === 0 || D.next === 1000) break;
    n = Math.abs(D.next);
  }
  return { ranged, melee, teleport, heal, cost, reach: Math.max(reach, 40) };
}

class AI {
  constructor(ch, match, level) {
    this.ch = ch;
    this.match = match;
    this.L = AI_LEVELS[Math.max(0, Math.min(3, level))];
    this.target = null;
    this.retarget = 0;
    this.defendT = 0;
    this.specials = {};
    for (const [tag] of SPECIAL_KEYS) {
      const start = ch.data.frame[0] && ch.data.frame[0][tag];
      if (start) this.specials[tag] = classifySpecial(ch.data, start);
    }
    this.zBias = (match.random() - 0.5) * 16;
  }

  r() { return this.match.random(); }

  hold(K, on) { this.ch.con.hold(K, on); }
  press(K) { this.ch.con.press(K); }

  releaseMoves() { for (const k of ['up', 'down', 'left', 'right']) this.hold(k, false); }

  // direção F (frente) vira esquerda ou direita conforme o alvo
  pressSeq(seq, dir) {
    this.releaseMoves();
    for (const k of seq) this.press(k === 'F' ? (dir > 0 ? 'right' : 'left') : k);
  }

  pickTarget() {
    const ch = this.ch;
    let best = null, bd = Infinity;
    for (const o of this.match.live) {
      if (o.type !== 'character' || o.team === ch.team || o.health.hp <= 0 || !o.visible) continue;
      const d = Math.abs(o.ps.x - ch.ps.x) + 2 * Math.abs(o.ps.z - ch.ps.z) + (o.state() === 14 ? 250 : 0);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  think() {
    const ch = this.ch, m = this.match, L = this.L;
    if (ch.health.hp <= 0 || m.summary) { this.releaseMoves(); this.hold('def', false); return; }
    const st = ch.state();

    // recuperar no ar com rolamento
    if ((ch.frame.N === 182 || ch.frame.N === 188) && this.r() < L.roll) { this.press('jump'); return; }
    if (this.defendT > 0) { this.defendT -= 3; this.hold('def', this.defendT > 0); return; }

    if (--this.retarget <= 0 || !this.target || this.target.health.hp <= 0 || this.target.uid < 0) {
      this.target = this.pickTarget();
      this.retarget = 20;
    }
    const tg = this.target;
    if (!tg) { this.releaseMoves(); return; }
    const dx = tg.ps.x - ch.ps.x, dz = tg.ps.z - ch.ps.z, adx = Math.abs(dx), adz = Math.abs(dz);
    const dir = dx >= 0 ? 1 : -1;
    const free = st === 0 || st === 1 || st === 2;

    // agarrando: soca ou arremessa
    if (st === 9) {
      if (this.r() < 0.6) this.press('att');
      else if (this.r() < 0.3) { this.hold(dir > 0 ? 'right' : 'left', true); this.press('att'); }
      return;
    }
    if (st === 3 || st === 15) {
      if (this.r() < L.combo) this.press('att');
      return;
    }
    if (!free && st !== 4 && st !== 5 && st !== 7) return;

    // desviar de bolas de energia vindo na minha direção
    for (const o of m.live) {
      if (o.type !== 'specialattack' || o.team === ch.team) continue;
      const ox = o.ps.x - ch.ps.x;
      if (Math.abs(o.ps.z - ch.ps.z) < 20 && Math.abs(ox) < 160 && Math.sign(o.ps.vx) === -Math.sign(ox) && free) {
        if (this.r() < L.dodge) {
          if (this.r() < 0.5) this.press('jump');
          else { ch.switchDir(Math.sign(ox) || 1); this.defendT = 9; this.press('def'); this.hold('def', true); }
          return;
        }
      }
    }

    if (st === 4) { // no ar: chute
      if (adx < 90 && adz < 18 && this.r() < L.act) this.press('att');
      return;
    }
    if (st === 5) {
      if (adx < 120 && adz < 18 && this.r() < L.act) this.press('att');
      return;
    }
    if (st === 7) return;

    // golpes especiais
    if (free && this.r() < L.special && tg.state() !== 14) {
      const opts = [];
      for (const [tag, seq] of SPECIAL_KEYS) {
        const sp = this.specials[tag];
        if (!sp || ch.health.mp < sp.cost + 20) continue;
        if (sp.heal) { if (ch.health.hp < ch.health.hp_full * 0.5) opts.push(seq); continue; }
        if (sp.teleport) { if (adx > 250) opts.push(seq); continue; }
        if (sp.ranged && adz < 22 && adx > 90 && adx < 560) opts.push(seq);
        else if (sp.melee && !sp.ranged && adz < 16 && adx < sp.reach + 50) opts.push(seq);
      }
      if (opts.length) {
        ch.switchDir(dir);
        this.pressSeq(opts[Math.floor(this.r() * opts.length)], dir);
        return;
      }
    }

    // defender quando o alvo ataca de perto
    if (tg.state() === 3 && adx < 110 && adz < 20 && this.r() < L.defend) {
      ch.switchDir(dir);
      this.releaseMoves();
      this.defendT = 12;
      this.press('def');
      this.hold('def', true);
      return;
    }

    // pegar arma por perto
    if (!ch.hold && this.r() < 0.4) {
      const w = m.live.find((o) => (o.type === 'lightweapon' || o.type === 'heavyweapon') && !o.holder &&
        o.ps.y === 0 && Math.abs(o.ps.x - ch.ps.x) < 160 && Math.abs(o.ps.z - ch.ps.z) < 60);
      if (w && adx > 120) {
        const wx = w.ps.x - ch.ps.x, wz = w.ps.z - ch.ps.z;
        if (Math.abs(wx) < 25 && Math.abs(wz) < 8) { this.releaseMoves(); this.press('att'); return; }
        this.move(wx, wz, 6);
        return;
      }
    }
    // arremessar arma pesada
    if (ch.hold && ch.hold.type === 'heavyweapon' && adz < 18 && adx < 400) {
      ch.switchDir(dir);
      this.press('att');
      return;
    }

    const reach = 55;
    if (adx < reach && adz < 12) {
      this.releaseMoves();
      if (ch.dirh() !== dir) { this.hold(dir > 0 ? 'right' : 'left', true); return; }
      if (this.r() < L.act) this.press('att');
      return;
    }
    // pulo ou corrida com ataque
    if (st === 2) {
      if (adz < 16 && adx < 130 && this.r() < L.act) { this.press('att'); return; }
      if (adx < 170 && this.r() < 0.3) { this.press('jump'); return; }
      if (Math.sign(dx) !== ch.dirh()) { this.press(dir > 0 ? 'right' : 'left'); return; }
      this.hold('up', dz < -6); this.hold('down', dz > 6);
      return;
    }
    if (adx > 260 && adz < 60 && this.r() < 0.5) {
      this.releaseMoves();
      ch.switchDir(dir);
      const k = dir > 0 ? 'right' : 'left';
      this.press(k); this.press(k);
      return;
    }
    if (adx > 80 && adx < 150 && adz < 14 && this.r() < 0.12 * L.act) {
      this.hold(dir > 0 ? 'right' : 'left', true);
      this.press('jump');
      return;
    }
    this.move(dx - dir * (reach - 15), dz + (adx > 120 ? this.zBias : 0), 8);
  }

  move(dx, dz, tol) {
    this.hold('left', dx < -tol);
    this.hold('right', dx > tol);
    this.hold('up', dz < -4);
    this.hold('down', dz > 4);
  }
}
