# android/

App Android nativo (Kotlin + Gradle). A `MainActivity` abre o jogo (pasta `web/`, copiada para os
assets) numa WebView em tela cheia, deitada, com um banner do AdMob.

```bash
./gradlew assembleDebug                      # APK de teste, com IDs de teste do AdMob
./gradlew bundleRelease -PallowTestAds=true  # AAB sem IDs reais (só teste)
./gradlew bundleRelease                      # AAB de release: exige os IDs reais (abaixo)
```

Variáveis (ambiente ou `-P`): `ADMOB_ANDROID_APP_ID`, `ADMOB_ANDROID_BANNER_ID`,
`ADMOB_ANDROID_INTERSTITIAL_ID`, `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `versionCode`, `versionName`.

- `app/src/main/AndroidManifest.xml`, `res/`: pacote `com.conexus.punholivre`, ícones, nome do app
- `app/src/main/java/`: `MainActivity` (WebView), `AdsBridge` (`window.AndroidAds`: banner só
  nos menus e intersticial a cada 2 lutas, no mínimo 90 s entre eles), `PunhoLivreApp` (SDK do AdMob)
- `local.properties` (não vai para o Git): `sdk.dir=...` com o caminho do Android SDK

O pacote não pode mudar depois da primeira publicação na Play Store.
