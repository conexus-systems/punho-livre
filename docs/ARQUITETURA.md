# Arquitetura

O jogo é Rust (`rust/`) com **dois alvos que compartilham o mesmo motor**: WebAssembly, desenhado
num `<canvas>` 2D no navegador, e um **app nativo** (computador e Android), sem WebView. A simulação,
o conteúdo gerado, as telas e a rede são o mesmo código; só mudam as pontas que falam com o sistema,
escolhidas por `cfg(target_arch = "wasm32")`.

```
rust/src ──cargo + wasm-bindgen──▶ web/pkg/{punho.js, punho_bg.wasm, punho_wasm.js} ◀── web/index.html
   │                                (navegador: Canvas 2D, Web Audio, WebSocket, localStorage, botões HTML)
   └──cargo (cargo-ndk no Android)──▶ punho (computador) · libpunho_livre.so (Android)
                                    (nativo: tiny-skia, mixer cpal, tungstenite, arquivo de save, toque desenhado)
```

| Ponta | Navegador (`wasm32`) | App nativo |
|-------|----------------------|------------|
| Desenho (`gfx/`) | `web.rs`: Canvas 2D | `native.rs`: `tiny-skia` (caminhos, gradientes, recorte, sombra) e texto por contornos (`ttf-parser`) com as fontes de `rust/assets/fonts` |
| Som (`audio/`) | `web_sound.rs`, `web_music.rs`: Web Audio | `mixer.rs`: mixer sobre o `cpal`, trilha renderizada em laço |
| Geradores de som e faixas | `audio/synth.rs` (comum aos dois) | |
| Entrada e toque | teclas e botões do DOM (`ui/touch/web.rs`) | `winit` (teclado, toque, mouse) e controles desenhados por cima da janela (`ui/touch/native.rs`) |
| Rede (`net/`) | `web.rs`: WebSocket do navegador e formulário HTML | `native.rs`: `tungstenite` numa thread e tela de conexão desenhada no jogo |
| Salvamento (`platform.rs`) | `localStorage` | `save.json` na pasta de dados do app |
| Laço e janela | `game::boot` e `requestAnimationFrame` | `native/app.rs`: `winit` + `softbuffer`, 30 TU por segundo |

## Camadas de `rust/src/`

| Módulo | Papel |
|--------|-------|
| `core/` | `consts` (constantes da simulação e o `Random` com semente), `input` (teclado, controle, combos), `save` (ajustes e progresso no `localStorage`) |
| `gfx` | Interface curta do Canvas 2D (`Ctx`), folhas de sprites, texto e painéis |
| `content/` | Gerador de conteúdo: `painter` (desenho), `moves` (golpes e quadros), `roster` (elenco), `scenes` (cenários), `build` (monta tudo, em passos para a barra de carregamento) |
| `engine/` | A simulação: `object` (quadros, física, arena de objetos), `character`, `weapon`, `ball`, `effects`, `background`, `ai`, `match` (a partida e os rounds), `stage` (História), `survival` (Sobrevivência), `data` (tabelas de quadros) |
| `ui/` | Telas e HUD: `screens` (título, modos, controles, partida), `select`, `settings` (Ajustes, Sobre, Como jogar), `hud`, `logo`, `touch` (controles de toque) |
| `audio/` | `sound` (efeitos sintetizados) e `music` (a trilha) |
| `net` | O jogo em rede (conexão, sala e partida em *lockstep*) |
| `game`, `api` | O laço principal e as funções expostas ao JavaScript (`window.PUNHO`) para a página e para os testes |

## Laço do jogo

A lógica roda a 30 quadros por segundo (um "TU"), independente da taxa de desenho (`game.rs`).
A cada TU, `Match::frame()` faz, nesta ordem:

1. teclas de função e menu de pausa;
2. abertura do round: enquanto "PREPARAR..." aparece, as teclas são descartadas;
3. leva as teclas de cada controle ao detector de combos de cada lutador;
4. `transit()` de cada objeto (troca de quadro, combos), por tipo: lutadores, armas leves,
   armas pesadas, bebidas, ataques especiais;
5. tarefas agendadas (criação e remoção de objetos);
6. `tu()` de cada objeto: física, dano, colisões;
7. efeitos visuais e a IA (cada computador pensa a cada 3 a 9 TU, conforme a dificuldade);
8. a lógica do modo (História, Sobrevivência, Treino) ou a checagem de fim de round.

