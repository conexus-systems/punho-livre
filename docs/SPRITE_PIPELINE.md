# Pipeline de sprites e de frame data

Ferramentas para trocar a arte gerada por código (`scripts/roster`) por arte de produção — 3D cel-shaded
pré-renderizado **ou** pixel art HD — e para o design de combate conferir os números. Valem para os dois
estilos: a engine só vê sprites com eixo e caixas de colisão.

| Ferramenta | Comando (em `mobile/`) | Saída |
|---|---|---|
| Importador de sprites | `npm run import-sprites -- <pasta> [--out dir] [--pack] [--allow-missing]` | `.def/.air/.cns/.cmd`, `spritesN.webp`, `sprites.json`, `meta.json`, `<id>.pack.json` |
| Pasta de exemplo | `node scripts/sprites/sample.mjs <pasta>` | PNGs + `manifest.json` + `.cns/.cmd` mínimos |
| Editor de hitbox | `npm run editor` (gera `tools/editor/dist`), `npm run editor -- --serve` | página web local |
| Teste do editor no navegador | `npm run editor:check` | `docs/screenshots/editor.png` |
| Frame data | `npm run framedata` (`-- --check` no CI) | `docs/framedata/<id>.md` e `framedata.json` |

Fluxo: arte exportada → `manifest.json` → `import-sprites` → abrir a pasta no editor, acertar caixas e
ticks → baixar o `manifest.json` → `import-sprites` de novo → `framedata` / jogo.

## 1. Pasta de entrada e `manifest.json`

Uma pasta com os PNGs (RGBA, fundo transparente), o `.cns` e o `.cmd` do personagem e o `manifest.json`:

```json
{
  "id": "kenji",
  "name": "Kenji",
  "pixelsPerUnit": 4,
  "author": "Estúdio",
  "style": { "body": "#1E293B", "accent": "#B45309", "skin": "#E2B48C", "trim": "#E7E5E4", "energy": "#E0F2FE" },
  "meta": { "bio": "…", "specials": [{ "name": "…", "cmd": "qcf_p" }], "super": { "name": "…", "cmd": "super_p" } },
  "anims": {
    "0": { "loop": true, "loopStart": 0, "frames": [
      { "file": "idle_000.png", "ticks": 4, "axis": [256, 500], "flipH": false,
        "clsn1": [], "clsn2": [[-40, -380, 44, 0]] }
    ] },
    "200": { "loop": false, "loopStart": 0, "frames": [
      { "file": "jab_000.png", "ticks": 2, "axis": [256, 500], "clsn2": [[-40, -380, 44, 0]] },
      { "file": "jab_001.png", "ticks": 4, "axis": [256, 500],
        "clsn1": [[90, -330, 240, -270]], "clsn2": [[-40, -380, 44, 0], [60, -320, 150, -280]] },
      { "file": null, "ticks": 3 }
    ] }
  },
  "cns": "kenji.cns",
  "cmd": "kenji.cmd",
  "st": ["kenji-especiais.cns"]
}
```

Campos obrigatórios: `id` (minúsculas, números, `-`/`_`, 2–32), `name`, `pixelsPerUnit`, `anims`, `cns`, `cmd`.
Opcionais: `author`, `version`, `style` (cores `#RRGGBB` do HUD/efeitos, viram a seção `[Arena]` do `.def`),
`meta` (vira o `meta.json` do elenco: bio, especiais, supers, frases), `st` (mais arquivos de estados).

Por quadro:

| Campo | Significado |
|---|---|
| `file` | PNG da pasta; `null` = quadro vazio (personagem invisível). O mesmo PNG pode aparecer em vários quadros (vira um sprite só no atlas). |
| `ticks` | duração em ticks de 1/60 s (inteiro ≥ 1) ou `-1` = fica parado nesse quadro (só no último). |
| `axis` | `[x, y]` em pixels da imagem: o ponto **no chão entre os pés**. Precisa estar dentro da imagem e ser o mesmo para o mesmo PNG. |
| `flipH` / `flipV` | espelha o sprite (flag `H`/`V` do `.air`). |
| `offset` | `[x, y]` em pixels, deslocamento do sprite (`ox, oy` do `.air`). |
| `clsn1` | caixas de **ataque** `[x1, y1, x2, y2]`, em pixels relativos ao `axis`, **y negativo para cima** (a convenção do `.air` do MUGEN), olhando para a direita. |
| `clsn2` | caixas de **corpo** (onde apanha), mesma convenção. |

