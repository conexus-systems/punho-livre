#!/usr/bin/env bash
# Baixa os dados do Little Fighter 2 v1.9 (sprites, frames, cenários, sons) já
# convertidos pelo projeto F.LF e gera a pasta assets/ usada pelo jogo.
#
# Os dados do LF2 são de Marti Wong & Starsky Wong e NÃO fazem parte deste
# repositório: ficam em .lf2/ e assets/, que estão no .gitignore.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/.lf2/LF2_19"
if [ ! -d "$SRC" ]; then
  mkdir -p "$ROOT/.lf2"
  git clone --depth 1 https://github.com/Project-F/LF2_19 "$SRC"
fi
node "$ROOT/tools/import-lf2.mjs" "$SRC" "$ROOT/assets"
