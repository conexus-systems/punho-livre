const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, launch, openGame } = require('./helpers.cjs');

let server, browser;
before(async () => { server = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); server.stop(); });

test('o jogo abre na tela inicial sem erros', async () => {
  const page = await openGame(browser, server.url);
  assert.deepEqual(page.errors, []);
});

test('elenco, cenários e imagens foram gerados', async () => {
  const page = await openGame(browser, server.url);
  const info = await page.evaluate(() => PUNHO.punho_assets_info());
  assert.equal(info.fighters, 9, 'oito lutadores e o capanga');
  assert.equal(info.scenes, 6);
  assert.equal(info.sheets, 9);
});

test('os arquivos do jogo e o servidor respondem', async () => {
  for (const f of ['', 'style.css', 'pkg/punho.js', 'pkg/punho_bg.wasm', 'pkg/punho_wasm.js', 'fonts/bangers.woff2', 'health']) {
    const r = await fetch(server.url + f);
    assert.equal(r.status, 200, f || '/');
  }
  assert.equal((await fetch(server.url + 'server.js')).status, 404, 'o servidor não entrega arquivos fora do jogo');
  assert.equal((await fetch(server.url + 'Cargo.toml')).status, 404);
});

test('ajustes padrão e salvamento', async () => {
  const page = await openGame(browser, server.url);
  await page.evaluate(() => { PUNHO.punho_setting('sfx', 3); PUNHO.punho_save_reload(); });
  assert.equal((await page.evaluate(() => PUNHO.punho_settings())).sfx, 3);
  const s = await page.evaluate(() => PUNHO.punho_settings());
  assert.equal(s.shake, 1, 'tremor de tela ligado por padrão');
  assert.equal(s.hitNumbers, 1, 'números de dano ligados por padrão');
  await page.evaluate(() => PUNHO.punho_reset_progress());
  assert.equal((await page.evaluate(() => PUNHO.punho_progress())).fights, 0);
});
