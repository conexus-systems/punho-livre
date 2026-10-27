# Desenvolvimento

## Preparar o ambiente

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.129 --locked   # igual à versão do wasm-bindgen em rust/Cargo.toml
npm install                      # Playwright (para os testes e a arte da loja)
npm install --prefix server      # servidor das salas
npx playwright install chromium  # navegador dos testes
```

Requisitos: Rust (estável) com o alvo `wasm32-unknown-unknown`, Node 22+ (o servidor roda em 18+).
Para o app nativo no computador: as bibliotecas de desenvolvimento do ALSA (`libasound2-dev` no Ubuntu).
Para o Android: Java 17+, o Android SDK (API 36) e o NDK, os alvos Rust do Android e o `cargo-ndk`
(`rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android` e
`cargo install cargo-ndk --locked`).

A versão do `wasm-bindgen-cli` precisa ser **exatamente** a do crate `wasm-bindgen` no
`Cargo.toml` (hoje `=0.2.129`); se mudar uma, mude a outra e a variável `WASM_BINDGEN_VERSION`
dos fluxos em `.github/workflows/`.

## Dia a dia

- `npm run build` compila o Rust (release) e gera `web/pkg/`. `npm run build:dev` é mais rápido
  e sem otimização.
- `npm start` abre o jogo em `http://localhost:8080/`. Com `?dev` no endereço ficam ativas as
  teclas de teste: F2 passo a passo, F6 MP infinito, F7 vida cheia, F8/F9 armas.
- `npm run check` confere o formato (`cargo fmt`), o `clippy` sem avisos, os testes do Rust e a
  sintaxe do JavaScript que sobrou (servidor, testes e ferramentas).
- `npm test` roda todos os testes de navegador (cerca de 1 minuto; precisa do `npm run build`
  antes). Um arquivo só: `node --test tests/specials.test.cjs`.
- Na pasta `rust/`: `cargo test --lib` (unitários) e `cargo fmt` para formatar.

## App nativo no computador

O mesmo jogo roda sem navegador (janela `winit`, desenho `tiny-skia`, som `cpal`):

```bash
cd rust
cargo run --release                      # teclado: as teclas de Controles; --touch usa o mouse como dedo
cargo test --release --test native_headless   # carrega o jogo, desenha o título e uma luta (PUNHO_SHOTS=pasta grava PNGs)
cargo test --release --test native_net        # dois jogos nativos em rede com o servidor Node (precisa de node e npm ci --prefix server)
```

O salvamento fica em `~/.local/share/punho-livre/save.json`. O código específico de cada lado está em
`gfx/`, `audio/`, `net/`, `ui/touch/` e `platform.rs` (ver [Arquitetura](ARQUITETURA.md)); quem mexer no
motor não precisa saber a diferença, mas qualquer coisa nova que fale com o sistema deve ter as duas pontas.

## Criar um lutador

1. Em `rust/src/content/roster.rs`, copie uma entrada de `roster()`: `id` novo, nome, cores,
   `look` (pele, cabelo, roupa, emblema), `stats` e `specials`.
2. Cada especial escolhe um `SpecialType` (`Blast`, `Chase`, `Uppercut`, `Rush`, `Charge`, `Slam`,
   `Teleport`, `Heal`, `Spin` ou `Frost`), com `tag` (a sequência de teclas, ex. `Tag::Fa` =
   Defesa, frente, Ataque), `at` (quadro inicial, a partir de 240), `mp`, `injury` e `label`.
3. `npm test`: o teste de especiais confere se cada golpe sai e gasta MP.
4. Para um tipo de golpe novo, acrescente uma variante em `SpecialType` e um ramo em
   `build_special` (`rust/src/content/moves.rs`) seguindo os existentes:
   `b.chain(primeiro_quadro, lista_de_FrameSpec, último_quadro)`.

## Criar um cenário

Em `rust/src/content/scenes.rs`, acrescente uma entrada em `scene_list()`, um ramo em `layers()`
(camadas desenhadas com `layer(...)`; larguras maiores rolam mais rápido), um ramo em `fronts()`
para o primeiro plano (opcional, passa na frente dos lutadores) e uma cor em `tone()`. Inclua o
novo id em `stages()` (`rust/src/engine/stage.rs`) se quiser usá-lo na História.

## Mexer na jogabilidade

- Regras de round, tempo, K.O. e resumo: `rust/src/engine/match.rs` (`check_gameover`, `end_round`,
  `next_round`).
- Ondas da Sobrevivência: `rust/src/engine/survival.rs` (`wave_size`, `next_wave`, `spawn`).
- Fases da História: `stages()` em `rust/src/engine/stage.rs`.
- Dano, combos e clarão: `hit()` em `rust/src/engine/character.rs`.
- Tudo o que entra na simulação precisa ser determinístico: use `Match::random()`, nunca
  `platform::random` (que é só para efeitos visuais e sorteios de menu). O teste de rede compara os dois aparelhos.

## Gerar o app

```bash
export ANDROID_NDK_HOME=<pasta do NDK>
npm run apk       # dist/punho-livre.apk
npm run aab       # dist/punho-livre.aab
```

As duas compilam o Rust para Android (`cargo ndk`, três ABIs) e usam os IDs de teste do AdMob e a chave de debug. Para publicar, use os
IDs reais (`ADMOB_ANDROID_APP_ID`, `ADMOB_ANDROID_BANNER_ID`, `ADMOB_ANDROID_INTERSTITIAL_ID`) e a sua
chave (`ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`),
e siga
[`store/CHECKLIST.md`](../store/CHECKLIST.md). O pacote Android é `com.conexus.punholivre` e não
pode mudar depois de publicado.

## Publicar uma versão

1. Atualize a versão em `package.json`, `rust/Cargo.toml` e `APP_VERSION` (`rust/src/core/consts.rs`)
   e descreva as mudanças no `CHANGELOG.md`.
2. Abra um pull request e espere a CI ficar verde.
3. Depois do merge, crie e envie a tag: `git tag v3.0.0 && git push origin v3.0.0`. O fluxo
   `Release` roda os testes, gera o APK e o AAB e abre a release no GitHub com os dois arquivos
   e as notas do `CHANGELOG.md`. Para assinar com a sua chave, cadastre os segredos
   `KEYSTORE_BASE64`, `KEYSTORE_PASS` e `KEY_ALIAS`.

## Integração contínua

`.github/workflows/ci.yml` instala Rust, compila o jogo, roda a conferência e os testes em cada
push e pull request, e depois gera o APK e o AAB como artefatos do GitHub Actions.
`.github/workflows/release.yml` publica a release quando uma tag `v*` é enviada.
