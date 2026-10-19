// Utilitários dos testes de navegador: servidor local, Playwright e uma página do jogo.
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function loadPlaywright() {
  try { return require('playwright'); } catch (e) { return require('/opt/node-tools/node_modules/playwright'); }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); });
    s.on('error', reject);
  });
}

// sobe server/server.js numa porta livre e espera ele responder
async function startServer() {
  const port = await freePort();
  const proc = spawn(process.execPath, [path.join(ROOT, 'server', 'server.js')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  const url = `http://localhost:${port}/`;
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(url + 'health'); if (r.ok) break; } catch (e) { /* ainda subindo */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  return { url, port, stop: () => proc.kill() };
}

// timers e renderização não podem ser reduzidos quando a aba fica em segundo plano
const BROWSER_ARGS = ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];

async function launch() {
  const { chromium } = loadPlaywright();
  return chromium.launch({ args: BROWSER_ARGS });
}

// abre o jogo e espera a tela inicial; page.errors junta os erros da página
async function openGame(browserOrContext, url, { viewport = { width: 794, height: 470 }, newContext } = {}) {
  const ctx = newContext ? await browserOrContext.newContext(newContext) : null;
  const page = ctx ? await ctx.newPage() : await browserOrContext.newPage({ viewport });
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.stack || e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.PUNHO && PUNHO.Game.screen.constructor.name === 'TitleScreen', null, { timeout: 30000 });
  return page;
}

const screenName = (page) => page.evaluate(() => PUNHO.Game.screen.constructor.name);

async function press(page, key, n = 1) {
  for (let i = 0; i < n; i++) {
    await page.keyboard.down(key); await page.waitForTimeout(70);
    await page.keyboard.up(key); await page.waitForTimeout(70);
  }
}

module.exports = { ROOT, startServer, launch, openGame, screenName, press };
