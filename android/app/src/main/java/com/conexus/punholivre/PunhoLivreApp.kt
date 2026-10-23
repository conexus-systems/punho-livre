package com.conexus.punholivre

import android.app.Application
import com.google.android.gms.ads.MobileAds

class PunhoLivreApp : Application() {
    override fun onCreate() {
        super.onCreate()
        MobileAds.initialize(this) {}
    }
}
