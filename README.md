# Punho Livre

Jogo de luta 2.5D para navegador e Android, para até 8 lutadores, com jogo em rede.
Todo o conteúdo (lutadores, golpes, cenários, efeitos, sons e música) é gerado por código
ao abrir o jogo, então o repositório não tem arte nem áudio de terceiros.

[![CI](https://github.com/conexus-systems/punho-livre/actions/workflows/ci.yml/badge.svg)](https://github.com/conexus-systems/punho-livre/actions/workflows/ci.yml)

## Começando

```bash
npm install
npm install --prefix server
npm start                 # http://localhost:8080/
```

Também dá para abrir `web/index.html` direto no navegador (só o jogo em rede precisa do servidor).

## O que tem neste repositório

| Pasta | Conteúdo |
|-------|----------|
| [`web/`](web/) | O jogo: `index.html`, `style.css`, fonte e todo o JavaScript em `web/src/` |
| [`server/`](server/) | Servidor Node das salas de jogo em rede (e que também entrega o jogo) |
| [`android/`](android/) | App Android nativo (Kotlin, Gradle) com anúncios AdMob |
| [`store/`](store/) | Ficha da Play Store: textos, arte, política de privacidade, checklist |
| [`tests/`](tests/) | Testes automáticos de navegador (Playwright) |
| [`tools/`](tools/) | Conferência de sintaxe e gerador da arte da loja |
| [`docs/`](docs/) | Guia do jogo, arquitetura e como desenvolver |

## Comandos

| Comando | O que faz |
|---------|-----------|
| `npm start` | Servidor local do jogo e das salas de rede |
| `npm run check` | Confere sintaxe e a lista de scripts do `index.html` |
| `npm test` | Roda os testes de navegador (precisa de `npx playwright install chromium`) |
| `npm run apk` | Gera o APK de depuração em `android/app/build/outputs/apk/debug/` |
| `npm run aab` | Gera o AAB de release (pacote da Play Store; exige IDs do AdMob, ver `store/CHECKLIST.md`) |
| `npm run store-assets` | Regera ícone, gráfico e capturas de tela em `store/` |

## Documentação

- [Guia do jogo](docs/JOGO.md): lutadores, controles, modos e jogo em rede
- [Arquitetura](docs/ARQUITETURA.md): como o motor, o conteúdo gerado e a rede funcionam
- [Desenvolvimento](docs/DESENVOLVIMENTO.md): como rodar, testar, criar lutadores e publicar
- [Publicação na Play Store](store/CHECKLIST.md) e [pontos legais](store/LEGAL.md)

## Créditos e licença

- Lutadores, golpes, cenários, efeitos, sons e músicas: criados para o Punho Livre.
- O motor (estados, transições de quadro, colisões) foi escrito tomando como referência o
  [F.LF](https://github.com/Project-F/F.LF), sob GPLv3. A licença deste repositório ainda
  precisa ser definida; veja [`store/LEGAL.md`](store/LEGAL.md).
- Fonte Bangers de Vernon Adams (SIL Open Font License 1.1).
