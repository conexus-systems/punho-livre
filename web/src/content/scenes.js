'use strict';
// Cenários desenhados por código, em camadas com paralaxe. A cena começa em
// y = 128 do mundo; o chão (onde os lutadores andam) fica entre zboundary[0] e [1].

const SKY_Y = 128, FLOOR_Y = 322, WORLD_BOTTOM = 560;

function vgrad(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([t, c]) => g.addColorStop(t, c));
  return g;
}

// silhueta de morros: pontos com ruído suave
function ridge(ctx, w, base, amp, color, rng, step = 40, top = 0) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, base + 200);
  let y = base - amp * rng.next();
  ctx.lineTo(0, y);
  for (let x = step; x <= w + step; x += step) {
    const ny = Math.max(top, base - amp * (0.3 + 0.7 * rng.next()));
    ctx.quadraticCurveTo(x - step / 2, y, x, ny);
    y = ny;
  }
  ctx.lineTo(w, base + 200);
  ctx.fill();
}

function cloud(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  for (const [dx, dy, r] of [[0, 0, 14], [16, -6, 18], [34, 0, 13], [18, 6, 14]]) {
    ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); ctx.fill();
  }
}

function layer(images, key, w, h, y, draw, extra) {
  const c = makeCanvas(w, h);
  draw(c.getContext('2d'), w, h);
  images[key] = c;
  return { pic: key, width: w, x: 0, y, ...extra };
}

