//! Telas do Punho Livre: carregamento, inicial, modos, controles e a partida.
//! Cada tela devolve, no `update`, a próxima tela (ou nenhuma, para continuar nela).

use std::cell::RefCell;

use crate::audio::{music, sound};
use crate::core::consts::*;
use crate::core::input::{self, key_name, Key, KEY_ACTIONS};
use crate::engine::r#match::*;
use crate::engine::stage::StageLogic;
use crate::engine::survival::SurvivalLogic;
use crate::game::{assets, Game};
use crate::gfx::*;
use crate::net::{NetLobbyScreen, NetMatchScreen, NetScreen};
use crate::ui::hud::draw_menu_list;
use crate::ui::logo::{draw_logo, menu_backdrop};
use crate::ui::select::{SelectScreen, SelectState};
use crate::ui::settings::{AboutScreen, HowToScreen, SettingsScreen};

pub enum Screen {
    Loading { p: f64 },
    Title(TitleScreen),
    Mode(ModeScreen),
    Select(SelectScreen),
    Controls(ControlsScreen),
    Settings(SettingsScreen),
    About(AboutScreen),
    HowTo(HowToScreen),
    Match(MatchScreen),
    Net(NetScreen),
    NetLobby(NetLobbyScreen),
    NetMatch(NetMatchScreen),
}

impl Screen {
    pub fn title() -> Screen {
        Screen::Title(TitleScreen { sel: 0, t: 0 })
    }
    pub fn name(&self) -> &'static str {
        match self {
            Screen::Loading { .. } => "LoadingScreen",
            Screen::Title(_) => "TitleScreen",
            Screen::Mode(_) => "ModeScreen",
            Screen::Select(_) => "SelectScreen",
            Screen::Controls(_) => "ControlsScreen",
            Screen::Settings(_) => "SettingsScreen",
            Screen::About(_) => "AboutScreen",
            Screen::HowTo(_) => "HowToScreen",
            Screen::Match(_) => "MatchScreen",
            Screen::Net(_) => "NetScreen",
            Screen::NetLobby(_) => "NetLobbyScreen",
            Screen::NetMatch(_) => "NetMatchScreen",
        }
    }
    pub fn match_ref(&self) -> Option<&Match> {
        match self {
            Screen::Match(s) => Some(&s.m),
            Screen::NetMatch(s) => Some(&s.m),
            _ => None,
        }
    }
    pub fn match_mut(&mut self) -> Option<&mut Match> {
        match self {
            Screen::Match(s) => Some(&mut s.m),
            Screen::NetMatch(s) => Some(&mut s.m),
            _ => None,
        }
    }
}

thread_local! {
    /// escolhas da última tela de seleção, para voltar a ela depois da luta
    pub static SELECT_KEEP: RefCell<Option<SelectState>> = const { RefCell::new(None) };
}

pub fn track_for(screen: &Screen) -> &'static str {
    match screen.match_ref() {
        Some(m) => {
            if m.demo {
                "menu"
            } else if m.bg.id % 2 == 1 {
                "fight1"
            } else {
                "fight2"
            }
        }
        None => "menu",
    }
}

pub fn set_screen(g: &mut Game, s: Screen) {
    g.screen = s;
    if let Screen::Net(n) = &mut g.screen {
        n.enter();
    }
    if !matches!(g.screen, Screen::Loading { .. }) {
        music::play(Some(track_for(&g.screen)));
    }
    crate::ui::touch::specials_update(&g.screen);
    crate::ui::ads::set_banner_visible(!matches!(g.screen, Screen::Match(_) | Screen::NetMatch(_)));
}

