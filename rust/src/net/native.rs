//! Rede no app nativo: o WebSocket roda numa thread (`tungstenite`) e o laço do jogo só lê e
//! escreve em filas. A tela de conexão é desenhada no próprio jogo, sem formulário HTML.

use std::cell::RefCell;
use std::sync::mpsc::{channel, Receiver, Sender, TryRecvError};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use tungstenite::stream::MaybeTlsStream;
use tungstenite::{Error as WsError, Message};

use super::*;
use crate::ui::screens::{back_hit, confirm_hit, nav_horizontal, nav_vertical};

/// servidor de salas já preenchido na tela de conexão (defina `PUNHO_SERVER` ao compilar)
const DEFAULT_SERVER: &str = match option_env!("PUNHO_SERVER") {
    Some(s) => s,
    None => "",
};

const CONNECT_TIMEOUT: Duration = Duration::from_secs(8);

enum In {
    Text(String),
    Error(String),
    Closed,
}

struct Link {
    tx: Sender<String>,
    inbox: Arc<Mutex<Vec<In>>>,
    stop: Arc<Mutex<bool>>,
    opened_at: Instant,
    open: Arc<Mutex<bool>>,
    timed_out: bool,
}

thread_local! {
    static LINK: RefCell<Option<Link>> = const { RefCell::new(None) };
}

fn set_nonblocking(stream: &mut MaybeTlsStream<std::net::TcpStream>) {
    match stream {
        MaybeTlsStream::Plain(s) => {
            let _ = s.set_nonblocking(true);
        }
        #[cfg(feature = "tls")]
        MaybeTlsStream::Rustls(s) => {
            let _ = s.get_mut().set_nonblocking(true);
        }
        _ => {}
    }
}

fn run(url: String, first: String, rx: Receiver<String>, inbox: Arc<Mutex<Vec<In>>>, stop: Arc<Mutex<bool>>, open: Arc<Mutex<bool>>) {
    let say = |m: In| {
        if let Ok(mut q) = inbox.lock() {
            q.push(m);
        }
    };
    let (mut socket, _) = match tungstenite::connect(url.as_str()) {
        Ok(x) => x,
        Err(_) => {
            say(In::Error("Não foi possível conectar ao servidor.".into()));
            return;
        }
    };
    set_nonblocking(socket.get_mut());
    if let Ok(mut o) = open.lock() {
        *o = true;
    }
    let _ = socket.send(Message::text(first));
    loop {
        if stop.lock().map(|s| *s).unwrap_or(true) {
            let _ = socket.close(None);
            let _ = socket.flush();
            return;
        }
        loop {
            match rx.try_recv() {
                Ok(m) => {
                    let _ = socket.send(Message::text(m));
                }
                Err(TryRecvError::Empty) => break,
                Err(TryRecvError::Disconnected) => return,
            }
        }
        match socket.flush() {
            Ok(()) | Err(WsError::Io(_)) => {}
            Err(_) => {
                say(In::Closed);
                return;
            }
        }
        match socket.read() {
            Ok(Message::Text(t)) => say(In::Text(t.to_string())),
            Ok(Message::Close(_)) => {
                say(In::Closed);
                return;
            }
            Ok(_) => {}
            Err(WsError::Io(e)) if e.kind() == std::io::ErrorKind::WouldBlock => std::thread::sleep(Duration::from_millis(4)),
            Err(_) => {
                say(In::Closed);
                return;
            }
        }
    }
}

pub fn connect(addr: &str, first: serde_json::Value) {
    shutdown();
    let (tx, rx) = channel();
    let inbox = Arc::new(Mutex::new(Vec::new()));
    let stop = Arc::new(Mutex::new(false));
    let open = Arc::new(Mutex::new(false));
    let url = super::url(addr);
    let (i2, s2, o2) = (inbox.clone(), stop.clone(), open.clone());
    let first = first.to_string();
    std::thread::spawn(move || run(url, first, rx, i2, s2, o2));
    LINK.with(|l| *l.borrow_mut() = Some(Link { tx, inbox, stop, opened_at: Instant::now(), open, timed_out: false }));
}

