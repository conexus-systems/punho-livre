//! Seleção de lutadores e ajustes da partida.
//! Cada jogador (até 4 no mesmo aparelho) entra com ATAQUE, escolhe o lutador na
//! grade, depois o time, e fica pronto. Com todos prontos aparecem os ajustes.

use crate::audio::sound;
use crate::content::roster::fighter_def;
use crate::core::consts::*;
use crate::core::input::{self, key_name, Key, Tag};
use crate::core::save;
use crate::engine::ai::{classify_special, SeqKey, SPECIAL_KEYS};
use crate::engine::r#match::*;
use crate::engine::stage::STAGE_COUNT;
use crate::game::assets;
use crate::gfx::*;
use crate::ui::logo::menu_backdrop;
use crate::ui::screens::{back_hit, confirm_hit, nav_horizontal, nav_vertical, Next, Screen, SELECT_KEEP};

pub fn cmd_label(tag: Tag) -> &'static str {
    match tag {
        Tag::Fa => "D → A",
        Tag::Ua => "D ↑ A",
        Tag::Da => "D ↓ A",
        Tag::Fj => "D → J",
        Tag::Uj => "D ↑ J",
        Tag::Dj => "D ↓ J",
        Tag::Ja => "D J A",
        _ => "",
    }
}

/// golpe especial de um lutador, com uma descrição curta do que faz
pub struct SpecialView {
    pub tag: Tag,
    pub cmd: &'static str,
    pub seq: [SeqKey; 3],
    pub kind: String,
    pub cost: f64,
}

