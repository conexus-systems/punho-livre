//! Jogo em rede. Todos os aparelhos simulam a mesma partida ("lockstep"):
//! cada um envia as próprias teclas marcadas com o quadro em que valem
//! (alguns quadros à frente, para dar tempo de chegarem) e só avança um
//! quadro quando já tem as teclas de todos os jogadores para ele.

use std::cell::RefCell;
use std::collections::HashMap;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use web_sys::{HtmlButtonElement, HtmlInputElement, MessageEvent, WebSocket};

use crate::audio::sound;
use crate::core::consts::*;
use crate::core::input::{self, Key};
use crate::engine::r#match::*;
use crate::game::{assets, Game};
use crate::gfx::*;
use crate::ui::logo::{draw_logo, menu_backdrop};
use crate::ui::screens::{back_hit, Next, Screen};

pub const NET_DELAY: i32 = 4; // quadros de atraso das teclas (~130 ms)
pub const NET_HASH_EVERY: i32 = 60; // a cada 2 s os aparelhos comparam o estado

#[derive(Clone, Debug, Default)]
pub struct RoomPlayer {
    pub slot: i32,
    pub name: String,
    pub char_: i32,
    pub team: i32,
    pub ready: bool,
}

#[derive(Clone, Debug, Default)]
pub struct Room {
    pub code: String,
    pub host: i32,
    pub cpus: i32,
    pub difficulty: i32,
    pub bg: i32,
    pub players: Vec<RoomPlayer>,
}

struct NetState {
    ws: Option<WebSocket>,
    slot: i32,
    code: String,
    room: Option<Room>,
    queue: Vec<serde_json::Value>,
    closures: Vec<Closure<dyn FnMut(web_sys::Event)>>,
    msg_closure: Option<Closure<dyn FnMut(MessageEvent)>>,
}

thread_local! {
    static NET: RefCell<NetState> = const { RefCell::new(NetState { ws: None, slot: -1, code: String::new(), room: None, queue: Vec::new(), closures: Vec::new(), msg_closure: None }) };
}

fn server_saved() -> String {
    input::local_storage().and_then(|s| s.get_item("pl.server").ok().flatten()).unwrap_or_default()
}

pub fn url(addr: &str) -> String {
    let mut addr = addr.trim().trim_end_matches('/').to_string();
    if addr.starts_with("ws://") || addr.starts_with("wss://") {
        if addr.ends_with("/ws") {
            addr.truncate(addr.len() - 3);
        }
        return format!("{}/ws", addr);
    }
    if addr.starts_with("http://") || addr.starts_with("https://") {
        let mut a = addr.replacen("http", "ws", 1);
        if a.ends_with("/ws") {
            a.truncate(a.len() - 3);
        }
        return format!("{}/ws", a);
    }
    // endereços locais (IP, localhost ou com porta) usam ws://; domínios usam wss://
    let host_part = addr.split(':').next().unwrap_or("");
    let numeric_ip = host_part.split('.').count() == 4 && host_part.split('.').all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_digit()));
    let has_port = addr.rsplit(':').next().map(|p| addr.contains(':') && !p.is_empty() && p.chars().all(|c| c.is_ascii_digit())).unwrap_or(false);
    let local = host_part == "localhost" || numeric_ip || has_port;
    let https = web_sys::window().and_then(|w| w.location().protocol().ok()).map(|p| p == "https:").unwrap_or(false);
    format!("{}://{}/ws", if https || !local { "wss" } else { "ws" }, addr)
}

fn push(v: serde_json::Value) {
    NET.with(|n| n.borrow_mut().queue.push(v));
}

