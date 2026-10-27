// Conferência rápida: sintaxe do JavaScript que sobrou (servidor, testes e ferramentas),
// o index.html e o Rust (clippy para WebAssembly e para o app nativo, testes e o formato).
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
let failed = 0;
const fail = (msg) => { console.error('✗ ' + msg); failed++; };

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'pkg' || e.name === 'target' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (/\.(js|cjs|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

let n = 0;
for (const dir of ['server', 'tools', 'tests']) {
  for (const f of walk(path.join(ROOT, dir))) {
    n++;
    const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
    if (r.status !== 0) fail(`${path.relative(ROOT, f)}: ${r.stderr.trim().split('\n')[0]}`);
  }
}

// o index.html só pode carregar arquivos que existem (o pkg/ é gerado por tools/build-wasm.sh)
const html = fs.readFileSync(path.join(ROOT, 'web/index.html'), 'utf8');
for (const m of html.matchAll(/<script src="([^"]+)"/g)) {
  if (!m[1].startsWith('pkg/') && !fs.existsSync(path.join(ROOT, 'web', m[1]))) fail(`index.html referencia ${m[1]}, que não existe`);
}
if (!fs.existsSync(path.join(ROOT, 'rust/Cargo.lock'))) fail('rust/Cargo.lock não está no repositório');

const cargo = (args, label) => {
  const r = spawnSync('cargo', args, { cwd: path.join(ROOT, 'rust'), encoding: 'utf8' });
  if (r.status !== 0) fail(`${label}\n${(r.stderr || r.stdout).split('\n').slice(-25).join('\n')}`);
};
cargo(['fmt', '--check'], 'cargo fmt --check (rode "cargo fmt" na pasta rust/)');
cargo(['clippy', '--lib', '--target', 'wasm32-unknown-unknown', '--', '-D', 'warnings'], 'cargo clippy (WebAssembly)');
cargo(['clippy', '--all-targets', '--', '-D', 'warnings'], 'cargo clippy (app nativo)');
cargo(['test', '--lib'], 'cargo test');

if (failed) { console.error(`\n${failed} problema(s).`); process.exit(1); }
console.log(`✓ ${n} arquivos JavaScript, o index.html e o Rust (formato, clippy e testes) conferidos`);
