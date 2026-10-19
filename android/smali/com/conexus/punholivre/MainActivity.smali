# Activity única: abre o jogo (assets/index.html) numa WebView em tela cheia.
# Escrita em smali para que o build não dependa do Android SDK.

.class public Lcom/conexus/punholivre/MainActivity;
.super Landroid/app/Activity;

.field private web:Landroid/webkit/WebView;

.method public constructor <init>()V
    .registers 1
    invoke-direct {p0}, Landroid/app/Activity;-><init>()V
    return-void
.end method

.method protected onCreate(Landroid/os/Bundle;)V
    # v0-v3 locais; p0 (this) = v4, p1 = v5
    .registers 6
    invoke-super {p0, p1}, Landroid/app/Activity;->onCreate(Landroid/os/Bundle;)V

    # FLAG_FULLSCREEN | FLAG_KEEP_SCREEN_ON
    invoke-virtual {p0}, Landroid/app/Activity;->getWindow()Landroid/view/Window;
    move-result-object v0
    const/16 v1, 0x480
    invoke-virtual {v0, v1}, Landroid/view/Window;->addFlags(I)V

    new-instance v0, Landroid/webkit/WebView;
    invoke-direct {v0, p0}, Landroid/webkit/WebView;-><init>(Landroid/content/Context;)V
    iput-object v0, p0, Lcom/conexus/punholivre/MainActivity;->web:Landroid/webkit/WebView;
    const/high16 v1, -0x1000000
    invoke-virtual {v0, v1}, Landroid/webkit/WebView;->setBackgroundColor(I)V

    invoke-virtual {v0}, Landroid/webkit/WebView;->getSettings()Landroid/webkit/WebSettings;
    move-result-object v1
    const/4 v2, 0x1
    const/4 v3, 0x0
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setJavaScriptEnabled(Z)V
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setDomStorageEnabled(Z)V
    invoke-virtual {v1, v3}, Landroid/webkit/WebSettings;->setMediaPlaybackRequiresUserGesture(Z)V

    # window.AndroidApp.exit() fecha o app a partir da tela de título
    const-string v1, "AndroidApp"
    invoke-virtual {v0, p0, v1}, Landroid/webkit/WebView;->addJavascriptInterface(Ljava/lang/Object;Ljava/lang/String;)V

    invoke-virtual {p0, v0}, Landroid/app/Activity;->setContentView(Landroid/view/View;)V
    const-string v1, "file:///android_asset/index.html"
    invoke-virtual {v0, v1}, Landroid/webkit/WebView;->loadUrl(Ljava/lang/String;)V

    invoke-direct {p0}, Lcom/conexus/punholivre/MainActivity;->hideBars()V

    # Android 13+: registra o callback do botão voltar
    sget v0, Landroid/os/Build$VERSION;->SDK_INT:I
    const/16 v1, 0x21
    if-lt v0, v1, :no_back_callback
    invoke-virtual {p0}, Landroid/app/Activity;->getOnBackInvokedDispatcher()Landroid/window/OnBackInvokedDispatcher;
    move-result-object v0
    new-instance v1, Lcom/conexus/punholivre/MainActivity$Back;
    invoke-direct {v1, p0}, Lcom/conexus/punholivre/MainActivity$Back;-><init>(Lcom/conexus/punholivre/MainActivity;)V
    const/4 v2, 0x0
    invoke-interface {v0, v2, v1}, Landroid/window/OnBackInvokedDispatcher;->registerOnBackInvokedCallback(ILandroid/window/OnBackInvokedCallback;)V
    :no_back_callback
    return-void
.end method

# Modo imersivo: esconde barra de status e de navegação.
.method private hideBars()V
    .registers 3
    invoke-virtual {p0}, Landroid/app/Activity;->getWindow()Landroid/view/Window;
    move-result-object v0
    invoke-virtual {v0}, Landroid/view/Window;->getDecorView()Landroid/view/View;
    move-result-object v0
    const/16 v1, 0x1706
    invoke-virtual {v0, v1}, Landroid/view/View;->setSystemUiVisibility(I)V
    return-void
.end method

.method protected onResume()V
    .registers 2
    invoke-super {p0}, Landroid/app/Activity;->onResume()V
    iget-object v0, p0, Lcom/conexus/punholivre/MainActivity;->web:Landroid/webkit/WebView;
    invoke-virtual {v0}, Landroid/webkit/WebView;->onResume()V
    invoke-direct {p0}, Lcom/conexus/punholivre/MainActivity;->hideBars()V
    return-void
.end method

.method protected onPause()V
    .registers 2
    iget-object v0, p0, Lcom/conexus/punholivre/MainActivity;->web:Landroid/webkit/WebView;
    invoke-virtual {v0}, Landroid/webkit/WebView;->onPause()V
    invoke-super {p0}, Landroid/app/Activity;->onPause()V
    return-void
.end method

.method public onWindowFocusChanged(Z)V
    .registers 2
    invoke-super {p0, p1}, Landroid/app/Activity;->onWindowFocusChanged(Z)V
    if-eqz p1, :done
    invoke-direct {p0}, Lcom/conexus/punholivre/MainActivity;->hideBars()V
    :done
    return-void
.end method

# Voltar: o jogo decide (pausa, volta de menu ou fecha na tela de título).
.method public onBackPressed()V
    .registers 4
    iget-object v0, p0, Lcom/conexus/punholivre/MainActivity;->web:Landroid/webkit/WebView;
    const-string v1, "window.androidBack && window.androidBack()"
    const/4 v2, 0x0
    invoke-virtual {v0, v1, v2}, Landroid/webkit/WebView;->evaluateJavascript(Ljava/lang/String;Landroid/webkit/ValueCallback;)V
    return-void
.end method

.method public exit()V
    .registers 1
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation
    invoke-virtual {p0}, Landroid/app/Activity;->finish()V
    return-void
.end method
