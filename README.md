# Little Fighter 2 — port HTML5

Port do **Little Fighter 2** (v1.9) para navegador e Android. O motor foi reescrito em
JavaScript e roda os **dados originais do LF2**: quadros (`frame`), caixas de golpe (`itr`),
corpos (`bdy`), pontos de arma, agarrão e objetos (`wpoint`, `cpoint`, `opoint`), sprites,
cenários e sons. Assim, cada golpe, especial e reação se comporta como no jogo original.

O que está implementado:

- **Personagens:** Davis, Woody, Dennis, Freeze, Firen, Louis, Rudolf, Henry, John e Deep,
  além do Bandit, com todos os especiais dos dados (D→A, D↑A, D↓A, D→J, D↑J, D↓J, DJA).
  Inclui a transformação do Rudolf (agarrar + D J A) e os clones dele.
- **Mecânicas do LF2:** combos e corrida com toque duplo, pulo, avanço, rolamento,
  defesa e quebra de defesa, tontura e agarrão (socos e arremessos), quedas e quiques,
  fogo, gelo, rebater bolas de energia, bolas que perseguem o alvo, flauta e redemoinho
  do Henry. Também a vida que se recupera até a barra escura, a regeneração de MP e a
  pausa do golpe ao acertar.
- **Armas:** bastão, enxada, espada de gelo, pedra e caixa de madeira. Dá para pegar,
  golpear, arremessar, rebater e quebrar.
- **Cenários:** HK Coliseum, Lion Forest, Stanley Prison, The Great Wall, Queen's Island,
  Forbidden Tower, CUHK e Tai Hom Village, com paralaxe e câmera seguindo os jogadores.
- **Modos:** VS Mode (até 8 lutadores, times, de 0 a 7 computadores, 4 níveis de
  dificuldade), Stage Mode (5 fases com trechos, "GO →" e chefes) e Demo.
- **Interface:** seleção de lutadores com 8 vagas, "How many computer players?", menu
  Fight / Reset All / Reset Random / Background / Difficulty / Exit, painel de vida e
  MP e resumo do fim da luta, tudo com as imagens da interface do pacote.
- **Teclas F do LF2:** F1 pausa, F2 avança um quadro, F4/Esc sai da luta, F6 MP
  infinito, F7 recupera a vida, F8 joga armas e F9 some com as armas.
- Até 4 jogadores no mesmo teclado, teclas configuráveis e controles de toque no celular.

## Dados do LF2

Os sprites, sons e dados são do **Little Fighter 2 © Marti Wong & Starsky Wong** e **não
estão neste repositório**. O script abaixo baixa a versão 1.9 já convertida pelo
[projeto F.LF](https://github.com/Project-F/LF2_19) e gera a pasta `assets/`, que fica
fora do git:

```
./tools/fetch-lf2.sh
```

O conversor (`tools/import-lf2.mjs`) só lê os arquivos de dados como texto, sem
executá-los. Ele junta tudo em `assets/data.js` e embute os sons em `assets/sound-*.js`.
Também torna o preto transparente nas imagens que o LF2 desenha com transparência.

## Como jogar

Depois de gerar `assets/`, abra `index.html` direto no navegador (funciona via `file://`)
ou sirva a pasta com `python3 -m http.server`.

| Ação        | 1P (padrão do LF2) | 2P           |
|-------------|--------------------|--------------|
| Mover       | `W` `X` `A` `D`    | Setas        |
| Ataque (A)  | `S`                | `Enter`      |
| Pulo (J)    | `Q`                | `Shift dir.` |
| Defesa (D)  | `Z`                | `Ctrl dir.`  |

O 3P e o 4P também têm teclas padrão, e todas podem ser trocadas em *control settings*
na tela inicial. `M` liga e desliga o som.

Especiais: aperte **Defesa, direção, Ataque/Pulo** em sequência (ex.: `Z D S` = D→A).

## APK Android

```
./tools/fetch-lf2.sh
./android/build.sh
```

Gera `dist/lf2.apk` (Android 7.0+) sem precisar do Android SDK. As ferramentas vêm do
Maven Central: aapt2 e o framework Android que acompanham o `apktool-lib`, `smali` e
`apksig`. O app abre o jogo numa WebView em tela cheia, deitada e funciona offline.
O botão voltar pausa ou sai da luta, volta dos menus e fecha o app na tela inicial.
O APK contém os dados do LF2, então é para uso pessoal: não publique o arquivo nem o
coloque no repositório (`dist/` está no `.gitignore`).

## Estrutura

```
index.html, style.css   página do jogo
src/global.js           constantes do LF2 (gravidade, quedas, defesa, combos...)
src/assets.js           carrega dados, imagens e sons; desenha quadros das folhas de sprite
src/input.js            teclado, toque, controles por jogador e detector de combos
src/object.js           base dos objetos: transição de quadros com autoridade, física, efeitos
src/character.js        estados do personagem, golpes, defesa, quedas, agarrão, armas
src/weapon.js           armas leves e pesadas
src/ball.js             ataques especiais (bolas, flechas, colunas de gelo, redemoinho)
src/effects.js          faíscas, sangue, fogo e pedaços de objetos quebrados
src/background.js       cenários em camadas com paralaxe e câmera
src/match.js            a partida: ordem de processamento, colisões, painel, resumo
src/ai.js               computador (aperta as mesmas teclas que um jogador)
src/stage.js            Stage Mode
src/ui.js               telas: inicial, modos, seleção, teclas
tools/                  download e conversão dos dados do LF2
android/                app Android e build do APK
```

## Créditos e limitações

- Little Fighter 2 é de Marti Wong & Starsky Wong (lf2.net).
- As regras do motor seguem o "LF2 standard" e o motor do [F.LF](https://github.com/Project-F/F.LF)
  (GPLv3), que documentaram o comportamento do LF2. Se for redistribuir este código,
  publique-o sob a GPLv3.
- O pacote 1.9 não traz os personagens e inimigos que só existem no LF2 2.0 (Jan, Firzen,
  Julian, Louis EX, Hunter, Mark, Jack, Sorcerer, Monk, Knight, Justin...), nem as
  garrafas de leite e cerveja. Por isso o Stage Mode usa o Bandit e o próprio elenco
  como chefes, e a transformação do Louis em Louis EX fica desativada.
- Jogo em rede, Championship e Battle Mode não foram portados.
