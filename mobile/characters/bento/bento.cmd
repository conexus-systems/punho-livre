; Bento — comandos (formato MUGEN .cmd)
; Gerado por scripts/roster/generate.mjs

[Remap]
x = x
y = y
z = z
a = a
b = b
c = c
s = s

[Defaults]
command.time = 15
command.buffer.time = 2

[Command]
name = "super2_p"
command = ~D, DB, B, D, DB, B, x
time = 35

[Command]
name = "super2_p"
command = ~D, DB, B, D, DB, B, y
time = 35

[Command]
name = "super2_p"
command = ~D, DB, B, D, DB, B, z
time = 35

[Command]
name = "super_p"
command = ~D, DF, F, D, DF, F, x
time = 35

[Command]
name = "super_p"
command = ~D, DF, F, D, DF, F, y
time = 35

[Command]
name = "super_p"
command = ~D, DF, F, D, DF, F, z
time = 35

[Command]
name = "hcf_p"
command = ~B, DB, D, DF, F, x
time = 15

[Command]
name = "hcf_p"
command = ~B, DB, D, DF, F, y
time = 15

[Command]
name = "hcf_p"
command = ~B, DB, D, DF, F, z
time = 15

[Command]
name = "dd_p"
command = ~D, D, x
time = 15

[Command]
name = "dd_p"
command = ~D, D, y
time = 15

[Command]
name = "dd_p"
command = ~D, D, z
time = 15

[Command]
name = "qcb_k"
command = ~D, DB, B, a
time = 15

[Command]
name = "qcb_k"
command = ~D, DB, B, b
time = 15

[Command]
name = "qcb_k"
command = ~D, DB, B, c
time = 15

[Command]
name = "qcf_p"
command = ~D, DF, F, x
time = 15

[Command]
name = "qcf_p"
command = ~D, DF, F, y
time = 15

[Command]
name = "qcf_p"
command = ~D, DF, F, z
time = 15

[Command]
name = "FF"
command = F, >F
time = 10

[Command]
name = "BB"
command = B, >B
time = 10

[Command]
name = "x"
command = x
time = 1

[Command]
name = "y"
command = y
time = 1

[Command]
name = "z"
command = z
time = 1

[Command]
name = "a"
command = a
time = 1

[Command]
name = "b"
command = b
time = 1

[Command]
name = "c"
command = c
time = 1

[Command]
name = "s"
command = s
time = 1

[Command]
name = "holdfwd"
command = /$F
time = 1

[Command]
name = "holdback"
command = /$B
time = 1

[Command]
name = "holdup"
command = /$U
time = 1

[Command]
name = "holddown"
command = /$D
time = 1

; ------------------------------------------------------------
[Statedef -1]

[State -1, Abraço do Yokozuna]
type = ChangeState
value = 3100
triggerall = command = "super2_p"
triggerall = power >= 2000
triggerall = statetype != A
trigger1 = ctrl
trigger2 = stateno = [200, 2999] && movecontact

[State -1, Yokozuna]
type = ChangeState
value = 3000
triggerall = command = "super_p"
triggerall = power >= 1000
triggerall = statetype != A
trigger1 = ctrl
trigger2 = stateno = [200, 2999] && movecontact

[State -1, Arremesso Sumô]
type = ChangeState
value = 1000
triggerall = command = "hcf_p"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = stateno = [200, 499] && movecontact

[State -1, Shiko]
type = ChangeState
value = 1200
triggerall = command = "qcb_k"
triggerall = statetype != A
triggerall = NumProjID(1200) = 0
trigger1 = ctrl
trigger2 = stateno = [200, 499] && movecontact

[State -1, Investida]
type = ChangeState
value = 1300
triggerall = command = "qcf_p"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = stateno = [200, 499] && movecontact

[State -1, Cem Tapas]
type = ChangeState
value = 1100
triggerall = command = "dd_p"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = stateno = [200, 499] && movecontact

[State -1, Corrida]
type = ChangeState
value = 100
triggerall = command = "FF"
triggerall = statetype = S
trigger1 = ctrl

[State -1, Recuo]
type = ChangeState
value = 105
triggerall = command = "BB"
triggerall = statetype = S
trigger1 = ctrl

[State -1, Normal 640 (c)]
type = ChangeState
value = 640
triggerall = command = "c"
triggerall = statetype = A
trigger1 = ctrl

[State -1, Normal 630 (a)]
type = ChangeState
value = 630
triggerall = command = "a"
triggerall = statetype = A
trigger1 = ctrl

[State -1, Normal 630 (b)]
type = ChangeState
value = 630
triggerall = command = "b"
triggerall = statetype = A
trigger1 = ctrl

[State -1, Normal 610 (z)]
type = ChangeState
value = 610
triggerall = command = "z"
triggerall = statetype = A
trigger1 = ctrl

[State -1, Normal 600 (x)]
type = ChangeState
value = 600
triggerall = command = "x"
triggerall = statetype = A
trigger1 = ctrl

[State -1, Normal 600 (y)]
type = ChangeState
value = 600
triggerall = command = "y"
triggerall = statetype = A
trigger1 = ctrl

[State -1, Normal 440 (c)]
type = ChangeState
value = 440
triggerall = command = "c"
triggerall = command = "holddown"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = (stateno = 400 || stateno = 430) && movecontact

[State -1, Normal 430 (a)]
type = ChangeState
value = 430
triggerall = command = "a"
triggerall = command = "holddown"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = (stateno = 400) && movecontact

[State -1, Normal 430 (b)]
type = ChangeState
value = 430
triggerall = command = "b"
triggerall = command = "holddown"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = (stateno = 400) && movecontact

[State -1, Normal 410 (z)]
type = ChangeState
value = 410
triggerall = command = "z"
triggerall = command = "holddown"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = (stateno = 400 || stateno = 430) && movecontact

[State -1, Normal 400 (x)]
type = ChangeState
value = 400
triggerall = command = "x"
triggerall = command = "holddown"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = (stateno = 400 || stateno = 430) && movecontact

[State -1, Normal 400 (y)]
type = ChangeState
value = 400
triggerall = command = "y"
triggerall = command = "holddown"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = (stateno = 400 || stateno = 430) && movecontact

[State -1, Normal 250 (c)]
type = ChangeState
value = 250
triggerall = command = "c"
triggerall = command != "holddown"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = (stateno = 210 || stateno = 240) && movecontact

[State -1, Normal 240 (b)]
type = ChangeState
value = 240
triggerall = command = "b"
triggerall = command != "holddown"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = (stateno = 200 || stateno = 230 || stateno = 430) && movecontact

[State -1, Normal 230 (a)]
type = ChangeState
value = 230
triggerall = command = "a"
triggerall = command != "holddown"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = (stateno = 200) && movecontact

[State -1, Normal 220 (z)]
type = ChangeState
value = 220
triggerall = command = "z"
triggerall = command != "holddown"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = (stateno = 200 || stateno = 210 || stateno = 230 || stateno = 400) && movecontact

[State -1, Normal 210 (y)]
type = ChangeState
value = 210
triggerall = command = "y"
triggerall = command != "holddown"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = (stateno = 200 || stateno = 230 || stateno = 400) && movecontact

[State -1, Normal 200 (x)]
type = ChangeState
value = 200
triggerall = command = "x"
triggerall = command != "holddown"
triggerall = statetype != A
trigger1 = ctrl
