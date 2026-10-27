//! O que muda entre o navegador e o app nativo e não é desenho: aleatório visual, relógio,
//! armazenamento, vibração e opções de linha de comando/URL. O resto do jogo só chama estas funções.

#[cfg(target_arch = "wasm32")]
mod imp {
    pub fn random() -> f64 {
        js_sys::Math::random()
    }
    /// milissegundos desde o epoch
    pub fn epoch_ms() -> f64 {
        js_sys::Date::now()
    }
    fn storage() -> Option<web_sys::Storage> {
        web_sys::window().and_then(|w| w.local_storage().ok().flatten())
    }
    pub fn storage_get(key: &str) -> Option<String> {
        storage().and_then(|s| s.get_item(key).ok().flatten())
    }
    pub fn storage_set(key: &str, value: &str) {
        if let Some(s) = storage() {
            let _ = s.set_item(key, value);
        }
    }
    pub fn dev_flag() -> bool {
        web_sys::window().and_then(|w| w.location().search().ok()).map(|s| s.contains("dev")).unwrap_or(false)
    }
    pub fn vibrate(ms: i32) {
        if let Some(w) = web_sys::window() {
            let _ = w.navigator().vibrate_with_duration(ms as u32);
        }
    }
    /// a página foi aberta por https? (decide ws:// ou wss:// no jogo em rede)
    pub fn page_is_https() -> bool {
        web_sys::window().and_then(|w| w.location().protocol().ok()).map(|p| p == "https:").unwrap_or(false)
    }
}

#[cfg(not(target_arch = "wasm32"))]
mod imp {
    use std::cell::RefCell;
    use std::collections::HashMap;
    use std::path::PathBuf;

    thread_local! {
        static RNG: RefCell<u64> = RefCell::new({
            let t = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos() as u64).unwrap_or(1);
            t ^ 0x9E37_79B9_7F4A_7C15
        });
        static STORE: RefCell<Option<HashMap<String, String>>> = const { RefCell::new(None) };
        static DIR: RefCell<Option<PathBuf>> = const { RefCell::new(None) };
    }

    /// xorshift64*: só para efeitos visuais e sorteios de menu (a simulação usa o `Random` com semente)
    pub fn random() -> f64 {
        RNG.with(|r| {
            let mut x = *r.borrow();
            x ^= x >> 12;
            x ^= x << 25;
            x ^= x >> 27;
            *r.borrow_mut() = x;
            (x.wrapping_mul(0x2545_F491_4F6C_DD1D) >> 11) as f64 / (1u64 << 53) as f64
        })
    }
    pub fn epoch_ms() -> f64 {
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as f64).unwrap_or(0.0)
    }

    /// pasta onde o app guarda o salvamento (o Android define a pasta de dados do app)
    pub fn set_data_dir(p: PathBuf) {
        DIR.with(|d| *d.borrow_mut() = Some(p));
        STORE.with(|s| *s.borrow_mut() = None);
    }
    fn file() -> Option<PathBuf> {
        DIR.with(|d| d.borrow().clone())
            .or_else(|| {
                let base = std::env::var_os("XDG_DATA_HOME").map(PathBuf::from).or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".local/share")))?;
                Some(base.join("punho-livre"))
            })
            .map(|d| d.join("save.json"))
    }
    fn with_store<R>(f: impl FnOnce(&mut HashMap<String, String>) -> R) -> R {
        STORE.with(|s| {
            let mut s = s.borrow_mut();
            if s.is_none() {
                let m = file().and_then(|p| std::fs::read_to_string(p).ok()).and_then(|t| serde_json::from_str::<HashMap<String, String>>(&t).ok()).unwrap_or_default();
                *s = Some(m);
            }
            f(s.as_mut().unwrap())
        })
    }
    pub fn storage_get(key: &str) -> Option<String> {
        with_store(|m| m.get(key).cloned())
    }
    pub fn storage_set(key: &str, value: &str) {
        let snapshot = with_store(|m| {
            m.insert(key.to_string(), value.to_string());
            serde_json::to_string(m).unwrap_or_default()
        });
        if let Some(p) = file() {
            if let Some(dir) = p.parent() {
                let _ = std::fs::create_dir_all(dir);
            }
            let _ = std::fs::write(p, snapshot);
        }
    }
    pub fn dev_flag() -> bool {
        std::env::args().any(|a| a == "--dev")
    }
    pub fn vibrate(ms: i32) {
        #[cfg(target_os = "android")]
        crate::native::android::vibrate(ms);
        #[cfg(not(target_os = "android"))]
        let _ = ms;
    }
    pub fn page_is_https() -> bool {
        false
    }
}

pub use imp::*;
