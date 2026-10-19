# Design system W10M — BAMBA (0.1.0)

Mesmo design system do **conexus-launcher** (`docs/W10M_DESIGN_SYSTEM.md` lá) e do **multi-miner**, inspirado no
Windows 10 Mobile, portado de Kotlin/Android Views para **React Native** porque o jogo é Expo (Android + iOS).
Tokens em `mobile/src/ui/`, componentes em `mobile/components/metro/`. Nenhuma tela define cor, tamanho de
fonte, raio ou duração própria.

Regras (iguais às do launcher):

- **Plano e quadrado.** Sem cantos arredondados, cápsulas, sombras ou gradientes. Círculos só onde o original
  tem: bolinha e trilho do interruptor e o botão de opção (rádio).
- **Tipografia faz a hierarquia.** Títulos grandes, leves e à esquerda; seminegrito só no rótulo em
  maiúsculas acima do título.
- **Destaque com função.** Seleção, links, controles ativos, foco, indicador do pivô, cabeçalho de grupo e os
  blocos do Iniciar. Ícones e textos comuns são monocromáticos.
- **Listas, não cartões.** Linhas sobre a própria página.
- **Movimento curto.** Até 400 ms, desacelerado, desligável.
- **Exceção do jogo:** o canvas da luta (cenários, sprites, HUD, faíscas) é arte do jogo e não segue estas
  regras; os controles touch e os painéis sobre a luta seguem.

## 1. Tokens

| Arquivo (RN) | Equivale a (launcher) | O que define |
|---|---|---|
| `src/ui/theme.ts` | `ui/Theme.kt`, `ui/Conexus.kt` | escuro/claro, paletas, destaque (`accent` para blocos, `accentText` para texto), espaçamento (grade de 8), alvo 48 dp, persistência |
| `src/ui/accent.ts` | `ui/Accent.kt` | 20 cores (10 essenciais + 10 extras), `#RRGGBB` personalizada, contraste WCAG (`forWhiteText`, `forBackground`, `contrast`) |
| `src/ui/type.ts` | `ui/Type.kt` | escala tipográfica |
| `src/ui/motion.ts` | `ui/Motion.kt` | durações, curva, entrada de página, deslize do pivô, empurrão de toque |
| `src/ui/formats.ts` | `ui/Formats.kt` | números, %, bytes, contagens e tempo relativo em pt-BR |
| `src/ui/rules.ts` | `ui/metro/MetroRules.kt` | regras puras testadas: estados, pivô circular, destrutivos, ordem dos botões, validação |
| `src/ui/tiles.ts` | `tiles/TileModel.kt`, `TilePacking.kt` | tamanhos de bloco e empacotamento |
| `src/ui/glyphs.tsx` | `Glyphs` | catálogo único de ícones (traço 1,7, grade de 24) |

### Paletas

| Token | Escuro | Claro |
|---|---|---|
| `bg` | `#000000` | `#FFFFFF` |
| `text` | `#FFFFFF` | `#000000` |
| `muted` | `#CCCCCC` | `#505050` |
| `chrome` (barras, menus, diálogos) | `#1A1A1A` | `#F2F2F2` |
| `surface` (botão secundário, trilho) | `#2B2B2B` | `#E6E6E6` |
| `edge` (divisória) | branco 20% | preto 20% |
| `disabled` | branco 40% | preto 40% |

Destaque padrão do jogo: **Vermelho `#E51400`**. Bloco: escurecido até o texto branco passar de 4,5:1. Texto e
linhas: ajustado ao fundo até 4,5:1. Testado para as 20 cores nos dois fundos (`src/ui/__tests__`).

### Tipografia (`TYPE`)

| Estilo | sp | Peso | Uso |
|---|---|---|---|
| `DISPLAY` | 64 | leve | código da sala |
| `HEADER` | 34 | leve | título da página, título dos painéis da luta |
| `TITLE` | 28 | leve | itens do pivô, nome do lutador, rating |
| `SUBTITLE` | 20 | regular | título de diálogo, estado vazio |
| `GROUP` | 16 | regular | cabeçalho de grupo (destaque) |
| `BODY` | 15 | regular | linhas, botões, campos |
| `CAPTION` | 12 | regular | segunda linha, ajuda, nome nos blocos |
| `KICKER` | 12 | seminegrito, maiúsculas | "BAMBA" acima do título |

Fonte do sistema (a Segoe UI é licenciada e não vai no app).

### Movimento

