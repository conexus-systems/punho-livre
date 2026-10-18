'use strict';
// Mundo da luta (entidades, colisões, câmera, HUD) e os modos de jogo.

class World {
  constructor(opt) {
    this.bg = BACKGROUNDS[opt.bg] || BACKGROUNDS.forest;
    this.stageW = opt.stageW || 1400;
    this.demo = !!opt.demo;
    this.dropItems = opt.dropItems !== false;
    this.fighters = []; this.projectiles = []; this.items = []; this.particles = [];
    this.cam = { x: 0 };
    this.camMin = 0; this.camMax = this.stageW - VIEW_W;
    this.bounds = { min: 20, max: this.stageW - 20 };
    this.frame = 0; this.shake = 0; this.flash = 0;
    this.banner = null; this.paused = false; this.pauseSel = 0; this.over = false;
    this.itemTimer = randi(500, 800);
    this.modeCtl = null;
  }

  setMode(m) { this.modeCtl = m; m.init(this); this.snapCamera(); }

  addFighter(key, o = {}) {
    const f = new Fighter(this, key, o);
    if (o.ai !== undefined && o.ai !== null) f.ai = new AIBrain(f, o.ai);
    this.fighters.push(f);
    return f;
  }

  spawnProjectile(owner, kind, o) {
    const p = new Projectile(this, owner, kind, o);
    this.projectiles.push(p);
    return p;
  }

  spawnItem(kind, x, z, y = 0) {
    const it = new Item(kind, x, z, y);
    this.items.push(it);
    return it;
  }

  randomItem(fromSky = true) {
    const r = Math.random();
    const kind = r < 0.3 ? 'bat' : r < 0.52 ? 'stone' : r < 0.78 ? 'milk' : 'juice';
    const lo = Math.max(this.bounds.min + 40, this.cam.x + 100), hi = Math.min(this.bounds.max - 40, this.cam.x + VIEW_W - 100);
    this.spawnItem(kind, rand(lo, Math.max(lo, hi)), rand(20, DEPTH - 20), fromSky ? 420 : 0);
  }

  nearestEnemy(f, visibleOnly) {
    let best = null, bd = 1e9;
    for (const g of this.fighters) {
      if (g === f || g.dead || g.gone || g.team === f.team) continue;
      if (visibleOnly && g.invisible > 0) continue;
      const d = Math.abs(g.x - f.x) + Math.abs(g.z - f.z) * 1.5 + (g.state === 'lying' ? 200 : 0);
      if (d < bd) { bd = d; best = g; }
    }
    return best;
  }

  fx(kind, x, y, z, o) { spawnFx(this, kind, x, y, z, o); }

  onDeath(f) {
    this.fx('text', f.x, f.y + f.height + 20, f.z, { text: 'K.O.', color: '#ffd84a', size: 26, life: 60 });
    if (this.modeCtl && this.modeCtl.onDeath) this.modeCtl.onDeath(this, f);
  }

  setBanner(title, sub = '', life = 120, color = '#ffd84a') {
    this.banner = { title, sub, life, t: 0, color };
  }

  // ---- atualização ----

  update() {
    if (this.paused) { this.updatePause(); return; }
    if (!this.demo && Keys.hit(['Escape', 'KeyP', 'T_pause'])) {
      this.paused = true; this.pauseSel = 0;
      Sound.play('menu');
      return;
    }
    this.frame++;
    for (const f of this.fighters) {
      if (this.over) clearInput(f.input);
      else if (f.player >= 0) readPlayer(f.player, f.input);
      else if (f.ai) f.ai.update(this);
    }
    for (const f of this.fighters) f.update();
    this.resolveMelee();
    for (const p of this.projectiles) p.update();
    this.resolveProjectiles();
    for (const it of this.items) it.update(this);
    this.resolveItems();
    for (const pa of this.particles) pa.update();

    this.projectiles = this.projectiles.filter((p) => !p.dead);
    this.items = this.items.filter((i) => !i.dead);
    this.particles = this.particles.filter((p) => !p.dead);
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
    this.fighters = this.fighters.filter((f) => !f.gone);

    if (this.dropItems && !this.over && --this.itemTimer <= 0) {
      if (this.items.filter((i) => !i.holder).length < 5) this.randomItem();
      this.itemTimer = randi(900, 1500);
    }
    if (this.modeCtl) this.modeCtl.update(this);
    this.updateCamera();
    if (this.shake > 0) { this.shake *= 0.85; if (this.shake < 0.5) this.shake = 0; }
    if (this.flash > 0) this.flash--;
    if (this.banner && ++this.banner.t > this.banner.life) this.banner = null;
  }

