# MUGEN Arena — online (Fase 3)

Desenho do online em produção: determinismo entre aparelhos, rollback, reconexão, ranqueada e anti-trapaça
básica. O contrato app ⇄ web está em `docs/PROTOCOL.md`; aqui ficam o porquê e os números medidos.

Legenda: **verificado** = coberto por teste/medição rodada nesta entrega; **pendente** = ainda não medido
(em especial: nada aqui foi rodado em aparelho real nem em rede real).

## 1. Visão geral

- O servidor (Rails 8, ActionCable sobre Solid Cable) é **relay**: não simula a luta. Cada cliente simula a
  partida inteira com a engine determinística (`mobile/src/engine`) e o netcode de rollback
  (`mobile/src/net/rollback.ts`).
- O banco só vê: pareamento, `ready`, registro das entradas em blocos (`input_log`, ~1/s por lado), checksums
  (~1/s por lado), relatos de resultado e quedas. As entradas quadro a quadro (`input`, ~60/s por lado) passam
  só pelo relay.
- Resultado só conta com os **dois relatos iguais** (regra mantida) e, além disso, com o **replay conferido**.

## 2. Determinismo entre aparelhos

O app roda em Hermes (Android/iOS) e V8 (web). A especificação do JavaScript fixa o resultado de `+ - * /`,
`Math.sqrt`, `Math.floor/round/trunc` (IEEE 754, arredondamento exato), mas **não** o de `Math.sin/cos/tan/
asin/acos/atan/exp/log/pow` nem do operador `**`: cada motor usa a própria biblioteca e pode diferir no último
bit. No rollback, um bit de diferença vira dessincronia segundos depois.

Auditoria da engine: os únicos usos eram os triggers matemáticos do MUGEN (`sin`, `cos`, `tan`, `asin`, `acos`,
`atan`, `exp`, `ln`, `log`) em `fighter.ts` e o operador `**` das expressões em `expr.ts`. Foram trocados por
`src/engine/detmath.ts`:

- só `+ - * /`, `Math.sqrt`, `Math.round/floor/trunc/abs`, numa ordem fixa (JS não funde multiplicação e soma);
- seno/cosseno: redução de argumento Cody–Waite (π/2 em três partes) + polinômio de Taylor em |r| ≤ π/4;
- atan: redução por 1/x e π/4 + meia-angulação + série; asin/acos via atan (estável perto de ±1);
- exp: redução por ln 2 (duas partes) + Taylor + escala por potência de 2 exata; ln: expoente lido dos bits
  (DataView) + série de atanh; `pow`: expoente inteiro por quadrados sucessivos, senão `exp(b·ln a)`.
- Precisão ~1e-13 relativo ou melhor contra o `Math` do V8 (verificado no teste).

Teste `src/engine/__tests__/detmath.test.ts` (**verificado**):
- varre todo `src/engine/**.ts` (sem comentários e strings) e **falha** se aparecer `Math.sin/cos/tan/asin/acos/
  atan/atan2/sinh/…/exp/expm1/log/log1p/log2/log10/pow/cbrt/hypot/random`, `**`, `Date` ou `performance.now`;
- confere que `detmath.ts` só usa as operações exatas;
- compara a precisão com o `Math` e congela 10 resultados **bit a bit** (hex do double). Rodar essa suíte no
  Hermes prova a igualdade entre motores — **pendente** (precisa de um runner de testes no Hermes/aparelho).

O hash de estado do online (`src/net/hash.ts`, `stateHash`) usa os **bits exatos** dos números; o `checksum` da
engine (4 casas decimais) continua para os testes da engine, mas escondia divergências pequenas.

## 3. Rollback

Parâmetros: atraso de entrada 2 quadros, previsão até 8 quadros, checksum a cada 60 quadros confirmados.

Robustez acrescentada nesta fase (o relay pode perder/reordenar mensagens numa reconexão, e o ActionCable não
garante ordem entre workers):
- "confirmado" = último quadro remoto **contíguo** (antes: o maior recebido, o que com buracos podia apagar o
  snapshot necessário e esconder a dessincronia);
- cada envio repete tudo desde o `ack` do oponente; parado esperando (stall), reenvia a cada 6 ticks;
- repetidas e fora de ordem são ignoradas/encaixadas; histórico perdido nunca é silencioso
  (`desyncReason: "history"`);
- **sincronia de relógio**: o app segurava o tick quando `framesAhead > 6 && world.frame % 4 === 0`. Como o
  quadro não anda, a condição ficava verdadeira para sempre e, se uma mensagem se perdesse, os dois lados
  paravam de reenviar e travavam. O soak achou isso (partida 819 da 1ª rodada). Agora
  `RollbackSession.syncSkip()` conta ticks (segura no máximo 1 de cada 4) e o app usa a mesma regra.
- o app relata o resultado a partir do **estado confirmado** (`confirmedWorld`), não do previsto (que ainda pode
  mudar com rollback e gerar disputa falsa).

## 4. Soak: 1.000 partidas simuladas