fn handle_incoming(m: &serde_json::Value) {
    match m["t"].as_str() {
        Some("joined") => NET.with(|n| {
            let mut n = n.borrow_mut();
            n.slot = m["slot"].as_i64().unwrap_or(-1) as i32;
            n.code = m["code"].as_str().unwrap_or("").to_string();
        }),
        Some("room") => {
            let settings = &m["settings"];
            let room = Room {
                code: m["code"].as_str().unwrap_or("").to_string(),
                host: m["host"].as_i64().unwrap_or(-1) as i32,
                cpus: settings["cpus"].as_i64().unwrap_or(0) as i32,
                difficulty: settings["difficulty"].as_i64().unwrap_or(1) as i32,
                bg: settings["bg"].as_i64().unwrap_or(-1) as i32,
                players: m["players"]
                    .as_array()
                    .map(|a| {
                        a.iter()
                            .map(|p| RoomPlayer {
                                slot: p["slot"].as_i64().unwrap_or(0) as i32,
                                name: p["name"].as_str().unwrap_or("").to_string(),
                                char_: p["char"].as_i64().unwrap_or(-1) as i32,
                                team: p["team"].as_i64().unwrap_or(0) as i32,
                                ready: p["ready"].as_bool().unwrap_or(false),
                            })
                            .collect()
                    })
                    .unwrap_or_default(),
            };
            NET.with(|n| n.borrow_mut().room = Some(room));
        }
        _ => {}
    }
}

