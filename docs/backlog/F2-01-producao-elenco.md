# F2-01 — Produção dos outros 6 lutadores

Fase: 2 — Elenco (mar – ago/2027). Status do épico: **TODO**.
Dono do épico: diretor de arte (humano) + designer de combate (humano). Executores: estúdio terceirizado, engine, qa.
Objetivo: Iara, Lua, Volt, Severino, Kai e Yaguar no padrão da fatia vertical
([ELENCO_LANCAMENTO.md](../gdd/ELENCO_LANCAMENTO.md)).

Cada lutador segue o mesmo fluxo da fatia (F1-04.1 → F1-04.4): design, animação, frame data e caixas,
integração. As tarefas abaixo são uma por lutador; os critérios valem para todas.

**Critérios comuns de aceite (todas as tarefas F2-01.1 a F2-01.6):**
- Checklist de IP do elenco preenchido e assinado pelo diretor de arte; parecer do jurídico quando houver dúvida.
- Todas as ações obrigatórias do brief; 6 cores; caixas em todos os quadros.
- 4 especiais e 2 supers do elenco (ou mudança aprovada pelo designer de combate e registrada no elenco).
- `npm run test:ci` verde, incluindo fuzz de 3000 frames e rollback com o lutador.
- Tamanho e memória dentro do plano de F1-04.5.

Impacto comum: cada lutador muda a versão de conteúdo do online.

**Ordem proposta:** Yaguar primeiro (grande: valida memória, escala e agarrões de comando com animação do
oponente, que ficaram fora da fatia); depois Lua, Volt, Iara, Severino, Kai.

---

## F2-01.1 — Yaguar (grappler)
Owner: diretor de arte + designer de combate (humanos); estúdio; engine
Objective: lutadora grande com agarrões de comando (`p2stateno`, ChangeAnim2) e super armadura.
Dependencies: F1-08.2 (go da produção)
Files in scope: pacote da Yaguar; dados de golpes; mobile/src/engine (se a super armadura precisar de suporte)
Acceptance criteria: critérios comuns + super armadura de 1 golpe (Bomba) testada + Huracán pegando só oponente no ar.
Tests required: comuns + teste de super armadura e de agarrão anti-aéreo
Metrics/baseline: memória de textura (maior lutador do elenco)
Impacto em determinismo, justiça online, privacidade ou licença: muda a simulação
Evidence (commands/logs/devices): testes; números de memória no Android de 3 GB
Status: TODO

## F2-01.2 — Lua (rushdown)
Owner: diretor de arte + designer de combate (humanos); estúdio; engine
Objective: rushdown com Clinch (agarrão curto) e Cotovelada C por cima.
Dependencies: F1-08.2
Files in scope: pacote da Lua; dados de golpes
Acceptance criteria: comuns.
Tests required: comuns
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou licença: muda a simulação
Evidence (commands/logs/devices): testes
Status: TODO

## F2-01.3 — Volt (all-rounder)
Owner: diretor de arte + designer de combate (humanos); estúdio; engine
Objective: all-rounder com Faísca (projétil parado) e Pêndulo (esquiva de golpes altos).
Dependencies: F1-08.2
Files in scope: pacote do Volt; dados de golpes
Acceptance criteria: comuns + revisão das falas em espanhol rioplatense por falante nativo.
Tests required: comuns
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou licença: muda a simulação
Evidence (commands/logs/devices): testes
Status: TODO

## F2-01.4 — Iara (zoner)
Owner: diretor de arte + designer de combate (humanos); estúdio; engine; consultoria cultural
Objective: zoner com projéteis em três alturas e teleporte.
Dependencies: F1-08.2, F0-02.5 (consultoria cultural antes do design final)
Files in scope: pacote da Iara; dados de golpes; textos da história
Acceptance criteria: comuns + parecer da consultoria cultural sobre visual, nome dos golpes e história.
Tests required: comuns
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou licença: muda a simulação
Evidence (commands/logs/devices): parecer cultural; testes
Status: TODO

## F2-01.5 — Severino (charge)
Owner: diretor de arte + designer de combate (humanos); estúdio; engine
Objective: charge com Laçada (puxa o oponente) e Aboio (super armadura curta).
Dependencies: F1-08.2
Files in scope: pacote do Severino; dados de golpes; mobile/src/game/macros.ts (comandos de carga no modo simples)
Acceptance criteria: comuns + comandos de carga funcionando no toque (clássico) com taxa de acerto medida.
Tests required: comuns + teste de carga pela macro
Metrics/baseline: taxa de acerto de comandos de carga no toque
Impacto em determinismo, justiça online, privacidade ou licença: muda a simulação
Evidence (commands/logs/devices): testes
Status: TODO

## F2-01.6 — Kai (counter)
Owner: diretor de arte + designer de combate (humanos); estúdio; engine
Objective: dois contra-golpes (alto e baixo), quedas e super de contra-golpe.
Dependencies: F1-08.2
Files in scope: pacote do Kai; dados de golpes
Acceptance criteria: comuns + contra-golpes respeitam o tipo do golpe (alto/médio/baixo) e não pegam arremessos.
Tests required: comuns + testes de contra-golpe por tipo
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou licença: muda a simulação
Evidence (commands/logs/devices): testes
Status: TODO

## F2-01.7 — Retirar os rascunhos da seleção
Owner: engine
Objective: os 20 rascunhos saem do app (continuam no repositório como referência de design).
Dependencies: F2-01.1 a F2-01.6
Files in scope: mobile/scripts/roster/, mobile/src/characters/, check do `test:ci`
Acceptance criteria: app só com os 8 finais; gerador procedural continua rodando nos testes, se útil.
Tests required: gates do mobile
Metrics/baseline: tamanho do app antes e depois
Impacto em determinismo, justiça online, privacidade ou licença: versão de conteúdo
Evidence (commands/logs/devices): gates
Status: TODO
