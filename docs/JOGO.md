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
- **Modos:** Versus (até 8 lutadores, times, computadores com 4 níveis, luta única ou melhor de
  3/5 rounds, tempo por round), História (5 fases com chefes; cada fase vencida libera a
  próxima), **Sobrevivência** (ondas sem fim), Treino (boneco que não cai, MP infinito),
  Demonstração e **Jogo em rede**. No Fácil e no Normal os computadores reagem mais devagar e os
  jogadores levam menos dano.
- **Rounds e tempo (Versus):** cada round abre com "PREPARAR..." e "LUTEM!" (as teclas só valem
  depois). Em melhor de 3 ou 5, as bolinhas no painel mostram os pontos de cada lado, o empate
  repete o round e o resumo traz o placar. Com tempo por round (30, 60 ou 90 s) há um relógio na
  tela, e quando zera vence quem tiver mais vida.
- **Sobrevivência:** a onda 1 tem poucos capangas; a cada onda entram mais inimigos, o elenco
  aparece no lugar dos capangas e eles ficam mais fortes. A cada 5 ondas vem um chefe, a cada 3
  o cenário muda, e entre as ondas os jogadores recuperam um quarto da vida (quem caiu volta com
  metade). Dá para jogar com até 3 aliados do computador. O recorde (ondas vencidas) fica salvo
  e aparece em Sobre.
- **Impacto:** K.O. com câmera lenta, clarão, tremor de tela e som próprio; "VITÓRIA!", "DERROTA"
  ou "EMPATE" ao fim do round; contador de combo ("3 HITS!") sobre quem emenda golpes; números
  de dano flutuando e clarão branco em quem apanha (azul se defendeu).
- **Acabamento:** tela de Ajustes (volumes, dificuldade, tamanho e opacidade dos botões,
  vibração, tremor de tela, números de dano), Como jogar, Sobre com estatísticas, salvamento
  local, menu de pausa com Reiniciar (Esc ou botão voltar; o jogo pausa sozinho ao sair do app),
  trilha sonora sintetizada, barras de vida, força e velocidade na escolha do lutador e suporte
  a controle bluetooth/USB (A ataca, B pula, X defende, Start pausa).
- **6 cenários:** Praia, Rua da Cidade, Floresta, Templo da Montanha, Porto e Dojô.
- **Celular:** controles de toque com direcional de 8 direções; levar o dedo até a
  borda do direcional faz correr. Botões de golpe especial fazem a sequência inteira
  (D → A, D ↑ A...) num toque e ficam apagados sem MP. Deitado, os controles ficam
  nas laterais da tela; em pé, ficam embaixo. No navegador do celular o jogo entra
  em tela cheia.
- Teclas configuráveis para até 4 jogadores no teclado e teclas de função (F1 pausa,
  F7 recupera a vida, F8 joga armas...).

## Como jogar

Gere o jogo uma vez com `npm run build` (compila o Rust para WebAssembly; veja
[DESENVOLVIMENTO.md](DESENVOLVIMENTO.md)). Depois abra `web/index.html` no navegador ou rode
`npm start` e acesse `http://localhost:8080/`. A arte e os sons são gerados ao abrir, então não
há mais nada para baixar.

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
na mesma versão do jogo (as versões 2.x, em JavaScript, não jogam com a 3.0).

1. Rode o servidor (Node 18+): `npm install --prefix server && npm run build && npm start` (porta 8080, ou `PORT=xxxx npm start`).
2. No jogo, abra **Jogar em rede**, informe o endereço do servidor e o seu nome e
   toque em **Criar sala**. Aparece um código de 4 letras.
3. Os amigos informam o mesmo servidor, digitam o código e tocam em **Entrar**.
4. Na sala, cada um escolhe lutador e time e marca **Pronto**. O anfitrião escolhe
   computadores, dificuldade e cenário e começa a luta.

Endereços: `192.168.0.10:8080` (mesmo Wi-Fi, usa `ws://`), `meujogo.onrender.com`
(internet, usa `wss://`) ou o endereço completo com `ws://`/`wss://`.

**Hospedar na internet (ex.: Render, Railway, VPS):** publique o repositório inteiro com o
`web/pkg/` já gerado (ou rode `npm run build` no deploy), instale com `npm install --prefix server`
e inicie com `npm start`. A porta vem da variável `PORT`. O
servidor também entrega o jogo (pasta `web/`, ou a indicada em `GAME_ROOT`), então dá para jogar
pelo navegador no mesmo endereço. Use `wss://` (HTTPS) para jogadores na internet.