/// conecta ao servidor e manda `first` (create/join) assim que abrir
pub fn connect(addr: &str, first: serde_json::Value) {
    close();
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
        let current = NET.with(|n| n.borrow().ws.as_ref().map(|w| w == &ws3).unwrap_or(false));
        if current {
            NET.with(|n| n.borrow_mut().ws = None);
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
    NET.with(|n| {
        let mut n = n.borrow_mut();
        n.ws = Some(ws);
        n.closures.extend([on_open, on_error, on_close, timeout]);
        n.msg_closure = Some(on_msg);
    });
}

pub fn send(v: serde_json::Value) {
    NET.with(|n| {
        if let Some(ws) = &n.borrow().ws {
            if ws.ready_state() == WebSocket::OPEN {
                let _ = ws.send_with_str(&v.to_string());
            }
        }
    });
}

pub fn close() {
    let ws = NET.with(|n| n.borrow_mut().ws.take());
    if let Some(ws) = ws {
        ws.set_onclose(None);
        let _ = ws.close();
    }
    NET.with(|n| {
        let mut n = n.borrow_mut();
        n.room = None;
        n.slot = -1;
        n.code.clear();
        n.queue.clear();
    });
}

fn slot() -> i32 {
    NET.with(|n| n.borrow().slot)
}
fn code() -> String {
    NET.with(|n| n.borrow().code.clone())
}
fn room() -> Option<Room> {
    NET.with(|n| n.borrow().room.clone())
}
fn is_host() -> bool {
    NET.with(|n| n.borrow().room.as_ref().map(|r| r.host == n.borrow().slot).unwrap_or(false))
}
fn drain() -> Vec<serde_json::Value> {
    NET.with(|n| std::mem::take(&mut n.borrow_mut().queue))
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
            if let Some(loc) = web_sys::window().map(|w| w.location()) {
                if loc.protocol().map(|p| p == "http:" || p == "https:").unwrap_or(false) {
                    saved = loc.host().unwrap_or_default();
                }
            }
        }
        server.set_value(&saved);
        name.set_value(&input::local_storage().and_then(|s| s.get_item("pl.name").ok().flatten()).unwrap_or_default());
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
            if let Some(st) = input::local_storage() {
                let _ = st.set_item("pl.server", addr.trim());
                let _ = st.set_item("pl.name", name.value().trim());
            }
            set_status("Conectando...");
            connect(&addr, first);
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

// ---- sala de espera ----

pub struct NetLobbyScreen {
    t: i32,
    chars: Vec<i32>,
    row: usize,
    me_char: i32,
    me_team: i32,
    me_ready: bool,
    msg: String,
    closed: bool,
}

impl Default for NetLobbyScreen {
    fn default() -> Self {
        Self::new()
    }
}

impl NetLobbyScreen {
    pub fn new() -> NetLobbyScreen {
        let chars = assets().character_list();
        let mut s = NetLobbyScreen { t: 0, chars, row: 0, me_char: -1, me_team: 0, me_ready: false, msg: String::new(), closed: false };
        if let Some(r) = room() {
            if let Some(p) = r.players.iter().find(|p| p.slot == slot()) {
                s.me_char = p.char_;
                s.me_team = p.team;
            }
        }
        s.send_pick();
        s
    }

    fn rows(&self) -> Vec<&'static str> {
        let mut r = vec!["char", "team"];
        if is_host() {
            r.extend(["cpus", "difficulty", "bg", "fight"]);
        } else {
            r.push("ready");
        }
        r
    }

    fn send_pick(&self) {
        send(serde_json::json!({"t": "pick", "char": self.me_char, "team": self.me_team, "ready": self.me_ready || is_host()}));
    }

    pub fn set_ready(&mut self) {
        self.me_ready = true;
        self.send_pick();
    }

    pub fn update(&mut self) -> Option<Next> {
        self.t += 1;
        for m in drain() {
            match m["t"].as_str() {
                Some("start") => {
                    let seed = m["seed"].as_u64().unwrap_or(1) as u32;
                    return Some(Next::Screen(start_net_match(&m["setup"], seed)));
                }
                Some("closed") => {
                    self.msg = "Conexão perdida com o servidor.".into();
                    self.closed = true;
                }
                Some("error") => self.msg = m["msg"].as_str().unwrap_or("").to_string(),
                _ => {}
            }
        }
        let (esc, att_any) = input::with(|i| (i.code("Escape"), i.hit(0, Key::Att) || i.hit(1, Key::Att) || i.code("Enter")));
        if esc || (self.closed && att_any) {
            close();
            return Some(Next::Screen(Screen::title()));
        }
        let room = room()?;
        let rows = self.rows();
        let n = rows.len();
        let (up, down, right, left) = input::with(|i| {
            (
                i.hit(0, Key::Up) || i.hit(1, Key::Up),
                i.hit(0, Key::Down) || i.hit(1, Key::Down),
                i.hit(0, Key::Right) || i.hit(1, Key::Right),
                i.hit(0, Key::Left) || i.hit(1, Key::Left),
            )
        });
        if up {
            self.row = (self.row + n - 1) % n;
        }
        if down {
            self.row = (self.row + 1) % n;
        }
        self.row = self.row.min(n - 1);
        let d = if right {
            1
        } else if left {
            -1
        } else {
            0
        };
        let mut cpus = room.cpus;
        let mut difficulty = room.difficulty;
        let mut bg = room.bg;
        let row = rows[self.row];
        if d != 0 {
            sound::play("m_pass");
            match row {
                "char" => {
                    let nc = self.chars.len() as i32;
                    self.me_char = ((self.me_char + 1 + d + nc + 1) % (nc + 1)) - 1;
                    self.me_ready = false;
                    self.send_pick();
                }
                "team" => {
                    self.me_team = (self.me_team + d + 5) % 5;
                    self.me_ready = false;
                    self.send_pick();
                }
                "cpus" => {
                    cpus = (cpus + d).clamp(0, 8 - room.players.len() as i32);
                    send(serde_json::json!({"t": "settings", "cpus": cpus, "difficulty": difficulty, "bg": bg}));
                }
                "difficulty" => {
                    difficulty = (difficulty + d + 4) % 4;
                    send(serde_json::json!({"t": "settings", "cpus": cpus, "difficulty": difficulty, "bg": bg}));
                }
                "bg" => {
                    let nb = assets().backgrounds.len() as i32;
                    bg = ((bg + 1 + d + nb + 1) % (nb + 1)) - 1;
                    send(serde_json::json!({"t": "settings", "cpus": cpus, "difficulty": difficulty, "bg": bg}));
                }
                _ => {}
            }
        }
        if att_any {
            if row == "ready" {
                self.me_ready = !self.me_ready;
                self.send_pick();
                sound::play("m_join");
            }
            if row == "fight" {
                self.fight();
            }
        }
        let _ = back_hit;
        None
    }

    pub fn fight(&mut self) {
        let Some(room) = room() else { return };
        let me = slot();
        if !room.players.iter().all(|p| p.ready || p.slot == me) {
            self.msg = "Espere todos marcarem \"pronto\".".into();
            return;
        }
        let total = room.players.len() as i32 + room.cpus;
        let mut teams: Vec<String> = room.players.iter().map(|p| if p.team > 0 { p.team.to_string() } else { format!("solo{}", p.slot) }).collect();
        for i in 0..room.cpus {
            teams.push(format!("cpu{}", i));
        }
        teams.sort();
        teams.dedup();
        if total < 2 || teams.len() < 2 {
            self.msg = "É preciso ter pelo menos dois lados na luta.".into();
            return;
        }
        let pick = |c: i32| -> i32 {
            if c >= 0 && (c as usize) < self.chars.len() {
                self.chars[c as usize]
            } else {
                self.chars[(js_sys::Math::random() * self.chars.len() as f64).floor() as usize % self.chars.len()]
            }
        };
        let mut players: Vec<serde_json::Value> =
            room.players.iter().map(|p| serde_json::json!({"slot": p.slot, "id": pick(p.char_), "team": if p.team > 0 { p.team } else { 100 + p.slot }, "name": p.name})).collect();
        for i in 0..room.cpus {
            players.push(serde_json::json!({"slot": -1, "id": pick(-1), "team": 110 + i, "name": "COM"}));
        }
        let a = assets();
        let bg = if room.bg < 0 {
            a.backgrounds[(js_sys::Math::random() * a.backgrounds.len() as f64).floor() as usize % a.backgrounds.len()].id
        } else {
            a.backgrounds[room.bg as usize].id
        };
        send(serde_json::json!({"t": "start", "setup": {"players": players, "bg": bg, "difficulty": room.difficulty}}));
        sound::play("m_ok");
    }

    pub fn draw(&self, ctx: &Ctx) {
        menu_backdrop(ctx, self.t as f64);
        title(ctx, "SALA", 40.0, 44.0, 30.0, UI_AMBER, Align::Left);
        let c = code();
        title(ctx, if c.is_empty() { "----" } else { &c }, 110.0, 44.0, 46.0, "#ffffff", Align::Left);
        text(ctx, "Passe este código para os amigos entrarem", 250.0, 46.0, &TextOpt::default().light().size(13.0).color(UI_MUTED));
        let Some(room) = room() else {
            text(ctx, "Entrando...", W / 2.0, 270.0, &TextOpt::default().center());
            return;
        };
        let a = assets();
        for s in 0..4 {
            let p = room.players.iter().find(|q| q.slot == s);
            let x = 40.0 + s as f64 * 182.0;
            let y = 72.0;
            ctx.fill_style(if p.is_some() { "rgba(20,26,60,0.95)" } else { "rgba(20,26,60,0.45)" });
            ctx.fill_rect(x, y, 170.0, 160.0);
            let Some(p) = p else {
                text(ctx, "Vaga livre", x + 85.0, y + 80.0, &TextOpt::default().center().light().color(UI_DIM));
                continue;
            };
            let cid = if p.char_ >= 0 { self.chars.get(p.char_ as usize).copied() } else { None };
            if let Some(id) = cid {
                if let Some(img) = a.obj(id).and_then(|o| a.img(&o.bmp.head)) {
                    ctx.draw_image_scaled(img, x + 49.0, y + 8.0, 72.0, 72.0);
                }
            } else {
                title(ctx, "?", x + 85.0, y + 44.0, 56.0, UI_AMBER, Align::Center);
            }
            let me = p.slot == slot();
            text(
                ctx,
                &format!("{}{}", p.name, if me { " (você)" } else { "" }),
                x + 85.0,
                y + 98.0,
                &TextOpt::default().center().color(if me { UI_AMBER } else { "#ffffff" }).max(160.0),
            );
            let cname = cid.and_then(|id| a.obj(id)).map(|o| o.bmp.name.clone()).unwrap_or_else(|| "Aleatório".into());
            text(ctx, &cname, x + 85.0, y + 118.0, &TextOpt::default().center().light().max(160.0));
            let tl = format!("{}{}", if p.team > 0 { format!("Time {}", p.team) } else { "Independente".into() }, if room.host == p.slot { " · anfitrião" } else { "" });
            text(ctx, &tl, x + 85.0, y + 138.0, &TextOpt::default().center().light().size(12.0).color(UI_MUTED));
            if p.ready && room.host != p.slot {
                text(ctx, "PRONTO", x + 85.0, y + 152.0, &TextOpt::default().center().color(UI_GOOD));
            }
        }
        let rows = self.rows();
        for (i, r) in rows.iter().enumerate() {
            let y = 256.0 + i as f64 * 26.0;
            let on = i == self.row;
            if on {
                ctx.fill_style("rgba(255,176,0,0.2)");
                ctx.fill_rect(180.0, y - 12.0, 434.0, 24.0);
            }
            let (k, v) = match *r {
                "char" => (
                    "Seu lutador".to_string(),
                    if self.me_char >= 0 {
                        self.chars.get(self.me_char as usize).and_then(|&id| a.obj(id)).map(|o| o.bmp.name.clone()).unwrap_or_default()
                    } else {
                        "Aleatório".into()
                    },
                ),
                "team" => ("Seu time".to_string(), if self.me_team > 0 { format!("Time {}", self.me_team) } else { "Independente".into() }),
                "cpus" => ("Computadores".to_string(), room.cpus.to_string()),
                "difficulty" => ("Dificuldade".to_string(), DIFFICULTIES[room.difficulty.clamp(0, 3) as usize].to_string()),
                "bg" => ("Cenário".to_string(), if room.bg < 0 { "Aleatório".into() } else { a.backgrounds[room.bg as usize].name.clone() }),
                "ready" => ("Pronto".to_string(), if self.me_ready { "Sim".into() } else { "Não".into() }),
                _ => ("LUTAR!".to_string(), String::new()),
            };
            if *r == "fight" {
                title(ctx, &k, W / 2.0, y + 1.0, 24.0, if on { UI_AMBER } else { "#ffffff" }, Align::Center);
            } else {
                text(ctx, &k, 196.0, y, &TextOpt::default().color(if on { "#ffffff" } else { UI_MUTED }));
                text(
                    ctx,
                    &format!("{}{}{}", if on { "◀ " } else { "" }, v, if on { " ▶" } else { "" }),
                    598.0,
                    y,
                    &TextOpt::default().right().color(if on { UI_AMBER } else { "#ffffff" }),
                );
            }
        }
        if !is_host() {
            text(
                ctx,
                "O anfitrião escolhe cenário e computadores e começa a luta.",
                W / 2.0,
                256.0 + rows.len() as f64 * 26.0 + 2.0,
                &TextOpt::default().center().light().size(12.0).color(UI_MUTED),
            );
        }
        if !self.msg.is_empty() {
            text(ctx, &self.msg, W / 2.0, 432.0, &TextOpt::default().center().color("#ff9b9b"));
        }
        text(ctx, "↑/↓ escolhe · ←/→ muda · Ataque confirma · Esc sai da sala", W / 2.0, 456.0, &TextOpt::default().center().light().size(12.0).color(UI_DIM));
    }
}

