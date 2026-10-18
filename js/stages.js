'use strict';
// Cenários desenhados proceduralmente com camadas de paralaxe.

function skyGrad(ctx, top, bottom) {
  const g = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, FLOOR_Y + 2);
}

function ridge(ctx, camX, par, baseY, amp, freq, seed, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, FLOOR_Y + 2);
  for (let sx = 0; sx <= VIEW_W + 8; sx += 8) {
    const wx = sx + camX * par;
    const y = baseY - amp * (0.5 * Math.sin(wx * freq + seed) + 0.3 * Math.sin(wx * freq * 2.3 + seed * 2) +
      0.2 * Math.sin(wx * freq * 5.1 + seed * 3));
    ctx.lineTo(sx, y);
  }
  ctx.lineTo(VIEW_W, FLOOR_Y + 2);
  ctx.closePath();
  ctx.fill();
}

// Repete um desenho a cada `spacing` pixels do mundo, com paralaxe `par`.
function repeat(camX, par, spacing, margin, fn) {
  const off = camX * par;
  const i0 = Math.floor((off - margin) / spacing), i1 = Math.ceil((off + VIEW_W + margin) / spacing);
  for (let i = i0; i <= i1; i++) fn(i * spacing - off + (hash(i * 7.3) - 0.5) * spacing * 0.4, i);
}

