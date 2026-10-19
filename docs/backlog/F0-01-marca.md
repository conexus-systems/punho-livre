# F0-01 — Marca e nome do jogo

Fase: 0 — Fundação (nov/2026). Status do épico: **TODO**.
Dono do épico: po. Humanos: jurídico, dono do projeto.
Objetivo: trocar "MUGEN Arena" por um nome próprio (escolhido: **BAMBA**, 19/10/2026; nome já trocado no app e nos docs), verificado juridicamente, antes de qualquer divulgação ou
publicação em loja. Base: [../brand/NOMES.md](../brand/NOMES.md).

---

## F0-01.1 — Checagem jurídica dos 3 nomes favoritos
Owner: jurídico (humano)
Objective: saber se BAMBA, EMBATE e GINGA podem ser registrados e usados.
Dependencies: nenhuma
Files in scope: docs/brand/NOMES.md (registrar o resultado)
Acceptance criteria:
- Parecer escrito para cada nome: INPI (classes 9 e 41), USPTO, EUIPO, Google Play, App Store.
- Para cada nome: "pode registrar", "risco" ou "não usar", com o motivo.
Tests required: n/a
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou licença: nenhum
Evidence (commands/logs/devices): parecer anexado ou resumido em NOMES.md, com data
Status: TODO

## F0-01.2 — Teste de pronúncia e lembrança
Owner: po
Objective: confirmar que o nome é fácil de dizer e lembrar em PT, ES e EN.
Dependencies: F0-01.1 (só nomes sem impedimento)
Files in scope: docs/brand/NOMES.md
Acceptance criteria:
- 10–20 pessoas (BR, MX/AR, EUA) ouvem e escrevem o nome; taxa de acerto registrada.
- Sentidos negativos que aparecerem ficam anotados.
Tests required: n/a
Metrics/baseline: acerto de escrita por nome
Impacto em determinismo, justiça online, privacidade ou licença: nenhum (sem coletar dados pessoais além do país)
Evidence (commands/logs/devices): resumo em NOMES.md
Status: TODO

## F0-01.3 — Decisão e depósito do registro
Owner: dono do projeto (humano) + jurídico
Objective: escolher o nome e depositar o pedido de registro.
Dependencies: F0-01.1, F0-01.2
Files in scope: docs/brand/NOMES.md, docs/ROADMAP.md
Acceptance criteria: nome escolhido registrado em NOMES.md; número do pedido no INPI; domínios e @ das redes reservados.
Tests required: n/a
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou licença: nenhum
Evidence (commands/logs/devices): número do pedido; lista de domínios
Status: TODO

## F0-01.4 — Trocar nome e identificadores no app e no backend
Owner: tech-lead (com mobile-ux, web, security-devops)
Objective: app, API e infra usam o nome novo antes da primeira publicação em loja.
Dependencies: F0-01.3
Files in scope: mobile/app.config.ts, mobile/package.json, textos em mobile/app/, web/ (hosts), deploy/, README.md, AGENTS.md, HANDOFF.md; redirect OAuth no bff-auth
Acceptance criteria:
- Novo bundle id / package (ex.: `br.com.conexus.<nome>`) e novo redirect OAuth cadastrado no bff-auth.
- Nenhum texto visível ao jogador com "MUGEN" (a menção técnica ao formato pode ficar em Créditos, se o jurídico aprovar).
- Gates verdes (mobile e web).
Tests required: `npm run test:ci`, `npx tsc --noEmit`, `npx expo export --platform android`; `bundle exec rspec`
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou licença: IDs de loja mudam; `PLAY_INTEGRITY_PACKAGE` (servidor) e o projeto do Play Integrity precisam acompanhar o pacote novo; app criado como pago
Evidence (commands/logs/devices): saída dos gates; build em aparelho
Status: TODO

## F0-01.5 — Identidade visual (logo e ícone)
Owner: diretor de arte (humano)
Objective: logo e ícone do app com o nome novo.
Dependencies: F0-01.3, F0-03.4 (estilo decidido)
Files in scope: assets do app (aplicados por tarefa do mobile-ux)
Acceptance criteria: logo em versão clara, escura e monocromática; ícone adaptativo Android e iOS; legível a 48 px.
Tests required: revisão em aparelho
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou licença: nenhum
Evidence (commands/logs/devices): capturas do ícone na tela inicial de 2 aparelhos
Status: TODO
