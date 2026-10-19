'use strict';
// Efeitos visuais de curta duração: faíscas de golpe, sangue, fogo e pedaços
// de objetos quebrados. Não interagem com nada.

class VisualEffect {
  constructor(match, id, pos, frameN, withSound, broken) {
    const obj = Assets.obj(id);
    this.match = match;
    this.dat = obj.data;
    this.sheet = match.sheet(id);
    this.ps = { x: pos.x, y: pos.y, z: pos.z, vx: 0, vy: 0 };
    this.withSound = withSound;
    this.mass = 0;
    this.dead = false;
    this.N = frameN;
    this.D = this.dat.frame[frameN];
    this.wait = -1;
    this.fresh = true;
    if (broken) {
      // pedaços voam com gravidade, menos o fogo
      this.mass = broken.mass;
      const R = broken.rect || { w: 50, h: 50 };
      this.ps.x += match.random() * R.w * 1.2 - this.sheet.w;
      this.ps.y -= match.random() * R.h;
      this.ps.vx = (match.random() - 0.5) * R.w * 0.5;
      this.ps.vy = match.random() * 2 - 4;
    }
  }

  TU() {
    const ps = this.ps;
    ps.x += ps.vx;
    ps.y += ps.vy;
    if (ps.y < 0) ps.vy += this.mass * GC.gravity;
    if (ps.y > 0) { this.dead = true; return; }
    if (this.fresh) {
      this.fresh = false;
      this.wait = this.D.wait;
      this.next = this.D.next;
      if (this.withSound && this.D.sound) Sound.play(this.D.sound);
    }
    if (this.wait === 0 || this.D.state === 9998) {
      if (this.next === 999) this.next = 0;
      else if (this.next === 1000 || this.D.state === 9998) { this.dead = true; return; }
      this.N = this.next;
      this.D = this.dat.frame[this.N];
      if (!this.D) { this.dead = true; return; }
      this.fresh = true;
    } else {
      this.wait--;
    }
  }

  get z() { return this.ps.z + 1; }

  draw(ctx, camX) {
    if (this.dead || !this.D) return;
    this.sheet.draw(ctx, this.D.pic, this.ps.x - this.D.centerx - camX, this.ps.y - this.D.centery + this.ps.z, false);
  }
}

// poeira e fagulhas simples (só visual, não afetam a partida)
class Puff {
  constructor(x, y, z, vx, vy, size, color, life) {
    this.ps = { x, y, z };
    this.vx = vx; this.vy = vy;
    this.size = size; this.color = color;
    this.life = this.max = life;
    this.dead = false;
  }
  TU() {
    this.ps.x += this.vx; this.ps.y += this.vy;
    this.vx *= 0.92; this.vy *= 0.92;
    if (--this.life <= 0) this.dead = true;
  }
  get z() { return this.ps.z + 2; }
  draw(ctx, camX) {
    const t = this.life / this.max;
    ctx.globalAlpha = Math.min(0.7, t);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.ps.x - camX, this.ps.y + this.ps.z, this.size * (1.6 - t * 0.7), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
