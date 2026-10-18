# Iara — frame data

> Gerado por `npm run framedata` (scripts/framedata) simulando a engine. Não edite à mão.
> Boneco: Kaze, parado no centro, colado no atacante (acerto/defesa) ou longe (vazio).
> Vantagem = quadro em que o boneco volta a agir − quadro em que o atacante volta a agir (positivo = atacante primeiro).
> KD = derruba (vantagem contada até o boneco levantar). Golpes aéreos: vantagem depende da altura do pulo (não medida).
> "—" no acerto/defesa = o golpe não encosta no boneco em pé (ou defendendo) a nenhuma distância, ou não ataca.
> Barra: −N = custo; +N = ganho só por usar o golpe (sem acertar). Dist. = distância entre os eixos em que o acerto foi medido.

| Golpe | Comando | Estado | Startup | Ativos | Recup. | Total | Acerto | Defesa | Dano | Defesa (dano) | Acertos | Nível | Barra | Invencível | Dist. |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---|---:|
| **Normais** | | | | | | | | | | | | | | | |
| em pé x | `x` | 200 | 3 | 3 | 6 | 11 | +5 | 0 | 22 | 3 | 1 | médio | +7 | — | 30 |
| em pé y | `y` | 210 | 5 | 4 | 9 | 17 | +4 | -2 | 44 | 6 | 1 | médio | +15 | — | 30 |
| em pé z | `z` | 220 | 7 | 4 | 13 | 23 | +3 | -4 | 71 | 9 | 1 | médio | +24 | — | 30 |
| em pé a | `a` | 230 | 4 | 3 | 7 | 13 | +4 | -1 | 27 | 4 | 1 | médio | +9 | — | 30 |
| em pé b | `b` | 240 | 6 | 4 | 10 | 19 | +4 | -2 | 49 | 7 | 1 | médio | +17 | — | 30 |
| em pé c | `c` | 250 | 8 | 5 | 15 | 27 | +2 | -6 | 80 | 10 | 1 | médio | +27 | — | 30 |
| agachado x/y | `↓+x/y` | 400 | 3 | 3 | 6 | 11 | +4 | 0 | 20 | 3 | 1 | médio | +7 | — | 30 |
| agachado z | `↓+z` | 410 | 6 | 5 | 17 | 27 | — | — | 0 | 0 | 0 | médio | +23 | — | — |
| agachado a/b | `↓+a/b` | 430 | 4 | 4 | 7 | 14 | +3 | -2 | 29 | 4 | 1 | baixo | +10 | — | 30 |
| agachado c | `↓+c` | 440 | 6 | 3 | 19 | 27 | +93 KD | -8 | 59 | 8 | 1 | baixo | +20 | — | 30 |
| no ar x/y | `(ar) x/y` | 600 | 3 | 7 | — | — | — | — | 0 | 0 | 0 | alto | +13 | — | — |
| no ar z | `(ar) z` | 610 | 4 | 5 | — | — | — | — | 0 | 0 | 0 | alto | +22 | — | — |
| no ar a/b | `(ar) a/b` | 630 | 3 | 9 | — | — | — | — | 0 | 0 | 0 | alto | +15 | — | — |
| no ar c | `(ar) c` | 640 | 5 | 7 | — | — | — | — | 0 | 0 | 0 | alto | +24 | — | — |
| **Especiais** | | | | | | | | | | | | | | | |
| Onda do Rio | `qcf_p` | 1000 | 9 | proj. | 25 | 34 | +8 | -4 | 54 | 9 | 1 | baixo | +40 | — | 30 |
| Gota Cortante | `qcf_p` | 1100 | 6 | proj. | — | — | — | — | 0 | 0 | 0 | alto | +35 | — | — |
| Correnteza | `dd_k` | 1200 | — | — | — | 22 | — | — | 0 | 0 | 0 | — | 0 | 1-17 | — |
| Redemoinho | `dp_p` | 1300 | 4 | 15 | 30 | 48 | +91 KD | -30 | 86 | 11 | 1 | médio | +50 | 1-7 | 30 |
| **Supers** | | | | | | | | | | | | | | | |
| Pororoca | `super_p` | 3000 | 31 | proj. | 37 | 68 | +113 KD | -23 | 245 | 41 | 1 | médio | −1000 | 1-25 | 30 |
| Encontro das Águas | `super2_p` | 3100 | 31 | proj. | 37 | 68 | +113 KD | -23 | 372 | 62 | 1 | baixo | −2000 | 1-25 | 30 |
