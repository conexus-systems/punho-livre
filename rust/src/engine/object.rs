//! Base de todos os objetos vivos (personagens, armas, ataques especiais):
//! quadros, transições com autoridade, física, efeitos e volumes de colisão.
//! Os objetos ficam numa arena dentro da partida e se referem uns aos outros por índice.

use std::collections::HashMap;
use std::rc::Rc;

use crate::core::consts::*;
use crate::core::input::{Combo, ComboDecoder};
use crate::engine::data::*;
use crate::engine::r#match::Match;
use crate::gfx::{Ctx, SpriteSheet};

pub type Id = usize;

/// Transições de quadro. Várias causas (próximo quadro, combo, golpe recebido,
/// fogo...) podem pedir uma transição no mesmo TU; cada uma tem uma autoridade
/// e só quem tiver autoridade maior ou igual à trava atual consegue mudar.
///   0 natural · 10 movimento/combo · 11 especial · 15 ambiente
///   20 golpe · 21 queda · 22 agarrão · 3x efeitos (fogo, gelo)
#[derive(Clone, Debug)]
pub struct Trans {
    pub wait: i32,
    pub next_n: i32,
    pub lock: i32,
    pub lockout: i32,
    pub flip_after: bool,
}

impl Default for Trans {
    fn default() -> Self {
        Trans { wait: 1, next_n: 999, lock: 0, lockout: 1, flip_after: false }
    }
}

impl Trans {
    fn take(&mut self, au: i32, out: i32) -> bool {
        let au = if au == 99 { self.lock } else { au };
        let out = if out == 0 { 1 } else { out };
        if au < self.lock {
            return false;
        }
        self.lock = au;
        self.lockout = if out == 99 { self.wait } else { out };
        true
    }
    pub fn set_wait(&mut self, v: i32, au: i32, out: i32) {
        if self.take(au, out) {
            self.wait = v.max(0);
        }
    }
    pub fn inc_wait(&mut self, v: i32, au: i32, out: i32) {
        if self.take(au, out) {
            self.wait = (self.wait + v).max(0);
        }
    }
    pub fn set_next(&mut self, v: i32, au: i32, out: i32) {
        if !self.take(au, out) {
            return;
        }
        let mut v = v;
        if v < 0 {
            v = -v;
            self.flip_after = true;
        }
        self.next_n = v;
    }
    /// vai para o quadro F agora (no próximo trans())
    pub fn frame(&mut self, f: i32, au: i32) {
        self.set_next(f, au, 0);
        self.set_wait(0, au, 0);
    }
    pub fn reset_lock(&mut self, au: i32) {
        let au = if au == 99 { self.lock } else { au };
        if au >= self.lock {
            self.lock = 0;
        }
    }
    pub fn next(&self) -> i32 {
        self.next_n
    }
}

#[derive(Clone, Debug, Default)]
pub struct Ps {
    pub sx: f64,
    pub sy: f64,
    pub sz: f64,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub vx: f64,
    pub vy: f64,
    pub vz: f64,
    pub zz: f64,
    pub dir: i32,
    pub fric: f64,
}

#[derive(Clone, Debug)]
pub struct Effect {
    pub num: i32,
    pub dvx: f64,
    pub dvy: f64,
    pub stuck: bool,
    pub oscillate: f64,
    pub oi: f64,
    pub blink: bool,
    pub bi: i32,
    pub sup: bool,
    pub timein: i32,
    pub timeout: i32,
    pub heal: f64,
}

impl Default for Effect {
    fn default() -> Self {
        Effect { num: -99, dvx: 0.0, dvy: 0.0, stuck: false, oscillate: 0.0, oi: 1.0, blink: false, bi: 0, sup: false, timein: 0, timeout: 0, heal: 0.0 }
    }
}

#[derive(Clone, Debug, Default)]
pub struct Health {
    pub hp: f64,
    pub hp_full: f64,
    pub hp_bound: f64,
    pub hp_lost: f64,
    pub mp: f64,
    pub mp_full: f64,
    pub mp_usage: f64,
    pub fall: f64,
    pub bdefend: f64,
}

