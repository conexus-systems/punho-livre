/**
 * Estados comuns (equivalente ao common1.cns do MUGEN), escritos no subconjunto
 * de controladores que a engine suporta. Todo personagem herda estes estados;
 * um personagem que declara o mesmo Statedef sobrescreve o daqui.
 *
 * Movimentos internos (andar, agachar, pular, defender) são disparados pela
 * engine, como no MUGEN; aqui ficam só os estados em si.
 */
export const COMMON1_CNS = `
; ------------------------------------------------------------------ parado
[Statedef 0]
type = S
physics = S

[State 0, anim]
type = ChangeAnim
trigger1 = Anim != 0 && Anim != 5
trigger2 = Anim = 5 && AnimTime = 0
value = 0

[State 0, vy]
type = VelSet
trigger1 = Time = 0
y = 0

[State 0, para]
type = VelSet
trigger1 = abs(Vel X) < Const(movement.stand.friction.threshold)
x = 0

; ------------------------------------------------------- agachar / levantar
[Statedef 10]
type = C
physics = C
anim = 10

[State 10, freio]
type = VelMul
trigger1 = Time = 0
x = .75

[State 10, fim]
type = ChangeState
trigger1 = AnimTime = 0
value = 11

[Statedef 11]
type = C
physics = C
anim = 11

[State 11, anim]
type = ChangeAnim
trigger1 = Anim = 6 && AnimTime = 0
value = 11

[State 11, para]
type = VelSet
trigger1 = abs(Vel X) < Const(movement.crouch.friction.threshold)
x = 0

[Statedef 12]
type = S
physics = S
anim = 12

[State 12, fim]
type = ChangeState
trigger1 = AnimTime = 0
value = 0
ctrl = 1

; ------------------------------------------------------------------ andar
; velocidade e animação (20 frente / 21 trás) controladas pela engine
[Statedef 20]
type = S
physics = S

; ------------------------------------------------------------------ pulo
[Statedef 40]
type = S
physics = S
anim = 40
ctrl = 0

[State 40, neutro]
type = VarSet
trigger1 = Time = 0
sysvar(1) = 0

; pulo curto (hop): sysvar(2) = 1 marca que o pulo saiu do chão agora
[State 40, hop]
type = VarSet
trigger1 = Time = 0
sysvar(2) = 1

[State 40, frente]
type = VarSet
trigger1 = command = "holdfwd"
sysvar(1) = 1

[State 40, tras]
type = VarSet
trigger1 = command = "holdback"
sysvar(1) = -1

[State 40, vel]
type = VelSet
trigger1 = AnimTime = 0
x = ifelse(sysvar(1) = 0, Const(velocity.jump.neu.x), ifelse(sysvar(1) = 1, Const(velocity.jump.fwd.x), Const(velocity.jump.back.x)))
y = Const(velocity.jump.y)

[State 40, sobe]
type = ChangeState
trigger1 = AnimTime = 0
value = 50
ctrl = 1

[Statedef 50]
type = A
physics = A

[State 50, anim]
type = ChangeAnim
trigger1 = Time = 0
value = ifelse(Vel X = 0, 41, ifelse(Vel X > 0, 42, 43))

; soltou para cima logo depois de sair do chão → pulo curto (estilo KOF)
[State 50, hop]
type = VelMul
trigger1 = Time = 3 && sysvar(2) = 1 && command != "holdup" && Vel Y < 0
y = .68

[State 50, hop fim]
type = VarSet
trigger1 = Time = 3
sysvar(2) = 0

[State 50, desce]
type = ChangeAnim
trigger1 = Vel Y > -2
trigger1 = Anim = [41, 43]
trigger1 = SelfAnimExist(Anim + 3)
value = Anim + 3

[Statedef 52]
type = S
physics = S
ctrl = 0
anim = 47

[State 52, hop]
type = VarSet
trigger1 = Time = 0
sysvar(2) = 0

[State 52, chao]
type = PosSet
trigger1 = Time = 0
y = 0

[State 52, vel]
type = VelSet
trigger1 = Time = 0
y = 0

[State 52, fim]
type = ChangeState
trigger1 = AnimTime = 0
value = 0
ctrl = 1

; ------------------------------------------------------------- corrida
[Statedef 100]
type = S
physics = S
anim = 100

[State 100, vel]
type = VelSet
trigger1 = 1
x = Const(velocity.run.fwd.x)

[State 100, fim]
type = ChangeState
trigger1 = command != "holdfwd"
value = 0

[Statedef 105]
type = A
physics = A
ctrl = 0
anim = 105

[State 105, vel]
type = VelSet
trigger1 = Time = 0
x = Const(velocity.run.back.x)
y = Const(velocity.run.back.y)

[State 105, ctrl]
type = CtrlSet
trigger1 = Time = 2
value = 1

; ------------------------------------------------------------- defesa
[Statedef 120]
type = U
physics = U

[State 120, anim]
type = ChangeAnim
trigger1 = Time = 0
value = 120 + (StateType = C) + (StateType = A) * 2

[State 120, agacha]
type = StateTypeSet
trigger1 = StateType = S && command = "holddown"
statetype = C
physics = C

[State 120, levanta]
type = StateTypeSet
trigger1 = StateType = C && command != "holddown"
statetype = S
physics = S

[State 120, segura]
type = ChangeState
trigger1 = AnimTime = 0
value = 130 + (StateType = C) + (StateType = A) * 2

[State 120, solta]
type = ChangeState
trigger1 = !InGuardDist || command != "holdback"
value = 140

[Statedef 130]
type = S
physics = S

[State 130, anim]
type = ChangeAnim
trigger1 = Anim != 130
value = 130

[State 130, agacha]
type = ChangeState
trigger1 = command = "holddown"
value = 131

[State 130, solta]
type = ChangeState
trigger1 = !InGuardDist || command != "holdback"
value = 140

[Statedef 131]
type = C
physics = C

[State 131, anim]
type = ChangeAnim
trigger1 = Anim != 131
value = 131

[State 131, levanta]
type = ChangeState
trigger1 = command != "holddown"
value = 130

[State 131, solta]
type = ChangeState
trigger1 = !InGuardDist || command != "holdback"
value = 140

[Statedef 132]
type = A
physics = A

[State 132, anim]
type = ChangeAnim
trigger1 = Anim != 132
value = 132

[State 132, solta]
type = ChangeState
trigger1 = !InGuardDist || command != "holdback"
value = 50

[Statedef 140]
type = U
physics = U

[State 140, anim]
type = ChangeAnim
trigger1 = Time = 0
value = 140 + (StateType = C) + (StateType = A) * 2

[State 140, fim]
type = ChangeState
trigger1 = AnimTime = 0
value = ifelse(StateType = C, 11, ifelse(StateType = A, 50, 0))
ctrl = 1

; --------------------------------------------------- defesa atingida
[Statedef 150]
type = S
movetype = H
physics = N
velset = 0, 0

[State 150, anim]
type = ChangeAnim
trigger1 = Time = 0
value = 150

[State 150, fim]
type = ChangeState
trigger1 = HitShakeOver
value = 151

[Statedef 151]
type = S
movetype = H
physics = S
anim = 150

[State 151, vel]
type = HitVelSet
trigger1 = Time = 0
x = 1

[State 151, para]
type = VelSet
trigger1 = Time = GetHitVar(slidetime)
x = 0

[State 151, ctrl]
type = CtrlSet
trigger1 = Time = GetHitVar(ctrltime)
value = 1

[State 151, fim]
type = ChangeState
trigger1 = HitOver
value = 130
ctrl = 1

[Statedef 152]
type = C
movetype = H
physics = N
velset = 0, 0

[State 152, anim]
type = ChangeAnim
trigger1 = Time = 0
value = 151

[State 152, fim]
type = ChangeState
trigger1 = HitShakeOver
value = 153

[Statedef 153]
type = C
movetype = H
physics = C
anim = 151

[State 153, vel]
type = HitVelSet
trigger1 = Time = 0
x = 1

[State 153, para]
type = VelSet
trigger1 = Time = GetHitVar(slidetime)
x = 0

[State 153, ctrl]
type = CtrlSet
trigger1 = Time = GetHitVar(ctrltime)
value = 1

[State 153, fim]
type = ChangeState
trigger1 = HitOver
value = 131
ctrl = 1

[Statedef 154]
type = A
movetype = H
physics = N
velset = 0, 0

[State 154, anim]
type = ChangeAnim
trigger1 = Time = 0
value = 152

[State 154, fim]
type = ChangeState
trigger1 = HitShakeOver
value = 155

[Statedef 155]
type = A
movetype = H
physics = A
anim = 152

[State 155, vel]
type = HitVelSet
trigger1 = Time = 0
x = 1
y = 1

[State 155, ctrl]
type = CtrlSet
trigger1 = HitOver
value = 1

; ------------------------------------------------------------ apanhar
[Statedef 5000]
type = S
movetype = H
physics = N
velset = 0, 0

[State 5000, anim]
type = ChangeAnim
trigger1 = Time = 0
value = 5000 + GetHitVar(animtype)

[State 5000, chao]
type = ChangeState
trigger1 = HitShakeOver && GetHitVar(yvel) = 0 && !GetHitVar(fall)
value = 5001

[State 5000, ar]
type = ChangeState
trigger1 = HitShakeOver
value = 5030

[Statedef 5001]
type = S
movetype = H
physics = S

[State 5001, vel]
type = HitVelSet
trigger1 = Time = 0
x = 1

[State 5001, para]
type = VelSet
trigger1 = Time = GetHitVar(slidetime)
x = 0

[State 5001, ctrl]
type = CtrlSet
trigger1 = Time = GetHitVar(ctrltime)
value = 1

[State 5001, fim]
type = ChangeState
trigger1 = HitOver
value = 0
ctrl = 1

[Statedef 5010]
type = C
movetype = H
physics = N
velset = 0, 0

[State 5010, anim]
type = ChangeAnim
trigger1 = Time = 0
value = 5010 + GetHitVar(animtype)

[State 5010, chao]
type = ChangeState
trigger1 = HitShakeOver && GetHitVar(yvel) = 0 && !GetHitVar(fall)
value = 5011

[State 5010, ar]
type = ChangeState
trigger1 = HitShakeOver
value = 5030

[Statedef 5011]
type = C
movetype = H
physics = C

[State 5011, vel]
type = HitVelSet
trigger1 = Time = 0
x = 1

[State 5011, para]
type = VelSet
trigger1 = Time = GetHitVar(slidetime)
x = 0

[State 5011, ctrl]
type = CtrlSet
trigger1 = Time = GetHitVar(ctrltime)
value = 1

[State 5011, fim]
type = ChangeState
trigger1 = HitOver
value = 11
ctrl = 1

[Statedef 5020]
type = A
movetype = H
physics = N
velset = 0, 0

[State 5020, anim]
type = ChangeAnim
trigger1 = Time = 0
value = 5030

[State 5020, fim]
type = ChangeState
trigger1 = HitShakeOver
value = 5030

[Statedef 5030]
type = A
movetype = H
physics = N

[State 5030, anim]
type = ChangeAnim
trigger1 = Time = 0
trigger1 = Anim < 5030 || Anim > 5039
value = 5030

[State 5030, vel]
type = HitVelSet
trigger1 = Time = 0
x = 1
y = 1

[State 5030, gravidade]
type = VelAdd
trigger1 = Time > 0
y = GetHitVar(yaccel)

[State 5030, cai]
type = ChangeState
trigger1 = HitOver && GetHitVar(fall)
value = 5050

[State 5030, chao]
type = ChangeState
trigger1 = Vel Y > 0 && Pos Y >= 0 && GetHitVar(fall)
value = 5100

[State 5030, pousa]
type = ChangeState
trigger1 = Vel Y > 0 && Pos Y >= 0
value = 52

[State 5030, recupera]
type = ChangeState
trigger1 = HitOver && !GetHitVar(fall)
value = 50
ctrl = 1

[Statedef 5050]
type = A
movetype = H
physics = N

[State 5050, anim]
type = ChangeAnim
trigger1 = Time = 0
trigger1 = SelfAnimExist(5050)
value = 5050

[State 5050, gravidade]
type = VelAdd
trigger1 = 1
y = GetHitVar(yaccel)

[State 5050, chao]
type = ChangeState
trigger1 = Vel Y > 0 && Pos Y >= 0
value = 5100

[Statedef 5100]
type = L
movetype = H
physics = N

[State 5100, anim]
type = ChangeAnim
trigger1 = Time = 0
value = 5100

[State 5100, chao]
type = PosSet
trigger1 = Time = 0
y = 0

[State 5100, quica]
type = VelSet
trigger1 = Time = 0
x = Vel X * .5
y = -3

[State 5100, gravidade]
type = VelAdd
trigger1 = Time > 0
y = Const(movement.down.bounce.yaccel)

[State 5100, deita]
type = ChangeState
trigger1 = Time > 2 && Vel Y > 0 && Pos Y >= 0
value = 5110

[Statedef 5110]
type = L
movetype = H
physics = N

[State 5110, anim]
type = ChangeAnim
trigger1 = Time = 0
value = 5110

[State 5110, para]
type = VelSet
trigger1 = Time = 0
x = 0
y = 0

[State 5110, chao]
type = PosSet
trigger1 = Time = 0
y = 0

[State 5110, levanta]
type = ChangeState
trigger1 = Alive && Time >= Const(data.liedown.time)
value = 5120

[Statedef 5120]
type = L
movetype = I
physics = N
anim = 5120

[State 5120, invencivel]
type = NotHitBy
trigger1 = 1
value = SCA
time = 2

[State 5120, fim]
type = ChangeState
trigger1 = AnimTime = 0
value = 0
ctrl = 1

; ------------------------------------------------- intro / vitória / derrota
[Statedef 170]
type = S
physics = S
ctrl = 0
anim = 170

[Statedef 180]
type = S
physics = S
ctrl = 0
anim = 180

[State 180, pose]
type = ChangeState
trigger1 = SelfAnimExist(181)
value = 181

[Statedef 181]
type = S
physics = S
ctrl = 0
anim = 181

[Statedef 190]
type = S
physics = S
ctrl = 0
anim = 190

[State 190, fim]
type = ChangeState
trigger1 = AnimTime = 0
value = 0

; ================================================================ sistema SNK
; Estados do sistema estilo SNK (KOF/Garou). A engine (snk.ts) decide quando
; entrar neles a partir das entradas (A+B, C+D, A+B+C, arremesso) e cuida do
; que liga os dois lutadores (arremesso, guard crush, MAX). Os números 6000+
; ficam fora da faixa usada por personagens do MUGEN; um personagem pode
; sobrescrever qualquer um deles.

; ---------------------------------------------- rolamento (A+B), invencível
[Statedef 6000]
type = S
movetype = I
physics = N
anim = 6000
ctrl = 0
velset = 0, 0

[State 6000, invencivel]
type = NotHitBy
trigger1 = Time < 16
value = SCA
time = 1

[State 6000, vel]
type = VelSet
trigger1 = Time = 1
x = 4.6

[State 6000, freia]
type = VelSet
trigger1 = Time = 18
x = 0

[State 6000, fim]
type = ChangeState
trigger1 = Time >= 24
value = 0
ctrl = 1

[Statedef 6001]
type = S
movetype = I
physics = N
anim = 6001
ctrl = 0
velset = 0, 0

[State 6001, invencivel]
type = NotHitBy
trigger1 = Time < 16
value = SCA
time = 1

[State 6001, vel]
type = VelSet
trigger1 = Time = 1
x = -4.6

[State 6001, freia]
type = VelSet
trigger1 = Time = 18
x = 0

[State 6001, fim]
type = ChangeState
trigger1 = Time >= 24
value = 0
ctrl = 1

; ------------------------------------------------- blowback (C+D) no chão
[Statedef 6010]
type = S
movetype = A
physics = S
anim = 6010
ctrl = 0
velset = 0, 0
poweradd = 20

[State 6010, golpe]
type = HitDef
trigger1 = Time = 0
attr = S, NA
animtype = Hard
damage = 70, 8
guardflag = MA
hitflag = MAF
pausetime = 14, 14
ground.type = High
ground.slidetime = 14
ground.hittime = 22
ground.velocity = -8, -5.5
air.velocity = -7, -5
air.fall = 1
fall = 1

[State 6010, fim]
type = ChangeState
trigger1 = AnimTime = 0 || Time >= 50
value = 0
ctrl = 1

; ------------------------------------------------------ blowback no ar
[Statedef 6015]
type = A
movetype = A
physics = A
anim = 6015
ctrl = 0

[State 6015, golpe]
type = HitDef
trigger1 = Time = 0
attr = A, NA
animtype = Hard
damage = 62, 7
guardflag = HA
hitflag = MAF
pausetime = 12, 12
ground.type = High
ground.hittime = 20
ground.velocity = -7, -5
air.velocity = -6, -5
fall = 1

; ------------------------------- guard cancel C+D (1 estoque, durante a defesa)
[Statedef 6020]
type = S
movetype = A
physics = S
anim = 6010
ctrl = 0
velset = 0, 0

[State 6020, invencivel]
type = NotHitBy
trigger1 = Time < 12
value = SCA
time = 1

[State 6020, golpe]
type = HitDef
trigger1 = Time = 0
attr = S, NA
animtype = Hard
damage = 40, 0
kill = 0
guardflag = MA
hitflag = MAF
pausetime = 14, 14
ground.type = High
ground.hittime = 22
ground.velocity = -8, -5.5
air.velocity = -7, -5
fall = 1

[State 6020, fim]
type = ChangeState
trigger1 = AnimTime = 0 || Time >= 50
value = 0
ctrl = 1

; ------------------------------------------- arremesso (F/B + C ou D, colado)
[Statedef 6030]
type = S
movetype = A
physics = S
anim = 6030
ctrl = 0
velset = 0, 0

[State 6030, fim]
type = ChangeState
trigger1 = Time >= 34 && (AnimTime = 0 || Time >= 40)
value = 0
ctrl = 1

; sendo arremessado: a engine solta (dano) ou escapa (C ou D a tempo)
[Statedef 6040]
type = S
movetype = H
physics = N
anim = 6040
ctrl = 0
velset = 0, 0

[State 6040, seguranca]
type = ChangeState
trigger1 = Time >= 60
value = 0
ctrl = 1

; escapou do arremesso: os dois se afastam
[Statedef 6050]
type = S
movetype = I
physics = S
anim = 6050
ctrl = 0

[State 6050, empurra]
type = VelSet
trigger1 = Time = 0
x = -5

[State 6050, fim]
type = ChangeState
trigger1 = Time >= 18
value = 0
ctrl = 1

; --------------------------------------- guard crush: defesa quebrada, aberto
[Statedef 6060]
type = S
movetype = H
physics = S
anim = 6060
ctrl = 0

[State 6060, empurra]
type = VelSet
trigger1 = Time = 0
x = -3

[State 6060, fim]
type = ChangeState
trigger1 = Time >= 40
value = 0
ctrl = 1

; ----------------------------------------- ativar o MAX (A+B+C, 1 estoque)
[Statedef 6070]
type = S
movetype = I
physics = S
anim = 6070
ctrl = 0
velset = 0, 0

[State 6070, invencivel]
type = NotHitBy
trigger1 = 1
value = SCA
time = 1

[State 6070, fim]
type = ChangeState
trigger1 = Time >= 30
value = 0
ctrl = 1
`;