function groundBase(ctx, camX, c1, c2, lineColor) {
  const g = ctx.createLinearGradient(0, FLOOR_Y, 0, VIEW_H);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(0, FLOOR_Y, VIEW_W, VIEW_H - FLOOR_Y);
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1;
  for (let z = 25; z < VIEW_H - FLOOR_Y; z += 25 + z * 0.12) {
    ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.moveTo(0, FLOOR_Y + z); ctx.lineTo(VIEW_W, FLOOR_Y + z); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

const BACKGROUNDS = {
  forest: {
    name: 'Floresta',
    draw(ctx, camX, t) {
      skyGrad(ctx, '#86c3e0', '#e4f1d6');
      dot(ctx, 760 - camX * 0.03, 70, 30, 'rgba(255,250,220,0.85)');
      ridge(ctx, camX, 0.12, 200, 50, 0.006, 1, '#9cb9b0');
      ridge(ctx, camX, 0.25, 240, 40, 0.009, 4, '#6f9a83');
      repeat(camX, 0.5, 70, 80, (x, i) => {
        const hgt = 70 + hash(i) * 50, base = FLOOR_Y;
        ctx.fillStyle = '#4a3523';
        ctx.fillRect(x - 5, base - hgt * 0.45, 10, hgt * 0.45);
        ctx.fillStyle = i % 2 ? '#2f6b3c' : '#3a7d45';
        for (let k = 0; k < 3; k++) {
          dot(ctx, x + (k - 1) * 14, base - hgt * (0.55 + k * 0.12), 24 - k * 4, ctx.fillStyle);
        }
      });
      groundBase(ctx, camX, '#6ea24a', '#4d7c32', '#3c6526');
      ctx.fillStyle = '#b39a6c';
      ctx.fillRect(0, FLOOR_Y + 70, VIEW_W, 60);
      repeat(camX, 1, 60, 40, (x, i) => {
        ctx.fillStyle = '#9c8459';
        ctx.fillRect(x, FLOOR_Y + 75 + hash(i + 2) * 50, 10, 3);
        ctx.strokeStyle = '#3d6b28'; ctx.lineWidth = 2;
        const gy = FLOOR_Y + 10 + hash(i + 9) * 50;
        seg(ctx, [x + 20, gy, x + 17, gy - 8], 2, '#3d6b28');
        seg(ctx, [x + 22, gy, x + 24, gy - 9], 2, '#3d6b28');
        const gy2 = FLOOR_Y + 150 + hash(i + 5) * 60;
        seg(ctx, [x + 40, gy2, x + 37, gy2 - 9], 2, '#3d6b28');
        seg(ctx, [x + 42, gy2, x + 45, gy2 - 8], 2, '#3d6b28');
      });
    },
  },

  city: {
    name: 'Porto ao entardecer',
    draw(ctx, camX, t) {
      skyGrad(ctx, '#2b2d5c', '#f08a63');
      dot(ctx, 300 - camX * 0.04, 230, 46, 'rgba(255,200,120,0.75)');
      repeat(camX, 0.15, 60, 60, (x, i) => {
        const hgt = 80 + hash(i) * 110;
        ctx.fillStyle = '#433a6b';
        ctx.fillRect(x - 25, FLOOR_Y - 40 - hgt, 50, hgt + 40);
      });
      repeat(camX, 0.4, 110, 120, (x, i) => {
        const hgt = 110 + hash(i + 1) * 110, wd = 80;
        ctx.fillStyle = '#2c2546';
        ctx.fillRect(x - wd / 2, FLOOR_Y - hgt, wd, hgt);
        for (let r = 0; r < hgt / 18 - 1; r++) {
          for (let c = 0; c < 4; c++) {
            if (hash(i * 31 + r * 7 + c) > 0.55) {
              ctx.fillStyle = hash(i + r + c) > 0.5 ? '#ffd27a' : '#ffb35c';
              ctx.fillRect(x - wd / 2 + 8 + c * 18, FLOOR_Y - hgt + 10 + r * 18, 8, 9);
            }
          }
        }
      });
      repeat(camX, 1, 240, 60, (x) => {
        seg(ctx, [x, FLOOR_Y + 4, x, FLOOR_Y - 90], 4, '#1d1a2c');
        seg(ctx, [x, FLOOR_Y - 90, x + 16, FLOOR_Y - 92], 4, '#1d1a2c');
        dot(ctx, x + 18, FLOOR_Y - 88, 5, '#fff1b8');
      });
      groundBase(ctx, camX, '#5a5866', '#3b3a44', '#2a2932');
      ctx.fillStyle = '#7d7a86';
      ctx.fillRect(0, FLOOR_Y, VIEW_W, 22);
      repeat(camX, 1, 90, 40, (x) => {
        ctx.fillStyle = '#e6d48a';
        ctx.fillRect(x, FLOOR_Y + 120, 40, 4);
      });
    },
  },

  temple: {
    name: 'Templo da Montanha',
    draw(ctx, camX, t) {
      skyGrad(ctx, '#f2a65e', '#f8e3bd');
      dot(ctx, 520 - camX * 0.03, 150, 60, 'rgba(255,240,200,0.9)');
      ridge(ctx, camX, 0.1, 210, 80, 0.005, 2, '#c99a7e');
      ridge(ctx, camX, 0.22, 250, 40, 0.01, 7, '#a8735c');
      repeat(camX, 0.45, 260, 140, (x, i) => {
        const base = FLOOR_Y - 10;
        ctx.fillStyle = '#6e2f25';
        for (let k = 0; k < 3; k++) {
          const wd = 120 - k * 30, y = base - 30 - k * 40;
          ctx.fillRect(x - wd / 2 + 15, y, wd - 30, 30);
          ctx.beginPath();
          ctx.moveTo(x - wd / 2 - 10, y + 2); ctx.lineTo(x + wd / 2 + 10, y + 2);
          ctx.lineTo(x + wd / 2 - 15, y - 14); ctx.lineTo(x - wd / 2 + 15, y - 14);
          ctx.closePath(); ctx.fill();
        }
      });
      repeat(camX, 1, 520, 120, (x) => {
        seg(ctx, [x - 40, FLOOR_Y + 4, x - 40, FLOOR_Y - 120], 9, '#c0392b');
        seg(ctx, [x + 40, FLOOR_Y + 4, x + 40, FLOOR_Y - 120], 9, '#c0392b');
        seg(ctx, [x - 62, FLOOR_Y - 120, x + 62, FLOOR_Y - 120], 11, '#2a1a16');
        seg(ctx, [x - 52, FLOOR_Y - 100, x + 52, FLOOR_Y - 100], 7, '#c0392b');
      });
      groundBase(ctx, camX, '#c9b292', '#9e8668', '#7d6a52');
      repeat(camX, 1, 64, 40, (x) => {
        ctx.strokeStyle = 'rgba(90,70,50,0.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, FLOOR_Y); ctx.lineTo(x - 30, VIEW_H); ctx.stroke();
      });
    },
  },

  ice: {
    name: 'Geleira',
    draw(ctx, camX, t) {
      skyGrad(ctx, '#a9d6ef', '#f0faff');
      ridge(ctx, camX, 0.1, 210, 90, 0.006, 3, '#e8f4fb');
      ridge(ctx, camX, 0.1, 230, 60, 0.006, 3.3, '#bcd8ea');
      repeat(camX, 0.45, 80, 80, (x, i) => {
        const hgt = 60 + hash(i + 4) * 50;
        ctx.fillStyle = '#2f5d58';
        for (let k = 0; k < 3; k++) {
          const y = FLOOR_Y - k * hgt * 0.28, wd = 30 - k * 7;
          ctx.beginPath(); ctx.moveTo(x - wd, y); ctx.lineTo(x, y - hgt * 0.45); ctx.lineTo(x + wd, y); ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(x - 7, FLOOR_Y - hgt * 0.75); ctx.lineTo(x, FLOOR_Y - hgt * 0.9 - 6); ctx.lineTo(x + 7, FLOOR_Y - hgt * 0.75); ctx.closePath(); ctx.fill();
      });
      groundBase(ctx, camX, '#f2f8fc', '#cfe2ef', '#a9c7dc');
      repeat(camX, 1, 300, 100, (x, i) => {
        ctx.fillStyle = 'rgba(150,205,240,0.45)';
        ctx.beginPath(); ctx.ellipse(x, FLOOR_Y + 60 + hash(i) * 120, 70, 12, 0, 0, Math.PI * 2); ctx.fill();
      });
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 60; i++) {
        const sx = ((hash(i) * VIEW_W + t * (0.4 + hash(i + 1)) - camX * 0.6) % VIEW_W + VIEW_W) % VIEW_W;
        const sy = (hash(i + 2) * VIEW_H + t * (0.8 + hash(i + 3) * 0.8)) % VIEW_H;
        ctx.fillRect(sx, sy, 2.5, 2.5);
      }
    },
  },

  volcano: {
    name: 'Cratera do Vulcão',
    draw(ctx, camX, t) {
      skyGrad(ctx, '#1d0b0b', '#9c2f1a');
      const vx = 480 - camX * 0.08;
      ctx.fillStyle = '#2a1512';
      ctx.beginPath(); ctx.moveTo(vx - 300, FLOOR_Y); ctx.lineTo(vx - 50, 110); ctx.lineTo(vx + 50, 110); ctx.lineTo(vx + 300, FLOOR_Y); ctx.closePath(); ctx.fill();
      const glow = 0.6 + Math.sin(t * 0.05) * 0.2;
      ctx.fillStyle = `rgba(255,120,40,${glow})`;
      ctx.beginPath(); ctx.ellipse(vx, 112, 50, 8, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = `rgba(60,40,40,${0.35 - i * 0.06})`;
        dot(ctx, vx + Math.sin(t * 0.01 + i) * 30 + i * 15, 90 - i * 22 - (t * 0.2 % 20), 26 + i * 10, ctx.fillStyle);
      }
      ridge(ctx, camX, 0.3, 255, 35, 0.012, 5, '#3a1c16');
      groundBase(ctx, camX, '#3d2a25', '#221613', '#150d0b');
      repeat(camX, 1, 170, 80, (x, i) => {
        const pulse = 0.55 + Math.sin(t * 0.06 + i) * 0.3;
        ctx.strokeStyle = `rgba(255,110,30,${pulse})`;
        ctx.lineWidth = 3;
        const y0 = FLOOR_Y + 40 + hash(i) * 150;
        ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + 30, y0 + 8); ctx.lineTo(x + 50, y0 + 2); ctx.lineTo(x + 80, y0 + 12); ctx.stroke();
      });
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 30; i++) {
        const sx = ((hash(i + 40) * VIEW_W - camX * 0.7 + Math.sin(t * 0.02 + i) * 20) % VIEW_W + VIEW_W) % VIEW_W;
        const sy = VIEW_H - ((hash(i + 41) * VIEW_H + t * (0.6 + hash(i) * 0.8)) % VIEW_H);
        ctx.fillStyle = 'rgba(255,140,50,0.7)';
        ctx.fillRect(sx, sy, 2, 2);
      }
      ctx.globalCompositeOperation = 'source-over';
    },
  },
};

