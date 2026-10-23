# Métodos chamados pelo JavaScript do jogo (ponte com a WebView)
-keepclassmembers class com.conexus.punholivre.** {
    @android.webkit.JavascriptInterface <methods>;
}
