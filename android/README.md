# android/

App Android **nativo**: o jogo é o mesmo código Rust do navegador (`rust/`), compilado para `libpunho_livre.so`
e carregado por uma `NativeActivity` (`MainActivity`). Não há WebView: o Rust desenha a tela, toca o
som e lê o toque. O Kotlin só cuida da barra imersiva, dos anúncios (AdMob) e da vibração.
Projeto Gradle com o Android SDK (API 36), o NDK, JDK 17, o Rust com os alvos Android e o `cargo-ndk`.

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android
cargo install cargo-ndk --locked
export ANDROID_NDK_HOME=<pasta do NDK>
./gradlew -p android assembleRelease -PallowTestAds=true   # app-release.apk
./gradlew -p android bundleRelease -PallowTestAds=true     # app-release.aab
```

O Gradle roda `cargo ndk` (tarefa `buildRust`) e empacota as bibliotecas de `app/build/rust-libs/<abi>/`
(arm64-v8a, armeabi-v7a e x86_64). Com `-PrustLibs=<pasta>` ele usa bibliotecas já compiladas e não
roda o cargo. `PUNHO_SERVER` (variável de ambiente, opcional) deixa o servidor de salas já preenchido na
tela de rede, porque no celular não há teclado para digitar o endereço.

## Entrada e tela

- A tela é deitada (`sensorLandscape`). Os controles de toque (direcional, A/J/D, Esc, pausa e os
  golpes especiais) são desenhados pelo próprio jogo (`rust/src/ui/touch/native.rs`) e seguem os
  ajustes de tamanho e opacidade.
- O botão voltar vira tecla: fecha o app na tela inicial e age como Esc nas outras.
- Controle bluetooth/USB e texto na tela de rede ainda não têm entrada nativa no celular.

## Anúncios (AdMob)

- Os IDs de **teste** do Google estão no `app/build.gradle.kts`. Para a release use os reais, por
  variável de ambiente ou `-P`: `ADMOB_ANDROID_APP_ID`, `ADMOB_ANDROID_BANNER_ID` e
  `ADMOB_ANDROID_INTERSTITIAL_ID`. Sem eles, `assembleRelease`/`bundleRelease` param, a menos que se
  passe `-PallowTestAds=true` (só para teste local e CI).
- Banner só nos menus; intersticial a cada 2 lutas, com pelo menos 90 s entre eles. Treino, demonstração
  e rede não mostram intersticial.
- O Rust chama `MainActivity.setBannerVisible` e `MainActivity.onMatchEnd` por JNI (`rust/src/native/android.rs`); as regras do R8 que mantêm esses métodos estão em `proguard-rules.pro`.

## Assinatura

- Sem chave própria, a release sai com a chave de debug (instala, mas não serve para a Play).
- Com a sua chave: `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e
  `ANDROID_KEY_PASSWORD`.

## Estrutura

- `app/src/main/AndroidManifest.xml` e `res/`: pacote `com.conexus.punholivre`, ícones e nome do app
- `app/src/main/java/`: `MainActivity` (`NativeActivity`: barra imersiva, banner, vibração e as chamadas do Rust),
  `AdsBridge` (anúncios), `PunhoLivreApp` (inicialização do AdMob)
- O pacote não pode mudar depois da primeira publicação na Play Store.
