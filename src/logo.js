'use strict';
// Logo do Punho Livre, desenhado por código (fonte Bangers, OFL).

const LOGO_FONT = '"Bangers", Impact, "Arial Black", sans-serif';

// estrela de impacto atrás do nome
function drawBurst(ctx, cx, cy, r, points, color, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = rot + (i * Math.PI) / points;
    const rr = i % 2 ? r * 0.62 : r * (0.9 + 0.1 * Math.sin(i * 7.3));
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawLogo(ctx, cx, cy, s = 1, t = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  // linhas de velocidade
  ctx.strokeStyle = 'rgba(255,200,80,0.35)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 14; i++) {
    const y = -70 + i * 11, len = 60 + ((i * 37) % 70);
    ctx.beginPath(); ctx.moveTo(-250 - len, y); ctx.lineTo(-215, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(215, y + 5); ctx.lineTo(250 + len, y + 5); ctx.stroke();
  }
  drawBurst(ctx, 0, -8, 150 + Math.sin(t * 0.08) * 4, 13, '#c4281c', t * 0.004);
  drawBurst(ctx, 0, -8, 122, 13, '#f28a1a', -t * 0.003 + 0.2);
  ctx.rotate(-0.06);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.font = `104px ${LOGO_FONT}`;
  ctx.lineWidth = 16;
  ctx.strokeStyle = '#120a1e';
  ctx.strokeText('PUNHO', 0, 18);
  const g = ctx.createLinearGradient(0, -60, 0, 18);
  g.addColorStop(0, '#fff3a6');
  g.addColorStop(0.5, '#ffc21c');
  g.addColorStop(1, '#ff6a00');
  ctx.fillStyle = g;
  ctx.fillText('PUNHO', 0, 18);
  ctx.font = `62px ${LOGO_FONT}`;
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#120a1e';
  ctx.strokeText('LIVRE', 34, 74);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('LIVRE', 34, 74);
  ctx.restore();
}
