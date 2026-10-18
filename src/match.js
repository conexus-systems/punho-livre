'use strict';
// Uma partida: mantém os objetos vivos, processa cada TU (30 por segundo),
// resolve colisões e desenha a cena, o painel e o resumo final.

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

  spawnClone(parent, i) {
    this.tasks.push({ task: 'clone', parent, i });
  }

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
      else if (T.task === 'clone') {
        const p = T.parent;
        const con = new Controller();
        const c = this.addCharacter(p.id, p.team, con, { parent: p, removeOnDeath: true, label: p.name });
        c.health.hp = c.health.hp_full = c.health.hp_bound = 20;
        c.health.mp = 100;
        c.setPos(p.ps.x - 20 * T.i, p.ps.y, p.ps.z);
        c.switchDir(p.ps.dir);
        this.ais.push(new AI(c, this, 2));
      }
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
    if (this.time % 3 === 0) for (const ai of this.ais) if (ai.ch.uid >= 0) ai.think();
    this.ais = this.ais.filter((ai) => ai.ch.uid >= 0);
    if (this.modeLogic) this.modeLogic.TU(this);
    else this.checkGameover();
    this.time++;
  }

  // F1 pausa · F2 avança um TU · F4/Esc volta · F6 MP infinito · F7 recupera vida · F8 armas · F9 some com as armas
  functionKeys() {
    // em rede as teclas de função mudariam a partida de um lado só
    if (this.net) {
      if (Input.code('Escape') || Input.code('F4')) this.end();
      return;
    }
    if (Input.code('F1') || Input.code('KeyP')) this.paused = !this.paused;
    if (Input.code('F2')) { this.paused = true; this.stepFrame = true; }
    if (Input.code('Escape') || Input.code('F4')) { this.end(); return; }
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

  aliveTeams() {
    const teams = new Set();
    for (const p of this.panel) if (p.ch.health.hp > 0) teams.add(p.ch.team);
    return teams;
  }

  checkGameover() {
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
        return { small: c.data.bmp.small, name: p.name, kill: c.stat.kill, attack: Math.round(c.stat.attack),
          lost: Math.round(c.health.hp_lost), mp: Math.round(c.health.mp_usage), pick: c.stat.picking,
          win: teams.has(c.team), alive };
      }),
    };
    Sound.play('1/m_end');
  }

  end() {
    if (this.ended) return;
    this.ended = true;
    for (const o of this.live) if (o.destroy) o.destroy();
    if (this.opts.onEnd) this.opts.onEnd(this);
  }

  // ---- desenho ----

  draw(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, LF.W, LF.H);
    this.bg.draw(ctx);
    const camX = this.bg.camX;
    for (const o of this.live) if (o.visible && o.shadowVisible && !o.hidden && !o.holder) this.bg.drawShadow(ctx, o);
    const list = [...this.live, ...this.effects];
    list.sort((a, b) => ((a.ps.sz !== undefined ? a.ps.sz + (a.ps.zz || 0) : a.z) - (b.ps.sz !== undefined ? b.ps.sz + (b.ps.zz || 0) : b.z)) || ((a.uid || 0) - (b.uid || 0)));
    for (const o of list) o.draw(ctx, camX);
    this.drawPanel(ctx);
    if (this.modeLogic && this.modeLogic.draw) this.modeLogic.draw(ctx, this);
    if (this.paused) this.drawMessage(ctx, 'pause');
    else if (this.demo) this.drawMessage(ctx, 'demo');
    if (this.summary) this.drawSummary(ctx);
  }

  drawPanel(ctx) {
    const P = Assets.data.ui.panel, img = Assets.img(P.pic);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, LF.W, LF.PANEL_H);
    for (let i = 0; i < 8; i++) {
      const X = P.pane_width * (i % 4), Y = P.pane_height * Math.floor(i / 4);
      if (img) ctx.drawImage(img, X, Y);
      const slot = this.panel[i];
      if (!slot) continue;
      const c = slot.ch, h = c.health;
      const small = Assets.img(c.data.bmp.small);
      if (small) ctx.drawImage(small, X + P.x, Y + P.y);
      const bw = (v) => Math.max(0, Math.floor(v * P.hpw));
      ctx.fillStyle = P.hp_dark;
      ctx.fillRect(X + P.hpx, Y + P.hpy, bw(h.hp_bound / h.hp_full), P.hph);
      ctx.fillStyle = h.hp > 0 && c.effect.heal > 0 && this.time % 3 === 0 ? P.hp_light : P.hp_bright;
      ctx.fillRect(X + P.hpx, Y + P.hpy, bw(h.hp / h.hp_full), P.hph);
      ctx.fillStyle = P.mp_dark;
      ctx.fillRect(X + P.mpx, Y + P.mpy, P.mpw, P.mph);
      ctx.fillStyle = P.mp_bright;
      ctx.fillRect(X + P.mpx, Y + P.mpy, Math.floor(Math.max(0, h.mp / h.mp_full) * P.mpw), P.mph);
    }
  }

  drawMessage(ctx, key) {
    const M = Assets.data.ui.message_overlay, img = Assets.img(M.pic), r = M[key];
    if (!img || !r || Math.floor(Date.now() / 400) % 2) return;
    ctx.drawImage(img, r[0], r[1], r[2], r[3], Math.round((LF.W - r[2]) / 2), 250, r[2], r[3]);
  }

  drawSummary(ctx) {
    const S = Assets.data.ui.summary, img = Assets.img(S.pic), sum = this.summary;
    if (!img) return;
    const rows = sum.rows.length;
    const total = S.head[3] + S.body[3] * rows + S.foot[3];
    const x0 = Math.round((LF.W - S.width) / 2), y0 = Math.round(LF.PANEL_H + (LF.H - LF.PANEL_H - total) / 2);
    const part = (r, y) => ctx.drawImage(img, r[0], r[1], r[2], r[3], x0, y, r[2], r[3]);
    part(S.head, y0);
    sum.rows.forEach((row, i) => {
      const y = y0 + S.head[3] + i * S.body[3];
      part(S.body, y);
      const small = Assets.img(row.small);
      if (small) ctx.drawImage(small, x0 + S.icon[0], y + S.icon[1], S.icon[2], S.icon[3]);
      const vals = [row.name, row.kill, row.attack, row.lost, row.mp, row.pick,
        (row.win ? 'Vitória' : 'Derrota') + (row.alive ? '' : ' (KO)')];
      vals.forEach((v, k) => {
        const t = S.text[k];
        const color = k === 6 ? S.text_color[row.win ? 6 : 7] : S.text_color[k];
        ctx.font = k === 0 ? 'bold 11px Arial, sans-serif' : 'bold 13px Arial, sans-serif';
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(v), x0 + t[0] + t[2] / 2, y + t[1] + t[3] / 2, t[2]);
      });
    });
    const fy = y0 + S.head[3] + rows * S.body[3];
    part(S.foot, fy);
    const sec = Math.floor(sum.time), tx = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.fillStyle = S.time_color;
    ctx.textAlign = 'center';
    ctx.fillText(tx, x0 + S.time[0] + S.time[2] / 2, fy + S.time[1] + S.time[3] / 2);
    if (sum.title) {
      ctx.font = 'bold 22px Arial, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(sum.title, LF.W / 2, y0 - 20);
    }
  }
}
