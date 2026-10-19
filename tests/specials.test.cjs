// Cada golpe especial de cada lutador tem que sair com a sequência de teclas certa.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, launch, openGame } = require('./helpers.cjs');

let server, browser;
before(async () => { server = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); server.stop(); });

test('todos os especiais disparam', async () => {
  const page = await openGame(browser, server.url);
  const log = await page.evaluate(() => {
    const out = [];
    const step = (n) => { for (let i = 0; i < n; i++) { Game.update(); Input.endFrame(); } };
    const K = Input.keys[0];
    const tap = (a) => { Input.setKey(K[a], true); step(1); Input.setKey(K[a], false); step(1); };
    const seqs = { hit_Fa: ['def', 'right', 'att'], hit_Ua: ['def', 'up', 'att'], hit_Da: ['def', 'down', 'att'], hit_Fj: ['def', 'right', 'jump'], hit_Uj: ['def', 'up', 'jump'], hit_Dj: ['def', 'down', 'jump'] };
    for (const c of characterList()) {
      for (const [tag, seq] of Object.entries(seqs)) {
        const target = c.data.frame[0][tag];
        if (!target) continue;
        const m = startMatch({ players: [
          { id: c.id, team: 101, con: Input.controllers[0], player: 0, name: '1P', pos: { x: 600, z: 450 } },
          { id: 30, team: 102, con: new Controller(), name: 'COM', pos: { x: 660, z: 450 } },
        ], bg: 2, mode: 'vs', weapons: false, onEnd: () => {} });
        const ch = m.characters()[0];
        ch.health.mp = 500;
        step(5);
        const seen = new Set();
        for (const a of seq) { tap(a); seen.add(ch.frame.N); }
        for (let i = 0; i < 6; i++) { step(1); seen.add(ch.frame.N); }
        out.push({ who: `${c.name} ${tag}`, ok: [...seen].some((n) => Math.abs(n - target) < 3), mp: ch.health.mp });
        m.end();
      }
    }
    return out;
  });
  const bad = log.filter((l) => !l.ok);
  assert.deepEqual(bad, [], 'especiais que não dispararam');
  assert.ok(log.length >= 24, `esperava 24 especiais, achei ${log.length}`);
  assert.ok(log.every((l) => l.mp < 500), 'todo especial gasta MP');
});
