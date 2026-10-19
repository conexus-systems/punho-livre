'use strict';
// Monta, por código, todos os dados que o motor usa: lutadores (quadros e folhas
// de sprites), ataques especiais, armas, efeitos e cenários.

const Content = {
  // images: mapa caminho -> canvas, preenchido aqui. Devolve { objects, backgrounds, properties }.
  build(images, onProgress) {
    const objects = [], properties = {};
    const steps = ROSTER.length + 4;
    let done = 0;
    const tick = () => { done++; if (onProgress) onProgress(done / steps); return new Promise((r) => setTimeout(r, 0)); };
    nextBallId = 200;

    let chain = Promise.resolve();
    for (const def of ROSTER) {
      chain = chain.then(() => {
        const B = new FighterBuilder(def);
        buildMoveset(B);
        const key = `gen/fighter${def.id}`;
        const sheet = renderFighterSheet(B, def.look);
        images[key] = sheet;
        images[key + '_head'] = portraitCanvas(def, 120);
        images[key + '_small'] = smallCanvas(def);
        const s = def.stats, sp = s.speed || 1, jp = s.jump || 1;
        const bmp = {
          ...BASE_STATS, name: def.name, head: key + '_head', small: key + '_small',
          file: [{ file: key, w: CELL - 1, h: CELL - 1, row: 10, col: Math.ceil(B.poses.length / 10) }],
          walking_speed: BASE_STATS.walking_speed * sp, running_speed: BASE_STATS.running_speed * sp,
          jump_height: BASE_STATS.jump_height * jp, jump_distance: BASE_STATS.jump_distance * sp,
          dash_distance: BASE_STATS.dash_distance * sp,
        };
        objects.push({ id: def.id, type: 'character', name: def.name, data: { bmp, frame: B.frame } });
        properties[def.id] = { hp: s.hp || 500 };
        for (const b of B.objects) {
          objects.push(buildBall(b, images));
          properties[b.id] = { zwidth: 10, shatter: !!b.ball.broken };
        }
        return tick();
      });
    }
    return chain.then(() => {
      for (const w of WEAPONS) {
        objects.push(w.type === 'heavyweapon' ? buildHeavyWeapon(w, images) : buildLightWeapon(w, images));
        properties[w.id] = w.type === 'heavyweapon' ? {} : { attackable: true, stand_throw: true, run_throw: true, jump_throw: true };
      }
      return tick();
    }).then(() => {
      objects.push(buildSpark(300, '#fff27a', images), buildSpark(301, '#ff8a8a', images), buildBroken(images));
      return tick();
    }).then(() => {
      const backgrounds = SCENES.map((sc) => buildScene(sc, images));
      return tick().then(() => ({ objects, backgrounds, properties }));
    }).then((data) => tick().then(() => data));
  },
};

// ---- lutadores ----

function renderFighterSheet(B, look) {
  const cols = 10, rows = Math.ceil(B.poses.length / cols);
  const c = makeCanvas(cols * CELL, rows * CELL), ctx = c.getContext('2d');
  B.poses.forEach((pose, i) => {
    const x0 = (i % cols) * CELL, y0 = Math.floor(i / cols) * CELL;
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, y0, CELL - 1, CELL - 1); ctx.clip();
    if (pose.glow) glow(ctx, x0 + CX, y0 + BASE - 35, 42, rgba(pose.glow, 0.55), 0.4);
    if (pose.frost) {
      for (let k = 0; k < 7; k++) {
        const x = x0 + 6 + k * 14, h = 10 + ((k * 7 + pose.frost * 5) % 13);
        blob(ctx, [[x - 5, y0 + BASE], [x, y0 + BASE - h], [x + 5, y0 + BASE]], '#bff0ff', 0.7);
      }
    }
    const J = drawPoseCell(ctx, look, pose, x0, y0, CELL, BASE);
    if (pose.fire !== undefined) {
      for (const k of ['chest', 'kf', 'head', 'hb']) drawFlame(ctx, J[k][0], J[k][1] + 6, pose.fire + k.length, 0.9);
    }
    if (pose.ice) drawIceBlock(ctx, x0 + CX - 30, y0 + 8, 60, BASE - 8);
    ctx.restore();
  });
  return c;
}

