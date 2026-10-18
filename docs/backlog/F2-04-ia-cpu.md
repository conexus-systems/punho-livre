# F2-04 — IA da CPU por lutador e dificuldade

Fase: 2 — Elenco. Status do épico: **TODO**.
Dono do épico: engine. Apoio: designer de combate.
Objetivo: CPU que ensina no fácil e desafia no difícil, jogando como o arquétipo do lutador.

---

## F2-04.1 — Perfis de IA por arquétipo
Owner: engine
Objective: zoner mantém distância, grappler busca o agarrão, counter espera, rushdown pressiona etc.
Dependencies: F2-01 (lutadores finais)
Files in scope: mobile/src/game/ai.ts, testes
Acceptance criteria: IA determinística (usa o `Random` da engine); comportamento descrito por perfil; usa o sistema (rolamento, Just Defend, MAX) conforme a dificuldade.
Tests required: testes de IA; lutas CPU × CPU no bench
Metrics/baseline: taxa de vitória da CPU por dificuldade contra jogadores (telemetria)
Impacto em determinismo, justiça online, privacidade ou licença: a IA não roda no online ranqueado
Evidence (commands/logs/devices): resultados do bench
Status: TODO

## F2-04.2 — Curva de dificuldade
Owner: engine + designer de combate (humano)
Objective: 5 níveis com tempo de reação, uso de defesa e leitura diferentes; o arcade sobe a dificuldade aos poucos.
Dependencies: F2-04.1
Files in scope: mobile/src/game/ai.ts, mobile/src/match.ts
Acceptance criteria: no fácil, um jogador do tutorial vence a primeira luta na maioria das vezes (playtest).
Tests required: playtest
Metrics/baseline: % de vitória na 1ª luta do arcade
Impacto em determinismo, justiça online, privacidade ou licença: nenhum
Evidence (commands/logs/devices): relatório de playtest
Status: TODO
