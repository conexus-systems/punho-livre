# Arquitetura

O jogo é JavaScript puro rodando num `<canvas>`, sem bibliotecas nem etapa de build. O app
Android só abre `web/index.html` numa WebView. Os scripts são clássicos (não módulos) e a
ordem de carga está em `web/index.html`; `npm run check` confere que todos os arquivos de
`web/src/` estão listados.

## Camadas de `web/src/`

| Pasta | Papel |
|-------|-------|
| `core/` | `global.js` (constantes da simulação), `save.js` (ajustes e progresso), `assets.js` (dados, folhas de sprite e sons sintetizados), `input.js` (teclado, toque, controle, combos), `main.js` (inicialização e laço) |
| `content/` | Gerador de conteúdo: `painter.js` (desenho), `moves.js` (golpes e quadros), `roster.js` (elenco), `scenes.js` (cenários), `build.js` (monta tudo) |
| `engine/` | A simulação: `object.js` (quadros, física), `character.js`, `weapon.js`, `ball.js`, `effects.js`, `background.js`, `ai.js`, `match.js`, `stage.js` |
| `ui/` | Telas e HUD: `ui.js` (menus e seleção), `settings.js` (Ajustes, Sobre, Como jogar), `hud.js`, `logo.js` |
| `audio/` | `music.js`, a trilha sintetizada |
| `net/` | `net.js`, o jogo em rede |

## Laço do jogo

A lógica roda a 30 quadros por segundo (um "TU"), independente da taxa de desenho
(`core/main.js`). A cada TU, `Match.frame()` faz, nesta ordem:

1. teclas de função e menu de pausa;
2. busca as teclas de cada controle e passa pelos decodificadores de combo;
3. `transit()` de cada objeto (troca de quadro, combos), por tipo: lutadores, armas leves,
   armas pesadas, bebidas, ataques especiais;
4. tarefas agendadas (criação e remoção de objetos);
5. `TU()` de cada objeto: física, dano, colisões;
6. efeitos visuais e a IA (cada computador pensa a cada 3 a 9 TU, conforme a dificuldade);
7. a lógica do modo (História, Treino) ou a checagem de fim de luta.

## Dados por quadros

Cada lutador, arma e ataque é uma tabela de quadros: imagem (`pic`), duração (`wait`), próximo
quadro (`next`), estado (`state`), caixas de corpo (`bdy`) e de golpe (`itr`), ponto da arma
(`wpoint`), de agarrão (`cpoint`) e de criação de objetos (`opoint`). O motor lê essa tabela e
decide tudo: o que um golpe faz está no `itr`, não em código por personagem. A numeração dos
quadros (0 a 3 parado, 60 a 75 socos, 180 a 191 queda, 240 em diante especiais...) está no
cabeçalho de `engine/character.js` e `content/moves.js`.

## Conteúdo gerado

`content/build.js` monta, ao abrir o jogo:

1. para cada lutador de `roster.js`, o `FighterBuilder` (`moves.js`) cria os ~220 quadros a
   partir de poses (`POSE`, `ATK`) e dos golpes especiais (`SPECIALS`);
2. as caixas de corpo e de golpe saem das juntas de cada pose, então o desenho e a colisão
   batem;
3. `painter.js` desenha cada pose (esqueleto com membros cônicos, luz e sombra, rosto, cabelo,
   roupa) numa folha de sprites em canvas, mais retratos;
4. armas, bolas de energia, faíscas e cenários em camadas (`scenes.js`) são desenhados do mesmo
   jeito;
5. `core/assets.js` sintetiza os sons (ruído filtrado e tons) e `audio/music.js` toca a trilha.

Ordem determinística: tudo depende de `Random` com semente, nunca de `Math.random`, exceto o que
é só visual (poeira, tremor de tela, brilhos), que não entra na simulação.

## Jogo em rede

Lockstep: cada aparelho simula a partida inteira. O servidor (`server/server.js`) guarda as
salas (código de 4 letras, até 4 humanos) e só repassa as teclas de cada jogador, com 4 quadros
de atraso. Computadores e armas usam a mesma semente em todos. A cada 2 s os aparelhos trocam um
hash do estado (`hashMatch` em `net/net.js`); se divergir, aparece "Partida dessincronizada".
Por isso a simulação não pode usar `Math.random`, `Math.hypot` nem nada que dependa do aparelho.

## Android

`android/build.sh` monta o app sem Android SDK: `aapt2` (do `apktool-lib`) compila recursos e
manifesto, `smali` gera o `classes.dex` da `MainActivity` (escrita em smali), `apksig` assina o
APK e o `bundletool` gera o AAB. A atividade abre `web/` (copiado para os assets do app), liga o
botão voltar ao jogo (`window.androidBack`) e fecha o app pela tela inicial.

## Testes

`tests/` usa o executor de testes do Node e o Playwright: sobe o servidor numa porta livre, abre o
jogo no Chromium e confere o carregamento, todos os especiais, lutas aleatórias, menus e pausa,
salvamento, controles de toque e a sincronia do jogo em rede entre dois navegadores.
