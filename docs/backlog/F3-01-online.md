# F3-01 — Online robusto (determinismo entre aparelhos, soak, reconexão, ranqueada, anti-trapaça)

Fase: 3 — Online e venda (mai – ago/2027; trabalho já começou). Status do épico: **IN_PROGRESS** (agentes trabalhando agora).
Dono do épico: netcode. Apoio: engine, web, qa, security-devops.
Objetivo: online que não dessincroniza, aguenta rede ruim de celular e é justo na ranqueada.

---

## F3-01.1 — Determinismo entre aparelhos diferentes
Owner: engine + netcode
Objective: mesma partida (inputs gravados) produz o mesmo checksum em Android (Hermes) e iOS, em chips ARM de fabricantes diferentes e na versão web.
Dependencies: F0-05.4 (lab)
Files in scope: mobile/src/engine/, mobile/src/net/, testes; ferramenta de replay
Acceptance criteria:
- Replays de partidas longas (todos os lutadores, todos os cenários) com checksum idêntico por frame em todos os aparelhos da matriz.
- Lista de funções matemáticas permitidas no `stepWorld` (sem depender de implementação do motor JS para `Math.sin`, `Math.pow` etc., ou com tabela própria).
Tests required: teste de replay cruzado; teste que falha se o `stepWorld` usar função não permitida
Metrics/baseline: zero divergência nos replays de referência
Impacto em determinismo, justiça online, privacidade ou licença: crítico para determinismo
Evidence (commands/logs/devices): aparelhos, versões e checksums
Status: IN_PROGRESS

## F3-01.2 — Soak test
Owner: netcode + qa
Objective: muitas partidas seguidas entre bots em rede simulada (latência, perda, jitter) e em rede real (4G/Wi-Fi).
Dependencies: F3-01.1
Files in scope: mobile/src/net/, scripts de teste, web/app/channels/
Acceptance criteria: taxa de dessincronia e de queda de partida abaixo do limite definido pelo netcode; servidor estável na carga do soft launch (estimativa de pico a definir com o po).
Tests required: soak automatizado; relatório de `RollbackSession.stats`
Metrics/baseline: rollbacks por segundo, profundidade, stalls, dessincronias por 1000 partidas
Impacto em determinismo, justiça online, privacidade ou licença: justiça online
Evidence (commands/logs/devices): relatório do soak
Status: IN_PROGRESS

## F3-01.3 — Reconexão
Owner: netcode + web
Objective: queda curta de rede (troca Wi-Fi ↔ 4G, app em segundo plano por poucos segundos) não encerra a partida.
Dependencies: nenhuma
Files in scope: mobile/src/net/, web/app/channels/match_channel.rb, docs/PROTOCOL.md
Acceptance criteria: janela de reconexão definida; depois dela, resultado justo (quem caiu perde a ranqueada só se a queda for dele, conforme regra aprovada pelo po).
Tests required: testes de queda e volta; specs do canal
Metrics/baseline: % de partidas que terminam
Impacto em determinismo, justiça online, privacidade ou licença: justiça online
Evidence (commands/logs/devices): testes e teste em aparelho trocando de rede
Status: IN_PROGRESS

## F3-01.4 — Ranqueada com temporadas
Owner: web + netcode; po define as regras
Objective: faixas visíveis, Elo escondido para pareamento, temporadas, punição de abandono, busca que abre a faixa com o tempo.
Dependencies: F3-01.3
Files in scope: web/ (ranking, temporadas), mobile/app/online.tsx, docs/PROTOCOL.md
Acceptance criteria: resultado só conta com os dois relatos iguais (regra atual); faixas e recompensas cosméticas de fim de temporada.
Tests required: specs de ranking e de temporada; testes de tela
Metrics/baseline: tempo de espera na fila; diferença média de Elo por partida
Impacto em determinismo, justiça online, privacidade ou licença: justiça online
Evidence (commands/logs/devices): specs
Status: IN_PROGRESS

## F3-01.5 — Anti-trapaça
Owner: security-devops + netcode
Objective: detectar inputs impossíveis (macros externas, velocidade sobre-humana), relatos de resultado falsos, app modificado e versões diferentes de conteúdo.
Dependencies: F3-01.1
Files in scope: web/, mobile/src/net/
Acceptance criteria: verificação de integridade do app (Android: feita junto com a licença do Play Integrity, F3-02.1; iOS: pendente); servidor recusa versões antigas; replays de partidas ranqueadas guardados por um tempo para revisão; denúncia de jogador.
Tests required: testes com cliente adulterado simulado
Metrics/baseline: denúncias por 1000 partidas
Impacto em determinismo, justiça online, privacidade ou licença: privacidade — guarda de replays e dados de integridade na política
Evidence (commands/logs/devices): testes
Status: IN_PROGRESS

## F3-01.6 — Online casual com busca rápida
Owner: web + mobile-ux
Objective: fila sem ranking, além da sala com código.
Dependencies: F3-01.4
Files in scope: web/app/channels/matchmaking_channel.rb, mobile/app/online.tsx
Acceptance criteria: pareamento por latência; sem afetar o Elo.
Tests required: specs; testes de tela
Metrics/baseline: tempo de espera
Impacto em determinismo, justiça online, privacidade ou licença: nenhum
Evidence (commands/logs/devices): specs
Status: TODO
