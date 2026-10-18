# Game feel — impacto, câmera, efeitos e leniência de entrada

Fase 1 do roteiro comercial: cada golpe precisa "pesar" e ser legível. Este documento registra o que
foi feito, por quê, e o que foi verificado (e como). Valores ficam em constantes nomeadas:
`mobile/src/engine/constants.ts` (engine) e no topo de `mobile/src/game/camera.ts` /
`mobile/src/game/effects.ts` (apresentação).

## 1. Hitstop por intensidade (engine, determinístico)

O nível do golpe (`HitLevel`) vem do HitDef: `animtype` light/medium/hard → fraco/médio/forte
(back/up/diagup contam como forte) e o `attr`: `S?` = especial, `H?` = super. Fica em
`HitDefState.hitLevel` e vai no campo `level` dos eventos `hit`/`guard` (0..4; o áudio continua
tratando ≥ 2 como forte).

| Regra | Valor | Onde |
|---|---|---|
| HitDef **sem** `pausetime`: hitstop pelo nível [atacante, defensor] | 8 / 11 / 14 / 15 / 17 (iguais nos dois lados) | `HITSTOP_BY_LEVEL` |
| `pausetime` explícito (inclusive `0,0`) | respeitado como no MUGEN | `buildHitDef` |
| Arremesso (`attr = ?, ?T`) sem `pausetime` | 0, como no MUGEN (não há impacto na pegada) | `buildHitDef` |
| Defesa sem `guard.pausetime` | 60% do hitstop do acerto, piso 4, nunca maior que o acerto | `GUARD_HITSTOP_RATIO`, `GUARD_HITSTOP_MIN`, `guardPause()` |
| `guard.pausetime` explícito | respeitado | `buildHitDef` |
| Contra-ataque | +5 nos dois lados | `COUNTER_HITSTOP_BONUS` |
| Golpe do K.O. (fora do treino) | mínimo 10 nos dois (corre dentro da câmera lenta: ≈ 0,5 s) | `KO_HITSTOP_FRAMES` |
| Guard crush (defensor) | mínimo 16 | `GUARD_CRUSH_HITSTOP` |
| Just Defend (defensor) | teto 6 | `JUST_DEFEND_HITSTOP_MAX` |
| Arremesso SNK | 8 nos dois | `THROW_HITSTOP` |

Decisões:

- **Valores iguais para atacante e defensor** (e o bônus de contra-ataque somado nos dois): o
  congelamento não muda a vantagem de quadros do golpe. A defesa reduz os dois lados na mesma
  proporção pelo mesmo motivo.
- **Divergência do MUGEN**: no MUGEN, sem `pausetime` o padrão é 0 e `guard.pausetime` herda
  `pausetime`. Aqui o padrão vem do nível e a defesa congela menos. Personagens importados que
  dependem de 0 explícito continuam iguais; os que omitem `pausetime` em golpes de vários acertos
  ficam com mais congelamento. Registrado em docs/CHARACTERS.md.
- O elenco nativo já traz `pausetime` explícito em quase todo golpe (gerado por `scripts/roster`),
  então para ele o que muda é defesa, contra-ataque, K.O. e golpes de projétil/helper sem pausetime.

## 2. Câmera (`src/game/camera.ts`, só apresentação)

Fora do `stepWorld` e do `WorldState`. `FightRenderer.addEvents` chama `camera.update(world, events)`
**uma vez por quadro simulado**; `draw` só lê `camera.view(viewport)`.

- **Segue** `world.cameraX` (o alvo da engine, que já respeita as bordas) com suavização
  (`CAM_FOLLOW = 0.22` por quadro); pula direto na troca de round ou em saltos grandes.
- **Zoom por distância**: 1,12 com os lutadores colados até 1,0 a 220 unidades, suavizado.
- **Punch de zoom** em golpe forte (+0,035), especial (+0,05), super (+0,07), contra-ataque (+0,05),
  guard crush (+0,05), início de super (+0,08) e K.O. (+0,10), puxando o pivô para o ponto do impacto;
  decai 16% por quadro.
- **Tremor** por "trauma" (0..1) somado por evento (fraco 0,18 … super 0,6; defesa 0,12; K.O. 0,85),
  decaimento linear de 0,04/quadro e amplitude = 9 unidades × trauma². Alterna o lado a cada quadro
  (lê como vibração) com força variável de um PRNG.
- **Enquadramento**: o zoom final nunca fica abaixo de 1, nunca tira um lutador da tela (margem de
  34 unidades) e nunca enfia a cabeça de quem pula sob o HUD — relaxa sozinho em vez de cortar.
  Com tremor, cresce o mínimo necessário para a borda do cenário não aparecer.
- **Determinismo**: nada de `Math.random` ou relógio. O PRNG é um hash do número do quadro do mundo
  (`noise(frame, salt)`); o mesmo histórico de quadros dá a mesma câmera. Os efeitos também.
- **Reduzir movimento**: sem tremor, sem punch, zoom fixo em 1, sem a vibração do lutador no hitstop e
  flashes de tela com alfa no máximo 0,25. No app é o ajuste "Reduzir movimento" (Ajustes › Jogo,
  `settings.reduceMotion`, persistido); na web segue `prefers-reduced-motion` do sistema.

A transformação é aplicada no canvas (save/translate/scale) em volta do mundo; HUD e flashes ficam
fora. Assim os caches do cenário (pictures das camadas, gradientes) continuam válidos.

## 3. Efeitos de impacto (`src/game/effects.ts`)

