package com.conexus.punholivre

import android.app.NativeActivity
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView

/**
 * Activity única. O jogo é Rust nativo (`libpunho_livre.so`, ver `rust/src/native/`): a
 * `NativeActivity` entrega a janela e a entrada ao Rust, que desenha tudo. O Kotlin só cuida do
 * que o Rust não alcança: a barra imersiva, o banner e o intersticial do AdMob e a vibração.
 * O Rust chama `setBannerVisible`, `onMatchEnd` e `vibrate` por JNI (`rust/src/native/android.rs`).
 */
class MainActivity : NativeActivity() {
    private var banner: AdView? = null
    private var ads: AdsBridge? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        hideBars()

        val adView = AdView(this).apply {
            setAdSize(AdSize.BANNER)
            adUnitId = BuildConfig.ADMOB_BANNER_ID
            loadAd(AdRequest.Builder().build())
        }
        banner = adView
        ads = AdsBridge(this, adView)
        // o banner flutua embaixo da janela do jogo; só aparece nos menus
        addContentView(
            adView,
            FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL),
        )
    }

    override fun onResume() {
        super.onResume()
        banner?.resume()
        hideBars()
    }

    override fun onPause() {
        banner?.pause()
        super.onPause()
    }

    override fun onDestroy() {
        banner?.destroy()
        super.onDestroy()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideBars()
    }

    // ---- chamadas do Rust (JNI) ----

    /** banner só nos menus: some durante a luta */
    fun setBannerVisible(visible: Boolean) {
        ads?.setBannerVisible(visible)
    }

    /** fim de uma luta (fora do treino, da demonstração e da rede): o AdsBridge decide se mostra o intersticial */
    fun onMatchEnd() {
        ads?.onMatchEnd()
    }

    /** vibração curta ao levar dano */
    @Suppress("DEPRECATION")
    fun vibrate(ms: Int) {
        val v = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (getSystemService(VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
        } else {
            getSystemService(VIBRATOR_SERVICE) as Vibrator
        }
        if (!v.hasVibrator()) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            v.vibrate(VibrationEffect.createOneShot(ms.toLong(), VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
            v.vibrate(ms.toLong())
        }
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
}