Por animação: `loop` (padrão `true`) e `loopStart` (quadro para onde volta). Com `loop: false` o
`loopStart` vira 0 — golpes terminam pelo estado (`AnimTime = 0` no `.cns`), não pela animação.

O importador converte pixels em unidades do MUGEN dividindo por `pixelsPerUnit` e arredondando
(`Math.round`), recorta a transparência de cada PNG (o eixo acompanha o recorte), empacota em páginas de até
2048×2048 e grava WebP com alfa (o mesmo encoder CanvasKit de `scripts/roster/paint.mjs`). Grupo do sprite =
ação onde o PNG aparece primeiro; índice = ordem dentro dela. O `.air` gerado tem as caixas por quadro.
No fim ele carrega o resultado na própria engine (`loadCharacter`) e avisa controladores não suportados.

### Erros que o importador aponta

- campo de topo ausente ou inválido (`id`, `pixelsPerUnit`, `cns`, `cmd`, cores do `style`);
- `ação 200, quadro 1: arquivo "jab_999.png" não existe` (ou PNG ilegível, ou totalmente transparente);
- `ação 20, quadro 0: axis [500, 230] fora da imagem "idle_000.png" (160x240)`;
- o mesmo PNG com dois `axis` diferentes; `ticks` inválido; caixa mal formada; `loopStart` fora dos quadros;
- `a ação 1050 é usada em kenji.cns, estado 1000, mas não está no manifest` (anim =, ChangeAnim, projanim…);
- ações obrigatórias do common1 ausentes (lista abaixo). `--allow-missing` rebaixa só essas para aviso,
  útil num rascunho: a engine troca a ação faltante por uma substituta (`fallbackAnimChain`).

### Ações obrigatórias (common1 da engine)

Fonte: `mobile/scripts/sprites/actions.mjs` (usada pelo importador).

| Ação | Uso | Ação | Uso |
|---:|---|---:|---|
| 0 | parado (loop) | 150 | defendendo um golpe em pé |
| 10 | em pé → agachado | 151 | defendendo um golpe agachado |
| 11 | agachado (loop) | 170 | derrota |
| 12 | agachado → em pé | 180 | vitória |
| 20 | andar para frente (loop) | 5000 | apanhar em pé, leve |
| 40 | preparar o pulo | 5010 | apanhar agachado |
| 41 | pulo neutro | 5030 | apanhar no ar |
| 42 | pulo para frente | 5050 | caindo |
| 43 | pulo para trás | 5100 | quicar no chão |
| 47 | pouso | 5110 | deitado |
| 120 | começar a defender em pé | 5120 | levantar |
| 130 | defesa em pé | 131 | defesa agachado |
| 132 | defesa no ar | | |

Recomendadas (sem elas a engine usa substitutas): 5, 6 (virar), 21 (andar para trás), 100 (corrida),
105 (recuo), 121/122 (começar defesa agachado/ar), 140–142 (parar de defender), 152 (defendendo no ar),
181 (pose de vitória), 190 (intro), 5001/5002 e 5011/5012 (apanhar médio/forte), e o sistema SNK:
6000/6001 (rolamento), 6010/6015 (blowback), 6030 (arremesso), 6040 (sendo arremessado), 6050 (escape),
6060 (guard crush), 6070 (MAX). Além delas, toda ação usada pelo `.cns`/`.cmd` do personagem
(golpes 200–699, especiais 1000+, supers 3000+, projéteis).

## 2. Resolução e quantidade de quadros

A luta acontece no espaço `localcoord 320×240` do MUGEN; um lutador tem ~90–110 unidades de altura e a tela
mostra 240 unidades na vertical. Num celular em paisagem com 1080 px de altura isso dá ~4,5 px por unidade
em tela cheia.

