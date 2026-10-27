#!/usr/bin/env bash
# Compila o jogo (rust/) para WebAssembly e deixa o resultado em web/pkg/:
#   punho.js        cola gerada pelo wasm-bindgen (sem módulos ES, para abrir via file://)
#   punho_bg.wasm   o jogo
#   punho_wasm.js   o mesmo .wasm em base64, para o app Android e para abrir o index.html direto
# Uso: tools/build-wasm.sh [release|dev]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROFILE="${1:-release}"
cd "$ROOT/rust"
if [ "$PROFILE" = dev ]; then
  cargo build --lib --target wasm32-unknown-unknown
  WASM="target/wasm32-unknown-unknown/debug/punho_livre.wasm"
else
  cargo build --release --lib --target wasm32-unknown-unknown
  WASM="target/wasm32-unknown-unknown/release/punho_livre.wasm"
fi
mkdir -p "$ROOT/web/pkg"
wasm-bindgen --target no-modules --no-typescript --out-dir "$ROOT/web/pkg" --out-name punho "$WASM"
python3 - "$ROOT/web/pkg" <<'PY'
import base64, sys, os
d = sys.argv[1]
raw = open(os.path.join(d, 'punho_bg.wasm'), 'rb').read()
with open(os.path.join(d, 'punho_wasm.js'), 'w') as f:
    f.write('// gerado por tools/build-wasm.sh: o punho_bg.wasm em base64\n')
    f.write('const PUNHO_WASM_B64 = "' + base64.b64encode(raw).decode() + '";\n')
print('wasm: %d KB (%d KB em base64)' % (len(raw) // 1024, os.path.getsize(os.path.join(d, 'punho_wasm.js')) // 1024))
PY
