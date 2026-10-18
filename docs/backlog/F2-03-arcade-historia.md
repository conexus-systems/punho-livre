# F2-03 — Arcade com história curta

Fase: 2 — Elenco. Status do épico: **TODO**.
Dono do épico: po (roteiro). Executores: roteirista (humano, se contratado), diretor de arte (ilustrações), mobile-ux.
Objetivo: cada lutador tem abertura, rival na 5ª luta e final ilustrado; 6 lutas
([GDD seção 4](../gdd/GDD.md#4-modos-de-jogo)).

---

## F2-03.1 — Roteiro dos 8 arcades
Owner: po (ou roteirista contratado)
Objective: abertura (≈ 80 palavras), diálogo com o rival (≈ 6 falas), final (≈ 120 palavras) por lutador; mapa de rivais.
Dependencies: F0-07.1
Files in scope: docs/gdd/HISTORIA.md (novo)
Acceptance criteria: aprovado pelo dono do projeto; revisão cultural para Iara, Severino, Brasa e Yaguar.
Tests required: n/a
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou anúncios: nenhum
Evidence (commands/logs/devices): documento aprovado
Status: TODO

## F2-03.2 — Ilustrações de abertura, rival e final
Owner: diretor de arte / estúdio (humanos)
Objective: 3 ilustrações por lutador (24 no total).
Dependencies: F2-03.1, F0-03.4
Files in scope: imagens (tamanho no orçamento de download)
Acceptance criteria: aprovadas; versões para 16:9 e 21:9.
Tests required: n/a
Metrics/baseline: tamanho total
Impacto em determinismo, justiça online, privacidade ou anúncios: nenhum
Evidence (commands/logs/devices): imagens aprovadas
Status: TODO

## F2-03.3 — Tela de história e fluxo do arcade
Owner: mobile-ux
Objective: abertura → 4 lutas → rival (diálogo) → luta 6 → final; continue com anúncio recompensado (existe).
Dependencies: F2-03.2
Files in scope: mobile/app/, mobile/src/match.ts
Acceptance criteria: textos nos 3 idiomas; pular texto; final liberado por maestria fica salvo na conta.
Tests required: teste de fluxo
Metrics/baseline: % de jogadores que terminam um arcade
Impacto em determinismo, justiça online, privacidade ou anúncios: anúncio só no continue, por escolha
Evidence (commands/logs/devices): capturas
Status: TODO
