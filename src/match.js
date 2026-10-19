'use strict';
// Uma partida: mantém os objetos vivos, processa cada TU (30 por segundo),
// resolve colisões e desenha a cena, o painel e o resumo final.

// teclas de teste só com ?dev na página
const DEV = /[?&]dev\b/.test(location.search);

const TYPE_ORDER = ['character', 'lightweapon', 'heavyweapon', 'drink', 'specialattack'];

class Match {
  // opts = { players: [{ id, team, con, player, ai, name }], bg, mode, difficulty, weapons, onEnd }
  constructor(opts) {
    this.opts = opts;
    this.rng = new Random(opts.seed || (Date.now() & 0xffffffff));
    this.time = 0;
    this.live = [];
    this.effects = [];
    this.tasks = [];
    this.sheets = {};
    this.uidNext = 1;
    this.paused = false;
    this.f6 = false;
    this.gameoverAt = null;
    this.summary = null;
    this.ais = [];
    this.bg = new Background(Assets.backgrounds.find((b) => b.id === opts.bg) || Assets.backgrounds[0]);
    this.panel = [];
    this.mode = opts.mode || 'vs';

    opts.players.forEach((p, i) => {
      const c = this.addCharacter(p.id, p.team, p.con, { player: p.player, label: p.name, removeOnDeath: p.removeOnDeath });
      const pos = p.pos || this.bg.pos(this.random() * 0.8 + 0.1, this.random());
      c.setPos(pos.x, 0, pos.z);
      if (p.dir) c.switchDir(p.dir);
      if (p.ai !== undefined && p.ai !== null) this.ais.push(new AI(c, this, p.ai));
      else if (p.player >= 0 && !opts.net) c.damageTaken = [0.6, 0.8, 1, 1][Game.difficulty];
      if (p.panel !== false) this.panel.push({ ch: c, name: p.name || c.name, player: p.player });
    });
    if (opts.weapons !== false && this.mode !== 'stage') this.dropWeapons(5);
  }

  sheet(id) {
    if (!this.sheets[id]) this.sheets[id] = new SpriteSheet(Assets.obj(id).data.bmp);
    return this.sheets[id];
  }

  random() { return this.rng.next(); }

  addCharacter(id, team, con, opts) {
    const c = new Character(this, id, team, con, opts);
    this.add(c);
    return c;
  }

  add(o) {
    o.uid = this.uidNext++;
    this.live.push(o);
    return o;
  }

  remove(o) {
    const i = this.live.indexOf(o);
    if (i >= 0) this.live.splice(i, 1);
    if (o.destroy) o.destroy();
    o.uid = -1;
  }

  characters() { return this.live.filter((o) => o.type === 'character'); }

  // ---- consultas de colisão ----

  // objetos cujo volume (corpo, ou itr de um tipo) cruza `vol`
  query(vol, exclude, where) {
    const out = [];
    let tag = where.tag || 'body', kind = 0;
    if (tag.startsWith('itr:')) { kind = Number(tag.slice(4)); tag = 'itr'; }
    const ex = Array.isArray(exclude) ? exclude : [exclude];
    for (const o of this.live) {
      if (o.uid < 0 || ex.includes(o)) continue;
      if (where.team !== undefined && o.team !== where.team) continue;
      if (where.notTeam !== undefined && o.team === where.notTeam) continue;
      if (where.type && o.type !== where.type) continue;
      const vols = tag === 'body' ? o.volBody() : o.volItr(kind);
      for (const v of vols) {
        if (intersect(vol, v)) { out.push(o); break; }
      }
    }
    return out;
  }

  queryAll(self, where) {
    let out = this.live.filter((o) => o !== self && o.uid >= 0 &&
      (where.team === undefined || o.team === where.team) &&
      (where.notTeam === undefined || o.team !== where.notTeam) &&
      (!where.type || o.type === where.type));
    if (where.sort === 'distance') {
      const d = (o) => { const dx = o.ps.x - self.ps.x, dz = o.ps.z - self.ps.z; return Math.sqrt(dx * dx + dz * dz); };
      out = out.sort((a, b) => d(a) - d(b));
    }
    return out;
  }

  leaving(o, xt = 0) {
    const nx = o.ps.sx + o.ps.vx, ny = o.ps.sy + o.ps.vy;
    return nx + o.spw < -xt || nx > this.bg.width + xt || ny < -600 || ny > 100;
  }

  // ---- criação de objetos (agendada para o fim do TU) ----

  createObject(opoint, parent) {
    this.tasks.push({ task: 'create', opoint, parent, team: parent.team, pos: parent.point(opoint),
      z: parent.ps.z, dir: parent.ps.dir, dvz: parent.dirv() * 2 });
  }