#[derive(Clone, Debug, Default)]
pub struct ItrState {
    pub arest: i32,
    pub vrest: HashMap<i32, i32>, // uid do atacante -> TU de descanso
    pub attacker: Option<Id>,
}

#[derive(Clone, Debug, Default)]
pub struct FrameState {
    pub pn: i32,
    pub n: i32,
    pub ani_i: i32,
    pub ani_up: bool,
}

/// memória do estado atual (zerada quando o estado muda)
#[derive(Clone, Debug, Default)]
pub struct StateMem {
    pub frame_tu: bool,
    pub attlock: i32,
    pub state_tu: bool,
    pub counter: i32,
    pub attacks: i32,
    pub released: bool,
}

#[derive(Clone, Debug, Default)]
pub struct Stat {
    pub attack: f64,
    pub picking: i32,
    pub kill: i32,
    pub best_combo: i32,
}

#[derive(Clone, Debug)]
pub struct Caught {
    pub hold: [f64; 3],
    pub cpoint: CPoint,
    pub adir: i32,
    pub vdir: i32,
}

#[derive(Clone, Debug)]
pub struct CharData {
    pub con: Option<usize>,
    pub con_state: [bool; 7],
    pub decoder: ComboDecoder,
    pub combo_name: Option<Combo>,
    pub combo_timeout: i32,
    pub hold: Option<Id>,
    pub stat: Stat,
    pub disappear: i32,
    pub dead_blink: i32,
    pub player: i32,
    pub damage_taken: f64,
    pub remove_on_death: bool,
    pub label: String,
    pub catching: Option<Id>,
    pub caught: Option<Caught>,
    pub caught_throw_z: Option<i32>,
    pub caught_throw_injury: Option<f64>,
    pub hits_n: i32,
    pub hits_t: i32,
    pub flash_t: i32,
}

#[derive(Clone, Debug, Default)]
pub struct WeaponData {
    pub heavy: bool,
    pub holder: Option<Id>,
    pub pre: Option<Id>,
}

#[derive(Clone, Debug, Default)]
pub struct BallData {
    pub parent: Option<Id>,
    pub chased: HashMap<Id, i32>,
    pub nobounce: bool,
}

#[derive(Clone, Debug)]
pub enum Kind {
    Character(CharData),
    Weapon(WeaponData),
    Ball(BallData),
}

#[derive(Clone)]
pub struct Obj {
    pub id: i32,
    pub kind_type: ObjType,
    pub data: Rc<ObjData>,
    pub sheet: Rc<SpriteSheet>,
    pub name: String,
    pub team: i32,
    pub uid: i32,
    pub spw: f64,
    pub mem: StateMem,
    pub health: Health,
    pub frame: FrameState,
    pub mass: f64,
    pub ps: Ps,
    pub trans: Trans,
    pub itr: ItrState,
    pub effect: Effect,
    pub visible: bool,
    pub shadow_visible: bool,
    pub hidden: bool, // escondido pelo efeito de piscar
    pub allow_switch: bool,
    pub floor_bound: bool,
    pub dead: bool,
    pub kind: Kind,
}

/// volume no mundo (retângulo em x/y mais a profundidade em z)
#[derive(Clone, Debug, Default)]
pub struct Vol {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub vx: f64,
    pub vy: f64,
    pub w: f64,
    pub h: f64,
    pub zwidth: f64,
}

pub fn intersect(a: &Vol, b: &Vol) -> bool {
    let al = a.x + a.vx;
    let at = a.y + a.vy;
    let ar = al + a.w;
    let ab = at + a.h;
    let bl = b.x + b.vx;
    let bt = b.y + b.vy;
    let br = bl + b.w;
    let bb = bt + b.h;
    if ab < bt || at > bb || ar < bl || al > br {
        return false;
    }
    a.z - a.zwidth <= b.z + b.zwidth && a.z + a.zwidth >= b.z - b.zwidth
}

