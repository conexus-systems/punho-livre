# Controles — modo simples, clássico, layout, vibração e controle físico

Controle touch é o maior risco de retenção do jogo. Este documento descreve o esquema próprio para celular,
as regras de justiça no online e o que está pendente. Código:

| Arquivo | O quê |
|---|---|
| `mobile/src/game/simpleMode.ts` | kit do modo simples por personagem (derivado do `.cmd`) e `SimpleController` (toque → entradas normais) |
| `mobile/src/game/dpad.ts` | direcional de 8 direções com zona morta e histerese (app e web) |
| `mobile/src/game/controlLayout.ts` | botões de cada esquema, layout padrão, validação e ajustes de controle |
| `mobile/src/game/feedback.ts` | qual vibração tocar a partir dos eventos da luta |
| `mobile/src/game/gamepad.ts` | Gamepad API (versão web), mapeamento standard |
| `mobile/components/TouchControls.tsx` | overlay multitoque da luta |
| `mobile/app/controls.tsx` | editor de layout (Ajustes › Controles › Editar layout) |
| `mobile/play/main.ts`, `play/index.html` | versão web: modo simples/clássico, ajuda, touch e gamepad |
| `mobile/src/game/__tests__/controls.test.ts` | testes (abaixo) |

## 1. Modo simples

Direcional + 4 botões: **Soco**, **Chute**, **Especial**, **Super**.

| Toque | Resultado |
|---|---|
| Especial | especial "neutro" (em geral o antiaéreo, ex.: shoryuken) |
| frente + Especial | especial de meia-lua para frente (em geral o projétil) |
| trás + Especial | especial de meia-lua para trás |
| baixo + Especial | especial baixo-baixo |
| Especial no ar | especiais aéreos do personagem (`statetype = A`), pelas mesmas direções |
| Super (1 estoque) | super |
| baixo + Super (2 estoques) | super 2 |
| Soco, Soco, Soco… | auto-combo curto do personagem (abaixo) |
| direção + Soco | o A de sempre (soco fraco agachado, andando…) |
| Chute | D (chute forte); frente/trás + Chute colado = arremesso, como no clássico |
| MAX | botão de um toque (A+B+C), igual ao clássico |

O botão Super só aparece aceso com barra. Vaga de direção sem especial cai no neutro.

### Como vira entrada normal (determinismo e online)

O modo simples **não muda a engine**. `SimpleController.step(bitsCrus, contexto)` roda fora do `stepWorld`,
quadro a quadro, e devolve os mesmos bits U/D/L/R + botões que um jogador no clássico produziria (macros
geradas a partir do próprio comando do `.cmd`, como `src/game/macros.ts` já fazia para os atalhos). Os botões
virtuais do modo simples usam bits ≥ `1 << 16` e nunca chegam na engine nem na rede; o protocolo
(`docs/PROTOCOL.md`) continua o mesmo. Consequências:

- mesma sequência de bits ⇒ mesmo resultado em qualquer aparelho (teste "é determinístico" + os testes de
  determinismo/rollback/fuzz da engine, que não mudaram);
- no online, o oponente recebe entradas comuns; o rollback reexecuta essas entradas, nunca o controlador.
  O controlador lê o estado do próprio lutador (lado, barra, se o golpe encostou) do mundo local — como a
  IA e como um humano reage ao que vê — e isso não precisa ser reproduzido do outro lado.

### Kit derivado do personagem

Nada é escrito à mão por personagem. Para nativos, a lista de especiais/supers vem do `meta.json`; para
MUGEN importados, dos comandos de movimento do `.cmd`. Depois:

1. **Direção de cada especial** pela forma do comando: `D, D` → baixo; começa em `F` e passa por `D`
   (shoryuken) → neutro; termina em frente → frente; termina em trás → trás. Conflitos vão para a vaga livre.
2. **O golpe sai mesmo?** A macro do comando é reconhecida contra **todos** os comandos do personagem e os
   gatilhos do `[Statedef -1]` são avaliados (contexto falso, só leitura) para ver qual estado venceria. Golpe
   engolido por outro fica fora do kit em vez de soltar o golpe errado. Achado: **Titã (Abraço de Titã),
   Lua (Clinch) e Zé (Gravata)** têm a meia-volta (`hcf`) listada depois da meia-lua (`qcf`) do mesmo botão no
   `.cmd` gerado, então esses golpes não saem nem no clássico nem pelos atalhos de um toque. A correção é no
   gerador do elenco (`scripts/roster`, ordem dos `[State -1]`), não aqui.
