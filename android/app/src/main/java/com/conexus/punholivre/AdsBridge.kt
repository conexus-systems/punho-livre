package com.conexus.punholivre

import android.app.Activity
import android.os.SystemClock
import android.webkit.JavascriptInterface
import android.view.View
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.AdView
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback

/**
 * Ponte de anúncios para o jogo (`window.AndroidAds`).
 *
 * - Banner: visível só nos menus (`setBannerVisible`). Durante a luta some, para não tirar
 *   área de jogo nem atrapalhar os toques.
 * - Intersticial: o jogo chama `onMatchEnd()` ao fim de cada luta (fora do treino, da
 *   demonstração e da rede). Mostra a cada [MATCHES_PER_AD] lutas, com [MIN_GAP_MS] entre eles.
 */
class AdsBridge(private val activity: Activity, private val banner: AdView) {
    private var interstitial: InterstitialAd? = null
    private var loading = false
    private var matchesSinceAd = 0
    private var lastShownAt = 0L

    init {
        load()
    }

    @JavascriptInterface
    fun setBannerVisible(visible: Boolean) {
        activity.runOnUiThread { banner.visibility = if (visible) View.VISIBLE else View.GONE }
    }

    @JavascriptInterface
    fun onMatchEnd() {
        activity.runOnUiThread {
            matchesSinceAd++
            val gapOk = SystemClock.elapsedRealtime() - lastShownAt >= MIN_GAP_MS
            if (matchesSinceAd >= MATCHES_PER_AD && gapOk) show()
        }
    }

    private fun load() {
        if (loading || interstitial != null) return
        loading = true
        InterstitialAd.load(
            activity,
            BuildConfig.ADMOB_INTERSTITIAL_ID,
            AdRequest.Builder().build(),
            object : InterstitialAdLoadCallback() {
                override fun onAdLoaded(ad: InterstitialAd) {
                    loading = false
                    interstitial = ad
                }

                override fun onAdFailedToLoad(error: LoadAdError) {
                    loading = false
                }
            },
        )
    }

    private fun show() {
        val ad = interstitial
        if (ad == null) {
            load()
            return
        }
        interstitial = null
        matchesSinceAd = 0
        lastShownAt = SystemClock.elapsedRealtime()
        ad.fullScreenContentCallback = object : FullScreenContentCallback() {
            override fun onAdDismissedFullScreenContent() = load()
            override fun onAdFailedToShowFullScreenContent(error: AdError) = load()
        }
        ad.show(activity)
    }

    private companion object {
        const val MATCHES_PER_AD = 2
        const val MIN_GAP_MS = 90_000L
    }
}