const BG_KEYS = Object.keys(BACKGROUNDS);

// Modo história: 5 fases, cada uma com 3 trechos de inimigos. '!' marca o chefe.
const STORY = [
  { name: 'Floresta Sombria', bg: 'forest', phases: [['bandit', 'bandit'], ['bandit', 'bandit', 'bandit'], ['bandit', 'brute', 'bandit', '!sombra']] },
  { name: 'Porto ao Entardecer', bg: 'city', phases: [['bandit', 'bandit', 'bandit'], ['brute', 'bandit', 'bandit'], ['bandit', 'brute', 'bandit', '!rocha']] },
  { name: 'Templo da Montanha', bg: 'temple', phases: [['bandit', 'bandit', 'brute', 'bandit'], ['bandit', 'bandit', 'bandit', 'bandit'], ['brute', 'bandit', '!trovao']] },
  { name: 'Geleira Eterna', bg: 'ice', phases: [['bandit', 'brute', 'bandit', 'bandit'], ['brute', 'brute', 'bandit'], ['bandit', 'bandit', '!neve']] },
  { name: 'Cratera do Vulcão', bg: 'volcano', phases: [['bandit', 'bandit', 'bandit', 'brute'], ['brute', 'brute', 'bandit', 'bandit'], ['!brasa', '!kai']] },
];