pub fn set_screen_by_name(g: &mut Game, name: &str) {
    let s = match name {
        "TitleScreen" => Screen::title(),
        "ModeScreen" => Screen::Mode(ModeScreen { sel: 0, t: 0 }),
        "SettingsScreen" => Screen::Settings(SettingsScreen::new()),
        "AboutScreen" => Screen::About(AboutScreen::new()),
        "HowToScreen" => Screen::HowTo(HowToScreen::new()),
        "NetScreen" => Screen::Net(NetScreen::new()),
        "SelectScreen" | "SelectScreen:vs" => Screen::Select(SelectScreen::new(Mode::Vs, None)),
        "SelectScreen:stage" => Screen::Select(SelectScreen::new(Mode::Stage, None)),
        "SelectScreen:training" => Screen::Select(SelectScreen::new(Mode::Training, None)),
        "SelectScreen:survival" => Screen::Select(SelectScreen::new(Mode::Survival, None)),
        "Demo" => {
            start_demo(g);
            return;
        }
        _ => return,
    };
    set_screen(g, s);
}

/// ao sair do app a luta pausa sozinha
pub fn auto_pause(g: &mut Game) {
    if let Screen::Match(s) = &mut g.screen {
        let m = &mut s.m;
        if !m.net && !m.paused && m.summary.is_none() && !m.demo {
            m.set_paused(true);
        }
    }
}

pub fn update(g: &mut Game) {
    let m_key = input::with(|i| i.code("KeyM"));
    if m_key && !matches!(g.screen, Screen::Controls(_)) {
        sound::toggle_mute();
    }
    // fora das partidas ninguém consome as teclas dos controles: não deixa acumular
    if !matches!(g.screen, Screen::Match(_) | Screen::NetMatch(_)) {
        input::with(|i| {
            for c in i.controllers.iter_mut() {
                c.buf.clear();
            }
        });
    }
    let next = match &mut g.screen {
        Screen::Loading { .. } => None,
        Screen::Title(s) => s.update(),
        Screen::Mode(s) => s.update(),
        Screen::Select(s) => s.update(),
        Screen::Controls(s) => s.update(),
        Screen::Settings(s) => s.update(),
        Screen::About(s) => s.update(),
        Screen::HowTo(s) => s.update(),
        Screen::Match(s) => s.update(),
        Screen::Net(s) => s.update(),
        Screen::NetLobby(s) => s.update(),
        Screen::NetMatch(s) => s.update(),
    };
    if matches!(g.screen, Screen::Match(_) | Screen::NetMatch(_)) {
        crate::ui::touch::specials_poll(&g.screen);
    }
    match next {
        Some(Next::Screen(s)) => set_screen(g, s),
        Some(Next::Match(opts)) => start_match(g, opts),
        Some(Next::Demo) => start_demo(g),
        None => {}
    }
}

pub fn draw(g: &mut Game) {
    let ctx = g.ctx.clone();
    match &mut g.screen {
        Screen::Loading { p } => {
            menu_backdrop(&ctx, 0.0);
            if let Some(e) = &g.load_error {
                text(&ctx, "Não foi possível montar o jogo.", W / 2.0, 200.0, &TextOpt::default().center().size(18.0));
                text(&ctx, e, W / 2.0, 270.0, &TextOpt::default().center().light().size(11.0).color("#afdcff").max(740.0));
                return;
            }
            text(&ctx, "Carregando...", W / 2.0, 215.0, &TextOpt::default().center().size(16.0));
            ctx.fill_style("#1e337a");
            ctx.fill_rect(247.0, 240.0, 300.0, 10.0);
            ctx.fill_style(UI_AMBER);
            ctx.fill_rect(247.0, 240.0, 300.0 * *p, 10.0);
        }
        Screen::Title(s) => s.draw(&ctx),
        Screen::Mode(s) => s.draw(&ctx),
        Screen::Select(s) => s.draw(&ctx),
        Screen::Controls(s) => s.draw(&ctx),
        Screen::Settings(s) => s.draw(&ctx),
        Screen::About(s) => s.draw(&ctx),
        Screen::HowTo(s) => s.draw(&ctx),
        Screen::Match(s) => s.m.draw(&ctx),
        Screen::Net(s) => s.draw(&ctx),
        Screen::NetLobby(s) => s.draw(&ctx),
        Screen::NetMatch(s) => s.draw(&ctx),
    }
}

