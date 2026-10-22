//! Uma partida: mantém os objetos vivos, processa cada TU (30 por segundo),
//! resolve colisões, cuida dos rounds e desenha a cena, o painel e o resumo final.

use std::collections::HashSet;
use std::rc::Rc;

use crate::audio::{music, sound};
use crate::core::consts::*;
use crate::core::input::{self, Key};
use crate::core::save;
use crate::engine::ai::Ai;
use crate::engine::background::Background;
use crate::engine::character;
use crate::engine::data::*;
use crate::engine::effects::*;
use crate::engine::object::*;
use crate::engine::stage::StageLogic;
use crate::engine::survival::SurvivalLogic;
use crate::gfx::*;
use crate::ui::hud;

/// teclas de teste só com ?dev na página
pub fn dev_mode() -> bool {
    web_sys::window().and_then(|w| w.location().search().ok()).map(|s| s.contains("dev")).unwrap_or(false)
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Mode {
    Vs,
    Stage,
    Training,
    Demo,
    Survival,
}

impl Mode {
    pub fn name(self) -> &'static str {
        match self {
            Mode::Vs => "vs",
            Mode::Stage => "stage",
            Mode::Training => "training",
            Mode::Demo => "demo",
            Mode::Survival => "survival",
        }
    }
    pub fn from_name(s: &str) -> Mode {
        match s {
            "stage" => Mode::Stage,
            "training" => Mode::Training,
            "demo" => Mode::Demo,
            "survival" => Mode::Survival,
            _ => Mode::Vs,
        }
    }
}

/// de onde vem o controle de um lutador
#[derive(Clone, Debug, PartialEq)]
pub enum Con {
    Human(usize), // Input.controllers[p]
    New,          // controle próprio (IA ou jogador de rede)
}

#[derive(Clone, Debug)]
pub struct PlayerSpec {
    pub id: i32,
    pub team: i32,
    pub con: Con,
    pub player: i32,
    pub ai: Option<i32>,
    pub name: String,
    pub pos: Option<(f64, f64)>,
    pub dir: i32,
    pub remove_on_death: bool,
    pub panel: bool,
}

impl PlayerSpec {
    pub fn new(id: i32, team: i32, con: Con, player: i32, ai: Option<i32>, name: &str) -> PlayerSpec {
        PlayerSpec { id, team, con, player, ai, name: name.to_string(), pos: None, dir: 0, remove_on_death: false, panel: true }
    }
}

/// o que acontece quando a partida acaba
#[derive(Clone, Debug, PartialEq)]
pub enum EndAction {
    Title,
    ModeMenu,
    Select,
    NetLobby,
    Nothing,
}

#[derive(Clone, Debug)]
pub struct MatchOpts {
    pub players: Vec<PlayerSpec>,
    pub bg: i32,
    pub mode: Mode,
    pub weapons: bool,
    pub seed: Option<u32>,
    pub net: bool,
    pub rounds: i32,
    pub time_limit: i32,
    pub on_end: EndAction,
    pub stage_index: usize,
}

impl MatchOpts {
    pub fn new(players: Vec<PlayerSpec>, bg: i32, mode: Mode) -> MatchOpts {
        MatchOpts { players, bg, mode, weapons: true, seed: None, net: false, rounds: 1, time_limit: 0, on_end: EndAction::Nothing, stage_index: 0 }
    }
}

#[derive(Clone, Debug)]
pub struct PanelSlot {
    pub ch: Id,
    pub name: String,
    pub player: i32,
}

#[derive(Clone, Debug)]
pub struct Banner {
    pub text: String,
    pub sub: Option<String>,
    pub t: i32,
    pub total: i32,
}

#[derive(Clone, Debug)]
pub struct SummaryRow {
    pub small: String,
    pub name: String,
    pub kill: i32,
    pub attack: i32,
    pub lost: i32,
    pub mp: i32,
    pub pick: i32,
    pub combo: i32,
    pub win: bool,
    pub alive: bool,
    pub human: bool,
    pub char_id: i32,
}

#[derive(Clone, Debug)]
pub struct Summary {
    pub title: Option<String>,
    pub time: f64,
    pub score: Option<String>,
    pub rows: Vec<SummaryRow>,
}

#[derive(Clone, Debug)]
pub struct Bound {
    pub team: i32,
    pub min: f64,
    pub max: f64,
}

pub enum ModeLogic {
    Stage(StageLogic),
    Survival(SurvivalLogic),
}

pub enum Task {
    Create { op: OPoint, parent: Id, team: i32, pos: [f64; 3], z: f64, dir: i32, dvz: f64 },
    Multi { n: i32, vz: f64, op: OPoint, parent: Id, team: i32, pos: [f64; 3], z: f64, dir: i32, dvz: f64 },
    Destroy(Id),
}

pub struct Match {
    pub opts: MatchOpts,
    pub assets: Rc<Assets>,
    pub rng: Random,
    pub time: i32,
    pub live: Vec<Id>,
    pub objs: Vec<Obj>,
    pub effects: Vec<Fx>,
    pub tasks: Vec<Task>,
    pub paused: bool,
    pub pause_sel: usize,
    pub step_frame: bool,
    pub f6: bool,
    pub gameover_at: Option<i32>,
    pub summary: Option<Summary>,
    pub ais: Vec<Ai>,
    pub bg: Background,
    pub panel: Vec<PanelSlot>,
    pub mode: Mode,
    pub rounds: i32,
    pub time_limit: i32,
    pub round: i32,
    pub wins: Vec<(i32, i32)>, // (time, rounds vencidos)
    pub winner_team: Option<i32>,
    pub decided: bool,
    pub round_time: i32,
    pub intro: i32,
    pub banner: Option<Banner>,
    pub slowmo: i32,
    pub flash_t: i32,
    pub net: bool,
    pub demo: bool,
    pub ended: bool,
    pub restart_requested: bool,
    pub can_restart: bool,
    pub shake_amt: f64,
    pub mode_logic: Option<ModeLogic>,
    pub bound: Option<Bound>,
    pub cam_bound: Option<(f64, f64)>,
    pub result_text: String,
    pub result_sub: Option<String>,
    pub vig: Option<web_sys::CanvasGradient>,
    pub no_visuals: bool,
    pub dev: bool,
}

