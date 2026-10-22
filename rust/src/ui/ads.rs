//! Ponte com os anúncios do app Android (`window.AndroidAds`, ver android/). No navegador
//! essa ponte não existe e as chamadas não fazem nada.

use wasm_bindgen::JsValue;
use wasm_bindgen::JsCast;

fn call(method: &str, arg: Option<JsValue>) {
    let Some(win) = web_sys::window() else { return };
    let Ok(ads) = js_sys::Reflect::get(&win, &"AndroidAds".into()) else { return };
    if ads.is_undefined() || ads.is_null() {
        return;
    }
    let Ok(f) = js_sys::Reflect::get(&ads, &method.into()) else { return };
    let Ok(f) = f.dyn_into::<js_sys::Function>() else { return };
    let _ = match arg {
        Some(a) => f.call1(&ads, &a),
        None => f.call0(&ads),
    };
}

/// banner só nos menus: some durante a luta
pub fn set_banner_visible(visible: bool) {
    call("setBannerVisible", Some(JsValue::from_bool(visible)));
}

/// fim de uma luta (fora do treino, da demonstração e da rede): o app decide se mostra o intersticial
pub fn on_match_end() {
    call("onMatchEnd", None);
}
