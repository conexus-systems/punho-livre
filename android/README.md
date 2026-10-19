# android/

App Android: uma `MainActivity` (em smali) que abre o jogo numa WebView em tela cheia, deitada.

```bash
FORMAT=apk ./build.sh    # dist/punho-livre.apk
FORMAT=aab ./build.sh    # dist/punho-livre.aab
```

Variáveis: `FORMAT` (apk, aab ou both), `TARGET_SDK` (36), `VERSION_CODE`, `VERSION_NAME`,
`KEYSTORE`/`KEYSTORE_PASS`/`KEY_ALIAS` para a sua chave, `OUT` para o caminho de saída.

- `AndroidManifest.xml`, `res/`: pacote `com.conexus.punholivre`, ícones, nome do app
- `smali/`: `MainActivity` e o callback do botão voltar (Android 13+)
- `tools/`: `Sign.java` (assinatura v2), `package.py` (alinhamento), `bundle.py` (AAB sem bundletool), `pom.xml` (ferramentas do Maven)
- `.tools/` e `build/`: criados pelo build, fora do git

O pacote não pode mudar depois da primeira publicação na Play Store.