  updatePause() {
    if (anyMenu('up') || anyMenu('down')) { this.pauseSel = 1 - this.pauseSel; Sound.play('menu'); }
    if (Keys.hit(['Escape', 'KeyP', 'T_pause'])) { this.paused = false; return; }
    if (anyMenu('attack')) {
      Sound.play('select');
      if (this.pauseSel === 0) this.paused = false;
      else Game.toTitle();
    }
  }

  resolveMelee() {
    for (const f of this.fighters) {
      if (f.state !== 'move' || !f.move.hit) continue;
      const h = f.move.hit, t = f.moveT;
      if (t < h.from || t > h.to) continue;
      const s = f.size;
      let x1, x2;
      if (h.both) {
        x1 = f.x - h.w * s; x2 = f.x + h.w * s;
      } else {
        const a = f.x + f.facing * h.x * s, b = f.x + f.facing * (h.x + h.w) * s;
        x1 = Math.min(a, b); x2 = Math.max(a, b);
      }
      const y1 = f.y + (h.y - h.h / 2) * s, y2 = f.y + (h.y + h.h / 2) * s, zr = h.z || 15;
      for (const g of this.fighters) {
        if (g === f || g.team === f.team || g.dead) continue;
        if (g.hitLog.get(f.id) === f.swing) continue;
        if (Math.abs(g.z - f.z) > zr) continue;
        const gs = g.size, gx1 = g.x - 15 * gs, gx2 = g.x + 15 * gs, gy1 = g.y, gy2 = g.y + g.height;
        if (x2 < gx1 || x1 > gx2 || y2 < gy1 || y1 > gy2) continue;
        g.hitLog.set(f.id, f.swing);
        const dir = h.both ? sign(g.x - f.x) : f.facing;
        const res = g.receiveHit(h, f, dir);
        if (!res) continue;
        const hs = h.heavy ? 7 : 4;
        f.hitstop = Math.max(f.hitstop, res === 'block' ? 3 : hs);
        if (res === 'hit') {
          g.hitstop = Math.max(g.hitstop, hs);
          this.fx(h.heavy ? 'heavy' : 'spark', g.x - dir * 8 * gs, clamp((y1 + y2) / 2, gy1 + 10, gy2 - 10), g.z + 1);
          Sound.play(h.heavy ? 'heavy' : 'hit');
          if (h.heavy) this.shake = Math.max(this.shake, 5);
          f.mp = Math.min(f.maxMp, f.mp + 1.5);
        }
        if (f.move && f.move.weapon && f.holding && --f.holding.dur <= 0) f.holding.shatter(this);
      }
    }
  }

  resolveProjectiles() {
    const P = this.projectiles;
    // projéteis de times diferentes se anulam
    for (let i = 0; i < P.length; i++) {
      const a = P[i];
      if (a.dead || !a.d.solid || a.delay > 0) continue;
      for (let j = i + 1; j < P.length; j++) {
        const b = P[j];
        if (b.dead || !b.d.solid || b.team === a.team || b.delay > 0) continue;
        if (Math.abs(a.x - b.x) < a.r + b.r && Math.abs(a.z - b.z) < 16 && Math.abs(a.y - b.y) < 24) {
          a.explode(); b.explode();
          break;
        }
      }
    }
    for (const p of P) {
      if (p.dead || !p.active()) continue;
      const [py1, py2] = p.box();
      for (const g of this.fighters) {
        if (g.team === p.team || g.dead || p.hitSet.has(g.id)) continue;
        if (Math.abs(g.z - p.z) > (p.d.ground ? 20 : 14)) continue;
        if (Math.abs(g.x - p.x) > p.r + 14 * g.size) continue;
        if (py2 < g.y || py1 > g.y + g.height) continue;
        p.hitSet.add(g.id);
        const dir = p.vx ? sign(p.vx) : sign(g.x - p.x);
        const res = g.receiveHit(p.hit, p.owner, dir);
        if (!res) continue;
        if (res === 'hit') {
          g.hitstop = Math.max(g.hitstop, p.hit.heavy ? 6 : 3);
          Sound.play(p.hit.heavy ? 'heavy' : 'hit');
          if (p.hit.heavy) this.shake = Math.max(this.shake, 4);
        }
        if (!p.d.pierce) { p.explode(); break; }
      }
    }
  }