`QUICK_MS` 100 (toque), `FAST_MS` 167 (pivô, menu), `PAGE_MS` 250 (página), `FLIP_MS` 400 (flip dos blocos).
Desliga com Ajustes › Personalização › Animações ou com "Reduzir movimento" do sistema; "Velocidade"
(lenta/normal/rápida) escala tudo.

## 2. Componentes (`components/metro/`)

| Componente | O que é | Acessibilidade |
|---|---|---|
| `MetroPage` | página do tema, entra subindo | área segura |
| `MetroHeader` | kicker em maiúsculas + título grande e leve + ações | título é cabeçalho |
| `MetroPivot` | seções grandes; ativa com barra de 2 dp no destaque; toque ou deslize; dá a volta | "Ranking, aba 2 de 3, selecionada" |
| `MetroButton` | `primary`, `secondary`, `danger`, `text`; carregando (pontos); rótulos destrutivos viram `danger` | botão/link, ocupado |
| `MetroToggle` | nome, descrição, trilho 44×20 com bolinha, "Ativado/Desativado" | interruptor |
| `MetroCheck` | caixa quadrada (✓ no destaque) ou rádio (`kind="radio"`) | caixa/rádio, marcada |
| `MetroTextField` | rótulo acima, caixa quadrada 2 dp; em foco branca com borda no destaque; ajuda/erro | erro como região viva |
| `MetroSlider` | trilho 2 dp, polegar 8×24 | ajustável (incrementar/decrementar) |
| `MetroProgress` | 5 pontos correndo ou barra de 4 dp | barra de progresso |
| `MetroRow`, `MetroGroup`, `MetroDivider`, `MetroEmpty` | linhas sem cartão, seleção com barra de 4 dp, menu no toque longo; estado vazio com ação real | toque longo também como ação do leitor |
| `MetroMenu` | menu de contexto plano com borda de 1 dp, itens de 48 dp | painel "Menu" |
| `MetroDialog` | em paisagem/tablet 480 dp no centro; no telefone em pé, largura total no topo; fundo 60%; botões primário/secundário/fechar | modal, título é cabeçalho |
| `LiveTile` | bloco plano no destaque, ícone ao centro, nome embaixo, flip vivo opcional; pequeno mostra só o ícone | botão com o nome do bloco |

## 3. Telas

| Tela | Arquivo | W10M usado |
|---|---|---|
| Iniciar | `app/index.tsx` | `LiveTile` (Arcade largo com lutador vivo, Online com rating, Personagens com elenco), `pack` |
| Seleção | `app/select.tsx` | `MetroHeader`, grade quadrada, links de cenário, `MetroButton` |
| Online | `app/online.tsx` | `MetroPivot` (ranqueada / sala), `MetroTextField`, `MetroProgress`, `MetroEmpty` |
| Personagens | `app/roster.tsx` | `MetroPivot` (catálogo / instalados / enviar ou revisão), `MetroRow`, `MetroMenu`, `MetroDialog` |
| Perfil | `app/profile.tsx` | `MetroPivot` (conta / ranking / partidas), `MetroTextField` com validação, `MetroDialog` |
| Ajustes | `app/settings.tsx` | `MetroToggle`, `MetroSlider`, rádios, 20 cores + personalizada, tema, movimento; grupo Controles (modo simples/clássico, direcional, zona morta, vibração em acertos) |
| Luta | `app/fight.tsx`, `components/TouchControls.tsx` | painéis de pausa/resultado no padrão `MetroDialog`; botões quadrados, destaque só no ativo |
| Editor de controles | `app/controls.tsx` | painel `chrome` com abas (alvo 48 dp), `MetroSlider` (tamanho, opacidade), `MetroButton`; botões editáveis quadrados com ações de acessibilidade (ver `docs/CONTROLS.md`) |

## 4. Verificação

- `src/ui/__tests__/ui-rules.test.ts`: contraste das 20 cores, regras, empacotamento, formatos.
- `tests/__tests__/screens.test.tsx`: todas as telas montam, pivô troca e anuncia, diálogo ordena botões,
  tema claro e cor personalizada.
- `npm run preview:web`: exporta o app para web, abre no Chromium e captura as telas e uma luta ao vivo
  (`docs/screenshots/w10m-*.png`). No web o HUD fica sem texto. (Não há mais tela de Premium nem banner: o jogo é pago.)
- Pendente: verificação visual em aparelho/emulador (este ambiente não tem Android SDK nem Xcode).
