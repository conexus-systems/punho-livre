# Mudanças

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Os números de versão
seguem `maior.menor.correção`; o `versionCode` do Android é `maior*10000 + menor*100 + correção`.

## [3.0.0] - 2026-10-22

O jogo foi reescrito em **Rust** e roda como **WebAssembly**, com a mesma cara e as mesmas regras de
antes, mais uma rodada grande de jogabilidade.

### Novo na jogabilidade
- **Abertura de round**: "PREPARAR..." e "LUTEM!" com sino. Ninguém se mexe até a luta começar, e
  quem estava segurando uma direção continua andando quando o round abre.
- **Rounds**: no Versus dá para escolher luta única, melhor de 3 ou melhor de 5. As bolinhas no
  painel mostram os pontos, o empate repete o round e o resumo traz o placar.
- **Tempo por round** (30, 60 ou 90 s) com relógio na tela. Quando zera, vence quem tiver mais vida.
- **K.O. com impacto**: câmera lenta, clarão, tremor, som próprio e faixa "K.O.!". O fim do round
  mostra "VITÓRIA!", "DERROTA" ou "EMPATE".
- **Contador de combo** ("3 HITS!") sobre quem emenda golpes, e o melhor combo entra no resumo.
- **Números de dano** flutuando e clarão branco em quem apanha (azul quando defende).
- **Modo Sobrevivência**: ondas sem fim, cada vez maiores e mais fortes, com chefe a cada 5 ondas,
  cenário novo a cada 3 e recorde salvo. Dá para jogar com até 3 aliados do computador.
- **Reiniciar** no menu de pausa, para repetir a mesma luta sem passar pelos menus.
- **Seleção de lutadores** com barras de vida, força e velocidade.
- Ajustes novos: tremor de tela e números de dano podem ser desligados.
- Como jogar ganhou uma página sobre os modos; Sobre mostra o recorde da Sobrevivência.

### Mudanças técnicas
- Motor, gerador de conteúdo, telas, som, música e jogo em rede reescritos em Rust (`rust/`).
  Continua sem arte nem áudio de terceiros: tudo é gerado por código ao abrir.
- O jogo é compilado com `npm run build` (cargo + wasm-bindgen) e fica em `web/pkg/`.
- O app Android leva o `.wasm` embutido em base64 e continua sem precisar do Android SDK.
- Testes de navegador adaptados à nova interface (`window.PUNHO`), mais testes de jogabilidade
  e testes unitários em Rust. A CI instala Rust e confere formato, clippy e testes.
- O jogo em rede mantém o *lockstep* e a conferência de sincronia; as versões 2.x e 3.0 não
  jogam entre si.
- Fluxo de release: enviar uma tag `vX.Y.Z` gera o APK e o AAB e abre a release no GitHub.

## [2.0.0]

Versão anterior em JavaScript: 8 lutadores, 6 cenários, Versus, História, Treino, Demonstração,
jogo em rede, controles de toque, ajustes, salvamento e pacote para a Play Store.