3. **Auto-combo**: soco fraco → ligações em pé que o `[Statedef -1]` permite cancelar com o golpe encostando
   (`stateno = … && movecontact`) → especial que cancela o último normal. Cada acerto empurra o oponente; por
   isso a próxima ligação só entra se alcançar **mais longe** que a anterior (ponta das caixas Clsn1 da
   animação), e o especial final prefere projétil, depois o de maior alcance. Exemplo: Kaze = soco fraco →
   chute médio → Kaze Ha. Toques adiantados ficam guardados (até 18 quadros) e o botão final do passo cai
   depois do congelamento do impacto, para o cancel não se perder.

### Dano no modo simples: sem redução (decisão)

**Decisão: golpes feitos no modo simples causam o mesmo dano.** Motivos:

- A engine recebe entradas idênticas às do clássico; marcar "isto veio do modo simples" exigiria um bit novo
  no protocolo e na engine, quebrando a regra de que a entrada é só U/D/L/R + botões. Um bit assim também
  seria trivial de falsificar num cliente modificado.
- O modo simples já paga um custo natural: a macro leva ~8–12 quadros (meia-lua completa), não escolhe a força
  do golpe (sempre a primeira variante do comando), o auto-combo é fixo e não otimizado, e não há
  carga/negativo-edge ou cancels personalizados.
- Redução de dano escondida pune quem mais precisa do modo (iniciantes) sem resolver a diferença real, que é
  de tempo de execução.

### Regra do ranqueado

- **Ranqueado e salas aceitam os dois modos**, com as mesmas regras de dano. O servidor é relay e não
  sabe — nem precisa saber — o modo.
- Botões de um toque (assistidos) continuam no clássico; o modo simples os substitui pelo botão Especial.
- **Pendente (proposta)**: mostrar no lobby/fim de partida o modo de cada jogador (campo opcional no
  `queue`/`report` do `docs/PROTOCOL.md`, só informativo) e, se a telemetria mostrar vantagem do modo simples
  no ranqueado, criar fila separada em vez de mexer no dano. Nada disso está implementado.

## 2. Modo clássico

Mantém os 4 botões SNK (A B C D + A+B e C+D) ou os 6 do MUGEN, com os atalhos de um toque opcionais. Melhorias:

- **Direcional flutuante** (aparece onde o polegar toca na metade esquerda; a base acompanha o dedo depois
  de 60 dp) **ou fixo** (no lugar do layout). Ajustes › Controles › Direcional.
- **Zona morta** ajustável (6–40 dp, padrão 14) com histerese radial: liga na zona morta, solta abaixo de 70%.
- **8 direções com histerese angular** de 10°: a direção atual só muda quando o polegar passa 10° além da
  fronteira de 22,5° do setor. Uma diagonal (baixo-frente para defender baixo ou fazer meia-lua) não
  "escorrega" para frente/baixo com o polegar tremendo na fronteira.
- Folga de 15% em volta de cada botão.

## 3. Editor de layout

Ajustes › Controles › **Editar layout** (`app/controls.tsx`):

- abas para os três esquemas (clássico 4 botões, clássico 6 botões, simples);
- arrastar cada botão e o direcional fixo; tamanho do selecionado (48–140 dp — nunca abaixo do alvo de 48 dp);
- opacidade de todos os controles (20–100%);
- **Restaurar padrão** (do esquema aberto), **Salvar**, Cancelar; painel recolhível para alcançar o que fica
  embaixo dele;
- acessibilidade: cada botão é "ajustável" com ações aumentar/diminuir e mover para os lados, e o rótulo diz o
  tamanho ("Soco, 76 dp"); abas com função de aba e alvo de 48 dp; tokens W10M no painel.

Posições são salvas em fração da tela (o mesmo layout serve em celulares de proporções diferentes) e tamanhos
em dp, dentro de `settings.controls` (AsyncStorage `mugen-arena.settings`). Layout salvo antigo/corrompido é
validado: ids desconhecidos saem, faltantes voltam ao padrão, números fora da faixa são presos.