/// o que uma tela pede ao terminar o quadro
pub enum Next {
    Screen(Screen),
    Match(MatchOpts),
    Demo,
}

pub fn confirm_hit() -> bool {
    input::with(|i| i.any_hit(Key::Att) || i.code("Enter"))
}
pub fn back_hit() -> bool {
    input::with(|i| i.any_hit(Key::Jump) || i.code("Escape"))
}
pub fn nav_vertical(n: usize, sel: usize) -> usize {
    let (up, down) = input::with(|i| (i.any_hit(Key::Up), i.any_hit(Key::Down)));
    if up {
        sound::play("m_pass");
        return (sel + n - 1) % n;
    }
    if down {
        sound::play("m_pass");
        return (sel + 1) % n;
    }
    sel
}
/// -1, 0 ou 1 conforme esquerda/direita apertadas neste quadro
pub fn nav_horizontal() -> i32 {
    input::with(|i| {
        if i.any_hit(Key::Right) {
            1
        } else if i.any_hit(Key::Left) {
            -1
        } else {
            0
        }
    })
}

/// lutador parado (animação de respiração) desenhado em tamanho grande nos menus
pub fn draw_idle_fighter(ctx: &Ctx, id: i32, x: f64, feet_y: f64, scale: f64, flip: bool, t: i32) {
    let a = assets();
    let (Some(o), Some(sheet)) = (a.obj(id), a.sheet(id)) else { return };
    let n = [0, 1, 2, 3, 2, 1][((t / 7) % 6) as usize];
    let Some(f) = o.frame(n) else { return };
    ctx.save();
    ctx.smoothing(true);
    ctx.translate(x, feet_y);
    ctx.scale(if flip { -scale } else { scale }, scale);
    sheet.draw(ctx, f.pic, -f.centerx, -f.centery, false);
    ctx.restore();
}

// ---- tela inicial ----

const TITLE_ITEMS: [&str; 4] = ["Jogar", "Jogar em rede", "Ajustes", "Sobre"];

pub struct TitleScreen {
    pub sel: usize,
    pub t: i32,
}

impl TitleScreen {
    fn update(&mut self) -> Option<Next> {
        self.t += 1;
        self.sel = nav_vertical(TITLE_ITEMS.len(), self.sel);
        if confirm_hit() {
            sound::init();
            sound::play("m_ok");
            return Some(Next::Screen(match self.sel {
                0 => Screen::Mode(ModeScreen { sel: 0, t: 0 }),
                1 => Screen::Net(NetScreen::new()),
                2 => Screen::Settings(SettingsScreen::new()),
                _ => Screen::About(AboutScreen::new()),
            }));
        }
        None
    }
    fn draw(&self, ctx: &Ctx) {
        menu_backdrop(ctx, self.t as f64);
        // os lutadores do elenco nas laterais (dois por vez, trocam a cada ~8 s)
        let cast = [1, 2, 3, 4, 5, 6, 7, 8];
        let k = ((self.t / 240) % 4) as usize;
        draw_idle_fighter(ctx, cast[k * 2 % 8], 112.0, 430.0, 2.5, false, self.t);
        draw_idle_fighter(ctx, cast[(k * 2 + 5) % 8], W - 112.0, 430.0, 2.5, true, self.t + 20);
        draw_logo(ctx, W / 2.0, 124.0, 0.8, self.t as f64);
        let items: Vec<String> = TITLE_ITEMS.iter().map(|s| s.to_string()).collect();
        draw_menu_list(ctx, &items, self.sel, 262.0, 40.0);
        let (touch, k) = input::with(|i| (i.touch_active, i.keys[0].clone()));
        if !touch {
            let s = format!(
                "1P: {} {} {} {} move · {} ataca · {} pula · {} defende",
                key_name(&k[0]),
                key_name(&k[1]),
                key_name(&k[2]),
                key_name(&k[3]),
                key_name(&k[4]),
                key_name(&k[5]),
                key_name(&k[6])
            );
            text(ctx, &s, W / 2.0, 446.0, &TextOpt::default().center().light().size(12.0).color(UI_MUTED));
        }
        text(ctx, &format!("v{}", APP_VERSION), W - 10.0, 462.0, &TextOpt::default().right().light().size(10.0).color(UI_DIM));
    }
}

