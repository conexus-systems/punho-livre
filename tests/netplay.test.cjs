// Dois aparelhos na mesma sala: as duas simulações (Rust/WebAssembly) têm que dar o mesmo resultado.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, launch, openGame, screenName } = require('./helpers.cjs');

let server, browser;
before(async () => { server = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); server.stop(); });

const net = (p) => p.evaluate(() => PUNHO.punho_net());

test('partida em rede fica sincronizada nos dois lados', async () => {
  const A = await openGame(browser, server.url, { newContext: { viewport: { width: 794, height: 470 } } });
  const B = await openGame(browser, server.url, { newContext: { viewport: { width: 794, height: 470 } } });
  const host = new URL(server.url).host;

  await A.evaluate(() => PUNHO.punho_set_screen('NetScreen'));
  await A.fill('#net-server', host); await A.fill('#net-name', 'Ana'); await A.click('#net-create');
  await A.waitForFunction(() => PUNHO.punho_net().code && PUNHO.punho_screen() === 'NetLobbyScreen', null, { timeout: 8000 });
  const code = (await net(A)).code;
  assert.match(code, /^[A-Z]{4}$/);

  await B.evaluate(() => PUNHO.punho_set_screen('NetScreen'));
  await B.fill('#net-server', host); await B.fill('#net-name', 'Beto'); await B.fill('#net-code', code); await B.click('#net-join');
  await B.waitForFunction(() => PUNHO.punho_screen() === 'NetLobbyScreen' && PUNHO.punho_net().players === 2, null, { timeout: 8000 });
  await B.evaluate(() => PUNHO.punho_net_action('ready'));
  await A.waitForFunction(() => PUNHO.punho_net().allReady, null, { timeout: 8000 });

  await A.evaluate(() => PUNHO.punho_net_action('fight'));
  for (const p of [A, B]) await p.waitForFunction(() => PUNHO.punho_screen() === 'NetMatchScreen', null, { timeout: 8000 });

  // os dois apertam teclas durante alguns segundos (a abertura do round também conta nos dois lados)
  for (let i = 0; i < 12; i++) {
    for (const [p, k] of [[A, 'KeyD'], [B, 'KeyA']]) { await p.keyboard.down(k); }
    await A.keyboard.press('KeyS'); await B.keyboard.press('KeyS');
    await A.waitForTimeout(250);
    for (const [p, k] of [[A, 'KeyD'], [B, 'KeyA']]) { await p.keyboard.up(k); }
  }
  await A.waitForTimeout(2500);

  const [ha, hb] = [await net(A), await net(B)];
  assert.equal(ha.desync, false);
  assert.equal(hb.desync, false);
  const common = Object.keys(ha.hashes).filter((f) => f in hb.hashes);
  assert.ok(common.length >= 2, `poucos quadros comparados: ${common.length}`);
  for (const f of common) assert.equal(ha.hashes[f], hb.hashes[f], `divergiu no quadro ${f}`);
  assert.deepEqual(A.errors.concat(B.errors), []);
});