const SCENES = [
  {
    id: 1, name: 'Praia', width: 2000, z: [342, 528],
    layers(images, rng) {
      const k = 'gen/bg1/';
      return [
        layer(images, k + 'sky', LF.W, WORLD_BOTTOM - SKY_Y, SKY_Y, (ctx, w, h) => {
          ctx.fillStyle = vgrad(ctx, 0, 190, [[0, '#2b1d52'], [0.55, '#c8507a'], [1, '#ffb070']]);
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = '#ffe2a0';
          ctx.beginPath(); ctx.arc(520, 168, 34, 0, Math.PI * 2); ctx.fill();
          for (let i = 0; i < 5; i++) cloud(ctx, 60 + i * 160, 40 + (i % 2) * 30, 1 + (i % 3) * 0.3, 'rgba(255,190,200,0.35)');
        }),
        layer(images, k + 'sea', 1000, 150, 290, (ctx, w) => {
          ctx.fillStyle = '#5a3f78';
          for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(120 + i * 260, 12, 90 - i * 10, 16, 0, Math.PI, 0); ctx.fill(); }
          ctx.fillStyle = vgrad(ctx, 10, 60, [[0, '#d9708a'], [0.3, '#5a6ab8'], [1, '#2a4a8a']]);
          ctx.fillRect(0, 10, w, 140);
          ctx.fillStyle = 'rgba(255,230,180,0.7)';
          for (let i = 0; i < 60; i++) ctx.fillRect(rng.next() * w, 14 + rng.next() * 30, 6 + rng.next() * 16, 1.5);
        }),
        layer(images, k + 'palms', 1500, 200, 150, (ctx, w) => {
          for (let i = 0; i < 6; i++) {
            const x = 80 + i * 250 + rng.next() * 60, lean = (rng.next() - 0.5) * 40;
            ctx.strokeStyle = '#5a3a2a'; ctx.lineWidth = 9; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(x, 200); ctx.quadraticCurveTo(x + lean * 0.3, 120, x + lean, 50); ctx.stroke();
            ctx.fillStyle = '#2f6a3a';
            for (let f = 0; f < 6; f++) {
              const a = (f / 6) * Math.PI * 2;
              ctx.beginPath(); ctx.ellipse(x + lean + Math.cos(a) * 26, 50 + Math.sin(a) * 10 + 6, 30, 7, a, 0, Math.PI * 2); ctx.fill();
            }
          }
        }, { transparency: 1 }),
        layer(images, k + 'sand', 2000, WORLD_BOTTOM - FLOOR_Y, FLOOR_Y, (ctx, w, h) => {
          ctx.fillStyle = vgrad(ctx, 0, h, [[0, '#f0c890'], [1, '#d8a868']]);
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = 'rgba(255,255,255,0.75)';
          for (let x = 0; x < w; x += 30) { ctx.beginPath(); ctx.ellipse(x, 6 + Math.sin(x / 50) * 3, 22, 4, 0, 0, Math.PI * 2); ctx.fill(); }
          ctx.fillStyle = 'rgba(150,100,60,0.35)';
          for (let i = 0; i < 500; i++) ctx.fillRect(rng.next() * w, 20 + rng.next() * h, 2, 2);
        }),
      ];
    },
  },
  {
    id: 2, name: 'Rua da Cidade', width: 2400, z: [350, 528],
    layers(images, rng) {
      const k = 'gen/bg2/';
      return [
        layer(images, k + 'sky', LF.W, WORLD_BOTTOM - SKY_Y, SKY_Y, (ctx, w, h) => {
          ctx.fillStyle = vgrad(ctx, 0, 200, [[0, '#070a1e'], [1, '#2a2350']]);
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = '#fff';
          for (let i = 0; i < 80; i++) ctx.fillRect(rng.next() * w, rng.next() * 120, 1.5, 1.5);
          ctx.fillStyle = '#f2ecd0'; ctx.beginPath(); ctx.arc(640, 40, 18, 0, Math.PI * 2); ctx.fill();
        }),
        layer(images, k + 'skyline', 1100, 200, 140, (ctx, w) => {
          let x = 0;
          while (x < w) {
            const bw = 40 + rng.next() * 60, bh = 60 + rng.next() * 120;
            ctx.fillStyle = '#1a1838'; ctx.fillRect(x, 200 - bh, bw, bh);
            ctx.fillStyle = 'rgba(255,214,120,0.75)';
            for (let wy = 200 - bh + 8; wy < 190; wy += 10) for (let wx = x + 5; wx < x + bw - 6; wx += 9) if (rng.next() < 0.35) ctx.fillRect(wx, wy, 4, 5);
            x += bw + 4;
          }
        }, { transparency: 1 }),
        layer(images, k + 'shops', 1700, 160, 182, (ctx, w) => {
          const cols = ['#5a2f3a', '#3a4a6a', '#4a3a2a', '#2f4a4a'];
          for (let x = 0, i = 0; x < w; x += 170, i++) {
            ctx.fillStyle = cols[i % 4]; ctx.fillRect(x, 10, 166, 150);
            ctx.fillStyle = '#20202a'; ctx.fillRect(x + 12, 90, 70, 70);
            ctx.fillStyle = 'rgba(255,230,160,0.55)'; ctx.fillRect(x + 96, 92, 58, 40);
            const neon = ['#ff4fa0', '#4ff0ff', '#ffd23a', '#7dff6a'][i % 4];
            ctx.strokeStyle = neon; ctx.lineWidth = 3; ctx.shadowColor = neon; ctx.shadowBlur = 8;
            ctx.strokeRect(x + 20, 40, 120, 26);
            ctx.beginPath(); ctx.arc(x + 80, 53, 7, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            for (let wy = 14; wy < 34; wy += 12) ctx.fillRect(x + 10, wy, 146, 4);
          }
        }),
        layer(images, k + 'street', 2400, WORLD_BOTTOM - FLOOR_Y, FLOOR_Y, (ctx, w, h) => {
          ctx.fillStyle = '#6a6a74'; ctx.fillRect(0, 0, w, 34);
          ctx.strokeStyle = '#55555e'; ctx.lineWidth = 2;
          for (let x = 0; x < w; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - 10, 34); ctx.stroke(); }
          ctx.fillStyle = '#8a8a92'; ctx.fillRect(0, 32, w, 6);
          ctx.fillStyle = vgrad(ctx, 38, h, [[0, '#33343e'], [1, '#26262e']]);
          ctx.fillRect(0, 38, w, h - 38);
          ctx.fillStyle = '#e8c23a';
          for (let x = 0; x < w; x += 120) ctx.fillRect(x, 128, 60, 6);
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          for (let i = 0; i < 400; i++) ctx.fillRect(rng.next() * w, 40 + rng.next() * h, 2, 2);
        }),
      ];
    },
  },
  {
    id: 3, name: 'Floresta', width: 2400, z: [345, 528],
    layers(images, rng) {
      const k = 'gen/bg3/';
      return [
        layer(images, k + 'sky', LF.W, WORLD_BOTTOM - SKY_Y, SKY_Y, (ctx, w, h) => {
          ctx.fillStyle = vgrad(ctx, 0, 200, [[0, '#5ab0f0'], [1, '#c8ecff']]);
          ctx.fillRect(0, 0, w, h);
          for (let i = 0; i < 6; i++) cloud(ctx, 40 + i * 140, 30 + (i % 3) * 18, 1.1, 'rgba(255,255,255,0.9)');
        }),
        layer(images, k + 'hills', 1100, 200, 160, (ctx, w) => {
          ridge(ctx, w, 120, 70, '#8ab8c8', rng, 60);
          ridge(ctx, w, 160, 50, '#5a9a6a', rng, 50);
        }, { transparency: 1 }),
        layer(images, k + 'trees', 1700, 190, 150, (ctx, w) => {
          for (let i = 0; i < 26; i++) {
            const x = i * 68 + rng.next() * 30, s = 0.8 + rng.next() * 0.5;
            ctx.fillStyle = '#5a3a24'; ctx.fillRect(x - 5 * s, 120, 10 * s, 70);
            ctx.fillStyle = i % 2 ? '#2f7a3a' : '#3a8a44';
            for (const [dx, dy, r] of [[0, 90, 34], [-22, 110, 26], [22, 110, 26], [0, 60, 26]]) {
              ctx.beginPath(); ctx.arc(x + dx * s, dy, r * s, 0, Math.PI * 2); ctx.fill();
            }
          }
          ctx.fillStyle = 'rgba(30,70,30,0.6)'; ctx.fillRect(0, 178, w, 12);
        }, { transparency: 1 }),
        layer(images, k + 'grass', 2400, WORLD_BOTTOM - FLOOR_Y, FLOOR_Y, (ctx, w, h) => {
          ctx.fillStyle = vgrad(ctx, 0, h, [[0, '#4f9a3c'], [1, '#3a7a2e']]);
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = '#b8955f';
          ctx.beginPath(); ctx.moveTo(0, 90);
          for (let x = 0; x <= w; x += 80) ctx.lineTo(x, 90 + Math.sin(x / 300) * 12);
          for (let x = w; x >= 0; x -= 80) ctx.lineTo(x, 150 + Math.sin(x / 260) * 14);
          ctx.fill();
          ctx.strokeStyle = 'rgba(30,80,20,0.6)'; ctx.lineWidth = 1.5;
          for (let i = 0; i < 700; i++) {
            const x = rng.next() * w, y = rng.next() * h;
            if (y > 80 && y < 160) continue;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2, y - 5); ctx.stroke();
          }
        }),
      ];
    },
  },
  {
    id: 4, name: 'Templo da Montanha', width: 1600, z: [348, 528],
    layers(images, rng) {
      const k = 'gen/bg4/';
      return [
        layer(images, k + 'sky', LF.W, WORLD_BOTTOM - SKY_Y, SKY_Y, (ctx, w, h) => {
          ctx.fillStyle = vgrad(ctx, 0, 200, [[0, '#3a2a5a'], [0.6, '#c87a6a'], [1, '#f2c08a']]);
          ctx.fillRect(0, 0, w, h);
        }),
        layer(images, k + 'mountains', 1000, 210, 130, (ctx, w) => {
          ctx.fillStyle = '#6a5a8a';
          for (let i = 0; i < 5; i++) {
            const x = i * 230 + rng.next() * 40, top = 30 + rng.next() * 40;
            ctx.beginPath(); ctx.moveTo(x - 160, 210); ctx.lineTo(x, top); ctx.lineTo(x + 160, 210); ctx.fill();
            ctx.fillStyle = '#f2eef8';
            ctx.beginPath(); ctx.moveTo(x - 30, top + 34); ctx.lineTo(x, top); ctx.lineTo(x + 30, top + 34); ctx.lineTo(x + 10, top + 26); ctx.lineTo(x - 8, top + 36); ctx.fill();
            ctx.fillStyle = '#6a5a8a';
          }
        }, { transparency: 1 }),
        layer(images, k + 'temple', 1300, 190, 150, (ctx, w) => {
          for (let x = 60; x < w; x += 300) {
            ctx.fillStyle = '#a8302a';
            ctx.fillRect(x, 60, 14, 130); ctx.fillRect(x + 150, 60, 14, 130);
            ctx.fillRect(x - 20, 50, 204, 12);
            ctx.fillStyle = '#2a1a1a'; ctx.fillRect(x - 30, 36, 224, 12);
            ctx.fillStyle = '#7a7a82';
            ctx.fillRect(x + 220, 130, 22, 60); ctx.fillRect(x + 212, 118, 38, 14);
            ctx.fillStyle = '#ffcf6a'; ctx.fillRect(x + 225, 140, 12, 12);
          }
        }, { transparency: 1 }),
        layer(images, k + 'stones', 1600, WORLD_BOTTOM - FLOOR_Y, FLOOR_Y, (ctx, w, h) => {
          ctx.fillStyle = '#9a8f8a'; ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = '#7a706c'; ctx.lineWidth = 2;
          for (let y = 0, r = 0; y < h; y += 26 + r * 4, r++) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
            for (let x = (r % 2) * 30; x < w; x += 60 + r * 6) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 26 + r * 4); ctx.stroke(); }
          }
        }),
      ];
    },
  },
  {
    id: 5, name: 'Porto', width: 2400, z: [350, 528],
    layers(images, rng) {
      const k = 'gen/bg5/';
      return [
        layer(images, k + 'sky', LF.W, WORLD_BOTTOM - SKY_Y, SKY_Y, (ctx, w, h) => {
          ctx.fillStyle = vgrad(ctx, 0, 200, [[0, '#7ab0d8'], [1, '#e8eef2']]);
          ctx.fillRect(0, 0, w, h);
          for (let i = 0; i < 4; i++) cloud(ctx, 90 + i * 190, 40 + (i % 2) * 24, 1.3, 'rgba(255,255,255,0.8)');
        }),
        layer(images, k + 'sea', 1100, 200, 150, (ctx, w) => {
          ctx.fillStyle = vgrad(ctx, 120, 200, [[0, '#4a7aa8'], [1, '#2a5a88']]);
          ctx.fillRect(0, 120, w, 80);
          ctx.strokeStyle = '#3a4250'; ctx.lineWidth = 5;
          for (let x = 80; x < w; x += 360) {
            ctx.beginPath(); ctx.moveTo(x, 130); ctx.lineTo(x, 20); ctx.lineTo(x + 110, 20); ctx.moveTo(x - 30, 20); ctx.lineTo(x, 20); ctx.moveTo(x + 90, 20); ctx.lineTo(x + 90, 60); ctx.stroke();
          }
        }, { transparency: 1 }),
        layer(images, k + 'containers', 1700, 120, 212, (ctx, w) => {
          const cols = ['#c8402a', '#2a7ac8', '#e0a020', '#3a9a5a', '#8a4ac8'];
          for (let x = 0; x < w; x += 132) {
            for (let r = 0; r < 2; r++) {
              if (r === 1 && rng.next() < 0.4) continue;
              const c = cols[Math.floor(rng.next() * cols.length)], y = 120 - (r + 1) * 52;
              ctx.fillStyle = c; ctx.fillRect(x + 4, y, 124, 50);
              ctx.fillStyle = 'rgba(0,0,0,0.18)';
              for (let s = x + 10; s < x + 124; s += 10) ctx.fillRect(s, y + 4, 3, 42);
            }
          }
        }, { transparency: 1 }),
        layer(images, k + 'pier', 2400, WORLD_BOTTOM - FLOOR_Y, FLOOR_Y, (ctx, w, h) => {
          ctx.fillStyle = '#9a7048'; ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = '#6a4a2e'; ctx.lineWidth = 2;
          for (let y = 0; y < h; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
          for (let i = 0; i < 300; i++) { const x = rng.next() * w, y = Math.floor(rng.next() * (h / 20)) * 20; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 20); ctx.stroke(); }
        }),
      ];
    },
  },
  {
    id: 6, name: 'Dojô', width: 794, z: [350, 528],
    layers(images, rng) {
      const k = 'gen/bg6/';
      return [
        layer(images, k + 'wall', LF.W, WORLD_BOTTOM - SKY_Y, SKY_Y, (ctx, w, h) => {
          ctx.fillStyle = vgrad(ctx, 0, 200, [[0, '#4a2e1e'], [1, '#7a5034']]);
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = '#f2e6c8';
          for (let x = 30; x < w; x += 190) { ctx.fillRect(x, 50, 130, 120); ctx.strokeStyle = '#3a2416'; ctx.lineWidth = 4; ctx.strokeRect(x, 50, 130, 120); ctx.beginPath(); ctx.moveTo(x + 65, 50); ctx.lineTo(x + 65, 170); ctx.moveTo(x, 110); ctx.lineTo(x + 130, 110); ctx.stroke(); }
          for (let x = 140; x < w; x += 380) { ctx.fillStyle = '#b8282a'; ctx.fillRect(x, 20, 40, 150); ctx.fillStyle = '#f2d23a'; ctx.beginPath(); ctx.arc(x + 20, 70, 12, 0, Math.PI * 2); ctx.fill(); }
        }),
        layer(images, k + 'floor', LF.W, WORLD_BOTTOM - FLOOR_Y, FLOOR_Y, (ctx, w, h) => {
          ctx.fillStyle = '#c89a62'; ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = '#a87a48'; ctx.lineWidth = 2;
          for (let y = 0; y < h; y += 22) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
          for (let i = 0; i < 120; i++) { const x = rng.next() * w, y = Math.floor(rng.next() * (h / 22)) * 22; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 22); ctx.stroke(); }
          ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(0, 0, w, 6);
        }),
      ];
    },
  },
];

