'use strict';
// Personagens originais e seus golpes especiais.
//
// Formato de um golpe:
//   dur     duração em quadros (60 por segundo)
//   keys    quadros-chave de pose [[quadro, 'pose'], ...]
//   hit     caixa de acerto: ativa de `from` a `to`, `x`/`w` à frente do corpo,
//           `y`/`h` altura do centro e tamanho; `both` acerta dos dois lados;
//           `rehit` permite acertar de novo a cada N quadros.
//   events  { quadro: (lutador, mundo) => ... } para criar projéteis etc.
//   update  (lutador, mundo, t) => ... chamado a cada quadro
//   cost    MP gasto; ai: alcance em que a CPU usa o golpe.

const SP = {
  kiBlast: {
    name: 'Onda Ki', cost: 15, dur: 30, keys: [[0, 'castWind'], [9, 'cast'], [22, 'cast'], [30, 'guard']],
    events: { 10: (f, w) => w.spawnProjectile(f, 'ki') },
    ai: { min: 110, max: 650, z: 14 },
  },
  dragonUpper: {
    name: 'Gancho do Dragão', cost: 14, dur: 40, keepVel: true, sfx: 'whoosh',
    keys: [[0, 'uppercutWind'], [6, 'uppercut'], [30, 'uppercut'], [40, 'jumpDown']],
    start: (f) => { f.vx = 0; },
    update: (f, w, t) => {
      if (t === 6) { f.vy = 9.5; f.y = 0.1; f.vx = f.facing * 2.2; w.fx('flashring', f.x, f.y + 40, f.z, { color: '#ffd84a' }); }
    },
    hit: { from: 6, to: 18, x: -4, w: 40, y: 70, h: 70, dmg: 42, kvx: 2, kvy: 11, knockdown: true, heavy: true },
    ai: { min: 0, max: 55, z: 14 },
  },
  rushPunch: {
    name: 'Rajada de Socos', cost: 22, dur: 38, keepVel: true,
    keys: [[0, 'punchWind'], [4, 'punchHit'], [8, 'punch2Hit'], [12, 'punchHit'], [16, 'punch2Hit'], [20, 'punchHit'], [24, 'punch2Hit'], [30, 'guard']],
    update: (f, w, t) => {
      f.vx = t < 26 ? f.facing * 5.5 : f.vx * 0.8;
      if (t % 4 === 0 && t < 26) Sound.play('whoosh');
    },
    hit: { from: 3, to: 27, rehit: 5, x: 0, w: 40, y: 58, h: 30, dmg: 11, kvx: 4, fall: 14, stun: 14 },
    ai: { min: 30, max: 170, z: 12 },
  },
  fireball: {
    name: 'Bola de Fogo', cost: 16, dur: 32, keys: [[0, 'castWind'], [10, 'cast'], [24, 'cast'], [32, 'guard']],
    events: { 11: (f, w) => w.spawnProjectile(f, 'fire') },
    ai: { min: 110, max: 650, z: 14 },
  },
  flameComet: {
    name: 'Cometa Flamejante', cost: 22, dur: 32, keepVel: true, sfx: 'fire',
    keys: [[0, 'charge'], [26, 'charge'], [32, 'guard']],
    update: (f, w, t) => {
      f.vx = t < 26 ? f.facing * 9 : f.vx * 0.75;
      if (t < 26) for (let i = 0; i < 2; i++) w.fx('flame', f.x + rand(-14, 14), rand(10, 70), f.z, { size: rand(7, 11) });
    },
    hit: { from: 2, to: 25, x: -10, w: 45, y: 45, h: 70, dmg: 40, effect: 'fire', knockdown: true, kvx: 6, kvy: 6, heavy: true },
    ai: { min: 60, max: 300, z: 14 },
  },
  flameRing: {
    name: 'Anel de Chamas', cost: 35, dur: 46, invuln: 38,
    keys: [[0, 'crouch'], [8, 'raise'], [40, 'raise'], [46, 'guard']],
    events: { 10: (f, w) => { w.fx('firering', f.x, 0, f.z, { size: 85 }); Sound.play('fire'); w.shake = 6; } },
    update: (f, w, t) => {
      if (t > 10 && t < 38) {
        const an = rand(0, Math.PI * 2);
        w.fx('flame', f.x + Math.cos(an) * 60, rand(0, 30), f.z + Math.sin(an) * 18, { size: rand(8, 12) });
      }
    },
    hit: { from: 10, to: 38, rehit: 10, both: true, w: 78, y: 45, h: 90, z: 40, dmg: 28, effect: 'fire', knockdown: true, kvx: 5, kvy: 7, unblockable: true, heavy: true },
    ai: { min: 0, max: 75, z: 35 },
  },
  iceBlast: {
    name: 'Rajada Gélida', cost: 18, dur: 30, keys: [[0, 'castWind'], [9, 'cast'], [22, 'cast'], [30, 'guard']],
    events: { 10: (f, w) => w.spawnProjectile(f, 'ice') },
    ai: { min: 110, max: 650, z: 14 },
  },
  icePillars: {
    name: 'Pilares de Gelo', cost: 30, dur: 42, keys: [[0, 'raise'], [12, 'slam'], [36, 'slam'], [42, 'guard']],
    events: Object.fromEntries([14, 19, 24, 29].map((q, i) => [q, (f, w) => {
      w.spawnProjectile(f, 'pillar', { x: f.x + f.facing * (58 + i * 50), y: 0, vx: 0 });
    }])),
    ai: { min: 30, max: 240, z: 14 },
  },
  glacierSlide: {
    name: 'Deslize Glacial', cost: 14, dur: 30, keepVel: true, sfx: 'whoosh',
    keys: [[0, 'slide'], [24, 'slide'], [30, 'guard']],
    update: (f, w, t) => {
      f.vx = t < 22 ? f.facing * 8 : f.vx * 0.7;
      if (t % 2 === 0 && t < 22) w.fx('snow', f.x, 4, f.z);
    },
    hit: { from: 2, to: 21, x: 0, w: 46, y: 14, h: 28, dmg: 30, knockdown: true, kvx: 3, kvy: 7 },
    ai: { min: 40, max: 200, z: 12 },
  },
  boltShot: {
    name: 'Faísca', cost: 15, dur: 24, keys: [[0, 'castWind'], [6, 'cast'], [18, 'cast'], [24, 'guard']],
    events: { 7: (f, w) => w.spawnProjectile(f, 'bolt') },
    ai: { min: 80, max: 700, z: 14 },
  },
  thunderStrike: {
    name: 'Relâmpago', cost: 35, dur: 36, keys: [[0, 'raise'], [30, 'raise'], [36, 'guard']],
    events: {
      10: (f, w) => {
        const tg = w.nearestEnemy(f, true);
        w.spawnProjectile(f, 'lightning', { x: tg ? tg.x : f.x + f.facing * 220, z: tg ? tg.z : f.z, y: 0, vx: 0 });
        w.fx('zap', f.x, f.y + 95, f.z);
      },
    },
    ai: { min: 0, max: 2000, z: 999 },
  },
  teleport: {
    name: 'Teleporte', cost: 15, dur: 22, invuln: 14, keys: [[0, 'crouch'], [6, 'guard']],
    events: {
      5: (f, w) => {
        const tg = w.nearestEnemy(f, true);
        w.fx('flashring', f.x, f.y + 40, f.z, { color: '#ffe066' });
        if (tg) {
          f.x = clamp(tg.x - tg.facing * 48, w.bounds.min, w.bounds.max);
          f.z = tg.z;
          f.facing = sign(tg.x - f.x);
        } else {
          f.x += f.facing * 180;
        }
        w.fx('flashring', f.x, f.y + 40, f.z, { color: '#ffe066' });
        Sound.play('teleport');
      },
    },
    ai: { min: 220, max: 2000, z: 999 },
  },
  quake: {
    name: 'Terremoto', cost: 30, dur: 46, keys: [[0, 'raise'], [14, 'slam'], [40, 'slam'], [46, 'guard']],
    events: {
      16: (f, w) => {
        w.spawnProjectile(f, 'wave', { dir: 1, x: f.x + 30 });
        w.spawnProjectile(f, 'wave', { dir: -1, x: f.x - 30 });
        w.fx('dust', f.x, 0, f.z); w.fx('rocks', f.x, 0, f.z);
        w.shake = 12; Sound.play('boom');
      },
    },
    ai: { min: 0, max: 300, z: 30 },
  },
  bullCharge: {
    name: 'Investida do Touro', cost: 20, dur: 38, keepVel: true, sfx: 'whoosh',
    keys: [[0, 'charge'], [32, 'charge'], [38, 'guard']],
    update: (f, w, t) => {
      f.vx = t < 30 ? f.facing * 8 : f.vx * 0.75;
      if (t % 5 === 0 && t < 30) w.fx('dust', f.x - f.facing * 14, 0, f.z);
    },
    hit: { from: 4, to: 30, x: -6, w: 44, y: 50, h: 70, dmg: 50, knockdown: true, kvx: 8, kvy: 7, bdef: 80, heavy: true },
    ai: { min: 50, max: 300, z: 14 },
  },
  boulder: {
    name: 'Pedregulho', cost: 15, dur: 32, keys: [[0, 'throwWind'], [12, 'cast'], [26, 'cast'], [32, 'guard']],
    events: { 13: (f, w) => w.spawnProjectile(f, 'rock') },
    ai: { min: 120, max: 480, z: 14 },
  },
  shurikens: {
    name: 'Shurikens', cost: 12, dur: 26, keys: [[0, 'castWind'], [8, 'cast'], [20, 'cast'], [26, 'guard']],
    events: {
      9: (f, w) => { for (const vz of [-1.3, 0, 1.3]) w.spawnProjectile(f, 'shuriken', { vz }); },
    },
    ai: { min: 80, max: 600, z: 40 },
  },
  smokeBomb: {
    name: 'Bomba de Fumaça', cost: 18, dur: 26, invuln: 24, keys: [[0, 'crouch'], [20, 'crouch'], [26, 'guard']],
    events: {
      2: (f, w) => {
        w.fx('smoke', f.x, f.y + 30, f.z);
        f.invisible = 75;
        f.x = clamp(f.x + f.facing * 170, w.bounds.min, w.bounds.max);
        Sound.play('smoke');
      },
    },
    ai: { min: 0, max: 70, z: 30, escape: true },
  },
  tornadoKick: {
    name: 'Chute Tornado', cost: 18, dur: 34, keepVel: true, spin: 32, sfx: 'whoosh',
    keys: [[0, 'spin']],
    start: (f) => { f.vx = 0; },
    update: (f, w, t) => { if (t === 4) { f.vy = 8; f.y = 0.1; f.vx = f.facing * 4; } },
    hit: { from: 4, to: 28, rehit: 6, both: true, w: 40, y: 50, h: 60, dmg: 16, stun: 14, fall: 28, kvx: 3, kvy: 5 },
    ai: { min: 0, max: 60, z: 14 },
  },
};

