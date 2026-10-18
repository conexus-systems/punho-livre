'use strict';
// Projéteis (energia, fogo, gelo, raios...) e partículas de efeito visual.

const PROJ = {
  ki: { r: 13, speed: 9, life: 100, y: 52, solid: true, sfx: 'ki',
    hit: { dmg: 40, kvx: 5, kvy: 6, knockdown: true, heavy: true } },
  fire: { r: 14, speed: 8, life: 100, y: 52, solid: true, sfx: 'fire',
    hit: { dmg: 38, kvx: 5, kvy: 6, knockdown: true, effect: 'fire', heavy: true } },
  ice: { r: 13, speed: 8.5, life: 100, y: 52, solid: true, sfx: 'ice',
    hit: { dmg: 28, effect: 'ice', freeze: 110, kvx: 2 } },
  bolt: { r: 10, speed: 16, life: 50, y: 55, solid: true, pierce: true, sfx: 'zap',
    hit: { dmg: 26, effect: 'shock', stun: 40, kvx: 2, fall: 30 } },
  shuriken: { r: 7, speed: 12, life: 70, y: 55, solid: true, sfx: 'throw',
    hit: { dmg: 16, stun: 14, kvx: 2, fall: 34 } },
  rock: { r: 14, speed: 8, life: 140, y: 70, vy: 6, gravity: 0.32, solid: true, sfx: 'throw',
    hit: { dmg: 50, kvx: 6, kvy: 7, knockdown: true, heavy: true } },
  wave: { r: 22, speed: 7, life: 55, ground: true, h: 34, pierce: true,
    hit: { dmg: 45, kvx: 3, kvy: 9, knockdown: true, onlyGround: true, heavy: true } },
  pillar: { r: 20, speed: 0, life: 34, ground: true, h: 95, active: [4, 16], pierce: true, sfx: 'ice',
    hit: { dmg: 34, effect: 'ice', freeze: 120, unblockable: true } },
  lightning: { r: 22, speed: 0, life: 44, ground: true, h: 400, delay: 18, active: [0, 10], pierce: true,
    hit: { dmg: 60, kvx: 2, kvy: 8, knockdown: true, effect: 'shock', unblockable: true, heavy: true } },
};

class Projectile {
  constructor(w, owner, kind, o = {}) {
    const d = PROJ[kind];
    this.w = w; this.owner = owner; this.team = owner.team; this.kind = kind; this.d = d;
    const dir = o.dir ?? owner.facing;
    this.dir = dir;
    this.x = o.x ?? owner.x + dir * (o.dx ?? 28 * owner.size);
    this.y = o.y ?? (d.ground ? 0 : owner.y + d.y * owner.size);
    this.z = o.z ?? owner.z;
    this.vx = o.vx ?? dir * d.speed;
    this.vy = o.vy ?? (d.vy || 0);
    this.vz = o.vz ?? 0;
    this.r = d.r;
    this.life = d.life;
    this.t = 0;
    this.delay = o.delay ?? d.delay ?? 0;
    this.hit = Object.assign({}, d.hit, o.hit);
    this.hitSet = new Set();
    this.dead = false;
    this.spin = 0;
    if (d.sfx && !this.delay) Sound.play(d.sfx);
  }

  active() {
    if (this.delay > 0) return false;
    const a = this.d.active;
    return !a || (this.t >= a[0] && this.t <= a[1]);
  }

  box() {
    if (this.d.ground) return [this.y, this.y + this.d.h];
    return [this.y - this.r, this.y + this.r];
  }