// ---- partida em rede ----

pub fn hash_match(m: &Match) -> i32 {
    let mut h: i32 = m.time;
    for &o in &m.live {
        let ob = &m.objs[o];
        let v = [ob.uid, (ob.ps.x * 10.0).round() as i32, (ob.ps.y * 10.0).round() as i32, (ob.ps.z * 10.0).round() as i32, ob.frame.n, ob.health.hp.round() as i32];
        for x in v {
            h = h.wrapping_mul(31).wrapping_add(x);
        }
    }
    h
}

pub fn start_net_match(setup: &serde_json::Value, seed: u32) -> Screen {
    input::with(|i| i.reset_controllers());
    let difficulty = setup["difficulty"].as_i64().unwrap_or(1) as i32;
    let mut specs = vec![];
    for p in setup["players"].as_array().cloned().unwrap_or_default() {
        let slot = p["slot"].as_i64().unwrap_or(-1) as i32;
        let human = slot >= 0;
        let mut s = PlayerSpec::new(
            p["id"].as_i64().unwrap_or(1) as i32,
            p["team"].as_i64().unwrap_or(1) as i32,
            Con::New,
            if human { slot } else { -1 },
            if human { None } else { Some(difficulty) },
            if human { p["name"].as_str().unwrap_or("Jogador") } else { "COM" },
        );
        s.panel = true;
        specs.push(s);
    }
    let mut opts = MatchOpts::new(specs, setup["bg"].as_i64().unwrap_or(1) as i32, Mode::Vs);
    opts.seed = Some(seed);
    opts.net = true;
    let m = Match::new(assets(), opts);
    let mut cons = vec![];
    for c in m.characters() {
        let ch = m.objs[c].ch();
        if ch.player >= 0 {
            if let Some(con) = ch.con {
                cons.push((ch.player, con));
            }
        }
    }
    Screen::NetMatch(NetMatchScreen::new(m, cons))
}

