# Ficha da Play Store (pt-BR)

Copie e cole estes textos no Play Console, em *Presença na loja → Ficha principal da loja*.

## Nome do app (máx. 30 caracteres)

```
Punho Livre: Luta 2.5D
```

## Descrição curta (máx. 80 caracteres)

```
Brigue com até 4 amigos: 8 lutadores, rounds, sobrevivência, online e controle.
```

## Descrição completa (máx. 4000 caracteres)

```
PUNHO LIVRE é um jogo de luta 2.5D de ação rápida: ande pelo cenário, pule, defenda, agarre, arremesse e solte golpes especiais contra até 7 adversários ao mesmo tempo.

SEM ANÚNCIOS, SEM COMPRAS DENTRO DO APP
Você paga uma vez e tem o jogo completo. Nada de moedas, caixas ou propagandas.

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
• Funciona offline e também com controle bluetooth (até 4 jogadores no mesmo aparelho)

COMBOS E MECÂNICAS
Combos com contador de HITS, corrida, rolamento, defesa e quebra de guarda, tontura, agarrão, quedas, fogo, gelo, bolas de energia que podem ser rebatidas e armas para pegar, bater e arremessar. K.O. em câmera lenta e números de dano na tela.

4 dificuldades para o computador, de Fácil a Maluco, e várias arenas: praia, rua da cidade, floresta, templo, porto e dojô.

O app não coleta dados pessoais.
```

## O que há de novo (versão 3.0)

```
• Novo modo Sobrevivência: ondas sem fim, chefes e recorde salvo
• Rounds no Versus: luta única, melhor de 3 ou melhor de 5, com tempo por round
• Abertura de round, K.O. em câmera lenta e contador de combos
• Números de dano, clarão ao apanhar e opção de desligar o tremor de tela
• Reiniciar a luta pelo menu de pausa
• Tela de escolha com barras de vida, força e velocidade
• Jogo reescrito do zero em Rust, mais rápido e estável
```

## Categoria e etiquetas

- Tipo: **Jogo** · Categoria: **Ação** (ou *Luta*, se aparecer como etiqueta)
- Preço: **R$ 19,99** (aplicado em *Monetizar → Preço do app*; a Play converte para os outros países e você pode ajustar por país)

## Arte (já gerada na pasta store/)

| Item | Arquivo |
|------|---------|
| Ícone 512 × 512 | `icon-512.png` |
| Gráfico de recursos 1024 × 500 | `feature-1024x500.png` |
| Capturas de tela de celular (mín. 2, máx. 8) | `screenshots/` (1920 × 1080) |

Regere com `node tools/store-assets.cjs` depois de qualquer mudança visual.

## Respostas dos formulários da Play Console

- **Anúncios:** não tem.
- **Compras no app:** não tem (app pago).
- **Acesso ao app:** todo o conteúdo é acessível sem login.
- **Público-alvo:** 13 anos ou mais (evita as regras de apps para crianças).
- **Classificação de conteúdo (IARC):** violência de desenho animado, sem sangue, sem linguagem
  imprópria, sem jogos de azar, sem compras. Deve resultar em Livre/10 anos na ClassInd, mas
  responda o questionário e use o resultado oficial.
- **Segurança dos dados:** o app não coleta nem compartilha dados. O jogo em rede envia apelido
  e teclas ao servidor de salas só durante a partida, sem gravar; confira se isso se encaixa na
  exceção de "processamento efêmero" da política atual da Play ao responder.
- **Permissões:** apenas INTERNET (jogo em rede).
- **Política de privacidade:** hospede `politica-de-privacidade.html` (por exemplo no GitHub
  Pages) e cole o endereço. Troque [DATA] e [E-MAIL DE CONTATO] antes.