  resolveItems() {
    for (const it of this.items) {
      if (!it.thrown || it.dead) continue;
      for (const g of this.fighters) {
        if (g.team === it.team || g.dead || it.hitSet.has(g.id)) continue;
        if (Math.abs(g.z - it.z) > 16 || Math.abs(g.x - it.x) > 18 * g.size + 8) continue;
        if (it.y > g.y + g.height || it.y + 10 < g.y) continue;
        it.hitSet.add(g.id);
        const res = g.receiveHit(ITEM_DEFS[it.kind].throwHit, it.thrower, sign(it.vx));
        if (!res) continue;
        this.fx('heavy', it.x, it.y, it.z + 1);
        Sound.play('heavy');
        it.vx = -it.vx * 0.25; it.vy = 4; it.thrown = false;
        it.dur -= 3;
        if (it.dur <= 0) it.shatter(this);
        break;
      }
    }
  }

  snapCamera() {
    this.updateCamera();
    this.cam.x = this.camTarget();
  }

  camTarget() {
    let focus = this.fighters.filter((f) => f.player >= 0 && !f.dead);
    if (!focus.length) focus = this.fighters.filter((f) => f.player >= 0);
    if (!focus.length) focus = this.fighters.filter((f) => !f.dead);
    if (!focus.length) return this.cam.x;
    const avg = focus.reduce((s, f) => s + f.x, 0) / focus.length;
    return clamp(avg - VIEW_W / 2, this.camMin, Math.max(this.camMin, this.camMax));
  }

  updateCamera() {
    this.cam.x += (this.camTarget() - this.cam.x) * 0.12;
  }

  // ---- desenho ----

  draw(ctx) {
    ctx.save();
    if (this.shake > 0) ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake) * 0.6);
    const cam = { x: Math.round(this.cam.x) };
    this.bg.draw(ctx, cam.x, this.frame);

    // sombras
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    for (const f of this.fighters) {
      const k = 1 - Math.min(f.y, 240) / 400, r = 20 * f.size * k;
      ctx.globalAlpha = f.invisible > 0 ? 0.2 : 1;
      ctx.beginPath(); ctx.ellipse(f.x - cam.x, FLOOR_Y + f.z, r, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const it of this.items) {
      if (it.holder) continue;
      ctx.beginPath(); ctx.ellipse(it.x - cam.x, FLOOR_Y + it.z, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
    }
    for (const p of this.projectiles) {
      if (p.d.ground || p.delay > 0) continue;
      ctx.beginPath(); ctx.ellipse(p.x - cam.x, FLOOR_Y + p.z, p.r, p.r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    }

    for (const pa of this.particles) if (pa.layer === 0) pa.draw(ctx, cam);
    const ents = [];
    for (const f of this.fighters) ents.push(f);
    for (const it of this.items) if (!it.holder) ents.push(it);
    for (const p of this.projectiles) ents.push(p);
    ents.sort((a, b) => a.z - b.z || a.y - b.y);
    for (const e of ents) e.draw(ctx, cam);
    for (const pa of this.particles) if (pa.layer !== 0) pa.draw(ctx, cam);
    ctx.restore();

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,250,220,${this.flash / 10})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (this.demo) return;
    this.drawTags(ctx, cam);
    drawHUD(ctx, this);
    if (this.modeCtl && this.modeCtl.drawOverlay) this.modeCtl.drawOverlay(ctx, this);
    if (this.banner) drawBanner(ctx, this.banner);
    if (this.paused) drawPause(ctx, this);
  }

  drawTags(ctx, cam) {
    for (const f of this.fighters) {
      if (f.dead || f.invisible > 0) continue;
      let label = null, color = null;
      if (f.player >= 0) { label = `${f.player + 1}P`; color = PLAYER_COLORS[f.player]; }
      else if (f.boss) { label = 'CHEFE'; color = '#ffd84a'; }
      if (!label) continue;
      const sx = f.x - cam.x, sy = FLOOR_Y + f.z - f.y - f.height - 30;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(sx - 5, sy + 6); ctx.lineTo(sx + 5, sy + 6); ctx.lineTo(sx, sy + 12); ctx.closePath(); ctx.fill();
      txt(ctx, label, sx, sy + 2, { size: 13, font: FONT_DISPLAY, align: 'center', color, stroke: '#14121c', strokeW: 3 });
    }
  }

  hudList() {
    const h = this.fighters.filter((f) => f.player >= 0).sort((a, b) => a.player - b.player);
    const o = this.fighters.filter((f) => f.player < 0).sort((a, b) => (a.dead - b.dead) || (b.boss - a.boss) || (a.id - b.id));
    return h.concat(o).slice(0, 8);
  }
}