impl Match {
    pub fn new(assets: Rc<Assets>, opts: MatchOpts) -> Match {
        let seed = opts.seed.unwrap_or_else(|| (js_sys::Date::now() as i64 & 0xffffffff) as u32);
        let bg = Background::new(&assets, assets.bg(opts.bg));
        let mode = opts.mode;
        let rounds = if [1, 3, 5].contains(&opts.rounds) { opts.rounds } else { 1 };
        let time_limit = (opts.time_limit.max(0)) * FPS;
        let mut m = Match {
            assets,
            rng: Random::new(seed),
            time: 0,
            live: vec![],
            objs: vec![],
            effects: vec![],
            tasks: vec![],
            paused: false,
            pause_sel: 0,
            step_frame: false,
            f6: false,
            gameover_at: None,
            summary: None,
            ais: vec![],
            bg,
            panel: vec![],
            mode,
            rounds,
            time_limit,
            round: 1,
            wins: vec![],
            winner_team: None,
            decided: false,
            round_time: 0,
            intro: if mode == Mode::Demo || mode == Mode::Training { 0 } else { INTRO },
            banner: None,
            slowmo: 0,
            flash_t: 0,
            net: opts.net,
            demo: mode == Mode::Demo,
            ended: false,
            restart_requested: false,
            can_restart: !opts.net && mode != Mode::Demo,
            shake_amt: 0.0,
            mode_logic: None,
            bound: None,
            cam_bound: None,
            result_text: String::new(),
            result_sub: None,
            vig: None,
            no_visuals: false,
            dev: dev_mode(),
            opts: opts.clone(),
        };
        let difficulty = save::difficulty();
        for p in &opts.players {
            let con = match p.con {
                Con::Human(i) => i,
                Con::New => input::with(|i| i.new_controller()),
            };
            let c = m.add_character(p.id, p.team, Some(con), p.player, &p.name, p.remove_on_death);
            let (x, z) = p.pos.unwrap_or_else(|| {
                let rx = m.random() * 0.8 + 0.1;
                let rz = m.random();
                m.bg.pos(rx, rz)
            });
            let zb = m.bg.zboundary;
            m.objs[c].set_pos(x, 0.0, z, zb);
            if p.dir != 0 {
                m.objs[c].switch_dir(p.dir);
            } else if p.pos.is_none() {
                let d = if x < m.bg.width / 2.0 { 1 } else { -1 };
                m.objs[c].switch_dir(d);
            }
            if let Some(level) = p.ai {
                let ai = Ai::new(&mut m, c, level);
                m.ais.push(ai);
            } else if p.player >= 0 && !opts.net {
                m.objs[c].ch_mut().damage_taken = [0.6, 0.8, 1.0, 1.0][difficulty.clamp(0, 3) as usize];
            }
            if p.panel {
                m.panel.push(PanelSlot { ch: c, name: if p.name.is_empty() { m.objs[c].name.clone() } else { p.name.clone() }, player: p.player });
            }
        }
        if opts.weapons && mode != Mode::Stage {
            m.drop_weapons(5);
        }
        m
    }

    pub fn random(&mut self) -> f64 {
        self.rng.next()
    }

    pub fn add_character(&mut self, id: i32, team: i32, con: Option<usize>, player: i32, label: &str, remove_on_death: bool) -> Id {
        let data = self.assets.obj(id).cloned().expect("lutador inexistente");
        let sheet = self.assets.sheet(id).cloned().expect("folha inexistente");
        let hp = data.props.hp.unwrap_or(HP_FULL);
        let name = data.bmp.name.clone();
        let mut o = Obj::new(
            Rc::new(data),
            Rc::new(sheet),
            team,
            Kind::Character(crate::engine::object::CharData {
                con,
                con_state: [false; 7],
                decoder: crate::core::input::ComboDecoder::new(),
                combo_name: None,
                combo_timeout: 0,
                hold: None,
                stat: Stat::default(),
                disappear: -1,
                dead_blink: -1,
                player,
                damage_taken: 1.0,
                remove_on_death,
                label: if label.is_empty() { name } else { label.to_string() },
                catching: None,
                caught: None,
                caught_throw_z: None,
                caught_throw_injury: None,
                hits_n: 0,
                hits_t: -999,
                flash_t: 0,
            }),
        );
        o.floor_bound = true;
        o.health = Health { hp, hp_full: hp, hp_bound: hp, hp_lost: 0.0, mp: MP_START, mp_full: MP_FULL, mp_usage: 0.0, fall: 0.0, bdefend: 0.0 };
        let id = self.add(o);
        self.state_update(id, Ev::Setup, None);
        id
    }

    pub fn add(&mut self, mut o: Obj) -> Id {
        o.uid = self.objs.len() as i32 + 1;
        self.objs.push(o);
        let id = self.objs.len() - 1;
        self.live.push(id);
        id
    }

    pub fn remove(&mut self, id: Id) {
        if let Some(i) = self.live.iter().position(|&x| x == id) {
            self.live.remove(i);
        }
        self.objs[id].uid = -1;
    }

    pub fn characters(&self) -> Vec<Id> {
        self.live.iter().copied().filter(|&o| self.objs[o].is_char()).collect()
    }

    pub fn humans(&self) -> Vec<PanelSlot> {
        self.panel.iter().filter(|p| p.player >= 0).cloned().collect()
    }

    // ---- consultas de colisão ----

