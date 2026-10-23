package com.conexus.punholivre

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.LinearLayout
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView

/**
 * Activity única: abre o jogo (assets/index.html) numa WebView em tela cheia, deitada,
 * com um banner do AdMob embaixo.
 */
class MainActivity : Activity() {
    private lateinit var web: WebView
    private var banner: AdView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val adView = AdView(this).apply {
            setAdSize(AdSize.BANNER)
            adUnitId = BuildConfig.ADMOB_BANNER_ID
            loadAd(AdRequest.Builder().build())
        }
        banner = adView

        web = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            // window.AndroidApp.exit() fecha o app a partir da tela de título
            addJavascriptInterface(AppBridge(this@MainActivity), "AndroidApp")
            // window.AndroidAds: intersticial ao fim das lutas e banner só nos menus
            addJavascriptInterface(AdsBridge(this@MainActivity, adView), "AndroidAds")
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f)
        }

        setContentView(
            LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setBackgroundColor(Color.BLACK)
                addView(web)
                addView(adView, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT))
            },
        )
        web.loadUrl("file:///android_asset/index.html")
        hideBars()
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
        banner?.resume()
        hideBars()
    }

    override fun onPause() {
        web.onPause()
        banner?.pause()
        super.onPause()
    }

    override fun onDestroy() {
        banner?.destroy()
        web.destroy()
        super.onDestroy()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideBars()
    }

    // Voltar: o jogo decide (pausa, volta de menu ou fecha na tela de título).
    @Suppress("OVERRIDE_DEPRECATION")
    override fun onBackPressed() {
        web.evaluateJavascript("window.androidBack && window.androidBack()", null)
    }

    // Modo imersivo: esconde barra de status e de navegação.
    @Suppress("DEPRECATION")
    private fun hideBars() {
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            )
    }

    class AppBridge(private val activity: Activity) {
        @JavascriptInterface
        fun exit() {
            activity.runOnUiThread { activity.finish() }
        }
    }
}