// ---- HUD ----

function drawHUD(ctx, w) {
  const list = w.hudList();
  if (!list.length) return;
  const PW = 234, PH = 40, rows = Math.ceil(list.length / 4);
  ctx.fillStyle = 'rgba(10,12,28,0.72)';
  ctx.fillRect(0, 0, VIEW_W, rows * (PH + 4) + 6);
  list.forEach((f, i) => {
    const x = 6 + (i % 4) * (PW + 4), y = 4 + ((i / 4) | 0) * (PH + 4);
    ctx.fillStyle = 'rgba(30,34,64,0.9)';
    ctx.fillRect(x, y, PW, PH);
    const tc = f.player >= 0 ? PLAYER_COLORS[f.player] : f.team <= 4 ? TEAM_COLORS[f.team] : f.boss ? '#ffd84a' : '#8f93a8';
    ctx.fillStyle = tc;
    ctx.fillRect(x, y, 3, PH);
    ctx.drawImage(portrait(f.key, 34), x + 6, y + 3);
    const label = f.player >= 0 ? `${f.player + 1}P` : f.boss ? 'CHEFE' : 'COM';
    txt(ctx, f.name.toUpperCase(), x + 46, y + 13, { size: 12, weight: 700, color: '#eef0ff' });
    txt(ctx, label, x + PW - 6, y + 13, { size: 11, weight: 700, color: tc, align: 'right' });
    const bw = PW - 52;
    ctx.fillStyle = '#3a0f14'; ctx.fillRect(x + 46, y + 17, bw, 10);
    const hp = Math.max(0, f.hp / f.maxHp);
    ctx.fillStyle = hp > 0.3 ? '#e8414a' : (w.frame % 20 < 10 ? '#ff7a5a' : '#e8414a');
    ctx.fillRect(x + 46, y + 17, bw * hp, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x + 46, y + 17, bw * hp, 3);
    ctx.fillStyle = '#0d1a3a'; ctx.fillRect(x + 46, y + 30, bw, 6);
    ctx.fillStyle = '#3e8ef0'; ctx.fillRect(x + 46, y + 30, bw * (f.mp / f.maxMp), 6);
    if (f.dead) {
      ctx.fillStyle = 'rgba(10,10,20,0.6)'; ctx.fillRect(x, y, PW, PH);
      txt(ctx, 'K.O.', x + PW / 2, y + 28, { size: 18, font: FONT_DISPLAY, align: 'center', color: '#ffd84a' });
    }
  });
}

function drawBanner(ctx, b) {
  const k = b.t / b.life;
  const slide = b.t < 10 ? (1 - b.t / 10) * 300 : 0;
  const alpha = k > 0.85 ? (1 - k) / 0.15 : 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(10,12,28,0.6)';
  ctx.fillRect(0, 205, VIEW_W, b.sub ? 100 : 76);
  txt(ctx, b.title, VIEW_W / 2 + slide, 262, { size: 46, font: FONT_DISPLAY, align: 'center', color: b.color, stroke: '#14121c', strokeW: 7 });
  if (b.sub) txt(ctx, b.sub, VIEW_W / 2 - slide, 292, { size: 20, weight: 700, align: 'center', color: '#eef0ff' });
  ctx.restore();
}

