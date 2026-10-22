// Doze lutas de quatro lutadores apertando teclas ao acaso: nada pode quebrar (nem um pânico do Rust).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, launch, openGame } = require('./helpers.cjs');

let server, browser;
before(async () => { server = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); server.stop(); });

test('lutas aleatórias não geram erros', async () => {
  const page = await openGame(browser, server.url);
  const rounds = await page.evaluate(() => {
    const P = PUNHO;
    const actions = ['up', 'down', 'left', 'right', 'att', 'jump', 'def'];
    const fighters = P.punho_fighters();
    let seed = 12345;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    let ended = 0;
    for (let r = 0; r < 12; r++) {
      const players = [0, 1, 2, 3].map((p) => ({ id: fighters[(r * 4 + p) % fighters.length], team: 100 + (p % 2), player: p, name: 'X' }));
      P.punho_start_match(JSON.stringify({ players, bg: 1 + (r % 6), mode: 'vs', rounds: r % 3 === 0 ? 3 : 1, timeLimit: r % 2 ? 30 : 0 }));
      for (let i = 0; i < 4; i++) P.punho_poke('hpFull', i, 5000);
      for (let f = 0; f < 700; f++) {
        for (let p = 0; p < 4; p++) if (rnd() < 0.3) P.punho_key(P.punho_key_of(p, actions[Math.floor(rnd() * actions.length)]), rnd() < 0.5);
        P.punho_step(1);
      }
      // solta tudo antes da próxima luta
      for (let p = 0; p < 4; p++) for (const a of actions) P.punho_key(P.punho_key_of(p, a), false);
      ended++;
    }
    return ended;
  });
  assert.equal(rounds, 12);
  assert.deepEqual(page.errors, []);
});

test('lutas de computador contra computador, com armas, terminam e não geram erros', async () => {
  const page = await openGame(browser, server.url);
  const result = await page.evaluate(() => {
    const P = PUNHO;
    const f = P.punho_fighters().filter((id) => id !== 30);
    const out = [];
    for (let r = 0; r < 6; r++) {
      P.punho_start_match(JSON.stringify({ bg: 1 + r, mode: 'vs', players: [0, 1, 2, 3].map((i) => ({ id: f[(r + i * 2) % f.length], team: 100 + i, ai: 2, name: 'COM' })) }));
      let frames = 0;
      while (frames < 3000 && !P.punho_state().match.summary) { P.punho_step(30); frames += 30; }
      out.push(!!P.punho_state().match.summary);
    }
    return out;
  });
  assert.ok(result.filter(Boolean).length >= 4, `poucas lutas terminaram: ${result}`);
  assert.deepEqual(page.errors, []);
});
