# Punho Livre

Jogo de luta 2.5D para navegador e Android, para até 8 lutadores. Dá para jogar com até
4 pessoas no mesmo aparelho ou pela internet. Todo o conteúdo — lutadores, golpes,
cenários, efeitos e sons — é gerado por código ao abrir o jogo (`src/content/`), então o
repositório não tem arte nem áudio de terceiros.

## O que tem

- **8 lutadores e um capanga:**

  | Lutador | Estilo | Especiais |
  |---------|--------|-----------|
  | **Brasa** | lutador de rua com fogo | Bola de fogo (D→A), Gancho flamejante (D↑A), Rajada de socos (D→J) |
  | **Geada** | gelo, congela quem chega perto | Estilhaço de gelo (D→A), Explosão congelante (D↓A), Gancho (D↑A) |
  | **Corvo** | ninja | Estrelas ninja (D→A), Sombra: reaparece atrás do inimigo (D↑J), Chute giratório (D↓A) |
  | **Titã** | grandalhão, mais vida, mais lento | Investida (D→A), Tremor (D↓A), Gancho do titã (D↑A) |
  | **Faísca** | o mais rápido | Raio (D→A), Rajada relâmpago (D→J), Giro elétrico (D↑J) |
  | **Jade** | mestra de chutes | Chuva de chutes (D→A), Chute crescente (D↑A), Meditação: cura (D↓J) |
  | **Lua** | energia | Orbe caçador que persegue (D→A), Onda lunar (D↓A), Luz curativa (D↓J) |
  | **Bala** | boxeador | Metralhadora (D→A), Gancho (D↑A), Direto voador (D→J) |
  | Capanga | inimigo do modo História | — |

- **Mecânicas:** combos, corrida com toque duplo, pulo, avanço, rolamento, defesa e
  quebra de defesa, tontura e agarrão (socar e arremessar), quedas, fogo, gelo,
  rebater bolas de energia, armas (bastão, cano, pedra e caixa: pegar, golpear,
  arremessar).
- **Modos:** Versus (até 8 lutadores, times, computadores com 4 níveis), História
  (5 fases com chefes), Demonstração e **Jogo em rede**. No Fácil e no Normal os
  computadores reagem mais devagar e os jogadores levam menos dano.
- **6 cenários:** Praia, Rua da Cidade, Floresta, Templo da Montanha, Porto e Dojô.
- **Celular:** controles de toque com direcional de 8 direções; levar o dedo até a
  borda do direcional faz correr. Botões de golpe especial fazem a sequência inteira
  (D → A, D ↑ A...) num toque e ficam apagados sem MP. Deitado, os controles ficam
  nas laterais da tela; em pé, ficam embaixo. No navegador do celular o jogo entra
  em tela cheia.
- Teclas configuráveis para até 4 jogadores no teclado e teclas de função (F1 pausa,
  F7 recupera a vida, F8 joga armas...).

## Como jogar

Abra `index.html` no navegador ou rode o servidor (abaixo) e acesse
`http://localhost:8080/`. Não há nada para baixar ou gerar antes.

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
os aparelhos comparam o estado da luta e avisam se algo divergir. Todos precisam estar
na mesma versão do jogo.

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
O servidor também entrega os arquivos do jogo, então dá para jogar pelo navegador no
mesmo endereço.

## APK Android

```
./android/build.sh
```

Gera `dist/punho-livre.apk` (Android 7.0+) sem precisar do Android SDK. As ferramentas
vêm do Maven Central (aapt2 do `apktool-lib`, `smali` e `apksig`). O app abre o jogo
numa WebView em tela cheia e deitada, funciona offline e tem permissão de internet para
o jogo em rede. Para publicar numa loja, assine com a sua própria chave (`KEYSTORE`,
`KEYSTORE_PASS`, `KEY_ALIAS`).

## Estrutura

```
index.html, style.css   página do jogo (canvas, controles de toque, formulário de rede)
src/content/painter.js  desenho por código: lutadores, retratos, armas, efeitos
src/content/moves.js    golpes e animações (poses, hitboxes, especiais)
src/content/roster.js   elenco: aparência, atributos e especiais; armas
src/content/scenes.js   cenários em camadas
src/content/build.js    monta os dados e as folhas de sprites
src/global.js           constantes do motor (gravidade, quedas, defesa, combos...)
src/logo.js             logo do Punho Livre
src/assets.js           dados gerados, folhas de sprites e sons sintetizados
src/input.js            teclado, toque, controles por jogador e detector de combos
src/object.js           base dos objetos: transição de quadros, física, efeitos
src/character.js        estados do lutador, golpes, defesa, quedas, agarrão, armas
src/weapon.js, ball.js  armas e ataques especiais
src/effects.js          faíscas, fogo e pedaços
src/background.js       cenários com paralaxe e câmera
src/match.js            a partida: ordem de processamento, colisões, desenho
src/hud.js              painel de vida/MP, mensagens e resumo da luta
src/ai.js               computador
src/stage.js            modo História
src/ui.js               telas: inicial, modos, seleção, controles
src/net.js              jogo em rede: conexão, sala e partida em lockstep
server/                 servidor de salas (Node + ws) e dos arquivos do jogo
android/                app Android e build do APK
fonts/                  fonte Bangers (SIL Open Font License)
```

## Créditos e licença

- Lutadores, golpes, cenários, efeitos e sons: criados para o Punho Livre (gerados por
  código em `src/content/`).
- As regras do motor (estados, transições de quadro, colisões) foram escritas tomando
  como referência o motor do [F.LF](https://github.com/Project-F/F.LF) (GPLv3). Se for
  redistribuir este código, publique-o sob a GPLv3.
- Fonte Bangers de Vernon Adams (SIL Open Font License 1.1).
