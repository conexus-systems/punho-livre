//! Rede no navegador: WebSocket do próprio navegador e o formulário HTML da tela de conexão.

use std::cell::RefCell;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use web_sys::{HtmlButtonElement, HtmlInputElement, MessageEvent, WebSocket};

use super::*;

#[derive(Default)]
pub struct Transport {
    ws: Option<WebSocket>,
    closures: Vec<Closure<dyn FnMut(web_sys::Event)>>,
    msg_closure: Option<Closure<dyn FnMut(MessageEvent)>>,
}

thread_local! {
    static TR: RefCell<Transport> = RefCell::new(Transport::default());
}

/// mensagens que chegaram ao transporte e ainda não foram lidas (no navegador os callbacks já empurram direto)
pub fn poll() {}

/// conecta ao servidor e manda `first` (create/join) assim que abrir
pub fn connect(addr: &str, first: serde_json::Value) {
    shutdown();
    let ws = match WebSocket::new(&url(addr)) {
        Ok(w) => w,
        Err(_) => {
            push(serde_json::json!({"t": "error", "msg": "Endereço do servidor inválido."}));
            return;
        }
    };
    let first = first.to_string();
    let ws2 = ws.clone();
    let on_open = Closure::<dyn FnMut(web_sys::Event)>::new(move |_e: web_sys::Event| {
        let _ = ws2.send_with_str(&first);
    });
    ws.set_onopen(Some(on_open.as_ref().unchecked_ref()));
    let on_error = Closure::<dyn FnMut(web_sys::Event)>::new(move |_e: web_sys::Event| {
        push(serde_json::json!({"t": "error", "msg": "Não foi possível conectar ao servidor."}));
    });
    ws.set_onerror(Some(on_error.as_ref().unchecked_ref()));
    let ws3 = ws.clone();
    let on_close = Closure::<dyn FnMut(web_sys::Event)>::new(move |_e: web_sys::Event| {
        let current = TR.with(|t| t.borrow().ws.as_ref().map(|w| w == &ws3).unwrap_or(false));
        if current {
            TR.with(|t| t.borrow_mut().ws = None);
            push(serde_json::json!({"t": "closed"}));
        }
    });
    ws.set_onclose(Some(on_close.as_ref().unchecked_ref()));
    let on_msg = Closure::<dyn FnMut(MessageEvent)>::new(move |e: MessageEvent| {
        let Some(s) = e.data().as_string() else { return };
        let Ok(v) = serde_json::from_str::<serde_json::Value>(&s) else { return };
        handle_incoming(&v);
        push(v);
    });
    ws.set_onmessage(Some(on_msg.as_ref().unchecked_ref()));
    // tempo esgotado
    let ws4 = ws.clone();
    let timeout = Closure::<dyn FnMut(web_sys::Event)>::new(move |_e: web_sys::Event| {
        if ws4.ready_state() == WebSocket::CONNECTING {
            let _ = ws4.close();
            push(serde_json::json!({"t": "error", "msg": "O servidor não respondeu."}));
        }
    });
    let _ = web_sys::window().unwrap().set_timeout_with_callback_and_timeout_and_arguments_0(timeout.as_ref().unchecked_ref(), 8000);
    TR.with(|t| {
        let mut t = t.borrow_mut();
        t.ws = Some(ws);
        t.closures.extend([on_open, on_error, on_close, timeout]);
        t.msg_closure = Some(on_msg);
    });
}

/// envia um texto pelo WebSocket aberto
pub fn send_text(s: &str) {
    TR.with(|t| {
        if let Some(ws) = &t.borrow().ws {
            if ws.ready_state() == WebSocket::OPEN {
                let _ = ws.send_with_str(s);
            }
        }
    });
}

/// fecha o WebSocket sem avisar a tela
pub fn shutdown() {
    let ws = TR.with(|t| t.borrow_mut().ws.take());
    if let Some(ws) = ws {
        ws.set_onclose(None);
        let _ = ws.close();
    }
}

pub fn server_default() -> String {
    if let Some(loc) = web_sys::window().map(|w| w.location()) {
        if loc.protocol().map(|p| p == "http:" || p == "https:").unwrap_or(false) {
            return loc.host().unwrap_or_default();
        }
    }
    String::new()
}

// ---- tela de conexão (formulário HTML por cima do jogo) ----

pub struct NetScreen {
    t: i32,
    pub status: String,
}

