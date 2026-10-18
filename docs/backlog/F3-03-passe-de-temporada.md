# F3-03 — Passe de temporada

Fase: 3 — Online e economia. Status do épico: **TODO**.
Dono do épico: po. Executores: web, mobile-ux, diretor de arte (itens).
Objetivo: trilha grátis e paga, só cosméticos e Moedas; itens voltam à loja depois.

---

## F3-03.1 — Regras do passe
Owner: po
Objective: duração da temporada, número de níveis, XP por partida e missão, itens por trilha, quanto tempo um jogador médio leva para completar.
Dependencies: F3-02.1
Files in scope: docs/gdd/ECONOMIA.md
Acceptance criteria: completável com jogo normal (meta a validar: ≈ 60–70% da temporada jogando 30 min por dia); sem compra de níveis que pule o jogo inteiro (decisão do dono do projeto).
Tests required: simulação na planilha
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou anúncios: nenhum
Evidence (commands/logs/devices): planilha
Status: TODO

## F3-03.2 — Backend do passe
Owner: web
Objective: temporadas, níveis, XP, recompensas, compra da trilha paga via entitlement.
Dependencies: F3-03.1, F3-02.3
Files in scope: web/, docs/PROTOCOL.md
Acceptance criteria: XP só concedido pelo servidor; recompensas idempotentes.
Tests required: specs
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou anúncios: nenhum
Evidence (commands/logs/devices): specs
Status: TODO

## F3-03.3 — Tela do passe
Owner: mobile-ux
Objective: trilhas, progresso, recompensas a resgatar.
Dependencies: F3-03.2
Files in scope: mobile/app/
Acceptance criteria: mostra claramente o que é grátis e o que é pago.
Tests required: testes de tela
Metrics/baseline: % de jogadores ativos que resgatam recompensas
Impacto em determinismo, justiça online, privacidade ou anúncios: nenhum
Evidence (commands/logs/devices): capturas
Status: TODO
