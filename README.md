# Mugen Brawl

Jogo de luta 2.5D para navegador, inspirado em **Little Fighter 2**: arena com profundidade,
combos, golpes especiais por sequência de botões, itens para pegar e arremessar, partidas de
até 8 lutadores, modo história e sobrevivência.

Tudo é original e feito em código: personagens desenhados proceduralmente no Canvas, cenários
com paralaxe e efeitos sonoros sintetizados com WebAudio. O jogo não usa imagens nem áudio
externos e não depende de nenhuma biblioteca.

## Como jogar

- **Rápido:** abra `dist/mugen-brawl.html` no navegador (é um arquivo único).
- **Código-fonte:** abra `index.html` diretamente ou sirva a pasta:
  `python3 -m http.server` e acesse `http://localhost:8000`.

## Controles

| Ação         | 1P                | 2P                   |
|--------------|-------------------|----------------------|
| Mover        | `W` `A` `S` `D`   | Setas                |
| Ataque (A)   | `J` ou `F`        | `Num 1` ou `,`       |
| Pulo (J)     | `K` ou `G`        | `Num 2` ou `.`       |
| Defesa (D)   | `L` ou `H`        | `Num 3` ou `/`       |

`Esc`/`P` pausa · `M` liga/desliga o som · `Enter` confirma nos menus.
Em celulares e tablets aparecem botões de toque depois do primeiro toque na tela.

Para dois jogadores no mesmo teclado, o 1P usa `WASD` + `F G H` e o 2P usa as setas + `Num 1 2 3`.

### Movimentos

- **Correr:** toque duas vezes ← ou →
- **Combo:** A, A, A (o terceiro golpe derruba)
- **Voadora:** correndo + A · **chute aéreo:** pulo + A
- **Pulo longo:** correndo + J · **rolamento:** correndo + D
- **Defesa:** segure D de frente para o golpe (defender demais quebra a guarda)
- **Especiais:** D, depois uma direção, depois A ou J, em sequência rápida
  (ex.: `D → A`). Gastam MP, que se recupera com o tempo.
- **Itens:** A perto de um item pega. Bastão: A golpeia, correndo/no ar + A arremessa.
  Pedra: A arremessa. Leite recupera vida e suco recupera MP.

## Lutadores

| Lutador | Estilo | D → A | Outros especiais |
|---------|--------|-------|------------------|
| **Kai** | equilibrado | Onda Ki | D ↑ A Gancho do Dragão · D → J Rajada de Socos |
| **Brasa** | fogo, agressivo | Bola de Fogo | D → J Cometa Flamejante · D ↓ J Anel de Chamas |
| **Neve** | gelo, congela | Rajada Gélida | D ↓ A Pilares de Gelo · D → J Deslize Glacial |
| **Trovão** | o mais rápido | Faísca | D ↑ A Relâmpago · D ↓ J Teleporte |
| **Rocha** | pesado, muita vida | Pedregulho | D ↓ A Terremoto · D → J Investida do Touro |
| **Sombra** | ninja | Shurikens | D ↑ A Chute Tornado · D ↓ J Bomba de Fumaça |

## Modos

- **VS:** 1 ou 2 jogadores e até 8 lutadores no total. Cada jogador escolhe o time
  (ou "Independente"). Também dá para configurar quantos computadores entram, o time deles,
  a dificuldade e o cenário.
- **História:** 5 fases com 3 trechos de inimigos cada e um chefe no final. Jogável a dois.
- **Sobrevivência:** ondas infinitas de inimigos, cada vez mais fortes, com um chefe a cada 5 ondas.

## Estrutura

```
index.html          página e ordem dos scripts
css/style.css       layout da página e botões de toque
js/util.js          constantes e utilitários
js/audio.js         efeitos sonoros sintetizados
js/input.js         teclado, toque e mapeamento por jogador
js/draw.js          esqueleto articulado, poses e retratos
js/projectiles.js   projéteis e partículas
js/items.js         bastão, pedra e garrafas
js/characters.js    personagens e golpes especiais
js/fighter.js       máquina de estados do lutador, golpes e dano
js/ai.js            inteligência artificial
js/stages.js        cenários e roteiro do modo história
js/game.js          mundo, colisões, câmera, HUD e modos de jogo
js/menu.js          telas de título, seleção, controles e resultados
js/main.js          laço principal (60 quadros por segundo)
tools/build.mjs     gera dist/mugen-brawl.html em arquivo único
```

Depois de alterar o código, rode `node tools/build.mjs` para atualizar a versão em arquivo único.

### Criar um personagem novo

Adicione uma entrada em `CHARACTERS` (`js/characters.js`) com aparência (`look`), atributos e
especiais. Os golpes usam poses de `POSES` (`js/draw.js`) como quadros-chave, caixas de acerto
(`hit`) e eventos por quadro para criar projéteis (`PROJ` em `js/projectiles.js`).
