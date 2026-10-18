'use strict';
// Cenário com camadas em paralaxe. Cada camada rola na proporção
// (largura_da_camada - largura_da_tela) / (largura_do_cenário - largura_da_tela).

function bgColor(rect) { return rect; }

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
    this.layers.sort((a, b) => a.width - b.width || a.i - b.i);
    const span = this.width - LF.W;
    for (const l of this.layers) l.ratio = span > 0 ? (l.width - LF.W) / span : 0;
  }

  // atualiza a câmera seguindo os personagens (segue a média dos lutadores, adiantada para onde olham)
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

  // borda de baixo do cenário (abaixo dela a tela ficaria preta)
  bottom() {
    let b = 0;
    for (const l of this.layers) {
      const h = l.rect ? l.height : (l.img && l.img.naturalHeight) || 0;
      if (!l.cc) b = Math.max(b, l.y + h);
    }
    return b;
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
