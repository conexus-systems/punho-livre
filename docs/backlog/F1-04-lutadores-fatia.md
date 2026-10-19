# F1-04 — Lutadores da fatia vertical: Kaze e Brasa

Fase: 1 — Fatia vertical. Status do épico: **TODO**.
Dono do épico: diretor de arte (humano) para a arte; designer de combate (humano) para o jogo; engine para a integração.
Objetivo: dois lutadores no padrão final, medindo custo, prazo e tamanho reais
([elenco, seção 4](../gdd/ELENCO_LANCAMENTO.md#4-fatia-vertical-kaze-e-brasa)).

---

## F1-04.1 — Design final de Kaze e Brasa
Owner: diretor de arte (humano)
Objective: turnaround, folha de cores (6 cores), expressões, poses-chave; checklist de IP e cultural.
Dependencies: F0-03.4
Files in scope: entregas do estúdio (fora do repositório até a importação)
Acceptance criteria: aprovados pelo diretor de arte e pelo dono do projeto; checklist de IP do elenco preenchido.
Tests required: n/a
Metrics/baseline: horas gastas
Impacto em determinismo, justiça online, privacidade ou licença: nenhum
Evidence (commands/logs/devices): folhas aprovadas
Status: TODO

## F1-04.2 — Animação completa
Owner: estúdio terceirizado (humano)
Objective: todas as ações da [lista obrigatória](../art/BRIEF_TESTES_DE_ESTILO.md#7-animações-obrigatórias-por-personagem-produção) para os dois.
Dependencies: F1-04.1
Files in scope: pacotes PNG + manifest.json
Acceptance criteria: pacotes passam no importador sem erro; diretor de arte aprova cada ação.
Tests required: importador
Metrics/baseline: horas reais por lutador (substitui a estimativa do brief)
Impacto em determinismo, justiça online, privacidade ou licença: nenhum
Evidence (commands/logs/devices): relatório de horas do estúdio
Status: TODO

## F1-04.3 — Frame data e caixas
Owner: designer de combate (humano)
Objective: frame data de todos os golpes e caixas de todos os quadros no editor de hitbox.
Dependencies: F1-04.2, F0-04.1, F0-04.3
Files in scope: manifests e dados de golpes da Kaze e da Brasa
Acceptance criteria: tabela de frame data exportada; nenhum golpe sem caixa; postura de Ginga da Brasa com as 3 continuações funcionando.
Tests required: testes de frame data; fuzz de 3000 frames por personagem
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou licença: muda a simulação (versão de conteúdo)
Evidence (commands/logs/devices): tabela exportada; testes
Status: TODO

## F1-04.4 — Integração no jogo
Owner: engine
Objective: Kaze e Brasa finais substituem os rascunhos nos modos e no online.
Dependencies: F1-04.3
Files in scope: mobile/characters/ (via ferramenta, nunca à mão), mobile/src/characters/, scripts
Acceptance criteria: `npm run test:ci` verde; os rascunhos saem da seleção (ficam só no repositório).
Tests required: gates do mobile
Metrics/baseline: tamanho em MB de cada lutador; memória de textura em luta
Impacto em determinismo, justiça online, privacidade ou licença: versão de conteúdo nova no online
Evidence (commands/logs/devices): saída dos gates; números de tamanho
Status: TODO

## F1-04.5 — Plano de tamanho de download
Owner: tech-lead
Objective: com o tamanho real de 2 lutadores, decidir pixelsPerUnit, compressão e o que vai sob demanda para caber em 150 MB.
Dependencies: F1-04.4, F1-05.3
Files in scope: docs/art/BRIEF_TESTES_DE_ESTILO.md (seção 8), docs/ROADMAP.md
Acceptance criteria: projeção para 8 lutadores + 5 cenários + áudio ≤ 150 MB, ou plano de download sob demanda aprovado.
Tests required: n/a
Metrics/baseline: tamanhos medidos
Impacto em determinismo, justiça online, privacidade ou licença: download sob demanda precisa de hash conferido (como os packs)
Evidence (commands/logs/devices): planilha de tamanho
Status: TODO