function drawPause(ctx, w) {
  ctx.fillStyle = 'rgba(8,10,24,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  txt(ctx, 'PAUSA', VIEW_W / 2, 200, { size: 54, font: FONT_DISPLAY, align: 'center', color: '#ffd84a', stroke: '#14121c', strokeW: 6 });
  ['Continuar', 'Sair para o menu'].forEach((s, i) => {
    const sel = i === w.pauseSel;
    txt(ctx, (sel ? '▶ ' : '') + s, VIEW_W / 2, 270 + i * 42, { size: 26, weight: 700, align: 'center', color: sel ? '#ffffff' : '#8f93b8' });
  });
  txt(ctx, 'Esc ou P volta para a luta', VIEW_W / 2, 400, { size: 15, align: 'center', color: '#8f93b8' });
}

// ---- modos de jogo ----

function teamLabel(fs) {
  const f = fs[0];
  if (fs.length === 1) return f.player >= 0 ? `${f.player + 1}P VENCEU!` : `${f.name.toUpperCase()} VENCEU!`;
  if (f.team <= 4) return `${TEAM_NAMES[f.team].toUpperCase()} VENCEU!`;
  return 'VITÓRIA!';
}

class VSMode {
  constructor(setup, onEnd) {
    this.setup = setup; this.onEnd = onEnd;
    this.done = false; this.endT = 0;
  }

  init(w) {
    this.setup.forEach((s, i) => {
      const left = i % 2 === 0;
      const x = left ? 220 + (i >> 1) * 90 : w.stageW - 220 - (i >> 1) * 90;
      const z = 30 + ((i * 61) % (DEPTH - 60));
      w.addFighter(s.key, { team: s.team, player: s.player, ai: s.ai, x, z, facing: left ? 1 : -1, name: s.name });
    });
    if (!w.demo) { w.setBanner('LUTEM!', '', 80); Sound.play('go'); }
  }

  update(w) {
    if (this.done) {
      if (++this.endT === 210) this.onEnd(w, this.result);
      return;
    }
    const alive = w.fighters.filter((f) => !f.dead);
    const teams = new Set(alive.map((f) => f.team));
    if (teams.size > 1) return;
    this.done = true;
    w.over = true;
    alive.forEach((f) => { f.victory = true; });
    const humanWon = alive.some((f) => f.player >= 0);
    const anyHuman = w.fighters.some((f) => f.player >= 0);
    const title = alive.length ? teamLabel(alive) : 'EMPATE';
    if (!w.demo) {
      w.setBanner(title, '', 200);
      Sound.play(!anyHuman || humanWon ? 'win' : 'lose');
    }
    this.result = { mode: 'vs', title, winners: alive, fighters: w.fighters.slice() };
  }
}

const SEG_W = 1150;

class StoryMode {
  constructor(humans, diff) {
    this.humans = humans; this.diff = diff;
    this.stageIdx = 0; this.over = false; this.overT = 0; this.cleared = false; this.clearT = 0;
  }

  init(w) {
    this.w = w;
    this.heroes = this.humans.map((h, i) => w.addFighter(h.key, { team: 1, player: h.player, x: 140, z: 70 + i * 60, facing: 1 }));
    this.loadStage(0);
  }

  loadStage(i) {
    const w = this.w, st = STORY[i];
    this.stageIdx = i; this.cleared = false; this.clearT = 0;
    w.bg = BACKGROUNDS[st.bg];
    w.stageW = st.phases.length * SEG_W;
    w.fighters = w.fighters.filter((f) => f.team === 1);
    w.projectiles = []; w.items = []; w.particles = [];
    this.heroes.forEach((f, k) => {
      if (f.dead) { f.dead = false; f.hp = Math.round(f.maxHp * 0.4); }
      else if (i > 0) f.hp = Math.min(f.maxHp, f.hp + Math.round(f.maxHp * 0.4));
      f.mp = Math.max(f.mp, 50);
      f.x = 140 + k * 40; f.z = 70 + k * 60; f.y = 0; f.vx = f.vy = f.vz = 0;
      f.facing = 1; f.holding = null; f.burn = 0; f.shock = 0;
      f.setState('idle');
      f.invuln = 60;
    });
    this.startPhase(0);
    w.cam.x = 0;
    w.setBanner(`FASE ${i + 1}`, st.name, 150);
    Sound.play('go');
  }

