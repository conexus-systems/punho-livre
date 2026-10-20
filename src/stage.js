'use strict';
// Stage Mode: os jogadores (time 1) atravessam o cenário em trechos.
// Cada trecho só libera o próximo ("GO →") quando todos os inimigos caem.
// Os chefes de cada fase são lutadores do elenco.

const STAGES = [
  { bg: 1, phases: [['30', '30', '30'], ['30', '30', '30', '30'], ['30', '30', '!8']] },
  { bg: 3, phases: [['30', '30', '30', '30'], ['30', '30', '!6'], ['30', '30', '!3', '!6']] },
  { bg: 5, phases: [['30', '30', '30', '30'], ['30', '30', '30', '!5'], ['30', '30', '!4', '!5']] },
  { bg: 2, phases: [['30', '30', '30', '30', '30'], ['30', '30', '!2'], ['30', '!7', '!2']] },
  { bg: 4, phases: [['30', '30', '30', '30', '30'], ['30', '30', '!3', '!4'], ['!1', '!7', '!8']] },
];

const ENEMY_TEAM = 99;

class StageLogic {
  constructor(heroes, stageIndex, onEnd) {
    this.heroSpecs = heroes;
    this.stageIndex = stageIndex;
    this.onEnd = onEnd;
  }

  init(m) {
    this.m = m;
    this.heroes = m.characters().filter((c) => c.team === 1);
    this.loadStage(this.stageIndex, true);
  }

  loadStage(i, first) {
    const m = this.m, S = STAGES[i];
    this.stageIndex = i;
    m.bg = new Background(Assets.backgrounds.find((b) => b.id === S.bg) || Assets.backgrounds[0]);
    for (const o of [...m.live]) if (o.team !== 1 || o.type !== 'character') m.remove(o);
    m.effects = [];
    m.tasks = [];
    this.sectionW = m.bg.width / S.phases.length;
    this.heroes.forEach((h, k) => {
      if (!first) {
        if (h.health.hp <= 0) {
          h.health.hp = h.health.hp_bound = Math.round(h.health.hp_full * 0.4);
          h.dead = false;
          h.visible = true;
        } else {
          h.health.hp_bound = Math.max(h.health.hp_bound, Math.min(h.health.hp_full, h.health.hp + 150));
          h.health.hp = Math.min(h.health.hp_bound, h.health.hp + 150);
        }
        h.trans.frame(999, 99);
        h.hold = null;
      }
      h.ps.dir = 1;
      h.ps.vx = h.ps.vy = h.ps.vz = 0;
      h.setPos(80 + k * 30, 0, m.bg.pos(0, (k + 1) / (this.heroes.length + 1)).z);
    });
    m.bg.camX = 0;
    this.cleared = false;
    this.clearT = 0;
    this.startPhase(0);
    this.banner = { text: `Fase ${i + 1}`, t: 90 };
    if (!m.net) { const pr = Save.progress; if (i > pr.storyBest) { pr.storyBest = i; Save.save(); } }
  }

  startPhase(p) {
    this.phase = p;
    this.queue = STAGES[this.stageIndex].phases[p].slice();
    this.locked = true;
    this.goArrow = false;
    this.spawnT = 20;
    this.setBounds(p * this.sectionW, (p + 1) * this.sectionW);
    if (this.m.random() < 0.6) {
      const ids = Assets.data.objects.filter((o) => o.id >= 100 && o.id < 200).map((o) => o.id);
      const z = this.m.bg.pos(0, this.m.random()).z;
      if (ids.length) this.m.createWeapon(ids[Math.floor(this.m.random() * ids.length)], { x: p * this.sectionW + 200 + this.m.random() * 300, y: -600, z });
    }
  }

  setBounds(min, max) {
    this.m.bound = { team: 1, min: min + 10, max: max - 10 };
    this.m.camBound = { min, max: Math.max(min, max - LF.W) };
  }

