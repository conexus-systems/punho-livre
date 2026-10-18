'use strict';
// Cenário com camadas em paralaxe. Cada camada rola na proporção
// (largura_da_camada - largura_da_tela) / (largura_do_cenário - largura_da_tela).

// Cores de 16 bits (RGB565) usadas nos retângulos dos cenários do LF2.
const BG_COLORS = {
  4706: 'rgb(16,79,16)', 40179: 'rgb(159,163,159)', 29582: 'rgb(119,119,119)', 37773: 'rgb(151,119,111)',
  33580: 'rgb(135,107,103)', 25356: 'rgb(103,103,103)', 21096: 'rgb(90,78,75)', 37770: 'rgb(154,110,90)',
  16835: 'rgb(66,56,24)', 34816: 'rgb(143,7,7)',
};

function bgColor(rect) {
  if (typeof rect === 'string') return rect;
  if (BG_COLORS[rect]) return BG_COLORS[rect];
  const r = (rect >> 11) << 3, g = ((rect >> 6) & 31) << 3, b = (rect & 31) << 3;
  const f = (v) => v + (v > 64 || v === 0 ? 7 : 0);
  return `rgb(${f(r)},${f(g) + ((rect >> 5) & 1 && g > 80 ? 4 : 0)},${f(b)})`;
}

class Background {
  constructor(entry) {
    const d = entry.data;
    this.id = entry.id;
    this.name = d.name;
    this.width = d.width;
    this.zboundary = d.zboundary;
    this.shadow = Assets.img(d.shadow);
    this.timer = 0;
    this.camX = 0;
    this.layers = d.layer.map((l, i) => ({ ...l, i, img: l.rect ? null : Assets.img(l.pic) }));
    // no HK Coliseum as camadas (menos a do fundo) ficam 8px mais altas no LF2
    if (d.name === 'HK Coliseum') for (const l of this.layers) if (l.pic && !l.pic.includes('back1')) l.y -= 8;
    this.layers.sort((a, b) => a.width - b.width || a.i - b.i);
    const span = this.width - LF.W;
    for (const l of this.layers) l.ratio = span > 0 ? (l.width - LF.W) / span : 0;
  }

  // atualiza a câmera seguindo os personagens (algoritmo de Azriel, LF-Empire)
  updateCamera(chars, bound) {
    let avg = 0, facing = 0;
    for (const c of chars) { avg += c.ps.x; facing += c.dirh(); }
    if (chars.length) avg /= chars.length;
    let lim = (facing * LF.W) / 24 + (avg - LF.W / 2);
    lim = Math.max(0, Math.min(this.width - LF.W, lim));
    if (bound) lim = Math.max(bound.min, Math.min(bound.max, lim));
    const spd = (lim - this.camX) * GC.camera_speed;
    if (spd > -0.05 && spd < 0.05) this.camX = lim;
    else this.camX += spd;
    this.timer++;
  }

  draw(ctx) {
    for (const l of this.layers) {
      if (l.cc) {
        const t = this.timer % l.cc;
        if (t < l.c1 || t > l.c2) continue;
      }
      const off = -this.camX * l.ratio;
      const w = l.rect ? l.width : (l.img && l.img.naturalWidth) || 0;
      const h = l.rect ? l.height : (l.img && l.img.naturalHeight) || 0;
      const one = (x, flip) => {
        const sx = Math.round(x + off);
        if (sx > LF.W || sx + w < 0) return;
        if (l.rect) {
          ctx.fillStyle = bgColor(l.rect);
          ctx.fillRect(sx, l.y, w, h);
        } else if (l.img && l.img.complete && w) {
          if (flip) {
            ctx.save();
            ctx.translate(sx + w, l.y);
            ctx.scale(-1, 1);
            ctx.drawImage(l.img, 0, 0);
            ctx.restore();
          } else ctx.drawImage(l.img, sx, l.y);
        }
      };
      if (l.loop) {
        for (let x = l.x; x < l.width; x += l.loop) one(x, false);
      } else if (l.tile) {
        const n = Math.abs(l.tile);
        for (let k = -n; k <= n; k++) one(l.x + k * l.width, l.tile < 0 && k % 2 !== 0);
      } else {
        one(l.x, false);
      }
    }
  }

  drawShadow(ctx, o) {
    if (!this.shadow || !this.shadow.complete) return;
    const s = this.shadow;
    ctx.drawImage(s, Math.floor(o.ps.x - s.naturalWidth / 2 - this.camX), Math.floor(o.ps.z - s.naturalHeight / 2));
  }

  pos(rx, rz) {
    return { x: this.width * rx, y: 0, z: this.zboundary[0] + (this.zboundary[1] - this.zboundary[0]) * rz };
  }
}
