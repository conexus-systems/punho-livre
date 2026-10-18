# Bento — frame data

> Gerado por `npm run framedata` (scripts/framedata) simulando a engine. Não edite à mão.
> Boneco: Kaze, parado no centro, colado no atacante (acerto/defesa) ou longe (vazio).
> Vantagem = quadro em que o boneco volta a agir − quadro em que o atacante volta a agir (positivo = atacante primeiro).
> KD = derruba (vantagem contada até o boneco levantar). Golpes aéreos: vantagem depende da altura do pulo (não medida).
> "—" no acerto/defesa = o golpe não encosta no boneco em pé (ou defendendo) a nenhuma distância, ou não ataca.
> Barra: −N = custo; +N = ganho só por usar o golpe (sem acertar). Dist. = distância entre os eixos em que o acerto foi medido.

| Golpe | Comando | Estado | Startup | Ativos | Recup. | Total | Acerto | Defesa | Dano | Defesa (dano) | Acertos | Nível | Barra | Invencível | Dist. |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---|---:|
| **Normais** | | | | | | | | | | | | | | | |
| em pé x | `x` | 200 | 3 | 3 | 6 | 11 | +5 | 0 | 25 | 3 | 1 | médio | +7 | — | 44 |
| em pé y | `y` | 210 | 5 | 4 | 9 | 17 | +4 | -2 | 50 | 7 | 1 | médio | +15 | — | 44 |
| em pé z | `z` | 220 | 7 | 4 | 13 | 23 | +3 | — | 81 | 0 | 1 | médio | +24 | — | 44 |
| em pé a | `a` | 230 | 4 | 3 | 7 | 13 | +4 | -1 | 31 | 4 | 1 | médio | +9 | — | 44 |
| em pé b | `b` | 240 | 6 | 4 | 10 | 19 | +4 | -2 | 56 | 8 | 1 | médio | +17 | — | 44 |
| em pé c | `c` | 250 | 8 | 5 | 15 | 27 | +2 | -6 | 92 | 11 | 1 | médio | +27 | — | 44 |
| agachado x/y | `↓+x/y` | 400 | 3 | 3 | 6 | 11 | +4 | 0 | 22 | 3 | 1 | médio | +7 | — | 44 |
| agachado z | `↓+z` | 410 | 6 | 5 | 17 | 27 | — | — | 0 | 0 | 0 | médio | +23 | — | — |
| agachado a/b | `↓+a/b` | 430 | 4 | 4 | 7 | 14 | +3 | -2 | 34 | 4 | 1 | baixo | +10 | — | 44 |
| agachado c | `↓+c` | 440 | 6 | 3 | 19 | 27 | +93 KD | -8 | 67 | 9 | 1 | baixo | +20 | — | 44 |
| no ar x/y | `(ar) x/y` | 600 | 3 | 7 | — | — | — | — | 0 | 0 | 0 | alto | +13 | — | — |
| no ar z | `(ar) z` | 610 | 4 | 5 | — | — | — | — | 0 | 0 | 0 | alto | +22 | — | — |
| no ar a/b | `(ar) a/b` | 630 | 3 | 9 | — | — | — | — | 0 | 0 | 0 | alto | +15 | — | — |
| no ar c | `(ar) c` | 640 | 5 | 7 | — | — | — | — | 0 | 0 | 0 | alto | +24 | — | — |
| **Especiais** | | | | | | | | | | | | | | | |
| Arremesso Sumô | `hcf_p` | 1000 | 5 | 4 | 19 | 27 | +98 KD | — | 190 | 0 | 1 | imbloqueável | +40 | — | 44 |
| Cem Tapas | `dd_p` | 1100 | 5 | 17 | 11 | 32 | +6 | 0 | 108 | 18 | 6 | médio | +45 | — | 44 |
| Shiko | `qcb_k` | 1200 | 15 | proj. | 36 | 51 | +113 KD | — | 125 | 85 | 2 | alto | +45 | — | 44 |
| Investida | `qcf_p` | 1300 | 6 | 13 | 11 | 29 | 0 | -8 | 101 | 12 | 1 | médio | +40 | — | 44 |
| **Supers** | | | | | | | | | | | | | | | |
| Yokozuna | `super_p` | 3000 | 15 | 23 | 13 | 50 | +111 KD | -2 | 258 | 19 | 5 | médio | −1000 | 1-20 | 44 |
| Abraço do Yokozuna | `super2_p` | 3100 | 5 | 4 | 19 | 27 | +98 KD | — | 470 | 0 | 1 | imbloqueável | −2000 | 1-12 | 44 |
