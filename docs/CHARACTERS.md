# Personagens

O MUGEN Arena usa o **formato de personagem do MUGEN**: um `.def` que aponta para
`.cmd` (comandos), `.cns` (constantes e estados), `.air` (animações + caixas de colisão)
e `.sff` (sprites). O app recebe isso empacotado em JSON (`mugen-arena-pack/1`, ver
[PROTOCOL.md](PROTOCOL.md#pack-formato-mugen-arena-pack1)).

## 1. Importar um personagem MUGEN existente

```bash
cd mobile
npm run pack -- /caminho/kfm                      # gera kfm.pack.json
npm run pack -- /caminho/kfm --pal 2              # outra paleta (.act do [Files] pal2)
npm run pack -- /caminho/kfm --id kungfu --upload https://mugen-arena.conexus-systems.com.br --token "$JWT"
```

- Lê `.def`, `.cmd`, `.cns`, `st*` e `.air` como texto.
- Converte do `.sff` **só os sprites usados pelo `.air`** para atlas PNG (data URI),
  preservando o eixo de cada sprite. Suporta SFF v1 (PCX + `.act`) e SFF v2
  (raw, RLE8, RLE5, LZ5, PNG8/24/32).
- `--upload` envia ao backend (`POST /api/v1/characters`, token do bff-auth). O pack
  fica `pending`; um admin (grupo `mugen-arena-admin` no bff-auth) aprova pelo app em
  *Personagens → Revisão*, opcionalmente como **premium**. O autor recebe e-mail (bff-api).
- Aprovado, aparece em *Personagens* para todos baixarem; o app confere o sha256 e
  valida o pack na engine antes de instalar. No online, o oponente baixa automaticamente
  o personagem que você escolheu.

> Só envie personagens que você tem direito de distribuir.

## 2. Criar um personagem nativo (gerador)

Os 6 personagens nativos são definidos em `mobile/scripts/roster/characters.mjs`
(proporções, cores, estatísticas, especiais e super) e gerados por:

```bash
cd mobile
npm run roster      # gera characters/<id>/ e src/characters/builtin.generated.ts
```

O gerador monta poses num esqueleto 2D (`scripts/roster/rig.mjs` + `poses.mjs`),
rasteriza os sprites (`raster.mjs`, sem dependências), calcula Clsn1/Clsn2 a partir dos
membros e escreve arquivos MUGEN comuns — dá para abrir e editar o `.cns`/`.cmd`
gerado como em qualquer personagem MUGEN.

Especiais disponíveis: `projectile`, `rising`, `spin`, `dash`, `teleport`, `slam`,
`cartwheel`, `divekick`. Supers: `rush`, `beam`.

## Compatibilidade da engine

Suportado:

- Estados: `[Statedef]` (type, movetype, physics, anim, velset, ctrl, poweradd, facep2,
  hitdefpersist, movehitpersist) e `[State]` com `triggerall`/`triggerN`, `persistent`.
- Controladores: ChangeState, SelfState, ChangeAnim(2), VelSet/VelAdd/VelMul, PosSet/PosAdd,
  CtrlSet, HitDef, Projectile, StateTypeSet, VarSet/VarAdd/VarRangeSet, LifeAdd/LifeSet,
  PowerAdd/PowerSet, Turn, HitVelSet, HitFallVel, HitFallSet, NotHitBy, SuperPause/Pause,
  TargetLifeAdd, AttackMulSet, DefenceMulSet. Controladores só visuais/áudio (PlaySnd,
  Explod, EnvShake, AfterImage, PalFX, …) são aceitos e ignorados.
- Triggers: Time, AnimTime, AnimElem, AnimElemTime, AnimElemNo, Anim, StateNo, PrevStateNo,
  StateType, MoveType, Ctrl, Vel/Pos/ScreenPos X/Y, P2Dist/P2BodyDist X/Y, FrontEdge/BackEdge
  (Body)Dist, Life, Power, MoveContact/MoveHit/MoveGuarded, HitShakeOver, HitOver, HitFall,
  GetHitVar(...), Const(...), Var/FVar/SysVar/SysFVar, Command, Random, RoundState, Win/Lose,
  InGuardDist, NumProj(ID), SelfAnimExist, IfElse/Cond, funções matemáticas, redirecionamento
  `p2,` / `enemy,`, intervalos `[a, b]`, divisão inteira estilo MUGEN.
- Comandos `.cmd`: `~` (com tempo), `/`, `$`, `>`, `+`, `time`, `buffer.time`, `[Defaults]`.
  Diferenças de propósito (ver docs/GAME_FEEL.md): especiais e supers valem por pelo menos 5 quadros
  (buffer que não envelhece no hitstop/superpause) e, no `[Statedef -1]`, os ChangeState de super são
  testados antes dos de especial, e estes antes dos de normal.
- HitDef sem `pausetime` ganha hitstop pelo nível do golpe (arremessos `?T` continuam 0); sem
  `guard.pausetime`, a defesa congela 60% do acerto; contra-ataque e K.O. congelam mais. `pausetime`
  e `guard.pausetime` explícitos são respeitados.
- Movimentos internos do MUGEN: andar, agachar, pular, defesa automática segurando para trás.
- Estados comuns (`common1`) próprios da engine: parado, agachar, andar, pulo, pouso,
  corrida, recuo, defesa, apanhar (em pé/agachado/ar), queda, quique, deitado, levantar,
  vitória/derrota/intro.
- Sistema SNK (0.2.0) para qualquer personagem, inclusive importado: estados 6000–6070 do `common1`
  (rolamento 6000/6001, blowback 6010/6015, guard cancel 6020, arremesso 6030/6040/6050, guard crush
  6060, MAX 6070). Um personagem pode sobrescrever qualquer um. Sem as animações 6000+, a engine usa
  substitutas (agachado para o rolamento, 240/250 para o blowback, 640/630 no ar, 800 para o arremesso).
  A entrada vem de `src/engine/snk.ts`: A = x, B = a, C = z, D = c.

Suportado desde a 0.4.0: Helper (com DestroySelf, BindToParent, ParentVar*), Explod (Remove/Modify), PlaySnd e
sons do `.snd` (convertidos pelo `npm run pack`), arremessos com `p2stateno`/estados personalizados, ChangeAnim2,
SelfState e Target* (State, Bind, LifeAdd, Facing, VelSet/Add, PowerAdd, Drop).

Ainda não suportado: juggle points, AfterImage, PalFX, EnvShake, AssertSpecial com efeito, cenários/screenpacks
do MUGEN, paletas além da escolhida no pack.