// ---- primeiro plano: passa na frente dos lutadores, rolando mais rápido que o chão ----

function front(images, key, sc, h, y, draw, alpha = 1) {
  const w = Math.round(sc.width * 1.2);
  return layer(images, key, w, h, y, (ctx) => draw(ctx, w, h), { front: true, alpha });
}

// copa de árvore vista de perto: círculos sobrepostos com pontos de luz
function canopy(ctx, x, y, s, dark, light) {
  for (const [dx, dy, r] of [[0, 0, 40], [-38, 10, 32], [38, 12, 34], [-20, 34, 28], [24, 36, 30]]) {
    ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = light;
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(x + (i * 37 % 90 - 45) * s, y + (i * 23 % 70) * s, 5 * s, 0, Math.PI * 2); ctx.fill(); }
}

function leafCluster(ctx, x, y, s, a, color) {
  ctx.fillStyle = color;
  for (let i = 0; i < 6; i++) {
    const r = a + (i - 2.5) * 0.35;
    ctx.beginPath(); ctx.ellipse(x + Math.cos(r) * 34 * s, y + Math.sin(r) * 34 * s, 38 * s, 7 * s, r, 0, Math.PI * 2); ctx.fill();
  }
}

const FRONTS = {
  1(images, rng, sc) { // Praia: folhas de palmeira no alto e pedras escuras embaixo
    return [
      front(images, 'gen/bg1/fg-leaves', sc, 110, 150, (ctx, w) => {
        for (let x = 140; x < w; x += 520 + rng.next() * 260) leafCluster(ctx, x, 6, 1.5, Math.PI / 2 + (rng.next() - 0.5), '#1f4a2c');
      }),
    ];
  },
  2(images, rng, sc) { // Rua: postes com luz e fios no alto
    return [
      front(images, 'gen/bg2/fg-poles', sc, 440, 128, (ctx, w, h) => {
        for (let x = 300; x < w; x += 900) {
          ctx.fillStyle = '#16141f'; ctx.fillRect(x - 3, 30, 6, h - 30);
          ctx.fillRect(x - 5, 30, 46, 8);
          const g = ctx.createRadialGradient(x + 38, 44, 2, x + 38, 44, 70);
          g.addColorStop(0, 'rgba(255,230,160,0.9)'); g.addColorStop(1, 'rgba(255,200,100,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + 38, 44, 70, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fff2c0'; ctx.fillRect(x + 28, 40, 20, 6);
        }
        ctx.strokeStyle = 'rgba(10,10,20,0.8)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, 20); for (let x = 0; x <= w; x += 60) ctx.lineTo(x, 22 + Math.sin(x / 90) * 8); ctx.stroke();
      }, 0.55),
    ];
  },
  3(images, rng, sc) { // Floresta: folhas no alto e arbustos embaixo
    return [
      front(images, 'gen/bg3/fg-leaves', sc, 110, 150, (ctx, w) => {
        for (let x = 90; x < w; x += 420 + rng.next() * 260) canopy(ctx, x, -14, 1.1, rng.next() < 0.5 ? '#1c5226' : '#256a2e', '#3f8f45');
      }),
      front(images, 'gen/bg3/fg-bush', sc, 50, 530, (ctx, w) => {
        for (let x = 0; x < w; x += 110) {
          ctx.fillStyle = rng.next() < 0.5 ? '#1f5a2a' : '#2a7035';
          ctx.beginPath(); ctx.arc(x + rng.next() * 40, 56, 26 + rng.next() * 20, Math.PI, 0); ctx.fill();
        }
      }),
    ];
  },
  4(images, rng, sc) { // Templo: pilares vermelhos e lanternas
    return [
      front(images, 'gen/bg4/fg-pillars', sc, 440, 128, (ctx, w, h) => {
        for (let x = 140; x < w; x += 700) {
          ctx.fillStyle = '#8a2a26'; ctx.fillRect(x - 14, 0, 28, h);
          ctx.fillStyle = '#a8352f'; ctx.fillRect(x - 14, 0, 8, h);
          ctx.fillStyle = '#2a1a1a'; ctx.fillRect(x - 20, 0, 40, 10);
        }
        for (let x = 420; x < w; x += 700) {
          ctx.strokeStyle = '#2a1a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 34); ctx.stroke();
          const g = ctx.createRadialGradient(x, 52, 3, x, 52, 44); g.addColorStop(0, 'rgba(255,190,80,0.9)'); g.addColorStop(1, 'rgba(255,120,40,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, 52, 44, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#d83a2a'; ctx.beginPath(); ctx.ellipse(x, 52, 13, 17, 0, 0, Math.PI * 2); ctx.fill();
        }
      }, 0.5),
    ];
  },
  5(images, rng, sc) { // Porto: guindaste e cordas
    return [
      front(images, 'gen/bg5/fg-crane', sc, 200, 128, (ctx, w) => {
        for (let x = 260; x < w; x += 1000) {
          ctx.fillStyle = '#c8402a'; ctx.fillRect(x - 6, 0, 12, 200);
          ctx.fillRect(x - 6, 0, 150, 10);
          ctx.strokeStyle = '#2a2a30'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 140, 10); ctx.lineTo(x + 140, 110); ctx.stroke();
          ctx.fillStyle = '#2a2a30'; ctx.beginPath(); ctx.arc(x + 140, 116, 8, 0, Math.PI, false); ctx.fill();
        }
      }, 0.7),
    ];
  },
};

// cor de ambiente e vinheta de cada cenário
const TONES = {
  1: { tone: 'rgba(255,140,70,0.10)', vignette: 0.35 },
  2: { tone: 'rgba(40,60,170,0.12)', vignette: 0.5 },
  3: { tone: 'rgba(255,255,200,0.05)', vignette: 0.32 },
  4: { tone: 'rgba(255,110,60,0.10)', vignette: 0.42 },
  5: { tone: 'rgba(120,170,220,0.06)', vignette: 0.32 },
  6: { tone: 'rgba(255,170,80,0.10)', vignette: 0.45 },
};

function buildScene(sc, images) {
  const rng = new Random(sc.id * 7919);
  if (!images['gen/shadow']) {
    const s = makeCanvas(40, 10), ctx = s.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(20, 5, 19, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    images['gen/shadow'] = s;
  }
  return {
    id: sc.id, name: sc.name,
    data: {
      name: sc.name, width: sc.width, zboundary: sc.z, shadow: 'gen/shadow', shadowsize: [37, 9],
      layer: [...sc.layers(images, rng), ...(FRONTS[sc.id] ? FRONTS[sc.id](images, rng, sc) : [])], ...TONES[sc.id],
    },
  };
}