pub fn send_text(s: &str) {
    LINK.with(|l| {
        if let Some(link) = l.borrow().as_ref() {
            let _ = link.tx.send(s.to_string());
        }
    });
}

/// fecha a conexão sem avisar a tela
pub fn shutdown() {
    if let Some(link) = LINK.with(|l| l.borrow_mut().take()) {
        if let Ok(mut s) = link.stop.lock() {
            *s = true;
        }
    }
}

pub fn is_open() -> bool {
    LINK.with(|l| l.borrow().is_some())
}

/// passa para o jogo o que a thread recebeu
pub fn poll() {
    let (items, timed_out) = LINK.with(|l| {
        let mut l = l.borrow_mut();
        let Some(link) = l.as_mut() else { return (vec![], false) };
        let items = link.inbox.lock().map(|mut q| std::mem::take(&mut *q)).unwrap_or_default();
        let connecting = !link.open.lock().map(|o| *o).unwrap_or(false);
        let late = connecting && !link.timed_out && link.opened_at.elapsed() > CONNECT_TIMEOUT;
        if late {
            link.timed_out = true;
        }
        (items, late)
    });
    if timed_out {
        shutdown();
        push(serde_json::json!({"t": "error", "msg": "O servidor não respondeu."}));
    }
    for m in items {
        match m {
            In::Text(s) => {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&s) {
                    handle_incoming(&v);
                    push(v);
                }
            }
            In::Error(msg) => {
                shutdown();
                push(serde_json::json!({"t": "error", "msg": msg}));
            }
            In::Closed => {
                if is_open() {
                    shutdown();
                    push(serde_json::json!({"t": "closed"}));
                }
            }
        }
    }
}

// ---- tela de conexão ----

const ROWS: [&str; 6] = ["Servidor", "Seu nome", "Criar sala", "Código da sala", "Entrar", "Voltar"];

pub struct NetScreen {
    t: i32,
    pub status: String,
    sel: usize,
    server: String,
    name: String,
    code: [u8; 4],
    slot: usize,
}

impl Default for NetScreen {
    fn default() -> Self {
        Self::new()
    }
}

impl NetScreen {
    pub fn new() -> NetScreen {
        let saved = server_saved();
        NetScreen {
            t: 0,
            status: String::new(),
            sel: if saved.is_empty() && DEFAULT_SERVER.is_empty() { 0 } else { 2 },
            server: if saved.is_empty() { DEFAULT_SERVER.to_string() } else { saved },
            name: crate::platform::storage_get("pl.name").unwrap_or_default(),
            code: [b'A'; 4],
            slot: 0,
        }
    }

    pub fn enter(&mut self) {}

    fn connect_with(&mut self, kind: &'static str) {
        if self.server.trim().is_empty() {
            self.status = "Informe o endereço do servidor.".into();
            self.sel = 0;
            return;
        }
        let mut first = serde_json::json!({"t": kind, "name": self.name.trim()});
        if kind == "join" {
            first["code"] = serde_json::Value::String(String::from_utf8_lossy(&self.code).to_string());
        }
        crate::platform::storage_set("pl.server", self.server.trim());
        crate::platform::storage_set("pl.name", self.name.trim());
        self.status = "Conectando...".into();
        super::connect(&self.server, first);
    }

    pub fn update(&mut self) -> Option<Next> {
        let next = self.step();
        // nas linhas de texto o teclado digita em vez de navegar
        crate::native::set_text_mode(next.is_none() && matches!(self.sel, 0 | 1 | 3));
        next
    }