// ---- escolha do modo ----

pub struct ModeItem {
    pub key: &'static str,
    pub name: &'static str,
    pub desc: &'static str,
}

pub const MODES: [ModeItem; 7] = [
    ModeItem { key: "vs", name: "Versus", desc: "Todos contra todos ou em times, até 8 lutadores. Rounds e tempo opcionais." },
    ModeItem { key: "stage", name: "História", desc: "Atravesse 5 fases enfrentando bandidos e chefes." },
    ModeItem { key: "survival", name: "Sobrevivência", desc: "Ondas de inimigos sem fim. Até onde você aguenta?" },
    ModeItem { key: "training", name: "Treino", desc: "Pratique golpes num boneco, com MP infinito." },
    ModeItem { key: "howto", name: "Como jogar", desc: "Controles, golpes e dicas." },
    ModeItem { key: "demo", name: "Demonstração", desc: "Assista aos computadores lutando." },
    ModeItem { key: "back", name: "Voltar", desc: "" },
];

pub struct ModeScreen {
    pub sel: usize,
    pub t: i32,
}

impl ModeScreen {
    fn update(&mut self) -> Option<Next> {
        self.t += 1;
        self.sel = nav_vertical(MODES.len(), self.sel);
        if back_hit() {
            sound::play("m_cancel");
            return Some(Next::Screen(Screen::title()));
        }
        if confirm_hit() {
            sound::play("m_ok");
            return Some(match MODES[self.sel].key {
                "back" => Next::Screen(Screen::title()),
                "demo" => Next::Demo,
                "howto" => Next::Screen(Screen::HowTo(HowToScreen::new())),
                k => Next::Screen(Screen::Select(SelectScreen::new(Mode::from_name(k), None))),
            });
        }
        None
    }
    fn draw(&self, ctx: &Ctx) {
        menu_backdrop(ctx, self.t as f64);
        draw_logo(ctx, W / 2.0, 70.0, 0.4, self.t as f64);
        let items: Vec<String> = MODES.iter().map(|m| m.name.to_string()).collect();
        draw_menu_list(ctx, &items, self.sel, 150.0, 40.0);
        text(ctx, MODES[self.sel].desc, W / 2.0, 440.0, &TextOpt::default().center().light().color(UI_MUTED));
    }
}

// ---- controles ----

pub struct ControlsScreen {
    pub p: usize,
    pub a: usize,
    pub waiting: bool,
    pub t: i32,
    pub back_to_settings: bool,
}

