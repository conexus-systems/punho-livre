// Gera a arte da ficha da Play Store em store/: ícone 512, gráfico de recursos
// 1024x500 e capturas de tela 1920x1080, tudo a partir do próprio jogo (Rust/WebAssembly).
//   npm run build && npm run store-assets
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'store');
const SHOTS = path.join(OUT, 'screenshots');
const URL = 'file://' + path.join(ROOT, 'web', 'index.html');

const ready = async (page) => {
  await page.goto(URL);
  await page.waitForFunction(() => window.PUNHO && PUNHO.punho_screen() === 'TitleScreen', null, { timeout: 30000 });
};
const save = (name, dataUrl) => fs.writeFileSync(path.join(OUT, name), Buffer.from(dataUrl.split(',')[1], 'base64'));

(async () => {
  if (!fs.existsSync(path.join(ROOT, 'web', 'pkg', 'punho_wasm.js'))) throw new Error('rode "npm run build" antes');
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const f of fs.readdirSync(SHOTS)) if (f.endsWith('.png')) fs.unlinkSync(path.join(SHOTS, f));
  const browser = await chromium.launch();

  // ---- ícone e gráfico de recursos ----
  {
    const page = await browser.newPage();
    await ready(page);
    const art = await page.evaluate(() => ({ icon: PUNHO.punho_store_art('icon'), feature: PUNHO.punho_store_art('feature') }));
    save('icon-512.png', art.icon);
    save('feature-1024x500.png', art.feature);
    await page.close();
  }

  // ---- capturas de tela (celular deitado, 1920x1080) ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await ready(page);
    await page.touchscreen.tap(960, 540);
    await page.waitForTimeout(300);
    let n = 0;
    const shot = async (label) => { n++; await page.screenshot({ path: path.join(SHOTS, `${String(n).padStart(2, '0')}-${label}.png`) }); };
    const key = async (k, times = 1) => { for (let i = 0; i < times; i++) { await page.keyboard.down(k); await page.waitForTimeout(60); await page.keyboard.up(k); await page.waitForTimeout(60); } };
    const fight = async (opts, frames) => {
      await page.evaluate((o) => PUNHO.punho_start_match(JSON.stringify(o)), { weapons: true, ...opts });
      await page.evaluate((f) => {
        PUNHO.punho_step(f);
        const n = PUNHO.punho_state().match.chars.length;
        for (let i = 0; i < n; i++) PUNHO.punho_poke('mp', i, 500);
        PUNHO.punho_step(6);
      }, frames);
      await page.waitForTimeout(150);
    };
    const four = (ids, ai = 2) => ids.map((id, i) => ({ id, team: i < 2 ? 1 : 2, player: i === 0 ? 0 : undefined, ai: i === 0 ? undefined : ai, name: i === 0 ? '1P' : 'COM', pos: { x: 520 + i * 120, z: 420 + (i % 2) * 50 } }));

    await shot('titulo');
    await page.evaluate(() => PUNHO.punho_set_screen('SelectScreen:vs'));
    await page.waitForTimeout(200);
    await key('KeyS'); await key('Enter'); await key('ArrowRight', 3);
    await page.waitForTimeout(250); await shot('selecao');
    await fight({ bg: 2, mode: 'vs', rounds: 3, timeLimit: 60, players: four([1, 2, 3, 4]) }, 330);
    await shot('luta');
    await fight({ bg: 1, mode: 'vs', players: four([5, 6, 7, 8]) }, 300);
    await shot('luta');
    await fight({ bg: 3, mode: 'survival', weapons: false, players: [{ id: 3, team: 1, player: 0, name: '1P' }] }, 420);
    await shot('sobrevivencia');
    await fight({ bg: 4, mode: 'stage', weapons: false, players: [{ id: 2, team: 1, player: 0, name: '1P' }] }, 330);
    await shot('historia');
    await fight({ bg: 5, mode: 'vs', players: [{ id: 6, team: 1, player: 0, name: '1P' }, { id: 4, team: 2, ai: 2, name: 'COM' }] }, 200);
    await page.evaluate(() => { PUNHO.punho_poke('hp', 1, 0); PUNHO.punho_step(48); });
    await page.waitForTimeout(150);
    await shot('ko');
    await page.evaluate(() => PUNHO.punho_set_screen('SelectScreen:vs'));
    await page.waitForTimeout(200);
    await key('KeyS'); await key('KeyS'); await key('KeyS');
    await page.waitForTimeout(250); await shot('ajustes-da-partida');
    await ctx.close();
  }
  await browser.close();
  console.log('Arte da loja gerada em', OUT);
})();