pub fn specials_of(id: i32) -> Vec<SpecialView> {
    let a = assets();
    let Some(o) = a.obj(id) else { return vec![] };
    let def = fighter_def(id);
    let mut out = vec![];
    for (tag, seq) in SPECIAL_KEYS {
        let Some(start) = o.frame(0).and_then(|f| f.tag(tag)) else { continue };
        if o.frame(start).is_none() {
            continue;
        }
        let k = classify_special(o, start);
        let named = def.as_ref().and_then(|d| d.specials.iter().find(|s| s.tag == tag)).map(|s| s.label.to_string());
        let kind = named.unwrap_or_else(|| {
            if k.heal {
                "Cura".into()
            } else if k.teleport {
                "Teleporte".into()
            } else if k.ranged {
                "Disparo".into()
            } else {
                "Golpe forte".into()
            }
        });
        out.push(SpecialView { tag, cmd: cmd_label(tag), seq, kind, cost: k.cost });
    }
    out
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum PState {
    Off,
    Char,
    Team,
    Ready,
}

#[derive(Clone, Debug)]
pub struct PlayerSel {
    pub p: usize,
    pub state: PState,
    pub cur: usize,
    pub team: usize,
}

/// escolhas que sobrevivem à luta (para voltar à tela de seleção)
#[derive(Clone, Debug)]
pub struct SelectState {
    pub players: Vec<PlayerSel>,
    pub cpus: i32,
    pub cpu_team: usize,
    pub bg: i32,
    pub stage: usize,
}

#[derive(Clone, Copy, PartialEq)]
enum Phase {
    Pick,
    Settings,
}

pub const ROUND_OPTIONS: [i32; 3] = [1, 3, 5];
pub const TIME_OPTIONS: [i32; 4] = [0, 30, 60, 90];

struct Item {
    k: &'static str,
    label: String,
    value: Option<String>,
    max: i32,
}

pub struct SelectScreen {
    pub mode: Mode,
    chars: Vec<i32>,
    t: i32,
    cells: usize,
    st: SelectState,
    phase: Phase,
    sel: usize,
    msg: String,
}

impl SelectScreen {
    pub fn new(mode: Mode, keep: Option<SelectState>) -> SelectScreen {
        let chars = assets().character_list();
        let cells = chars.len() + 1; // a última é "Aleatório"
        let had_keep = keep.is_some();
        let mut st = keep.unwrap_or(SelectState {
            players: (0..4).map(|p| PlayerSel { p, state: PState::Off, cur: p, team: 0 }).collect(),
            cpus: if mode == Mode::Stage || mode == Mode::Survival { 0 } else { 1 },
            cpu_team: 0,
            bg: -1,
            stage: 0,
        });
        let phase = if had_keep && mode != Mode::Training { Phase::Settings } else { Phase::Pick };
        if had_keep && mode == Mode::Training {
            for p in &mut st.players {
                if p.state == PState::Ready {
                    p.state = PState::Char;
                }
            }
        }
        SelectScreen { mode, chars, t: 0, cells, st, phase, sel: 0, msg: String::new() }
    }

    fn joined(&self) -> Vec<&PlayerSel> {
        self.st.players.iter().filter(|p| p.state != PState::Off).collect()
    }

    pub fn update(&mut self) -> Option<Next> {
        self.t += 1;
        if self.phase == Phase::Pick {
            self.update_pick()
        } else {
            self.update_settings()
        }
    }

    fn move_cursor(&mut self, pi: usize, dx: i32, dy: i32) {
        let per_row = 10i32;
        let n = self.cells as i32;
        let mut c = self.st.players[pi].cur as i32;
        if dx != 0 {
            c = (c + dx + n) % n;
        }
        if dy != 0 {
            let next = c + dy * per_row;
            if next >= 0 && next < n {
                c = next;
            }
        }
        self.st.players[pi].cur = c as usize;
        sound::play("m_pass");
    }

    fn update_pick(&mut self) -> Option<Next> {
        if input::with(|i| i.code("Escape")) {
            return Some(Next::Screen(Screen::Mode(crate::ui::screens::ModeScreen { sel: 0, t: 0 })));
        }
        for pi in 0..4 {
            let p = self.st.players[pi].p;
            let hit = |a: Key| input::with(|i| i.hit(p, a) || (p == 0 && a == Key::Att && i.code("Enter")));
            if self.st.players[pi].state == PState::Off {
                if hit(Key::Att) {
                    self.st.players[pi].state = PState::Char;
                    sound::play("m_join");
                }
                continue;
            }
            if hit(Key::Jump) {
                sound::play("m_cancel");
                match self.st.players[pi].state {
                    PState::Char => {
                        if p == 0 && self.joined().len() == 1 {
                            return Some(Next::Screen(Screen::Mode(crate::ui::screens::ModeScreen { sel: 0, t: 0 })));
                        }
                        self.st.players[pi].state = PState::Off;
                    }
                    PState::Team => self.st.players[pi].state = PState::Char,
                    _ => self.st.players[pi].state = if self.mode != Mode::Vs { PState::Char } else { PState::Team },
                }
                continue;
            }
            match self.st.players[pi].state {
                PState::Char => {
                    if hit(Key::Left) {
                        self.move_cursor(pi, -1, 0);
                    }
                    if hit(Key::Right) {
                        self.move_cursor(pi, 1, 0);
                    }
                    if hit(Key::Up) {
                        self.move_cursor(pi, 0, -1);
                    }
                    if hit(Key::Down) {
                        self.move_cursor(pi, 0, 1);
                    }
                    if hit(Key::Att) {
                        self.st.players[pi].state = if self.mode != Mode::Vs { PState::Ready } else { PState::Team };
                        sound::play("m_join");
                    }
                }
                PState::Team => {
                    if hit(Key::Left) {
                        self.st.players[pi].team = (self.st.players[pi].team + 4) % 5;
                        sound::play("m_pass");
                    }
                    if hit(Key::Right) {
                        self.st.players[pi].team = (self.st.players[pi].team + 1) % 5;
                        sound::play("m_pass");
                    }
                    if hit(Key::Att) {
                        self.st.players[pi].state = PState::Ready;
                        sound::play("m_join");
                    }
                }
                _ => {}
            }
        }
        let j = self.joined();
        if !j.is_empty() && j.iter().all(|p| p.state == PState::Ready) {
            if self.mode == Mode::Training {
                return self.fight();
            }
            self.phase = Phase::Settings;
            self.sel = 0;
            self.msg.clear();
            sound::play("m_ok");
        }
        None
    }

    fn open_stages(&self) -> usize {
        STAGE_COUNT.min((save::progress().story_best + 1).max(1) as usize)
    }

    fn items(&mut self) -> Vec<Item> {
        let humans = self.joined().len() as i32;
        let s = save::settings();
        let mut items = vec![];
        match self.mode {
            Mode::Stage => {
                items.push(Item { k: "cpus", label: "Aliados (computador)".into(), value: Some(self.st.cpus.to_string()), max: 3.min(4 - humans) });
                let open = self.open_stages();
                self.st.stage = self.st.stage.min(open - 1);
                items.push(Item {
                    k: "stage",
                    label: "Começar na fase".into(),
                    value: Some(format!("{} de {} liberada{}", self.st.stage + 1, open, if open > 1 { "s" } else { "" })),
                    max: 0,
                });
            }
            Mode::Survival => {
                items.push(Item { k: "cpus", label: "Aliados (computador)".into(), value: Some(self.st.cpus.to_string()), max: 3.min(4 - humans) });
            }
            _ => {
                items.push(Item { k: "cpus", label: "Computadores".into(), value: Some(self.st.cpus.to_string()), max: 8 - humans });
                items.push(Item {
                    k: "cpuTeam",
                    label: "Time dos computadores".into(),
                    value: Some(if self.st.cpu_team > 0 { TEAM_LABELS[self.st.cpu_team].to_string() } else { "Cada um por si".into() }),
                    max: 0,
                });
                let a = assets();
                items.push(Item {
                    k: "bg",
                    label: "Cenário".into(),
                    value: Some(if self.st.bg < 0 { "Sorteado".into() } else { a.backgrounds[self.st.bg as usize].name.clone() }),
                    max: 0,
                });
                items.push(Item {
                    k: "rounds",
                    label: "Rounds".into(),
                    value: Some(match s.rounds {
                        3 => "Melhor de 3".into(),
                        5 => "Melhor de 5".into(),
                        _ => "Luta única".to_string(),
                    }),
                    max: 0,
                });
                items.push(Item {
                    k: "time",
                    label: "Tempo por round".into(),
                    value: Some(if s.time_limit == 0 { "Sem limite".to_string() } else { format!("{} s", s.time_limit) }),
                    max: 0,
                });
            }
        }
        items.push(Item { k: "diff", label: "Dificuldade".into(), value: Some(DIFFICULTIES[save::difficulty() as usize].to_string()), max: 0 });
        items.push(Item { k: "fight", label: "LUTAR!".into(), value: None, max: 0 });
        items.push(Item { k: "back", label: "Trocar lutadores".into(), value: None, max: 0 });
        items
    }

    fn update_settings(&mut self) -> Option<Next> {
        let items = self.items();
        let n = items.len();
        self.sel = nav_vertical(n, self.sel).min(n - 1);
        let k = items[self.sel].k;
        let max = items[self.sel].max;
        let d = nav_horizontal();
        if d != 0 {
            sound::play("m_pass");
            self.msg.clear();
            match k {
                "cpus" => self.st.cpus = (self.st.cpus + d).clamp(0, max),
                "cpuTeam" => self.st.cpu_team = ((self.st.cpu_team as i32 + d + 5) % 5) as usize,
                "bg" => {
                    let nb = assets().backgrounds.len() as i32;
                    self.st.bg = ((self.st.bg + 1 + d + nb + 1) % (nb + 1)) - 1;
                }
                "stage" => {
                    let open = self.open_stages() as i32;
                    self.st.stage = ((self.st.stage as i32 + d + open) % open) as usize;
                }
                "rounds" => {
                    let cur = ROUND_OPTIONS.iter().position(|&r| r == save::settings().rounds).unwrap_or(0) as i32;
                    let nx = ROUND_OPTIONS[((cur + d + 3) % 3) as usize];
                    save::edit_settings(|s| s.rounds = nx);
                    save::save();
                }
                "time" => {
                    let cur = TIME_OPTIONS.iter().position(|&r| r == save::settings().time_limit).unwrap_or(0) as i32;
                    let nx = TIME_OPTIONS[((cur + d + 4) % 4) as usize];
                    save::edit_settings(|s| s.time_limit = nx);
                    save::save();
                }
                "diff" => save::set_difficulty(save::difficulty() + d),
                _ => {}
            }
        }
        if back_hit() {
            self.unready();
            return None;
        }
        if confirm_hit() {
            match k {
                "fight" => return self.fight(),
                "back" => self.unready(),
                "diff" => save::set_difficulty(save::difficulty() + 1),
                _ => {}
            }
        }
        None
    }

    fn unready(&mut self) {
        sound::play("m_cancel");
        self.phase = Phase::Pick;
        for p in &mut self.st.players {
            if p.state != PState::Off {
                p.state = PState::Char;
            }
        }
    }

    fn char_at(&self, cur: usize) -> Option<i32> {
        self.chars.get(cur).copied()
    }

    fn random_char(&self) -> i32 {
        let list: Vec<i32> = self.chars.iter().copied().filter(|&c| c != 30).collect();
        list[(js_sys::Math::random() * list.len() as f64).floor() as usize % list.len()]
    }

    fn fight(&mut self) -> Option<Next> {
        let humans: Vec<PlayerSel> = self.joined().into_iter().cloned().collect();
        let a = assets();
        SELECT_KEEP.with(|k| *k.borrow_mut() = Some(self.st.clone()));
        if self.mode == Mode::Training {
            let mut players: Vec<PlayerSpec> =
                humans.iter().map(|pl| PlayerSpec::new(self.char_at(pl.cur).unwrap_or(self.chars[0]), 1, Con::Human(pl.p), pl.p as i32, None, &format!("{}P", pl.p + 1))).collect();
            players.push(PlayerSpec::new(30, 2, Con::New, -1, None, "Boneco"));
            sound::play("m_ok");
            let bg = a.backgrounds.iter().find(|b| b.name == "Dojô").map(|b| b.id).unwrap_or(a.backgrounds[0].id);
            let mut opts = MatchOpts::new(players, bg, Mode::Training);
            opts.weapons = false;
            opts.on_end = EndAction::Select;
            return Some(Next::Match(opts));
        }
        let coop = self.mode == Mode::Stage || self.mode == Mode::Survival;
        let mut players: Vec<PlayerSpec> = humans
            .iter()
            .map(|pl| {
                let id = self.char_at(pl.cur).unwrap_or_else(|| self.random_char());
                let team = if coop {
                    1
                } else if pl.team > 0 {
                    pl.team as i32
                } else {
                    100 + pl.p as i32
                };
                PlayerSpec::new(id, team, Con::Human(pl.p), pl.p as i32, None, &format!("{}P", pl.p + 1))
            })
            .collect();
        for i in 0..self.st.cpus {
            let team = if coop {
                1
            } else if self.st.cpu_team > 0 {
                self.st.cpu_team as i32
            } else {
                110 + i
            };
            players.push(PlayerSpec::new(self.random_char(), team, Con::New, -1, Some(save::difficulty()), "COM"));
        }
        if !coop {
            let mut teams: Vec<i32> = players.iter().map(|p| p.team).collect();
            teams.sort();
            teams.dedup();
            if players.len() < 2 || teams.len() < 2 {
                self.msg = if players.len() < 2 { "Adicione computadores ou mais jogadores.".into() } else { "Todos estão no mesmo time: mude os times.".into() };
                sound::play("m_cancel");
                return None;
            }
        }
        sound::play("m_ok");
        let s = save::settings();
        let bg = if self.st.bg < 0 {
            a.backgrounds[(js_sys::Math::random() * a.backgrounds.len() as f64).floor() as usize % a.backgrounds.len()].id
        } else {
            a.backgrounds[self.st.bg as usize].id
        };
        let mut opts = match self.mode {
            Mode::Stage => {
                let mut o = MatchOpts::new(players, crate::engine::stage::stages()[self.st.stage].bg, Mode::Stage);
                o.stage_index = self.st.stage;
                o.weapons = false;
                o
            }
            Mode::Survival => {
                let mut o = MatchOpts::new(players, bg, Mode::Survival);
                o.weapons = false;
                o
            }
            _ => {
                let mut o = MatchOpts::new(players, bg, Mode::Vs);
                o.rounds = s.rounds;
                o.time_limit = s.time_limit;
                o
            }
        };
        opts.on_end = EndAction::Select;
        Some(Next::Match(opts))
    }

    // ---- desenho ----

    pub fn draw(&mut self, ctx: &Ctx) {
        menu_backdrop(ctx, self.t as f64);
        title(ctx, "ESCOLHA SEU LUTADOR", 28.0, 26.0, 28.0, UI_TEXT, Align::Left);
        let name = match self.mode {
            Mode::Stage => "HISTÓRIA",
            Mode::Training => "TREINO",
            Mode::Survival => "SOBREVIVÊNCIA",
            _ => "VERSUS",
        };
        title(ctx, name, W - 28.0, 26.0, 22.0, UI_AMBER, Align::Right);
        self.draw_grid(ctx);
        for i in 0..4 {
            self.draw_card(ctx, i, 22.0 + i as f64 * 190.0, 142.0, 180.0, 306.0);
        }
        let (touch, k) = input::with(|i| (i.touch_active, i.keys.clone()));
        let hint = if touch {
            "A entra e confirma · J volta · direcional escolhe".to_string()
        } else {
            format!("1P: {} entra e confirma · {} volta · 2P: {} entra", key_name(&k[0][4]), key_name(&k[0][5]), key_name(&k[1][4]))
        };
        text(ctx, &hint, W / 2.0, 460.0, &TextOpt::default().center().light().size(12.0).color(UI_MUTED));
        if self.phase == Phase::Settings {
            self.draw_settings(ctx);
        }
    }

    fn draw_grid(&self, ctx: &Ctx) {
        let a = assets();
        let (cw, gap) = (70.0, 6.0);
        let x0 = (W - (10.0 * cw + 9.0 * gap)) / 2.0;
        let y0 = 54.0;
        for i in 0..self.cells {
            let x = x0 + (i % 10) as f64 * (cw + gap);
            let y = y0 + (i / 10) as f64 * (cw + gap);
            ctx.fill_style(UI_PANEL);
            ctx.fill_rect(x, y, cw, cw);
            if let Some(id) = self.char_at(i) {
                let o = a.obj(id).unwrap();
                if let Some(img) = a.img(&o.bmp.head) {
                    ctx.draw_image_scaled(img, x + 2.0, y + 2.0, cw - 4.0, cw - 4.0);
                }
                ctx.fill_style("rgba(5,8,20,0.7)");
                ctx.fill_rect(x, y + cw - 16.0, cw, 16.0);
                text(ctx, &o.bmp.name, x + cw / 2.0, y + cw - 8.0, &TextOpt::default().center().size(11.0).max(cw - 4.0));
            } else {
                title(ctx, "?", x + cw / 2.0, y + cw / 2.0 - 6.0, 48.0, UI_AMBER, Align::Center);
                text(ctx, "Aleatório", x + cw / 2.0, y + cw - 8.0, &TextOpt::default().center().size(11.0));
            }
            // cursores dos jogadores
            let here: Vec<&PlayerSel> = self.st.players.iter().filter(|p| p.state != PState::Off && p.cur == i).collect();
            for (k, p) in here.iter().enumerate() {
                let col = UI_PLAYERS[p.p];
                let inset = k as f64 * 4.0;
                ctx.stroke_style(col);
                ctx.line_width(3.0);
                ctx.stroke_rect(x + 1.5 + inset, y + 1.5 + inset, cw - 3.0 - inset * 2.0, cw - 3.0 - inset * 2.0);
                ctx.fill_style(col);
                ctx.fill_rect(x + k as f64 * 22.0, y - 9.0, 22.0, 12.0);
                text(ctx, &format!("{}P", p.p + 1), x + k as f64 * 22.0 + 11.0, y - 3.0, &TextOpt::default().center().size(10.0).color("#120a1e"));
            }
        }
    }

    fn draw_card(&self, ctx: &Ctx, pi: usize, x: f64, y: f64, w: f64, h: f64) {
        let pl = &self.st.players[pi];
        let col = UI_PLAYERS[pl.p];
        panel_box(ctx, x, y, w, h, Some(col));
        if pl.state == PState::Off {
            title(ctx, &format!("{}P", pl.p + 1), x + w / 2.0, y + 100.0, 44.0, col, Align::Center);
            let blink = (self.t / 20) % 2 == 0;
            let c = if blink { UI_TEXT } else { UI_MUTED };
            text(ctx, "Aperte ATAQUE", x + w / 2.0, y + 146.0, &TextOpt::default().center().size(14.0).color(c));
            text(ctx, "para entrar", x + w / 2.0, y + 164.0, &TextOpt::default().center().size(14.0).color(c));
            if !input::with(|i| i.touch_active) {
                let k = input::with(|i| i.keys[pl.p][4].clone());
                text(ctx, &format!("tecla {}", key_name(&k)), x + w / 2.0, y + 192.0, &TextOpt::default().center().light().size(12.0).color(UI_DIM));
            }
            return;
        }
        let a = assets();
        let cid = self.char_at(pl.cur);
        if let Some(id) = cid {
            if let Some(img) = a.obj(id).and_then(|o| a.img(&o.bmp.head)) {
                ctx.draw_image_scaled(img, x + 8.0, y + 10.0, 72.0, 72.0);
            }
        } else {
            title(ctx, "?", x + 44.0, y + 46.0, 56.0, UI_AMBER, Align::Center);
        }
        let name = cid.and_then(|id| a.obj(id)).map(|o| o.bmp.name.clone()).unwrap_or_else(|| "Aleatório".into());
        title(ctx, &name, x + 88.0, y + 26.0, 22.0, UI_TEXT, Align::Left);
        text(ctx, &format!("{}P", pl.p + 1), x + 88.0, y + 50.0, &TextOpt::default().size(12.0).color(col));
        if self.mode == Mode::Vs {
            let choosing = pl.state == PState::Team;
            let tl = TEAM_LABELS[pl.team];
            let s = if choosing { format!("◀ {} ▶", tl) } else { tl.to_string() };
            text(ctx, &s, x + 88.0, y + 70.0, &TextOpt::default().size(12.0).color(if choosing { UI_AMBER } else { TEAM_COLORS[pl.team] }));
        }
        // descrição e golpes especiais
        let def = cid.and_then(fighter_def);
        let desc = def.as_ref().map(|d| d.desc).unwrap_or("Um lutador é sorteado quando a luta começa.");
        wrap_text(ctx, desc, x + 10.0, y + 100.0, w - 20.0, 15.0, &TextOpt::default().light().size(12.0).color(UI_MUTED));
        if let Some(id) = cid {
            let sp = specials_of(id);
            text(ctx, if sp.is_empty() { "Sem golpes especiais" } else { "Especiais" }, x + 10.0, y + 148.0, &TextOpt::default().size(11.0).color(UI_MUTED));
            for (k, s) in sp.iter().take(5).enumerate() {
                let yy = y + 168.0 + k as f64 * 30.0;
                text(ctx, &s.kind, x + 10.0, yy, &TextOpt::default().size(13.0).color(UI_TEXT).max(w - 20.0));
                text(ctx, s.cmd, x + 10.0, yy + 14.0, &TextOpt::default().size(11.0).color(UI_AMBER));
            }
            if let Some(d) = &def {
                // barras de atributos
                let bars = [("Vida", d.stats.hp / 620.0, UI_HP), ("Força", d.stats.punch * d.stats.power / 25.0, "#ffb000"), ("Veloc.", d.stats.speed / 1.2, UI_MP)];
                for (k, (label, v, c)) in bars.iter().enumerate() {
                    let by = y + 252.0 + k as f64 * 11.0;
                    text(ctx, label, x + 10.0, by + 2.0, &TextOpt::default().size(9.0).color(UI_MUTED));
                    ctx.fill_style(UI_MP_DARK);
                    ctx.fill_rect(x + 52.0, by - 1.0, w - 62.0, 5.0);
                    ctx.fill_style(c);
                    ctx.fill_rect(x + 52.0, by - 1.0, (w - 62.0) * v.clamp(0.05, 1.0), 5.0);
                }
            }
        }
        let (label, c) = match pl.state {
            PState::Ready => ("PRONTO", UI_GOOD),
            PState::Team => ("Escolha o time", UI_AMBER),
            _ => ("Escolha o lutador", UI_AMBER),
        };
        text(ctx, label, x + w / 2.0, y + h - 12.0, &TextOpt::default().center().size(13.0).color(c));
    }

    fn draw_settings(&mut self, ctx: &Ctx) {
        ctx.fill_style("rgba(5,8,20,0.7)");
        ctx.fill_rect(0.0, 0.0, W, H);
        let items = self.items();
        let (w, rh) = (470.0, 34.0);
        let extra = if self.mode == Mode::Survival || !self.msg.is_empty() { 26.0 } else { 8.0 };
        let h = 70.0 + items.len() as f64 * rh + extra;
        let x = (W - w) / 2.0;
        let y = (H - h) / 2.0;
        panel_box(ctx, x, y, w, h, Some(UI_AMBER));
        title(ctx, "AJUSTES DA PARTIDA", W / 2.0, y + 30.0, 26.0, UI_TEXT, Align::Center);
        for (i, it) in items.iter().enumerate() {
            let yy = y + 66.0 + i as f64 * rh;
            let on = i == self.sel;
            if on {
                ctx.fill_style("rgba(255,176,0,0.16)");
                ctx.fill_rect(x + 12.0, yy - 14.0, w - 24.0, 28.0);
            }
            match &it.value {
                None => title(ctx, &it.label, W / 2.0, yy, if it.k == "fight" { 26.0 } else { 20.0 }, if on { UI_AMBER } else { UI_TEXT }, Align::Center),
                Some(v) => {
                    text(ctx, &it.label, x + 28.0, yy, &TextOpt::default().size(15.0).color(if on { UI_TEXT } else { UI_MUTED }));
                    let s = if on { format!("◀  {}  ▶", v) } else { v.clone() };
                    text(ctx, &s, x + w - 28.0, yy, &TextOpt::default().right().size(15.0).color(if on { UI_AMBER } else { UI_TEXT }));
                }
            }
        }
        if !self.msg.is_empty() {
            text(ctx, &self.msg, W / 2.0, y + h - 18.0, &TextOpt::default().center().size(13.0).color("#ff9b9b"));
        } else if self.mode == Mode::Survival {
            let best = save::progress().survival_best;
            text(ctx, &format!("Seu recorde: {} onda{}", best, if best == 1 { "" } else { "s" }), W / 2.0, y + h - 18.0, &TextOpt::default().center().size(13.0).color(UI_MUTED));
        }
    }
}