function portraitCanvas(def, size) {
  const c = makeCanvas(size, size);
  drawPortrait(c.getContext('2d'), def.look, 0, 0, size, def.color);
  return c;
}

function smallCanvas(def) {
  const c = makeCanvas(40, 45), ctx = c.getContext('2d');
  drawPortrait(ctx, def.look, -2, 0, 45, def.color);
  return c;
}

// ---- ataques especiais ----

function buildBall(entry, images) {
  const o = entry.ball, wave = o.style === 'wave';
  const K = { fire: 1.75, orb: 1.55, shard: 1.45, star: 1.3, wave: 1.3 }[o.style] || 1.5;
  const W = 130, H = wave ? 76 : 80, cx = 88, cy = wave ? H - 20 : 40;
  const c = makeCanvas(W * 10, H), ctx = c.getContext('2d');
  for (let i = 0; i < 10; i++) {
    ctx.save(); ctx.beginPath(); ctx.rect(i * W, 0, W - 1, H - 1); ctx.clip();
    ctx.translate(i * W + cx, cy); ctx.scale(K, K);
    if (i < 4) drawOrb(ctx, 0, 0, o.color, i, o.style);
    else if (i < 8) drawEnergyBurst(ctx, 0, 0, o.color, i - 4, o.style === 'star' ? 0.7 : 1.1);
    ctx.restore();
  }
  const key = `gen/ball${entry.id}`;
  images[key] = c;
  const r = (v) => Math.round(v * K);
  const box = wave ? { x: cx - r(30), y: cy - r(22), w: r(44), h: r(32) } : { x: cx - r(15), y: cy - r(10), w: r(28), h: r(20) };
  const itr = { kind: 0, ...box, injury: o.injury, dvx: 7, fall: o.fall, arest: 6, bdefend: 12, effect: o.effect };
  if (wave) { itr.dvy = -8; itr.vrest = 15; delete itr.arest; }
  const frame = {};
  const F = (n, f) => { frame[n] = { name: '', centerx: cx, centery: cy, wait: 1, ...f }; };
  for (let i = 0; i < 4; i++) {
    F(i, {
      state: 3000, pic: i, next: i < 3 ? i + 1 : 0, dvx: o.chase ? 3 : o.speed, itr, bdy: { kind: 0, ...box },
      hit_d: 40, hit_a: o.chase ? 4 : wave ? 14 : 0, hit_Fa: o.chase ? 1 : 0,
    });
  }
  for (let i = 0; i < 4; i++) {
    F(10 + i, { state: 3001, pic: 4 + i, next: i < 3 ? 11 + i : 1000 });
    F(20 + i, { state: 3002, pic: 4 + i, next: i < 3 ? 21 + i : 1000 });
  }
  F(30, { state: 3003, pic: 4, next: 31 });
  F(31, { state: 3003, pic: 5, next: 32, opoint: { kind: 1, x: cx, y: cy, action: 0, dvx: 0, dvy: 0, oid: entry.id, facing: 1 } });
  F(32, { state: 3003, pic: 6, next: 1000 });
  for (let i = 0; i < 3; i++) F(40 + i, { state: 3004, pic: 5 + i, next: i < 2 ? 41 + i : 1000 });
  const snd = o.effect === 30 ? 'freeze' : o.effect === 20 ? 'fire' : 'boom';
  const bmp = { name: '', file: [{ file: key, w: W - 1, h: H - 1, row: 10, col: 1 }], weapon_hit_sound: snd, weapon_drop_sound: snd, weapon_broken_sound: snd };
  return { id: entry.id, type: 'specialattack', name: '', data: { bmp, frame } };
}

// ---- armas ----