  update() {
    const w = this.w;
    if (this.delay > 0) {
      this.delay--;
      if (this.delay === 0 && this.kind === 'lightning') {
        Sound.play('thunder');
        w.shake = Math.max(w.shake, 9);
        w.flash = 6;
      }
      return;
    }
    this.t++;
    this.x += this.vx;
    this.y += this.vy;
    this.z = clamp(this.z + this.vz, -10, DEPTH + 10);
    this.spin += 0.45;
    if (this.d.gravity) {
      this.vy -= this.d.gravity;
      if (this.y <= 0) { this.y = 0; this.explode(); return; }
    }
    if (this.t >= this.life) {
      this.dead = true;
      if (this.d.solid) w.fx('poof', this.x, this.y, this.z);
    }
    if (this.x < -200 || this.x > w.stageW + 200) this.dead = true;
    switch (this.kind) {
      case 'ki': if (this.t % 2 === 0) w.fx('glow', this.x - this.vx, this.y + rand(-4, 4), this.z, { color: '#7fd8ff' }); break;
      case 'fire': w.fx('flame', this.x - this.vx * 0.5, this.y + rand(-6, 6), this.z, { size: rand(5, 9) }); break;
      case 'ice': if (this.t % 3 === 0) w.fx('snow', this.x, this.y + rand(-6, 6), this.z); break;
      case 'wave': if (this.t % 3 === 0) w.fx('debris', this.x, 4, this.z); break;
    }
  }

  explode() {
    const w = this.w;
    this.dead = true;
    switch (this.kind) {
      case 'ki': w.fx('burst', this.x, this.y, this.z, { color: '#7fd8ff' }); Sound.play('boom'); break;
      case 'fire': w.fx('explosion', this.x, this.y, this.z); Sound.play('boom'); break;
      case 'ice': w.fx('shards', this.x, this.y, this.z); Sound.play('shatter'); break;
      case 'rock': w.fx('rocks', this.x, this.y + 6, this.z); Sound.play('land'); break;
      case 'bolt': w.fx('zap', this.x, this.y, this.z); break;
      default: w.fx('spark', this.x, this.y, this.z);
    }
  }

