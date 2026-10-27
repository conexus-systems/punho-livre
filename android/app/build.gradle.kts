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

// O jogo é Rust (rust/): `cargo ndk` gera libpunho_livre.so para cada ABI em build/rust-libs/<abi>/.
// Com -PrustLibs=<pasta> (CI) usa bibliotecas já compiladas e não roda o cargo.
val prebuiltRustLibs = setting("rustLibs")
val rustLibsDir = if (prebuiltRustLibs.isNotEmpty()) file(prebuiltRustLibs) else layout.buildDirectory.dir("rust-libs").get().asFile
val rustAbis = listOf("arm64-v8a", "armeabi-v7a", "x86_64")

val buildRust by tasks.registering(Exec::class) {
    onlyIf { prebuiltRustLibs.isEmpty() }
    workingDir = file("../../rust")
    // PUNHO_SERVER (opcional) vem do ambiente: servidor de salas já preenchido na tela de rede
    commandLine(
        listOf("cargo", "ndk", "--platform", "24") + rustAbis.flatMap { listOf("-t", it) } +
            listOf("-o", rustLibsDir.absolutePath, "build", "--release", "--lib"),
    )
}

// tudo que empacota bibliotecas nativas roda depois da compilação do Rust
tasks.configureEach {
    if (name.startsWith("merge") && name.endsWith("JniLibFolders")) dependsOn(buildRust)
}

android {
    namespace = "com.conexus.punholivre"
    compileSdk = 36
    buildToolsVersion = "36.0.0"

    defaultConfig {
        applicationId = "com.conexus.punholivre"
        minSdk = 24
        targetSdk = 36
        versionCode = providers.gradleProperty("versionCode").orElse("30000").get().toInt()
        versionName = providers.gradleProperty("versionName").orElse("3.0.0").get()
        manifestPlaceholders["admobAppId"] = testAppId
        buildConfigField("String", "ADMOB_BANNER_ID", "\"$testBannerId\"")
        buildConfigField("String", "ADMOB_INTERSTITIAL_ID", "\"$testInterstitialId\"")
    }

    buildFeatures { buildConfig = true }

    packaging { jniLibs { useLegacyPackaging = false } }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    sourceSets["main"].jniLibs.srcDir(rustLibsDir)

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
            // sem chave própria o pacote sai com a chave de debug (instala, mas não serve para a Play)
            signingConfig = signingConfigs.getByName(if (uploadKeystore.isNotEmpty()) "upload" else "debug")
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
