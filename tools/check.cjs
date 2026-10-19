// Confere a sintaxe de todo o JavaScript do jogo e do servidor, a ordem dos scripts
// do index.html e se os arquivos referenciados existem.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
let failed = 0;
const fail = (msg) => { console.error('✗ ' + msg); failed++; };

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (/\.(js|cjs|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

for (const dir of ['web/src', 'server', 'tools', 'tests']) {
  for (const f of walk(path.join(ROOT, dir))) {
    const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
    if (r.status !== 0) fail(`${path.relative(ROOT, f)}: ${r.stderr.trim().split('\n')[0]}`);
  }
}

const html = fs.readFileSync(path.join(ROOT, 'web/index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
for (const s of scripts) if (!fs.existsSync(path.join(ROOT, 'web', s))) fail(`index.html referencia ${s}, que não existe`);
const onDisk = walk(path.join(ROOT, 'web/src')).map((f) => path.relative(path.join(ROOT, 'web'), f).split(path.sep).join('/'));
for (const f of onDisk) if (!scripts.includes(f)) fail(`${f} não está no index.html`);

if (failed) { console.error(`\n${failed} problema(s).`); process.exit(1); }
console.log(`✓ ${onDisk.length} arquivos do jogo e ${scripts.length} scripts conferidos`);
