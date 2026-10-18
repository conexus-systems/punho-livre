'use strict';
// Painel de vida/MP, mensagens e resumo da luta, desenhados por código
// no visual do Punho Livre.

const UI = {
  ink: '#0b1030',
  panel: '#141a3d',
  panel2: '#1c2452',
  line: 'rgba(233,235,255,0.18)',
  text: '#e9ebff',
  muted: '#9aa3d8',
  dim: '#5b5f86',
  amber: '#ffb000',
  hp: '#e8414a',
  hpDark: '#5c1420',
  hpLost: '#2a0b12',
  mp: '#3e8ef0',
  mpDark: '#122452',
  good: '#66d17a',
  bad: '#ff6b5e',
  players: ['#ff5a4e', '#4fb0ff', '#66d17a', '#ffc94a'],
};

function displayFont(size) { return `${size}px ${LOGO_FONT}`; }

function title(ctx, s, x, y, size, color = UI.text, align = 'center') {
  ctx.font = displayFont(size);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size / 7);
  ctx.strokeStyle = '#120a1e';
  ctx.strokeText(s, x, y);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

function panelBox(ctx, x, y, w, h, accent) {
  ctx.fillStyle = 'rgba(13,18,46,0.94)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = UI.line;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  if (accent) { ctx.fillStyle = accent; ctx.fillRect(x, y, w, 3); }
}

function slotColor(ch) {
  if (ch.player >= 0) return UI.players[ch.player % 4];
  if (ch.team >= 1 && ch.team <= 4) return ['#ff6b5e', '#5aa9ff', '#66d17a', '#ffc94a'][ch.team - 1];
  return '#8f93b8';
}

