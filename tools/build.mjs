// Gera dist/mugen-brawl.html: o jogo inteiro em um único arquivo HTML.
// Uso: node tools/build.mjs [--fragment caminho.html]
//   --fragment também grava uma versão sem <html>/<head>/<body>, para ser
//   embutida em páginas que já fornecem esse esqueleto.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');

const body = html.match(/<!--BUILD:BODY-->([\s\S]*?)<!--\/BUILD:BODY-->/)[1].trim();
const fonts = html.match(/<link rel="stylesheet" href="(https:\/\/fonts[^"]+)">/)[1];
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)]
  .map((m) => `// ---- ${m[1]} ----\n` + readFileSync(join(root, m[1]), 'utf8'))
  .join('\n');

const head = `<title>Mugen Brawl</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fonts}">
<style>
${css}</style>`;
const tail = `${body}
<script>
${scripts}
</script>`;

const full = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${head}
</head>
<body>
${tail}
</body>
</html>
`;

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/mugen-brawl.html'), full);
console.log(`dist/mugen-brawl.html (${(full.length / 1024).toFixed(0)} KB)`);

const i = process.argv.indexOf('--fragment');
if (i > 0) {
  const out = process.argv[i + 1];
  writeFileSync(out, `${head.replace('<title>Mugen Brawl</title>', '<title>Mugen Brawl</title>\n<meta name="claude:viewport-fit-sides" content="cover">')}\n${tail}\n`);
  console.log(out);
}
