//! Ponte com o sistema que hospeda o app: anúncios (AdMob, no Kotlin) e vibração. Fora do
//! Android não faz nada.

#[cfg(target_os = "android")]
pub use super::android::{on_match_end, set_banner_visible};

#[cfg(not(target_os = "android"))]
pub fn set_banner_visible(_visible: bool) {}
#[cfg(not(target_os = "android"))]
pub fn on_match_end() {}