Instalação nova começa no **modo simples**; quem já tinha ajustes salvos antes desta versão continua no
**clássico** (não mudamos o controle de quem já joga).

## 4. Vibração

- "Vibração nos botões" (já existia): toque leve ao apertar.
- "Vibração em acertos" (nova, `expo-haptics` ~58.0.7, já instalado): médio ao acertar, forte ao apanhar,
  leve ao defender (inclui Just Defend e guard crush); no máximo uma a cada 70 ms para combos não virarem um
  zumbido. Lê só os eventos do quadro (`w.events`), fora da engine.

## 5. Controle físico

**Versão web (`play/`)**: Gamepad API, mapeamento `standard` (Xbox, PlayStation, 8BitDo e afins em modo
X-input), lido a cada quadro; o primeiro controle conectado vale para o P1.

| Botão | Clássico | Simples |
|---|---|---|
| X / □ (esquerda) | A | Soco |
| A / ✕ (baixo) | B | Chute |
| Y / △ (cima) | C | Especial |
| B / ○ (direita) | D | Super |
| LB / L1 | A+B (rolamento) | A+B |
| RB / R1 | C+D (blowback) | C+D |
| LT / L2 | A+B+C (MAX) | A+B+C |
| direcional / analógico esquerdo | direções (analógico com zona morta 0,35 e a mesma histerese) | direções |
| Start | pausa | pausa |
| Back / Select | troca simples ↔ clássico | troca |

O nome do controle aparece abaixo do botão "modo" na luta.

**App nativo (Android/iOS): não há suporte a controle físico.** O que falta, sem inventar:

- O React Native não expõe eventos de gamepad. Android entrega `KeyEvent`/`MotionEvent` de controle à
  Activity; iOS usa o framework GameController (`GCController`). Nenhum módulo do projeto lê isso hoje.
- Precisa de um módulo nativo (Expo Module próprio ou biblioteca mantida compatível com o SDK 58 e a Nova
  Arquitetura) que publique botões/eixos para o JS a cada quadro; depois basta reutilizar
  `GamepadReader.bits()` (mesmo mapeamento acima).
- Teclado Bluetooth também não é lido no app.

## 6. Versão web

- Botão **"modo: simples/clássico"** na luta e tecla **T** alternam (salvo no `localStorage`).
- Botão **"?"** e tecla **H** abrem a ajuda (pausa a luta enquanto aberta), com a tabela do modo simples do
  lutador em campo (especiais por direção, supers e o auto-combo).
- Teclado no modo simples: U soco, J chute, I especial, K super (O, L, M continuam como atalhos).
- Touch no modo simples: Especial e Super em cima, Chute e Soco (maior) embaixo; direcional com a mesma
  zona morta/histerese do app.

## 7. Verificação

- `src/game/__tests__/controls.test.ts` (jest): kit de Kaze, Brasa e Sombra; golpe engolido da Titã fica de
  fora; especiais aéreos da Yuki; para **Kaze, Titã e Brasa**, olhando para os dois lados, Especial + cada
  direção é reconhecido pelo `matchCommand` do `.cmd` **e** faz o lutador entrar no estado do especial numa
  luta real; super só com barra e super 2 com baixo + 2 estoques; auto-combo completo, em ordem, cancelando
  (sem voltar ao neutro) e acertando todos os golpes; checksum igual em duas execuções; histerese do
  direcional (com o contraexemplo sem histerese); persistência do layout (salva, "reabre" o app e recarrega);
  migração de quem já tinha ajustes; vibração; mapeamento do gamepad.
- `tests/__tests__/screens.test.tsx`: controles do modo simples (rótulos, Super desabilitado sem barra) e o
  editor (redimensiona pela ação de acessibilidade, salva, restaura, abas ≥ 48 dp).
- Playwright (Chromium) na versão web e no export web do app: `docs/screenshots/controles-*.png`.
- **Pendente**: teste em aparelho real (Android/iOS) — sensação do direcional, tamanho dos alvos, vibração
  (o export web não vibra) e latência das macros com toque de verdade. No export web do app, arrastar no
  editor funciona com toque; com mouse o arrasto do react-native-web para depois do primeiro movimento
  (não afeta o app, que é touch).