    /// objetos cujo volume (corpo, ou itr de um tipo) cruza `vol`
    pub fn query(&self, vol: &Vol, exclude: &[Id], w: &Where) -> Vec<Id> {
        let mut out = vec![];
        for &oid in &self.live {
            let o = &self.objs[oid];
            if o.uid < 0 || exclude.contains(&oid) {
                continue;
            }
            if let Some(t) = w.team {
                if o.team != t {
                    continue;
                }
            }
            if let Some(t) = w.not_team {
                if o.team == t {
                    continue;
                }
            }
            if let Some(k) = w.kind {
                if o.kind_type != k {
                    continue;
                }
            }
            let vols = match w.tag {
                QTag::Body => o.vol_body(None),
                QTag::Itr(k) => o.vol_itrs(k),
            };
            if vols.iter().any(|v| intersect(vol, v)) {
                out.push(oid);
            }
        }
        out
    }

    pub fn query_all(&self, me: Id, w: &Where) -> Vec<Id> {
        let mut out: Vec<Id> = self
            .live
            .iter()
            .copied()
            .filter(|&oid| {
                let o = &self.objs[oid];
                oid != me
                    && o.uid >= 0
                    && w.team.map(|t| o.team == t).unwrap_or(true)
                    && w.not_team.map(|t| o.team != t).unwrap_or(true)
                    && w.kind.map(|k| o.kind_type == k).unwrap_or(true)
            })
            .collect();
        if w.sort_distance {
            let (sx, sz) = (self.objs[me].ps.x, self.objs[me].ps.z);
            let d = |o: &Obj| {
                let dx = o.ps.x - sx;
                let dz = o.ps.z - sz;
                (dx * dx + dz * dz).sqrt()
            };
            out.sort_by(|&a, &b| d(&self.objs[a]).partial_cmp(&d(&self.objs[b])).unwrap());
        }
        out
    }

    pub fn leaving(&self, id: Id, xt: f64) -> bool {
        let o = &self.objs[id];
        let nx = o.ps.sx + o.ps.vx;
        let ny = o.ps.sy + o.ps.vy;
        nx + o.spw < -xt || nx > self.bg.width + xt || !(-600.0..=100.0).contains(&ny)
    }

    // ---- criação de objetos (agendada para o fim do TU) ----

    pub fn create_object(&mut self, op: &OPoint, parent: Id) {
        let p = &self.objs[parent];
        self.tasks.push(Task::Create { op: op.clone(), parent, team: p.team, pos: p.point(op.x, op.y), z: p.ps.z, dir: p.ps.dir, dvz: p.dirv() as f64 * 2.0 });
    }

    pub fn create_multiple(&mut self, op: &OPoint, parent: Id, n: i32, vz: f64) {
        let p = &self.objs[parent];
        self.tasks.push(Task::Multi { n, vz, op: op.clone(), parent, team: p.team, pos: p.point(op.x, op.y), z: p.ps.z, dir: p.ps.dir, dvz: p.dirv() as f64 * 2.0 });
    }

    pub fn destroy_object(&mut self, id: Id) {
        self.tasks.push(Task::Destroy(id));
    }

    fn make_object(&mut self, op: &OPoint, parent: Id, team: i32, pos: [f64; 3], z: f64, dir: i32, dvz: f64) -> Option<Id> {
        let entry = self.assets.obj(op.oid).cloned()?;
        let sheet = self.assets.sheet(op.oid).cloned()?;
        match entry.kind {
            ObjType::SpecialAttack => {
                let o = Obj::new(Rc::new(entry), Rc::new(sheet), team, Kind::Ball(BallData::default()));
                let id = self.add(o);
                self.state_update(id, Ev::Setup, None);
                crate::engine::ball::init(self, id, parent, op, pos, z, dir, dvz);
                Some(id)
            }
            k if k.is_weapon() => {
                let heavy = k == ObjType::HeavyWeapon;
                let hp = entry.bmp.weapon_hp;
                let mut o = Obj::new(Rc::new(entry), Rc::new(sheet), team, Kind::Weapon(WeaponData { heavy, holder: None, pre: None }));
                o.health.hp = if hp > 0.0 { hp } else { 100.0 };
                let id = self.add(o);
                crate::engine::weapon::init_from_opoint(self, id, parent, op);
                Some(id)
            }
            _ => None,
        }
    }

    pub fn process_tasks(&mut self) {
        let tasks = std::mem::take(&mut self.tasks);
        for t in tasks {
            match t {
                Task::Create { op, parent, team, pos, z, dir, dvz } => {
                    self.make_object(&op, parent, team, pos, z, dir, dvz);
                }
                Task::Multi { n, vz, op, parent, team, pos, z, dir, dvz } => {
                    let half = n / 2;
                    let mut list = vec![];
                    for k in -half..=half {
                        if n % 2 == 1 || k != 0 {
                            list.push(k as f64 * vz);
                        }
                    }
                    for v in list {
                        let Some(o) = self.make_object(&op, parent, team, pos, z, dir, dvz) else { break };
                        self.objs[o].ps.vz = v;
                        self.objs[o].ps.vx += (if dir == -1 { 1.0 } else { -1.0 }) * v.abs();
                    }
                }
                Task::Destroy(id) => self.remove(id),
            }
        }
    }

    pub fn visual_effect(&mut self, id: i32, pos: [f64; 3], variant: usize, with_sound: bool) {
        let Some(obj) = self.assets.obj(id).cloned() else { return };
        let Some(sheet) = self.assets.sheet(id).cloned() else { return };
        let frame = obj.effect_list.get(variant).map(|e| e.1).unwrap_or(0);
        self.effects.push(Fx::Visual(VisualEffect {
            dat: Rc::new(obj),
            sheet: Rc::new(sheet),
            x: pos[0],
            y: pos[1],
            z: pos[2],
            vx: 0.0,
            vy: 0.0,
            with_sound,
            mass: 0.0,
            dead: false,
            n: frame,
            wait: -1,
            next: 0,
            fresh: true,
        }));
    }