impl ControlsScreen {
    pub fn new(back_to_settings: bool) -> ControlsScreen {
        ControlsScreen { p: 0, a: 0, waiting: false, t: 0, back_to_settings }
    }
    fn back(&self) -> Screen {
        if self.back_to_settings {
            Screen::Settings(SettingsScreen::new())
        } else {
            Screen::title()
        }
    }
    fn update(&mut self) -> Option<Next> {
        self.t += 1;
        let n = KEY_ACTIONS.len() + 1;
        if self.waiting {
            let got = input::with(|i| i.captured.take());
            if let Some(code) = got {
                self.waiting = false;
                if code != "Escape" {
                    input::with(|i| {
                        for k in i.keys.iter_mut() {
                            for a in KEY_ACTIONS {
                                if k[a.idx()] == code {
                                    k[a.idx()] = String::new();
                                }
                            }
                        }
                        i.keys[self.p][KEY_ACTIONS[self.a].idx()] = code;
                        i.pressed.clear();
                    });
                }
            }
            return None;
        }
        let (esc, jump, up, down, left, right, enter, del, reset) = input::with(|i| {
            (
                i.code("Escape"),
                i.any_hit(Key::Jump),
                i.code("ArrowUp") || i.hit(0, Key::Up),
                i.code("ArrowDown") || i.hit(0, Key::Down),
                i.code("ArrowLeft") || i.hit(0, Key::Left),
                i.code("ArrowRight") || i.hit(0, Key::Right),
                i.code("Enter") || i.hit(0, Key::Att),
                i.code("Backspace") || i.code("Delete"),
                i.code("KeyR") && i.is_down("ShiftLeft"),
            )
        });
        if esc || (jump && self.a == n - 1) {
            input::with(|i| i.save_keys());
            return Some(Next::Screen(self.back()));
        }
        if up {
            self.a = (self.a + n - 1) % n;
        }
        if down {
            self.a = (self.a + 1) % n;
        }
        if left {
            self.p = (self.p + 3) % 4;
        }
        if right {
            self.p = (self.p + 1) % 4;
        }
        if enter {
            if self.a == n - 1 {
                input::with(|i| i.save_keys());
                sound::play("m_ok");
                return Some(Next::Screen(self.back()));
            }
            self.waiting = true;
            input::with(|i| {
                i.capture = true;
                i.captured = None;
            });
        }
        if del {
            input::with(|i| i.keys[self.p][KEY_ACTIONS[self.a].idx()] = String::new());
        }
        if reset {
            input::with(|i| i.keys = input::default_keys());
        }
        None
    }
    fn draw(&self, ctx: &Ctx) {
        menu_backdrop(ctx, self.t as f64);
        title(ctx, "CONTROLES", W / 2.0, 34.0, 34.0, UI_AMBER, Align::Center);
        let (x0, y0, cw, rh) = (60.0, 84.0, 162.0, 34.0);
        panel_box(ctx, x0 - 16.0, y0 - 26.0, W - 2.0 * (x0 - 16.0), rh * KEY_ACTIONS.len() as f64 + 46.0, None);
        let keys = input::with(|i| i.keys.clone());
        for p in 0..4 {
            text(ctx, &format!("Jogador {}", p + 1), x0 + 120.0 + p as f64 * cw, y0, &TextOpt::default().color(if p == self.p { UI_PLAYERS[p] } else { UI_MUTED }));
        }
        for (i, a) in KEY_ACTIONS.iter().enumerate() {
            let y = y0 + 30.0 + i as f64 * rh;
            text(ctx, a.label(), x0, y, &TextOpt::default().color(UI_MUTED));
            for p in 0..4 {
                let on = p == self.p && i == self.a;
                if on {
                    ctx.fill_style(if self.waiting { "#7a2a3a" } else { "rgba(255,176,0,0.25)" });
                    ctx.fill_rect(x0 + 110.0 + p as f64 * cw, y - 13.0, cw - 14.0, 26.0);
                }
                let s = if on && self.waiting { "aperte uma tecla".to_string() } else { key_name(&keys[p][a.idx()]) };
                text(ctx, &s, x0 + 120.0 + p as f64 * cw, y, &TextOpt::default().light().color(UI_TEXT));
            }
        }
        let ok_y = y0 + 30.0 + KEY_ACTIONS.len() as f64 * rh + 22.0;
        let on = self.a == KEY_ACTIONS.len();
        if on {
            ctx.fill_style(UI_AMBER);
            ctx.fill_rect(W / 2.0 - 80.0, ok_y - 16.0, 160.0, 32.0);
        }
        title(ctx, "SALVAR", W / 2.0, ok_y, 22.0, if on { "#120a1e" } else { UI_TEXT }, Align::Center);
        text(ctx, "Setas escolhem · Enter troca a tecla · Delete apaga · Esc salva e sai", W / 2.0, 448.0, &TextOpt::default().center().light().size(12.0).color(UI_MUTED));
    }
}