  startPhase(p) {
    const w = this.w;
    this.phase = p;
    this.queue = STORY[this.stageIdx].phases[p].slice();
    this.locked = true; this.goArrow = false; this.spawnT = 40;
    const s = p * SEG_W;
    w.camMin = s; w.camMax = s + SEG_W - VIEW_W;
    w.bounds = { min: s + 20, max: s + SEG_W - 20 };
    if (Math.random() < 0.7) w.randomItem();
  }

  aiLevel(boss) {
    return clamp(this.diff + (boss ? 0 : -1) + Math.floor(this.stageIdx / 2), 0, 2);
  }

  spawnEnemy(spec) {
    const w = this.w;
    const boss = spec[0] === '!';
    const key = boss ? spec.slice(1) : spec;
    const fromLeft = this.phase > 0 && Math.random() < 0.35;
    const x = fromLeft ? w.cam.x - 50 : w.cam.x + VIEW_W + 50;
    const f = w.addFighter(key, {
      team: 9, ai: this.aiLevel(boss), x, z: rand(10, DEPTH - 10), facing: fromLeft ? 1 : -1,
      boss, fades: true, hpMul: boss ? 1.25 + this.diff * 0.15 : 0.85 + this.diff * 0.15, mp: boss ? 80 : 30,
    });
    f.entering = true;
    if (boss) w.setBanner(`CHEFE: ${f.name.toUpperCase()}`, CHARACTERS[key].title, 110, '#ff8a5a');
  }

  update(w) {
    const heroesAlive = this.heroes.filter((f) => !f.dead);
    if (this.over) {
      if (++this.overT === 220) Game.finishBattle(w, this.result());
      return;
    }
    if (!heroesAlive.length) {
      this.over = true; w.over = true;
      w.setBanner('GAME OVER', STORY[this.stageIdx].name, 220, '#ff5a4e');
      Sound.play('lose');
      return;
    }
    for (const e of w.fighters) if (e.team !== 1 && e.dead && e.deadT > 100) e.gone = true;

    if (this.cleared) {
      if (++this.clearT === 210) {
        if (this.stageIdx + 1 < STORY.length) this.loadStage(this.stageIdx + 1);
        else {
          this.over = true; this.won = true; this.overT = 100; w.over = true;
          this.heroes.forEach((f) => { if (!f.dead) f.victory = true; });
          w.setBanner('CAMPANHA CONCLUÍDA!', 'Você derrotou todos os chefes', 220);
          Sound.play('win');
        }
      }
      return;
    }

    const enemies = w.fighters.filter((f) => f.team !== 1 && !f.dead);
    if (this.locked) {
      if (this.queue.length && enemies.length < 4 && --this.spawnT <= 0) {
        this.spawnEnemy(this.queue.shift());
        this.spawnT = 55;
      }
      if (!this.queue.length && !enemies.length) {
        if (this.phase === STORY[this.stageIdx].phases.length - 1) {
          this.cleared = true;
          w.setBanner('FASE CONCLUÍDA!', '', 200);
          Sound.play('win');
        } else {
          this.locked = false; this.goArrow = true;
          const next = (this.phase + 2) * SEG_W;
          w.bounds.max = next - 20; w.camMax = next - VIEW_W;
          Sound.play('go');
        }
      }
    } else if (heroesAlive.some((f) => f.x > (this.phase + 1) * SEG_W + 140)) {
      this.startPhase(this.phase + 1);
    }
  }

