# F0-07 — Documentos de design, elenco e backlog

Fase: 0 — Fundação. Status do épico: **REVIEW** (escrito pelo PO; aguarda aprovação humana).
Dono do épico: po.
Objetivo: base escrita para a equipe humana e para os agentes: GDD, elenco de lançamento, brief de arte,
nomes, roadmap e este backlog.

---

## F0-07.1 — GDD, elenco, brief, nomes e roadmap
Owner: po
Objective: [GDD](../gdd/GDD.md), [elenco](../gdd/ELENCO_LANCAMENTO.md), [brief](../art/BRIEF_TESTES_DE_ESTILO.md), [nomes](../brand/NOMES.md), [roadmap](../ROADMAP.md).
Dependencies: nenhuma
Files in scope: docs/gdd/, docs/art/, docs/brand/, docs/ROADMAP.md, docs/backlog/
Acceptance criteria: aprovados pelo dono do projeto; comentários do diretor de arte e do designer de combate incorporados quando eles entrarem.
Tests required: n/a
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou anúncios: propõe mudança em anúncios (só recompensados) — ver GDD 5.4
Evidence (commands/logs/devices): commit dos documentos
Status: REVIEW

## F0-07.2 — Revisão do GDD pelo designer de combate
Owner: designer de combate (humano); po incorpora
Objective: validar ou trocar os "pontos de partida" do GDD (dano no modo simples, super turbinado, rolamento, MAX).
Dependencies: F0-02.2
Files in scope: docs/gdd/GDD.md
Acceptance criteria: cada "ponto de partida" vira valor aceito ou tarefa de teste.
Tests required: n/a
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou anúncios: nenhum
Evidence (commands/logs/devices): diff do GDD
Status: TODO
