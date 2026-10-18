# Punho Livre

Jogo de luta 2.5D para navegador e Android, para até 8 lutadores. Dá para jogar com até
4 pessoas no mesmo aparelho ou pela internet. O motor foi escrito em JavaScript e
executa dados de quadros no formato do Little Fighter 2: quadros, caixas de golpe e de
corpo, e pontos de arma, agarrão e objetos.

## O que tem

- **15 lutadores:** Davis, Woody, Dennis, Freeze, Firen, Louis, Rudolf, Henry, John,
  Deep e Bandit, além de 5 lutadores novos do Punho Livre:

  | Lutador | Base | Estilo |
  |---------|------|--------|
  | **Brasa** | Davis | rajadas viram bolas de fogo; o gancho (D↑A) queima |
  | **Geada** | Dennis | bolas de gelo; o chute giratório (D→J) congela |
  | **Corvo** | Woody | bolas que perseguem o alvo; mais rápido |
  | **Titã** | Louis | mais vida e golpes 20% mais fortes, porém mais lento |
  | **Faísca** | John | o mais rápido e o que pula mais alto, com rajada de energia |

  Os lutadores novos usam o corpo de um lutador existente com outras cores e têm
  golpes, atributos e especiais próprios (`tools/new-characters.mjs`).
- **Mecânicas:** combos, corrida com toque duplo, pulo, avanço, rolamento, defesa e
  quebra de defesa, tontura e agarrão, quedas, fogo, gelo, rebater bolas de energia,
  bolas que perseguem o alvo, armas (pegar, golpear, arremessar), transformação e
  clones do Rudolf.
- **Modos:** Versus (até 8 lutadores, times, computadores com 4 níveis), História
  (5 fases com chefes), Demonstração e **Jogo em rede**. No Fácil e no Normal os
  computadores reagem mais devagar e os jogadores levam menos dano.
- **Seleção de lutadores** mostra os golpes especiais de cada um e o que fazem.
- **Celular:** controles de toque com direcional de 8 direções; levar o dedo até a
  borda do direcional faz correr. Botões de golpe especial fazem a sequência inteira
  (D → A, D ↑ A...) num toque e ficam apagados sem MP. Deitado, os controles ficam
  nas laterais da tela; em pé, ficam embaixo. No navegador do celular o jogo entra
  em tela cheia.
- Teclas configuráveis para até 4 jogadores no teclado e teclas de função (F1 pausa,
  F7 recupera a vida, F8 joga armas...).

## Dados do jogo

Os sprites, cenários e sons dos lutadores originais são do **Little Fighter 2 © Marti
Wong & Starsky Wong** e **não estão neste repositório**. O script abaixo baixa a versão
1.9 já convertida pelo [projeto F.LF](https://github.com/Project-F/LF2_19). Ele também
gera os lutadores novos e a pasta `assets/`, que fica fora do git:

```
./tools/fetch-lf2.sh
```

O conversor (`tools/import-lf2.mjs`) só lê os arquivos de dados como texto, sem
executá-los.

## Como jogar

Depois de gerar `assets/`, abra `index.html` no navegador ou rode o servidor (abaixo)
e acesse `http://localhost:8080/`.

| Ação        | 1P              | 2P           |
|-------------|-----------------|--------------|
| Mover       | `W` `X` `A` `D` | Setas        |
| Ataque (A)  | `S`             | `Enter`      |
| Pulo (J)    | `Q`             | `Shift dir.` |
| Defesa (D)  | `Z`             | `Ctrl dir.`  |

Especiais: **Defesa, direção, Ataque/Pulo** em sequência (ex.: `Z D S` = D→A).
As teclas podem ser trocadas em *Controles*. `M` liga e desliga o som.

## Jogo em rede

Todos os aparelhos simulam a mesma partida ao mesmo tempo (*lockstep*). Cada um envia
só as próprias teclas, e o servidor repassa essas teclas para os outros. As teclas valem
4 quadros (~130 ms) depois de apertadas, para dar tempo de chegarem. A cada 2 segundos
os aparelhos comparam o estado da luta e avisam se algo divergir.

1. Rode o servidor (Node 18+):
   ```
   cd server
   npm install
   npm start          # porta 8080, ou PORT=xxxx npm start
   ```
2. No jogo, abra **Jogar em rede**, informe o endereço do servidor e o seu nome e
   toque em **Criar sala**. Aparece um código de 4 letras.
3. Os amigos informam o mesmo servidor, digitam o código e tocam em **Entrar**.
4. Na sala, cada um escolhe lutador e time e marca **Pronto**. O anfitrião escolhe
   computadores, dificuldade e cenário e começa a luta.

Endereços: `192.168.0.10:8080` (mesmo Wi-Fi, usa `ws://`), `meujogo.onrender.com`
(internet, usa `wss://`) ou o endereço completo com `ws://`/`wss://`.

**Hospedar na internet (ex.: Render, Railway, VPS):** use a pasta `server/`, com
`npm install` para instalar e `npm start` para iniciar. A porta vem da variável `PORT`.
O servidor também entrega os arquivos do jogo. Para jogar pelo navegador nesse
endereço, gere `assets/` no servidor (`./tools/fetch-lf2.sh`). Para quem joga pelo APK,
o servidor só precisa repassar as salas.

## APK Android

```
./tools/fetch-lf2.sh
./android/build.sh
```

Gera `dist/punho-livre.apk` (Android 7.0+) sem precisar do Android SDK. As ferramentas
vêm do Maven Central (aapt2 do `apktool-lib`, `smali` e `apksig`). O app abre o jogo
numa WebView em tela cheia e deitada, funciona offline e tem permissão de internet para
o jogo em rede. O APK contém os dados do LF2, então é para uso pessoal: não publique o
arquivo nem o coloque no repositório (`dist/` está no `.gitignore`).

## Estrutura

```
index.html, style.css   página do jogo (canvas, controles de toque, formulário de rede)
src/global.js           constantes do motor (gravidade, quedas, defesa, combos...)
src/logo.js             logo do Punho Livre
src/assets.js           carrega dados, imagens e sons
src/input.js            teclado, toque, controles por jogador e detector de combos
src/object.js           base dos objetos: transição de quadros, física, efeitos
src/character.js        estados do lutador, golpes, defesa, quedas, agarrão, armas
src/weapon.js, ball.js  armas e ataques especiais
src/effects.js          faíscas, sangue, fogo e pedaços
src/background.js       cenários com paralaxe e câmera
src/match.js            a partida: ordem de processamento, colisões, desenho
src/hud.js              painel de vida/MP, mensagens e resumo da luta
src/ai.js               computador
src/stage.js            modo História
src/ui.js               telas: inicial, modos, seleção, controles
src/net.js              jogo em rede: conexão, sala e partida em lockstep
server/                 servidor de salas (Node + ws) e dos arquivos do jogo
tools/                  download e conversão dos dados e lutadores novos
android/                app Android e build do APK
fonts/                  fonte Bangers (SIL Open Font License)
```

## Créditos e licença

- Lutadores originais, cenários e sons: Little Fighter 2, de Marti Wong & Starsky Wong.
- As regras do motor seguem o "LF2 standard" e o motor do
  [F.LF](https://github.com/Project-F/F.LF) (GPLv3). Se for redistribuir este código,
  publique-o sob a GPLv3.
- Fonte Bangers de Vernon Adams (SIL Open Font License 1.1).