function buildLightWeapon(w, images) {
  const S = 48, c = makeCanvas(S * 17, S), ctx = c.getContext('2d');
  for (let k = 0; k < 16; k++) {
    ctx.save(); ctx.beginPath(); ctx.rect(k * S, 0, S - 1, S - 1); ctx.clip();
    drawWeapon(ctx, w.kind, k * S + 24, 24, weaponAngle(k));
    ctx.restore();
  }
  drawWeapon(ctx, w.kind, 16 * S + 20, 38, 90);
  const key = `gen/weapon${w.id}`;
  images[key] = c;
  const s = w.strength || 1;
  const shaft = (k) => {
    const tip = along([24, 24], weaponAngle(k), 20), base = along([24, 24], weaponAngle(k) + 180, 4);
    const b = boxAround([tip, base], 4);
    return { kind: 5, x: b.x, y: b.y, w: b.w, h: b.h, fall: 20, bdefend: 16 };
  };
  const frame = {};
  const F = (n, f) => { frame[n] = { name: '', centerx: 24, centery: 40, wait: 0, ...f }; };
  for (let k = 0; k < 16; k++) F(k, { state: 1000, pic: k, next: k < 15 ? k + 1 : 999, bdy: { kind: 0, x: 8, y: 8, w: 32, h: 32 } });
  for (let k = 0; k < 16; k++) F(20 + k, { state: 1001, pic: k, next: 0, itr: shaft(k), wpoint: { kind: 2, x: 24, y: 24, weaponact: 0, attacking: 0, cover: 0 } });
  const thrown = { kind: 0, x: 6, y: 6, w: 36, h: 36, dvx: 8, fall: 70, bdefend: 16, injury: Math.round(45 * s) };
  for (let k = 0; k < 16; k++) F(40 + k, { state: 1002, pic: (k * 2) % 16, next: k < 15 ? 41 + k : 40, itr: thrown, bdy: { kind: 0, x: 6, y: 6, w: 36, h: 36 } });
  const lying = { kind: 0, x: 2, y: 30, w: 44, h: 14 };
  F(60, { state: 1003, pic: 16, wait: 1, next: 61, sound: w.kind === 'pipe' ? 'clank' : 'wood' });
  F(61, { state: 1003, pic: 16, wait: 2, next: 62 });
  F(62, { state: 1003, pic: 16, wait: 2, next: 63 });
  F(63, { state: 1003, pic: 16, wait: 1, next: 64 });
  F(64, { state: 1004, pic: 16, next: 0, bdy: lying });
  F(70, { state: 1003, pic: 16, wait: 1, next: 71, sound: w.kind === 'pipe' ? 'clank' : 'wood' });
  F(71, { state: 1003, pic: 16, wait: 2, next: 72 });
  F(72, { state: 1003, pic: 16, wait: 2, next: 64 });
  const st = (o) => ({ bdefend: 16, vrest: 10, ...o, injury: Math.round(o.injury * s) });
  const data = {
    bmp: {
      name: w.name, file: [{ file: key, w: S - 1, h: S - 1, row: 17, col: 1 }], weapon_hp: w.hp, weapon_drop_hurt: 35,
      weapon_hit_sound: w.kind === 'pipe' ? 'clank' : 'wood', weapon_drop_sound: w.kind === 'pipe' ? 'clank' : 'wood', weapon_broken_sound: 'break',
    },
    weapon_strength_list: {
      1: st({ dvx: 3, fall: 40, injury: 32 }), 2: st({ dvx: 7, fall: 70, injury: 36 }),
      3: st({ dvx: 10, fall: 70, injury: 44 }), 4: st({ dvx: 12, fall: 70, injury: 48 }),
    },
    frame,
  };
  return { id: w.id, type: w.type, name: w.name, data };
}

function buildHeavyWeapon(w, images) {
  const S = 64, c = makeCanvas(S * 4, S), ctx = c.getContext('2d');
  for (let k = 0; k < 4; k++) {
    ctx.save(); ctx.beginPath(); ctx.rect(k * S, 0, S - 1, S - 1); ctx.clip();
    ctx.translate(k * S + 32, 44); ctx.rotate((k * Math.PI) / 4); ctx.translate(-32, -44);
    drawWeapon(ctx, w.kind, 32, 44, 0);
    ctx.restore();
  }
  const key = `gen/weapon${w.id}`;
  images[key] = c;
  const frame = {};
  const F = (n, f) => { frame[n] = { name: '', centerx: 32, centery: 60, wait: 0, ...f }; };
  const box = { x: 15, y: 27, w: 34, h: 34 };
  const hitI = { kind: 0, ...box, dvx: 5, dvy: -7, fall: 70, vrest: 17, bdefend: 30, injury: w.kind === 'stone' ? 60 : 45 };
  [0, 1, 2, 3, 2, 1].forEach((p, i) => F(i, { state: 2000, pic: p, wait: 2, next: i < 5 ? i + 1 : 999, itr: hitI, bdy: { kind: 0, ...box } }));
  F(10, { state: 2001, pic: 0, next: 0, wpoint: { kind: 2, x: 32, y: 60, weaponact: 0, attacking: 0, cover: 0 } });
  F(20, { state: 2004, pic: 0, next: 0, itr: { kind: 14, x: 20, y: 36, w: 24, h: 22, vrest: 1 }, bdy: { kind: 0, ...box } });
  F(21, { state: 2000, pic: 0, wait: 1, next: 999, itr: hitI });
  const snd = w.kind === 'stone' ? 'thud' : 'wood';
  const data = {
    bmp: {
      name: w.name, file: [{ file: key, w: S - 1, h: S - 1, row: 4, col: 1 }], weapon_hp: w.hp, weapon_drop_hurt: 120,
      weapon_hit_sound: snd, weapon_drop_sound: snd, weapon_broken_sound: 'break',
    },
    frame,
  };
  return { id: w.id, type: w.type, name: w.name, data };
}