  createMultiple(opoint, parent, n, vz) {
    this.tasks.push({ task: 'multi', n, vz, opoint, parent, team: parent.team, pos: parent.point(opoint),
      z: parent.ps.z, dir: parent.ps.dir, dvz: parent.dirv() * 2 });
  }

  destroyObject(o) { this.tasks.push({ task: 'destroy', o }); }

  makeObject(T) {
    const entry = Assets.obj(T.opoint.oid);
    if (!entry) return null;
    let o;
    if (entry.type === 'specialattack') o = new Ball(this, entry.id, T.team);
    else if (['lightweapon', 'heavyweapon', 'drink'].includes(entry.type)) o = new Weapon(this, entry.id, T.team);
    else return null;
    o.init(T);
    this.add(o);
    return o;
  }

  processTasks() {
    const tasks = this.tasks;
    this.tasks = [];
    for (const T of tasks) {
      if (T.task === 'create') this.makeObject(T);
      else if (T.task === 'multi') {
        const half = Math.floor(T.n / 2), list = [];
        for (let k = -half; k <= half; k++) if (T.n % 2 === 1 || k !== 0) list.push(k * T.vz);
        for (const vz of list) {
          const o = this.makeObject(T);
          if (!o) break;
          o.ps.vz = vz;
          o.ps.vx += (T.dir === -1 ? 1 : -1) * Math.abs(vz);
        }
      } else if (T.task === 'destroy') this.remove(T.o);
    }
  }

  visualEffect(id, pos, variant, withSound) {
    const obj = Assets.obj(id);
    if (!obj) return;
    const list = obj.data.effect_list;
    const frame = list && list[variant || 0] ? list[variant || 0].frame : 0;
    this.effects.push(new VisualEffect(this, id, { ...pos }, frame, withSound));
  }

  brokenEffect(id, pos, slot, rect) {
    const broken = Assets.obj(320);
    if (!broken) return;
    const list = broken.data.broken_list.filter((b) => b.id === id);
    if (!list.length) return;
    const frame = list[slot % list.length].frame;
    this.effects.push(new VisualEffect(this, 320, { ...pos }, frame, true, { mass: id === 302 ? 0 : 1, rect }));
  }

