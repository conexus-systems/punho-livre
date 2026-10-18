# F2-08 — Tamanho do download e desempenho com o conteúdo final

Fase: 2 — Elenco. Status do épico: **TODO**.
Dono do épico: tech-lead. Executores: mobile-ux, security-devops, qa.
Objetivo: download inicial ≤ 150 MB e 60 fps no Android de referência com todo o conteúdo.

---

## F2-08.1 — Conteúdo sob demanda
Owner: mobile-ux + security-devops
Objective: baixar lutadores, cenários ou áudio depois da instalação, se o plano de F1-04.5 exigir.
Dependencies: F1-04.5
Files in scope: mobile/src/ (download e cache), web/ ou CDN, docs/PROTOCOL.md
Acceptance criteria: download com hash conferido; funciona offline depois de baixado; o online exige o mesmo conteúdo nos dois lados.
Tests required: testes de download, hash e cache
Metrics/baseline: tamanho inicial do pacote
Impacto em determinismo, justiça online, privacidade ou anúncios: conteúdo diferente = dessincronia; conferir no início da partida
Evidence (commands/logs/devices): tamanho nas lojas
Status: TODO

## F2-08.2 — Memória e carregamento
Owner: mobile-ux
Objective: carregar só os atlas da luta atual; liberar ao sair; tempo de carregamento da luta medido.
Dependencies: F2-01.1
Files in scope: mobile/src/game/atlas.ts, renderer.ts
Acceptance criteria: sem crash por memória no Android de 3 GB numa sessão de 30 min trocando lutadores.
Tests required: soak no aparelho de 3 GB
Metrics/baseline: memória máxima; tempo de carregamento
Impacto em determinismo, justiça online, privacidade ou anúncios: nenhum
Evidence (commands/logs/devices): números do aparelho
Status: TODO

## F2-08.3 — Passada de desempenho
Owner: qa + mobile-ux
Objective: todas as combinações de lutador × cenário a 60 fps no aparelho de referência.
Dependencies: F2-01, F2-02
Files in scope: n/a
Acceptance criteria: tabela de p50/p95 por combinação; nenhuma acima do limite.
Tests required: roteiro automatizado de CPU × CPU no aparelho
Metrics/baseline: meta 60 fps
Impacto em determinismo, justiça online, privacidade ou anúncios: nenhum
Evidence (commands/logs/devices): tabela
Status: TODO