    pub fn broken_effect(&mut self, id: i32, pos: [f64; 3], slot: usize, rect: Option<(f64, f64)>) {
        let Some(broken) = self.assets.obj(320).cloned() else { return };
        let Some(sheet) = self.assets.sheet(320).cloned() else { return };
        let list: Vec<i32> = broken.broken_list.iter().filter(|b| b.0 == id).map(|b| b.1).collect();
        if list.is_empty() {
            return;
        }
        let frame = list[slot % list.len()];
        let mass = if id == 302 { 0.0 } else { 1.0 };
        let (rw, rh) = rect.unwrap_or((50.0, 50.0));
        let spw = sheet.w;
        let (r1, r2, r3, r4) = (self.random(), self.random(), self.random(), self.random());
        self.effects.push(Fx::Visual(VisualEffect {
            dat: Rc::new(broken),
            sheet: Rc::new(sheet),
            x: pos[0] + r1 * rw * 1.2 - spw,
            y: pos[1] - r2 * rh,
            z: pos[2],
            vx: (r3 - 0.5) * rw * 0.5,
            vy: r4 * 2.0 - 4.0,
            with_sound: true,
            mass,
            dead: false,
            n: frame,
            wait: -1,
            next: 0,
            fresh: true,
        }));
    }

    /// poeira no chão (n bolinhas ao redor de x, z)
    pub fn puff(&mut self, x: f64, z: f64, n: usize, color: Option<&str>, spread: f64) {
        if self.no_visuals {
            return;
        }
        let color = color.unwrap_or("rgba(220,210,190,1)");
        for _ in 0..n {
            let a = js_sys::Math::random() * std::f64::consts::TAU;
            let r = js_sys::Math::random;
            self.effects.push(Fx::Puff(Puff {
                x: x + (r() - 0.5) * 10.0,
                y: -2.0,
                z,
                vx: a.cos() * 1.6 * spread,
                vy: -0.4 - r() * 0.8,
                size: 3.0 + r() * 3.0,
                color: color.into(),
                life: 10 + (r() * 6.0).floor() as i32,
                max: 0,
                dead: false,
            }));
            if let Some(Fx::Puff(p)) = self.effects.last_mut() {
                p.max = p.life;
            }
        }
    }

    /// número de dano flutuando sobre quem apanhou (só visual, pode ser desligado em Ajustes)
    pub fn float_text(&mut self, x: f64, y: f64, z: f64, s: String, color: &str, size: f64) {
        if self.no_visuals || save::settings().hit_numbers == 0 {
            return;
        }
        self.effects.push(Fx::Float(FloatText::new(x, y, z, s, color, size)));
    }

    /// tremor de tela em golpes fortes (só visual)
    pub fn add_shake(&mut self, v: f64) {
        if save::settings().shake != 0 {
            self.shake_amt = self.shake_amt.max(v).min(7.0);
        }
    }

    /// faixa de texto no meio da tela por t TU ("PREPARAR...", "K.O.!", "VITÓRIA!")
    pub fn announce(&mut self, text: &str, sub: Option<&str>, t: i32) {
        self.banner = Some(Banner { text: text.to_string(), sub: sub.map(|s| s.to_string()), t, total: t });
    }

    pub fn drop_weapons(&mut self, n: usize) {
        let ids = self.assets.weapon_ids();
        if ids.is_empty() {
            return;
        }
        for _ in 0..n {
            let (rx, rz, rk) = (self.random(), self.random(), self.random());
            let (x, z) = self.bg.pos(rx, rz);
            let id = ids[((rk * ids.len() as f64).floor() as usize).min(ids.len() - 1)];
            self.create_weapon(id, x, -800.0, z);
        }
    }

    pub fn create_weapon(&mut self, id: i32, x: f64, y: f64, z: f64) -> Option<Id> {
        let entry = self.assets.obj(id).cloned()?;
        let sheet = self.assets.sheet(id).cloned()?;
        let heavy = entry.kind == ObjType::HeavyWeapon;
        let hp = entry.bmp.weapon_hp;
        let mut o = Obj::new(Rc::new(entry), Rc::new(sheet), 0, Kind::Weapon(WeaponData { heavy, holder: None, pre: None }));
        o.health.hp = if hp > 0.0 { hp } else { 100.0 };
        let zb = self.bg.zboundary;
        o.set_pos(x, y, z, zb);
        let wid = self.add(o);
        self.state_update(wid, Ev::Setup, None);
        Some(wid)
    }

    // ---- ciclo ----

    /// a apresentação do round ("PREPARAR...") está rolando: ninguém se mexe
    pub fn in_intro(&self) -> bool {
        self.round_time < self.intro
    }

    /// teclas de direção e defesa que os jogadores deste aparelho estão segurando agora
    fn resync_held(&mut self) {
        let list: Vec<(usize, i32)> = self.characters().iter().filter_map(|&c| self.objs[c].ch().con.map(|con| (con, self.objs[c].ch().player))).filter(|(_, p)| *p >= 0).collect();
        input::with(|i| {
            for (con, p) in list {
                if p > 3 || con > 3 {
                    continue;
                }
                for k in [Key::Up, Key::Down, Key::Left, Key::Right, Key::Def] {
                    let down = i.down.contains(&i.keys[p as usize][k.idx()]) || i.down.contains(&format!("G{}_{}", p, k.name())) || (p == 0 && i.down.contains(k.touch_code()));
                    if down {
                        i.controllers[con].key(k, true);
                    }
                }
            }
        });
    }