| Estilo | `pixelsPerUnit` | Lutador (100 un) | Observação |
|---|---:|---:|---|
| 3D cel-shaded pré-renderizado | **4** (3 se o atlas pesar) | ~400 px de altura | nítido até 1080p; acima disso o app escala |
| Pixel art HD | **3** (inteiro) | ~300 px de altura | desenhe na resolução final; nada de escala fracionária no export |
| Elenco atual (gerado) | 2,6 | ~260 px | referência |

Orçamento por personagem (estimativa, não medido em aparelho): a 4 px/un um quadro recortado tem em média
~250×400 px, ~30–35 quadros por página 2048²; 300 quadros ≈ 9–10 páginas. Cada página ocupa 16 MB de
textura RGBA na GPU — teste em aparelho fraco antes de fechar a resolução.

Quadros por golpe (a 60 ticks/s; ponto de partida para a direção de arte, ajuste pela frame data):

| Animação | Quadros | Ticks totais típicos |
|---|---:|---:|
| parado (0) | 6–10 em loop | 40–60 |
| andar (20/21) | 8–12 em loop | 30–48 |
| pulo (40–47) | 1–3 por fase | — |
| normal leve (x, a) | 3–5: 1–2 antecipação, 1 ativo, 1–2 volta | 10–14 |
| normal médio (y, b) | 5–7 | 16–20 |
| normal forte (z, c) | 6–9 | 22–28 |
| golpe aéreo | 3–4 (último com ticks −1) | — |
| especial | 8–14 | 30–50 |
| super | 15–30 (+ pose da pausa de super) | 50–90 |
| apanhar / defesa | 2–4 cada | — |
| derrubada, deitado, levantar | 4–8 + 1–2 + 4–6 | — |

Total típico: 250–400 quadros por personagem. Mantenha **um quadro com Clsn1 por acerto** e as poses de
antecipação longas o bastante para ler o golpe (a frame data mostra o startup real).

## 3. Exportar do Blender (câmera ortográfica)

1. **Câmera fixa e ortográfica**, de frente (eixo Y), sem seguir o personagem. A origem do personagem fica no
   chão, entre os pés, em (0, 0, 0). Com a câmera fixa, o `axis` é o mesmo pixel em todos os quadros.
2. **Escala**: escolha quantos metros vale 1 unidade do MUGEN (ex.: lutador de 1,75 m = 100 un ⇒ 0,0175 m/un).
   Para uma imagem de `L` px de largura, `Orthographic Scale = L / pixelsPerUnit × metros_por_unidade`.
   Ex.: 512 px, 4 px/un, 0,0175 m/un ⇒ 2,24.
3. **Eixo**: posicione a câmera para a origem cair num pixel inteiro, por exemplo `[256, 500]` numa imagem de
   512×512 (sobra espaço para pulos e golpes altos). Todo PNG do personagem usa esse `axis`.
4. **Animação no lugar** (sem *root motion*): o deslocamento vem dos `VelSet` do `.cns`. Se o movimento estiver
   na animação, asse-o no lugar ou compense com `offset`.
5. **Render**: Film → Transparent; Color Management → View Transform **Standard** (Filmic/AgX mudam a
   paleta); saída PNG, RGBA, 8 bits; cel-shading com Shader to RGB + Color Ramp *Constant* e contorno
   (Freestyle ou casco invertido). Anti-aliasing normal (o importador recorta pelo alfa > 1%).
6. **Quadros**: anime a 60 fps e renderize só as poses-chave; `ticks` = distância em frames até a próxima pose.
   Nomeie `<ação>_<nnn>.png` (ex.: `200_000.png`), um diretório por personagem.

Trecho de Python para conferir a câmera (rode no console do Blender):

```python
import bpy
ppu, mpu, w, h = 4, 0.0175, 512, 512           # px/unidade, metros/unidade, imagem
cam = bpy.context.scene.camera.data
cam.type = 'ORTHO'
cam.ortho_scale = w / ppu * mpu
r = bpy.context.scene.render
r.resolution_x, r.resolution_y, r.film_transparent = w, h, True
r.image_settings.file_format, r.image_settings.color_mode = 'PNG', 'RGBA'
bpy.context.scene.view_settings.view_transform = 'Standard'
```

## 4. Exportar do Aseprite (pixel art)

1. Tela do mesmo tamanho para o personagem inteiro (ex.: 384×384) e o eixo sempre no mesmo pixel — marque
   com uma *slice* ou guia (ex.: `[192, 372]`).