pub fn clamp_z(z: f64, zb: [f64; 2]) -> f64 {
    z.clamp(zb[0], zb[1])
}

/// resultado de um golpe recebido: nada, "sim" ou o dano aplicado
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum HitRes {
    No,
    Yes,
    Inj(f64),
}

impl HitRes {
    pub fn truthy(self) -> bool {
        match self {
            HitRes::No => false,
            HitRes::Yes => true,
            HitRes::Inj(v) => v != 0.0,
        }
    }
}

impl Obj {
    pub fn new(data: Rc<ObjData>, sheet: Rc<SpriteSheet>, team: i32, kind: Kind) -> Obj {
        let mass = data.props.mass.unwrap_or(1.0);
        let shadow = !data.props.no_shadow;
        let spw = sheet.w;
        Obj {
            id: data.id,
            kind_type: data.kind,
            name: data.bmp.name.clone(),
            data,
            sheet,
            team,
            uid: -1,
            spw,
            mem: StateMem::default(),
            health: Health { hp: 100.0, mp: 100.0, ..Default::default() },
            frame: FrameState { pn: 0, n: 0, ani_i: 0, ani_up: true },
            mass,
            ps: Ps { dir: 1, fric: 1.0, ..Default::default() },
            trans: Trans::default(),
            itr: ItrState::default(),
            effect: Effect::default(),
            visible: true,
            shadow_visible: shadow,
            hidden: false,
            allow_switch: true,
            floor_bound: false,
            dead: false,
            kind,
        }
    }

    pub fn is_char(&self) -> bool {
        matches!(self.kind, Kind::Character(_))
    }
    pub fn is_weapon(&self) -> bool {
        matches!(self.kind, Kind::Weapon(_))
    }
    pub fn is_ball(&self) -> bool {
        matches!(self.kind, Kind::Ball(_))
    }
    pub fn ch(&self) -> &CharData {
        match &self.kind {
            Kind::Character(c) => c,
            _ => panic!("não é um personagem"),
        }
    }
    pub fn ch_mut(&mut self) -> &mut CharData {
        match &mut self.kind {
            Kind::Character(c) => c,
            _ => panic!("não é um personagem"),
        }
    }
    pub fn chr(&self) -> Option<&CharData> {
        match &self.kind {
            Kind::Character(c) => Some(c),
            _ => None,
        }
    }
    pub fn wp(&self) -> &WeaponData {
        match &self.kind {
            Kind::Weapon(w) => w,
            _ => panic!("não é uma arma"),
        }
    }
    pub fn wp_mut(&mut self) -> &mut WeaponData {
        match &mut self.kind {
            Kind::Weapon(w) => w,
            _ => panic!("não é uma arma"),
        }
    }
    pub fn wpn(&self) -> Option<&WeaponData> {
        match &self.kind {
            Kind::Weapon(w) => Some(w),
            _ => None,
        }
    }
    pub fn bl(&self) -> &BallData {
        match &self.kind {
            Kind::Ball(b) => b,
            _ => panic!("não é uma bola"),
        }
    }
    pub fn bl_mut(&mut self) -> &mut BallData {
        match &mut self.kind {
            Kind::Ball(b) => b,
            _ => panic!("não é uma bola"),
        }
    }
    /// dono de um objeto (o lutador que lançou a bola ou pegou a arma)
    pub fn owner(&self) -> Option<Id> {
        match &self.kind {
            Kind::Ball(b) => b.parent,
            Kind::Weapon(w) => w.pre,
            _ => None,
        }
    }
    pub fn holder(&self) -> Option<Id> {
        match &self.kind {
            Kind::Weapon(w) => w.holder,
            _ => None,
        }
    }