    /// leva as teclas dos controles aos lutadores (e aos seus detectores de combo)
    fn fetch_controllers(&mut self, intro: bool) {
        let chars = self.characters();
        let mut seen = HashSet::new();
        for &c in &chars {
            let Some(con) = self.objs[c].ch().con else { continue };
            if intro {
                input::with(|i| i.controllers[con].clear());
            }
            if !seen.insert(con) {
                continue;
            }
            let sharing: Vec<Id> = chars.iter().copied().filter(|&x| self.objs[x].ch().con == Some(con)).collect();
            let evs: Vec<(Key, bool)> = input::with(|i| std::mem::take(&mut i.controllers[con].buf));
            for (k, down) in evs {
                let already = input::with(|i| i.controllers[con].state[k.idx()]);
                for &ch in &sharing {
                    let mut combos = vec![];
                    self.objs[ch].ch_mut().decoder.key(k, down, already, &mut combos);
                    for cb in combos {
                        character::on_combo(self, ch, cb);
                    }
                }
                input::with(|i| i.controllers[con].state[k.idx()] = down);
            }
            let st = input::with(|i| i.controllers[con].state);
            for &ch in &sharing {
                self.objs[ch].ch_mut().con_state = st;
            }
        }
        for &c in &chars {
            self.objs[c].ch_mut().decoder.frame();
        }
    }

    pub fn frame(&mut self) {
        self.function_keys();
        if self.demo && !self.ended && input::with(|i| i.any_hit(Key::Att) || i.any_hit(Key::Jump)) {
            self.end();
            return;
        }
        if self.ended || (self.paused && !self.step_frame) {
            return;
        }
        self.step_frame = false;
        if let Some(b) = &mut self.banner {
            b.t -= 1;
            if b.t <= 0 {
                self.banner = None;
            }
        }
        if self.round_time == 0 && self.intro > 0 && self.mode_logic.is_none() {
            let text = if self.rounds > 1 { format!("ROUND {}", self.round) } else { "PREPARAR...".to_string() };
            let t = self.intro;
            self.announce(&text, None, t);
        }
        if self.intro > 0 && self.round_time == self.intro {
            self.announce("LUTEM!", None, 20);
            sound::play("bell");
        }
        let intro = self.in_intro();
        // quem segurou uma direção durante a abertura continua andando quando o round começa
        if self.intro > 0 && self.round_time == self.intro && !self.net {
            self.resync_held();
        }
        self.fetch_controllers(intro);
        let ordered: Vec<Id> = {
            let order = [ObjType::Character, ObjType::LightWeapon, ObjType::HeavyWeapon, ObjType::Drink, ObjType::SpecialAttack];
            let mut v = vec![];
            for t in order {
                for &o in &self.live {
                    if self.objs[o].kind_type == t {
                        v.push(o);
                    }
                }
            }
            v
        };
        for &o in &ordered {
            if self.objs[o].uid >= 0 {
                self.transit(o);
            }
        }
        self.process_tasks();
        for &o in &ordered {
            if self.objs[o].uid >= 0 {
                self.tu(o);
            }
        }
        for e in &mut self.effects {
            e.tu();
        }
        self.effects.retain(|e| !e.dead());
        let chars = self.characters();
        if self.f6 {
            for &c in &chars {
                let o = &mut self.objs[c];
                o.health.mp = o.health.mp_full;
            }
        }
        let humans: Vec<(f64, i32)> =
            chars.iter().filter(|&&c| self.objs[c].ch().player >= 0 && self.objs[c].health.hp > 0.0).map(|&c| (self.objs[c].ps.x, self.objs[c].dirh())).collect();
        let alive: Vec<(f64, i32)> = chars.iter().filter(|&&c| self.objs[c].health.hp > 0.0).map(|&c| (self.objs[c].ps.x, self.objs[c].dirh())).collect();
        let cb = self.cam_bound;
        self.bg.update_camera(if humans.is_empty() { &alive } else { &humans }, cb);
        if !intro {
            for i in 0..self.ais.len() {
                let ch = self.ais[i].ch;
                if self.objs[ch].uid >= 0 && self.time % self.ais[i].l().every == 0 {
                    crate::engine::ai::think(self, i);
                }
            }
        }
        let objs = &self.objs;
        self.ais.retain(|a| objs[a.ch].uid >= 0);
        if self.mode == Mode::Training {
            self.training_tu();
        }
        let mut logic = self.mode_logic.take();
        match &mut logic {
            Some(ModeLogic::Stage(s)) => s.tu(self),
            Some(ModeLogic::Survival(s)) => s.tu(self),
            None => self.check_gameover(),
        }
        if self.mode_logic.is_none() {
            self.mode_logic = logic;
        }
        self.time += 1;
        self.round_time += 1;
    }

    /// Esc / botão voltar / F1 / P abrem o menu de pausa (fora do jogo em rede, que não para).
    /// As teclas de teste (F2, F6-F9) só existem com ?dev na página.
    fn function_keys(&mut self) {
        let (esc, f1, p, f4) = input::with(|i| (i.code("Escape"), i.code("F1"), i.code("KeyP"), i.code("F4")));
        if self.net {
            if esc || f4 {
                self.end();
            }
            return;
        }
        if self.demo {
            return;
        }
        let toggle = esc || f1 || p || f4;
        if !self.paused {
            if toggle && self.summary.is_none() {
                self.set_paused(true);
                sound::play("m_ok");
            } else if esc && self.summary.is_some() {
                self.end();
            }
        } else {
            self.pause_menu();
        }
        if !self.dev {
            return;
        }
        let (f2, f6, f7, f8, f9) = input::with(|i| (i.code("F2"), i.code("F6"), i.code("F7"), i.code("F8"), i.code("F9")));
        if f2 {
            self.paused = true;
            self.step_frame = true;
        }
        if f6 {
            self.f6 = !self.f6;
        }
        if f7 {
            for c in self.characters() {
                let o = &mut self.objs[c];
                let hp = o.prop().hp.unwrap_or(HP_FULL);
                o.health.hp = hp;
                o.health.hp_full = hp;
                o.health.hp_bound = hp;
                o.health.mp = o.health.mp_full;
            }
        }
        if f8 {
            self.drop_weapons(5);
        }
        if f9 {
            for &o in &self.live.clone() {
                if self.objs[o].is_weapon() {
                    self.objs[o].health.hp = 0.0;
                }
            }
        }
    }

