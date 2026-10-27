//! O app nativo: janela, entrada, laço do jogo e a ponte com o sistema (Android).
//! Roda no computador (`cargo run --release`) e no celular (`android_main`), sem WebView.

#[cfg(target_os = "android")]
pub mod android;
mod app;
pub mod host;

use std::cell::RefCell;

pub use app::run;
#[cfg(target_os = "android")]
pub use app::run_android;

thread_local! {
    static TYPED: RefCell<String> = const { RefCell::new(String::new()) };
    static TEXT_MODE: RefCell<bool> = const { RefCell::new(false) };
}

/// texto digitado desde a última leitura (a tela de conexão usa)
pub fn take_typed() -> String {
    TYPED.with(|t| std::mem::take(&mut *t.borrow_mut()))
}
pub(crate) fn push_typed(s: &str) {
    TYPED.with(|t| t.borrow_mut().push_str(s));
}

/// uma tela está pedindo texto: as letras viram texto em vez de teclas do jogo
pub fn set_text_mode(on: bool) {
    TEXT_MODE.with(|t| *t.borrow_mut() = on);
}
pub fn text_mode() -> bool {
    TEXT_MODE.with(|t| *t.borrow())
}
