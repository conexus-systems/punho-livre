# F1-07 — Tutorial e HUD final

Fase: 1 — Fatia vertical. Status do épico: **TODO**.
Dono do épico: mobile-ux. Apoio: po (roteiro), designer de combate (lições), diretor de arte (HUD).
Objetivo: o jogador novo aprende a jogar em 3 minutos; a meta é ≥ 70% de conclusão.

---

## F1-07.1 — Roteiro do tutorial
Owner: po (com o designer de combate)
Objective: passos curtos: andar e pular, defender alto e baixo, golpe fraco e forte, especial, super; cada passo com objetivo claro e verificação.
Dependencies: F1-03.1
Files in scope: docs/gdd/GDD.md (anexo do roteiro)
Acceptance criteria: roteiro para modo simples e clássico; tempo-alvo de 3 min.
Tests required: n/a
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou anúncios: nenhum
Evidence (commands/logs/devices): roteiro aprovado
Status: TODO

## F1-07.2 — Implementar o tutorial
Owner: mobile-ux (com engine para os gatilhos de objetivo)
Objective: tutorial jogável com a Kaze, obrigatório no primeiro uso (pode pular depois do primeiro passo), lições opcionais depois.
Dependencies: F1-07.1, F1-04.4
Files in scope: mobile/app/ (tela nova), mobile/src/match.ts
Acceptance criteria: cada passo dispara evento de telemetria (início, conclusão, abandono); textos nos 3 idiomas.
Tests required: teste de tela; teste dos gatilhos
Metrics/baseline: funil do tutorial
Impacto em determinismo, justiça online, privacidade ou anúncios: telemetria com consentimento
Evidence (commands/logs/devices): funil de um playtest
Status: TODO

## F1-07.3 — HUD final da luta
Owner: diretor de arte (humano) + mobile-ux
Objective: barras de vida, power, defesa, MAX, tempo, rounds, nomes e retratos no estilo final; legível em 16:9 a 21:9.
Dependencies: F0-03.4
Files in scope: mobile/src/game/renderer.ts
Acceptance criteria: aprovado pelo diretor de arte; não cobre os controles nem os lutadores.
Tests required: render de referência; aparelho
Metrics/baseline: tempo de frame sem piora
Impacto em determinismo, justiça online, privacidade ou anúncios: só visual
Evidence (commands/logs/devices): capturas
Status: TODO

## F1-07.4 — Treino com frame data
Owner: mobile-ux + engine
Objective: no treino: frame data do último golpe, vantagem, exibição de comandos, gravar/repetir o boneco, reset de posição.
Dependencies: F0-04.1
Files in scope: mobile/app/fight.tsx, mobile/src/match.ts
Acceptance criteria: números iguais aos da ferramenta de frame data.
Tests required: teste comparando com a ferramenta
Metrics/baseline: n/a
Impacto em determinismo, justiça online, privacidade ou anúncios: nenhum (offline)
Evidence (commands/logs/devices): capturas
Status: TODO
