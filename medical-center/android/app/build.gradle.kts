plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
dependencies { implementation("androidx.core:core-ktx:1.13.1") }
android {
    namespace = "com.zahraa.clinic"
    compileSdk = 34
    defaultConfig {
        applicationId = "com.zahraa.clinic"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }
    buildTypes { release { isMinifyEnabled = false } }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
