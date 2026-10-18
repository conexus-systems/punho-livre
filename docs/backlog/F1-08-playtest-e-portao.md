# F1-08 — Playtests e portão da fatia vertical

Fase: 1 — Fatia vertical. Status do épico: **TODO**.
Dono do épico: po. Apoio: qa, designer de combate, diretor de arte, dono do projeto.
Objetivo: decidir com evidência se a produção do elenco começa (go/no-go da Fase 2).

---

## F1-08.1 — Playtests externos
Owner: po + qa
Objective: 2 rodadas com 10–15 pessoas de fora da equipe (iniciantes e jogadores de luta), em aparelhos do lab.
Dependencies: F1-04.4, F1-05.3, F1-07.2
Files in scope: docs/ (relatório do playtest)
Acceptance criteria: roteiro, questionário e gravação de tela com consentimento; relatório com problemas priorizados.
Tests required: n/a
Metrics/baseline: conclusão do tutorial; nota de diversão (1–5); compreensão dos controles
Impacto em determinismo, justiça online, privacidade ou anúncios: consentimento escrito para gravação
Evidence (commands/logs/devices): relatório
Status: TODO

## F1-08.2 — Revisão do portão
Owner: dono do projeto (humano); po prepara
Objective: conferir os critérios do portão da Fase 1 no [ROADMAP](../ROADMAP.md#fase-1--fatia-vertical-dez2026--fev2027).
Dependencies: F1-08.1, F1-04.5
Files in scope: docs/ROADMAP.md, backlog da Fase 2
Acceptance criteria: cada critério com "atingido", "não atingido + plano" ou "medido diferente"; custo e prazo da Fase 2 recalculados com as horas reais.
Tests required: n/a
Metrics/baseline: 60 fps; tutorial ≥ 70%; custo real por lutador
Impacto em determinismo, justiça online, privacidade ou anúncios: nenhum
Evidence (commands/logs/devices): ata
Status: TODO

## F1-08.3 — Release da fatia vertical
Owner: security-devops
Objective: versão com UPDATE, tag e release, distribuída para testadores (teste interno das lojas).
Dependencies: F1-08.2
Files in scope: mobile/app.config.ts, mobile/package.json, docs/UPDATE_X.Y.Z.md
Acceptance criteria: segue o fluxo de release do AGENTS.md; build nas trilhas de teste interno do Google Play e do TestFlight.
Tests required: gates completos
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou anúncios: primeira submissão — revisar políticas
Evidence (commands/logs/devices): link da release
Status: TODO
