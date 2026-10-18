# F0-06 — Repositório definitivo e build em aparelho

Fase: 0 — Fundação. Status do épico: **TODO**.
Dono do épico: security-devops. Humano: admin da org `conexus-systems`.
Objetivo: sair do branch de protótipo e ter o jogo rodando em aparelho real, com o pipeline de release
funcionando. Base: [../../HANDOFF.md](../../HANDOFF.md).

---

## F0-06.1 — Criar `conexus-systems/mugen-arena` e mover o histórico
Owner: admin da org (humano) + security-devops
Objective: repositório privado definitivo (nome final depois de F0-01).
Dependencies: nenhuma (o nome do repositório pode mudar depois do F0-01.3)
Files in scope: .github/, README.md, HANDOFF.md
Acceptance criteria: histórico completo; proteção de branch em `main`; workflows rodando.
Tests required: CI verde no primeiro PR
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou anúncios: nenhum
Evidence (commands/logs/devices): link do PR e do CI
Status: TODO

## F0-06.2 — Cadastro nos BFFs, segredos e primeiro deploy
Owner: security-devops
Objective: backend no ar com bff-auth, bff-payment e bff-api configurados (lista em web/README.md).
Dependencies: F0-06.1
Files in scope: deploy/terraform/linode, web/README.md
Acceptance criteria: login e partida online de teste funcionando contra o ambiente real.
Tests required: teste ponta a ponta de login + sala online
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou anúncios: segredos só no cofre, nunca no Git
Evidence (commands/logs/devices): log do deploy; captura do login no aparelho
Status: TODO

## F0-06.3 — Build de desenvolvimento em aparelho
Owner: mobile-ux + qa
Objective: primeira execução do app em aparelho real (pendente desde a 0.1.0).
Dependencies: F0-06.1
Files in scope: mobile/eas.json, mobile/app.config.ts
Acceptance criteria: luta, menus, som e anúncio de teste funcionando no Android de referência e num iPhone; problemas registrados como tarefas.
Tests required: roteiro de QA de `agents/qa.md`
Metrics/baseline: primeira medição real de fps (antes de qualquer otimização)
Impacto em determinismo, justiça online, privacidade ou anúncios: primeiro teste real do consentimento UMP/ATT
Evidence (commands/logs/devices): modelos, versões do SO, vídeos
Status: TODO
