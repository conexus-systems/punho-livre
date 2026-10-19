# F1-06 — Áudio da fatia vertical

Fase: 1 — Fatia vertical. Status do épico: **TODO**.
Dono do épico: diretor de arte (humano) ou diretor de áudio contratado. Executor: mobile-ux (integração).
Objetivo: trocar o som sintetizado (`src/audio/synth.ts`) por áudio profissional na fatia: efeitos, uma
trilha e vozes da Kaze e da Brasa.

---

## F1-06.1 — Efeitos sonoros profissionais
Owner: sound designer (humano)
Objective: os 18 efeitos existentes + específicos da Kaze e da Brasa (vento, brasa, fitas).
Dependencies: F0-02.5
Files in scope: arquivos de áudio (formato a definir com o tech-lead), créditos e licenças
Acceptance criteria: todos originais ou com licença comercial documentada; mixagem testada em alto-falante de celular.
Tests required: escuta em 2 aparelhos
Metrics/baseline: tamanho total
Impacto em determinismo, justiça online, privacidade ou licença: nenhum
Evidence (commands/logs/devices): lista de arquivos e licenças
Status: TODO

## F1-06.2 — Trilha do Pelourinho
Owner: compositor (humano)
Objective: trilha original com laço sem emenda, berimbau, atabaque e agogô.
Dependencies: F0-02.5
Files in scope: arquivo de áudio
Acceptance criteria: laço sem corte audível; cessão de direitos.
Tests required: escuta em aparelho
Metrics/baseline: tamanho
Impacto em determinismo, justiça online, privacidade ou licença: nenhum
Evidence (commands/logs/devices): arquivo aprovado
Status: TODO

## F1-06.3 — Vozes da Kaze e da Brasa
Owner: diretor de voz (humano)
Objective: gritos de golpe, especiais, supers, dano, K.O., intro e vitória, em português, com legenda.
Dependencies: F0-02.5
Files in scope: arquivos de voz, textos de legenda
Acceptance criteria: contratos com cessão de voz; legendas nos 3 idiomas.
Tests required: escuta em aparelho
Metrics/baseline: tamanho
Impacto em determinismo, justiça online, privacidade ou licença: nenhum
Evidence (commands/logs/devices): lista de falas
Status: TODO

## F1-06.4 — Integração de áudio gravado
Owner: mobile-ux
Objective: tocar arquivos gravados no app e na web, mantendo o sintetizador como reserva para packs sem som.
Dependencies: F1-06.1
Files in scope: mobile/src/audio/
Acceptance criteria: canais separados de música, efeitos e voz em Ajustes; sem atraso perceptível.
Tests required: testes do diretor de áudio; aparelho
Metrics/baseline: latência medida
Impacto em determinismo, justiça online, privacidade ou licença: nenhum (áudio fora da simulação)
Evidence (commands/logs/devices): vídeo com áudio
Status: TODO
