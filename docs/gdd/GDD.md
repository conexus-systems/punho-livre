# Documento de design do jogo (GDD)

Nome provisório: **MUGEN Arena** (será trocado; ver [../brand/NOMES.md](../brand/NOMES.md)).
Dono: PO. Frame data e números de balanceamento: designer de combate. Arte: diretor de arte.
Status: proposta para aprovação do dono do projeto.

Neste documento:
- **Existe** = já implementado na engine 0.4.0 (código em `mobile/src/engine/`, ver
  [../UPDATE_0.2.0.md](../UPDATE_0.2.0.md) e [../UPDATE_0.4.0.md](../UPDATE_0.4.0.md)).
- **Muda** = proposta para a versão comercial; precisa de tarefa no [backlog](../backlog/README.md).
- Números marcados como *ponto de partida* são para o designer de combate validar, não valores finais.

## 1. Visão

Um jogo de luta 2D para celular, com cara de fliperama e sotaque latino: lutadores do Brasil e da América
Latina, golpes que dá para fazer no toque e profundidade de verdade para quem quiser se aprofundar. Partidas
curtas, online justo com rollback, e uma loja que só vende o que não dá vantagem.

### Pilares

1. **Responde na hora.** 60 fps, rollback no online, buffer de comandos generoso, impacto que se sente
   (hitstop, câmera, som). Se o toque parecer lento, nada mais importa.
2. **Fácil de começar, difícil de dominar.** Modo simples para quem nunca jogou luta; modo clássico com
   meia-lua, cancelamentos e o sistema completo para quem joga sério. Os dois podem se enfrentar.
3. **Justo.** Ninguém compra vantagem. Todo lutador pode ser conseguido jogando. Anúncio só quando o jogador
   escolhe assistir.
4. **Identidade própria.** Capoeira, muay thai de Fortaleza, vaqueiro do sertão, lucha libre de Guadalajara.
   Cenários, música e falas com sotaque. Nada que lembre personagens de outras empresas.

### Público

| Grupo | Quem é | O que precisa |
|---|---|---|
| Principal | 16–35 anos, joga no celular, cresceu vendo fliperama ou jogos de luta de console, Brasil e América Latina | Partida rápida, controles que funcionam no toque, progresso visível |
| Secundário | Jogador de luta "sério" que quer treinar no celular | Modo clássico, frame data no treino, ranqueada justa, controle físico |
| Terciário | Jogador casual que nunca jogou luta | Tutorial curto, modo simples, arcade com história |

Classificação etária pretendida: 12 anos (violência de luta sem sangue). A confirmar no questionário IARC e
ClassInd.

### Fantasia do jogador

"Eu sou o melhor da minha quebrada, do meu terreiro, da minha academia — e vou provar contra o mundo."
Cada lutador defende algo do lugar de onde veio. O jogador escolhe um, aprende o jeito dele lutar e sente que
ficou melhor de verdade.

## 2. Sistema de luta

### 2.1 Base (existe)

- Engine a 60 ticks por segundo, coordenadas 320×240 do MUGEN, totalmente determinística (`stepWorld`).
- Melhor de 3 rounds, 99 s por round (a confirmar), K.O., tempo esgotado, "PERFECT".
- Defesa segurando para trás (alta) ou para trás e para baixo (baixa). Golpes altos, baixos e
  médios definidos no `HitDef`.
- Golpe de contra-ataque: acertar quem está atacando dá +25% de dano e mais atordoamento ("COUNTER").

### 2.2 Botões (existe)

| Botão | Função |
|---|---|
| A | soco fraco |
| B | chute fraco |
| C | soco forte |
| D | chute forte |

Atalhos: **A+B** rolamento, **C+D** blowback, **A+B+C** modo MAX. O layout de 6 botões do MUGEN continua
disponível para personagens importados.

**Muda:** cada lutador de lançamento terá 14 golpes normais (como hoje), mas o frame data passa a ser
definido pelo designer de combate na ferramenta de frame data, não pelo gerador.

### 2.3 Movimento (existe)