// ---- efeitos ----

function buildSpark(id, color, images) {
  const S = 80, c = makeCanvas(S * 10, S), ctx = c.getContext('2d');
  for (let i = 0; i < 10; i++) {
    ctx.save(); ctx.beginPath(); ctx.rect(i * S, 0, S - 1, S - 1); ctx.clip();
    drawSpark(ctx, i * S + 40, 40, i % 5, i < 5, color);
    ctx.restore();
  }
  const key = `gen/effect${id}`;
  images[key] = c;
  const frame = {};
  for (let i = 0; i < 5; i++) {
    frame[i] = { name: 'big', pic: i, wait: 0, next: i < 4 ? i + 1 : 1000, centerx: 40, centery: 40, sound: i === 0 ? 'hit2' : undefined };
    frame[10 + i] = { name: 'small', pic: 5 + i, wait: 0, next: i < 4 ? 11 + i : 1000, centerx: 40, centery: 40, sound: i === 0 ? 'hit' : undefined };
  }
  return {
    id, type: 'effect', name: '',
    data: { bmp: { name: '', file: [{ file: key, w: S - 1, h: S - 1, row: 10, col: 1 }] }, frame, effect_list: [{ name: 'small', frame: 10 }, { name: 'big', frame: 0 }] },
  };
}

// pedaços de armas quebradas, fagulhas de fogo e cacos de gelo
function buildBroken(images) {
  const S = 28, kinds = [
    { id: 150, first: 0, col: '#8d8d94' }, { id: 100, first: 10, col: '#c88a4a' }, { id: 101, first: 20, col: '#9aa4b2' },
    { id: 151, first: 40, col: '#b9803f' }, { id: 302, first: 60, col: 'fire' }, { id: 212, first: 70, col: '#bff0ff' },
  ];
  const c = makeCanvas(S * 10, S * 8), ctx = c.getContext('2d');
  const frame = {}, list = [];
  kinds.forEach((k, row) => {
    for (let i = 0; i < 8; i++) {
      const x = i * S + 14, y = row * S + 14;
      ctx.save(); ctx.beginPath(); ctx.rect(i * S, row * S, S - 1, S - 1); ctx.clip();
      if (k.col === 'fire') drawFlame(ctx, x, y + 8, i, 0.6);
      else {
        ctx.translate(x, y); ctx.rotate((i * Math.PI) / 4);
        const r = i < 4 ? 6 : 4;
        blob(ctx, [[-r, -r * 0.6], [r * 0.4, -r], [r, r * 0.3], [-r * 0.2, r]], k.col, 0.8);
      }
      ctx.restore();
      const n = k.first + i, pic = row * 10 + i;
      const fire = k.col === 'fire';
      frame[n] = { name: '', state: 9999, pic, wait: 2, centerx: 14, centery: fire ? 22 : 14,
        next: fire ? (i % 4 < 3 ? n + 1 : 1000) : (i % 4 < 3 ? n + 1 : n - 3) };
    }
    list.push({ id: k.id, frame: k.first }, { id: k.id, frame: k.first + 4 });
  });
  images['gen/broken'] = c;
  return { id: 320, type: 'broken', name: '', data: { bmp: { name: '', file: [{ file: 'gen/broken', w: S - 1, h: S - 1, row: 10, col: 8 }] }, frame, broken_list: list } };
}
