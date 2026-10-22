// Utilitários dos testes de navegador: servidor local, Playwright e uma página do jogo.
// O jogo é Rust compilado para WebAssembly: os testes falam com ele pelas funções `punho_*`
// expostas em `window.PUNHO` (rust/src/api.rs). Antes de rodar, gere o pacote: `npm run build`.
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..');

if (!fs.existsSync(path.join(ROOT, 'web', 'pkg', 'punho_bg.wasm'))) {
  throw new Error('web/pkg não existe: rode "npm run build" (compila o Rust para WebAssembly) antes dos testes.');
}

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

// abre o jogo e espera a tela inicial; page.errors junta os erros da página (inclusive pânicos do Rust)
async function openGame(browserOrContext, url, { viewport = { width: 794, height: 470 }, newContext } = {}) {
  const ctx = newContext ? await browserOrContext.newContext(newContext) : null;
  const page = ctx ? await ctx.newPage() : await browserOrContext.newPage({ viewport });
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.stack || e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.PUNHO && PUNHO.punho_screen() === 'TitleScreen', null, { timeout: 30000 });
  return page;
}

const screenName = (page) => page.evaluate(() => PUNHO.punho_screen());
const state = (page) => page.evaluate(() => PUNHO.punho_state());

async function press(page, key, n = 1) {
  for (let i = 0; i < n; i++) {
    await page.keyboard.down(key); await page.waitForTimeout(70);
    await page.keyboard.up(key); await page.waitForTimeout(70);
  }
}

// começa uma partida: players = [{ id, team, player (0-3 humano), ai (nível), pos: {x, z} }]
function startMatch(page, opts) {
  return page.evaluate((o) => PUNHO.punho_start_match(JSON.stringify(o)), opts);
}

// roda n quadros da lógica sem esperar o relógio
const step = (page, n) => page.evaluate((k) => PUNHO.punho_step(k), n);

module.exports = { ROOT, startServer, launch, openGame, screenName, state, press, startMatch, step };
