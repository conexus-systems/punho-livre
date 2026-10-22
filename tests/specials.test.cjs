// Cada golpe especial de cada lutador tem que sair com a sequência de teclas certa.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, launch, openGame } = require('./helpers.cjs');

let server, browser;
before(async () => { server = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); server.stop(); });

test('todos os especiais disparam e gastam MP', async () => {
  const page = await openGame(browser, server.url);
  const log = await page.evaluate(() => {
    const out = [];
    const P = PUNHO;
    const K = (a) => P.punho_key_of(0, a);
    const tap = (a) => { P.punho_key(K(a), true); P.punho_step(1); P.punho_key(K(a), false); P.punho_step(1); };
    const seqs = { hit_Fa: ['def', 'right', 'att'], hit_Ua: ['def', 'up', 'att'], hit_Da: ['def', 'down', 'att'], hit_Fj: ['def', 'right', 'jump'], hit_Uj: ['def', 'up', 'jump'], hit_Dj: ['def', 'down', 'jump'] };
    for (const id of P.punho_fighters()) {
      const frames = P.punho_special_frames(id);
      for (const [tag, seq] of Object.entries(seqs)) {
        const target = frames[tag];
        if (!target) continue;
        P.punho_start_match(JSON.stringify({ bg: 2, mode: 'vs', weapons: false, players: [
          { id, team: 101, player: 0, name: '1P', pos: { x: 600, z: 450 } },
          { id: 30, team: 102, name: 'COM', pos: { x: 660, z: 450 } },
        ] }));
        P.punho_step(50); // a apresentação do round ("PREPARAR...") ignora as teclas
        P.punho_poke('mp', 0, 500);
        const seen = new Set();
        const frame = () => P.punho_state().match.chars[0].frame;
        for (const a of seq) { tap(a); seen.add(frame()); }
        for (let i = 0; i < 6; i++) { P.punho_step(1); seen.add(frame()); }
        out.push({ who: `${id} ${tag}`, ok: [...seen].some((n) => Math.abs(n - target) < 3), mp: P.punho_state().match.chars[0].mp });
      }
    }
    return out;
  });
  const bad = log.filter((l) => !l.ok);
  assert.deepEqual(bad, [], 'especiais que não dispararam');
  assert.ok(log.length >= 24, `esperava 24 especiais, achei ${log.length}`);
  assert.ok(log.every((l) => l.mp < 500), 'todo especial gasta MP');
  assert.deepEqual(page.errors, []);
});
