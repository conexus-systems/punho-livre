'use strict';
// Itens do cenário: armas para pegar e arremessar e garrafas que recuperam vida/energia.

const ITEM_DEFS = {
  bat: { name: 'Bastão', weapon: true, dur: 10, throwHit: { dmg: 45, kvx: 6, kvy: 6, knockdown: true, heavy: true } },
  stone: { name: 'Pedra', dur: 99, throwHit: { dmg: 55, kvx: 6, kvy: 7, knockdown: true, heavy: true } },
  milk: { name: 'Leite', heal: { hp: 120 }, label: '+VIDA', color: '#ff8a8a' },
  juice: { name: 'Suco', heal: { mp: 60 }, label: '+MP', color: '#7fc4ff' },
};

class Item {
  constructor(kind, x, z, y = 0) {
    this.kind = kind; this.x = x; this.y = y; this.z = z;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.holder = null; this.thrower = null; this.thrown = false; this.team = null;
    this.hitSet = new Set(); this.dur = ITEM_DEFS[kind].dur || 1;
    this.dead = false; this.spin = 0; this.age = 0;
  }

  update(w) {
    this.age++;
    if (this.holder) {
      const h = this.holder;
      this.x = h.x + h.facing * 16; this.y = h.y + 40; this.z = h.z;
      return;
    }
    if (this.y > 0 || this.vy > 0) {
      this.x += this.vx; this.y += this.vy; this.z = clamp(this.z + this.vz, 0, DEPTH);
      this.vy -= 0.45;
      if (this.thrown) this.spin += 0.45 * sign(this.vx);
      if (this.y <= 0) {
        this.y = 0;
        if (this.vy < -4) { this.vy = -this.vy * 0.3; this.vx *= 0.5; this.y = 0.1; Sound.play('land'); }
        else { this.vy = 0; this.vx = 0; this.thrown = false; this.spin = 0; }
      }
    }
    if (this.x < w.bounds.min - 10 || this.x > w.bounds.max + 10) {
      this.x = clamp(this.x, w.bounds.min, w.bounds.max);
      this.vx = -this.vx * 0.4;
    }
  }

  shatter(w) {
    this.dead = true;
    if (this.holder) this.holder.holding = null;
    w.fx(this.kind === 'stone' ? 'rocks' : 'debris', this.x, this.y + 20, this.z);
    w.fx('debris', this.x, this.y + 20, this.z);
    Sound.play('break');
  }

  draw(ctx, cam) {
    if (this.holder || this.dead) return;
    const sx = this.x - cam.x, sy = FLOOR_Y + this.z - this.y;
    ctx.save();
    ctx.translate(sx, sy - 5);
    ctx.rotate(this.spin);
    ctx.lineCap = 'round';
    const ol = '#15131f';
    switch (this.kind) {
      case 'bat':
        seg(ctx, [-17, 0, 17, -2], 9, ol);
        seg(ctx, [-16, 0, -2, -1], 4.5, '#7a4b22');
        seg(ctx, [-3, -1, 16, -2], 7, '#b07a3e');
        break;
      case 'stone':
        ctx.fillStyle = '#8d8a85'; ctx.strokeStyle = ol; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 7; i++) {
          const a = i * Math.PI * 2 / 7, rr = 9 * (0.8 + hash(i) * 0.35);
          ctx.lineTo(Math.cos(a) * rr * 1.2, Math.sin(a) * rr - 2);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      case 'milk':
      case 'juice': {
        const body = this.kind === 'milk' ? '#f7f7f2' : '#ffa53a';
        const label = this.kind === 'milk' ? '#3d7bd9' : '#2f9e44';
        ctx.fillStyle = body; ctx.strokeStyle = ol; ctx.lineWidth = 2;
        rrect(ctx, -6, -18, 12, 18, 3); ctx.fill(); ctx.stroke();
        ctx.fillRect(-3, -24, 6, 7); ctx.strokeRect(-3, -24, 6, 7);
        ctx.fillStyle = label; ctx.fillRect(-5, -12, 10, 6);
        if (this.age % 60 < 30) {
          ctx.globalAlpha = 0.5;
          dot(ctx, 3, -15, 2, '#ffffff');
        }
        break;
      }
    }
    ctx.restore();
  }
}