// Painel no topo: até 4 lutadores por linha; com 4 ou menos, uma linha só, maior.
function drawHud(ctx, m) {
  const list = m.panel;
  ctx.fillStyle = 'rgba(5,8,20,0.92)';
  ctx.fillRect(0, 0, LF.W, LF.HUD_H);
  if (!list.length) return;
  const rows = list.length > 4 ? 2 : 1, rh = LF.HUD_H / rows, cw = LF.W / 4;
  list.slice(0, 8).forEach((slot, i) => {
    const c = slot.ch, h = c.health;
    const x = (i % 4) * cw, y = Math.floor(i / 4) * rh;
    const pad = 3, ph = rh - pad * 2;
    ctx.fillStyle = UI.panel;
    ctx.fillRect(x + pad, y + pad, cw - pad * 2, ph);
    const col = slotColor(c);
    ctx.fillStyle = col;
    ctx.fillRect(x + pad, y + pad, 3, ph);
    const small = Assets.img(c.data.bmp.small);
    const pw = Math.round(ph * 40 / 45);
    if (small) ctx.drawImage(small, x + pad + 6, y + pad, pw, ph);
    const bx = x + pad + 10 + pw, bw = cw - (bx - x) - pad - 6;
    const label = slot.name || c.name;
    const fs = rows === 1 ? 12 : 10;
    ctx.font = `bold ${fs}px Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = col;
    ctx.fillText(label, bx, y + pad + 2, bw * 0.45);
    ctx.fillStyle = UI.text;
    ctx.textAlign = 'right';
    ctx.fillText(c.name, bx + bw, y + pad + 2, bw * 0.55);
    // barras: vida (com a parte recuperável mais escura) e MP
    const hy = y + pad + fs + 5, hh = rows === 1 ? 10 : 6, my = hy + hh + 3, mh = rows === 1 ? 6 : 4;
    const f = (v) => Math.max(0, Math.min(1, v));
    ctx.fillStyle = UI.hpLost; ctx.fillRect(bx, hy, bw, hh);
    ctx.fillStyle = UI.hpDark; ctx.fillRect(bx, hy, bw * f(h.hp_bound / h.hp_full), hh);
    ctx.fillStyle = h.hp > 0 && c.effect.heal > 0 && m.time % 3 === 0 ? '#ff9a9a' : UI.hp;
    ctx.fillRect(bx, hy, bw * f(h.hp / h.hp_full), hh);
    ctx.fillStyle = UI.mpDark; ctx.fillRect(bx, my, bw, mh);
    ctx.fillStyle = UI.mp; ctx.fillRect(bx, my, bw * f(h.mp / h.mp_full), mh);
    if (h.hp <= 0) {
      ctx.fillStyle = 'rgba(5,8,20,0.6)';
      ctx.fillRect(x + pad, y + pad, cw - pad * 2, ph);
      title(ctx, 'K.O.', x + cw / 2, y + rh / 2, rows === 1 ? 26 : 18, UI.amber);
    }
  });
}

function drawBanner(ctx, s, sub) {
  const y = LF.H / 2 - 10;
  ctx.fillStyle = 'rgba(5,8,20,0.55)';
  ctx.fillRect(0, y - 34, LF.W, sub ? 84 : 68);
  title(ctx, s, LF.W / 2, y, 44, UI.amber);
  if (sub) text(ctx, sub, LF.W / 2, y + 34, { align: 'center', bold: false, size: 14, color: UI.text });
}

function drawSummary(ctx, m) {
  const sum = m.summary, rows = sum.rows;
  const cols = [
    ['Lutador', 150, 'left'], ['Nocautes', 70], ['Ataque', 70], ['Vida perdida', 86], ['MP usado', 76], ['Itens', 56], ['Resultado', 110],
  ];
  const W = cols.reduce((s, c) => s + c[1], 0) + 64, rh = 36;
  const H = 74 + rows.length * rh + 44;
  const x0 = Math.round((LF.W - W) / 2), y0 = Math.max(LF.HUD_H + 6, Math.round((LF.H - H) / 2));
  panelBox(ctx, x0, y0, W, H, UI.amber);
  title(ctx, sum.title || 'Fim da luta', LF.W / 2, y0 + 26, 30, UI.amber);
  let x = x0 + 58;
  const hy = y0 + 58;
  cols.forEach(([n, w, a]) => {
    text(ctx, n, a === 'left' ? x : x + w / 2, hy, { align: a || 'center', size: 11, color: UI.muted });
    x += w;
  });
  rows.forEach((r, i) => {
    const y = y0 + 70 + i * rh;
    if (i % 2 === 0) { ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(x0 + 8, y, W - 16, rh); }
    const small = Assets.img(r.small);
    if (small) ctx.drawImage(small, x0 + 16, y + 2, 28, 32);
    let cx = x0 + 58;
    const vals = [r.name, r.kill, r.attack, r.lost, r.mp, r.pick];
    vals.forEach((v, k) => {
      const [, w, a] = cols[k];
      text(ctx, String(v), a === 'left' ? cx : cx + w / 2, y + rh / 2, { align: a || 'center', size: k === 0 ? 13 : 14, color: k === 0 ? UI.text : '#ffd9a8', max: w - 6 });
      cx += w;
    });
    const res = (r.win ? 'Vitória' : 'Derrota') + (r.alive ? '' : ' · K.O.');
    text(ctx, res, cx + cols[6][1] / 2, y + rh / 2, { align: 'center', size: 13, color: r.win ? UI.good : UI.bad });
  });
  const sec = Math.floor(sum.time);
  const time = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  const fy = y0 + H - 22;
  text(ctx, `Tempo de luta ${time}`, x0 + W - 18, fy, { align: 'right', size: 12, color: UI.muted });
  if (!m.net && !m.demo) {
    const blink = Math.floor(m.time / 15) % 2 === 0;
    text(ctx, 'Aperte ATAQUE para continuar', x0 + 18, fy, { size: 12, color: blink ? UI.text : UI.muted });
  }
}

function drawPauseOverlay(ctx) {
  ctx.fillStyle = 'rgba(5,8,20,0.55)';
  ctx.fillRect(0, LF.HUD_H, LF.W, LF.H - LF.HUD_H);
  title(ctx, 'PAUSA', LF.W / 2, LF.H / 2 - 10, 54, UI.amber);
  text(ctx, 'F1 ou P continua · Esc sai da luta', LF.W / 2, LF.H / 2 + 30, { align: 'center', bold: false, color: UI.text });
}
