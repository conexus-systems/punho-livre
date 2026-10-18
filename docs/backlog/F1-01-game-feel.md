# F1-01 — Game feel (hitstop, câmera, efeitos, buffer)

Fase: 1 — Fatia vertical (dez/2026 – fev/2027). Status do épico: **IN_PROGRESS** (agentes trabalhando agora).
Dono do épico: engine. Apoio: mobile-ux (renderizador), designer de combate (valores).
Objetivo: cada golpe precisa ser sentido. Pilar "Responde na hora" do [GDD](../gdd/GDD.md#pilares).

---

## F1-01.1 — Hitstop por força do golpe
Owner: engine
Objective: congelar atacante e defensor por N ticks no impacto, com N por força (fraco/médio/forte/super) e menor na defesa.
Dependencies: nenhuma
Files in scope: mobile/src/engine/world.ts, fighter.ts, constants.ts, testes
Acceptance criteria:
- Hitstop vem do `HitDef` (`pausetime`) quando o personagem define; senão, da tabela padrão por força.
- Determinístico; testes de rollback e fuzz verdes.
Tests required: teste de hitstop por força; `npm run test:ci`
Metrics/baseline: valores iniciais da tabela aprovados pelo designer de combate
Impacto em determinismo, justiça online, privacidade ou anúncios: muda a simulação — todos os jogadores precisam da mesma versão
Evidence (commands/logs/devices): saída dos testes
Status: IN_PROGRESS

## F1-01.2 — Buffer de comandos
Owner: engine
Objective: janela de buffer configurável para especiais, supers e golpes apertados durante a recuperação ou o hitstop.
Dependencies: nenhuma
Files in scope: mobile/src/engine/input.ts, mobile/src/game/macros.ts, testes
Acceptance criteria: comando feito até N ticks antes do fim da recuperação sai no primeiro tick possível; N por tipo, configurável; sem disparos acidentais (teste com sequências que não devem sair).
Tests required: testes de buffer positivos e negativos
Metrics/baseline: taxa de especiais executados no tutorial (telemetria)
Impacto em determinismo, justiça online, privacidade ou anúncios: estado do buffer dentro do `WorldState`
Evidence (commands/logs/devices): testes
Status: IN_PROGRESS

## F1-01.3 — Câmera: zoom e tremor
Owner: mobile-ux (renderizador) + engine (sinais)
Objective: zoom suave conforme a distância entre os lutadores; tremor em golpes fortes, supers e K.O.; suporte a `EnvShake`.
Dependencies: nenhuma
Files in scope: mobile/src/game/renderer.ts, mobile/src/engine/ (só sinais visuais)
Acceptance criteria: câmera não afeta a simulação; opção "Reduzir movimento" desliga tremor e reduz zoom.
Tests required: render em Node com a câmera; teste de que a simulação é igual com e sem câmera
Metrics/baseline: tempo de frame sem piora mensurável no aparelho de referência
Impacto em determinismo, justiça online, privacidade ou anúncios: só visual
Evidence (commands/logs/devices): vídeos em aparelho
Status: IN_PROGRESS

## F1-01.4 — Efeitos de impacto, AfterImage e PalFX
Owner: mobile-ux + engine
Objective: faíscas por força e tipo (acerto, defesa, Just Defend, contra-ataque); rastro (AfterImage) e flash de paleta (PalFX) para supers e MAX.
Dependencies: F0-04.2 (efeitos chegam como sprites)
Files in scope: mobile/src/game/effects.ts, renderer.ts, engine (controladores hoje ignorados)
Acceptance criteria: AfterImage e PalFX deixam de ser "aceitos e ignorados" ([CHARACTERS.md](../CHARACTERS.md)); efeitos fora do estado da simulação ou dentro dele de forma determinística.
Tests required: testes dos controladores; render de referência
Metrics/baseline: chamadas de desenho por frame
Impacto em determinismo, justiça online, privacidade ou anúncios: só visual
Evidence (commands/logs/devices): capturas
Status: IN_PROGRESS

## F1-01.5 — Vibração e áudio de impacto sincronizados
Owner: mobile-ux
Objective: vibração curta no impacto (desligável) e som no mesmo tick do hitstop.
Dependencies: F1-01.1
Files in scope: mobile/src/audio/, mobile/app/fight.tsx, mobile/src/settings.ts
Acceptance criteria: atraso som/imagem imperceptível no aparelho de referência; vibração desligável.
Tests required: teste em aparelho
Metrics/baseline: latência de áudio medida no aparelho
Impacto em determinismo, justiça online, privacidade ou anúncios: nenhum
Evidence (commands/logs/devices): vídeo com áudio
Status: TODO
