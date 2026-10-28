# Ficha da Play Store (pt-BR)

Copie e cole estes textos no Play Console, em *Presença na loja → Ficha principal da loja*.

## Nome do app (máx. 30 caracteres)

```
Punho Livre: Luta 2.5D
```

## Descrição curta (máx. 80 caracteres)

```
Brigue com até 4 amigos: 8 lutadores, rounds, sobrevivência e jogo online.
```

## Descrição completa (máx. 4000 caracteres)

```
PUNHO LIVRE é um jogo de luta 2.5D de ação rápida: ande pelo cenário, pule, defenda, agarre, arremesse e solte golpes especiais contra até 7 adversários ao mesmo tempo.

GRÁTIS, COM ANÚNCIOS, SEM COMPRAS DENTRO DO APP
Baixe e jogue de graça. Há anúncios de banner nos menus e anúncios em tela cheia de vez em quando,
entre algumas lutas. Nada de moedas nem caixas.

8 LUTADORES, CADA UM COM SEU ESTILO
• Brasa: lutador de rua que lança bolas de fogo
• Geada: gelo que congela quem chega perto
• Corvo: ninja que some e reaparece atrás do inimigo
• Titã: grandalhão lento, forte e resistente
• Faísca: o mais rápido, com raios e rajadas
• Jade: mestra de chutes que sabe se curar
• Lua: energia que persegue os adversários
• Bala: boxeador de socos rápidos

MODOS DE JOGO
• Versus: até 8 lutadores, em times ou cada um por si, contra computadores ou amigos. Luta única ou melhor de 3/5 rounds, com tempo por round
• História: 5 fases com bandidos e chefes; cada fase vencida libera a próxima
• Sobrevivência: ondas sem fim de inimigos cada vez mais fortes, com chefes e recorde salvo
• Treino: um boneco que nunca cai e MP infinito para aprender os especiais
• Online: crie uma sala, passe o código de 4 letras e lute com amigos
• Demonstração: assista aos lutadores do computador

FEITO PARA O CELULAR
• Direcional de 8 direções; leve o dedo até a borda para correr
• Botões de golpe especial: um toque faz a sequência inteira
• Tamanho e transparência dos botões ajustáveis
• Funciona offline; até 4 jogadores no mesmo aparelho com teclado externo

COMBOS E MECÂNICAS
Combos com contador de HITS, corrida, rolamento, defesa e quebra de guarda, tontura, agarrão, quedas, fogo, gelo, bolas de energia que podem ser rebatidas e armas para pegar, bater e arremessar. K.O. em câmera lenta e números de dano na tela.

4 dificuldades para o computador, de Fácil a Maluco, e várias arenas: praia, rua da cidade, floresta, templo, porto e dojô.

O jogo não pede cadastro nem login. Os anúncios usam o ID de publicidade do aparelho (você pode redefini-lo nas configurações do Android).
```

## O que há de novo (versão 3.1)

```
• App refeito como aplicativo nativo, mais leve e fluido
• Controles de toque novos: direcional de 8 direções, botões A/J/D e golpes especiais em um toque
• Novo modo Sobrevivência: ondas sem fim, chefes e recorde salvo
• Rounds no Versus: luta única, melhor de 3 ou melhor de 5, com tempo por round
• Abertura de round, K.O. em câmera lenta e contador de combos
• Números de dano, clarão ao apanhar e opção de desligar o tremor de tela
```

## Categoria e etiquetas

- Tipo: **Jogo** · Categoria: **Ação** (ou *Luta*, se aparecer como etiqueta)
- Preço: **grátis** (definido na criação do app; não dá para trocar depois para pago no mesmo pacote)

## Arte (já gerada na pasta store/)

| Item | Arquivo |
|------|---------|
| Ícone 512 × 512 | `icon-512.png` |
| Gráfico de recursos 1024 × 500 | `feature-1024x500.png` |
| Capturas de tela de celular (mín. 2, máx. 8) | `screenshots/` (1920 × 1080) |

Regere com `node tools/store-assets.cjs` depois de qualquer mudança visual.

## Respostas dos formulários da Play Console

- **Anúncios:** sim (Google AdMob: banner nos menus e intersticial entre as lutas).
- **Compras no app:** não tem.
- **Acesso ao app:** todo o conteúdo é acessível sem login.
- **Público-alvo:** 13 anos ou mais (evita as regras de apps para crianças).
- **Classificação de conteúdo (IARC):** violência de desenho animado, sem sangue, sem linguagem
  imprópria, sem jogos de azar, sem compras. Deve resultar em Livre/10 anos na ClassInd, mas
  responda o questionário e use o resultado oficial.
- **Segurança dos dados:** o app não coleta dados próprios; o SDK do AdMob coleta o ID de publicidade e dados técnicos para anúncios. O jogo em rede envia apelido
  e teclas ao servidor de salas só durante a partida, sem gravar; confira se isso se encaixa na
  exceção de "processamento efêmero" da política atual da Play ao responder. Por causa dos
  anúncios, declare também o **ID de publicidade** (coletado pelo SDK do AdMob).
- **Permissões:** INTERNET (jogo em rede e anúncios) e VIBRAR (vibração ao levar dano, com interruptor em Ajustes). O AdMob pode acrescentar ACCESS_NETWORK_STATE e o ID de publicidade (AD_ID); declare o AD_ID no formulário de ID de publicidade.
- **Política de privacidade:** hospede `politica-de-privacidade.html` (por exemplo no GitHub
  Pages) e cole o endereço. Data e e-mail de contato já estão preenchidos.
