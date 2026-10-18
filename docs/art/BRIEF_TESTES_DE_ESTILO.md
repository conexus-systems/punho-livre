# Brief — testes de estilo de arte

Para: estúdios e artistas convidados. Dono: diretor de arte (até a contratação, o PO).
Status: pronto para envio depois da revisão do diretor de arte e do jurídico (contrato e cessão de direitos).

## 1. O projeto em poucas linhas

Jogo de luta 2D para celular (Android e iOS), com lutadores originais do Brasil e da América Latina. A engine
é própria e desenha **sprites 2D quadro a quadro** (não roda modelos 3D em tempo real). Os personagens
precisam ser lidos com clareza numa tela de 6 polegadas, a 60 quadros por segundo, com dois lutadores, efeitos
e cenário ao mesmo tempo.

Queremos comparar três estilos com o **mesmo personagem**, antes de decidir a produção do elenco (8 lutadores
no lançamento). A recomendação interna hoje é o estilo A; a alternativa forte é o B. O C entra como
comparação.

## 2. O personagem do teste: Brasa

Capoeirista de Salvador, criado na roda do Pelourinho. Ginga sem parar; os chutes deixam rastro de brasa.

- Pernas longas, corpo esguio e atlético, cerca de 1,78 m.
- Regata amarela, calça de capoeira branca bem larga embaixo, cordão verde de graduação na cintura, pés
  descalços.
- Fitas do Bonfim (coloridas) amarradas nos dois pulsos e num tornozelo — elas se mexem e marcam os chutes.
- Cabelo em twists curtos. Pele marrom-escura.
- Rastro dos chutes: laranja de brasa com faíscas, não chama amarela.
- Personalidade: alegre, provocador, nunca parado.

