# Elenco de lançamento — 8 lutadores

Status: proposta do PO para aprovação do dono do projeto, do diretor de arte e do designer de combate.
Fonte: os 20 lutadores da 0.4.0 em `mobile/scripts/roster/characters.mjs`, que passam a ser rascunho de design.

Notação de comandos (lutador virado para a direita): ↓↘→ = meia-lua para frente; ↓↙← = meia-lua para trás;
→↓↘ = Z; →↘↓↙← = meia-volta; [←]→ = segurar ← e apertar →; [↓]↑ = segurar ↓ e apertar ↑. P = soco (A ou C),
K = chute (B ou D). Super 1 custa 1 estoque; super 2 custa 2 estoques.

No **modo simples** (ver [GDD.md](GDD.md#32-simples-muda-novo-a-partir-dos-botões-assistidos-que-já-existem)),
os 4 especiais de cada lutador ficam em Especial + neutro / → / ↓ / ←, na ordem em que aparecem nas tabelas
abaixo; Super = super 1; ↓ + Super = super 2.

Vida, dano e velocidade finais: designer de combate. A coluna "perfil" é só a intenção.

## 1. Resumo

| # | Lutador | Origem | Arquétipo | Vem de (rascunhos) | Perfil |
|---|---|---|---|---|---|
| 1 | **Kaze** | Registro (SP), nipo-brasileira | Shoto | Kaze | Vida média, velocidade média |
| 2 | **Brasa** | Salvador (BA) | Técnico | Brasa | Vida média-baixa, rápido |
| 3 | **Iara** | Médio Solimões (AM) | Zoner | Iara + Sombra | Vida baixa, lenta de perto |
| 4 | **Lua** | Fortaleza (CE) | Rushdown | Lua + Nadia | Vida média-baixa, muito rápida |
| 5 | **Volt** | Avellaneda (Grande Buenos Aires) | All-rounder | Volt + Zé Pilão | Vida média, velocidade média |
| 6 | **Severino** | Cariri (CE) | Charge | Severino | Vida média-alta, lento |
| 7 | **Kai** | Florianópolis (SC) | Counter | Kai + Akemi | Vida média, velocidade média |
| 8 | **Yaguar** | Guadalajara (México) | Grappler | Jaguara + Titã + Hércules + Bento | Vida alta, muito lenta |

- 4 mulheres e 4 homens.
- 6 do Brasil (5 regiões diferentes), 1 da Argentina e 1 do México — ajuda o soft launch em PT e ES.
- Estilos marciais diferentes entre si: karatê, capoeira, artes de rio inventadas para a Iara, muay thai,
  boxe, luta de vaqueiro com facão e laço, jiu-jitsu, lucha libre.

**Fatia vertical: Kaze e Brasa**, no cenário Pelourinho (ver seção 4).

## 2. Os 8 lutadores

### 2.1 Kaze — shoto

**Quem é:** carateca nipo-brasileira de Registro, no Vale do Ribeira. Treinou no dojô da família e
transforma o vento em golpes. Equilibrada, é a lutadora do tutorial e a referência de balanceamento.

**Plano de jogo:** controla a distância média com o projétil, pune pulos com o golpe ascendente e avança com
o deslocamento. Tem resposta para tudo, nenhuma ferramenta é a melhor do jogo.

| Especial | Comando | O que faz |
|---|---|---|
| Rajada | ↓↘→ + P | Projétil de vento em espiral horizontal (A lento, C rápido) |
| Corte Ascendente | →↓↘ + P | Golpe que sobe, invencível no início com C (anti-aéreo) |
| Passo do Vento | ↓↙← + K | Desliza para frente com chute baixo; D atravessa projéteis |
| Lufada | ↓↓ + P | Rajada curta que não dá dano, mas empurra o oponente e quebra a guarda de projéteis |

| Super | Comando | O que faz |
|---|---|---|
| Tufão | ↓↘→ ↓↘→ + P | Coluna de vento horizontal que atravessa a tela |
| Olho do Furacão | ↓↙← ↓↙← + P | Avança, puxa o oponente para um redemoinho e termina com um golpe para cima |

**Silhueta e visual:** cabelo curto e assimétrico com uma mecha longa e uma faixa de tecido comprida amarrada
no braço da frente, as duas sempre levadas pelo vento — é o que identifica a Kaze de longe. Dogi azul-marinho
sem mangas, com acabamento verde-água; faixa preta gasta. Sem bandana na testa e sem dogi branco.

**Cuidado de IP:** o arquétipo "shoto" é genérico, mas a combinação dogi branco + bandana + projétil de
energia em bola + chute giratório no ar lembra um personagem famoso. Por isso: dogi escuro, sem bandana,
projétil em espiral (não esfera), deslocamento no chão (não giro no ar).

### 2.2 Brasa — técnico

**Quem é:** capoeirista de Salvador, criado na roda do Pelourinho. Ginga sem parar e solta chutes que deixam
rastro de brasa.

**Plano de jogo:** joga com a dúvida. A postura de ginga muda a área do corpo e abre três continuações
(alta, baixa e que passa por cima). Dano baixo por golpe, compensado por mistura de alto e baixo. Difícil de
dominar, muito forte nas mãos de quem domina.

| Especial | Comando | O que faz |
|---|---|---|
| Armada | ↓↘→ + K | Chute giratório que avança; D é mais longo e mais lento |
| Martelo | →↓↘ + K | Chute ascendente (anti-aéreo) |
| Aú Queimado | ↓↙← + K | Estrela que passa por cima de golpes baixos e cai com 3 acertos |
| Ginga | ↓↓ + K | Postura; dela saem: A = Benção (empurrão frontal), B = Rasteira (baixo), D = Queixada (alto que vira lado) |

| Super | Comando | O que faz |
|---|---|---|
| Roda de Fogo | ↓↘→ ↓↘→ + K | Sequência de chutes giratórios em brasa |
| Volta ao Mundo | ↓↙← ↓↙← + K | Ginga invencível que, se for atacada, contra-ataca com uma sequência longa |

**Silhueta e visual:** pernas longas, calça de capoeira branca bem larga embaixo, regata amarela com fitas
do Bonfim amarradas nos pulsos e no tornozelo (as fitas se mexem e marcam os chutes). Corda (cordão) verde
de graduação na cintura. Cabelo em twists curtos. O rastro dos chutes é laranja de brasa, não fogo amarelo.

**Cuidado de IP:** capoeiristas de jogos conhecidos costumam aparecer de peito nu com calça colorida ou em
roupas tribais. Brasa usa regata, calça branca e fitas — mais perto da roda de verdade.

### 2.3 Iara — zoner

**Quem é:** guardiã de um trecho do Solimões, criada por uma comunidade ribeirinha. Luta com a água do rio
como se fosse parte do corpo. (Inspirada na lenda, mas não é a entidade da lenda: é uma pessoa.)

**Plano de jogo:** mantém o oponente longe com projéteis em alturas diferentes e pune quem tenta pular. Fraca
de perto; usa o teleporte para sair do canto.

| Especial | Comando | O que faz |
|---|---|---|
| Onda do Rio | ↓↘→ + P | Onda rasteira (precisa defender baixo) |
| Bolha | ↓↙← + P | Bolha lenta que fica parada no ar por um tempo (A perto, C longe) — veio da Sombra |
| Gota Cortante | ↓↘→ + P no ar | Gota que desce na diagonal |
| Correnteza | ↓↓ + K | Some numa poça e reaparece (B perto, D do outro lado) |

| Super | Comando | O que faz |
|---|---|---|
| Pororoca | ↓↘→ ↓↘→ + P | Onda alta que atravessa a tela |
| Encontro das Águas | ↓↙← ↓↙← + P | Duas ondas de cores diferentes que se cruzam no oponente |

**Silhueta e visual:** cabelo muito longo que vira água nas pontas (silhueta inconfundível). Roupa prática de
ribeirinha (bermuda, top), braçadeiras de sementes, pés descalços. Água em dois tons: escura do Solimões e
clara do Negro.

**Cuidado cultural:** Iara mexe com folclore e com povos da Amazônia. Precisa de consultoria cultural antes
da arte final (tarefa em [F2-01](../backlog/F2-01-producao-elenco.md)). Sem cocar, pinturas sagradas ou
elementos de povos específicos sem orientação.

### 2.4 Lua — rushdown

**Quem é:** lutadora de muay thai de Fortaleza. Aprendeu em academia de bairro e não para de avançar.

**Plano de jogo:** cola e não deixa respirar. Joelhos, cotovelos e clinch. Perde se ficar longe.

| Especial | Comando | O que faz |
|---|---|---|
| Joelhada Voadora | ↓↘→ + K | Salto curto com joelhada; D passa por cima de projéteis baixos |
| Cotovelada | ↓↘→ + P | Avança com cotovelo; C é um golpe por cima (defesa alta) |
| Chute Tesoura | →↓↘ + K | Chute ascendente (anti-aéreo) |
| Clinch | →↘↓↙← + K | Agarrão de comando curto que termina em joelhadas |

| Super | Comando | O que faz |
|---|---|---|
| Tempestade de Joelhos | ↓↘→ ↓↘→ + K | Avanço com sequência de joelhadas |
| Lua Cheia | ↓↙← ↓↙← + K | Chute giratório alto que derruba e quica o oponente |

**Silhueta e visual:** baixa e compacta, guarda alta típica do muay thai. Bermuda de muay thai vermelha com
bordado de jangada, mongkol (tiara de corda) branco e prajied (braçadeira) amarelo. Cabelo longo preso em
trança grossa.

**Cuidado de IP:** já existe lutadora de muay thai famosa de terno e cabelo curto loiro; Lua não usa terno nem
colete e tem cabelo escuro longo em trança.

### 2.5 Volt — all-rounder

**Quem é:** boxeador de Avellaneda, na Grande Buenos Aires. Aprendeu na rua e no clube do bairro; canaliza
eletricidade nos punhos.

**Plano de jogo:** bom em tudo, sem ser o melhor em nada. Avanços rápidos, anti-aéreo confiável, uma faísca
parada que controla espaço.

| Especial | Comando | O que faz |
|---|---|---|
| Direto Relâmpago | ↓↘→ + P | Avanço com direto; C atravessa a tela |
| Gancho Trovão | →↓↘ + P | Gancho ascendente (anti-aéreo) |
| Faísca | ↓↙← + P | Deixa uma faísca parada no ar por 1 s (armadilha) |
| Pêndulo | ↓↓ + P | Esquiva de golpes altos; com A sai com jab, com C sai com cruzado |

| Super | Comando | O que faz |
|---|---|---|
| Tempestade de Socos | ↓↘→ ↓↘→ + P | Avanço com sequência de socos |
| Curto-Circuito | ↓↙← ↓↙← + P | Golpe único carregado; se acertar, descarga elétrica em sequência |

**Silhueta e visual:** ombros largos, luvas grandes com fita isolante, moletom amarrado na cintura, short
de boxe roxo com faixa amarela. Topete curto. Energia amarela.

**Cuidado de IP:** evitar visual de boxeador famoso de jogos (sem luvas azuis com regata, sem cabelo branco
espetado). A origem argentina deve ir nas falas em espanhol e no estilo do bairro, não em estereótipos.

### 2.6 Severino — charge

**Quem é:** vaqueiro do sertão do Cariri. Gibão de couro, facão e laço. Não tem pressa nenhuma.

**Plano de jogo:** defensivo e paciente — segurar para trás carrega os golpes. Pune com o facão, puxa
quem foge com o laço. Lento, mas cada acerto pesa.

| Especial | Comando | O que faz |
|---|---|---|
| Corte Seco | [←] → + P | Lâmina de vento do facão (projétil) |
| Xique-Xique | [↓] ↑ + P | Corte ascendente (anti-aéreo) |
| Laçada | [←] → + K | Laço que puxa o oponente para perto (não dá dano; abre combo) |
| Aboio | [↓] ↑ + K | Grito de vaqueiro: aguenta um golpe sem recuar (super armadura curta) e enche um pouco a barra |

| Super | Comando | O que faz |
|---|---|---|
| Sol do Sertão | [←] → ← → + P | Sequência de cortes com o facão |
| Mandacaru | [↓] ↑ ↓ ↑ + P | Postura: quem atacar é laçado e derrubado (contra-golpe de super) |

**Silhueta e visual:** chapéu de couro com abas largas, gibão de couro com franjas, barba cerrada, facão na
mão da frente e laço enrolado no ombro. A forma do chapéu é a silhueta dele.

**Cuidado de IP:** espadachins de jogos famosos usam espada japonesa e roupa de samurai. Severino usa facão,
gibão e laço, e a lâmina de vento é marrom-poeira, não azul.

### 2.7 Kai — counter

**Quem é:** faixa-preta de jiu-jitsu e surfista de Florianópolis. Espera o oponente errar e leva tudo para o
chão.

**Plano de jogo:** lê o oponente. Dois contra-golpes (alto e baixo) que pegam o golpe e derrubam, mais
quedas. Se o oponente não atacar, Kai tem pouco a fazer de longe: é um lutador de leitura.

| Especial | Comando | O que faz |
|---|---|---|
| Guarda Fechada | ↓↓ + P | Contra-golpe alto: pega golpes altos e médios e derruba |
| Meia-Guarda | ↓↓ + K | Contra-golpe baixo: pega golpes baixos e raspa |
| Baiana | ↓↘→ + K | Queda nas duas pernas: avança baixo e agarra; passa pela defesa, mas perde para pulo e para golpe baixo |
| Kimura Voadora | →↓↘ + P | Agarrão anti-aéreo: pega quem pula |

| Super | Comando | O que faz |
|---|---|---|
| Leitura | ↓↘→ ↓↘→ + P | Contra-golpe de super: pega qualquer golpe (menos arremesso) e finaliza |
| Finalização | →↘↓↙← →↘↓↙← + P | Agarrão de comando de super |

**Silhueta e visual:** rash guard azul-petróleo com estampa de onda, calça de kimono branca, faixa preta, pés
descalços, cabelo comprido descolorido de sol preso em coque baixo. Postura baixa e aberta.

**Nota:** o contra-golpe da Akemi (aikidô) entra aqui; Akemi fica no banco de rascunhos.

### 2.8 Yaguar — grappler

**Quem é:** luchadora mascarada de Guadalajara, a maior lutadora do elenco. Voa das cordas e cai como meteoro.
O nome "Jaguara" foi trocado porque, em algumas regiões do Brasil, "jaguara" é xingamento.

**Plano de jogo:** anda devagar, aguenta muito e precisa chegar perto. Quando chega, o agarrão de comando tira
quase um terço da vida. Ataques aéreos para entrar.

| Especial | Comando | O que faz |
|---|---|---|
| Suplex Jaguar | →↘↓↙← + P | Agarrão de comando (imbloqueável) |
| Plancha | ↓↘→ + K no ar | Mergulha de corpo sobre o oponente |
| Huracán | →↓↘ + K | Agarrão anti-aéreo: pega quem pula e gira no ar |
| Bomba | ↓↙← + P | Avança com super armadura de um golpe e cai sentada |

| Super | Comando | O que faz |
|---|---|---|
| Jaguar Voador | ↓↘→ ↓↘→ + K | Sobe nas cordas (borda da tela) e cai sobre o oponente |
| Pirâmide | →↘↓↙← →↘↓↙← + P | Agarrão de comando de super com sequência de quedas |

**Silhueta e visual:** grande e larga, máscara verde com padrão de pintas de onça em dourado, capa curta,
collant verde com cinto de campeã, botas altas. Silhueta: ombros enormes e capa.

**Cuidado de IP:** evitar motivos de pássaro, grifo ou dinossauro (lembram luchadores de outros jogos) e o
visual de lutadora de luta livre com maiô colorido e cabelo loiro.

## 3. O que acontece com os 20 rascunhos

| Rascunho | Destino | Motivo |
|---|---|---|
| kaze | Kaze (redesenho; vira mulher) | Shoto do tutorial; afastar do visual clássico de shoto |
| brasa | Brasa | Identidade do jogo |
| iara | Iara | Zoner com identidade amazônica |
| sombra | Fundido na Iara (bolha lenta) | Dois zoners não cabem em 8 |
| lua | Lua | Rushdown |
| nadia | Fundida na Lua (variedade de chutes) / banco | Duas lutadoras de chute rápido |
| volt | Volt (muda para Avellaneda) | All-rounder; segunda origem latina |
| ze | Fundido no Volt (atitude de rua) / banco | Brigão de rua repete o papel do Volt |
| severino | Severino (vira charge) | Identidade nordestina |
| kai | Kai (vira counter) | Contra-golpe brasileiro |
| akemi | Fundida no Kai / banco | Dois counters não cabem |
| jaguara | Yaguar (renomeada, vira mulher) | Grappler; terceira origem |
| tita, hercules, bento | Fundidos na Yaguar / banco | Quatro grapplers no rascunho; um basta |
| yuki | Banco (pós-lançamento, com redesenho) | Ninja de gelo; precisa se afastar de ninjas conhecidas |
| kenshi | Banco com alto risco de IP | Samurai errante lembra séries de espada conhecidas; só volta muito redesenhado |
| icaro | Banco com redesenho | Taekwondo com chute de carga para cima + mergulho lembra um lutador de taekwondo famoso |
| mei | Descartada | Kung fu feminina com golpes de carga e chute giratório lembra uma personagem muito conhecida |
| tetsu | Banco | Lutador de bastão; segunda arma depois do facão |

O banco alimenta a Fase 6 (um lutador novo por temporada).

## 4. Fatia vertical: Kaze e Brasa

**Por que Kaze:**
- é a base do tutorial e do balanceamento — todo o resto é medido contra ela;
- tem os elementos mais comuns do gênero (projétil, anti-aéreo, deslocamento), então testa a maior parte do
  sistema e das ferramentas;
- é a lutadora mais simples de animar: mede o custo "mínimo" de um lutador.

**Por que Brasa:**
- é a cara do jogo — o que aparece no ícone, no trailer e na loja;
- capoeira é a animação mais difícil do elenco (ginga contínua, estrela, chutes giratórios, fitas soltas):
  se o estilo de arte escolhido aguentar a Brasa, aguenta todo mundo;
- mede o custo "máximo" de um lutador;
- a postura de ginga testa um mecanismo novo (estado com continuações) na ferramenta de frame data.

**Cenário:** Pelourinho, a casa da Brasa; já existe como rascunho procedural.

**O que fica de fora da fatia e precisa ser coberto logo no início da Fase 2:** um lutador grande (Yaguar)
para medir memória de textura e escala de sprite, e agarrões de comando com animação do oponente
(`p2stateno`/ChangeAnim2). Arremessos normais entram na fatia (todos têm).

## 5. Checklist de IP para cada lutador (diretor de arte + jurídico)

- [ ] Silhueta comparada lado a lado com personagens de jogos de luta conhecidos do mesmo arte marcial.
- [ ] Roupa, cores principais e penteado não repetem a combinação de nenhum personagem conhecido.
- [ ] Nomes de golpes não traduzem nem imitam nomes de golpes conhecidos.
- [ ] Poses de vitória e intro originais.
- [ ] Revisão cultural quando o lutador representa um povo, uma religião ou uma tradição.