  result() {
    return {
      mode: 'story', fighters: this.heroes,
      title: this.won ? 'CAMPANHA CONCLUÍDA!' : 'GAME OVER',
      sub: this.won ? 'Todas as 5 fases vencidas' : `Chegou até a fase ${this.stageIdx + 1}: ${STORY[this.stageIdx].name}`,
      won: !!this.won,
    };
  }

  drawOverlay(ctx, w) {
    txt(ctx, `FASE ${this.stageIdx + 1} · ${STORY[this.stageIdx].name}`, 12, VIEW_H - 12, { size: 14, weight: 700, color: '#ffffff', stroke: '#14121c', strokeW: 3 });
    if (this.goArrow && w.frame % 40 < 26) {
      txt(ctx, 'AVANCE ➜', VIEW_W - 24, 250, { size: 34, font: FONT_DISPLAY, align: 'right', color: '#ffd84a', stroke: '#14121c', strokeW: 6 });
    }
  }
}

class SurvivalMode {
  constructor(humans, diff) {
    this.humans = humans; this.diff = diff;
    this.wave = 0; this.next = 90; this.queue = []; this.over = false; this.overT = 0; this.spawnT = 0;
  }

  init(w) {
    this.w = w;
    this.heroes = this.humans.map((h, i) => w.addFighter(h.key, { team: 1, player: h.player, x: w.stageW / 2 - 40 + i * 80, z: 80 + i * 40, facing: 1 }));
  }

  startWave() {
    const w = this.w, n = ++this.wave;
    const q = [];
    const count = 1 + Math.ceil(n * 0.9);
    for (let i = 0; i < count; i++) q.push(i < Math.floor(n / 3) ? 'brute' : 'bandit');
    if (n % 5 === 0) q.push('!' + choice(PLAYABLE));
    this.queue = q.sort(() => Math.random() - 0.5);
    this.spawnT = 20;
    this.heroes.forEach((f) => { if (!f.dead) f.hp = Math.min(f.maxHp, f.hp + Math.round(f.maxHp * 0.12)); });
    w.setBanner(`ONDA ${n}`, n % 5 === 0 ? 'Um chefe se aproxima!' : '', 100);
    Sound.play('go');
    if (Math.random() < 0.6) w.randomItem();
  }

  update(w) {
    if (this.over) {
      if (++this.overT === 220) Game.finishBattle(w, this.result());
      return;
    }
    if (!this.heroes.some((f) => !f.dead)) {
      this.over = true; w.over = true;
      w.setBanner('FIM DE JOGO', `Você sobreviveu a ${this.wave - 1} onda(s)`, 220, '#ff5a4e');
      Sound.play('lose');
      return;
    }
    for (const e of w.fighters) if (e.team !== 1 && e.dead && e.deadT > 100) e.gone = true;
    const enemies = w.fighters.filter((f) => f.team !== 1 && !f.dead);
    if (!this.queue.length && !enemies.length) {
      if (--this.next <= 0) { this.startWave(); this.next = 120; }
      return;
    }
    if (this.queue.length && enemies.length < 5 && --this.spawnT <= 0) {
      const spec = this.queue.shift(), boss = spec[0] === '!', key = boss ? spec.slice(1) : spec;
      const fromLeft = Math.random() < 0.5;
      const lvl = clamp(this.diff - 1 + Math.floor((this.wave - 1) / 4), 0, 2);
      const f = w.addFighter(key, {
        team: 9, ai: lvl, x: fromLeft ? w.cam.x - 50 : w.cam.x + VIEW_W + 50, z: rand(10, DEPTH - 10),
        facing: fromLeft ? 1 : -1, boss, fades: true, hpMul: boss ? 1.2 : 0.8 + Math.min(this.wave, 15) * 0.04,
      });
      f.entering = true;
      this.spawnT = 45;
    }
  }

  result() {
    return {
      mode: 'survival', fighters: this.heroes, title: 'FIM DE JOGO',
      sub: `Ondas vencidas: ${Math.max(0, this.wave - 1)}`, won: false,
    };
  }

  drawOverlay(ctx) {
    txt(ctx, `ONDA ${this.wave}`, 12, VIEW_H - 12, { size: 16, font: FONT_DISPLAY, color: '#ffd84a', stroke: '#14121c', strokeW: 4 });
  }
}
