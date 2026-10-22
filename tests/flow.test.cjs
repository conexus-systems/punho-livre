// Navegação pelos menus, pausa, salvamento, treino e controle bluetooth.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, launch, openGame, screenName, state, press, startMatch, step } = require('./helpers.cjs');

let server, browser;
before(async () => { server = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); server.stop(); });

const duel = (extra = {}) => ({ players: [{ id: 1, team: 1, player: 0 }, { id: 4, team: 2, ai: 0 }], bg: 2, mode: 'vs', weapons: false, ...extra });

test('Ajustes: muda o volume, salva e volta', async () => {
  const page = await openGame(browser, server.url);
  await press(page, 'KeyX', 2); await press(page, 'KeyS');
  assert.equal(await screenName(page), 'SettingsScreen');
  const before = (await page.evaluate(() => PUNHO.punho_settings())).sfx;
  await press(page, 'KeyA');
  assert.equal((await page.evaluate(() => PUNHO.punho_settings())).sfx, before - 1);
  await press(page, 'Escape');
  assert.equal(await screenName(page), 'TitleScreen');
  assert.deepEqual(page.errors, []);
});

test('Ajustes: tremor de tela e números de dano podem ser desligados', async () => {
  const page = await openGame(browser, server.url);
  await press(page, 'KeyX', 2); await press(page, 'KeyS');
  await press(page, 'KeyX', 6); // tremor de tela
  await press(page, 'KeyD');
  assert.equal((await page.evaluate(() => PUNHO.punho_settings())).shake, 0);
  await press(page, 'KeyX'); await press(page, 'KeyD');
  assert.equal((await page.evaluate(() => PUNHO.punho_settings())).hitNumbers, 0);
  assert.deepEqual(page.errors, []);
});

test('Sobre e Como jogar abrem', async () => {
  const page = await openGame(browser, server.url);
  await press(page, 'KeyX', 3); await press(page, 'KeyS');
  assert.equal(await screenName(page), 'AboutScreen');
  await press(page, 'Escape');
  await press(page, 'KeyS'); // Jogar
  await press(page, 'KeyX', 4); await press(page, 'KeyS'); // Como jogar
  assert.equal(await screenName(page), 'HowToScreen');
  assert.deepEqual(page.errors, []);
});

test('pausa: Esc abre o menu, continuar volta, reiniciar recomeça e sair encerra a luta', async () => {
  const page = await openGame(browser, server.url);
  await startMatch(page, duel());
  await step(page, 60);
  await press(page, 'Escape');
  assert.equal((await state(page)).match.paused, true);
  await press(page, 'KeyS'); // Continuar
  assert.equal((await state(page)).match.paused, false);
  const t0 = (await state(page)).match.time;
  assert.ok(t0 > 50);
  await press(page, 'Escape'); await press(page, 'KeyX'); await press(page, 'KeyS'); // Reiniciar
  await page.waitForTimeout(200);
  const s = await state(page);
  assert.equal(s.screen, 'MatchScreen');
  assert.ok(s.match.time < t0, 'a luta recomeçou do zero');
  assert.equal(s.match.paused, false);
  await press(page, 'Escape'); await press(page, 'KeyX', 3); await press(page, 'KeyS'); // Sair da luta
  await page.waitForTimeout(200);
  assert.equal(await screenName(page), 'TitleScreen');
  assert.deepEqual(page.errors, []);
});

test('teclas de teste ficam desligadas sem ?dev', async () => {
  const page = await openGame(browser, server.url);
  await startMatch(page, duel({ players: [{ id: 1, team: 1, player: 0 }, { id: 4, team: 2, ai: 0 }] }));
  await page.evaluate(() => PUNHO.punho_poke('hp', 0, 100));
  await press(page, 'F7'); await page.waitForTimeout(200);
  assert.ok((await state(page)).match.chars[0].hp < 200, 'F7 não pode encher a vida');
});

test('o resultado da luta entra nas estatísticas', async () => {
  const page = await openGame(browser, server.url);
  await page.evaluate(() => PUNHO.punho_reset_progress());
  await startMatch(page, duel());
  await step(page, 60);
  await page.evaluate(() => PUNHO.punho_poke('hp', 1, 0));
  await step(page, 200);
  assert.equal((await state(page)).match.summary, true);
  const p = await page.evaluate(() => PUNHO.punho_progress());
  assert.equal(p.fights, 1);
  assert.equal(p.wins, 1);
});

test('treino: boneco não cai e o MP é infinito', async () => {
  const page = await openGame(browser, server.url);
  await press(page, 'KeyS'); await press(page, 'KeyX', 3); await press(page, 'KeyS'); // Jogar > Treino
  assert.equal(await screenName(page), 'SelectScreen');
  await press(page, 'KeyS'); await press(page, 'KeyS'); // entra e confirma o lutador
  await page.waitForTimeout(400);
  assert.equal((await state(page)).match.mode, 'training');
  await page.evaluate(() => { PUNHO.punho_poke('mp', 0, 1); PUNHO.punho_poke('hp', 1, 1); });
  await page.waitForTimeout(300);
  const c = (await state(page)).match.chars;
  assert.ok(c[0].mp > 400);
  assert.ok(c[1].hp > 100);
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
  assert.deepEqual(page.errors, []);
});