Andar, agachar, pulo normal, **pulo curto** (toque rápido para cima), corrida (→→), recuo (←←).

### 2.4 Barra de power e MAX (existe)

- 3 estoques de 1000 pontos. Enche ao bater, ao apanhar e ao fazer especiais. Passa de um round para o outro.
- Super 1: 1 estoque. Super 2: 2 estoques.
- **MAX** (A+B+C, 1 estoque): 10 s (600 ticks), +20% de dano, a barra não enche durante o MAX.
- **Super turbinado:** super feito no MAX ou com vida ≤ 25% causa +50% de dano ("MAX SUPER").

**Muda (proposta para o designer validar):**
- Rever os +50% do super turbinado; com supers de 2 estoques isso pode decidir rounds sozinho.
- Limitar a 1 super turbinado por MAX.
- Mostrar a barra de MAX como um contador que esvazia, para o jogador saber quanto tempo falta.

### 2.5 Defesa, guard crush e guard cancel (existe)

- Medidor de defesa de 120 pontos; cada golpe defendido gasta um pouco; volta a encher 50 ticks depois da
  última defesa.
- **Guard crush:** medidor zerado quebra a defesa e deixa o lutador aberto.
- **Guard cancel** (1 estoque): A+B ou C+D enquanto defende sai da defesa com rolamento ou blowback.

**Muda:** o medidor de defesa passa a aparecer no HUD (hoje fica escondido) — sem isso o guard crush parece
aleatório.

### 2.6 Rolamento (existe)

A+B: rolamento invencível que atravessa o oponente; com ← rola para trás.

**Muda (proposta):** fim do rolamento vulnerável a arremesso (já é o padrão do gênero) e recuperação maior,
para não virar fuga sem risco. Números com o designer de combate.

### 2.7 Blowback (existe)

C+D no chão e no ar: golpe que derruba e afasta.

### 2.8 Arremesso (existe)

→ ou ← + C ou D colado no oponente. Escape apertando C ou D em até 10 frames. Para trás troca de lado.
Agarrões de comando (especiais) passam pela defesa.

### 2.9 Just Defend (existe)

Apertar para trás até 8 frames antes do golpe: não recebe dano, recupera um pouco de vida e sai antes da
defesa normal.

**Muda (proposta):** no modo simples, o Just Defend continua exigindo o tempo certo (não há ajuda
automática). Efeito visual e sonoro forte para que o jogador perceba que acertou.

### 2.10 O que falta na engine (muda)

| Item | Por quê | Épico |
|---|---|---|
| Hitstop por força do golpe | Impacto | [F1-01](../backlog/F1-01-game-feel.md) |
| Buffer de comandos com janela configurável | Toque é menos preciso que botão físico | [F1-01](../backlog/F1-01-game-feel.md) |
| Câmera com zoom e tremor | Impacto e leitura em tela pequena | [F1-01](../backlog/F1-01-game-feel.md) |
| Juggle points (limite de combo no ar) | Evitar combos infinitos | [F1-02](../backlog/F1-02-sistema-de-combate.md) |
| Escalonamento de dano em combos | Combos longos não podem matar com uma abertura | [F1-02](../backlog/F1-02-sistema-de-combate.md) |
| Sprites HD com eixo e caixas próprios (importador) | Arte final | [F0-04](../backlog/F0-04-ferramentas.md) |
| AfterImage e PalFX | Efeitos de super e de MAX | [F1-01](../backlog/F1-01-game-feel.md) |

## 3. Esquema de controle

Dois modos, escolhidos no primeiro uso e trocáveis em Ajustes. Os dois valem no online e na ranqueada.

### 3.1 Clássico (existe, com ajustes)

- Direcional flutuante à esquerda.
- 4 botões A B C D à direita, mais atalhos A+B, C+D e MAX.
- Especiais e supers por movimento (meia-lua, Z, carga, meia-volta), como em fliperama.
- **Muda:** editor de layout (posição, tamanho e transparência de cada botão), direcional fixo ou flutuante,
  zona morta ajustável.

