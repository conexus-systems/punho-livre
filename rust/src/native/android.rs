//! O que só existe no Android: guarda a JVM e a Activity (`MainActivity.kt`) para chamar o Kotlin
//! por JNI (anúncios do AdMob e vibração) e define a pasta de dados do app.

use std::sync::OnceLock;

use jni::objects::{GlobalRef, JObject, JValue};
use jni::JavaVM;
use winit::platform::android::activity::AndroidApp;

struct Host {
    vm: JavaVM,
    activity: GlobalRef,
}

static HOST: OnceLock<Host> = OnceLock::new();

pub fn init(app: &AndroidApp) {
    android_logger::init_once(android_logger::Config::default().with_max_level(log::LevelFilter::Info));
    if let Some(dir) = app.internal_data_path() {
        crate::platform::set_data_dir(dir);
    }
    // SAFETY: os ponteiros vêm do `AndroidApp` e valem enquanto o app roda
    let vm = unsafe { JavaVM::from_raw(app.vm_as_ptr() as *mut _) };
    let Ok(vm) = vm else { return };
    let activity = unsafe { JObject::from_raw(app.activity_as_ptr() as *mut _) };
    let Ok(env) = vm.attach_current_thread() else { return };
    let Ok(global) = env.new_global_ref(&activity) else { return };
    drop(env);
    let _ = HOST.set(Host { vm, activity: global });
}

/// chama `void nome(...)` na Activity; erros do Java são engolidos (anúncio nunca derruba o jogo)
fn call(name: &str, sig: &str, args: &[JValue]) {
    let Some(h) = HOST.get() else { return };
    let Ok(mut env) = h.vm.attach_current_thread() else { return };
    if env.call_method(&h.activity, name, sig, args).is_err() {
        let _ = env.exception_clear();
    }
}

pub fn set_banner_visible(visible: bool) {
    call("setBannerVisible", "(Z)V", &[JValue::Bool(visible as u8)]);
}

pub fn on_match_end() {
    call("onMatchEnd", "()V", &[]);
}

pub fn vibrate(ms: i32) {
    call("vibrate", "(I)V", &[JValue::Int(ms)]);
}
