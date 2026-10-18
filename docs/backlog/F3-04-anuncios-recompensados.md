# F3-04 — Anúncios só com recompensa

Fase: 3 — Online e economia. Status do épico: **TODO**.
Dono do épico: mobile-ux. Apoio: security-devops (AdMob, políticas), po.
Objetivo: tirar banner e interstitial; deixar só anúncios recompensados escolhidos pelo jogador
([GDD 5.4](../gdd/GDD.md#54-anúncios--só-com-recompensa)).

---

## F3-04.1 — Remover banner e interstitial
Owner: mobile-ux
Objective: nenhum banner nos menus e nenhum interstitial entre partidas.
Dependencies: decisão do dono do projeto sobre o "Premium" atual
Files in scope: mobile/src/services/ads.ts, ads.web.ts, telas que mostram banner, mobile/app/paywall.tsx
Acceptance criteria: busca no código sem banner/interstitial ativos; testes de tela atualizados.
Tests required: `npm run test:ci`
Metrics/baseline: receita de anúncios cai a zero até os recompensados entrarem (esperado)
Impacto em determinismo, justiça online, privacidade ou anúncios: anúncios
Evidence (commands/logs/devices): gates
Status: TODO

## F3-04.2 — Pontos de anúncio recompensado
Owner: mobile-ux + web (crédito no servidor)
Objective: continue no arcade (existe), dobrar Moedas de uma partida (limite diário), troca extra de missão.
Dependencies: F3-02.3, F3-07.1
Files in scope: mobile/src/services/ads.ts, web/ (verificação do anúncio no servidor, se o AdMob permitir), docs/PROTOCOL.md
Acceptance criteria: recompensa só depois do anúncio completo, creditada no servidor; limite diário respeitado; nenhum anúncio na luta nem ao redor da ranqueada; passe pago dá a recompensa sem anúncio.
Tests required: testes do serviço; specs de crédito
Metrics/baseline: anúncios por jogador ativo por dia (soft launch)
Impacto em determinismo, justiça online, privacidade ou anúncios: anúncios; consentimento UMP/ATT mantido
Evidence (commands/logs/devices): teste com IDs de teste em aparelho
Status: TODO