### 3.2 Simples (muda: novo, a partir dos "botões assistidos" que já existem)

| Botão | Faz |
|---|---|
| Leve | golpe fraco; apertar em sequência faz um combo curto automático (3 golpes) |
| Forte | golpe forte; com → vira blowback |
| Especial | especial do lutador; a direção escolhe qual: neutro, →, ↓, ← |
| Super | aparece quando há estoque; neutro = super 1, ↓ = super 2 |
| Esquiva | rolamento (com ← rola para trás) |

Arremesso: → + Forte colado. Defesa: segurar para trás, como no clássico. MAX: botão próprio.

**Regra de justiça:** especiais e supers feitos com um toque causam menos dano que pelo comando completo
(*ponto de partida*: 20% a menos; o designer de combate define o número final por telemetria). O combo
automático não pode passar do dano de um combo básico do modo clássico.

No online, o oponente vê um ícone com o modo de controle de cada um. Não há fila separada (com poucos jogadores
no soft launch, separar as filas aumentaria a espera); a decisão será revista com dados.

### 3.3 Controle físico

Controles Bluetooth (padrão do sistema) mapeados para A B C D e atalhos. Prioridade baixa: entra na Fase 2 se
o lab de aparelhos tiver os controles.

## 4. Modos de jogo

| Modo | Existe? | O que é | Lançamento |
|---|---|---|---|
| Tutorial | Não | 3 minutos obrigatórios no primeiro uso (andar, defender, golpe, especial, super), depois lições opcionais (Just Defend, guard cancel, MAX, combos) | Sim |
| Treino | Sim (básico) | Hoje: caixas de colisão e barra cheia. **Muda:** frame data na tela, gravar e repetir ações do boneco, exibição de comandos, reset de posição | Sim |
| Arcade | Sim (escada) | **Muda:** história curta por lutador: abertura, rival na 5ª luta, final. 6 lutas. Continue com anúncio recompensado | Sim |
| Versus CPU | Sim | Escolhe lutadores, cenário e dificuldade | Sim |
| Equipes 3×3 | Sim (offline) | Eliminação: quem vence continua com a vida que tinha e recupera 30% do perdido; quem entra ganha 1 estoque | Sim (offline); online na Fase 6 |
| Online casual | Sim (sala com código) | **Muda:** busca rápida sem ranking, além da sala com código para jogar com amigos | Sim |
| Online ranqueado | Sim (Elo) | **Muda:** temporadas, faixas visíveis (ex.: Bronze → Lenda), Elo escondido para o pareamento, punição de quem abandona | Sim |
| Eventos | Não | Regras especiais por fim de semana (só supers, vida baixa, lutador da semana) com recompensas cosméticas | Fase 6 (estrutura na Fase 3) |
| Missões | Não | Diárias e semanais, dão moedas e progresso de passe | Sim |

## 5. Progressão e economia

### 5.1 Progressão

- **Nível de conta:** sobe jogando qualquer modo; dá moedas e ícones. Não dá vantagem.
- **Maestria por lutador:** sobe jogando com o lutador; libera cores, títulos, frases de vitória e a
  ilustração de final do arcade.
- **Ranque:** por temporada, com recompensa cosmética no fim.

### 5.2 Moedas

| Moeda | Como ganha | Para que serve |
|---|---|---|
| **Moedas** (ganhas jogando) | Partidas, missões, arcade, nível de conta, passe | Lutadores, cores, ícones, títulos |

**Recomendação: não ter moeda premium.** Itens pagos aparecem com o preço em reais (ou na moeda local) pela
cobrança da loja. Isso é mais honesto e evita "pacotes" que sobram troco. Se o dono do projeto preferir uma
moeda premium, ela não pode comprar nada que as Moedas não comprem, exceto skins e passe.

### 5.3 O que se vende