const CHARACTERS = {
  kai: {
    name: 'Kai', title: 'Artista marcial', playable: true,
    desc: 'Equilibrado e disciplinado. Bom em tudo, ótimo para começar.',
    hp: 500, speed: 3.3, run: 7.2, jump: 12.5, power: 1, armor: 1, size: 1,
    look: { skin: '#f0c48f', hair: '#1d1b22', hairStyle: 'spiky', shirt: '#2d68c4', pants: '#ece8dc', shoes: '#2a2a2a', belt: '#1a1a1a', accent: '#ffcf3a', sleeves: true },
    specials: { 'D>A': SP.kiBlast, 'D^A': SP.dragonUpper, 'D>J': SP.rushPunch },
  },
  brasa: {
    name: 'Brasa', title: 'Mestre do fogo', playable: true,
    desc: 'Agressivo. Queima quem chega perto e controla o espaço com fogo.',
    hp: 510, speed: 3.4, run: 7.4, jump: 12.5, power: 1.08, armor: 1, size: 1,
    look: { skin: '#e6b07e', hair: '#e8401c', hairStyle: 'flame', shirt: '#b8261e', pants: '#3b2a20', shoes: '#1d1410', accent: '#ffb02e', gloves: '#2a1a14' },
    specials: { 'D>A': SP.fireball, 'D>J': SP.flameComet, 'DvJ': SP.flameRing },
  },
  neve: {
    name: 'Neve', title: 'Guardiã do gelo', playable: true,
    desc: 'Congela os adversários e pune quem fica parado.',
    hp: 490, speed: 3.2, run: 7, jump: 12.8, power: 1, armor: 1, size: 0.97,
    look: { skin: '#f6d9c4', hair: '#e8f4ff', hairStyle: 'long', shirt: '#6fb8ea', pants: '#284766', shoes: '#e8f4ff', accent: '#ffffff', sleeves: true, scarf: true },
    specials: { 'D>A': SP.iceBlast, 'DvA': SP.icePillars, 'D>J': SP.glacierSlide },
  },
  trovao: {
    name: 'Trovão', title: 'Velocista elétrico', playable: true,
    desc: 'O mais rápido. Raios de longe e teletransporte pelas costas.',
    hp: 470, speed: 3.8, run: 8.4, jump: 13, power: 1, armor: 0.97, size: 0.98,
    look: { skin: '#d8a070', hair: '#ffd23f', hairStyle: 'spiky', shirt: '#2a2a33', pants: '#4b3fae', shoes: '#ffd23f', accent: '#ffd23f', vest: true },
    specials: { 'D>A': SP.boltShot, 'D^A': SP.thunderStrike, 'DvJ': SP.teleport },
  },
  rocha: {
    name: 'Rocha', title: 'Colosso', playable: true,
    desc: 'Lento e enorme. Muita vida e golpes que derrubam qualquer um.',
    hp: 590, speed: 2.7, run: 6.2, jump: 11.5, power: 1.18, armor: 1.08, size: 1.18,
    look: { skin: '#a86b3c', hair: '#3a2416', hairStyle: 'bald', shirt: '#6d4c41', pants: '#3e5c2f', shoes: '#2b1d14', accent: '#c9a227', bulk: 1.35, belt: '#c9a227' },
    specials: { 'DvA': SP.quake, 'D>J': SP.bullCharge, 'D>A': SP.boulder },
  },
  sombra: {
    name: 'Sombra', title: 'Ninja', playable: true,
    desc: 'Furtivo. Shurikens, chute giratório e fuga na fumaça.',
    hp: 460, speed: 3.6, run: 8, jump: 13.5, power: 0.95, armor: 1, size: 0.97,
    look: { skin: '#e2b48c', hair: '#2a1d3a', hairStyle: 'mask', shirt: '#3b2a55', pants: '#2a1d3a', shoes: '#15101d', accent: '#d8323c', sleeves: true },
    specials: { 'D>A': SP.shurikens, 'DvJ': SP.smokeBomb, 'D^A': SP.tornadoKick },
  },
  bandit: {
    name: 'Capanga', title: 'Bandido', playable: false,
    hp: 170, speed: 2.9, run: 6.4, jump: 11.5, power: 0.75, armor: 1, size: 0.98,
    look: { skin: '#d9a57a', hair: '#3a2a20', hairStyle: 'bandana', shirt: '#6f7266', pants: '#45453a', shoes: '#262420', accent: '#9c2a24' },
    specials: {},
  },
  brute: {
    name: 'Brutamontes', title: 'Bandido', playable: false,
    hp: 300, speed: 2.6, run: 6, jump: 11, power: 1, armor: 1.05, size: 1.12,
    look: { skin: '#c48a5c', hair: '#1f1a16', hairStyle: 'mohawk', shirt: '#56633a', pants: '#3a3326', shoes: '#1f1a16', accent: '#9c2a24', bulk: 1.25 },
    specials: { 'D>A': Object.assign({}, SP.boulder, { cost: 30 }) },
  },
};

const PLAYABLE = Object.keys(CHARACTERS).filter((k) => CHARACTERS[k].playable);

function specialLabel(key) {
  return 'D ' + ({ '>': '→', '^': '↑', v: '↓' })[key[1]] + ' ' + key[2];
}