    pub fn set_paused(&mut self, on: bool) {
        self.paused = on;
        self.pause_sel = 0;
        music::set_duck(if on { 0.3 } else { 1.0 });
        // teclas apertadas durante a pausa não podem virar golpes ao voltar
        self.clear_controllers();
    }

    fn clear_controllers(&mut self) {
        let cons: Vec<usize> = self.characters().iter().filter_map(|&c| self.objs[c].ch().con).collect();
        input::with(|i| {
            for c in cons {
                if let Some(con) = i.controllers.get_mut(c) {
                    con.clear();
                }
            }
        });
    }

    fn pause_menu(&mut self) {
        let items = self.pause_items();
        let n = items.len();
        let (up, down, back, ok) = input::with(|i| {
            (
                i.any_hit(Key::Up),
                i.any_hit(Key::Down),
                i.code("Escape") || i.code("F1") || i.code("KeyP") || i.code("F4") || i.any_hit(Key::Jump),
                i.any_hit(Key::Att) || i.code("Enter"),
            )
        });
        if up {
            self.pause_sel = (self.pause_sel + n - 1) % n;
            sound::play("m_pass");
        }
        if down {
            self.pause_sel = (self.pause_sel + 1) % n;
            sound::play("m_pass");
        }
        self.clear_controllers();
        if back {
            self.set_paused(false);
            sound::play("m_cancel");
            return;
        }
        if ok {
            sound::play("m_ok");
            match items[self.pause_sel].0 {
                "resume" => self.set_paused(false),
                "sound" => {
                    save::edit_settings(|s| {
                        s.sfx = if s.sfx != 0 { 0 } else { 8 };
                        s.music = if s.sfx != 0 { 6 } else { 0 };
                    });
                    save::save();
                    save::apply();
                }
                "restart" => self.restart_match(),
                _ => self.end(),
            }
        }
    }

    pub fn pause_items(&self) -> Vec<(&'static str, &'static str)> {
        let s = save::settings();
        let muted = s.sfx == 0 && s.music == 0;
        let mut items = vec![("resume", "Continuar")];
        if self.can_restart {
            items.push(("restart", "Reiniciar"));
        }
        items.push(("sound", if muted { "Ligar o som" } else { "Desligar o som" }));
        items.push(("quit", "Sair da luta"));
        items
    }

    /// recomeça a mesma luta (mesmos lutadores, cenário e ajustes) sem voltar aos menus
    pub fn restart_match(&mut self) {
        if self.ended || !self.can_restart {
            return;
        }
        self.ended = true;
        music::set_duck(1.0);
        self.restart_requested = true;
    }

    /// treino: MP infinito e o boneco nunca cai de vez
    fn training_tu(&mut self) {
        for c in self.characters() {
            let o = &mut self.objs[c];
            if o.ch().player >= 0 {
                o.health.mp = o.health.mp_full;
            } else if o.health.hp < o.health.hp_full * 0.4 {
                o.health.hp = o.health.hp_full;
                o.health.hp_bound = o.health.hp_full;
            }
        }
    }

    pub fn alive_teams(&self) -> Vec<i32> {
        let mut teams = vec![];
        for p in &self.panel {
            let t = self.objs[p.ch].team;
            if self.objs[p.ch].health.hp > 0.0 && !teams.contains(&t) {
                teams.push(t);
            }
        }
        teams
    }

    /// chamado quando um lutador do painel cai de vez
    pub fn on_ko(&mut self, c: Id) {
        if !self.panel.iter().any(|p| p.ch == c) {
            return;
        }
        sound::play("ko");
        self.add_shake(6.0);
        if !self.no_visuals {
            self.flash_t = 6;
            self.slowmo = self.slowmo.max(12);
        }
        let show = self.banner.as_ref().map(|b| b.text == "LUTEM!").unwrap_or(true);
        if show {
            self.announce("K.O.!", None, 25);
        }
    }

    /// time vencedor do round: por nocaute (só um time de pé), por tempo (mais vida), empate ou nada ainda
    fn round_winner(&self) -> Option<Option<i32>> {
        let teams = self.alive_teams();
        if teams.len() < 2 {
            return Some(if teams.len() == 1 { Some(teams[0]) } else { None });
        }
        if self.time_limit > 0 && self.round_time >= self.time_limit + self.intro {
            let mut sum: Vec<(i32, f64)> = vec![];
            for p in &self.panel {
                let o = &self.objs[p.ch];
                if o.health.hp > 0.0 {
                    let v = o.health.hp / o.health.hp_full;
                    match sum.iter_mut().find(|s| s.0 == o.team) {
                        Some(s) => s.1 += v,
                        None => sum.push((o.team, v)),
                    }
                }
            }
            sum.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
            if sum.len() == 1 || sum[0].1 > sum[1].1 + 1e-6 {
                return Some(Some(sum[0].0));
            }
            return Some(None);
        }
        None
    }

    /// segundos que faltam no round (None sem limite de tempo)
    pub fn time_left(&self) -> Option<i32> {
        if self.time_limit == 0 {
            return None;
        }
        Some(((self.time_limit - (self.round_time - self.intro).max(0)) as f64 / FPS as f64).ceil().max(0.0) as i32)
    }