fn el<T: JsCast>(id: &str) -> Option<T> {
    document().get_element_by_id(id).and_then(|e| e.dyn_into::<T>().ok())
}

fn set_status(s: &str) {
    if let Some(e) = document().get_element_by_id("net-status") {
        e.set_text_content(Some(s));
    }
}

impl Default for NetScreen {
    fn default() -> Self {
        Self::new()
    }
}

impl NetScreen {
    pub fn new() -> NetScreen {
        NetScreen { t: 0, status: String::new() }
    }

    pub fn enter(&mut self) {
        let Some(form) = document().get_element_by_id("netform") else { return };
        let _ = form.remove_attribute("hidden");
        let (Some(server), Some(name), Some(code_in)) = (el::<HtmlInputElement>("net-server"), el::<HtmlInputElement>("net-name"), el::<HtmlInputElement>("net-code")) else {
            return;
        };
        let mut saved = server_saved();
        if saved.is_empty() {
            saved = server_default();
        }
        server.set_value(&saved);
        name.set_value(&crate::platform::storage_get("pl.name").unwrap_or_default());
        set_status("");
        let go = |first_kind: &'static str| {
            let (Some(server), Some(name), Some(code_in)) = (el::<HtmlInputElement>("net-server"), el::<HtmlInputElement>("net-name"), el::<HtmlInputElement>("net-code")) else {
                return;
            };
            let addr = server.value();
            if addr.trim().is_empty() {
                set_status("Informe o endereço do servidor.");
                let _ = server.focus();
                return;
            }
            let mut first = serde_json::json!({"t": first_kind, "name": name.value().trim()});
            if first_kind == "join" {
                let c = code_in.value().trim().to_string();
                if c.len() != 4 || !c.chars().all(|ch| ch.is_ascii_alphabetic()) {
                    set_status("O código da sala tem 4 letras.");
                    let _ = code_in.focus();
                    return;
                }
                first["code"] = serde_json::Value::String(c.to_uppercase());
            }
            crate::platform::storage_set("pl.server", addr.trim());
            crate::platform::storage_set("pl.name", name.value().trim());
            set_status("Conectando...");
            super::connect(&addr, first);
        };
        let bind = |id: &str, f: Box<dyn FnMut()>| {
            if let Some(b) = el::<HtmlButtonElement>(id) {
                let mut f = f;
                let cb = Closure::<dyn FnMut(web_sys::Event)>::new(move |_e: web_sys::Event| f());
                b.set_onclick(Some(cb.as_ref().unchecked_ref()));
                cb.forget();
            }
        };
        bind("net-create", Box::new(move || go("create")));
        bind("net-join", Box::new(move || go("join")));
        bind(
            "net-back",
            Box::new(|| {
                leave_form();
                close();
                input::with(|i| i.set_key("Escape", true));
                input::with(|i| i.set_key("Escape", false));
            }),
        );
        if let Some(f) = el::<web_sys::HtmlFormElement>("netform") {
            let cb = Closure::<dyn FnMut(web_sys::Event)>::new(move |e: web_sys::Event| e.prevent_default());
            f.set_onsubmit(Some(cb.as_ref().unchecked_ref()));
            cb.forget();
        }
        let _ = code_in;
        let focus = if server.value().is_empty() { server } else { name };
        let _ = focus.focus();
    }

    pub fn update(&mut self) -> Option<Next> {
        self.t += 1;
        for m in drain() {
            match m["t"].as_str() {
                Some("error") => set_status(m["msg"].as_str().unwrap_or("")),
                Some("joined") => {
                    leave_form();
                    return Some(Next::Screen(Screen::NetLobby(NetLobbyScreen::new())));
                }
                _ => {}
            }
        }
        if input::with(|i| i.code("Escape")) {
            leave_form();
            close();
            return Some(Next::Screen(Screen::title()));
        }
        None
    }

    pub fn draw(&self, ctx: &Ctx) {
        menu_backdrop(ctx, self.t as f64);
        draw_logo(ctx, W / 2.0, 90.0, 0.45, self.t as f64);
    }
}

fn leave_form() {
    if let Some(f) = document().get_element_by_id("netform") {
        let _ = f.set_attribute("hidden", "");
    }
    if let Some(a) = document().active_element() {
        if let Some(h) = a.dyn_ref::<web_sys::HtmlElement>() {
            let _ = h.blur();
        }
    }
}

/// a conexão com o servidor ainda existe?
pub fn is_open() -> bool {
    TR.with(|t| t.borrow().ws.is_some())
}