    /// dados do quadro atual
    pub fn fd(&self) -> &Frame {
        self.data.frame(self.frame.n).or_else(|| self.data.frame(0)).expect("quadro inexistente")
    }
    pub fn frame_data(&self, n: i32) -> Option<&Frame> {
        self.data.frame(n)
    }
    pub fn state(&self) -> i32 {
        self.fd().state
    }
    pub fn prop(&self) -> &Props {
        &self.data.props
    }
    pub fn dirh(&self) -> i32 {
        self.ps.dir
    }
    pub fn dirv(&self) -> i32 {
        match &self.kind {
            Kind::Character(c) => (c.con_state[1] as i32) - (c.con_state[0] as i32),
            _ => 0,
        }
    }
    pub fn switch_dir(&mut self, d: i32) {
        self.ps.dir = d;
    }
    pub fn con_is(&self, k: crate::core::input::Key) -> bool {
        match &self.kind {
            Kind::Character(c) => c.con_state[k.idx()],
            _ => false,
        }
    }

    pub fn update_screen_pos(&mut self) {
        let d = self.fd();
        let (cx, cy) = (d.centerx, d.centery);
        let ps = &mut self.ps;
        ps.sx = if ps.dir == 1 { ps.x - cx } else { ps.x + cx - self.spw };
        ps.sy = ps.y - cy;
        ps.sz = ps.z;
    }

    pub fn set_pos(&mut self, x: f64, y: f64, z: f64, zb: [f64; 2]) {
        self.ps.x = x;
        self.ps.y = y;
        self.ps.z = clamp_z(z, zb);
        self.update_screen_pos();
    }

    pub fn unit_friction(&mut self) {
        let ps = &mut self.ps;
        if ps.y == 0.0 {
            if ps.vx != 0.0 {
                ps.vx += if ps.vx > 0.0 { -1.0 } else { 1.0 };
            }
            if ps.vz != 0.0 {
                ps.vz += if ps.vz > 0.0 { -1.0 } else { 1.0 };
            }
        }
    }

    pub fn linear_friction(&mut self, x: f64, z: f64) {
        let ps = &mut self.ps;
        if x != 0.0 && ps.vx != 0.0 {
            ps.vx += if ps.vx > 0.0 { -x } else { x };
        }
        if z != 0.0 && ps.vz != 0.0 {
            ps.vz += if ps.vz > 0.0 { -z } else { z };
        }
    }

    pub fn speed(&self) -> f64 {
        (self.ps.vx * self.ps.vx + self.ps.vy * self.ps.vy).sqrt()
    }

    // ---- volumes ----

    /// converte um retângulo dos dados (x, y, w, h relativos ao sprite) em volume do mundo
    pub fn volume(&self, x: f64, y: f64, w: f64, h: f64, zwidth: Option<f64>, off: Option<[f64; 3]>) -> Vol {
        let ps = &self.ps;
        let vx = if ps.dir == 1 { x } else { self.spw - x - w };
        let o = off.unwrap_or([0.0; 3]);
        Vol { x: ps.sx + o[0], y: ps.sy + o[1], z: ps.sz + o[2], vx, vy: y, w, h, zwidth: zwidth.unwrap_or(ZWIDTH) }
    }
    pub fn vol_itr(&self, i: &Itr) -> Vol {
        self.volume(i.x, i.y, i.w, i.h, i.zwidth, None)
    }
    pub fn vol_rect(&self, r: &Rect) -> Vol {
        self.volume(r.x, r.y, r.w, r.h, r.zwidth, None)
    }
    pub fn vol_body(&self, off: Option<[f64; 3]>) -> Vec<Vol> {
        if self.effect.sup {
            return vec![];
        }
        self.fd().bdy.iter().map(|b| self.volume(b.x, b.y, b.w, b.h, b.zwidth, off)).collect()
    }
    pub fn vol_itrs(&self, kind: i32) -> Vec<Vol> {
        self.fd().itr.iter().filter(|i| i.kind == kind).map(|i| self.vol_itr(i)).collect()
    }
    /// ponto (x, y) dos dados no mundo (o z recebe o mesmo deslocamento vertical, como no motor original)
    pub fn point(&self, ax: f64, ay: f64) -> [f64; 3] {
        let ps = &self.ps;
        [if ps.dir == 1 { ps.sx + ax } else { ps.sx + self.spw - ax }, ps.sy + ay, ps.sz + ay]
    }
    pub fn pos3(&self) -> [f64; 3] {
        [self.ps.x, self.ps.y, self.ps.z]
    }