    fn step(&mut self) -> Option<Next> {
        self.t += 1;
        for m in drain() {
            match m["t"].as_str() {
                Some("error") => self.status = m["msg"].as_str().unwrap_or("").to_string(),
                Some("joined") => return Some(Next::Screen(Screen::NetLobby(NetLobbyScreen::new()))),
                _ => {}
            }
        }
        // texto digitado (teclado do computador)
        let typed = crate::native::take_typed();
        let erase = input::with(|i| i.code("Backspace"));
        match self.sel {
            0 | 1 => {
                let (field, max) = if self.sel == 0 { (&mut self.server, 60) } else { (&mut self.name, 10) };
                for c in typed.chars().filter(|c| !c.is_control()) {
                    if field.chars().count() < max {
                        field.push(c);
                    }
                }
                if erase {
                    field.pop();
                }
            }
            3 => {
                for c in typed.chars().filter(|c| c.is_ascii_alphabetic()) {
                    self.code[self.slot] = c.to_ascii_uppercase() as u8;
                    self.slot = (self.slot + 1).min(3);
                }
                if erase {
                    self.slot = self.slot.saturating_sub(1);
                }
            }
            _ => {}
        }
        let before = self.sel;
        // as linhas de texto só trocam de linha por cima/baixo; o código usa esquerda/direita para a letra
        self.sel = nav_vertical(ROWS.len(), self.sel);
        if self.sel == 3 {
            let h = nav_horizontal();
            if h != 0 {
                let c = &mut self.code[self.slot];
                *c = (((*c - b'A') as i32 + h).rem_euclid(26) as u8) + b'A';
            }
        }
        let _ = before;
        if back_hit() {
            close();
            return Some(Next::Screen(Screen::title()));
        }
        if confirm_hit() {
            match self.sel {
                2 => self.connect_with("create"),
                3 => {
                    if self.slot < 3 {
                        self.slot += 1;
                    } else {
                        self.sel = 4;
                    }
                }
                4 => self.connect_with("join"),
                5 => {
                    close();
                    return Some(Next::Screen(Screen::title()));
                }
                _ => self.sel = (self.sel + 1) % ROWS.len(),
            }
        }
        None
    }

    pub fn draw(&self, ctx: &Ctx) {
        menu_backdrop(ctx, self.t as f64);
        draw_logo(ctx, W / 2.0, 70.0, 0.4, self.t as f64);
        title(ctx, "JOGAR EM REDE", W / 2.0, 150.0, 30.0, UI_AMBER, Align::Center);
        let blink = (self.t / 15) % 2 == 0;
        for (i, label) in ROWS.iter().enumerate() {
            let y = 190.0 + i as f64 * 36.0;
            let on = i == self.sel;
            if on {
                ctx.fill_style("rgba(255,176,0,0.9)");
                ctx.fill_rect(W / 2.0 - 250.0, y - 15.0, 500.0, 30.0);
            }
            let ink = if on { UI_INK } else { UI_TEXT };
            let value = match i {
                0 => {
                    let cursor = if on && blink { "_" } else { "" };
                    if self.server.is_empty() && !on {
                        "digite o endereço".to_string()
                    } else {
                        format!("{}{}", self.server, cursor)
                    }
                }
                1 => format!("{}{}", self.name, if on && blink { "_" } else { "" }),
                3 => (0..4).map(|k| if on && k == self.slot { format!("[{}]", self.code[k] as char) } else { format!(" {} ", self.code[k] as char) }).collect::<String>(),
                _ => String::new(),
            };
            if matches!(i, 2 | 4 | 5) {
                text(ctx, label, W / 2.0, y, &TextOpt::default().center().size(16.0).color(ink));
            } else {
                text(ctx, label, W / 2.0 - 235.0, y, &TextOpt::default().size(14.0).color(ink));
                let dim = self.server.is_empty() && i == 0 && !on;
                text(ctx, &value, W / 2.0 - 60.0, y, &TextOpt::default().size(14.0).light().color(if dim { UI_DIM } else { ink }).max(290.0));
            }
        }
        text(ctx, &self.status, W / 2.0, 428.0, &TextOpt::default().center().light().color(UI_MUTED));
        let hint = match self.sel {
            0 | 1 => "Digite no teclado · cima/baixo troca de campo",
            3 => "Esquerda/direita muda a letra · Ataque avança",
            _ => "Ataque confirma · Pulo volta",
        };
        text(ctx, hint, W / 2.0, 452.0, &TextOpt::default().center().light().size(11.0).color(UI_DIM));
    }
}