| Item | Como funciona |
|---|---|
| Lutador | Os 8 do lançamento: 4 liberados desde o início, 4 liberados jogando o arcade de cada um ou comprados. Lutadores novos (pós-lançamento): comprados com dinheiro **ou** com Moedas (proposta: equivalente a cerca de 10–15 h de jogo normal; estimativa a validar com telemetria). |
| Skin | Roupa alternativa completa. Só dinheiro ou passe. Não muda caixas de colisão nem silhueta de leitura. |
| Cor alternativa | Variação de paleta. Moedas (algumas no passe). |
| Passe de temporada | Trilha grátis e trilha paga, só cosméticos e Moedas. Itens do passe voltam à loja depois. O passe pago dá também as recompensas extras dos anúncios sem precisar assistir. |
| Pacote de apoiador (lançamento) | Skin exclusiva de lançamento + ícone. Sem vantagem. |

Preços: a definir com pesquisa de mercado (nenhum preço foi cotado ou testado).

### 5.4 Anúncios — só com recompensa

**Muda em relação à 0.4.0:** hoje o app mostra banner nos menus e interstitial a cada 2 partidas. Na versão
comercial isso sai. Ficam só anúncios recompensados, sempre por escolha do jogador:

- continuar no arcade depois de perder (existe);
- dobrar as Moedas de uma partida (limite diário, *ponto de partida*: 5 por dia);
- uma troca extra de missão diária por dia.

Nunca durante a luta, nunca no online antes ou depois de uma partida ranqueada, nunca disfarçado de botão
de jogo. Consentimento UMP (e ATT no iOS) antes de anúncio personalizado, como já existe.

O "Premium" atual (remove anúncios) perde sentido; proposta: ele vira o passe pago ou o pacote de apoiador.
Decisão do dono do projeto.

### 5.5 O que NUNCA se vende

- Vida, dano, defesa, velocidade, barra, golpes ou qualquer atributo.
- Lutador que só existe para quem paga (sempre há caminho com Moedas).
- Caixa de recompensa aleatória paga (loot box, gacha) — nem com moeda comprada.
- Energia, vidas ou limite de partidas por dia.
- Pular ranque, proteger pontos de ranque, "revive" no online.
- Vantagem de pareamento (fila prioritária com oponentes mais fracos, por exemplo).
- Dados do jogador.

E também: nada de contador falso de "oferta acaba em", nada de compra sem confirmação, controle parental
respeitado (compras pela loja).

## 6. Meta de conteúdo de lançamento

| Item | Meta |
|---|---|
| Lutadores | 8 completos (ver [ELENCO_LANCAMENTO.md](ELENCO_LANCAMENTO.md)), cada um com 14 normais, 4 especiais, 2 supers, arremesso, sistema SNK, intro, 2 vitórias, derrota |
| Cores | 6 cores por lutador (2 liberadas, 4 por maestria/Moedas) |
| Skins | 1 skin de lançamento por lutador (proposta; depende do custo medido na fatia vertical) |
| Cenários | 5 finais (proposta: Pelourinho, Ruínas da Amazônia, Praia de Fortaleza, Arena de lucha em Guadalajara, Sertão do Cariri). Os 8 atuais viram rascunho. |
| Música | 1 trilha por cenário + menu, seleção, resultado, tutorial (composição original) |
| Voz | Golpes, vitória e derrota por lutador, no idioma de origem do lutador, com legenda |
| História | Arcade de cada lutador: abertura, diálogo com o rival, final ilustrado (3 ilustrações por lutador) |
| Modos | Tutorial, treino, arcade, versus CPU, equipes 3×3, online casual e ranqueado, missões |
| Idiomas | Soft launch: PT-BR e ES-LatAm. Global: + EN |
| Tamanho | Download inicial ≤ 150 MB (meta) |

## 7. Fora do lançamento

- Online em equipes 3×3 (Fase 6).
- Torneios dentro do app.
- Espectador e replays compartilháveis (Fase 6, se o tamanho dos replays permitir).
- Catálogo de personagens MUGEN da comunidade: **proposta de pausar** na versão comercial (decisão do dono do
  projeto). Mistura de arte
  amadora com o elenco final, risco de IP de terceiros e moderação. Pode voltar como "modo laboratório"
  separado, por decisão do dono do projeto.