  draw(ctx, cam) {
    if (this.dead) return;
    const sx = this.x - cam.x, sy = FLOOR_Y + this.z - this.y, r = this.r;
    ctx.save();
    switch (this.kind) {
      case 'ki': {
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 2);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.35, 'rgba(120,220,255,0.95)');
        g.addColorStop(1, 'rgba(40,120,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sx, sy, r * 2 + Math.sin(this.t) * 2, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'fire': {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 4; i++) {
          const k = i / 4, ox = -this.dir * i * 7, fl = Math.sin(this.t * 0.9 + i) * 2;
          ctx.fillStyle = `rgba(255,${(200 - i * 50) | 0},${(60 - i * 15) | 0},${0.9 - k * 0.5})`;
          ctx.beginPath(); ctx.arc(sx + ox, sy + fl, r * (1.15 - k * 0.5), 0, Math.PI * 2); ctx.fill();
        }
        dot(ctx, sx, sy, r * 0.5, '#fff6c0');
        break;
      }
      case 'ice': {
        ctx.translate(sx, sy); ctx.rotate(this.spin * 0.6);
        ctx.fillStyle = 'rgba(190,235,255,0.95)'; ctx.strokeStyle = '#2a6f9e'; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3, rr = i % 2 ? r * 0.6 : r * 1.25;
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        dot(ctx, -2, -3, 3, '#ffffff');
        break;
      }
      case 'bolt': {
        ctx.globalCompositeOperation = 'lighter';
        const pts = [sx - this.dir * 34, sy];
        for (let i = 1; i <= 6; i++) pts.push(sx - this.dir * 34 + this.dir * i * 7, sy + (i < 6 ? rand(-7, 7) : 0));
        seg(ctx, pts, 7, 'rgba(255,230,90,0.45)');
        seg(ctx, pts, 2.5, '#fffbe0');
        break;
      }
      case 'shuriken': {
        ctx.translate(sx, sy); ctx.rotate(this.spin * 2); ctx.scale(1, 0.75);
        ctx.fillStyle = '#c9ccd6'; ctx.strokeStyle = '#2b2b35'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4, rr = i % 2 ? r * 0.35 : r * 1.4;
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      }
      case 'rock': {
        ctx.translate(sx, sy); ctx.rotate(this.spin);
        ctx.fillStyle = '#8a7461'; ctx.strokeStyle = '#2b2018'; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 7; i++) {
          const a = i * Math.PI * 2 / 7, rr = r * (0.8 + hash(i + 3) * 0.4);
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      }
      case 'wave': {
        const k = this.t / this.life;
        ctx.globalAlpha = 1 - k * 0.6;
        for (let i = 0; i < 4; i++) {
          const ox = sx - this.dir * i * 12, hgt = (34 - i * 7) * (0.7 + Math.sin(this.t * 0.8 + i) * 0.3);
          ctx.fillStyle = i % 2 ? '#7d6650' : '#9b8166'; ctx.strokeStyle = '#2b2018'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(ox - 9, sy); ctx.lineTo(ox - 2, sy - hgt); ctx.lineTo(ox + 8, sy); ctx.closePath();
          ctx.fill(); ctx.stroke();
        }
        break;
      }
      case 'pillar': {
        const grow = Math.min(1, this.t / 5), fade = this.t > this.life - 10 ? (this.life - this.t) / 10 : 1;
        ctx.globalAlpha = Math.max(0, fade);
        const hgt = this.d.h * grow;
        const spikes = [[-12, 0.75], [0, 1], [11, 0.65]];
        for (const [ox, hk] of spikes) {
          const g = ctx.createLinearGradient(0, sy - hgt, 0, sy);
          g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#7cc7f0');
          ctx.fillStyle = g; ctx.strokeStyle = '#2a6f9e'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(sx + ox - 10, sy); ctx.lineTo(sx + ox, sy - hgt * hk); ctx.lineTo(sx + ox + 10, sy);
          ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        break;
      }
      case 'lightning': {
        if (this.delay > 0) {
          const k = 1 - this.delay / 18;
          ctx.strokeStyle = `rgba(255,240,120,${0.3 + k * 0.6})`; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.ellipse(sx, sy, r * (1.6 - k * 0.6), r * 0.45 * (1.6 - k * 0.6), 0, 0, Math.PI * 2); ctx.stroke();
          break;
        }
        if (this.t > 14) break;
        ctx.globalCompositeOperation = 'lighter';
        const pts = [sx + rand(-20, 20), 0];
        for (let yy = 40; yy < sy; yy += 40) pts.push(sx + rand(-18, 18), yy);
        pts.push(sx, sy);
        seg(ctx, pts, 16, 'rgba(255,230,100,0.35)');
        seg(ctx, pts, 5, '#fffbe6');
        ctx.fillStyle = 'rgba(255,240,150,0.5)';
        ctx.beginPath(); ctx.ellipse(sx, sy, 40, 12, 0, 0, Math.PI * 2); ctx.fill();
        break;
      }
    }
    ctx.restore();
  }
}

class Particle {
  constructor(kind, x, y, z, o = {}) {
    this.kind = kind; this.x = x; this.y = y; this.z = z;
    this.vx = o.vx || 0; this.vy = o.vy || 0;
    this.life = o.life || 20; this.t = 0;
    this.size = o.size || 10; this.color = o.color || '#ffffff';
    this.text = o.text; this.rot = rand(0, 6.28); this.layer = o.layer ?? 1;
    this.grav = o.grav || 0; this.dead = false;
  }

  update() {
    this.t++;
    this.x += this.vx; this.y += this.vy; this.vy -= this.grav;
    if (this.grav && this.y < 0) { this.y = 0; this.vy *= -0.3; this.vx *= 0.6; }
    if (this.t >= this.life) this.dead = true;
  }