Ficha completa e golpes: [../gdd/ELENCO_LANCAMENTO.md](../gdd/ELENCO_LANCAMENTO.md#22-brasa--técnico).
O rascunho atual (arte vetorial gerada por código) está no app 0.4.0 e serve **só** como referência de
proporção e de golpes, não de estilo.

Não use referências visuais de personagens de outros jogos. O personagem não pode lembrar nenhum capoeirista
de jogos conhecidos.

## 3. Os três estilos

### A — 3D cel-shaded pré-renderizado (recomendado)

- Modelo 3D com sombreamento chapado em 2 ou 3 tons, sem degradê suave.
- Contorno escuro de espessura variável (mais grosso na silhueta, mais fino nos detalhes internos), na cor
  escura do material e não em preto puro.
- Câmera ortográfica lateral fixa. Renderizado em quadros 2D com fundo transparente.
- Animação com poses-chave fortes e quadros "segurados" (não interpolar tudo a 60 fps): deve parecer
  desenhado à mão. Deformações e "smear" nos golpes fortes são bem-vindos.
- Luz fixa vinda de cima e da frente; nenhuma luz do cenário (o lutador fica igual em todos os cenários).
- Vantagem esperada: cores alternativas e skins por re-render, consistência entre animadores.

### B — Pixel art HD (alternativa)

- Personagem com cerca de 190–210 px de altura em pé, na resolução nativa (sem antialiasing).
- Paleta indexada e limitada: até 48 cores por personagem, com o índice 0 reservado para transparência, para
  permitir trocar paleta (cores alternativas) sem redesenhar.
- Contorno escuro colorido (não preto puro), sombreamento em 3–4 tons, pouco ou nenhum dithering.
- Animação expressiva de fliperama: antecipação clara, quadro de impacto exagerado, recuperação legível.
- Exibido no jogo com escala inteira e filtro "vizinho mais próximo".

### C — Ilustração 2D (comparação)

- Animação tradicional digital: cada quadro desenhado, linha limpa de espessura variável, cor chapada em
  2 tons (luz e sombra), sem textura — como uma série animada de TV.
- Cores em áreas chapadas para permitir troca de paleta por ferramenta.

## 4. Entregáveis de cada teste

| # | Item | Detalhe |
|---|---|---|
| 1 | Turnaround | Frente, 3/4, perfil e costas, colorido, em pé neutro. Para o estilo A: render do modelo + arquivo-fonte |
| 2 | Folha de cores | Paleta principal + **1 cor alternativa** completa (para medir o custo de cores e skins) |
| 3 | Idle animado | Em guarda com ginga, em laço, 10–14 quadros |
| 4 | Golpe forte animado | Armada (chute giratório que avança; D em pé): antecipação, impacto, recuperação; 10–16 quadros, com o rastro de brasa como camada separada (efeito) |
| 5 | Pacote para o jogo | Idle e golpe no formato da seção 6 (PNGs + `manifest.json`) |
| 6 | Composição em tela | Uma imagem 2400×1080 com o Brasa sobre um fundo neutro e um segundo Brasa na cor alternativa, na escala do jogo, para checar leitura no celular |
| 7 | Relatório de horas | Horas **reais** gastas por item (1 a 6). É a informação mais importante do teste |
| 8 | Arquivos-fonte | Arquivos de trabalho (cena 3D, .aseprite/.psd, projeto de animação) |

Prazo sugerido: 3 semanas por teste, em paralelo, dentro de novembro/2026 (Fase 0).
Orçamento: a combinar com cada estúdio. **Nenhuma cotação foi feita ainda.**

### Como os testes serão avaliados

| Critério | Peso sugerido |
|---|---|
| Leitura em tela de 6" (silhueta, golpe, direção) com dois lutadores e efeitos | 25% |
| Qualidade e identidade (combina com o jogo, com o público, é original) | 25% |
| Custo por personagem extrapolado das horas reais | 25% |
| Facilidade de cores, skins e reaproveitamento entre lutadores | 10% |
| Tamanho dos arquivos no pacote (meta do jogo: download ≤ 150 MB) | 10% |
| Cumprimento do formato de entrega | 5% |

O diretor de arte, o designer de combate e o dono do projeto avaliam juntos. O teste mais bem avaliado vira a
proposta de contrato para a fatia vertical (Kaze e Brasa).

## 5. Resolução e quadros por segundo

A engine trabalha no espaço de coordenadas 320×240 do MUGEN. Um lutador em pé mede cerca de 90–110 unidades.
`pixelsPerUnit` diz quantos pixels da imagem cabem em uma unidade do jogo.

| Estilo | pixelsPerUnit da entrega | Altura do Brasa em pé | Mestre (arquivar) |
|---|---|---|---|
| A — 3D | 4 | ≈ 370 px | Render a 8 px/unidade (≈ 740 px) |
| B — pixel art | 2 | ≈ 190–210 px | O próprio arquivo nativo |
| C — ilustração | 4 | ≈ 370 px | Arquivo de trabalho a 8 px/unidade |

Os números de A e C serão revistos na fatia vertical depois de medir tamanho e memória (ver seção 8).

**Tempo:** a engine roda a 60 ticks por segundo. Cada quadro tem um campo `ticks` (quanto tempo fica na
tela). Sugestão de partida:

- idle e andar: 4–6 ticks por quadro;
- golpes: 2–4 ticks na antecipação e no impacto, 3–6 na recuperação;
- 3D: renderizar a 30 fps (2 ticks) e escolher os quadros-chave; não entregar 60 quadros por segundo.

Os ticks finais são do designer de combate (ferramenta de frame data); a arte entrega uma sugestão.

## 6. Formato de entrega para o importador do jogo

O formato oficial é descrito em **[../SPRITE_PIPELINE.md](../SPRITE_PIPELINE.md)** (escrito pelo agente que
implementa o importador). Se esse arquivo e este brief divergirem, **vale o SPRITE_PIPELINE.md**.

Resumo:

```
brasa/
  manifest.json
  idle_000.png
  idle_001.png
  ...
  armada_000.png
  ...
  fx_brasa_000.png
```

- PNG com transparência (estilo B: PNG indexado de 8 bits), sem margens enormes (o importador corta,
  mas arquivos grandes atrasam o trabalho).
- Sem sombra no chão desenhada no sprite (a engine desenha).
- Lutador sempre virado para a **direita**.

```json
{
  "id": "brasa",
  "name": "Brasa",
  "pixelsPerUnit": 4,
  "anims": {
    "idle": {
      "loop": true,
      "loopStart": 0,
      "frames": [
        { "file": "idle_000.png", "ticks": 5, "axis": [182, 371], "flipH": false,
          "clsn1": [], "clsn2": [[-60, -360, 60, 0]] }
      ]
    },
    "armada": {
      "loop": false,
      "loopStart": 0,
      "frames": [
        { "file": "armada_000.png", "ticks": 3, "axis": [190, 372], "flipH": false,
          "clsn1": [], "clsn2": [[-55, -350, 65, 0]] },
        { "file": "armada_006.png", "ticks": 2, "axis": [240, 370], "flipH": false,
          "clsn1": [[40, -300, 260, -200]], "clsn2": [[-50, -340, 120, 0]] }
      ]
    }
  }
}
```

| Campo | O que é |
|---|---|
| `id` | identificador em minúsculas, sem espaço nem acento |
| `name` | nome exibido |
| `pixelsPerUnit` | pixels da imagem por unidade do jogo (seção 5) |
| `anims` | uma entrada por ação (nomes na seção 7) |
| `loop` | `true` se a animação repete |
| `loopStart` | índice do quadro onde o laço recomeça |
| `file` | PNG dentro da pasta |
| `ticks` | duração do quadro em ticks de 1/60 s |
| `axis` | `[x, y]` em pixels da imagem: o **ponto no chão entre os pés**. É o ponto que a engine posiciona no mundo; se ele "dançar" entre quadros, o lutador treme |
| `flipH` | `true` se o quadro deve ser espelhado (raro; use para reaproveitar quadros simétricos) |
| `clsn1` | caixas de ataque (onde o golpe acerta), relativas ao `axis` |
| `clsn2` | caixas do corpo (onde o lutador pode ser atingido), relativas ao `axis` |

As unidades das caixas (pixels da imagem ou unidades do jogo) estão definidas no SPRITE_PIPELINE.md.
**O estúdio pode entregar `clsn1` e `clsn2` vazios**: o designer de combate desenha as caixas no editor de
hitbox do jogo. Se o estúdio entregar caixas, elas são ponto de partida.

## 7. Animações obrigatórias por personagem (produção)

Para o teste, só idle e o golpe forte. A lista abaixo é a da produção, para o estúdio cotar. O número MUGEN é
o da ação equivalente na engine. Contagens são **sugestões**; o diretor de arte ajusta por lutador.

### 7.1 Movimento e estados básicos

| Ação | Nº MUGEN | Quadros |
|---|---|---|
| idle (em guarda, laço) | 0 | 10–14 |
| virar em pé / agachado | 5 / 6 | 2–3 cada |
| agachar (entrar / laço / levantar) | 10 / 11 / 12 | 2–3 / 4–6 / 2–3 |
| andar para frente / para trás | 20 / 21 | 8–10 cada |
| pulo: preparação, subida (neutro, frente, trás), descida, pouso | 40–47 | 20–30 no total |
| corrida (laço) | 100 | 6–8 |
| recuo | 105 | 4–6 |
| defesa em pé, agachado, no ar (entrar, laço, sair, recebendo golpe) | 120–152 | 16–22 no total |

### 7.2 Golpes

| Ação | Nº MUGEN | Quadros |
|---|---|---|
| 6 normais em pé (A, B, C, D, C perto, D perto) | 200–250 | 6–10 cada |
| 4 normais agachado (A, B, C, D) | 400–440 | 5–8 cada |
| 4 normais no ar (A, B, C, D) | 600–640 | 4–6 cada |
| 4 especiais | 1000–1399 | 12–25 cada (mais em especiais com postura) |
| 2 supers | 3000–3199 | 30–50 cada |
| arremesso normal (agarra e joga) | 800 / 6030 | 12–16 |
| agarrão de comando (se o lutador tiver) | — | 20–30 |
| poses de quem é arremessado (para os arremessos do próprio lutador) | — | 6–10 |

### 7.3 Apanhar e cair

| Ação | Nº MUGEN | Quadros |
|---|---|---|
| golpe recebido em pé (leve, médio, forte) | 5000–5002 | 3–4 cada |
| golpe recebido agachado | 5010–5012 | 3–4 cada |
| golpe recebido no ar / girando | 5030–5050 | 4–6 |
| quique no chão, deitado, levantar | 5100 / 5110 / 5120 | 3 / 2 / 8–10 |

### 7.4 Sistema e apresentação

| Ação | Nº MUGEN | Quadros |
|---|---|---|
| rolamento para frente / para trás | 6000 / 6001 | 8–10 cada |
| blowback no chão / no ar | 6010 / 6015 | 8–12 / 6–8 |
| arremesso para trás, escape | 6040 / 6050 | 6–10 cada |
| tonto (guard crush), laço | 6060 | 6–8 |
| ativação do MAX | 6070 | 12–16 |
| intro | 190 | 15–25 |
| vitória (2 variações) | 180 / 181 | 12–20 cada |
| derrota por tempo | 170 | 6–10 |
| provocação | 195 | 10–15 |

### 7.5 Efeitos (camada separada)

Projéteis, rastros, faíscas de impacto próprias e flash de super: 40–80 quadros por lutador.

**Total estimado por lutador: 550–700 quadros de personagem + 40–80 de efeitos.**

## 8. Estimativa de horas por personagem

> **Estimativa interna, não cotação.** Serve para comparar estilos e planejar. Precisa ser validada pelas
> horas reais dos testes (item 7 dos entregáveis) e por cotações formais. Considera o lutador completo da
> seção 7 (≈ 650 quadros), por profissionais experientes.

| Etapa | A — 3D cel-shaded | B — pixel art HD | C — ilustração 2D |
|---|---|---|---|
| Design e turnaround | 30–50 h | 30–60 h | 30–60 h |
| Modelo, textura e rig (só 3D) | 100–180 h | — | — |
| Animação | 250–450 h | 1.000–2.500 h (≈ 1,5–4 h por quadro) | 650–1.900 h (≈ 1–3 h por quadro) |
| Render, contorno, limpeza, exportação | 40–80 h | incluído | 40–80 h (cor) |
| Efeitos | 40–80 h | 60–120 h | 50–100 h |
| **Total por lutador** | **≈ 460–840 h** | **≈ 1.100–2.700 h** | **≈ 770–2.140 h** |
| Montagem do pipeline (uma vez, primeiro lutador) | + 120–200 h (shader, render, exportação) | + 20–40 h (paleta, guia) | + 20–40 h |
| Cor alternativa | ≈ 8–16 h (re-render) | ≈ 2–4 h (paleta) | ≈ 4–8 h (paleta por ferramenta) |
| Skin (roupa nova) | ≈ 60–120 h (modelo + re-render, mesmo rig) | 50–80% do custo do lutador | 50–80% do custo do lutador |

Leitura: o 3D tem custo fixo alto no começo e custo baixo por skin — bom para um jogo que vende skins. A pixel
art tem custo de animação muito maior por lutador, mas arquivos muito menores.

### Tamanho estimado no pacote

Também **estimativa**, a medir na fatia vertical:

| Estilo | Por lutador (≈ 650 quadros) | 8 lutadores |
|---|---|---|
| A — 3D a 4 px/unidade, WebP com perda | ≈ 10–25 MB | ≈ 80–200 MB |
| B — pixel art a 2 px/unidade, PNG indexado | ≈ 2–6 MB | ≈ 16–48 MB |
| C — ilustração a 4 px/unidade, WebP | ≈ 8–20 MB | ≈ 64–160 MB |

No estilo A e no C, os lutadores sozinhos podem estourar a meta de download de 150 MB. Saídas: 3 px/unidade,
ajuste da qualidade do WebP, menos quadros nas ações longas, e baixar lutadores e cenários sob demanda depois
da instalação. Isso é decidido na fatia vertical (tarefa em [F1-04](../backlog/F1-04-lutadores-fatia.md)).

## 9. Direitos

- Tudo criado sob encomenda, com **cessão total dos direitos patrimoniais** para o projeto (contrato revisado
  pelo jurídico antes do início).
- Proibido usar assets, sprites, modelos, texturas ou referências diretas de outros jogos, inclusive como base
  para traçar ou retopologizar.
- Ferramentas de geração por IA: só com autorização por escrito do diretor de arte, informando onde e como
  foram usadas.
