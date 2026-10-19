// Doze lutas de quatro lutadores apertando teclas ao acaso: nada pode quebrar.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, launch, openGame } = require('./helpers.cjs');

let server, browser;
before(async () => { server = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); server.stop(); });

test('lutas aleatórias não geram erros', async () => {
  const page = await openGame(browser, server.url);
  const rounds = await page.evaluate(() => {
    const step = (n) => { for (let i = 0; i < n; i++) { Game.update(); Input.endFrame(); } };
    const chars = characterList();
    const keys = ['up', 'down', 'left', 'right', 'att', 'jump', 'def'];
    let seed = 12345;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let r = 0; r < 12; r++) {
      const cons = [0, 1, 2, 3].map(() => new Controller());
      const players = cons.map((con, i) => ({ id: chars[(r * 4 + i) % chars.length].id, team: 100 + (i % 2), con, name: 'X' }));
      const m = startMatch({ players, bg: Assets.backgrounds[r % Assets.backgrounds.length].id, mode: 'vs', onEnd: () => {} });
      for (const c of m.characters()) c.health.hp = c.health.hp_full = c.health.hp_bound = 5000;
      for (let f = 0; f < 600; f++) {
        for (const con of cons) if (rnd() < 0.3) con.key(keys[Math.floor(rnd() * keys.length)], rnd() < 0.5);
        step(1);
      }
      m.end();
    }
    return 12;
  });
  assert.equal(rounds, 12);
  assert.deepEqual(page.errors, []);
});