  draw(ctx, cam) {
    const k = this.t / this.life, sx = this.x - cam.x, sy = FLOOR_Y + this.z - this.y, a = 1 - k;
    ctx.save();
    switch (this.kind) {
      case 'spark': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = this.color; ctx.lineWidth = 3 * a + 0.5; ctx.globalAlpha = a;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const an = this.rot + i * Math.PI / 4, r0 = this.size * k * 0.4, r1 = this.size * (0.45 + k * 0.8) * (i % 2 ? 0.6 : 1);
          ctx.moveTo(sx + Math.cos(an) * r0, sy + Math.sin(an) * r0);
          ctx.lineTo(sx + Math.cos(an) * r1, sy + Math.sin(an) * r1);
        }
        ctx.stroke();
        dot(ctx, sx, sy, this.size * 0.35 * a, '#ffffff');
        break;
      }
      case 'ring':
        ctx.globalAlpha = a; ctx.strokeStyle = this.color; ctx.lineWidth = 4 * a + 0.5;
        ctx.beginPath(); ctx.ellipse(sx, sy, this.size * (0.3 + k), this.size * (0.3 + k) * 0.8, 0, 0, Math.PI * 2); ctx.stroke();
        break;
      case 'dust':
        ctx.globalAlpha = a * 0.55;
        dot(ctx, sx, sy, this.size * (0.6 + k), this.color);
        break;
      case 'smoke':
        ctx.globalAlpha = a * 0.6;
        dot(ctx, sx, sy, this.size * (0.6 + k * 0.8), this.color);
        break;
      case 'flame': {
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
        const g = k < 0.3 ? '#fff3a0' : k < 0.6 ? '#ffa030' : '#e8401c';
        dot(ctx, sx, sy, this.size * (1 - k * 0.7), g);
        break;
      }
      case 'glow':
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.8;
        dot(ctx, sx, sy, this.size * 0.6 * a + 1, this.color);
        break;
      case 'shard':
        ctx.globalAlpha = a; ctx.translate(sx, sy); ctx.rotate(this.rot + this.t * 0.3);
        ctx.fillStyle = this.color; ctx.strokeStyle = '#2a6f9e'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(4, 4); ctx.lineTo(-4, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      case 'debris':
        ctx.globalAlpha = a; ctx.translate(sx, sy); ctx.rotate(this.rot + this.t * 0.2);
        ctx.fillStyle = this.color; ctx.fillRect(-3, -3, 6, 5);
        break;
      case 'snow':
        ctx.globalAlpha = a; dot(ctx, sx, sy, 2.2, '#f2fbff');
        break;
      case 'zap': {
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
        for (let j = 0; j < 2; j++) {
          const pts = [sx + rand(-14, 14), sy + rand(-14, 14)];
          for (let i = 0; i < 3; i++) pts.push(pts[pts.length - 2] + rand(-10, 10), pts[pts.length - 1] + rand(-10, 10));
          seg(ctx, pts, 2, this.color);
        }
        break;
      }
      case 'text':
        ctx.globalAlpha = Math.min(1, a * 2);
        txt(ctx, this.text, sx, sy, { size: this.size, font: FONT_DISPLAY, align: 'center', color: this.color, stroke: '#14121c', strokeW: 4 });
        break;
      case 'firering': {
        ctx.globalCompositeOperation = 'lighter';
        const R = this.size * (0.4 + 0.6 * Math.min(1, this.t / 6));
        ctx.globalAlpha = this.t > this.life - 10 ? (this.life - this.t) / 10 : 1;
        for (let i = 0; i < 26; i++) {
          const an = i / 26 * Math.PI * 2 + this.t * 0.05;
          const px = sx + Math.cos(an) * R, py = sy + Math.sin(an) * R * 0.32;
          const h = 14 + Math.sin(this.t * 0.7 + i * 1.7) * 6;
          ctx.fillStyle = i % 2 ? 'rgba(255,150,40,0.8)' : 'rgba(255,220,90,0.8)';
          ctx.beginPath(); ctx.moveTo(px - 6, py); ctx.quadraticCurveTo(px, py - h * 1.6, px + 6, py); ctx.fill();
        }
        break;
      }
    }
    ctx.restore();
  }
}

