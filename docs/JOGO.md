# Guia do jogo

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
  (5 fases com chefes; cada fase vencida libera a próxima), Treino (boneco que não cai,
  MP infinito), Demonstração e **Jogo em rede**. No Fácil e no Normal os computadores
  reagem mais devagar e os jogadores levam menos dano.
- **Acabamento:** tela de Ajustes (volumes, dificuldade, tamanho e opacidade dos botões,
  vibração), Como jogar, Sobre com estatísticas, salvamento local, menu de pausa (Esc ou
  botão voltar; o jogo pausa sozinho ao sair do app), trilha sonora sintetizada e suporte a
  controle bluetooth/USB (A ataca, B pula, X defende, Start pausa).
- **6 cenários:** Praia, Rua da Cidade, Floresta, Templo da Montanha, Porto e Dojô.
- **Celular:** controles de toque com direcional de 8 direções; levar o dedo até a
  borda do direcional faz correr. Botões de golpe especial fazem a sequência inteira
  (D → A, D ↑ A...) num toque e ficam apagados sem MP. Deitado, os controles ficam
  nas laterais da tela; em pé, ficam embaixo. No navegador do celular o jogo entra
  em tela cheia.
- Teclas configuráveis para até 4 jogadores no teclado e teclas de função (F1 pausa,
  F7 recupera a vida, F8 joga armas...).

## Como jogar

Abra `web/index.html` no navegador ou rode `npm start` e acesse `http://localhost:8080/`.
Não há nada para baixar ou gerar antes.

| Ação        | 1P              | 2P           |
|-------------|-----------------|--------------|
| Mover       | `W` `X` `A` `D` | Setas        |
| Ataque (A)  | `S`             | `Enter`      |
| Pulo (J)    | `Q`             | `Shift dir.` |
| Defesa (D)  | `Z`             | `Ctrl dir.`  |

Especiais: **Defesa, direção, Ataque/Pulo** em sequência (ex.: `Z D S` = D→A).
As teclas podem ser trocadas em *Ajustes → Teclas do teclado*. `M` liga e desliga o som.
Teclas de teste (F2 passo a passo, F6 MP infinito, F7 vida cheia, F8/F9 armas) só
funcionam abrindo a página com `?dev` no endereço.

## Jogo em rede

Todos os aparelhos simulam a mesma partida ao mesmo tempo (*lockstep*). Cada um envia
só as próprias teclas, e o servidor repassa essas teclas para os outros. As teclas valem
4 quadros (~130 ms) depois de apertadas, para dar tempo de chegarem. A cada 2 segundos
os aparelhos comparam o estado da luta e avisam se algo divergir. Todos precisam estar
na mesma versão do jogo.

1. Rode o servidor (Node 18+): `npm install --prefix server && npm start` (porta 8080, ou `PORT=xxxx npm start`).
2. No jogo, abra **Jogar em rede**, informe o endereço do servidor e o seu nome e
   toque em **Criar sala**. Aparece um código de 4 letras.
3. Os amigos informam o mesmo servidor, digitam o código e tocam em **Entrar**.
4. Na sala, cada um escolhe lutador e time e marca **Pronto**. O anfitrião escolhe
   computadores, dificuldade e cenário e começa a luta.

Endereços: `192.168.0.10:8080` (mesmo Wi-Fi, usa `ws://`), `meujogo.onrender.com`
(internet, usa `wss://`) ou o endereço completo com `ws://`/`wss://`.

**Hospedar na internet (ex.: Render, Railway, VPS):** publique o repositório inteiro, instale
com `npm install --prefix server` e inicie com `npm start`. A porta vem da variável `PORT`. O
servidor também entrega o jogo (pasta `web/`, ou a indicada em `GAME_ROOT`), então dá para jogar
pelo navegador no mesmo endereço. Use `wss://` (HTTPS) para jogadores na internet.
