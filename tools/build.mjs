// Gera dist/mugen-brawl.html: o jogo inteiro em um único arquivo HTML.
// Uso: node tools/build.mjs [--fragment caminho.html] [--android pasta]
//   --fragment também grava uma versão sem <html>/<head>/<body>, para ser
//   embutida em páginas que já fornecem esse esqueleto.
//   --android grava pasta/index.html para o APK: fontes locais (android/assets/fonts)
//   e o tratamento do botão voltar do celular.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
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

const webFonts = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fonts}">`;
const localFonts = `<style>
@font-face { font-family: 'Bungee'; font-weight: 400; src: url(fonts/bungee-400.woff2) format('woff2'); }
@font-face { font-family: 'Chakra Petch'; font-weight: 500; src: url(fonts/chakra-petch-500.woff2) format('woff2'); }
@font-face { font-family: 'Chakra Petch'; font-weight: 700; src: url(fonts/chakra-petch-700.woff2) format('woff2'); }
</style>`;
// Chamado pelo app Android quando o botão voltar é tocado.
const androidBridge = `
window.androidBack = function () {
  if (Game.screen instanceof TitleScreen) { if (window.AndroidApp) window.AndroidApp.exit(); return; }
  for (const type of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(type, { code: 'Escape' }));
};`;

const headWith = (fontTags) => `<title>Mugen Brawl</title>
${fontTags}
<style>
${css}</style>`;
const tailWith = (extra = '') => `${body}
<script>
${scripts}${extra}
</script>`;
const page = (h, t) => `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${h}
</head>
<body>
${t}
</body>
</html>
`;

const head = headWith(webFonts);
const tail = tailWith();
const full = page(head, tail);

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/mugen-brawl.html'), full);
console.log(`dist/mugen-brawl.html (${(full.length / 1024).toFixed(0)} KB)`);

const i = process.argv.indexOf('--fragment');
if (i > 0) {
  const out = process.argv[i + 1];
  writeFileSync(out, `${head.replace('<title>Mugen Brawl</title>', '<title>Mugen Brawl</title>\n<meta name="claude:viewport-fit-sides" content="cover">')}\n${tail}\n`);
  console.log(out);
}

const a = process.argv.indexOf('--android');
if (a > 0) {
  const dir = process.argv[a + 1];
  mkdirSync(join(dir, 'fonts'), { recursive: true });
  for (const f of readdirSync(join(root, 'android/assets/fonts'))) {
    copyFileSync(join(root, 'android/assets/fonts', f), join(dir, 'fonts', f));
  }
  writeFileSync(join(dir, 'index.html'), page(headWith(localFonts), tailWith(androidBridge)));
  console.log(join(dir, 'index.html'));
}
