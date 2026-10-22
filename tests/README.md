# tests/

Testes de navegador com o executor do Node e o Playwright (Chromium). Cada arquivo sobe o
servidor numa porta livre, abre o jogo (Rust/WebAssembly) e fala com ele pelas funções
`PUNHO.punho_*` de [`rust/src/api.rs`](../rust/src/api.rs).

```bash
npm run build                             # gera web/pkg (obrigatório)
npx playwright install chromium
npm test                                  # todos
node --test tests/specials.test.cjs       # um só
```

| Arquivo | O que confere |
|---------|---------------|
| `smoke` | abre sem erros; elenco, cenários e imagens gerados; arquivos servidos; salvamento |
| `specials` | todos os golpes especiais saem com a sequência certa e gastam MP |
| `stress` | 12 lutas aleatórias de 4 lutadores e 6 lutas de computador contra computador, sem erros nem pânicos |
| `flow` | menus, ajustes, pausa e reinício, teclas de teste desligadas, estatísticas, treino e controle |
| `gameplay` | abertura de round, melhor de 3, tempo limite, combos, História e Sobrevivência |
| `touch` | botões de especial, correr pela borda do direcional, tamanho dos botões |
| `netplay` | dois navegadores na mesma sala ficam sincronizados |

Os testes unitários do Rust (sorteio com semente, detector de combos...) rodam com
`cargo test --lib` na pasta `rust/` e também fazem parte de `npm run check`.

`helpers.cjs` tem o servidor, o navegador, `openGame()` (que já junta os erros da página, inclusive
pânicos do Rust), `startMatch()` e `step()`, que roda quadros da lógica sem esperar o relógio.
