// Dois aparelhos na mesma sala: as duas simulações têm que dar o mesmo resultado.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, launch, openGame } = require('./helpers.cjs');

let server, browser;
before(async () => { server = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); server.stop(); });

test('partida em rede fica sincronizada nos dois lados', async () => {
  const A = await openGame(browser, server.url, { newContext: { viewport: { width: 794, height: 470 } } });
  const B = await openGame(browser, server.url, { newContext: { viewport: { width: 794, height: 470 } } });
  const host = new URL(server.url).host;

  await A.evaluate(() => Game.setScreen(new NetScreen()));
  await A.fill('#net-server', host); await A.fill('#net-name', 'Ana'); await A.click('#net-create');
  await A.waitForFunction(() => Net.code && PUNHO.Game.screen.constructor.name === 'NetLobbyScreen', null, { timeout: 8000 });
  const code = await A.evaluate(() => Net.code);

  await B.evaluate(() => Game.setScreen(new NetScreen()));
  await B.fill('#net-server', host); await B.fill('#net-name', 'Beto'); await B.fill('#net-code', code); await B.click('#net-join');
  await B.waitForFunction(() => Net.room && Net.room.players.length === 2, null, { timeout: 8000 });
  await B.evaluate(() => { Game.screen.me.ready = true; Game.screen.sendPick(); });
  await A.waitForFunction(() => Net.room.players.every((p) => p.ready || p.slot === Net.room.host));

  await A.evaluate(() => Game.screen.fight());
  for (const p of [A, B]) await p.waitForFunction(() => PUNHO.Game.screen.constructor.name === 'NetMatchScreen', null, { timeout: 8000 });

  // os dois apertam teclas durante alguns segundos
  for (let i = 0; i < 12; i++) {
    for (const [p, k] of [[A, 'KeyD'], [B, 'KeyA']]) { await p.keyboard.down(k); }
    await A.keyboard.press('KeyS'); await B.keyboard.press('KeyS');
    await A.waitForTimeout(250);
    for (const [p, k] of [[A, 'KeyD'], [B, 'KeyA']]) { await p.keyboard.up(k); }
  }
  await A.waitForTimeout(2500);

  const hashes = (p) => p.evaluate(() => ({ desync: PUNHO.Game.screen.desync, h: PUNHO.Game.screen.hashes }));
  const [ha, hb] = [await hashes(A), await hashes(B)];
  assert.equal(ha.desync, false);
  assert.equal(hb.desync, false);
  const common = Object.keys(ha.h).filter((f) => f in hb.h);
  assert.ok(common.length >= 2, `poucos quadros comparados: ${common.length}`);
  for (const f of common) assert.equal(ha.h[f], hb.h[f], `divergiu no quadro ${f}`);
  assert.deepEqual(A.errors.concat(B.errors), []);
});
