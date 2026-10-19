# tests/

Testes de navegador com o executor do Node e o Playwright (Chromium). Cada arquivo sobe o
servidor numa porta livre e abre o jogo.

```bash
npx playwright install chromium
npm test                                  # todos
node --test tests/specials.test.cjs       # um só
```

| Arquivo | O que confere |
|---------|---------------|
| `smoke` | abre sem erros; elenco, cenários e imagens gerados; arquivos servidos; salvamento |
| `specials` | todos os golpes especiais saem com a sequência certa e gastam MP |
| `stress` | 12 lutas aleatórias de 4 lutadores sem erros |
| `flow` | menus, ajustes, pausa, teclas de teste desligadas, estatísticas, treino e controle |
| `touch` | botões de especial, correr pela borda do direcional, tamanho dos botões |
| `netplay` | dois navegadores na mesma sala ficam sincronizados |

`helpers.cjs` tem o servidor, o navegador e `openGame()`, que já junta os erros da página.