  spawn(spec) {
    const m = this.m, boss = spec[0] === '!', id = Number(boss ? spec.slice(1) : spec);
    if (!Assets.obj(id)) return;
    const fromLeft = this.phase > 0 && m.random() < 0.4;
    const x = fromLeft ? m.bg.camX - 60 : m.bg.camX + LF.W + 60;
    const c = m.addCharacter(id, ENEMY_TEAM, new Controller(), { removeOnDeath: true, label: boss ? 'Chefe' : 'COM' });
    c.setPos(Math.max(0, Math.min(m.bg.width, x)), 0, m.bg.pos(0, m.random()).z);
    c.switchDir(fromLeft ? 1 : -1);
    if (!boss) {
      c.health.hp = c.health.hp_full = c.health.hp_bound = 180 + 60 * Game.difficulty;
    }
    m.ais.push(new AI(c, m, boss ? Game.difficulty : Math.max(0, Game.difficulty - 1)));
  }

  TU(m) {
    if (this.banner && --this.banner.t <= 0) this.banner = null;
    // painel: jogadores primeiro, depois os inimigos em campo
    const enemies = m.characters().filter((c) => c.team === ENEMY_TEAM && c.uid >= 0);
    m.panel = [...this.heroes, ...enemies].slice(0, 8).map((c) => ({ ch: c, name: c.label }));

    if (m.summary) {
      if (m.time > this.overAt + 60 && (Input.anyHit('att') || Input.anyHit('jump'))) m.end();
      return;
    }
    if (!this.heroes.some((h) => h.health.hp > 0)) {
      if (!this.overAt) this.overAt = m.time;
      if (m.time === this.overAt + 45) { m.panel = this.heroes.map((c) => ({ ch: c, name: c.label })); m.showSummary('Game Over'); }
      return;
    }
    const alive = enemies.filter((c) => c.health.hp > 0);
    if (this.cleared) {
      if (++this.clearT === 90) {
        if (this.stageIndex + 1 < STAGES.length) this.loadStage(this.stageIndex + 1, false);
        else {
          this.overAt = m.time;
          m.panel = this.heroes.map((c) => ({ ch: c, name: c.label }));
          const pr = Save.progress; pr.storyClears++; pr.storyBest = STAGES.length - 1; Save.save();
          m.showSummary('Todas as fases concluídas!');
        }
      }
      return;
    }
    if (this.locked) {
      if (this.queue.length && alive.length < 2 + Math.min(2, Game.difficulty) + (this.heroes.length > 1 ? 1 : 0) && --this.spawnT <= 0) {
        this.spawn(this.queue.shift());
        this.spawnT = 45 + Math.floor(m.random() * 30);
      }
      if (!this.queue.length && !alive.length) {
        if (this.phase === STAGES[this.stageIndex].phases.length - 1) {
          this.cleared = true;
          this.banner = { text: 'Fase concluída!', t: 90 };
          Sound.play('m_end');
        } else {
          this.locked = false;
          this.goArrow = true;
          this.setBounds(this.phase * this.sectionW, (this.phase + 2) * this.sectionW);
        }
      }
    } else if (this.heroes.some((h) => h.health.hp > 0 && h.ps.x > (this.phase + 1) * this.sectionW + 60)) {
      this.startPhase(this.phase + 1);
    }
  }

  draw(ctx, m) {
    if (this.goArrow && Math.floor(m.time / 10) % 2 === 0) {
      title(ctx, 'SIGA →', LF.W - 30, 240, 40, UI.amber, 'right');
    }
    if (this.banner) drawBanner(ctx, this.banner.text);
    title(ctx, `Fase ${this.stageIndex + 1}-${this.phase + 1}`, 12, LF.H - 16, 20, UI.text, 'left');
  }
}

function startStage(players, stageIndex, back) {
  for (const p of players) p.team = 1;
  const m = startMatch({ players, bg: STAGES[stageIndex].bg, mode: 'stage', weapons: false, onEnd: back });
  m.modeLogic = new StageLogic(players, stageIndex, back);
  m.modeLogic.init(m);
}
