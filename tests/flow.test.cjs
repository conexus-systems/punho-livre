// Navegação pelos menus, pausa, salvamento, treino e controle bluetooth.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, launch, openGame, screenName, press } = require('./helpers.cjs');

let server, browser;
before(async () => { server = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); server.stop(); });

test('Ajustes: muda o volume, salva e volta', async () => {
  const page = await openGame(browser, server.url);
  await press(page, 'KeyX', 2); await press(page, 'KeyS');
  assert.equal(await screenName(page), 'SettingsScreen');
  const before = await page.evaluate(() => Save.settings.sfx);
  await press(page, 'KeyA');
  assert.equal(await page.evaluate(() => Save.settings.sfx), before - 1);
  await press(page, 'Escape');
  assert.equal(await screenName(page), 'TitleScreen');
  assert.deepEqual(page.errors, []);
});

test('Sobre e Como jogar abrem', async () => {
  const page = await openGame(browser, server.url);
  await press(page, 'KeyX', 3); await press(page, 'KeyS');
  assert.equal(await screenName(page), 'AboutScreen');
  await press(page, 'Escape');
  await press(page, 'KeyS'); // Jogar
  await press(page, 'KeyX', 3); await press(page, 'KeyS'); // Como jogar
  assert.equal(await screenName(page), 'HowToScreen');
  assert.deepEqual(page.errors, []);
});

test('pausa: Esc abre o menu, continuar volta e sair encerra a luta', async () => {
  const page = await openGame(browser, server.url);
  await page.evaluate(() => startMatch({ players: [{ id: 1, team: 1, con: Input.controllers[0], player: 0 }, { id: 4, team: 2, con: new Controller(), ai: 1 }], bg: 2, mode: 'vs', onEnd: () => Game.setScreen(new TitleScreen()) }));
  await page.waitForTimeout(400);
  await press(page, 'Escape');
  assert.equal(await page.evaluate(() => PUNHO.Game.screen.match.paused), true);
  await press(page, 'KeyS'); // Continuar
  assert.equal(await page.evaluate(() => PUNHO.Game.screen.match.paused), false);
  await press(page, 'Escape'); await press(page, 'KeyX', 2); await press(page, 'KeyS'); // Sair da luta
  await page.waitForTimeout(200);
  assert.equal(await screenName(page), 'TitleScreen');
});

test('teclas de teste ficam desligadas sem ?dev', async () => {
  const page = await openGame(browser, server.url);
  await page.evaluate(() => startMatch({ players: [{ id: 1, team: 1, con: Input.controllers[0], player: 0 }, { id: 4, team: 2, con: new Controller(), ai: 0 }], bg: 2, mode: 'vs', onEnd: () => {} }));
  await page.evaluate(() => { PUNHO.Game.screen.match.characters()[0].health.hp = 100; });
  await press(page, 'F7'); await page.waitForTimeout(200);
  assert.ok(await page.evaluate(() => PUNHO.Game.screen.match.characters()[0].health.hp) < 200, 'F7 não pode encher a vida');
});

test('o resultado da luta entra nas estatísticas', async () => {
  const page = await openGame(browser, server.url);
  await page.evaluate(() => { Save.resetProgress(); startMatch({ players: [{ id: 1, team: 1, con: Input.controllers[0], player: 0 }, { id: 4, team: 2, con: new Controller(), ai: 0 }], bg: 2, mode: 'vs', onEnd: () => {} }); });
  await page.evaluate(() => { for (const c of PUNHO.Game.screen.match.characters()) if (c.player < 0) c.health.hp = 0; });
  await page.waitForTimeout(2500);
  const p = await page.evaluate(() => Save.progress);
  assert.equal(p.fights, 1);
  assert.equal(p.wins, 1);
});

test('treino: boneco não cai e o MP é infinito', async () => {
  const page = await openGame(browser, server.url);
  await press(page, 'KeyS'); await press(page, 'KeyX', 2); await press(page, 'KeyS'); // Jogar > Treino
  assert.equal(await screenName(page), 'SelectScreen');
  await press(page, 'KeyS'); await press(page, 'KeyS'); // entra e confirma o lutador
  await page.waitForTimeout(400);
  const m = await page.evaluate(() => ({ mode: PUNHO.Game.screen.match.mode }));
  assert.equal(m.mode, 'training');
  await page.evaluate(() => { const c = PUNHO.Game.screen.match.characters(); c[0].health.mp = 1; c[1].health.hp = 1; });
  await page.waitForTimeout(300);
  const s = await page.evaluate(() => PUNHO.Game.screen.match.characters().map((c) => ({ hp: c.health.hp, mp: c.health.mp })));
  assert.ok(s[0].mp > 400);
  assert.ok(s[1].hp > 100);
});

test('controle: o botão A confirma no menu', async () => {
  const page = await openGame(browser, server.url);
  await page.evaluate(() => {
    window.__pad = { index: 0, connected: true, axes: [0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false })) };
    navigator.getGamepads = () => [window.__pad];
  });
  await page.evaluate(() => { __pad.buttons[0].pressed = true; });
  await page.waitForTimeout(120);
  await page.evaluate(() => { __pad.buttons[0].pressed = false; });
  await page.waitForTimeout(100);
  assert.equal(await screenName(page), 'ModeScreen');
});