    /// move (em x/z) para que o ponto b, que pertence a mim, fique sobre o ponto a
    pub fn coincide_xz(&mut self, a: [f64; 3], b: [f64; 3]) {
        self.ps.x += a[0] - b[0];
        self.ps.z += a[2] - b[2];
        self.update_screen_pos();
    }
    pub fn coincide_xy(&mut self, a: [f64; 3], b: [f64; 3]) {
        self.ps.x += a[0] - b[0];
        self.ps.y += a[1] - b[1];
        self.update_screen_pos();
    }

    // ---- efeitos de golpe ----

    pub fn effect_create(&mut self, num: i32, duration: i32, dvx: Option<f64>, dvy: Option<f64>) {
        let ef = &mut self.effect;
        if num < ef.num {
            return;
        }
        ef.stuck = true;
        if let Some(v) = dvx {
            ef.dvx = v;
        }
        if let Some(v) = dvy {
            ef.dvy = v;
        }
        if ef.num >= 0 {
            if ef.timein > 0 {
                ef.timein = 0;
            }
            if duration > ef.timeout {
                ef.timeout = duration;
            }
        } else {
            ef.timein = 0;
            ef.timeout = duration;
        }
        ef.num = num;
    }

    pub fn effect_stuck(&mut self, timein: i32, timeout: i32) {
        let ef = &mut self.effect;
        if !ef.stuck || ef.num <= -1 {
            ef.num = -1;
            ef.stuck = true;
            ef.timein = timein;
            ef.timeout = timeout;
        }
    }

    /// anima indo e voltando entre os quadros a e b
    pub fn ani_oscillate(&mut self, a: i32, b: i32) {
        let f = &mut self.frame;
        if f.ani_i < a || f.ani_i > b {
            f.ani_up = true;
            f.ani_i = a + 1;
        }
        if f.ani_i < b && f.ani_up {
            let n = f.ani_i;
            f.ani_i += 1;
            self.trans.set_next(n, 0, 0);
        } else if f.ani_i > a && !f.ani_up {
            let n = f.ani_i;
            f.ani_i -= 1;
            self.trans.set_next(n, 0, 0);
        }
        let f = &mut self.frame;
        if f.ani_i == b {
            f.ani_up = false;
        }
        if f.ani_i == a {
            f.ani_up = true;
        }
    }

    pub fn arest_update(&mut self, i: Option<&Itr>) {
        match i {
            Some(it) if it.arest.is_some() => self.itr.arest = it.arest.unwrap(),
            Some(it) if it.vrest.is_some() => {}
            _ => self.itr.arest = AREST,
        }
    }
    pub fn vrest_test(&self, uid: i32) -> bool {
        !self.itr.vrest.contains_key(&uid)
    }
    pub fn vrest_update(&mut self, uid: i32, i: &Itr) {
        if let Some(v) = i.vrest {
            self.itr.vrest.insert(uid, v);
        }
    }

    pub fn frame_force(&mut self) {
        let d = self.fd();
        let (dvx, dvy, dvz) = (d.dvx, d.dvy, d.dvz);
        let dirv = self.dirv() as f64;
        let ps = &mut self.ps;
        if let Some(dvx) = dvx {
            if dvx != 0.0 {
                let avx = ps.vx.abs();
                if ps.y < 0.0 || avx < dvx {
                    ps.vx = ps.dir as f64 * dvx;
                }
                if dvx < 0.0 {
                    ps.vx -= ps.dir as f64;
                }
            }
        }
        if let Some(dvz) = dvz {
            if dvz != 0.0 {
                ps.vz = dirv * dvz;
            }
        }
        if let Some(dvy) = dvy {
            if dvy != 0.0 {
                ps.vy += dvy;
            }
        }
        if dvx == Some(550.0) {
            ps.vx = 0.0;
        }
        if dvy == Some(550.0) {
            ps.vy = 0.0;
        }
        if dvz == Some(550.0) {
            ps.vz = 0.0;
        }
    }