function spawnFx(w, kind, x, y, z, o = {}) {
  const P = w.particles;
  const add = (k, oo) => P.push(new Particle(k, x, y, z, oo));
  switch (kind) {
    case 'spark': add('spark', { life: 10, size: 18, color: '#fff3b0' }); break;
    case 'heavy':
      add('spark', { life: 14, size: 30, color: '#ffd84a' });
      add('ring', { life: 12, size: 28, color: '#ffffff' });
      break;
    case 'block': add('ring', { life: 10, size: 22, color: '#8fdcff' }); add('spark', { life: 8, size: 12, color: '#8fdcff' }); break;
    case 'dust':
      for (let i = 0; i < 3; i++) add('dust', { life: 22, size: rand(5, 9), vx: rand(-0.8, 0.8), vy: rand(0.2, 0.6), layer: 0, color: o.color || '#cbbca2' });
      break;
    case 'flame': add('flame', { life: randi(14, 22), size: o.size || rand(5, 9), vy: rand(0.8, 1.6), vx: rand(-0.4, 0.4) }); break;
    case 'explosion':
      for (let i = 0; i < 12; i++) {
        const an = i / 12 * Math.PI * 2;
        add('flame', { life: randi(16, 26), size: rand(8, 14), vx: Math.cos(an) * rand(1, 3), vy: Math.sin(an) * rand(1, 3) + 1 });
      }
      add('ring', { life: 14, size: 40, color: '#ffb040' });
      add('spark', { life: 12, size: 28, color: '#fff3a0' });
      break;
    case 'burst':
      for (let i = 0; i < 10; i++) {
        const an = i / 10 * Math.PI * 2;
        add('glow', { life: 16, size: 8, color: o.color, vx: Math.cos(an) * 3, vy: Math.sin(an) * 3 });
      }
      add('ring', { life: 14, size: 34, color: o.color });
      add('spark', { life: 12, size: 24, color: '#ffffff' });
      break;
    case 'shards':
      for (let i = 0; i < 10; i++) add('shard', { life: 32, vx: rand(-3, 3), vy: rand(2, 6), grav: 0.3, color: '#d4f1ff' });
      break;
    case 'rocks':
      for (let i = 0; i < 7; i++) add('debris', { life: 30, vx: rand(-3, 3), vy: rand(2, 6), grav: 0.35, color: '#7d6650' });
      add('dust', { life: 22, size: 12, layer: 0 });
      break;
    case 'debris': add('debris', { life: 20, vx: rand(-1.5, 1.5), vy: rand(3, 6), grav: 0.4, color: '#8a6f55' }); break;
    case 'smoke':
      for (let i = 0; i < 10; i++) add('smoke', { life: randi(30, 45), size: rand(12, 20), vx: rand(-1.5, 1.5), vy: rand(0, 1.5), color: '#8c8798' });
      break;
    case 'poof': add('smoke', { life: 16, size: 8, color: '#d0d0d8' }); break;
    case 'glow': add('glow', { life: 12, size: o.size || 8, color: o.color || '#ffffff' }); break;
    case 'snow': add('snow', { life: 18, vx: rand(-0.5, 0.5), vy: rand(-0.8, 0.2) }); break;
    case 'zap': add('zap', { life: 7, color: '#fff59a' }); break;
    case 'text': add('text', { life: o.life || 50, vy: 0.8, text: o.text, color: o.color || '#ffffff', size: o.size || 20 }); break;
    case 'firering': add('firering', { life: 32, size: o.size || 80, layer: 0 }); break;
    case 'flashring':
      add('ring', { life: 14, size: 34, color: o.color || '#ffffff' });
      add('spark', { life: 10, size: 22, color: o.color || '#ffffff' });
      break;
  }
}