pub struct NetMatchScreen {
    pub m: Match,
    pub slot: i32,
    cons: Vec<(i32, usize)>,                              // jogador -> controle daquele jogador
    inputs: HashMap<i32, HashMap<i32, Vec<(Key, bool)>>>, // quadro -> { jogador: eventos }
    frame: i32,                                           // próximo quadro a simular
    send_f: i32,                                          // próximo quadro para o qual mando minhas teclas
    pub hashes: HashMap<i32, i32>,
    remote_hash: HashMap<i32, i32>,
    pub desync: bool,
    stall: i32,
    notice: String,
    leave_t: Option<i32>,
    pending: Vec<(Key, bool)>,
}

fn key_to_str(k: Key) -> &'static str {
    k.name()
}

impl NetMatchScreen {
    pub fn new(m: Match, cons: Vec<(i32, usize)>) -> NetMatchScreen {
        let mut inputs: HashMap<i32, HashMap<i32, Vec<(Key, bool)>>> = HashMap::new();
        for f in 0..NET_DELAY {
            let e = inputs.entry(f).or_default();
            for (s, _) in &cons {
                e.insert(*s, vec![]);
            }
        }
        NetMatchScreen {
            m,
            slot: slot(),
            cons,
            inputs,
            frame: 0,
            send_f: NET_DELAY,
            hashes: HashMap::new(),
            remote_hash: HashMap::new(),
            desync: false,
            stall: 0,
            notice: String::new(),
            leave_t: None,
            pending: vec![],
        }
    }

