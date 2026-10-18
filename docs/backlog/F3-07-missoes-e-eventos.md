# F3-07 — Missões, progressão e base para eventos

Fase: 3 — Online e economia. Status do épico: **TODO**.
Dono do épico: po. Executores: web, mobile-ux.
Objetivo: motivos para voltar no dia seguinte (D1 ≥ 40%, D7 ≥ 15%) sem energia, sem limite de partidas e sem
pressão de compra; estrutura pronta para eventos da Fase 6.

---

## F3-07.1 — Missões diárias e semanais
Owner: web + mobile-ux; po define o catálogo
Objective: 3 diárias e 5 semanais, com Moedas e XP de passe; 1 troca grátis por dia (+1 por anúncio recompensado).
Dependencies: F3-05.1
Files in scope: web/, mobile/app/, docs/PROTOCOL.md
Acceptance criteria: missões verificadas no servidor; nenhuma exige comprar algo; mistura de modos (não obriga ranqueada).
Tests required: specs; testes de tela
Metrics/baseline: % de jogadores que completam ao menos 1 missão por dia
Impacto em determinismo, justiça online, privacidade ou anúncios: anúncio só como opção de troca
Evidence (commands/logs/devices): specs
Status: TODO

## F3-07.2 — Nível de conta e maestria por lutador
Owner: web + mobile-ux
Objective: XP por partida; recompensas cosméticas por nível de maestria ([GDD 5.1](../gdd/GDD.md#51-progressão)).
Dependencies: F3-05.1
Files in scope: web/, mobile/app/profile.tsx, mobile/app/select.tsx
Acceptance criteria: tabela de recompensas; nenhuma recompensa altera a luta.
Tests required: specs
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou anúncios: nenhum
Evidence (commands/logs/devices): specs
Status: TODO

## F3-07.3 — Configuração remota de eventos
Owner: web
Objective: ligar eventos com data de início e fim, regras (das que a engine já suporta: vida, tempo, lutador da semana) e recompensas, sem nova versão do app.
Dependencies: F2-05.3 (mesma preocupação de versão nos dois lados)
Files in scope: web/, docs/PROTOCOL.md
Acceptance criteria: regra de evento enviada ao app com versão; o online só pareia jogadores com a mesma regra.
Tests required: specs; teste de partida com regra
Metrics/baseline: participação em evento (Fase 6)
Impacto em determinismo, justiça online, privacidade ou anúncios: determinismo — regras precisam ser idênticas nos dois lados
Evidence (commands/logs/devices): specs
Status: TODO
