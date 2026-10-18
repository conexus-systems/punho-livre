# F2-06 — Modos offline (versus, equipes 3×3, seleção)

Fase: 2 — Elenco. Status do épico: **TODO**.
Dono do épico: mobile-ux. Apoio: engine.
Objetivo: os modos que já existem no visual e no fluxo finais.

---

## F2-06.1 — Seleção de lutador final
Owner: mobile-ux (com diretor de arte)
Objective: retratos finais, cores alternativas, lutadores bloqueados com o caminho para liberar (arcade ou Moedas).
Dependencies: F2-01
Files in scope: mobile/app/select.tsx
Acceptance criteria: mostra o que falta para liberar sem empurrar compra; W10M nos menus.
Tests required: teste de tela
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou anúncios: nenhum
Evidence (commands/logs/devices): capturas
Status: TODO

## F2-06.2 — Versus CPU e equipes 3×3 com conteúdo final
Owner: mobile-ux
Objective: versus e equipes com os 8 lutadores e os cenários finais.
Dependencies: F2-01, F2-02
Files in scope: mobile/app/, mobile/src/match.ts
Acceptance criteria: fluxos completos sem regressão; escolha de cenário e dificuldade.
Tests required: testes de tela existentes atualizados
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou anúncios: nenhum
Evidence (commands/logs/devices): testes
Status: TODO

## F2-06.3 — Versus local com controle (opcional)
Owner: mobile-ux
Objective: dois jogadores no mesmo aparelho com dois controles Bluetooth ou controle + toque.
Dependencies: F1-03.5
Files in scope: mobile/app/fight.tsx
Acceptance criteria: decisão de entrar ou não no lançamento registrada; se entrar, funciona com 2 controles.
Tests required: aparelho + 2 controles
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou anúncios: nenhum
Evidence (commands/logs/devices): vídeo
Status: TODO