  // poeira no chão (n bolinhas ao redor de x, z)
  puff(x, z, n = 3, color = 'rgba(220,210,190,1)', spread = 1) {
    if (this.net && this.noVisuals) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.effects.push(new Puff(x + (Math.random() - 0.5) * 10, -2, z, Math.cos(a) * 1.6 * spread, -0.4 - Math.random() * 0.8, 3 + Math.random() * 3, color, 10 + Math.floor(Math.random() * 6)));
    }
  }

  // tremor de tela em golpes fortes (só visual)
  addShake(v) { this.shakeAmt = Math.min(7, Math.max(this.shakeAmt || 0, v)); }

  dropWeapons(n) {
    const ids = Assets.data.objects.filter((o) => o.id >= 100 && o.id < 200).map((o) => o.id);
    if (!ids.length) return;
    for (let i = 0; i < n; i++) {
      const p = this.bg.pos(this.random(), this.random());
      this.createWeapon(ids[Math.floor(this.random() * ids.length)], { x: p.x, y: -800, z: p.z });
    }
  }

  createWeapon(id, pos) {
    const w = new Weapon(this, id, 0);
    w.setPos(pos.x, pos.y, pos.z);
    this.add(w);
    return w;
  }

  // ---- ciclo ----

  frame() {
    this.functionKeys();
    if (this.demo && !this.ended && (Input.anyHit('att') || Input.anyHit('jump'))) { this.end(); return; }
    if (this.ended || (this.paused && !this.stepFrame)) return;
    this.stepFrame = false;
    const chars = this.characters();
    const seen = new Set();
    for (const c of chars) {
      if (c.con && !seen.has(c.con)) { c.con.fetch(); seen.add(c.con); }
      if (c.decoder) c.decoder.frame();
    }
    const ordered = TYPE_ORDER.flatMap((t) => this.live.filter((o) => o.type === t));
    for (const o of ordered) if (o.uid >= 0) o.transit();
    this.processTasks();
    for (const o of ordered) if (o.uid >= 0) o.TU();
    for (const e of this.effects) e.TU();
    this.effects = this.effects.filter((e) => !e.dead);
    if (this.f6) for (const c of chars) c.health.mp = c.health.mp_full;
    const humans = chars.filter((c) => c.player >= 0 && c.health.hp > 0);
    this.bg.updateCamera(humans.length ? humans : chars.filter((c) => c.health.hp > 0), this.camBound);
    for (const ai of this.ais) if (ai.ch.uid >= 0 && this.time % ai.L.every === 0) ai.think();
    this.ais = this.ais.filter((ai) => ai.ch.uid >= 0);
    if (this.mode === 'training') this.trainingTU();
    if (this.modeLogic) this.modeLogic.TU(this);
    else this.checkGameover();
    this.time++;
  }

  // Esc / botão voltar / F1 / P abrem o menu de pausa (fora do jogo em rede, que não para).
  // As teclas de teste (F2, F6-F9) só existem com ?dev na página.
  functionKeys() {
    if (this.net) {
      if (Input.code('Escape') || Input.code('F4')) this.end();
      return;
    }
    if (this.demo) return;
    const toggle = Input.code('Escape') || Input.code('F1') || Input.code('KeyP') || Input.code('F4');
    if (!this.paused) {
      if (toggle && !this.summary) { this.setPaused(true); Sound.play('m_ok'); }
      else if (Input.code('Escape') && this.summary) this.end();
    } else {
      this.pauseMenu();
    }
    if (!DEV) return;
    if (Input.code('F2')) { this.paused = true; this.stepFrame = true; }
    if (Input.code('F6')) this.f6 = !this.f6;
    if (Input.code('F7')) {
      for (const c of this.characters()) {
        c.health.hp = c.health.hp_full = c.health.hp_bound = Assets.prop(c.id, 'hp') || GC.hp_full;
        c.health.mp = c.health.mp_full;
      }
    }
    if (Input.code('F8')) this.dropWeapons(5);
    if (Input.code('F9')) for (const o of this.live) if (o instanceof Weapon) o.health.hp = 0;
  }

  setPaused(on) {
    this.paused = on;
    this.pauseSel = 0;
    Music.setDuck(on ? 0.3 : 1);
    // teclas apertadas durante a pausa não podem virar golpes ao voltar
    for (const c of this.characters()) if (c.con) c.con.clear();
    if (this.opts.onPause) this.opts.onPause(on);
  }

  pauseMenu() {
    const items = this.pauseItems();
    if (Input.anyHit('up')) { this.pauseSel = (this.pauseSel + items.length - 1) % items.length; Sound.play('m_pass'); }
    if (Input.anyHit('down')) { this.pauseSel = (this.pauseSel + 1) % items.length; Sound.play('m_pass'); }
    for (const c of this.characters()) if (c.con) c.con.clear();
    const back = Input.code('Escape') || Input.code('F1') || Input.code('KeyP') || Input.code('F4') || Input.anyHit('jump');
    if (back) { this.setPaused(false); Sound.play('m_cancel'); return; }
    if (Input.anyHit('att') || Input.code('Enter')) {
      const it = items[this.pauseSel];
      Sound.play('m_ok');
      if (it.key === 'resume') this.setPaused(false);
      else if (it.key === 'sound') { Save.settings.sfx = Save.settings.sfx ? 0 : 8; Save.settings.music = Save.settings.sfx ? 6 : 0; Save.save(); Save.apply(); }
      else if (it.key === 'quit') this.end();
    }
  }

  pauseItems() {
    const muted = !Save.settings.sfx && !Save.settings.music;
    return [{ key: 'resume', name: 'Continuar' }, { key: 'sound', name: muted ? 'Ligar o som' : 'Desligar o som' }, { key: 'quit', name: 'Sair da luta' }];
  }

  // treino: MP infinito e o boneco nunca cai de vez
  trainingTU() {
    for (const c of this.characters()) {
      if (c.player >= 0) c.health.mp = c.health.mp_full;
      else if (c.health.hp < c.health.hp_full * 0.4) { c.health.hp = c.health.hp_bound = c.health.hp_full; }
    }
  }

  aliveTeams() {
    const teams = new Set();
    for (const p of this.panel) if (p.ch.health.hp > 0) teams.add(p.ch.team);
    return teams;
  }

  checkGameover() {
    if (this.mode === 'training') return;
    if (this.aliveTeams().size < 2) {
      if (this.gameoverAt === null) this.gameoverAt = this.time;
      else if (this.time === this.gameoverAt + 30) this.showSummary();
    } else if (this.gameoverAt !== null) {
      this.gameoverAt = null;
      this.summary = null;
    }
    if (!this.net && this.summary && this.time > this.gameoverAt + 60 && (Input.anyHit('att') || Input.anyHit('jump'))) this.end();
    if (this.summary && this.demo && this.time > this.gameoverAt + 150) { this.end(); startDemo(); }
  }

  showSummary(title) {
    const teams = this.aliveTeams();
    this.summary = {
      title,
      time: this.time / LF.FPS,
      rows: this.panel.map((p) => {
        const c = p.ch, alive = c.health.hp > 0;
        return { small: c.data.bmp.small, name: !p.name || p.name === c.name || p.name === 'COM' ? c.name : `${p.name} · ${c.name}`, kill: c.stat.kill, attack: Math.round(c.stat.attack),
          lost: Math.round(c.health.hp_lost), mp: Math.round(c.health.mp_usage), pick: c.stat.picking,
          win: teams.has(c.team), alive, human: p.player >= 0, charId: c.id };
      }),
    };
    if (!this.net && !this.demo) Save.record(this.summary.rows, this.summary.time);
    Sound.play('m_end');
  }

  end() {
    if (this.ended) return;
    this.ended = true;
    Music.setDuck(1);
    for (const o of this.live) if (o.destroy) o.destroy();
    if (this.opts.onEnd) this.opts.onEnd(this);
  }

  // ---- desenho ----

  // cor de ambiente do cenário e vinheta nas bordas da tela
  drawAmbience(ctx) {
    const bg = this.bg;
    if (bg.tone) { ctx.fillStyle = bg.tone; ctx.fillRect(0, LF.HUD_H, LF.W, LF.H - LF.HUD_H); }
    if (bg.vignette) {
      if (!this.vig) {
        const g = ctx.createRadialGradient(LF.W / 2, LF.H * 0.58, LF.H * 0.38, LF.W / 2, LF.H * 0.58, LF.W * 0.62);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(5,5,20,1)');
        this.vig = g;
      }
      ctx.globalAlpha = bg.vignette; ctx.fillStyle = this.vig; ctx.fillRect(0, LF.HUD_H, LF.W, LF.H - LF.HUD_H); ctx.globalAlpha = 1;
    }
  }

  draw(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, LF.W, LF.H);
    // o cenário começa em y=128; a cena sobe para caber sob o painel compacto
    ctx.save();
    let sx = 0, sy = 0;
    if (this.shakeAmt > 0.3 && !this.paused) { sx = (Math.random() - 0.5) * this.shakeAmt; sy = (Math.random() - 0.5) * this.shakeAmt; this.shakeAmt *= 0.82; }
    ctx.translate(sx, sy - LF.WORLD_Y);
    this.bg.draw(ctx);
    // estica a última linha do chão até o pé da tela, escurecendo
    const by = this.bg.bottom() - LF.WORLD_Y;
    if (by > 0 && by < LF.H) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const k = ctx.canvas.width / LF.W;
      ctx.drawImage(ctx.canvas, 0, (by - 1) * k, ctx.canvas.width, k, 0, by * k, ctx.canvas.width, (LF.H - by) * k);
      ctx.scale(k, k);
      const g = ctx.createLinearGradient(0, by, 0, LF.H);
      g.addColorStop(0, 'rgba(0,0,0,0.15)');
      g.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = g;
      ctx.fillRect(0, by, LF.W, LF.H - by);
      ctx.restore();
    }
    const camX = this.bg.camX;
    for (const o of this.live) if (o.visible && o.shadowVisible && !o.hidden && !o.holder) this.bg.drawShadow(ctx, o);
    const list = [...this.live, ...this.effects];
    list.sort((a, b) => ((a.ps.sz !== undefined ? a.ps.sz + (a.ps.zz || 0) : a.z) - (b.ps.sz !== undefined ? b.ps.sz + (b.ps.zz || 0) : b.z)) || ((a.uid || 0) - (b.uid || 0)));
    for (const o of list) o.draw(ctx, camX);
    this.bg.draw(ctx, true);
    ctx.restore();
    this.drawAmbience(ctx);
    drawHud(ctx, this);
    if (this.modeLogic && this.modeLogic.draw) this.modeLogic.draw(ctx, this);
    if (this.demo && !this.summary) {
      title(ctx, 'DEMONSTRAÇÃO', LF.W / 2, LF.HUD_H + 26, 26, UI.amber);
      text(ctx, 'Aperte ATAQUE para voltar', LF.W / 2, LF.HUD_H + 50, { align: 'center', bold: false, size: 12, shadow: '#000' });
    }
    if (this.mode === 'training') drawTrainingHud(ctx, this);
    if (this.paused && !this.stepFrame) drawPauseOverlay(ctx, this);
    if (this.summary) drawSummary(ctx, this);
  }
}