// ---- partida ----

pub struct MatchScreen {
    pub m: Match,
}

impl MatchScreen {
    fn update(&mut self) -> Option<Next> {
        let m = &mut self.m;
        if m.slowmo > 0 && !m.paused {
            m.slowmo -= 1;
            if m.slowmo % 3 != 0 {
                return None;
            }
        }
        m.frame();
        if m.ended {
            if m.restart_requested {
                return Some(Next::Match(m.opts.clone()));
            }
            return Some(match m.opts.on_end {
                EndAction::Title => Next::Screen(Screen::title()),
                EndAction::ModeMenu => Next::Screen(Screen::Mode(ModeScreen { sel: 0, t: 0 })),
                EndAction::Select => Next::Screen(Screen::Select(SelectScreen::new(m.mode, SELECT_KEEP.with(|k| k.borrow().clone())))),
                EndAction::NetLobby => Next::Screen(Screen::NetLobby(NetLobbyScreen::new())),
                EndAction::Nothing => {
                    if m.demo {
                        Next::Screen(Screen::Mode(ModeScreen { sel: 0, t: 0 }))
                    } else {
                        Next::Screen(Screen::title())
                    }
                }
            });
        }
        None
    }
}

/// monta a partida (com a lógica do modo, se houver) e entra nela
pub fn start_match(g: &mut Game, opts: MatchOpts) {
    input::with(|i| i.reset_controllers());
    let mode = opts.mode;
    let stage_index = opts.stage_index;
    let mut m = Match::new(assets(), opts);
    match mode {
        Mode::Stage => {
            let logic = StageLogic::new(&mut m, stage_index);
            m.mode_logic = Some(ModeLogic::Stage(logic));
        }
        Mode::Survival => {
            let logic = SurvivalLogic::new(&mut m);
            m.mode_logic = Some(ModeLogic::Survival(logic));
        }
        _ => {}
    }
    set_screen(g, Screen::Match(MatchScreen { m }));
}

pub fn start_demo(g: &mut Game) {
    let a = assets();
    let chars: Vec<i32> = a.character_list().into_iter().filter(|&c| c != 30).collect();
    let mut players = vec![];
    for i in 0..4 {
        let id = chars[(js_sys::Math::random() * chars.len() as f64).floor() as usize % chars.len()];
        players.push(PlayerSpec::new(id, 100 + i, Con::New, -1, Some(2), "COM"));
    }
    let bg = a.backgrounds[(js_sys::Math::random() * a.backgrounds.len() as f64).floor() as usize % a.backgrounds.len()].id;
    let mut opts = MatchOpts::new(players, bg, Mode::Demo);
    opts.on_end = EndAction::ModeMenu;
    start_match(g, opts);
}

// ---- ponte com os testes (api.rs) ----

#[derive(serde::Deserialize)]
struct JsonPos {
    x: f64,
    z: f64,
}

#[derive(serde::Deserialize)]
struct JsonPlayer {
    id: i32,
    team: i32,
    #[serde(default)]
    player: Option<i32>,
    #[serde(default)]
    ai: Option<i32>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    pos: Option<JsonPos>,
    #[serde(default)]
    panel: Option<bool>,
}

#[derive(serde::Deserialize)]
struct JsonMatch {
    players: Vec<JsonPlayer>,
    #[serde(default)]
    bg: Option<i32>,
    #[serde(default)]
    mode: Option<String>,
    #[serde(default)]
    weapons: Option<bool>,
    #[serde(default)]
    rounds: Option<i32>,
    #[serde(default, rename = "timeLimit")]
    time_limit: Option<i32>,
    #[serde(default, rename = "stageIndex")]
    stage_index: Option<usize>,
}