    // ---- desenho ----

    pub fn draw(&self, ctx: &Ctx, cam_x: f64) {
        if !self.visible || self.hidden {
            return;
        }
        let mut x = self.ps.sx - cam_x;
        if self.effect.oscillate != 0.0 && self.effect.timein < 0 {
            x += self.effect.oscillate * self.effect.oi;
        }
        let flash = self.chr().map(|c| c.flash_t).unwrap_or(0);
        if flash > 0 {
            self.sheet.draw_tinted(ctx, self.fd().pic, x, self.ps.sy + self.ps.sz, self.ps.dir == -1, "#ffffff", if flash >= 3 { 0.85 } else { 0.5 });
        } else {
            self.sheet.draw(ctx, self.fd().pic, x, self.ps.sy + self.ps.sz, self.ps.dir == -1);
        }
    }

    /// ordem de desenho (profundidade)
    pub fn depth(&self) -> f64 {
        self.ps.sz + self.ps.zz
    }
}

/// eventos da máquina de estados
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Ev {
    Setup,
    Frame,
    FrameExit,
    FrameForce,
    TuForce,
    Tu,
    Transit,
    Combo,
    PostCombo,
    StateEntry,
    StateExit,
    HitStop,
    FallOntoGround,
    FellOntoGround,
    PostInteraction,
    Die,
    Leaving,
    Destroy,
}

pub type Ret = Option<i32>;

impl Match {
    // ---- transição de quadro ----

    /// chamada pelo `transit()` de cada objeto
    pub fn trans_trans(&mut self, id: Id) {
        let oldlock = self.objs[id].trans.lock;
        {
            let o = &mut self.objs[id];
            o.trans.lockout -= 1;
            if o.trans.lockout == 0 {
                o.trans.lock = 0;
            }
            if o.trans.wait > 0 {
                o.trans.wait -= 1;
                return;
            }
        }
        let mut next = self.objs[id].trans.next_n;
        if next == 0 {
            return;
        }
        if next == 1000 {
            self.state_update(id, Ev::Destroy, None);
            self.destroy_object(id);
            return;
        }
        {
            let o = &self.objs[id];
            if o.health.hp <= 0.0 && o.fd().state == 14 {
                return;
            }
        }
        if next == 999 || next == 1280 {
            next = 0;
        }
        let Some(new_state) = self.objs[id].frame_data(next).map(|d| d.state) else {
            self.objs[id].trans.next_n = 0;
            return;
        };
        let old_state = self.objs[id].fd().state;
        {
            let o = &mut self.objs[id];
            o.frame.pn = o.frame.n;
        }
        self.state_update(id, Ev::FrameExit, None);
        let changed = old_state != new_state;
        if changed {
            self.state_update(id, Ev::StateExit, None);
        }
        self.objs[id].frame.n = next;
        if changed {
            let (old_switch, has_con, left, right) = {
                let o = &mut self.objs[id];
                o.mem = StateMem::default();
                let old_switch = o.allow_switch;
                o.allow_switch = o.is_char() && crate::engine::character::char_switch(new_state);
                let has_con = o.chr().map(|c| c.con.is_some()).unwrap_or(false);
                (old_switch, has_con, o.con_is(crate::core::input::Key::Left), o.con_is(crate::core::input::Key::Right))
            };
            self.state_update(id, Ev::StateEntry, None);
            let o = &mut self.objs[id];
            if !o.trans.flip_after && o.allow_switch && !old_switch && has_con {
                if left {
                    o.switch_dir(-1);
                }
                if right {
                    o.switch_dir(1);
                }
            }
        }
        {
            let o = &mut self.objs[id];
            if o.trans.flip_after {
                o.trans.flip_after = false;
                let d = -o.ps.dir;
                o.switch_dir(d);
            }
        }
        self.frame_update(id);
        // ações disparadas por combo ganham um TU
        let o = &mut self.objs[id];
        if (oldlock == 10 || oldlock == 11) && o.trans.wait > 0 {
            o.trans.wait -= 1;
        }
    }

