# F3-05 — Conta e progresso salvo

Fase: 3 — Online e venda. Status do épico: **TODO**.
Dono do épico: web. Apoio: mobile-ux, security-devops.
Objetivo: o progresso (nível, maestria, desbloqueios, ranque) fica na conta CONEXUS e sobrevive a troca de
aparelho, sem obrigar login para jogar offline.

---

## F3-05.1 — Progresso no servidor
Owner: web
Objective: perfil de jogo com nível de conta, maestria por lutador, desbloqueios e estatísticas.
Dependencies: nenhuma
Files in scope: web/ (models, API), docs/PROTOCOL.md
Acceptance criteria: identidade só pelo bff-auth; recompensas de partida concedidas pelo servidor a partir de resultado validado (online) ou com limites (offline).
Tests required: specs
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou licença: privacidade — dados mínimos
Evidence (commands/logs/devices): specs
Status: TODO

## F3-05.2 — Jogar sem conta e vincular depois
Owner: mobile-ux + web
Objective: o jogador começa sem login; ao entrar na conta, o progresso local é vinculado uma vez.
Dependencies: F3-05.1
Files in scope: mobile/src/services/auth.ts, mobile/src/store.ts, web/
Acceptance criteria: online pede login; offline não; vínculo não duplica progresso.
Tests required: testes de vínculo; specs
Metrics/baseline: % de jogadores que criam conta até D7
Impacto em determinismo, justiça online, privacidade ou licença: privacidade
Evidence (commands/logs/devices): testes
Status: TODO

## F3-05.3 — Excluir conta e dados
Owner: web + security-devops
Objective: exclusão de conta e de dados de jogo pelo app (exigência das lojas e da LGPD).
Dependencies: F3-05.1
Files in scope: web/, mobile/app/profile.tsx
Acceptance criteria: fluxo no app; dados apagados ou anonimizados no prazo informado na política.
Tests required: specs
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou licença: privacidade
Evidence (commands/logs/devices): specs; captura do fluxo
Status: TODO
