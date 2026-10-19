# F1-02 — Sistema de combate v1 (regras do designer de combate)

Fase: 1 — Fatia vertical. Status do épico: **TODO**.
Dono do épico: designer de combate (humano). Executor: engine.
Objetivo: fechar as regras do sistema para o lançamento (ver [GDD seção 2](../gdd/GDD.md#2-sistema-de-luta)).

---

## F1-02.1 — Juggle points
Owner: engine
Objective: limitar quantos golpes acertam um oponente no ar (formato `juggle` do MUGEN).
Dependencies: nenhuma
Files in scope: mobile/src/engine/ (HitDef, estado de queda), testes; docs/CHARACTERS.md
Acceptance criteria: compatível com o parâmetro do MUGEN; sem combos infinitos no fuzz com a Kaze e a Brasa de rascunho.
Tests required: teste de limite de juggle; fuzz; `npm run test:ci`
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou licença: muda a simulação
Evidence (commands/logs/devices): testes
Status: TODO

## F1-02.2 — Escalonamento de dano em combos
Owner: engine (regra do designer de combate)
Objective: cada acerto seguido no mesmo combo causa menos dano, com piso mínimo.
Dependencies: nenhuma
Files in scope: mobile/src/engine/, constants.ts
Acceptance criteria: tabela de escalonamento configurável; supers com piso próprio.
Tests required: teste com combo conhecido e dano esperado
Metrics/baseline: dano máximo de combo sem barra (definido pelo designer)
Impacto em determinismo, justiça online, privacidade ou licença: muda a simulação
Evidence (commands/logs/devices): testes
Status: TODO

## F1-02.3 — Revisão das mecânicas SNK
Owner: designer de combate (humano); engine implementa
Objective: decidir os valores do MAX, super turbinado, rolamento, guard crush, Just Defend e guard cancel ([GDD 2.4–2.9](../gdd/GDD.md)).
Dependencies: F0-07.2, F0-04.1
Files in scope: mobile/src/engine/constants.ts, common1.ts
Acceptance criteria: cada mecânica com valores aprovados e registrados no UPDATE da versão.
Tests required: testes de `snk.test.ts` atualizados
Metrics/baseline: valores atuais da 0.4.0 como base
Impacto em determinismo, justiça online, privacidade ou licença: muda a simulação
Evidence (commands/logs/devices): diff de constantes + testes
Status: TODO

## F1-02.4 — Regras do modo simples
Owner: designer de combate (humano) + engine
Objective: dano reduzido de especiais/supers por toque (ponto de partida 20%), combo automático de 3 golpes do botão Leve, mapeamento Especial + direção.
Dependencies: F1-03.1
Files in scope: mobile/src/engine/ (marca de "feito por atalho" no golpe), mobile/src/game/macros.ts
Acceptance criteria: a redução de dano é aplicada na simulação (não só na interface) e vale igual no online; combo automático nunca supera o combo básico do clássico.
Tests required: teste do mesmo especial por comando e por atalho, com danos diferentes
Metrics/baseline: win rate por modo de controle (telemetria a partir do playtest)
Impacto em determinismo, justiça online, privacidade ou licença: justiça online — os dois lados precisam aplicar a mesma regra
Evidence (commands/logs/devices): testes
Status: TODO

## F1-02.5 — Medidor de defesa e MAX visíveis no HUD
Owner: mobile-ux
Objective: o jogador vê quanto falta para o guard crush e quanto tempo de MAX resta.
Dependencies: nenhuma
Files in scope: mobile/src/game/renderer.ts
Acceptance criteria: legível em tela de 16:9 e 21:9; sem sobrepor os lutadores.
Tests required: render de referência
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou licença: só visual
Evidence (commands/logs/devices): capturas
Status: TODO
