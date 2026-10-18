# F0-03 — Testes de estilo de arte

Fase: 0 — Fundação. Status do épico: **TODO**.
Dono do épico: diretor de arte (humano). Apoio: po, engine (importador), qa (aparelho).
Objetivo: decidir entre 3D cel-shaded pré-renderizado e pixel art HD (ilustração 2D como comparação) com o
mesmo lutador. Base: [../art/BRIEF_TESTES_DE_ESTILO.md](../art/BRIEF_TESTES_DE_ESTILO.md).

---

## F0-03.1 — Enviar o brief e contratar os 3 testes
Owner: diretor de arte (humano)
Objective: 3 testes encomendados, 3 semanas de prazo, em paralelo.
Dependencies: F0-02.4
Files in scope: docs/art/BRIEF_TESTES_DE_ESTILO.md
Acceptance criteria: 3 contratos de teste assinados; brief revisado pelo diretor de arte.
Tests required: n/a
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou anúncios: nenhum
Evidence (commands/logs/devices): datas de início e de entrega
Status: TODO

## F0-03.2 — Importar as entregas no jogo
Owner: engine
Objective: idle e golpe forte de cada teste rodando no treino (app e web).
Dependencies: F0-03.1, F0-04.2 (importador)
Files in scope: pasta de entrega fora do elenco gerado; docs/SPRITE_PIPELINE.md
Acceptance criteria:
- Os 3 pacotes importados sem edição manual, ou com a lista exata do que precisou corrigir.
- Eixo estável (o lutador não treme) e escala correta ao lado de um lutador atual.
Tests required: teste do importador com os 3 pacotes
Metrics/baseline: tamanho em MB e memória de textura por pacote
Impacto em determinismo, justiça online, privacidade ou anúncios: nenhum (só visual)
Evidence (commands/logs/devices): capturas e números
Status: TODO

## F0-03.3 — Avaliar em aparelho
Owner: qa
Objective: ver os 3 estilos no Android intermediário de referência e num iPhone.
Dependencies: F0-03.2, F0-05.4 (lab)
Files in scope: n/a
Acceptance criteria: vídeos nos 2 aparelhos; tempo de frame registrado; leitura avaliada a um braço de distância.
Tests required: sessão de 10 min por estilo
Metrics/baseline: tempo de frame p50/p95 por estilo
Impacto em determinismo, justiça online, privacidade ou anúncios: nenhum
Evidence (commands/logs/devices): modelos dos aparelhos, vídeos, números
Status: TODO

## F0-03.4 — Decisão do estilo
Owner: diretor de arte + designer de combate + dono do projeto (humanos); po registra
Objective: estilo escolhido pela tabela de critérios do brief, com custo por lutador extrapolado das horas reais.
Dependencies: F0-03.3
Files in scope: docs/art/BRIEF_TESTES_DE_ESTILO.md, docs/ROADMAP.md
Acceptance criteria: nota por critério; custo e prazo por lutador; plano para a meta de download.
Tests required: n/a
Metrics/baseline: horas reais dos testes
Impacto em determinismo, justiça online, privacidade ou anúncios: nenhum
Evidence (commands/logs/devices): ata da decisão
Status: TODO
