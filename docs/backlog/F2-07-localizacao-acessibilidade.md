# F2-07 — Localização e acessibilidade

Fase: 2 — Elenco. Status do épico: **TODO**.
Dono do épico: mobile-ux. Apoio: po, tradutores (humanos).
Objetivo: PT-BR e ES-LatAm no soft launch; EN no global; jogo acessível dentro do possível num jogo de luta.

---

## F2-07.1 — Estrutura de textos traduzíveis
Owner: mobile-ux
Objective: nenhum texto fixo nas telas; arquivos por idioma; idioma do sistema com troca em Ajustes.
Dependencies: nenhuma
Files in scope: mobile/app/, mobile/components/, mobile/src/
Acceptance criteria: teste que falha se houver texto fixo novo em tela; pseudo-idioma para testar textos longos.
Tests required: teste de textos
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou licença: nenhum
Evidence (commands/logs/devices): testes
Status: TODO

## F2-07.2 — Tradução ES-LatAm e EN
Owner: tradutores (humanos); po revisa
Objective: menus, tutorial, golpes, histórias, ficha das lojas.
Dependencies: F2-07.1, F2-03.1
Files in scope: arquivos de idioma
Acceptance criteria: revisão por falante nativo de cada idioma; nomes de golpes mantidos ou adaptados com critério documentado.
Tests required: revisão em aparelho
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou licença: nenhum
Evidence (commands/logs/devices): revisão
Status: TODO

## F2-07.3 — Acessibilidade
Owner: mobile-ux
Objective: "Reduzir movimento" (tremor, flashes), legendas de voz, contraste AA nos menus, rótulos para leitor de tela nos menus, opção de indicar golpe alto/baixo por cor e por forma (daltonismo).
Dependencies: F1-01.3, F1-07.3
Files in scope: mobile/src/settings.ts, renderer, telas
Acceptance criteria: cada opção funcionando e testada; flashes de super dentro de limites seguros para fotossensibilidade.
Tests required: testes de tela; revisão em aparelho com leitor de tela
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou licença: só visual
Evidence (commands/logs/devices): capturas
Status: TODO