pub fn start_match_json(g: &mut Game, json: &str) -> Result<(), String> {
    let j: JsonMatch = serde_json::from_str(json).map_err(|e| e.to_string())?;
    let players = j
        .players
        .iter()
        .map(|p| {
            let con = match p.player {
                Some(h) if h >= 0 => Con::Human(h as usize),
                _ => Con::New,
            };
            let mut s = PlayerSpec::new(p.id, p.team, con, p.player.unwrap_or(-1), p.ai, p.name.as_deref().unwrap_or("COM"));
            s.pos = p.pos.as_ref().map(|q| (q.x, q.z));
            s.panel = p.panel.unwrap_or(true);
            s
        })
        .collect();
    let mut opts = MatchOpts::new(players, j.bg.unwrap_or(2), Mode::from_name(j.mode.as_deref().unwrap_or("vs")));
    opts.weapons = j.weapons.unwrap_or(true);
    opts.rounds = j.rounds.unwrap_or(1);
    opts.time_limit = j.time_limit.unwrap_or(0);
    opts.stage_index = j.stage_index.unwrap_or(0);
    opts.on_end = EndAction::Title;
    start_match(g, opts);
    Ok(())
}

pub fn state_json(g: &Game) -> String {
    let mut s = format!("{{\"screen\":\"{}\"", g.screen.name());
    if let Some(m) = g.screen.match_ref() {
        let chars: Vec<String> = m
            .characters()
            .iter()
            .map(|&c| {
                let o = &m.objs[c];
                format!(
                    "{{\"id\":{},\"hp\":{},\"hpBound\":{},\"mp\":{},\"frame\":{},\"state\":{},\"player\":{},\"team\":{},\"x\":{},\"z\":{},\"y\":{},\"dir\":{}}}",
                    o.id,
                    o.health.hp,
                    o.health.hp_bound,
                    o.health.mp,
                    o.frame.n,
                    o.state(),
                    o.ch().player,
                    o.team,
                    o.ps.x,
                    o.ps.z,
                    o.ps.y,
                    o.ps.dir
                )
            })
            .collect();
        s += &format!(
            ",\"match\":{{\"mode\":\"{}\",\"paused\":{},\"time\":{},\"round\":{},\"rounds\":{},\"roundTime\":{},\"intro\":{},\"summary\":{},\"ended\":{},\"banner\":{},\"wave\":{},\"stage\":{},\"chars\":[{}]}}",
            m.mode.name(),
            m.paused,
            m.time,
            m.round,
            m.rounds,
            m.round_time,
            m.intro,
            m.summary.is_some(),
            m.ended,
            m.banner.as_ref().map(|b| format!("\"{}\"", b.text)).unwrap_or("null".into()),
            match &m.mode_logic {
                Some(ModeLogic::Survival(s)) => s.wave,
                _ => 0,
            },
            match &m.mode_logic {
                Some(ModeLogic::Stage(s)) => format!("\"{}-{}\"", s.stage_index + 1, s.phase + 1),
                _ => "null".into(),
            },
            chars.join(",")
        );
    }
    s += "}";
    s
}

pub fn poke(g: &mut Game, what: &str, index: usize, value: f64) {
    let Some(m) = g.screen.match_mut() else { return };
    if what == "paused" {
        m.set_paused(value != 0.0);
        return;
    }
    let chars = m.characters();
    let Some(&c) = chars.get(index) else { return };
    let o = &mut m.objs[c];
    match what {
        "hp" => o.health.hp = value,
        "hpBound" => o.health.hp_bound = value,
        "hpFull" => {
            o.health.hp = value;
            o.health.hp_full = value;
            o.health.hp_bound = value;
        }
        "mp" => o.health.mp = value,
        _ => {}
    }
}
