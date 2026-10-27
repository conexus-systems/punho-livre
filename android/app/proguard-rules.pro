# Métodos que o Rust chama por JNI (rust/src/native/android.rs): o R8 não vê esses usos
-keepclassmembers class com.conexus.punholivre.MainActivity {
    public void setBannerVisible(boolean);
    public void onMatchEnd();
    public void vibrate(int);
}