    fn ready(&self, f: i32) -> bool {
        match self.inputs.get(&f) {
            Some(inp) => self.cons.iter().all(|(s, _)| inp.contains_key(s)),
            None => false,
        }
    }

    fn on_message(&mut self, m: &serde_json::Value) -> Option<Screen> {
        match m["t"].as_str() {
            Some("in") => {
                let f = m["f"].as_i64().unwrap_or(0) as i32;
                let s = m["s"].as_i64().unwrap_or(0) as i32;
                let evs: Vec<(Key, bool)> =
                    m["ev"].as_array().map(|a| a.iter().filter_map(|e| Some((Key::from_name(e[0].as_str()?)?, e[1].as_bool()?))).collect()).unwrap_or_default();
                self.inputs.entry(f).or_default().insert(s, evs);
            }
            Some("hash") => {
                let f = m["f"].as_i64().unwrap_or(0) as i32;
                let h = m["h"].as_i64().unwrap_or(0) as i32;
                match self.hashes.get(&f) {
                    Some(mine) if *mine != h => self.desync = true,
                    _ => {
                        self.remote_hash.insert(f, h);
                    }
                }
            }
            Some("left") => {
                self.notice = "Um jogador saiu da partida.".into();
                self.leave_t = Some(60);
            }
            Some("closed") => {
                self.notice = "Conexão perdida com o servidor.".into();
                self.leave_t = Some(60);
            }
            Some("start") => {
                let seed = m["seed"].as_u64().unwrap_or(1) as u32;
                return Some(start_net_match(&m["setup"], seed));
            }
            _ => {}
        }
        None
    }