    fn check_gameover(&mut self) {
        if self.mode == Mode::Training {
            return;
        }
        match self.gameover_at {
            None => {
                if let Some(w) = self.round_winner() {
                    self.end_round(w);
                }
            }
            Some(at) => {
                if self.time == at + 25 {
                    let (t, s) = (self.result_text.clone(), self.result_sub.clone());
                    self.announce(&t, s.as_deref(), 35);
                } else if self.time == at + KO_PAUSE {
                    if self.decided {
                        self.show_summary(None);
                    } else {
                        self.next_round();
                    }
                }
            }
        }
        let att = input::with(|i| i.any_hit(Key::Att) || i.any_hit(Key::Jump));
        if let Some(at) = self.gameover_at {
            if !self.net && self.summary.is_some() && self.time > at + KO_PAUSE + 30 && att {
                self.end();
            }
            if self.summary.is_some() && self.demo && self.time > at + KO_PAUSE + 150 {
                self.end();
            }
        }
    }

    fn wins_of(&self, team: i32) -> i32 {
        self.wins.iter().find(|w| w.0 == team).map(|w| w.1).unwrap_or(0)
    }

    fn end_round(&mut self, winner: Option<i32>) {
        self.gameover_at = Some(self.time);
        let time_out = self.alive_teams().len() >= 2;
        if let Some(w) = winner {
            match self.wins.iter_mut().find(|x| x.0 == w) {
                Some(x) => x.1 += 1,
                None => self.wins.push((w, 1)),
            }
        }
        let need = (self.rounds + 1) / 2;
        // um empate repete o round; depois de muitos empates a luta termina empatada
        self.decided = match winner {
            Some(w) => self.wins_of(w) >= need,
            None => self.round >= self.rounds + 2,
        };
        self.winner_team = if self.decided { winner } else { None };
        let humans = self.humans();
        let team_label = |t: i32| -> String { self.panel.iter().find(|p| self.objs[p.ch].team == t).map(|p| p.name.clone()).unwrap_or_else(|| "Ninguém".into()) };
        self.result_text = match winner {
            None => "EMPATE".into(),
            Some(w) => {
                if !humans.is_empty() && humans.iter().all(|p| self.objs[p.ch].team == w) {
                    "VITÓRIA!".into()
                } else if !humans.is_empty() && !humans.iter().any(|p| self.objs[p.ch].team == w) {
                    "DERROTA".into()
                } else {
                    format!("{} venceu!", team_label(w))
                }
            }
        };
        self.result_sub = if self.rounds > 1 && !self.decided {
            Some(format!("Round {} · {}", self.round, self.score_line()))
        } else if time_out {
            Some("Tempo esgotado".into())
        } else {
            None
        };
        if time_out {
            self.announce("TEMPO!", None, 25);
            sound::play("bell");
        }
        if !self.no_visuals {
            self.slowmo = self.slowmo.max(if self.decided { 24 } else { 12 });
        }
        self.clear_controllers();
    }

    /// placar dos rounds, na ordem do painel ("2 × 1")
    pub fn score_line(&self) -> String {
        let mut teams = vec![];
        for p in &self.panel {
            let t = self.objs[p.ch].team;
            if !teams.contains(&t) {
                teams.push(t);
            }
        }
        teams.iter().map(|t| self.wins_of(*t).to_string()).collect::<Vec<_>>().join(" × ")
    }

    /// próximo round: todos de pé, vida cheia, armas novas e a apresentação de novo
    fn next_round(&mut self) {
        self.round += 1;
        self.gameover_at = None;
        self.round_time = 0;
        self.banner = None;
        for &o in &self.live.clone() {
            if !self.objs[o].is_char() {
                self.remove(o);
            }
        }
        self.effects.clear();
        self.tasks.clear();
        for i in 0..self.panel.len() {
            let ch = self.panel[i].ch;
            let (rx, rz) = (self.random() * 0.8 + 0.1, self.random());
            let (x, z) = self.bg.pos(rx, rz);
            let dir = if x < self.bg.width / 2.0 { 1 } else { -1 };
            character::reset(self, ch, character::ResetOpts { hp: None, bound: None, mp: None, pos: Some((x, z)), dir: Some(dir) });
        }
        for ai in &mut self.ais {
            ai.target = None;
            ai.retarget = 0;
        }
        if self.opts.weapons {
            self.drop_weapons(5);
        }
        sound::play("m_join");
    }

    pub fn show_summary(&mut self, title: Option<&str>) {
        let teams: Vec<i32> = match self.winner_team {
            Some(w) => vec![w],
            None => self.alive_teams(),
        };
        let rows: Vec<SummaryRow> = self
            .panel
            .iter()
            .map(|p| {
                let c = &self.objs[p.ch];
                let alive = c.health.hp > 0.0;
                let name = if p.name.is_empty() || p.name == c.name || p.name == "COM" { c.name.clone() } else { format!("{} · {}", p.name, c.name) };
                let ch = c.ch();
                SummaryRow {
                    small: c.data.bmp.small.clone(),
                    name,
                    kill: ch.stat.kill,
                    attack: ch.stat.attack.round() as i32,
                    lost: c.health.hp_lost.round() as i32,
                    mp: c.health.mp_usage.round() as i32,
                    pick: ch.stat.picking,
                    combo: ch.stat.best_combo,
                    win: teams.contains(&c.team),
                    alive,
                    human: p.player >= 0,
                    char_id: c.id,
                }
            })
            .collect();
        if !self.net && !self.demo {
            let rr: Vec<save::ResultRow> = rows.iter().map(|r| save::ResultRow { human: r.human, win: r.win, kill: r.kill, char_id: r.char_id }).collect();
            save::record(&rr, self.time as f64 / FPS as f64);
        }
        self.summary =
            Some(Summary { title: title.map(|s| s.to_string()), time: self.time as f64 / FPS as f64, score: if self.rounds > 1 { Some(self.score_line()) } else { None }, rows });
        sound::play("m_end");
    }

