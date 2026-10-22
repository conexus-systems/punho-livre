# android/

App Android: uma `MainActivity` que abre o jogo numa WebView em tela cheia, deitada, com um banner
do AdMob embaixo nos menus. Projeto Gradle (Kotlin) com o Android SDK (API 36) e JDK 17.

```bash
./gradlew -p android assembleRelease -PallowTestAds=true   # app-release.apk
./gradlew -p android bundleRelease -PallowTestAds=true     # app-release.aab
```

O build copia `web/` para os assets do app (sem o `pkg/punho_bg.wasm`, porque o app usa o
`pkg/punho_wasm.js`, com o mesmo `.wasm` em base64). Rode `npm run build` antes.

## Anúncios (AdMob)

- Os IDs de **teste** do Google estão no `app/build.gradle.kts`. Para a release use os reais, por
  variável de ambiente ou `-P`: `ADMOB_ANDROID_APP_ID`, `ADMOB_ANDROID_BANNER_ID` e
  `ADMOB_ANDROID_INTERSTITIAL_ID`. Sem eles, `assembleRelease`/`bundleRelease` param, a menos que se
  passe `-PallowTestAds=true` (só para teste local e CI).
- Banner só nos menus; intersticial a cada 2 lutas, com pelo menos 90 s entre eles. Treino, demonstração
  e rede não mostram intersticial.
- A ponte com o jogo é `window.AndroidAds` (`rust/src/ui/ads.rs`): `setBannerVisible` e `onMatchEnd`.

## Assinatura

- Sem chave própria, a release sai com a chave de debug (instala, mas não serve para a Play).
- Com a sua chave: `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e
  `ANDROID_KEY_PASSWORD`.

## Estrutura

- `app/src/main/AndroidManifest.xml` e `res/`: pacote `com.conexus.punholivre`, ícones e nome do app
- `app/src/main/java/`: `MainActivity` (WebView e ponte de voltar/sair), `AdsBridge` (anúncios),
  `PunhoLivreApp` (inicialização do AdMob)
- O pacote não pode mudar depois da primeira publicação na Play Store.