    pub fn frame_update(&mut self, id: Id) {
        self.objs[id].ps.fric = 1.0;
        if self.state_update(id, Ev::FrameForce, None).is_none() {
            self.objs[id].frame_force();
        }
        {
            let o = &mut self.objs[id];
            let (w, n) = (o.fd().wait, o.fd().next);
            o.trans.set_wait(w, 99, 0);
            o.trans.set_next(n, 99, 0);
        }
        self.state_update(id, Ev::Frame, None);
        let (snd, is_char, x, z, dir) = {
            let o = &self.objs[id];
            (o.fd().sound, o.is_char(), o.ps.x, o.ps.z, o.ps.dir)
        };
        if let Some(s) = snd {
            crate::audio::sound::play(s);
            if is_char && (s == "step" || s == "land") {
                self.puff(x - dir as f64 * 6.0, z, 2, None, 1.0);
            }
        }
    }

    /// despacha um evento: primeiro o comportamento genérico, depois o do estado atual
    pub fn state_update(&mut self, id: Id, ev: Ev, k: Option<Combo>) -> Ret {
        match self.objs[id].kind {
            Kind::Character(_) => crate::engine::character::update(self, id, ev, k),
            Kind::Weapon(_) => crate::engine::weapon::update(self, id, ev),
            Kind::Ball(_) => crate::engine::ball::update(self, id, ev),
        }
    }

    // ---- ciclo por TU ----

    pub fn transit(&mut self, id: Id) {
        if self.objs[id].is_char() {
            crate::engine::character::combo_update(self, id);
        }
        let stuck = {
            let o = &self.objs[id];
            o.effect.timein < 0 && o.effect.stuck
        };
        if !stuck {
            self.trans_trans(id);
        }
        self.objs[id].effect.timein -= 1;
        let stuck2 = {
            let o = &self.objs[id];
            o.effect.timein < 0 && o.effect.stuck
        };
        if !stuck2 {
            self.state_update(id, Ev::Transit, None);
        }
    }

    pub fn tu(&mut self, id: Id) {
        if self.state_update(id, Ev::TuForce, None).is_none() {
            self.objs[id].frame_force();
        }
        {
            let o = &mut self.objs[id];
            let ef = &mut o.effect;
            if ef.timein < 0 {
                if ef.oscillate != 0.0 {
                    ef.oi = -ef.oi;
                } else if ef.blink {
                    o.hidden = (ef.bi % 4) < 2;
                    ef.bi += 1;
                }
                if ef.timeout == 0 {
                    ef.num = -99;
                    ef.stuck = false;
                    ef.oscillate = 0.0;
                    if ef.blink {
                        ef.blink = false;
                        ef.bi = 0;
                        o.hidden = false;
                    }
                    ef.sup = false;
                } else if ef.timeout == -1 {
                    if ef.dvx != 0.0 {
                        o.ps.vx = ef.dvx;
                    }
                    if ef.dvy != 0.0 {
                        o.ps.vy = ef.dvy;
                    }
                    ef.dvx = 0.0;
                    ef.dvy = 0.0;
                }
                ef.timeout -= 1;
            }
        }
        let stuck = {
            let o = &self.objs[id];
            o.effect.timein < 0 && o.effect.stuck
        };
        if !stuck {
            self.state_update(id, Ev::Tu, None);
        }
        if self.objs[id].health.hp <= 0.0 && !self.objs[id].dead {
            self.state_update(id, Ev::Die, None);
            self.objs[id].dead = true;
        }
        if self.leaving(id, 0.0) {
            self.state_update(id, Ev::Leaving, None);
        }
        let o = &mut self.objs[id];
        let mut gone = vec![];
        for (k, v) in o.itr.vrest.iter_mut() {
            if *v > 0 {
                *v -= 1;
            } else {
                gone.push(*k);
            }
        }
        for k in gone {
            o.itr.vrest.remove(&k);
        }
        if o.itr.arest > 0 {
            o.itr.arest -= 1;
        }
    }

