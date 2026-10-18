# F1-05 — Cenário da fatia vertical: Pelourinho

Fase: 1 — Fatia vertical. Status do épico: **TODO**.
Dono do épico: diretor de arte (humano). Executores: estúdio terceirizado, mobile-ux (renderizador).
Objetivo: um cenário no padrão final, com plateia e paralaxe, que rode a 60 fps junto com dois lutadores finais.

---

## F1-05.1 — Arte do Pelourinho
Owner: estúdio terceirizado (humano), aprovado pelo diretor de arte
Objective: cenário em camadas (fundo, meio, chão, frente) no estilo escolhido, com roda de capoeira e plateia animada em laço.
Dependencies: F0-03.4
Files in scope: entregas em PNG/WebP por camada + descrição das camadas
Acceptance criteria: contraste que não esconde os lutadores (teste de leitura com os dois lutadores na frente); sem marcas reais (fachadas, logos, placas de empresas).
Tests required: composição de teste em 16:9 e 21:9
Metrics/baseline: horas reais do cenário
Impacto em determinismo, justiça online, privacidade ou anúncios: nenhum
Evidence (commands/logs/devices): imagens aprovadas
Status: TODO

## F1-05.2 — Formato de cenário em camadas
Owner: mobile-ux (com engine)
Objective: carregar cenário a partir de imagens por camada (hoje os cenários são procedurais em `scripts/stages`), com paralaxe e animação em laço.
Dependencies: nenhuma
Files in scope: mobile/src/game/stages.ts, stageArt.ts, renderer.ts, scripts/stages/
Acceptance criteria: formato documentado; um cenário de exemplo; os procedurais continuam funcionando até serem retirados.
Tests required: render de referência; teste de carregamento
Metrics/baseline: chamadas de desenho por frame
Impacto em determinismo, justiça online, privacidade ou anúncios: só visual
Evidence (commands/logs/devices): capturas
Status: TODO

## F1-05.3 — Desempenho do cenário em aparelho
Owner: qa
Objective: Pelourinho final + Kaze × Brasa finais a 60 fps no Android de referência.
Dependencies: F1-05.1, F1-05.2, F1-04.4
Files in scope: n/a
Acceptance criteria: p95 de tempo de frame ≤ 16,7 ms numa luta de 3 rounds (a confirmar com o tech-lead); memória medida.
Tests required: sessão em aparelho com telemetria de desempenho
Metrics/baseline: meta 60 fps
Impacto em determinismo, justiça online, privacidade ou anúncios: nenhum
Evidence (commands/logs/devices): números e modelo do aparelho
Status: TODO
