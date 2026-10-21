# Checklist para publicar na Play Store

## Uma vez só

- [ ] **Conta de desenvolvedor** da Play Console (taxa única de US$ 25) e verificação de identidade.
- [ ] **Perfil de pagamentos / comerciante** (obrigatório para app pago): dados bancários e fiscais.
      Como pessoa física no Brasil, informe o CPF; a Google retém imposto conforme a lei. Para
      vender com frequência vale falar com um contador (MEI, por exemplo).
- [ ] **Chave de assinatura própria** (guarde em lugar seguro; sem ela não dá para atualizar o app):
      ```
      keytool -genkeypair -storetype PKCS12 -keystore punholivre-upload.p12 \
        -alias upload -keyalg RSA -keysize 2048 -validity 10000
      ```
- [ ] Ativar o **Play App Signing** (padrão): a Google guarda a chave final e você assina o
      envio com a chave de upload acima.
- [ ] Hospedar a **política de privacidade** (store/politica-de-privacidade.html) e preencher
      [DATA] e [E-MAIL DE CONTATO].
- [ ] **Decidir a licença do código** (ver LEGAL.md).
- [ ] Conferir se o nome **Punho Livre** está livre no INPI e na Play Store.

## A cada versão

- [ ] Aumentar `VERSION_CODE` (sempre maior que o anterior) e `VERSION_NAME`.
- [ ] Gerar o pacote assinado com a sua chave:
      ```
      ANDROID_KEYSTORE_PATH=/caminho/punholivre-upload.p12 ANDROID_KEYSTORE_PASSWORD=... \
      ANDROID_KEY_ALIAS=upload ANDROID_KEY_PASSWORD=... \
      ADMOB_ANDROID_APP_ID=ca-app-pub-... ADMOB_ANDROID_BANNER_ID=ca-app-pub-... \
      ADMOB_ANDROID_INTERSTITIAL_ID=ca-app-pub-... \
      ./android/gradlew -p android bundleRelease -PversionCode=3 -PversionName=2.1
      ```
      O arquivo sai em `android/app/build/outputs/bundle/release/app-release.aab`. Sem os IDs reais do AdMob
      o build de release para (de propósito); para teste local use `-PallowTestAds=true`.
- [ ] Testar o APK (`npm run apk`) num aparelho real: toque, botão voltar, pausa ao sair do app,
      rotação, jogo em rede.
- [ ] Na Play Console: *Testes internos* primeiro (envie o .aab, adicione seu e-mail como testador),
      depois *Produção*.
- [ ] Contas pessoais novas precisam de um **teste fechado com pelo menos 12 testadores por
      14 dias** antes de liberar para produção (regra da Google para contas criadas depois de 2023).
- [ ] Preencher: ficha da loja (store/listing-pt-BR.md), classificação de conteúdo, segurança dos
      dados, público-alvo, preço (Grátis, com anúncios) e países de distribuição.
- [ ] Criar a conta **Google AdMob**, o app lá e os blocos de anúncio (banner e intersticial), e colocar os IDs reais nas variáveis acima.
- [ ] Declarar anúncios na Play (Conteúdo do app → Anúncios) e o ID de publicidade na segurança dos dados.

## Depois de publicar

- [ ] Responder avaliações e acompanhar falhas (*Android vitals*).
- [ ] Se hospedar um servidor de salas na internet, usar `wss://` (HTTPS) e preencher o endereço
      padrão em `src/net.js` para o jogador não precisar digitar.