`npm run soak -- 1000` (`mobile/scripts/soak`, núcleo em `src/net/simnet.ts`): dois `RollbackSession`, cada um
com relógio próprio de 60 Hz com deriva, CPU nível 3 do jogo nos dois lados (cada uma lendo o próprio mundo
previsto), rede simulada por evento, elenco nativo sorteado por partida, regras normais (2 rounds, 99 s).
Confere o **checksum de todo quadro confirmado** nos dois lados (`checksumEvery = 1`), relata dessincronia
pelo protocolo (hash de estado + hash das entradas) e, no fim, **re-simula a luta só com seed + entradas
registradas no relay** (o replay do servidor) e compara com o estado final. Perfis (um quarto das partidas cada):

| perfil | latência (ida) | jitter | perda | fora de ordem | deriva | queda |
|---|---|---|---|---|---|---|
| wifi | 15 ms | ±5 ms | 0 | não | 0,1% | — |
| 4g | 60 ms | ±25 ms | 1% | não | 0,2% | — |
| ruim | 110 ms | ±60 ms | 3% | sim | 0,3% | — |
| queda | 45 ms | ±15 ms | 0,5% | não | 0,2% | 1–8 s de um lado, entre 5 e 25 s de luta, com `resume`/`resync` |

Resultado medido (rodada final, 4 workers, 742 s neste container; **verificado**):

| métrica | valor |
|---|---|
| partidas | 1.000 |
| quadros confirmados / conferidos pelos dois lados | 6.321.050 / 6.321.251 |
| **dessincronias** | **0** |
| partidas travadas | 0 |
| replays que não reproduzem a luta | 0 |
| rollbacks por partida (2 lados) | média 872,5 · máx 1.982 |
| profundidade do rollback | média 3,26 quadros · máx 8 |
| stalls (ticks esperando o oponente, 2 lados) | média 96,6/partida · máx 717 · 0,76% dos ticks (quase tudo nas quedas) |
| ticks segurados para sincronizar o relógio | média 177,9/partida · máx 916 · 1,41% dos ticks |
| quedas de rede | 250 · volta ao jogo normal após reconectar: média 117 ms · máx 516 ms |
| mensagens / perdidas | 25.518.836 / 308.531 |

Por perfil: wifi 504,7 rollbacks/partida (prof. média 2,95, máx 6), 4g 1.115,9 (2,80, máx 7), ruim 1.121,2
(3,95, máx 8, 1,5 stalls/partida), queda 748,2 (3,11, máx 8, 384,9 stalls/partida — a espera da queda).

Primeira rodada (antes das correções, mesmo comando): 0 dessincronias, **1 partida travada** (o bug de
sincronia de relógio acima) e 21 "replays divergentes" que eram do próprio simulador (o registro de entradas
perdido no fim da partida não era reenviado; agora segue o `input_log_gap` do protocolo). As partidas 53, 94,
819 e 966 foram re-rodadas com `--only` depois das correções e passaram; a 819 virou teste de regressão.

Limites do soak (**pendente**): CPU contra CPU (entradas humanas têm outro padrão), rede simulada (não
WebSocket real, não Solid Cable real), um único motor JS (V8/Node). Falta medir em aparelho e rede reais.

Testes curtos no `npm test` (`src/net/__tests__/simnet.test.ts`, `online.test.ts`): rede ruim, queda de 6 s,
regressão 819, entrada adulterada no relay (acusada no quadro adulterado), entradas fora de ordem/repetidas,
reenvio durante stall, registro em blocos com rebobinagem, vetor do hash das entradas (o mesmo no rspec), e a
reconexão do app com WebSocket falso (resume com o quadro certo, vigia de conexão muda, prazo de 10 s).

## 5. Reconexão

Fluxo (app `src/net/online.ts` + `cable.ts`; servidor `MatchChannel`, `Matches::Connection`,
`MatchReconnectTimeoutJob`):

1. O app percebe a queda pelo `close` do socket ou pelo vigia (na luta: nenhuma mensagem em 3 s; o app pinga a
   cada 1 s e o servidor manda `ping` a cada 3 s). A sessão de rollback continua viva: o jogo anda até esgotar a
   previsão e para, com o aviso "RECONECTANDO… n".
2. O app tenta de novo com recuo (250 ms → 2 s) por até 10 s: nova conexão, assina o `MatchChannel` com
   `resume: true, from: <primeiro quadro remoto que falta>`.
3. O servidor marca o lado como reconectado (token de conexão por lado — a queda de uma conexão antiga,
   percebida pelo servidor só depois, é ignorada), responde `resume` com as entradas do oponente registradas no
   `input_log` desde `from` e `log_next`, e manda `resync` ao oponente, que reenvia as próprias entradas desde
   `from`. O app rebobina o próprio registro para `log_next`.
4. Do outro lado o servidor avisou `opponent_disconnected` (contagem na tela). Se o lado não volta em
   `RECONNECT_GRACE_SECONDS` (10 s), o job dá a **derrota por abandono** (`opponent_left`). Se os dois estiverem
   fora, a partida é encerrada sem vencedor e sem rating. A faxina recorrente é a rede de segurança se o job se
   perder.