    // ---- física ----

    pub fn dynamics(&mut self, id: Id) {
        let blocked = self.blocked_xz(id);
        let zb = self.bg.zboundary;
        let bgw = self.bg.width;
        let bound = self.bound.clone();
        let o = &mut self.objs[id];
        let ps = &mut o.ps;
        if !blocked {
            ps.x += ps.vx;
            ps.z += ps.vz;
        } else {
            ps.x += ps.vx * 0.1;
            ps.z += ps.vz * 0.1;
        }
        if o.floor_bound {
            if ps.x < 0.0 {
                ps.x = 0.0;
            }
            if ps.x > bgw {
                ps.x = bgw;
            }
            if let Some(b) = bound {
                // trecho liberado no Stage Mode
                if o.team == b.team {
                    ps.x = ps.x.clamp(b.min, b.max);
                }
            }
        }
        ps.z = clamp_z(ps.z, zb);
        ps.y += ps.vy;
        if ps.y > 0.0 {
            ps.y = 0.0;
        }
        o.update_screen_pos();
        let ps = &mut o.ps;
        if ps.y == 0.0 && o.mass > 0.0 {
            if ps.vx != 0.0 {
                ps.vx += if ps.vx > 0.0 { -1.0 } else { 1.0 } * ps.fric;
            }
            if ps.vz != 0.0 {
                ps.vz += if ps.vz > 0.0 { -1.0 } else { 1.0 } * ps.fric;
            }
            if ps.vx != 0.0 && ps.vx > -MIN_SPEED && ps.vx < MIN_SPEED {
                ps.vx = 0.0;
            }
            if ps.vz != 0.0 && ps.vz > -MIN_SPEED && ps.vz < MIN_SPEED {
                ps.vz = 0.0;
            }
        }
        if ps.y < 0.0 {
            ps.vy += o.mass * GRAVITY;
        }
    }

    /// personagens não atravessam objetos com itr kind 14 (gelo, pedra no chão)
    pub fn blocked_xz(&self, id: Id) -> bool {
        let o = &self.objs[id];
        if !o.is_char() {
            return false;
        }
        let off = [o.ps.vx, 0.0, o.ps.vz];
        for mut b in o.vol_body(Some(off)) {
            b.zwidth = 0.0;
            if !self.query(&b, &[id], &Where { tag: QTag::Itr(14), ..Default::default() }).is_empty() {
                return true;
            }
        }
        false
    }

    pub fn visual_effect_at(&mut self, id: Id, num: i32, rect: &Vol, righttip: bool, variant: usize, with_sound: bool) {
        let z = rect.z.max(self.objs[id].ps.z);
        self.visual_effect(num + 300, [rect.x + rect.vx + if righttip { rect.w } else { 0.0 }, rect.y + rect.vy + rect.h / 2.0, z], variant, with_sound);
    }

    pub fn broken_effect_of(&mut self, id: Id, kind: i32, n: usize) {
        let body = self.objs[id].vol_body(None).first().map(|v| (v.w, v.h));
        let pos = self.objs[id].pos3();
        for i in 0..n {
            self.broken_effect(kind, pos, i, body);
        }
    }
}

/// consultas de colisão
#[derive(Clone, Default)]
pub struct Where {
    pub tag: QTag,
    pub team: Option<i32>,
    pub not_team: Option<i32>,
    pub kind: Option<ObjType>,
    pub kind_any_weapon: bool,
    pub sort_distance: bool,
}

#[derive(Clone, Copy, Default, PartialEq)]
pub enum QTag {
    #[default]
    Body,
    Itr(i32),
}
