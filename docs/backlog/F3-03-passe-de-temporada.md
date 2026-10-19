# F3-03 — Passe de temporada

Fase: 3 — Online e venda. Status do épico: **CANCELADO**.
Dono do épico: po. Executores: web, mobile-ux, diretor de arte (itens).
Objetivo: trilha grátis e paga, só cosméticos e Moedas; itens voltam à loja depois.

> **CANCELADO (out/2026):** o jogo passou a ser pago (compra única de R$ 49,99 na Google Play), sem passe, moedas nem compras no app. Ver [GDD § 5](../gdd/GDD.md#5-progressão-e-modelo-de-venda) e [F3-02](F3-02-licenca-e-venda.md). O texto abaixo fica só como histórico.

---

## F3-03.1 — Regras do passe
Owner: po
Objective: duração da temporada, número de níveis, XP por partida e missão, itens por trilha, quanto tempo um jogador médio leva para completar.
Dependencies: F3-02.1
Files in scope: docs/gdd/ECONOMIA.md
Acceptance criteria: completável com jogo normal (meta a validar: ≈ 60–70% da temporada jogando 30 min por dia); sem compra de níveis que pule o jogo inteiro (decisão do dono do projeto).
Tests required: simulação na planilha
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou licença: nenhum
Evidence (commands/logs/devices): planilha
Status: CANCELADO

## F3-03.2 — Backend do passe
Owner: web
Objective: temporadas, níveis, XP, recompensas, compra da trilha paga via entitlement.
Dependencies: F3-03.1, F3-02.3
Files in scope: web/, docs/PROTOCOL.md
Acceptance criteria: XP só concedido pelo servidor; recompensas idempotentes.
Tests required: specs
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou licença: nenhum
Evidence (commands/logs/devices): specs
Status: CANCELADO

## F3-03.3 — Tela do passe
Owner: mobile-ux
Objective: trilhas, progresso, recompensas a resgatar.
Dependencies: F3-03.2
Files in scope: mobile/app/
Acceptance criteria: mostra claramente o que é grátis e o que é pago.
Tests required: testes de tela
Metrics/baseline: % de jogadores ativos que resgatam recompensas
Impacto em determinismo, justiça online, privacidade ou licença: nenhum
Evidence (commands/logs/devices): capturas
Status: CANCELADO
