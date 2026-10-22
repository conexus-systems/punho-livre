// Controles de toque no celular: botões de especial, correr pela borda do direcional e ajustes.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, launch, openGame, startMatch, state } = require('./helpers.cjs');

let server, browser;
before(async () => { server = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); server.stop(); });

const phone = { viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 };

async function startTouchMatch(page) {
  await page.touchscreen.tap(450, 200);
  await page.waitForTimeout(300);
  await startMatch(page, { players: [{ id: 1, team: 1, player: 0, pos: { x: 300, z: 420 } }, { id: 3, team: 2 }], bg: 2, mode: 'vs', weapons: false });
  await page.waitForTimeout(2200); // passa da abertura do round
}

test('mostra os botões de especial do lutador e o toque dispara o golpe', async () => {
  const page = await openGame(browser, server.url, { newContext: phone });
  await startTouchMatch(page);
  const labels = await page.$$eval('#touch .specials button', (bs) => bs.map((b) => b.textContent));
  assert.equal(labels.length, 3);
  const mp0 = (await state(page)).match.chars[0].mp;
  await (await page.$('#touch .specials button')).dispatchEvent('pointerdown');
  await page.waitForTimeout(300);
  const mp1 = (await state(page)).match.chars[0].mp;
  assert.ok(mp1 < mp0, 'o especial gasta MP');
  assert.deepEqual(page.errors, []);
});

test('dedo na borda do direcional faz correr', async () => {
  const page = await openGame(browser, server.url, { newContext: phone });
  await startTouchMatch(page);
  const pad = await (await page.$('.dpad')).boundingBox();
  await page.evaluate(([x, y]) => document.querySelector('.dpad').dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, pointerId: 5, bubbles: true })), [pad.x + pad.width * 0.98, pad.y + pad.height / 2]);
  // estado 2 = correndo (dá alguns quadros para o toque duplo virar corrida)
  await page.waitForFunction(() => PUNHO.punho_state().match.chars[0].state === 2, null, { timeout: 3000 });
});

test('tamanho dos botões vem dos ajustes salvos', async () => {
  const page = await openGame(browser, server.url, { newContext: phone });
  await page.evaluate(() => PUNHO.punho_setting('touchScale', 4));
  await page.touchscreen.tap(450, 200);
  const zoom = await page.evaluate(() => getComputedStyle(document.querySelector('.dpad')).zoom);
  assert.ok(Number(zoom) < 0.9, `zoom ${zoom}`);
});