| Evento | Visual |
|---|---|
| Fraco | estrela pequena (5 pontas), miolo branco, 4 faíscas |
| Médio | + rastro do golpe, 7 faíscas |
| Forte | + halo da cor da energia e onda de choque, 10 faíscas |
| Especial | + segunda onda branca, faíscas da cor da energia, 12 faíscas |
| Super | + linhas de velocidade saindo do impacto, 14 faíscas |
| Contra-ataque | impacto laranja maior com onda dupla; texto **COUNTER** grande com faixa inclinada, entra com "punch" e pisca branco; clarão maior no lutador atingido |
| Defesa | escudo em três segmentos de arco virado para o atacante; faíscas que voltam |
| Guard crush | escudo estilhaça (12 cacos com gravidade), anel vermelho; texto **GUARD CRUSH** grande |
| Super (início) | escurece a tela (como antes) + flash branco de 5 quadros |
| K.O. | flash branco de 12 quadros (era 22) + tremor e punch fortes |
| Hitstop | o lutador atingido vibra ±(0,6–2,2) unidades em quadros alternados (o shaketime do MUGEN) |

Custo fixo: no máximo `MAX_PARTICLES = 96` partículas e `MAX_IMPACTS = 10` impactos vivos (anel
circular: o mais antigo sai); Paints e cores reaproveitados entre quadros; o clarão deixou de criar
um shader de gradiente por impacto por quadro (três círculos somados no lugar). Os efeitos andam por
quadro simulado (antes andavam por quadro desenhado: numa tela de 120 Hz duravam metade).

## 4. Leniência de entrada (`src/engine/mugen/cmd.ts`, `fighter.ts`)

- **Prioridade** (`CommandTier`): super = nome de super (`super`, `hyper`, `dm`, `sdm`, `lvN`…) ou
  movimento que repete uma direção com dois passos no meio (meia-lua dupla); especial = 2+
  elementos terminando em botão; normal = o resto. Calculada ao ler o `.cmd` (`CommandDef.tier`).
- **Super > especial > normal no mesmo quadro**: ao carregar o personagem, os ChangeState do
  `[Statedef -1]` que dependem de comando são reordenados por prioridade (ordem estável dentro do
  nível; os demais controladores não saem do lugar). Se o super não pode sair (sem barra), os triggers
  dele falham e o especial sai — a meia-lua dupla sem barra vira o especial, não o soco.
- **Buffer de 5 quadros** (`INPUT_BUFFER_FRAMES`) para especiais e supers: o comando vale no quadro do
  aperto e nos 4 seguintes (`buffer.time` maior do personagem continua valendo). Normais mantêm o
  `buffer.time` do `.cmd`.
- **Buffer congelado**: enquanto o lutador não age (hitstop ou superpause), o buffer dos especiais
  não envelhece; um meia-lua feito durante o impacto sai no primeiro quadro livre (cancelamento de
  normal em especial no padrão dos jogos atuais).
- Tudo no `FighterState.cmdActive` (já clonado pelo rollback); nada fora do `WorldState`.

## Evidência

Testes (jest): `src/engine/__tests__/gamefeel.test.ts` (hitstop por nível, pausetime explícito e 0,
defesa menor, guard.pausetime explícito, contra-ataque, K.O., clone/rollback; classificação de comandos,
reordenação do -1, super > especial > normal com e sem barra, buffer na recuperação no limite exato,
buffer congelado no hitstop) e `src/game/__tests__/camera.test.ts` (câmera determinística sem
`Math.random`, lutadores sempre na tela em 844×390 e 1024×768, reações por intensidade e decaimento,
reduzir movimento, suavização; teto de partículas e efeitos determinísticos). Os testes existentes de
determinismo, clone/rollback e fuzz de 3000 quadros por personagem continuam passando.

Screenshots antes/depois (`npm run preview`, cenas em `scripts/preview/gamefeel.preview.ts`, cada uma
desenhada alguns quadros depois do evento): `docs/screenshots/gamefeel-{fraco,forte,defesa,counter,
guardcrush,super,ko}.png` (em cima a 0.4.0, embaixo esta versão).

Benchmarks (mesma máquina, container Linux de CI, Node; CanvasKit em software — servem para comparar
versões, não aparelhos):

| Medida | 0.4.0 | Esta versão |
|---|---|---|
| Engine: simulação (`npm run bench`) | 0,0197 ms/quadro | 0,0172 ms/quadro |
| Engine: rollback de 8 quadros por quadro | 0,1632 ms/quadro | 0,1632 ms/quadro |
| Renderer: gravar o quadro, luta CPU × CPU (`npm run bench:render`) | 0,846–0,865 ms | 0,691 ms |
| Renderer: gravar, estresse (impacto a cada 4 quadros) | 2,16–2,32 ms (pior 20–33 ms) | 2,57 ms (pior 15,7 ms; teto de 96 partículas atingido) |
| Rasterizar em software (CanvasKit) | 39,1–39,8 ms | 39,3 ms |

Na luta normal gravar o quadro ficou mais barato (câmera e efeitos novos pagos pelos Paints
reaproveitados); no estresse o custo médio subiu ~15% e o pior quadro caiu, por causa do teto de
partículas. A rasterização não muda: o custo dominante é o cenário e os sprites, não os efeitos.

Pendente: teste em aparelho (Android/iOS) do custo real por quadro e da sensação dos valores; ajuste
fino dos números com jogadores; a câmera não segue na vertical (o cenário não tem arte acima da tela).
