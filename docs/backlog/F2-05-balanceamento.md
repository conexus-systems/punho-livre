# F2-05 — Balanceamento

Fase: 2 — Elenco (continua na 3 e na 6). Status do épico: **TODO**.
Dono do épico: designer de combate (humano). Apoio: engine (ferramentas), qa, po (telemetria).
Objetivo: cada lutador com taxa de vitória entre 45% e 55%, sem estratégia dominante.

---

## F2-05.1 — Relatório de balanceamento por telemetria
Owner: po (com security-devops para os dados)
Objective: taxa de vitória por lutador, por confronto e por faixa de habilidade; uso de cada golpe; duração das partidas.
Dependencies: F0-05.2
Files in scope: painel de análise
Acceptance criteria: atualizado semanalmente; amostra mínima por confronto definida pelo designer.
Tests required: n/a
Metrics/baseline: meta 45–55% por lutador
Impacto em determinismo, justiça online, privacidade ou licença: dados agregados, sem identificar jogador
Evidence (commands/logs/devices): relatório
Status: TODO

## F2-05.2 — Sessões internas de balanceamento
Owner: designer de combate (humano)
Objective: sessões semanais com jogadores experientes; lista de problemas (loops, golpes sem resposta, infinitos).
Dependencies: F2-01 (cada lutador que entra)
Files in scope: notas de patch internas
Acceptance criteria: cada problema vira ajuste ou "sem mudança" justificado.
Tests required: fuzz e testes de frame data depois de cada ajuste
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou licença: muda a simulação
Evidence (commands/logs/devices): notas de patch
Status: TODO

## F2-05.3 — Ajuste de balanceamento sem nova versão do app
Owner: tech-lead (com netcode e security-devops)
Objective: avaliar se valores de balanceamento podem vir do servidor (com versão e hash), para corrigir sem esperar a loja.
Dependencies: F3-01
Files in scope: proposta técnica; docs/PROTOCOL.md se aprovado
Acceptance criteria: decisão registrada; se aprovado, os dois lados do online sempre usam a mesma versão (conferida no início da partida).
Tests required: teste de partida com versões diferentes (deve recusar)
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou licença: crítico para determinismo — versão errada = dessincronia
Evidence (commands/logs/devices): decisão
Status: TODO