    pub fn update(&mut self) -> Option<Next> {
        for msg in drain() {
            if let Some(s) = self.on_message(&msg) {
                return Some(Next::Screen(s));
            }
        }
        if let Some(t) = self.leave_t {
            let t = t - 1;
            self.leave_t = Some(t);
            if t <= 0 {
                self.m.ended = true;
                return Some(Next::Screen(if NET.with(|n| n.borrow().ws.is_some()) { Screen::NetLobby(NetLobbyScreen::new()) } else { Screen::title() }));
            }
            return None;
        }
        if input::with(|i| i.code("Escape")) {
            close();
            return Some(Next::Screen(Screen::title()));
        }
        if self.m.summary.is_some() {
            let att = input::with(|i| i.any_hit(Key::Att) || i.any_hit(Key::Jump));
            if self.m.time > self.m.gameover_at.unwrap_or(0) + KO_PAUSE + 30 && att {
                self.m.end();
            }
            // a partida acabou: segue sem esperar ninguém
        } else {
            // minhas teclas desde o último TU valem para o quadro send_f
            let ev: Vec<(Key, bool)> = input::with(|i| {
                let evs = std::mem::take(&mut i.controllers[0].buf);
                for (k, d) in &evs {
                    i.controllers[0].state[k.idx()] = *d;
                }
                evs
            });
            if self.send_f <= self.frame + NET_DELAY {
                let mut evs = std::mem::take(&mut self.pending);
                evs.extend(ev);
                // no primeiro quadro depois da abertura do round, as direções seguradas voltam a valer
                if self.send_f == self.m.intro && self.m.intro > 0 {
                    let held: Vec<Key> = input::with(|i| {
                        [Key::Up, Key::Down, Key::Left, Key::Right, Key::Def]
                            .into_iter()
                            .filter(|k| i.down.contains(&i.keys[0][k.idx()]) || i.down.contains(k.touch_code()))
                            .collect()
                    });
                    for k in held {
                        evs.push((k, true));
                    }
                }
                let wire: Vec<serde_json::Value> = evs.iter().map(|(k, d)| serde_json::json!([key_to_str(*k), d])).collect();
                self.inputs.entry(self.send_f).or_default().insert(self.slot, evs);
                send(serde_json::json!({"t": "in", "f": self.send_f, "ev": wire}));
                self.send_f += 1;
            } else {
                self.pending.extend(ev);
            }
            // simula os quadros que já têm as teclas de todos (até 3 por TU para recuperar atraso)
            let mut n = 0;
            while n < 3 && self.ready(self.frame) {
                let inp = self.inputs.remove(&self.frame).unwrap_or_default();
                for (s, con) in &self.cons {
                    if let Some(evs) = inp.get(s) {
                        input::with(|i| {
                            for (k, d) in evs {
                                i.controllers[*con].key(*k, *d);
                            }
                        });
                    }
                }
                self.m.frame();
                self.frame += 1;
                n += 1;
                if self.frame % NET_HASH_EVERY == 0 {
                    let h = hash_match(&self.m);
                    self.hashes.insert(self.frame, h);
                    if let Some(r) = self.remote_hash.get(&self.frame) {
                        if *r != h {
                            self.desync = true;
                        }
                    }
                    send(serde_json::json!({"t": "hash", "f": self.frame, "h": h}));
                }
                if self.m.ended {
                    break;
                }
            }
            self.stall = if n > 0 { 0 } else { self.stall + 1 };
        }
        // o controle 0 foi esvaziado acima; os demais humanos só existem na simulação
        input::with(|i| {
            for c in i.controllers.iter_mut().take(4) {
                c.buf.clear();
            }
        });
        if self.m.ended {
            send(serde_json::json!({"t": "lobby"}));
            return Some(Next::Screen(Screen::NetLobby(NetLobbyScreen::new())));
        }
        None
    }

    pub fn draw(&mut self, ctx: &Ctx) {
        self.m.draw(ctx);
        if self.stall > 15 {
            text(ctx, "Aguardando os outros jogadores...", W / 2.0, 300.0, &TextOpt::default().center().size(16.0).shadow("#000"));
        }
        if self.desync {
            text(ctx, "Partida dessincronizada", W - 10.0, H - 14.0, &TextOpt::default().right().size(12.0).color("#ff9b9b").shadow("#000"));
        }
        if !self.notice.is_empty() {
            text(ctx, &self.notice, W / 2.0, 300.0, &TextOpt::default().center().size(18.0).shadow("#000"));
        }
        text(ctx, &format!("Sala {}", code()), 10.0, H - 14.0, &TextOpt::default().size(12.0).color("#ffffff").shadow("#000"));
    }
}

// ---- ponte com os testes (api.rs) ----

pub fn state_json(g: &Game) -> String {
    let (code, slot, players, ready) = NET.with(|n| {
        let n = n.borrow();
        let players = n.room.as_ref().map(|r| r.players.len()).unwrap_or(0);
        let ready = n.room.as_ref().map(|r| r.players.iter().all(|p| p.ready || p.slot == r.host)).unwrap_or(false);
        (n.code.clone(), n.slot, players, ready)
    });
    let mut s = format!("{{\"code\":\"{}\",\"slot\":{},\"players\":{},\"allReady\":{}", code, slot, players, ready);
    if let Screen::NetMatch(n) = &g.screen {
        let h: Vec<String> = n.hashes.iter().map(|(k, v)| format!("\"{}\":{}", k, v)).collect();
        s += &format!(",\"desync\":{},\"hashes\":{{{}}}", n.desync, h.join(","));
    }
    s += "}";
    s
}

pub fn action(g: &mut Game, name: &str) {
    if let Screen::NetLobby(l) = &mut g.screen {
        match name {
            "ready" => l.set_ready(),
            "fight" => l.fight(),
            _ => {}
        }
    }
}
