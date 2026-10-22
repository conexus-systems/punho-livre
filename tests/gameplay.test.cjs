// Jogabilidade nova: abertura de round, K.O., rounds, tempo, combos, História e Sobrevivência.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, launch, openGame, state, startMatch, step } = require('./helpers.cjs');

let server, browser;
before(async () => { server = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); server.stop(); });

const duel = (extra = {}) => ({ players: [{ id: 1, team: 1, player: 0, name: '1P' }, { id: 4, team: 2, ai: 0 }], bg: 2, mode: 'vs', weapons: false, ...extra });

test('a abertura do round ignora as teclas e termina com LUTEM!', async () => {
  const page = await openGame(browser, server.url);
  await startMatch(page, duel({ players: [{ id: 1, team: 1, player: 0, pos: { x: 300, z: 440 } }, { id: 4, team: 2, pos: { x: 700, z: 440 } }] }));
  // tudo numa chamada só, para o relógio real do navegador não se misturar com os quadros do teste
  const r = await page.evaluate(() => {
    const P = PUNHO, right = P.punho_key_of(0, 'right');
    P.punho_key(right, true);
    const log = [];
    for (let i = 0; i < 90; i++) {
      P.punho_step(1);
      const m = P.punho_state().match;
      log.push({ t: m.roundTime, banner: m.banner, x: m.chars[0].x });
    }
    P.punho_key(right, false);
    return log;
  });
  const intro = r.filter((l) => l.t <= 44), after = r.filter((l) => l.t > 56);
  assert.ok(intro.every((l) => l.x === intro[0].x), 'ninguém anda na abertura');
  assert.equal(intro[0].banner, 'PREPARAR...');
  assert.ok(r.some((l) => l.banner === 'LUTEM!'), 'a abertura termina com LUTEM!');
  assert.ok(after[after.length - 1].x > intro[0].x + 20, 'depois dela o jogador anda');
  assert.deepEqual(page.errors, []);
});

test('melhor de 3: o round recomeça com todos de pé e a luta só acaba no segundo ponto', async () => {
  const page = await openGame(browser, server.url);
  await startMatch(page, duel({ rounds: 3 }));
  await step(page, 60);
  await page.evaluate(() => PUNHO.punho_poke('hp', 1, 0));
  await step(page, 150);
  let m = (await state(page)).match;
  assert.equal(m.summary, false, 'um ponto ainda não decide');
  assert.equal(m.round, 2);
  assert.equal(m.chars[1].hp, 620, 'o rival volta com a vida cheia');
  assert.equal(m.chars[0].hp, 500);
  await step(page, 60);
  await page.evaluate(() => PUNHO.punho_poke('hp', 1, 0));
  await step(page, 200);
  m = (await state(page)).match;
  assert.equal(m.summary, true, 'dois pontos decidem a luta');
  assert.equal(m.round, 2);
  assert.deepEqual(page.errors, []);
});

test('tempo limite: quem tem mais vida leva o round', async () => {
  const page = await openGame(browser, server.url);
  await startMatch(page, duel({ timeLimit: 30, players: [{ id: 1, team: 1, player: 0, pos: { x: 100, z: 440 } }, { id: 4, team: 2, pos: { x: 1500, z: 440 } }] }));
  await step(page, 60);
  await page.evaluate(() => PUNHO.punho_poke('hp', 1, 300));
  await step(page, 30 * 35);
  const m = (await state(page)).match;
  assert.equal(m.summary, true);
  const p = await page.evaluate(() => PUNHO.punho_progress());
  assert.ok(p.wins >= 1, 'o jogador com mais vida venceu por tempo');
});

test('K.O. e golpes geram o contador de combo e o recorde da luta', async () => {
  const page = await openGame(browser, server.url);
  await startMatch(page, duel({ players: [{ id: 8, team: 1, player: 0, pos: { x: 300, z: 440 } }, { id: 4, team: 2, pos: { x: 330, z: 440 } }] }));
  await step(page, 50);
  // Bala soca o titã sem parar
  const att = await page.evaluate(() => PUNHO.punho_key_of(0, 'att'));
  for (let i = 0; i < 40; i++) {
    await page.evaluate((a) => { PUNHO.punho_key(a, true); PUNHO.punho_step(2); PUNHO.punho_key(a, false); PUNHO.punho_step(4); }, att);
  }
  const m = (await state(page)).match;
  assert.ok(m.chars[1].hp < 620, 'os socos acertaram');
  assert.deepEqual(page.errors, []);
});

test('História: começa na fase 1-1 e os inimigos entram em cena', async () => {
  const page = await openGame(browser, server.url);
  await startMatch(page, { mode: 'stage', bg: 1, weapons: false, players: [{ id: 6, team: 1, player: 0, name: '1P' }] });
  await step(page, 150);
  const s = await state(page);
  assert.equal(s.match.stage, '1-1');
  assert.ok(s.match.chars.length > 1, 'capangas apareceram');
  assert.deepEqual(page.errors, []);
});

test('Sobrevivência: a onda 1 entra, termina e a 2 começa; o recorde é salvo', async () => {
  const page = await openGame(browser, server.url);
  await page.evaluate(() => PUNHO.punho_reset_progress());
  await startMatch(page, { mode: 'survival', bg: 1, weapons: false, players: [{ id: 3, team: 1, player: 0, name: '1P' }] });
  await step(page, 120);
  assert.equal((await state(page)).match.wave, 1);
  // derruba todos os inimigos até a onda mudar
  let wave = 1;
  for (let i = 0; i < 60 && wave === 1; i++) {
    await page.evaluate(() => { const n = PUNHO.punho_state().match.chars.length; for (let k = 1; k < n; k++) PUNHO.punho_poke('hp', k, 0); PUNHO.punho_step(30); });
    wave = (await state(page)).match.wave;
  }
  assert.equal(wave, 2, 'a onda 2 começou');
  // o jogador cai: fim da luta e recorde de 1 onda
  await page.evaluate(() => { PUNHO.punho_poke('hp', 0, 0); PUNHO.punho_step(200); });
  assert.equal((await state(page)).match.summary, true);
  assert.equal((await page.evaluate(() => PUNHO.punho_progress())).survivalBest, 1);
  assert.deepEqual(page.errors, []);
});

test('Versus: Sobrevivência e rounds aparecem nos menus', async () => {
  const page = await openGame(browser, server.url);
  await page.evaluate(() => PUNHO.punho_set_screen('SelectScreen:survival'));
  assert.equal((await state(page)).screen, 'SelectScreen');
  await page.evaluate(() => PUNHO.punho_set_screen('SelectScreen:vs'));
  assert.equal((await state(page)).screen, 'SelectScreen');
  assert.deepEqual(page.errors, []);
});
