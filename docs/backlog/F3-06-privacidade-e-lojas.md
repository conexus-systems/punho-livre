# F3-06 — Privacidade, políticas das lojas e classificação etária

Fase: 3 — Online e economia. Status do épico: **TODO**.
Dono do épico: security-devops. Humanos: jurídico.
Objetivo: chegar ao soft launch sem rejeição de loja e em conformidade com a LGPD.

---

## F3-06.1 — Política de privacidade e termos
Owner: jurídico (humano); security-devops lista os dados
Objective: política e termos cobrindo conta, telemetria, crash, anúncios, compras, replays guardados, anti-trapaça.
Dependencies: F0-05, F3-01.5, F3-04, F3-05
Files in scope: textos publicados (fora do app) e links no app
Acceptance criteria: inventário de dados (o quê, por quê, por quanto tempo, com quem) aprovado; links em Ajustes e na loja.
Tests required: n/a
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou anúncios: privacidade
Evidence (commands/logs/devices): documento publicado
Status: TODO

## F3-06.2 — Ficha de segurança de dados e rótulos de privacidade
Owner: security-devops
Objective: Data safety (Google Play) e Privacy Nutrition Labels (App Store) iguais ao inventário.
Dependencies: F3-06.1
Files in scope: mobile/PLAY_LISTING.md
Acceptance criteria: preenchido e revisado; SDKs de terceiros (anúncios, crash, análise) declarados.
Tests required: n/a
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou anúncios: privacidade, anúncios
Evidence (commands/logs/devices): capturas dos formulários
Status: TODO

## F3-06.3 — Classificação etária
Owner: po + security-devops
Objective: questionário IARC e ClassInd; meta 12 anos.
Dependencies: conteúdo final da fatia (F1-08)
Files in scope: mobile/PLAY_LISTING.md
Acceptance criteria: classificação obtida e coerente com o público; anúncios configurados para a faixa.
Tests required: n/a
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou anúncios: anúncios (conteúdo dos anúncios por faixa etária)
Evidence (commands/logs/devices): certificado
Status: TODO

## F3-06.4 — Revisão de segurança antes do soft launch
Owner: security-devops
Objective: dependências, segredos, assinaturas, permissões do app, endpoints expostos.
Dependencies: F3-01 a F3-05
Files in scope: mobile/, web/, deploy/
Acceptance criteria: `bin/brakeman` sem alertas altos; nenhuma permissão desnecessária; segredos só no cofre.
Tests required: gates + revisão
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou anúncios: todos
Evidence (commands/logs/devices): relatório
Status: TODO
