plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// IDs do AdMob (app, banner e intersticial) vêm de -P ou do ambiente, nunca do Git.
// Sem eles o app usa os IDs de teste do Google, que não geram receita. Por isso o
// bundleRelease falha sem os IDs reais, a menos que se passe -PallowTestAds=true (CI, testes).
val testAppId = "ca-app-pub-3940256099942544~3347511713"
val testBannerId = "ca-app-pub-3940256099942544/6300978111"
val testInterstitialId = "ca-app-pub-3940256099942544/1033173712"

fun setting(name: String): String =
    providers.gradleProperty(name).orElse(providers.environmentVariable(name)).orElse("").get().trim()

val realAppId = setting("ADMOB_ANDROID_APP_ID")
val realBannerId = setting("ADMOB_ANDROID_BANNER_ID")
val realInterstitialId = setting("ADMOB_ANDROID_INTERSTITIAL_ID")
val allowTestAds = setting("allowTestAds").toBoolean()
val uploadKeystore = setting("ANDROID_KEYSTORE_PATH")

android {
    namespace = "com.conexus.punholivre"
    compileSdk = 36
    buildToolsVersion = "36.0.0"

    defaultConfig {
        applicationId = "com.conexus.punholivre"
        minSdk = 24
        targetSdk = 36
        versionCode = providers.gradleProperty("versionCode").orElse("3").get().toInt()
        versionName = providers.gradleProperty("versionName").orElse("2.1").get()
        manifestPlaceholders["admobAppId"] = testAppId
        buildConfigField("String", "ADMOB_BANNER_ID", "\"$testBannerId\"")
        buildConfigField("String", "ADMOB_INTERSTITIAL_ID", "\"$testInterstitialId\"")
    }

    buildFeatures { buildConfig = true }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    // o jogo inteiro (HTML, CSS, JS e fonte) é a pasta web/ do repositório
    sourceSets["main"].assets.srcDirs(file("../../web"))

    signingConfigs {
        if (uploadKeystore.isNotEmpty()) {
            create("upload") {
                storeFile = file(uploadKeystore)
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD") ?: error("Falta ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS") ?: error("Falta ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD") ?: error("Falta ANDROID_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            if (realAppId.isNotEmpty()) manifestPlaceholders["admobAppId"] = realAppId
            if (realBannerId.isNotEmpty()) buildConfigField("String", "ADMOB_BANNER_ID", "\"$realBannerId\"")
            if (realInterstitialId.isNotEmpty()) buildConfigField("String", "ADMOB_INTERSTITIAL_ID", "\"$realInterstitialId\"")
            if (uploadKeystore.isNotEmpty()) signingConfig = signingConfigs.getByName("upload")
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
}

gradle.taskGraph.whenReady {
    val releasing = allTasks.any { it.name == "bundleRelease" || it.name == "assembleRelease" }
    val realIds = realAppId.isNotEmpty() && realBannerId.isNotEmpty() && realInterstitialId.isNotEmpty()
    if (releasing && !realIds && !allowTestAds) {
        throw GradleException(
            "Release sem IDs reais do AdMob. Defina ADMOB_ANDROID_APP_ID, ADMOB_ANDROID_BANNER_ID e " +
                "ADMOB_ANDROID_INTERSTITIAL_ID (variáveis de ambiente ou -P). Para teste local: -PallowTestAds=true",
        )
    }
}

kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }

dependencies {
    // único SDK de terceiros: anúncios (banner e intersticial)
    implementation("com.google.android.gms:play-services-ads:25.5.0")
}