5. Desistir pelo menu manda `leave`: abandono na hora, sem tolerância.

Como o oponente também para depois de 8 quadros de previsão, o que falta depois de uma queda é pequeno; o
registro do relay cobre o caso de o app ter perdido mais (e é o replay).

## 6. Ranqueada

**Rating: Glicko-2** (`web/app/services/ratings/glicko2.rb`), aplicado partida a partida como faz o Lichess,
τ = 0,5, escala 1500/350/0,06. Escolhido em vez de Elo com K variável porque:
- a incerteza (RD) é **por jogador**: novatos e quem voltou de pausa andam rápido, veteranos devagar — o K
  variável do Elo imita isso com faixas fixas e arbitrárias;
- a inatividade aumenta a incerteza sozinha (1 período por dia parado, teto 350);
- a volatilidade acompanha quem está melhorando de verdade;
- vencer alguém de rating incerto vale menos.
O teste reproduz o exemplo do artigo do Glickman (1464,06 / 151,52 / 0,05999).

**Temporadas** (`seasons`, `season_ratings`): abrem sozinhas (`SEASON_LENGTH_DAYS`, padrão 56). Na virada o
rating anda metade do caminho até 1500 e o RD volta a pelo menos 250. `players.rating` passa a ser o rating
exibido da temporada atual (padrão 1500); W/L de `players` são da vida toda.

**Ligas** (`Ranked::Leagues`): Em colocação (menos de 5 partidas na temporada) → Bronze (< 1400) → Prata (1400)
→ Ouro (1550) → Platina (1700) → Diamante (1850) → Mestre (2000). O ranking da temporada só lista quem saiu da
colocação.

**Consenso**: mantido — os dois relatos iguais; divergentes → `disputed` + revisão.

**Matchmaking**: mesma `engine_version` sempre; janela de rating ±100, +50 a cada 5 s de espera (vale a maior
janela dos dois) e **qualquer rating a partir de 30 s**; o canal reavalia a cada 3 s. Com pelo menos dois
jogadores da mesma versão na fila, o pareamento sai em até ~33 s pelo desenho. A meta "≤ 30 s" em produção
depende da população online e **não foi medida** (pendente: métrica do tempo de fila em produção).

Telas: Online → Ranqueada mostra temporada, liga, pontos, partidas de colocação restantes e posição; Perfil →
Conta mostra a liga e Ranking mostra o placar da temporada com a liga de cada um (componentes W10M).

## 7. Anti-trapaça básica

- **Checksums**: a cada 60 quadros confirmados cada lado manda `checksum { frame, value, inputs_hash }` (hash do
  estado em bits exatos + hash FNV-1a das entradas dos dois lados até ali). O servidor grava e compara: estado ou
  entradas diferentes no mesmo quadro → partida **`void`** (anulada, sem rating/W-L), `voided` para os dois e uma
  linha em `match_reviews`.
- **Registro de entradas / replay**: cada lado registra as próprias entradas (`input_log`). Replay = seed +
  personagens + `pack_sha256` + `engine_version` + entradas dos dois lados + checksums
  (`GET /api/v1/matches/:id/replay`, participantes e admin). Guardado por `REPLAY_RETENTION_DAYS` (30) e para
  sempre enquanto houver revisão aberta.
- **Conferência do replay no resultado**: antes de aplicar o rating, o servidor recalcula o hash das entradas
  registradas até o último quadro com checksum dos dois lados (`Matches::InputsHash`, idêntico ao do app) e
  compara com o relatado. Um cliente que manda ao relay entradas diferentes das que registra é pego aqui
  (`replay_mismatch` → `void`).
- **Fila de revisão**: `GET/PATCH /api/v1/admin/match_reviews`.
- Não cobre (fora do escopo "básico"): bots/macros que jogam com entradas legítimas, manipulação de memória que
  mantém os dois lados consistentes, lag switch além do que a tolerância de 10 s já pune. Re-simular o replay no
  servidor exigiria a engine em Ruby/Node no backend — pendente, se necessário.
- Identidade e cobrança continuam só nos BFFs; nada novo aqui.

## 8. Pendências

- Rodar `detmath.test.ts` (valores bit a bit) e uma partida online real em Hermes (Android e iOS) contra V8.
- Partidas em rede real (Solid Cable em produção, polling 50 ms) com `RollbackSession.stats` coletados.
- Métrica do tempo de fila ranqueada em produção (meta ≤ 30 s).
- App reaberto do zero no meio da luta (processo morto): o protocolo já devolve o histórico inteiro no `resume`
  (`from: 1`), mas o app ainda não guarda a partida em andamento para retomá-la.
- Terraform: as variáveis novas (`SEASON_LENGTH_DAYS`, `RECONNECT_GRACE_SECONDS`, `REPLAY_RETENTION_DAYS`) usam os
  padrões; ainda não estão em `deploy/terraform/linode`.