A câmera lenta do K.O. é só da tela local: `MatchScreen` pula alguns TU, mas nunca altera a
simulação. No jogo em rede ela não existe, porque todos os aparelhos precisam contar os mesmos TU.

## Objetos e memória

Todos os objetos vivos ficam num `Vec<Obj>` dentro da partida (uma arena) e se referem uns aos
outros por índice (`Id`), nunca por referência. Isso evita o emaranhado de empréstimos que o
motor original, cheio de ponteiros cruzados (quem segura qual arma, quem agarra quem, quem lançou
qual bola), teria em Rust. Um `Obj` tem o que todos têm (posição, quadro, saúde, física) e um
`Kind` com a parte própria de lutador, arma ou bola. O comportamento por estado fica em
funções (`character::update`, `weapon::update`, `ball::update`) que recebem `&mut Match` e o `Id`.

## Dados por quadros

Cada lutador, arma e ataque é uma tabela de quadros (`engine/data.rs`): imagem (`pic`), duração
(`wait`), próximo quadro (`next`), estado (`state`), caixas de corpo (`bdy`) e de golpe (`itr`),
ponto da arma (`wpoint`), de agarrão (`cpoint`) e de criação de objetos (`opoint`). O motor lê
essa tabela e decide tudo: o que um golpe faz está no `itr`, não em código por personagem. A
numeração dos quadros (0 a 3 parado, 60 a 75 socos, 180 a 191 queda, 240 em diante especiais...)
está no cabeçalho de `engine/character.rs` e `content/moves.rs`.

## Conteúdo gerado

`content/build.rs` monta, ao abrir o jogo, um passo por quadro de animação:

1. para cada lutador de `roster.rs`, o `FighterBuilder` (`moves.rs`) cria os ~220 quadros a
   partir de poses e dos golpes especiais (`SpecialType`);
2. as caixas de corpo e de golpe saem das juntas de cada pose, então o desenho e a colisão
   batem;
3. `painter.rs` desenha cada pose (esqueleto com membros cônicos, luz e sombra, rosto, cabelo,
   roupa) numa folha de sprites em canvas, mais retratos;
4. armas, bolas de energia, faíscas e cenários em camadas (`scenes.rs`) são desenhados do mesmo
   jeito;
5. `audio/sound.rs` sintetiza os sons (ruído filtrado e tons) e `audio/music.rs` toca a trilha.

A simulação só usa o `Random` com semente da partida. `js_sys::Math::random` aparece apenas no que
é visual (poeira, tremor de tela), que não entra na simulação.

## Jogo em rede

Lockstep: cada aparelho simula a partida inteira. O servidor (`server/server.js`) guarda as
salas (código de 4 letras, até 4 humanos) e só repassa as teclas de cada jogador, com 4 quadros
de atraso. Computadores e armas usam a mesma semente em todos. A cada 2 s os aparelhos trocam um
hash do estado (`hash_match` em `net.rs`); se divergir, aparece "Partida dessincronizada". Por
isso a simulação não pode usar nada que dependa do aparelho. As mensagens do WebSocket chegam por
uma fila e as telas as consomem no próprio `update`, sem callbacks mexendo na tela.

## Android

`android/` é um projeto Gradle (Kotlin) com uma `MainActivity` que é uma `NativeActivity`: ela carrega
`libpunho_livre.so` (o jogo em Rust, compilado por `cargo ndk` para cada ABI) e o Rust cuida de janela,
toque, desenho e som. O Kotlin só faz o que o Rust não alcança: a barra imersiva, o banner e o
intersticial do AdMob (`AdsBridge`) e a vibração. O Rust chama `setBannerVisible`, `onMatchEnd` e
`vibrate` por JNI (`rust/src/native/android.rs`). O botão voltar chega ao jogo como tecla.
Detalhes em [`android/README.md`](../android/README.md).

## Testes

`tests/` usa o executor de testes do Node e o Playwright: sobe o servidor numa porta livre, abre o
jogo no Chromium e confere o carregamento, todos os especiais, lutas aleatórias, menus e pausa,
salvamento, controles de toque, a jogabilidade nova (rounds, tempo, Sobrevivência) e a sincronia
do jogo em rede entre dois navegadores. Os testes unitários do Rust ficam junto do código
(`cargo test --lib`).
