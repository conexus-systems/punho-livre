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
  const info = await page.evaluate(() => ({
    fighters: Object.values(Assets.objects).filter((o) => o.type === 'character').length,
    scenes: Assets.backgrounds.length,
    sheets: Object.keys(Assets.images).filter((k) => /^gen\/fighter\d+$/.test(k)).length,
    sounds: Object.keys(Sound.buffers).length,
  }));
  assert.equal(info.fighters, 9, 'oito lutadores e o capanga');
  assert.equal(info.scenes, 6);
  assert.equal(info.sheets, 9);
});

test('os arquivos do jogo e o servidor respondem', async () => {
  for (const f of ['', 'style.css', 'src/core/main.js', 'fonts/bangers.woff2', 'health']) {
    const r = await fetch(server.url + f);
    assert.equal(r.status, 200, f || '/');
  }
  assert.equal((await fetch(server.url + 'server.js')).status, 404, 'o servidor não entrega arquivos fora do jogo');
});

test('ajustes padrão e salvamento', async () => {
  const page = await openGame(browser, server.url);
  const s = await page.evaluate(() => { Save.settings.sfx = 3; Save.save(); Save.load(); return Save.settings.sfx; });
  assert.equal(s, 3);
  await page.evaluate(() => { Save.resetProgress(); });
  assert.equal(await page.evaluate(() => Save.progress.fights), 0);
});