2. Uma *tag* por ação, com o número dela (`0`, `20`, `200`, `1000`…). Desenhe já na resolução final
   (`pixelsPerUnit` inteiro, ex.: 3); não escale no export.
3. Exporte cada quadro em PNG pela linha de comando:
   `aseprite -b kenji.aseprite --split-tags --save-as png/{tag}_{tagframe000}.png --data png/kenji.json --format json-array --list-tags`
4. A duração do quadro no Aseprite é em ms: `ticks = round(ms × 60 / 1000)` (ex.: 67 ms ≈ 4 ticks). Use
   durações múltiplas de 16,67 ms para não arredondar.
5. Monte o `manifest.json` com os PNGs e o `axis` fixo (pode gerar a lista de quadros a partir do
   `kenji.json`; esse conversor ainda não existe no repositório) e ajuste caixas e ticks no editor.

> Pendente: o renderizador do app (`src/game/renderer.ts`, `drawImageRect`) não escolhe o filtro de
> amostragem; se a pixel art for o estilo escolhido, fixar filtro *nearest* para ela e conferir em aparelho
> que a escala não borra nem distorce pixels.

## 5. Editor de hitbox e frame data

`npm run editor -- --serve` e abra `http://localhost:4320`. Escolha um personagem do elenco ou **Abrir
pasta…** (a pasta do importador, com `manifest.json` e os PNGs).

- Lista de ações à esquerda (filtro por número/nome), quadros embaixo (borda vermelha = quadro com Clsn1).
- ◀ ▶ (ou ← →) avançam quadro a quadro; espaço toca a animação a 60 ticks/s; o quadro anterior aparece apagado.
- Clsn1 em vermelho, Clsn2 em azul, eixo em amarelo, chão e grade de 10 unidades.
- Clique numa caixa para selecionar (vence a menor sob o mouse), arraste o meio para mover e as alças para
  redimensionar; edite x1/y1/x2/y2 e os ticks à direita; `1`/`2` criam Clsn1/Clsn2, Delete apaga.
- A frame data do personagem é remedida na engine a cada mudança (o próprio personagem é o boneco).
- **Baixar .air** (os dois casos) e **Baixar manifest.json** (pasta do importador; mantém os campos extras).
  No elenco embutido o `.air` é gerado por `scripts/roster`; leve a mudança para lá.

Unidades no editor: caixas em **unidades do MUGEN** no elenco embutido e em **pixels relativos ao eixo** na
pasta do importador (as mesmas do `manifest.json`).

## 6. Frame data

`npm run framedata` mede todos os golpes do elenco embutido na engine (`src/engine/framedata.ts`) e escreve
`docs/framedata/<id>.md` e `docs/framedata/framedata.json`. `--check` só compara (para o CI);
`--dummy <id>` troca o boneco (padrão: o primeiro do elenco). Golpes = estados 200–4999 alcançados por um
`ChangeState` do `[Statedef -1]`; o comando e a barra exigida vêm dos triggers.

Como mede: o atacante entra no estado do golpe (`changeState`) e o mundo roda com `stepWorld` — sem relógio
nem aleatório; o resultado é o mesmo a cada execução.

- **Vazio** (boneco longe e intocável): startup = primeiro quadro em que o golpe pode acertar (Clsn1 com
  HitDef armado, ou o quadro em que o projétil nasce); ativos = do primeiro ao último quadro armado; total =
  quadros até voltar a ter controle; recuperação = total − (startup + ativos − 1); custo/ganho de barra;
  quadros com `NotHitBy` (invencível).
- **Acerto**: boneco parado, do encostado para longe (passos de 6 unidades) até o golpe acertar; vantagem =
  quadro em que o boneco volta a ter controle − quadro em que o atacante volta. KD = derrubou.
- **Defesa**: na mesma distância, boneco já segurando para trás (e para baixo se o golpe for baixo) — sem
  apertar no último instante, para não virar Just Defend.
- Nível pelo `guardflag`: médio (H e L, ou M), alto (só em pé), baixo (só agachado), imbloqueável (vazio).
- A pausa de super não conta como quadro. Golpes aéreos: só startup/ativos (vantagem depende da altura).