    pub fn end(&mut self) {
        if self.ended {
            return;
        }
        self.ended = true;
        music::set_duck(1.0);
    }

    // ---- desenho ----

    /// cor de ambiente do cenário e vinheta nas bordas da tela
    fn draw_ambience(&mut self, ctx: &Ctx) {
        if let Some(t) = &self.bg.tone {
            ctx.fill_style(t);
            ctx.fill_rect(0.0, HUD_H, W, H - HUD_H);
        }
        if self.bg.vignette > 0.0 {
            if self.vig.is_none() {
                self.vig = Some(ctx.radial(W / 2.0, H * 0.58, H * 0.38, W / 2.0, H * 0.58, W * 0.62, &[(0.0, "rgba(0,0,0,0)"), (1.0, "rgba(5,5,20,1)")]));
            }
            ctx.alpha(self.bg.vignette);
            ctx.fill_grad(self.vig.as_ref().unwrap());
            ctx.fill_rect(0.0, HUD_H, W, H - HUD_H);
            ctx.alpha(1.0);
        }
    }

    /// "3 HITS!" sobre quem está emendando golpes
    fn draw_combos(&self, ctx: &Ctx, cam_x: f64) {
        for p in &self.panel {
            let c = &self.objs[p.ch];
            let ch = c.ch();
            if ch.hits_n < 2 || self.time - ch.hits_t > COMBO_WINDOW + 10 || !c.visible {
                continue;
            }
            let age = self.time - ch.hits_t;
            let size = if age < 3 { 26.0 } else { 22.0 };
            title(ctx, &format!("{} HITS!", ch.hits_n), c.ps.x - cam_x, c.ps.y + c.ps.z - 112.0, size, if ch.hits_n >= 5 { "#ff6b5e" } else { UI_AMBER }, Align::Center);
        }
    }

    pub fn draw(&mut self, ctx: &Ctx) {
        ctx.fill_style("#000");
        ctx.fill_rect(0.0, 0.0, W, H);
        // o cenário começa em y=128; a cena sobe para caber sob o painel compacto
        ctx.save();
        let (mut sx, mut sy) = (0.0, 0.0);
        if self.shake_amt > 0.3 && !self.paused {
            sx = (js_sys::Math::random() - 0.5) * self.shake_amt;
            sy = (js_sys::Math::random() - 0.5) * self.shake_amt;
            self.shake_amt *= 0.82;
        }
        ctx.translate(sx, sy - WORLD_Y);
        self.bg.draw(ctx, false);
        // estica a última linha do chão até o pé da tela, escurecendo
        let by = self.bg.bottom() - WORLD_Y;
        if by > 0.0 && by < H {
            ctx.save();
            ctx.reset_transform();
            let canvas = ctx.canvas();
            let k = canvas.width() as f64 / W;
            ctx.draw_image_part(&canvas, 0.0, (by - 1.0) * k, canvas.width() as f64, k, 0.0, by * k, canvas.width() as f64, (H - by) * k);
            ctx.scale(k, k);
            let g = ctx.linear(0.0, by, 0.0, H, &[(0.0, "rgba(0,0,0,0.15)"), (1.0, "rgba(0,0,0,0.6)")]);
            ctx.fill_grad(&g);
            ctx.fill_rect(0.0, by, W, H - by);
            ctx.restore();
        }
        let cam_x = self.bg.cam_x;
        for &o in &self.live {
            let ob = &self.objs[o];
            if ob.visible && ob.shadow_visible && !ob.hidden && ob.holder().is_none() {
                self.bg.draw_shadow(ctx, ob.ps.x, ob.ps.y, ob.ps.z);
            }
        }
        // ordem de profundidade: objetos e efeitos juntos
        enum D {
            O(Id),
            E(usize),
        }
        let mut list: Vec<(f64, i32, D)> = self.live.iter().map(|&o| (self.objs[o].depth(), self.objs[o].uid, D::O(o))).collect();
        list.extend(self.effects.iter().enumerate().map(|(i, e)| (e.depth(), 0, D::E(i))));
        list.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap().then(a.1.cmp(&b.1)));
        for (_, _, d) in &list {
            match d {
                D::O(o) => self.objs[*o].draw(ctx, cam_x),
                D::E(i) => self.effects[*i].draw(ctx, cam_x),
            }
        }
        self.bg.draw(ctx, true);
        self.draw_combos(ctx, cam_x);
        ctx.restore();
        self.draw_ambience(ctx);
        if self.flash_t > 0 {
            ctx.fill_style(&format!("rgba(255,255,255,{})", (0.35 * self.flash_t as f64) / 6.0));
            ctx.fill_rect(0.0, HUD_H, W, H - HUD_H);
            if !self.paused {
                self.flash_t -= 1;
            }
        }
        hud::draw_hud(ctx, self);
        let logic = self.mode_logic.take();
        match &logic {
            Some(ModeLogic::Stage(s)) => s.draw(ctx, self),
            Some(ModeLogic::Survival(s)) => s.draw(ctx, self),
            None => {}
        }
        self.mode_logic = logic;
        if self.demo && self.summary.is_none() {
            title(ctx, "DEMONSTRAÇÃO", W / 2.0, HUD_H + 26.0, 26.0, UI_AMBER, Align::Center);
            text(ctx, "Aperte ATAQUE para voltar", W / 2.0, HUD_H + 50.0, &TextOpt::default().center().light().size(12.0).shadow("#000"));
        }
        if self.mode == Mode::Training {
            hud::draw_training_hud(ctx, self);
        }
        if let Some(b) = &self.banner {
            if self.summary.is_none() {
                hud::draw_banner(ctx, &b.text, b.sub.as_deref(), Some(b));
            }
        }
        if self.paused && !self.step_frame {
            hud::draw_pause_overlay(ctx, self);
        }
        if self.summary.is_some() {
            hud::draw_summary(ctx, self);
        }
    }
}
