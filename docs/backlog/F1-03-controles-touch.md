# F1-03 — Controles touch (simples, clássico, editor de layout)

Fase: 1 — Fatia vertical. Status do épico: **IN_PROGRESS** (agentes trabalhando agora).
Dono do épico: mobile-ux. Apoio: engine (macros), designer de combate (regras), qa (aparelhos).
Objetivo: controles que funcionam no toque para iniciantes e para jogadores sérios
([GDD seção 3](../gdd/GDD.md#3-esquema-de-controle)).

---

## F1-03.1 — Modo simples
Owner: mobile-ux
Objective: botões Leve, Forte, Especial (+ direção), Super, Esquiva e MAX, a partir dos "botões assistidos" que já existem.
Dependencies: nenhuma (regras de dano em F1-02.4)
Files in scope: mobile/app/fight.tsx, mobile/src/game/macros.ts, mobile/src/settings.ts, componentes da luta
Acceptance criteria:
- Os 4 especiais de cada lutador saem por Especial + neutro/→/↓/←.
- Super aparece só com estoque; ↓ + Super = super 2.
- Alvos ≥ 48 dp; multi-toque (direção + 2 botões) funciona.
Tests required: testes de macro por botão; teste de tela; teste em aparelho
Metrics/baseline: conclusão do tutorial ≥ 70% (meta)
Impacto em determinismo, justiça online, privacidade ou anúncios: a entrada vira inputs normais da engine; a marca de "atalho" segue no input (F1-02.4)
Evidence (commands/logs/devices): vídeo em aparelho
Status: IN_PROGRESS

## F1-03.2 — Modo clássico revisado
Owner: mobile-ux
Objective: direcional fixo ou flutuante, zona morta ajustável, A B C D + atalhos A+B, C+D, MAX.
Dependencies: nenhuma
Files in scope: mobile/app/fight.tsx, mobile/src/settings.ts
Acceptance criteria: meia-lua, Z, meia-volta e carga executáveis com taxa de acerto registrada em teste com 5 pessoas.
Tests required: teste em aparelho com roteiro de comandos
Metrics/baseline: taxa de acerto por comando
Impacto em determinismo, justiça online, privacidade ou anúncios: nenhum
Evidence (commands/logs/devices): planilha do teste
Status: IN_PROGRESS

## F1-03.3 — Editor de layout
Owner: mobile-ux
Objective: mover, redimensionar e mudar a transparência de cada botão; perfis salvos; voltar ao padrão.
Dependencies: F1-03.1, F1-03.2
Files in scope: mobile/app/settings.tsx (ou tela nova), mobile/src/settings.ts
Acceptance criteria: funciona em 16:9 a 21:9 e respeita áreas seguras (entalhe, barra de gestos); design W10M nos menus.
Tests required: testes de tela; aparelho com entalhe
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou anúncios: nenhum
Evidence (commands/logs/devices): capturas em 2 proporções de tela
Status: IN_PROGRESS

## F1-03.4 — Escolha do modo no primeiro uso e ícone no online
Owner: mobile-ux + netcode
Objective: o jogador escolhe simples ou clássico na primeira abertura; o oponente online vê o modo de cada um.
Dependencies: F1-03.1
Files in scope: mobile/app/, mobile/src/net/ (troca do modo no início da partida), docs/PROTOCOL.md se o contrato mudar
Acceptance criteria: troca em Ajustes a qualquer momento; ícone na tela de versus online.
Tests required: teste de tela; teste da mensagem de início de partida
Metrics/baseline: % de jogadores em cada modo
Impacto em determinismo, justiça online, privacidade ou anúncios: justiça online — transparência do modo
Evidence (commands/logs/devices): capturas
Status: IN_PROGRESS

## F1-03.5 — Controle Bluetooth
Owner: mobile-ux
Objective: mapear controles do sistema para A B C D e atalhos.
Dependencies: F0-05.4 (controles no lab)
Files in scope: mobile/app/fight.tsx
Acceptance criteria: controle padrão Android e iOS funcionando na luta e nos menus.
Tests required: aparelho + controle
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou anúncios: nenhum
Evidence (commands/logs/devices): modelos de controle testados
Status: TODO
