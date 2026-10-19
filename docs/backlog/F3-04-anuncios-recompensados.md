# F3-04 — Anúncios só com recompensa

Fase: 3 — Online e venda. Status do épico: **CANCELADO**.
Dono do épico: mobile-ux. Apoio: security-devops (AdMob, políticas), po.
Objetivo: tirar banner e interstitial; deixar só anúncios recompensados escolhidos pelo jogador
(antigo GDD 5.4).

> **CANCELADO (out/2026):** o jogo passou a ser pago (compra única de R$ 49,99 na Google Play), sem anúncios de nenhum tipo; AdMob, ATT, banner, interstitial e o Premium já saíram do app e o "continuar" do arcade é livre. Ver [GDD § 5](../gdd/GDD.md#5-progressão-e-modelo-de-venda) e [F3-02](F3-02-licenca-e-venda.md). O texto abaixo fica só como histórico.

---

## F3-04.1 — Remover banner e interstitial
Owner: mobile-ux
Objective: nenhum banner nos menus e nenhum interstitial entre partidas.
Dependencies: decisão do dono do projeto sobre o "Premium" atual
Files in scope: mobile/src/services/ads.ts, ads.web.ts, telas que mostram banner, mobile/app/paywall.tsx
Acceptance criteria: busca no código sem banner/interstitial ativos; testes de tela atualizados.
Tests required: `npm run test:ci`
Metrics/baseline: receita de anúncios cai a zero até os recompensados entrarem (esperado)
Impacto em determinismo, justiça online, privacidade ou licença: anúncios
Evidence (commands/logs/devices): gates
Status: CANCELADO

## F3-04.2 — Pontos de anúncio recompensado
Owner: mobile-ux + web (crédito no servidor)
Objective: continue no arcade (existe), dobrar Moedas de uma partida (limite diário), troca extra de missão.
Dependencies: F3-02.3, F3-07.1
Files in scope: mobile/src/services/ads.ts, web/ (verificação do anúncio no servidor, se o AdMob permitir), docs/PROTOCOL.md
Acceptance criteria: recompensa só depois do anúncio completo, creditada no servidor; limite diário respeitado; nenhum anúncio na luta nem ao redor da ranqueada; passe pago dá a recompensa sem anúncio.
Tests required: testes do serviço; specs de crédito
Metrics/baseline: anúncios por jogador ativo por dia (soft launch)
Impacto em determinismo, justiça online, privacidade ou licença: anúncios; consentimento UMP/ATT mantido
Evidence (commands/logs/devices): teste com IDs de teste em aparelho
Status: CANCELADO
