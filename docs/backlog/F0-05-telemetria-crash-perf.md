# F0-05 — Telemetria, crash, desempenho e lab de aparelhos

Fase: 0 — Fundação. Status do épico: **IN_PROGRESS** (agentes trabalhando agora).
Dono do épico: security-devops. Executores: mobile-ux, web, qa.
Objetivo: medir de verdade (fps, crash, funil, retenção) antes de produzir conteúdo. Todas as metas do
[ROADMAP](../ROADMAP.md#4-metas) dependem disso.

---

## F0-05.1 — Relatório de crash
Owner: security-devops
Objective: crashes nativos e de JavaScript chegam com pilha, versão, modelo e SO.
Dependencies: nenhuma
Files in scope: mobile/ (inicialização), mobile/app.config.ts, segredos fora do Git
Acceptance criteria:
- Crash forçado em build de teste aparece no painel em até 10 min.
- Sem dados pessoais além do necessário; aparece na política de privacidade.
- Cálculo de crash-free por usuário disponível.
Tests required: crash forçado em Android e iOS
Metrics/baseline: crash-free (meta ≥ 99,5%)
Impacto em determinismo, justiça online, privacidade ou anúncios: privacidade — declarar na ficha de segurança de dados e no consentimento
Evidence (commands/logs/devices): captura do painel com o crash de teste
Status: IN_PROGRESS

## F0-05.2 — Eventos de telemetria do jogo
Owner: mobile-ux (app) + web (recepção, se for no backend próprio)
Objective: eventos mínimos: sessão, tutorial (cada passo), partida (modo, lutadores, resultado, duração, modo de controle), compra, anúncio recompensado, erro de online.
Dependencies: nenhuma
Files in scope: mobile/src/services/ (novo serviço), web/ (se aplicável), docs/PROTOCOL.md (se o contrato mudar)
Acceptance criteria:
- Dicionário de eventos documentado (nome, campos, quando dispara).
- Consentimento respeitado; identificador anônimo; opção de desligar em Ajustes.
- Eventos nunca disparam dentro do `stepWorld`.
Tests required: testes unitários do serviço; verificação em build de teste
Metrics/baseline: base para D1/D7/D30, tutorial ≥ 70%, win rate por lutador
Impacto em determinismo, justiça online, privacidade ou anúncios: privacidade (LGPD) — base legal e texto revisados pelo jurídico
Evidence (commands/logs/devices): eventos de uma sessão de teste no painel
Status: IN_PROGRESS

## F0-05.3 — Medição de desempenho em campo
Owner: mobile-ux
Objective: tempo de frame (p50, p95, quadros perdidos) por luta, por aparelho, por cenário.
Dependencies: F0-05.2
Files in scope: mobile/src/game/renderer.ts, mobile/app/fight.tsx
Acceptance criteria: amostragem leve (sem custo visível); dados por modelo de aparelho no painel.
Tests required: comparação de tempo de frame com e sem medição
Metrics/baseline: meta 60 fps no Android intermediário
Impacto em determinismo, justiça online, privacidade ou anúncios: medir fora do `stepWorld`
Evidence (commands/logs/devices): números de um aparelho real
Status: IN_PROGRESS

## F0-05.4 — Lab de aparelhos
Owner: qa (com o dono do projeto para a compra)
Objective: aparelhos físicos ou farm na nuvem cobrindo a matriz: Android 10+ e iOS 16.4+, 3/4/6/8 GB, telas 16:9 a 21:9.
Dependencies: nenhuma
Files in scope: agents/qa.md (lista dos aparelhos)
Acceptance criteria:
- Escolhido e registrado o **Android intermediário de referência** (proposta: 4 GB de RAM, Android 12+).
- Pelo menos: 1 Android de 3 GB, 1 de referência, 1 topo de linha, 1 iPhone antigo suportado, 1 iPhone recente.
Tests required: build de desenvolvimento instalada em todos
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou anúncios: permite o teste de determinismo entre aparelhos (F3-01)
Evidence (commands/logs/devices): lista com modelo, SO e RAM
Status: IN_PROGRESS

## F0-05.5 — Painel de saúde
Owner: security-devops
Objective: um painel com crash-free, fps, funil do tutorial, retenção e erros de online.
Dependencies: F0-05.1, F0-05.2, F0-05.3
Files in scope: configuração do serviço de análise (fora do app)
Acceptance criteria: painel acessível ao PO e ao dono do projeto; números de uma semana de testes internos.
Tests required: n/a
Metrics/baseline: todas as metas do ROADMAP
Impacto em determinismo, justiça online, privacidade ou anúncios: acesso restrito
Evidence (commands/logs/devices): captura do painel
Status: TODO
