//! Jogo em rede no app nativo: dois jogos (uma thread cada, com o próprio estado) entram na mesma sala
//! do servidor Node, lutam e têm que ficar sincronizados. Precisa de `node` e de `server/node_modules`
//! (`npm ci --prefix server`); sem eles o teste avisa e passa.

use std::net::TcpListener;
use std::process::{Child, Command, Stdio};
use std::sync::mpsc;
use std::time::{Duration, Instant};

use punho_livre::game::{self, with_game};
use punho_livre::gfx::{ctx_of, make_canvas};
use punho_livre::net;
use punho_livre::ui::screens;

struct Server(Child);
impl Drop for Server {
    fn drop(&mut self) {
        let _ = self.0.kill();
    }
}

fn start_server() -> Option<(Server, u16)> {
    let port = TcpListener::bind("127.0.0.1:0").ok()?.local_addr().ok()?.port();
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../server");
    if !root.join("node_modules").exists() {
        return None;
    }
    let child = Command::new("node").arg(root.join("server.js")).env("PORT", port.to_string()).stdout(Stdio::null()).stderr(Stdio::null()).spawn().ok()?;
    let server = Server(child);
    for _ in 0..50 {
        if std::net::TcpStream::connect(("127.0.0.1", port)).is_ok() {
            return Some((server, port));
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    None
}

fn screen() -> String {
    with_game(|g| g.screen.name().to_string()).unwrap_or_default()
}

/// roda quadros até `done` ser verdade (ou estourar o tempo)
fn run_until(secs: u64, mut done: impl FnMut() -> bool) -> bool {
    let end = Instant::now() + Duration::from_secs(secs);
    while Instant::now() < end {
        game::update();
        if done() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(8));
    }
    false
}

fn boot() {
    game::init(ctx_of(&make_canvas(794.0, 470.0)));
    assert!(run_until(120, || screen() == "TitleScreen"), "o carregamento não terminou");
}

fn net_state() -> serde_json::Value {
    serde_json::from_str(&with_game(|g| net::state_json(g)).unwrap()).unwrap()
}

#[test]
fn two_native_games_stay_in_sync() {
    let Some((_server, port)) = start_server() else {
        eprintln!("pulado: sem node ou sem server/node_modules");
        return;
    };
    let addr = format!("127.0.0.1:{port}");
    let (code_tx, code_rx) = mpsc::channel::<String>();
    let (done_tx, done_rx) = mpsc::channel::<serde_json::Value>();

    let host_addr = addr.clone();
    let host_done = done_tx.clone();
    let host = std::thread::spawn(move || {
        boot();
        with_game(|g| screens::set_screen_by_name(g, "NetScreen"));
        net::connect(&host_addr, serde_json::json!({"t": "create", "name": "Ana"}));
        assert!(run_until(10, || screen() == "NetLobbyScreen" && !net_state()["code"].as_str().unwrap_or("").is_empty()), "o anfitrião não entrou na sala");
        code_tx.send(net_state()["code"].as_str().unwrap().to_string()).unwrap();
        assert!(run_until(10, || net_state()["players"] == 2 && net_state()["allReady"] == true), "o outro jogador não ficou pronto");
        with_game(|g| net::action(g, "fight"));
        assert!(run_until(10, || screen() == "NetMatchScreen"), "a luta não começou no anfitrião");
        run_until(8, || false);
        host_done.send(net_state()).unwrap();
    });

    let guest = std::thread::spawn(move || {
        boot();
        let code = code_rx.recv_timeout(Duration::from_secs(150)).expect("código da sala");
        with_game(|g| screens::set_screen_by_name(g, "NetScreen"));
        net::connect(&addr, serde_json::json!({"t": "join", "name": "Beto", "code": code}));
        assert!(run_until(10, || screen() == "NetLobbyScreen" && net_state()["players"] == 2), "o convidado não entrou");
        with_game(|g| net::action(g, "ready"));
        assert!(run_until(10, || screen() == "NetMatchScreen"), "a luta não começou no convidado");
        run_until(8, || false);
        done_tx.send(net_state()).unwrap();
    });

    host.join().expect("thread do anfitrião");
    guest.join().expect("thread do convidado");
    let (a, b) = (done_rx.recv().unwrap(), done_rx.recv().unwrap());
    for s in [&a, &b] {
        assert_eq!(s["desync"], false, "partida dessincronizada");
    }
    let (ha, hb) = (a["hashes"].as_object().unwrap(), b["hashes"].as_object().unwrap());
    let common: Vec<_> = ha.keys().filter(|k| hb.contains_key(*k)).collect();
    assert!(common.len() >= 2, "poucos quadros comparados: {}", common.len());
    for k in common {
        assert_eq!(ha[k], hb[k], "divergiu no quadro {k}");
    }
}
