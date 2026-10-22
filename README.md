# Punho Livre

Jogo de luta 2.5D para navegador e Android, para até 8 lutadores, com jogo em rede.
Escrito em **Rust** e compilado para WebAssembly. Todo o conteúdo (lutadores, golpes, cenários,
efeitos, sons e música) é gerado por código ao abrir o jogo, então o repositório não tem arte
nem áudio de terceiros.

[![CI](https://github.com/conexus-systems/punho-livre/actions/workflows/ci.yml/badge.svg)](https://github.com/conexus-systems/punho-livre/actions/workflows/ci.yml)

## Começando

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.129 --locked   # a versão tem que bater com rust/Cargo.toml
npm install
npm install --prefix server
npm run build             # compila o Rust para WebAssembly em web/pkg/
npm start                 # http://localhost:8080/
```

Depois de `npm run build`, também dá para abrir `web/index.html` direto no navegador (só o jogo
em rede precisa do servidor).

## O que tem neste repositório

| Pasta | Conteúdo |
|-------|----------|
| [`rust/`](rust/) | O jogo: motor, conteúdo gerado, telas, som e rede, em Rust |
| [`web/`](web/) | A página: `index.html`, `style.css`, fonte e o `pkg/` gerado pelo build |
| [`server/`](server/) | Servidor Node das salas de jogo em rede (e que também entrega o jogo) |
| [`android/`](android/) | App Android (WebView) e o build do APK/AAB sem Android SDK |
| [`store/`](store/) | Ficha da Play Store: textos, arte, política de privacidade, checklist |
| [`tests/`](tests/) | Testes automáticos de navegador (Playwright) |
| [`tools/`](tools/) | Build do WebAssembly, conferência e gerador da arte da loja |
| [`docs/`](docs/) | Guia do jogo, arquitetura e como desenvolver |

## Comandos

| Comando | O que faz |
|---------|-----------|
| `npm start` | Servidor local do jogo e das salas de rede |
| `npm run build` | Compila o Rust (release) para `web/pkg/` |
| `npm run check` | Confere formato, clippy e testes do Rust, e a sintaxe do JavaScript que sobrou |
| `npm test` | Roda os testes de navegador (precisa de `npm run build` e `npx playwright install chromium`) |
| `npm run apk` | Gera `dist/punho-livre.apk` |
| `npm run aab` | Gera `dist/punho-livre.aab` (pacote da Play Store) |
| `npm run store-assets` | Regera ícone, gráfico e capturas de tela em `store/` |

## Documentação

- [Mudanças](CHANGELOG.md): o que mudou em cada versão
- [Guia do jogo](docs/JOGO.md): lutadores, controles, modos e jogo em rede
- [Arquitetura](docs/ARQUITETURA.md): como o motor, o conteúdo gerado e a rede funcionam
- [Desenvolvimento](docs/DESENVOLVIMENTO.md): como rodar, testar, criar lutadores e publicar
- [Publicação na Play Store](store/CHECKLIST.md) e [pontos legais](store/LEGAL.md)

## Créditos e licença

- Lutadores, golpes, cenários, efeitos, sons e músicas: criados para o Punho Livre.
- O motor (estados, transições de quadro, colisões), agora em Rust, foi escrito tomando como referência o
  [F.LF](https://github.com/Project-F/F.LF), sob GPLv3. A licença deste repositório ainda
  precisa ser definida; veja [`store/LEGAL.md`](store/LEGAL.md).
- Fonte Bangers de Vernon Adams (SIL Open Font License 1.1).
