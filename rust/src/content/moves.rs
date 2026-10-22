//! Golpes e animações dos lutadores. Cada quadro tem uma pose (desenhada pelo
//! painter); o corpo (bdy), os golpes (itr) e o ponto da arma (wpoint) são
//! calculados a partir das juntas da pose, então desenho e colisão batem.
//!
//! A numeração dos quadros segue o protocolo do motor (ver engine/character.rs):
//!   0-3 parado · 5-8 andando · 9-11 correndo · 12-19 com objeto pesado
//!   20-54 arma · 60-75 socos · 79-98 ataques no ar, correndo e no avanço
//!   100-109 rolamento · 110-117 defesa e pegar · 120-135 agarrão
//!   180-191 queda · 200-206 gelo e fogo · 210-219 pulo, avanço, agachar
//!   220-234 dor, tontura, deitado e arremesso · 240+ golpes especiais

use std::collections::HashMap;

use crate::content::painter::{p, place_pose, Body, Joints, Pose, FIGHTER_SCALE};
use crate::content::roster::{FighterDef, SpecialDef, SpecialType};
use crate::core::consts::UNSPECIFIED;
use crate::core::input::Tag;
use crate::engine::data::*;

pub const CELL: f64 = 96.0;
pub const CX: f64 = 48.0;
pub const BASE: f64 = 95.0;
// caixas escritas em relação a uma célula de 80 px com centro em x = 40
pub const OX: f64 = CX - 40.0;

// ---- poses básicas ----

pub struct Poses {
    pub guard: [Pose; 4],
    pub walk: [Pose; 4],
    pub run: [Pose; 3],
    pub carry: [Pose; 4],
    pub carry_run: [Pose; 3],
    pub brake: Pose,
    pub crouch: Pose,
    pub air: Pose,
    pub dash: Pose,
    pub dash_back: Pose,
    pub defend: [Pose; 2],
    pub broken: [Pose; 3],
    pub pick: Pose,
    pub hurt: [Pose; 6],
    pub dizzy: [Pose; 2],
    pub fall_back: [Pose; 6],
    pub fall_front: [Pose; 6],
    pub lie_back: Pose,
    pub lie_front: Pose,
    pub burn: [Pose; 4],
    pub frozen: Pose,
    pub stiff: Pose,
    pub caught: [Pose; 5],
}

pub fn tuck(r: f64) -> Pose {
    p(30.0, [60.0, 120.0], [40.0, 120.0], [80.0, 140.0], [60.0, 140.0]).rot(r)
}

pub fn poses() -> Poses {
    Poses {
        guard: [
            p(6.0, [35.0, 105.0], [20.0, 115.0], [16.0, 8.0], [-14.0, 10.0]),
            p(7.0, [34.0, 108.0], [19.0, 117.0], [16.0, 10.0], [-14.0, 12.0]),
            p(8.0, [33.0, 110.0], [18.0, 119.0], [16.0, 12.0], [-14.0, 14.0]),
            p(7.0, [34.0, 108.0], [19.0, 117.0], [16.0, 10.0], [-14.0, 12.0]),
        ],
        walk: [
            p(8.0, [30.0, 100.0], [25.0, 112.0], [26.0, 6.0], [-22.0, 18.0]),
            p(8.0, [33.0, 102.0], [22.0, 114.0], [12.0, 22.0], [-8.0, 8.0]),
            p(8.0, [36.0, 104.0], [19.0, 116.0], [-6.0, 14.0], [8.0, 24.0]),
            p(8.0, [39.0, 106.0], [16.0, 118.0], [-20.0, 18.0], [24.0, 6.0]),
        ],
        run: [
            p(22.0, [-30.0, 100.0], [40.0, 95.0], [48.0, 55.0], [-38.0, 30.0]),
            p(20.0, [5.0, 95.0], [5.0, 95.0], [12.0, 85.0], [-6.0, 40.0]),
            p(22.0, [40.0, 95.0], [-30.0, 100.0], [-38.0, 30.0], [48.0, 55.0]),
        ],
        carry: [
            p(0.0, [168.0, 12.0], [160.0, 12.0], [22.0, 8.0], [-20.0, 16.0]),
            p(0.0, [168.0, 12.0], [160.0, 12.0], [10.0, 20.0], [-8.0, 8.0]),
            p(0.0, [168.0, 12.0], [160.0, 12.0], [-6.0, 14.0], [8.0, 22.0]),
            p(0.0, [168.0, 12.0], [160.0, 12.0], [-18.0, 16.0], [22.0, 8.0]),
        ],
        carry_run: [
            p(10.0, [168.0, 12.0], [160.0, 12.0], [45.0, 50.0], [-35.0, 30.0]),
            p(10.0, [168.0, 12.0], [160.0, 12.0], [12.0, 80.0], [-6.0, 40.0]),
            p(10.0, [168.0, 12.0], [160.0, 12.0], [-35.0, 30.0], [45.0, 50.0]),
        ],
        brake: p(-14.0, [60.0, 60.0], [20.0, 80.0], [42.0, 8.0], [-30.0, 40.0]),
        crouch: p(22.0, [40.0, 90.0], [25.0, 100.0], [55.0, 95.0], [-15.0, 75.0]),
        air: p(4.0, [70.0, 80.0], [-30.0, 90.0], [50.0, 75.0], [-20.0, 50.0]),
        dash: p(32.0, [-40.0, 30.0], [-50.0, 40.0], [55.0, 25.0], [-45.0, 45.0]),
        dash_back: p(-24.0, [70.0, 50.0], [50.0, 60.0], [20.0, 30.0], [-50.0, 25.0]),
        defend: [p(-4.0, [62.0, 118.0], [72.0, 108.0], [16.0, 10.0], [-16.0, 12.0]), p(-12.0, [60.0, 120.0], [70.0, 110.0], [22.0, 12.0], [-20.0, 18.0])],
        broken: [
            p(-22.0, [120.0, 20.0], [150.0, 10.0], [24.0, 8.0], [-20.0, 20.0]).face("hurt"),
            p(-14.0, [80.0, 40.0], [110.0, 30.0], [20.0, 14.0], [-24.0, 24.0]).face("hurt"),
            p(-6.0, [40.0, 60.0], [60.0, 50.0], [18.0, 12.0], [-16.0, 16.0]).face("hurt"),
        ],
        pick: p(55.0, [40.0, 10.0], [20.0, 30.0], [60.0, 100.0], [-20.0, 70.0]),
        hurt: [
            p(-20.0, [20.0, 40.0], [-10.0, 30.0], [18.0, 6.0], [-22.0, 14.0]).face("hurt").head(12.0),
            p(-10.0, [25.0, 70.0], [10.0, 70.0], [16.0, 8.0], [-18.0, 14.0]).face("hurt"),
            p(28.0, [10.0, 30.0], [-20.0, 30.0], [10.0, 20.0], [-24.0, 18.0]).face("hurt").head(-10.0),
            p(14.0, [20.0, 60.0], [0.0, 60.0], [14.0, 14.0], [-18.0, 14.0]).face("hurt"),
            p(-32.0, [60.0, 30.0], [40.0, 20.0], [26.0, 14.0], [-14.0, 24.0]).face("hurt").head(20.0),
            p(-16.0, [40.0, 40.0], [20.0, 50.0], [20.0, 10.0], [-20.0, 18.0]).face("hurt"),
        ],
        dizzy: [
            p(-8.0, [5.0, 20.0], [-5.0, 20.0], [12.0, 10.0], [-12.0, 12.0]).face("hurt").head(-15.0).rot(-4.0),
            p(10.0, [10.0, 20.0], [0.0, 20.0], [14.0, 12.0], [-10.0, 10.0]).face("hurt").head(-10.0).rot(5.0),
        ],
        fall_back: [
            p(-28.0, [110.0, 20.0], [80.0, 30.0], [30.0, 20.0], [-10.0, 30.0]).face("hurt").head(15.0),
            p(-20.0, [120.0, 30.0], [90.0, 30.0], [40.0, 40.0], [10.0, 40.0]).face("hurt").rot(-35.0),
            p(-10.0, [130.0, 20.0], [100.0, 30.0], [50.0, 50.0], [20.0, 50.0]).face("hurt").rot(-65.0),
            p(0.0, [110.0, 20.0], [90.0, 30.0], [40.0, 40.0], [20.0, 40.0]).face("hurt").rot(-85.0),
            p(0.0, [90.0, 20.0], [70.0, 20.0], [30.0, 30.0], [10.0, 30.0]).face("hurt").rot(-95.0),
            p(0.0, [80.0, 30.0], [60.0, 30.0], [40.0, 60.0], [20.0, 50.0]).face("hurt").rot(-88.0),
        ],
        fall_front: [
            p(30.0, [-40.0, 30.0], [-60.0, 30.0], [-10.0, 20.0], [-30.0, 30.0]).face("hurt").head(-15.0),
            p(20.0, [-60.0, 30.0], [-80.0, 30.0], [-20.0, 20.0], [-40.0, 30.0]).face("hurt").rot(35.0),
            p(10.0, [-80.0, 20.0], [-100.0, 30.0], [-20.0, 30.0], [-40.0, 30.0]).face("hurt").rot(65.0),
            p(0.0, [-90.0, 20.0], [-110.0, 20.0], [-10.0, 20.0], [-30.0, 20.0]).face("hurt").rot(85.0),
            p(0.0, [-100.0, 10.0], [-110.0, 10.0], [-5.0, 10.0], [-20.0, 10.0]).face("hurt").rot(95.0),
            p(0.0, [-80.0, 30.0], [-100.0, 30.0], [-10.0, 30.0], [-30.0, 40.0]).face("hurt").rot(88.0),
        ],
        lie_back: p(0.0, [100.0, 30.0], [70.0, 20.0], [30.0, 50.0], [5.0, 20.0]).face("hurt").rot(-90.0),
        lie_front: p(0.0, [-100.0, 20.0], [-80.0, 30.0], [-5.0, 10.0], [-25.0, 30.0]).face("hurt").rot(90.0),
        burn: [
            Pose { fire: Some(0), ..p(-20.0, [140.0, 20.0], [120.0, 30.0], [30.0, 40.0], [-10.0, 40.0]).face("hurt").rot(-30.0) },
            Pose { fire: Some(1), ..p(-20.0, [130.0, 30.0], [110.0, 30.0], [40.0, 40.0], [0.0, 40.0]).face("hurt").rot(-40.0) },
            Pose { fire: Some(2), ..p(-10.0, [-60.0, 20.0], [-80.0, 30.0], [-10.0, 20.0], [-30.0, 30.0]).face("hurt").rot(40.0) },
            Pose { fire: Some(1), ..p(-10.0, [-70.0, 30.0], [-90.0, 30.0], [-10.0, 30.0], [-30.0, 30.0]).face("hurt").rot(50.0) },
        ],
        frozen: Pose { ice: true, ..p(-6.0, [40.0, 60.0], [20.0, 60.0], [14.0, 8.0], [-14.0, 10.0]).face("hurt") },
        stiff: p(-6.0, [40.0, 60.0], [20.0, 60.0], [14.0, 8.0], [-14.0, 10.0]).face("hurt"),
        caught: [
            p(-10.0, [10.0, 30.0], [-10.0, 30.0], [14.0, 8.0], [-14.0, 10.0]).face("hurt").head(10.0),
            p(22.0, [0.0, 20.0], [-20.0, 20.0], [10.0, 16.0], [-20.0, 16.0]).face("hurt").head(-12.0),
            p(-24.0, [40.0, 30.0], [20.0, 30.0], [18.0, 10.0], [-16.0, 16.0]).face("hurt").head(18.0),
            p(0.0, [140.0, 20.0], [120.0, 20.0], [10.0, 30.0], [-10.0, 30.0]).face("hurt").rot(-60.0),
            p(0.0, [130.0, 20.0], [110.0, 20.0], [20.0, 40.0], [0.0, 40.0]).face("hurt").rot(-90.0),
        ],
    }
}

// ---- ataques ----

pub struct Attacks {
    pub jab_a: [Pose; 4],
    pub jab_b: [Pose; 4],
    pub upper: [Pose; 6],
    pub jump_kick: [Pose; 6],
    pub run_hit: [Pose; 6],
    pub swing: [Pose; 4],
    pub swing2: [Pose; 4],
    pub throw_light: [Pose; 3],
    pub throw_heavy: [Pose; 2],
    pub grab: [Pose; 4],
    pub lift: [Pose; 3],
}

pub fn attacks(po: &Poses) -> Attacks {
    Attacks {
        jab_a: [
            p(4.0, [20.0, 125.0], [22.0, 112.0], [18.0, 8.0], [-16.0, 12.0]),
            p(14.0, [96.0, -6.0], [16.0, 112.0], [24.0, 6.0], [-20.0, 14.0]).dx(3.0),
            p(10.0, [60.0, 60.0], [20.0, 112.0], [20.0, 8.0], [-18.0, 12.0]).dx(2.0),
            po.guard[0].clone(),
        ],
        jab_b: [
            p(4.0, [35.0, 108.0], [30.0, 120.0], [18.0, 8.0], [-16.0, 12.0]),
            p(16.0, [30.0, 112.0], [96.0, -4.0], [22.0, 6.0], [-22.0, 14.0]).dx(4.0),
            p(10.0, [32.0, 110.0], [60.0, 60.0], [20.0, 8.0], [-18.0, 12.0]).dx(2.0),
            po.guard[0].clone(),
        ],
        upper: [
            p(26.0, [-10.0, 110.0], [30.0, 110.0], [45.0, 70.0], [-20.0, 50.0]),
            p(30.0, [-30.0, 90.0], [30.0, 110.0], [50.0, 80.0], [-20.0, 60.0]),
            p(-6.0, [165.0, 10.0], [20.0, 100.0], [20.0, 6.0], [-30.0, 20.0]).dx(4.0).face("shout"),
            p(-10.0, [170.0, 5.0], [10.0, 100.0], [16.0, 6.0], [-30.0, 20.0]).dx(5.0),
            p(0.0, [120.0, 40.0], [20.0, 100.0], [18.0, 8.0], [-24.0, 14.0]).dx(3.0),
            p(6.0, [60.0, 90.0], [20.0, 110.0], [16.0, 8.0], [-16.0, 12.0]),
        ],
        jump_kick: [
            p(6.0, [70.0, 90.0], [-30.0, 100.0], [70.0, 100.0], [30.0, 110.0]),
            p(0.0, [70.0, 90.0], [-20.0, 100.0], [80.0, 120.0], [20.0, 110.0]),
            p(-6.0, [60.0, 90.0], [-20.0, 90.0], [90.0, 60.0], [-10.0, 80.0]),
            p(-16.0, [60.0, 80.0], [-30.0, 90.0], [98.0, 0.0], [-20.0, 70.0]).face("shout"),
            p(-14.0, [60.0, 80.0], [-30.0, 90.0], [96.0, 4.0], [-20.0, 70.0]),
            p(6.0, [50.0, 90.0], [-10.0, 90.0], [50.0, 80.0], [-10.0, 60.0]),
        ],
        run_hit: [
            p(26.0, [30.0, 100.0], [-10.0, 100.0], [40.0, 50.0], [-30.0, 40.0]),
            p(34.0, [-40.0, 60.0], [50.0, 80.0], [50.0, 60.0], [-40.0, 30.0]).dx(2.0),
            p(30.0, [96.0, -4.0], [-50.0, 40.0], [60.0, 40.0], [-40.0, 20.0]).dx(5.0).face("shout"),
            p(24.0, [94.0, -6.0], [-40.0, 50.0], [40.0, 30.0], [-30.0, 30.0]).dx(4.0),
            p(12.0, [60.0, 60.0], [10.0, 80.0], [30.0, 20.0], [-20.0, 30.0]).dx(2.0),
            p(6.0, [40.0, 90.0], [20.0, 110.0], [20.0, 10.0], [-16.0, 14.0]),
        ],
        // golpes com arma leve (a arma aponta para o antebraço + 90°)
        swing: [
            p(-8.0, [175.0, -15.0], [10.0, 100.0], [20.0, 8.0], [-18.0, 14.0]),
            p(-2.0, [140.0, -15.0], [10.0, 100.0], [20.0, 8.0], [-18.0, 14.0]),
            p(14.0, [85.0, -25.0], [-10.0, 100.0], [26.0, 6.0], [-22.0, 16.0]).dx(3.0).face("shout"),
            p(18.0, [40.0, -35.0], [-20.0, 90.0], [28.0, 8.0], [-24.0, 18.0]).dx(3.0),
        ],
        swing2: [
            p(-4.0, [20.0, 140.0], [20.0, 100.0], [18.0, 8.0], [-18.0, 12.0]),
            p(4.0, [60.0, 120.0], [10.0, 100.0], [20.0, 8.0], [-18.0, 14.0]),
            p(16.0, [100.0, 10.0], [-10.0, 100.0], [26.0, 6.0], [-22.0, 16.0]).dx(3.0).face("shout"),
            p(18.0, [100.0, 50.0], [-20.0, 90.0], [28.0, 8.0], [-24.0, 18.0]).dx(3.0),
        ],
        throw_light: [
            p(-10.0, [200.0, -10.0], [40.0, 80.0], [24.0, 10.0], [-20.0, 16.0]),
            p(4.0, [150.0, -20.0], [30.0, 80.0], [24.0, 10.0], [-22.0, 16.0]),
            p(22.0, [90.0, -30.0], [-30.0, 60.0], [30.0, 8.0], [-26.0, 20.0]).dx(3.0),
        ],
        throw_heavy: [p(-14.0, [175.0, 10.0], [168.0, 10.0], [20.0, 10.0], [-22.0, 16.0]), p(28.0, [95.0, 0.0], [90.0, 0.0], [34.0, 10.0], [-30.0, 24.0]).dx(4.0)],
        grab: [
            p(10.0, [90.0, 0.0], [80.0, 10.0], [22.0, 8.0], [-20.0, 14.0]),
            p(6.0, [100.0, 15.0], [60.0, 80.0], [18.0, 8.0], [-16.0, 12.0]),
            p(2.0, [100.0, 15.0], [10.0, 125.0], [18.0, 8.0], [-18.0, 14.0]),
            p(16.0, [100.0, 15.0], [95.0, -4.0], [22.0, 8.0], [-20.0, 16.0]).dx(3.0),
        ],
        lift: [
            p(-8.0, [172.0, 8.0], [165.0, 10.0], [18.0, 10.0], [-18.0, 14.0]),
            p(26.0, [100.0, 0.0], [95.0, 0.0], [30.0, 10.0], [-28.0, 22.0]).dx(4.0),
            p(18.0, [80.0, 20.0], [70.0, 20.0], [26.0, 10.0], [-24.0, 18.0]),
        ],
    }
}

// ---- utilidades de geometria dos quadros ----

fn ri(v: f64) -> f64 {
    v.round()
}

pub fn box_around(pts: &[[f64; 2]], pad: f64) -> Rect {
    let (mut x0, mut y0, mut x1, mut y1) = (f64::INFINITY, f64::INFINITY, f64::NEG_INFINITY, f64::NEG_INFINITY);
    for q in pts {
        x0 = x0.min(q[0]);
        y0 = y0.min(q[1]);
        x1 = x1.max(q[0]);
        y1 = y1.max(q[1]);
    }
    Rect { x: ri(x0 - pad), y: ri(y0 - pad), w: ri(x1 - x0 + 2.0 * pad), h: ri(y1 - y0 + 2.0 * pad), zwidth: None }
}

fn body_box(j: &Joints) -> Rect {
    let h = Body::HEAD;
    let head = j.get("head");
    let pts = [
        j.get("pelvis"),
        j.get("neck"),
        j.get("chest"),
        j.get("kf"),
        j.get("kb"),
        j.get("af"),
        j.get("ab"),
        j.get("tf"),
        j.get("tb"),
        [head[0] - h, head[1] - h],
        [head[0] + h, head[1] + h],
    ];
    let mut b = box_around(&pts, 2.0);
    b.w = b.w.max(20.0);
    b
}

/// especificação de um itr: ou centrado numa junta (`at`, avançado fx/fy), ou com x/y explícitos
#[derive(Clone, Debug)]
pub struct ItrSpec {
    pub at: Option<&'static str>,
    pub w: f64,
    pub h: f64,
    pub fx: f64,
    pub fy: f64,
    pub itr: Itr,
}

pub fn hit_at(at: &'static str, w: f64, h: f64, fx: f64, fy: f64, itr: Itr) -> ItrSpec {
    ItrSpec { at: Some(at), w, h, fx, fy, itr }
}
pub fn itr_xy(itr: Itr) -> ItrSpec {
    ItrSpec { at: None, w: itr.w, h: itr.h, fx: 0.0, fy: 0.0, itr }
}

impl ItrSpec {
    fn resolve(&self, j: &Joints) -> Itr {
        let mut it = self.itr.clone();
        if let Some(at) = self.at {
            let q = j.get(at);
            it.x = ri(q[0] - self.w / 2.0 + self.fx);
            it.y = ri(q[1] - self.h / 2.0 + self.fy);
            it.w = self.w;
            it.h = self.h;
        }
        it
    }
}

/// ângulo da arma (0..15) a partir da direção do antebraço
fn weapon_index(dir: f64) -> i32 {
    ((((180.0 - dir) / 22.5).round() as i32 % 16) + 16) % 16
}

type CpFn = Box<dyn Fn(&Joints) -> CPoint>;
type OpFn = Box<dyn Fn(&Joints) -> OPoint>;

pub enum OpSpec {
    Func(OpFn),
    List(Vec<OPoint>),
}

#[derive(Default)]
pub struct WpSpec {
    pub attacking: Option<i32>,
    pub dvx: Option<f64>,
    pub dvy: Option<f64>,
    pub dvz: Option<f64>,
}

/// o que um quadro precisa: o resto é calculado das juntas da pose
pub struct FrameSpec {
    pub name: &'static str,
    pub state: i32,
    pub wait: Option<i32>,
    pub next: Option<i32>,
    pub pose: Pose,
    pub itr: Vec<ItrSpec>,
    pub no_bdy: bool,
    pub wp: WpSpec,
    pub carry: bool,
    pub cp: Option<CpFn>,
    pub op: Option<OpSpec>,
    pub dvx: Option<f64>,
    pub dvy: Option<f64>,
    pub dvz: Option<f64>,
    pub mp: Option<i32>,
    pub hit_a: Option<i32>,
    pub hit_d: Option<i32>,
    pub sound: Option<&'static str>,
    pub land: Option<i32>,
}

pub fn fs(name: &'static str, state: i32, pose: Pose) -> FrameSpec {
    FrameSpec {
        name,
        state,
        wait: None,
        next: None,
        pose,
        itr: vec![],
        no_bdy: false,
        wp: WpSpec::default(),
        carry: false,
        cp: None,
        op: None,
        dvx: None,
        dvy: None,
        dvz: None,
        mp: None,
        hit_a: None,
        hit_d: None,
        sound: None,
        land: None,
    }
}

impl FrameSpec {
    pub fn wait(mut self, w: i32) -> Self {
        self.wait = Some(w);
        self
    }
    pub fn next(mut self, n: i32) -> Self {
        self.next = Some(n);
        self
    }
    pub fn itr(mut self, i: ItrSpec) -> Self {
        self.itr.push(i);
        self
    }
    pub fn itr_opt(mut self, i: Option<ItrSpec>) -> Self {
        if let Some(i) = i {
            self.itr.push(i);
        }
        self
    }
    pub fn no_bdy(mut self) -> Self {
        self.no_bdy = true;
        self
    }
    pub fn carry(mut self) -> Self {
        self.carry = true;
        self
    }
    pub fn wp(mut self, w: WpSpec) -> Self {
        self.wp = w;
        self
    }
    pub fn cp(mut self, f: CpFn) -> Self {
        self.cp = Some(f);
        self
    }
    pub fn op(mut self, f: OpFn) -> Self {
        self.op = Some(OpSpec::Func(f));
        self
    }
    pub fn ops(mut self, l: Vec<OPoint>) -> Self {
        self.op = Some(OpSpec::List(l));
        self
    }
    pub fn dvx(mut self, v: f64) -> Self {
        self.dvx = Some(v);
        self
    }
    pub fn dvx_opt(mut self, v: Option<f64>) -> Self {
        self.dvx = v;
        self
    }
    pub fn dvy(mut self, v: f64) -> Self {
        self.dvy = Some(v);
        self
    }
    pub fn dvy_opt(mut self, v: Option<f64>) -> Self {
        self.dvy = v;
        self
    }
    pub fn mp(mut self, v: i32) -> Self {
        self.mp = Some(v);
        self
    }
    pub fn mp_opt(mut self, v: Option<i32>) -> Self {
        self.mp = v;
        self
    }
    pub fn hit_a(mut self, v: i32) -> Self {
        self.hit_a = Some(v);
        self
    }
    pub fn hit_a_opt(mut self, v: Option<i32>) -> Self {
        self.hit_a = v;
        self
    }
    pub fn sound(mut self, s: &'static str) -> Self {
        self.sound = Some(s);
        self
    }
    pub fn sound_opt(mut self, s: Option<&'static str>) -> Self {
        self.sound = s;
        self
    }
    pub fn land(mut self, v: i32) -> Self {
        self.land = Some(v);
        self
    }
}

/// bola de energia criada por um lutador
#[derive(Clone, Debug)]
pub struct BallSpec {
    pub id: i32,
    pub color: String,
    pub style: String,
    pub effect: i32,
    pub injury: f64,
    pub fall: f64,
    pub speed: f64,
    pub chase: bool,
    pub multi: bool,
    pub broken: bool,
    pub ground: bool,
}

// ---- construção de um lutador ----

pub struct FighterBuilder {
    pub def: FighterDef,
    pub frames: Vec<Option<Frame>>,
    pub poses: Vec<Pose>,
    keys: HashMap<String, usize>,
    pub specials: Vec<(Tag, i32)>, // etiqueta -> quadro inicial
    pub objects: Vec<BallSpec>,    // bolas criadas por este lutador
    pub next_ball_id: i32,
}

impl FighterBuilder {
    pub fn new(def: FighterDef, next_ball_id: i32) -> FighterBuilder {
        FighterBuilder { def, frames: vec![], poses: vec![], keys: HashMap::new(), specials: vec![], objects: vec![], next_ball_id }
    }

    pub fn pic(&mut self, pose: &Pose) -> usize {
        let k = pose.key();
        if let Some(i) = self.keys.get(&k) {
            return *i;
        }
        self.poses.push(pose.clone());
        let i = self.poses.len() - 1;
        self.keys.insert(k, i);
        i
    }

    pub fn joints(&self, pose: &Pose) -> Joints {
        place_pose(pose, self.def.look.scale * FIGHTER_SCALE, CX, BASE)
    }

    pub fn frame(&self, n: i32) -> Option<&Frame> {
        self.frames.get(n as usize).and_then(|f| f.as_ref())
    }

    /// registra o quadro n
    pub fn f(&mut self, n: i32, o: FrameSpec) {
        let j = self.joints(&o.pose);
        let pic = self.pic(&o.pose);
        let mut f = Frame {
            name: o.name,
            state: o.state,
            wait: o.wait.unwrap_or(1),
            next: o.next.unwrap_or(999),
            pic,
            centerx: CX,
            centery: BASE,
            dvx: o.dvx,
            dvy: o.dvy,
            dvz: o.dvz,
            mp: o.mp,
            sound: o.sound,
            land: o.land,
            ..Default::default()
        };
        if let Some(v) = o.hit_a {
            f.set_tag(Tag::A, v);
        }
        if let Some(v) = o.hit_d {
            f.set_tag(Tag::D, v);
        }
        if !o.no_bdy {
            f.bdy = vec![body_box(&j)];
        }
        f.itr = o.itr.iter().map(|s| s.resolve(&j)).collect();
        if o.carry {
            let hf = j.get("hf");
            let hb = j.get("hb");
            let x = (hf[0] + hb[0]) / 2.0;
            let y = hf[1].min(hb[1]);
            f.wpoint = Some(WPoint {
                kind: 1,
                x: ri(x),
                y: ri(y - 2.0),
                weaponact: 10,
                attacking: 0,
                cover: 0,
                dvx: o.wp.dvx.unwrap_or(0.0),
                dvy: o.wp.dvy.unwrap_or(0.0),
                dvz: o.wp.dvz.unwrap_or(0.0),
            });
        } else {
            let hf = j.get("hf");
            f.wpoint = Some(WPoint {
                kind: 1,
                x: ri(hf[0]),
                y: ri(hf[1]),
                weaponact: 20 + weapon_index(j.faf + 90.0),
                attacking: o.wp.attacking.unwrap_or(0),
                cover: 0,
                dvx: o.wp.dvx.unwrap_or(0.0),
                dvy: o.wp.dvy.unwrap_or(0.0),
                dvz: o.wp.dvz.unwrap_or(0.0),
            });
        }
        if let Some(cp) = &o.cp {
            f.cpoint = Some(cp(&j));
        }
        match &o.op {
            Some(OpSpec::Func(func)) => f.opoint = vec![func(&j)],
            Some(OpSpec::List(l)) => f.opoint = l.clone(),
            None => {}
        }
        let n = n as usize;
        if self.frames.len() <= n {
            self.frames.resize_with(n + 1, || None);
        }
        self.frames[n] = Some(f);
    }

    /// quadros em sequência a partir de `first`; o último vai para `last` (ou 999)
    pub fn chain(&mut self, first: i32, list: Vec<FrameSpec>, last: Option<i32>) {
        let n = list.len() as i32;
        for (i, mut o) in list.into_iter().enumerate() {
            let i = i as i32;
            if o.next.is_none() {
                o.next = Some(if i < n - 1 { first + i + 1 } else { last.unwrap_or(999) });
            }
            self.f(first + i, o);
        }
    }

    fn make_ball(&mut self, b: BallSpec) -> i32 {
        let id = self.next_ball_id;
        self.next_ball_id += 1;
        self.objects.push(BallSpec { id, ..b });
        id
    }
}

/// cpoint de quem agarra: a vítima fica presa na mão da frente
fn grab_point(vaction: i32, aaction: Option<i32>, taction: Option<i32>, injury: Option<f64>) -> CpFn {
    Box::new(move |j: &Joints| {
        let hf = j.get("hf");
        CPoint {
            kind: 1,
            x: ri(hf[0] + 2.0),
            y: ri(hf[1]),
            hurtable: Some(1),
            throwvz: Some(UNSPECIFIED),
            throwinjury: Some(UNSPECIFIED),
            vaction: Some(vaction),
            aaction,
            taction,
            injury,
            ..Default::default()
        }
    })
}
/// cpoint da vítima: o ponto preso é o pescoço
fn held_point(front: i32, back: i32) -> CpFn {
    Box::new(move |j: &Joints| {
        let n = j.get("neck");
        CPoint { kind: 2, x: ri(n[0]), y: ri(n[1] + 2.0), fronthurtact: Some(front), backhurtact: Some(back), ..Default::default() }
    })
}
fn pelvis_point() -> CpFn {
    Box::new(|j: &Joints| {
        let q = j.get("pelvis");
        CPoint { kind: 2, x: ri(q[0]), y: ri(q[1]), ..Default::default() }
    })
}

fn hit(inj: f64, pw: f64) -> Itr {
    Itr { kind: 0, injury: Some(ri(inj * pw)), bdefend: Some(16.0), dvx: Some(2.0), ..Default::default() }
}

pub fn build_moveset(b: &mut FighterBuilder) {
    let st = b.def.stats.clone();
    let pw = st.power;
    let po = poses();
    let atk = attacks(&po);

    // parado, andando, correndo
    for (i, pz) in po.guard.iter().enumerate() {
        b.f(i as i32, fs("standing", 0, pz.clone()).wait([6, 4, 6, 8][i]).next(if i < 3 { i as i32 + 1 } else { 999 }));
    }
    let catch_itr = hit_at("chest", 26.0, 60.0, 14.0, 0.0, Itr { kind: 1, catchingact: Some([120, 120]), caughtact: Some([130, 130]), ..Default::default() });
    for (i, pz) in po.walk.iter().enumerate() {
        b.f(5 + i as i32, fs("walking", 1, pz.clone()).wait(3).itr(catch_itr.clone()));
    }
    for (i, pz) in po.run.iter().enumerate() {
        b.f(9 + i as i32, fs("running", 2, pz.clone()).wait(3).next(0).sound_opt(if i == 1 { Some("step") } else { None }));
    }
    for (i, pz) in po.carry.iter().enumerate() {
        b.f(12 + i as i32, fs("heavy_walk", 1, pz.clone()).wait(3).next(0).carry());
    }
    for (i, pz) in po.carry_run.iter().enumerate() {
        b.f(16 + i as i32, fs("heavy_run", 2, pz.clone()).wait(3).next(0).carry());
    }
    b.f(19, fs("heavy_stop", 15, p(-12.0, [168.0, 12.0], [160.0, 12.0], [40.0, 10.0], [-28.0, 30.0])).wait(6).dvx(2.0).carry().sound("step"));

    // arma leve: golpe normal (20 e 25), no pulo (30), correndo (35), no avanço (40)
    let swing = |b: &mut FighterBuilder, first: i32, poses: Vec<Pose>, att: i32, dvx: Option<f64>| {
        let list = poses
            .into_iter()
            .enumerate()
            .map(|(i, pz)| {
                fs("weapon_attack", 3, pz)
                    .wp(WpSpec { attacking: Some(if i >= 2 { att } else { 0 }), ..Default::default() })
                    .sound_opt(if i == 1 { Some("swing") } else { None })
                    .wait(if i == 3 { 2 } else { 1 })
                    .dvx_opt(dvx)
            })
            .collect();
        b.chain(first, list, None);
    };
    swing(b, 20, atk.swing.to_vec(), 1, None);
    swing(b, 25, atk.swing2.to_vec(), 1, None);
    swing(b, 30, atk.swing.iter().map(|q| q.clone().lf([60.0, 80.0]).lb([-10.0, 60.0])).collect(), 2, None);
    swing(b, 35, atk.swing2.iter().map(|q| Pose { lean: q.lean + 10.0, ..q.clone().lf([45.0, 30.0]).lb([-30.0, 30.0]) }).collect(), 3, Some(5.0));
    swing(b, 40, atk.swing.iter().map(|q| q.clone().lf([70.0, 60.0]).lb([-30.0, 50.0])).collect(), 4, None);
    // arremessos de arma
    b.chain(
        45,
        atk.throw_light
            .iter()
            .enumerate()
            .map(|(i, pz)| {
                fs("throw_weapon", 15, pz.clone()).wait([3, 1, 8][i]).sound_opt(if i == 1 { Some("swing") } else { None }).wp(if i == 2 {
                    WpSpec { dvx: Some(18.0), dvy: Some(-3.0), dvz: Some(3.0), attacking: None }
                } else {
                    WpSpec::default()
                })
            })
            .collect(),
        None,
    );
    b.chain(
        50,
        atk.throw_heavy
            .iter()
            .enumerate()
            .map(|(i, pz)| {
                fs("throw_heavy", 15, pz.clone()).wait([4, 8][i]).carry().sound_opt(if i == 1 { Some("swing") } else { None }).wp(if i == 1 {
                    WpSpec { dvx: Some(12.0), dvy: Some(-5.0), dvz: Some(2.0), attacking: None }
                } else {
                    WpSpec::default()
                })
            })
            .collect(),
        None,
    );
    b.chain(
        52,
        atk.throw_light
            .iter()
            .enumerate()
            .map(|(i, pz)| {
                fs("sky_throw", 15, pz.clone().lf([60.0, 80.0]).lb([-10.0, 60.0]))
                    .wait([3, 1, 8][i])
                    .sound_opt(if i == 1 { Some("swing") } else { None })
                    .dvy_opt(if i == 1 { Some(-2.0) } else { None })
                    .wp(if i == 2 { WpSpec { dvx: Some(16.0), dvy: Some(7.0), dvz: Some(3.0), attacking: None } } else { WpSpec::default() })
            })
            .collect(),
        None,
    );

    // socos
    let punch = |b: &mut FighterBuilder, first: i32, poses: &[Pose; 4], at: &'static str| {
        let list = poses
            .iter()
            .enumerate()
            .map(|(i, pz)| {
                let mut f = fs("punch", 3, pz.clone()).wait(1).dvx_opt(if i >= 1 { Some(2.0) } else { None }).sound_opt(if i == 1 { Some("swing") } else { None });
                if i == 0 {
                    f = f.itr(hit_at("pelvis", 36.0, 22.0, 10.0, -8.0, Itr { kind: 2, vrest: Some(1), ..Default::default() }));
                } else if i == 1 {
                    f = f.itr(hit_at(at, 30.0, 16.0, -4.0, 0.0, hit(st.punch, pw)));
                }
                f
            })
            .collect();
        b.chain(first, list, None);
    };
    punch(b, 60, &atk.jab_a, "hf");
    punch(b, 65, &atk.jab_b, "hb");
    // soco forte (inimigo tonto): 72/73 também servem para o motor achar o alcance
    b.chain(
        70,
        atk.upper
            .iter()
            .enumerate()
            .map(|(i, pz)| {
                fs("super_punch", 3, pz.clone())
                    .wait([2, 1, 2, 1, 2, 2][i])
                    .dvx_opt(if i == 2 { Some(3.0) } else { None })
                    .sound_opt(if i == 2 { Some("swing") } else { None })
                    .itr_opt(if i == 2 || i == 3 {
                        Some(hit_at("hf", 34.0, 40.0, 0.0, 0.0, Itr { dvx: Some(4.0), dvy: Some(-11.0), fall: Some(70.0), arest: Some(15), bdefend: Some(60.0), ..hit(42.0, pw) }))
                    } else {
                        None
                    })
            })
            .collect(),
        None,
    );

    // chute no pulo (80) e no avanço (90)
    let kick = |b: &mut FighterBuilder, first: i32, inj: f64, dvx: f64| {
        let list = atk.jump_kick[..5]
            .iter()
            .enumerate()
            .map(|(i, pz)| {
                fs("air_kick", 3, pz.clone()).wait([1, 1, 1, 3, 2][i]).sound_opt(if i == 1 { Some("swing") } else { None }).itr_opt(if i >= 3 {
                    Some(hit_at("tf", 34.0, 18.0, -6.0, 0.0, Itr { dvx: Some(dvx), dvy: Some(-5.0), fall: Some(70.0), arest: Some(12), bdefend: Some(40.0), ..hit(inj, pw) }))
                } else {
                    None
                })
            })
            .collect();
        b.chain(first, list, Some(if first == 80 { 79 } else { 96 }));
    };
    kick(b, 80, st.kick, 9.0);
    b.f(79, fs("air_kick_end", 3, atk.jump_kick[5].clone()).wait(3));
    kick(b, 90, st.kick * 1.4, 13.0);
    b.f(96, fs("dash_kick_end", 3, atk.jump_kick[5].clone()).wait(3).next(96));
    b.f(95, fs("dash_defend", 7, po.defend[0].clone()).wait(2).next(0));

    // ataque correndo
    b.chain(
        85,
        atk.run_hit[..5]
            .iter()
            .enumerate()
            .map(|(i, pz)| {
                fs("run_attack", 3, pz.clone())
                    .wait([2, 1, 2, 3, 2][i])
                    .dvx_opt([None, Some(14.0), Some(10.0), Some(6.0), None][i])
                    .sound_opt(if i == 1 { Some("swing") } else { None })
                    .itr_opt(if i == 2 || i == 3 {
                        Some(hit_at("hf", 40.0, 34.0, -8.0, 0.0, Itr { dvx: Some(12.0), fall: Some(70.0), vrest: Some(8), bdefend: Some(60.0), ..hit(45.0, pw) }))
                    } else {
                        None
                    })
            })
            .collect(),
        Some(97),
    );
    b.f(97, fs("run_attack", 3, atk.run_hit[5].clone()).wait(2).next(98));
    b.f(98, fs("run_attack", 3, po.guard[0].clone()).wait(1));

    // rolamentos
    b.f(100, fs("roll", 6, tuck(-90.0)).wait(2).next(101).sound("jump").no_bdy());
    b.f(101, fs("roll", 6, tuck(-200.0)).wait(6).next(0).no_bdy());
    let pick_roll = hit_at("pelvis", 16.0, 26.0, 0.0, 0.0, Itr { kind: 7, vrest: Some(1), ..Default::default() });
    for (i, r) in [0.0, 90.0, 180.0, 270.0, 360.0, 450.0].iter().enumerate() {
        let i = i as i32;
        b.f(102 + i, fs("dash_roll", 6, tuck(r + 30.0)).wait(2).dvx(9.0).next(if i == 2 || i == 5 { 219 } else { 103 + i }).itr(pick_roll.clone()).no_bdy());
    }
    b.f(108, fs("roll_back", 6, tuck(60.0)).wait(3).next(109).sound("jump").no_bdy());
    b.f(109, fs("roll_back", 6, tuck(180.0)).wait(6).next(0).no_bdy());

    // defesa e pegar armas
    b.f(110, fs("defend", 7, po.defend[0].clone()).wait(12));
    b.f(111, fs("defend", 7, po.defend[1].clone()).wait(0).next(110));
    let broke_itr = itr_xy(Itr { kind: 6, x: OX - 6.0, y: BASE - 65.0, w: 86.0, h: 66.0, vrest: Some(1), ..Default::default() });
    for (i, pz) in po.broken.iter().enumerate() {
        let i = i as i32;
        b.f(112 + i, fs("broken_defend", 8, pz.clone()).wait([1, 2, 3][i as usize]).next(if i < 2 { 113 + i } else { 999 }).dvx(-2.0).itr(broke_itr.clone()));
    }
    b.f(115, fs("pick_light", 15, po.pick.clone()).wait(4).sound("pick"));
    b.f(116, fs("pick_heavy", 15, po.pick.clone()).wait(2).next(117).sound("pick"));
    b.f(117, fs("pick_heavy", 15, p(10.0, [150.0, 30.0], [140.0, 30.0], [30.0, 50.0], [-20.0, 40.0])).wait(2).carry());

    // agarrão: 120 agarra, 121 segura, 122-123 soca, 232-234 arremessa
    b.f(120, fs("catching", 9, atk.grab[0].clone()).wait(2).next(121).sound("grab").cp(grab_point(130, None, None, None)));
    b.f(121, fs("catching", 9, atk.grab[1].clone()).wait(0).next(0).cp(grab_point(130, Some(122), Some(-232), None)));
    b.f(122, fs("catching", 9, atk.grab[2].clone()).wait(4).next(123).cp(grab_point(130, None, None, None)));
    b.f(123, fs("catching", 9, atk.grab[3].clone()).wait(4).next(121).sound("hit").cp(grab_point(131, None, None, Some(ri(14.0 * pw)))));
    b.f(
        232,
        fs("throw", 9, atk.lift[0].clone()).wait(3).next(233).cp(Box::new(|j: &Joints| {
            let hf = j.get("hf");
            let hb = j.get("hb");
            CPoint {
                kind: 1,
                x: ri((hf[0] + hb[0]) / 2.0),
                y: ri(hf[1].min(hb[1]) - 6.0),
                vaction: Some(134),
                throwvz: Some(UNSPECIFIED),
                throwinjury: Some(UNSPECIFIED),
                dircontrol: Some(1),
                ..Default::default()
            }
        })),
    );
    b.f(
        233,
        fs("throw", 9, atk.lift[1].clone()).wait(1).next(234).sound("swing").cp(Box::new(move |j: &Joints| {
            let hf = j.get("hf");
            CPoint {
                kind: 1,
                x: ri(hf[0] + 8.0),
                y: ri(hf[1]),
                vaction: Some(181),
                throwvx: Some(12.0),
                throwvy: Some(-7.0),
                throwvz: Some(3.0),
                throwinjury: Some(ri(32.0 * pw)),
                ..Default::default()
            }
        })),
    );
    b.f(234, fs("throw", 9, atk.lift[2].clone()).wait(4));
    // sendo agarrado
    b.f(130, fs("caught", 10, po.caught[0].clone()).wait(3).next(0).cp(held_point(131, 132)));
    b.f(131, fs("caught", 10, po.caught[1].clone()).wait(3).next(0).cp(held_point(132, 132)));
    b.f(132, fs("caught", 10, po.caught[2].clone()).wait(3).next(0).cp(held_point(131, 131)));
    b.f(133, fs("caught", 10, po.caught[3].clone()).wait(3).next(0).cp(pelvis_point()));
    b.f(134, fs("caught", 10, po.caught[4].clone()).wait(3).next(0).cp(pelvis_point()));
    b.f(135, fs("caught", 10, po.caught[4].clone()).wait(3).next(0).cp(pelvis_point()));

    // quedas: corpos arremessados atingem quem estiver no caminho (itr kind 4)
    let body_hit =
        hit_at("chest", 36.0, 30.0, 0.0, 0.0, Itr { kind: 4, dvx: Some(2.0), fall: Some(70.0), vrest: Some(20), bdefend: Some(10.0), injury: Some(25.0), ..Default::default() });
    for (i, pz) in po.fall_back.iter().enumerate() {
        b.f(180 + i as i32, fs("falling", 12, pz.clone()).wait(3).next(0).itr_opt(if i < 4 { Some(body_hit.clone()) } else { None }));
    }
    for (i, pz) in po.fall_front.iter().enumerate() {
        b.f(186 + i as i32, fs("falling", 12, pz.clone()).wait(3).next(0).itr_opt(if i < 4 { Some(body_hit.clone()) } else { None }));
    }

    // gelo e fogo
    b.f(200, fs("ice", 15, po.stiff.clone()).wait(2).next(201));
    b.f(
        201,
        fs("ice", 13, po.frozen.clone()).wait(90).next(202).itr(itr_xy(Itr { kind: 14, x: OX + 18.0, y: BASE - 69.0, w: 44.0, h: 68.0, vrest: Some(1), ..Default::default() })),
    );
    b.f(202, fs("ice", 15, po.stiff.clone()).wait(1).next(182).dvx(-4.0).dvy(-3.0));
    let fire_itr = hit_at(
        "chest",
        30.0,
        24.0,
        0.0,
        0.0,
        Itr { kind: 0, dvx: Some(-6.0), dvy: Some(-6.0), fall: Some(70.0), vrest: Some(10), bdefend: Some(16.0), injury: Some(25.0), effect: Some(20), ..Default::default() },
    );
    for (i, pz) in po.burn.iter().enumerate() {
        let i = i as i32;
        b.f(203 + i, fs("fire", 18, pz.clone()).wait(1).next(if i % 2 == 0 { 204 + i } else { 202 + i }).itr(fire_itr.clone()));
    }

    // pulo, avanço, agachar
    b.f(210, fs("jump", 4, po.crouch.clone()).wait(1).next(211));
    b.f(211, fs("jump", 4, po.crouch.clone()).wait(1).next(212).sound("jump"));
    b.f(212, fs("jump", 4, po.air.clone()).wait(1).next(0));
    b.f(213, fs("dash", 5, po.dash.clone()).wait(8).next(216));
    b.f(214, fs("dash", 5, po.dash_back.clone()).wait(8).next(217));
    b.f(216, fs("dash", 5, po.dash.clone().lf([40.0, 50.0])).wait(2).next(0));
    b.f(217, fs("dash", 5, po.dash_back.clone().lb([-30.0, 40.0])).wait(2).next(0));
    b.f(215, fs("crouch", 15, po.crouch.clone()).wait(2).sound("land"));
    b.f(218, fs("stop_running", 15, po.brake.clone()).wait(5).dvx(1.0).sound("step"));
    b.f(219, fs("crouch", 15, po.crouch.clone()).wait(2).sound("land"));

    // dor e tontura
    for (i, pz) in po.hurt.iter().enumerate() {
        let i = i as i32;
        b.f(220 + i, fs("injured", 11, pz.clone()).wait(if i % 2 == 1 { 3 } else { 2 }).next(if i % 2 == 1 { 999 } else { 221 + i }));
    }
    let dizzy_itr = itr_xy(Itr { kind: 6, x: OX + 6.0, y: BASE - 67.0, w: 86.0, h: 68.0, vrest: Some(1), ..Default::default() });
    for (i, k) in [0usize, 1, 0, 1].iter().enumerate() {
        let i = i as i32;
        b.f(226 + i, fs("dizzy", 16, po.dizzy[*k].clone()).wait(7).next(if i < 3 { 227 + i } else { 999 }).itr(dizzy_itr.clone()));
    }
    b.f(230, fs("lying", 14, po.lie_back.clone()).wait(30).next(219).no_bdy());
    b.f(231, fs("lying", 14, po.lie_front.clone()).wait(30).next(219).no_bdy());

    // golpes especiais
    let specials = b.def.specials.clone();
    for sp in &specials {
        build_special(b, sp, &po, &atk);
    }
    // quadros de onde os especiais podem começar
    let tags = b.specials.clone();
    for n in [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 110] {
        if let Some(Some(f)) = b.frames.get_mut(n as usize) {
            for (t, at) in &tags {
                f.set_tag(*t, *at);
            }
        }
    }
}

// ---- golpes especiais ----
// Cada um recebe o construtor e a definição (etiqueta, quadro inicial, MP...) e registra b.specials.

fn build_special(b: &mut FighterBuilder, sp: &SpecialDef, po: &Poses, atk: &Attacks) {
    let n = sp.at;
    match sp.kind {
        // bola de energia (fogo, gelo, raio...) disparada para a frente; ataque de novo dispara outra
        SpecialType::Blast => {
            let ball = b.make_ball(BallSpec {
                id: 0,
                color: sp.color.into(),
                style: sp.style.into(),
                effect: sp.effect,
                injury: if sp.injury > 0.0 { sp.injury } else { 35.0 },
                fall: sp.fall.unwrap_or(30.0),
                speed: if sp.speed > 0.0 { sp.speed } else { 12.0 },
                chase: false,
                multi: sp.multi,
                broken: sp.style == "shard",
                ground: false,
            });
            let poses = [
                p(-4.0, [-40.0, 100.0], [-30.0, 110.0], [26.0, 10.0], [-20.0, 18.0]).face("shout"),
                p(-6.0, [-60.0, 110.0], [-50.0, 120.0], [28.0, 12.0], [-22.0, 20.0]),
                p(16.0, [94.0, 0.0], [88.0, 10.0], [30.0, 8.0], [-26.0, 18.0]).dx(3.0).face("shout").open(),
                p(14.0, [92.0, 0.0], [86.0, 10.0], [30.0, 8.0], [-26.0, 18.0]).dx(3.0).open(),
                p(6.0, [50.0, 80.0], [30.0, 100.0], [20.0, 10.0], [-18.0, 14.0]),
            ];
            let facing = if sp.multi { 30 } else { 0 };
            let snd = sp.sound.unwrap_or("blast");
            let list = poses
                .iter()
                .enumerate()
                .map(|(i, pz)| {
                    let mut f = fs("blast", 3, pz.clone())
                        .wait([1, 2, 1, 3, 2][i])
                        .mp_opt(if i == 0 { Some(sp.mp) } else { None })
                        .sound_opt(if i == 2 { Some(snd) } else { None })
                        .hit_a_opt(if i == 3 { Some(n) } else { None });
                    if i == 2 {
                        f = f.op(Box::new(move |j: &Joints| {
                            let hf = j.get("hf");
                            OPoint { kind: 1, x: ri(hf[0] + 10.0), y: ri(hf[1]), action: 0, dvx: 0.0, dvy: 0.0, oid: ball, facing, dvz: None }
                        }));
                    }
                    f
                })
                .collect();
            b.chain(n, list, None);
        }
        // bola que persegue o inimigo mais próximo
        SpecialType::Chase => {
            let ball = b.make_ball(BallSpec {
                id: 0,
                color: sp.color.into(),
                style: "orb".into(),
                effect: 0,
                injury: if sp.injury > 0.0 { sp.injury } else { 30.0 },
                fall: 40.0,
                speed: 6.0,
                chase: true,
                multi: false,
                broken: false,
                ground: false,
            });
            let poses = [
                p(-8.0, [150.0, 40.0], [140.0, 40.0], [20.0, 10.0], [-18.0, 14.0]).face("shout").open(),
                p(-10.0, [170.0, 10.0], [160.0, 10.0], [20.0, 10.0], [-18.0, 14.0]).open(),
                p(8.0, [110.0, 10.0], [100.0, 10.0], [24.0, 8.0], [-20.0, 16.0]).dx(2.0).open(),
                p(6.0, [60.0, 70.0], [40.0, 80.0], [20.0, 8.0], [-18.0, 14.0]),
            ];
            let list = poses
                .iter()
                .enumerate()
                .map(|(i, pz)| {
                    let mut f = fs("chase", 3, pz.clone())
                        .wait([2, 2, 3, 3][i])
                        .mp_opt(if i == 0 { Some(sp.mp) } else { None })
                        .sound_opt(if i == 2 { Some("blast") } else { None })
                        .hit_a_opt(if i == 2 { Some(n) } else { None });
                    if i == 2 {
                        f = f.op(Box::new(move |j: &Joints| {
                            let hf = j.get("hf");
                            OPoint { kind: 1, x: ri(hf[0] + 6.0), y: ri(hf[1] - 6.0), action: 0, dvx: 0.0, dvy: -2.0, oid: ball, facing: 0, dvz: None }
                        }));
                    }
                    f
                })
                .collect();
            b.chain(n, list, None);
        }
        // gancho subindo: arremessa para cima
        SpecialType::Uppercut => {
            let inj = if sp.injury > 0.0 { sp.injury } else { 55.0 };
            let poses = [
                p(30.0, [-20.0, 100.0], [30.0, 110.0], [55.0, 95.0], [-20.0, 70.0]),
                p(-4.0, [160.0, 10.0], [20.0, 100.0], [30.0, 40.0], [-30.0, 60.0]).dx(3.0).face("shout"),
                p(-10.0, [172.0, 5.0], [10.0, 100.0], [10.0, 40.0], [-20.0, 70.0]),
                p(-6.0, [170.0, 5.0], [10.0, 100.0], [10.0, 50.0], [-20.0, 70.0]),
                p(10.0, [120.0, 40.0], [20.0, 100.0], [40.0, 70.0], [-10.0, 60.0]),
            ];
            let big = hit_at(
                "chest",
                44.0,
                64.0,
                20.0,
                -6.0,
                Itr {
                    kind: 0,
                    injury: Some(inj),
                    dvx: Some(3.0),
                    dvy: Some(-13.0),
                    fall: Some(70.0),
                    vrest: Some(12),
                    bdefend: Some(60.0),
                    effect: Some(sp.effect),
                    ..Default::default()
                },
            );
            let list = poses
                .iter()
                .enumerate()
                .map(|(i, pz)| {
                    fs("uppercut", 3, pz.clone())
                        .wait([2, 2, 2, 3, 3][i])
                        .mp_opt(if i == 0 { Some(sp.mp) } else { None })
                        .dvx_opt(if i == 1 { Some(5.0) } else { None })
                        .dvy_opt(if i == 1 { Some(-12.0) } else { None })
                        .sound_opt(if i == 1 { Some("swing") } else { None })
                        .itr_opt(if i == 1 || i == 2 { Some(big.clone()) } else { None })
                })
                .collect();
            b.chain(n, list, None);
        }
        // avanço com rajada de socos (ou chutes) e um golpe final
        SpecialType::Rush => {
            let kicks = sp.kicks;
            let a = |k: bool| -> Pose {
                if kicks {
                    p(-6.0, [60.0, 80.0], [-20.0, 90.0], if k { [96.0, 0.0] } else { [-20.0, 40.0] }, if k { [-20.0, 40.0] } else { [96.0, 0.0] }).dx(3.0)
                } else {
                    p(16.0, if k { [96.0, -4.0] } else { [40.0, 110.0] }, if k { [30.0, 112.0] } else { [96.0, -4.0] }, [26.0, 6.0], [-24.0, 16.0]).dx(4.0)
                }
            };
            let poses = vec![
                p(20.0, [-30.0, 100.0], [30.0, 110.0], [40.0, 60.0], [-30.0, 40.0]).face("shout"),
                a(true),
                a(false),
                a(true),
                a(false),
                a(true),
                a(false),
                if kicks {
                    p(-14.0, [60.0, 80.0], [-30.0, 90.0], [110.0, 0.0], [-20.0, 60.0]).face("shout").dx(4.0)
                } else {
                    p(-8.0, [165.0, 10.0], [20.0, 100.0], [24.0, 6.0], [-30.0, 20.0]).face("shout").dx(4.0)
                },
                p(6.0, [50.0, 80.0], [20.0, 100.0], [20.0, 10.0], [-16.0, 14.0]),
            ];
            let inj = if sp.injury > 0.0 { sp.injury } else { 10.0 };
            let small = |at: &'static str| {
                hit_at(
                    at,
                    34.0,
                    22.0,
                    -2.0,
                    0.0,
                    Itr { kind: 0, injury: Some((inj * 0.45).round()), dvx: Some(3.0), fall: Some(5.0), vrest: Some(3), bdefend: Some(12.0), ..Default::default() },
                )
            };
            let last = hit_at(
                if kicks { "tf" } else { "hf" },
                36.0,
                30.0,
                0.0,
                0.0,
                Itr { kind: 0, injury: Some((inj * 2.5).round()), dvx: Some(10.0), dvy: Some(-8.0), fall: Some(70.0), vrest: Some(15), bdefend: Some(60.0), ..Default::default() },
            );
            let list = poses
                .into_iter()
                .enumerate()
                .map(|(i, pz)| {
                    fs("rush", 3, pz)
                        .wait(if i == 0 {
                            2
                        } else if i == 8 {
                            4
                        } else {
                            1
                        })
                        .mp_opt(if i == 0 { Some(sp.mp) } else { None })
                        .dvx_opt(if i == 0 {
                            Some(12.0)
                        } else if i < 7 {
                            Some(5.0)
                        } else {
                            None
                        })
                        .sound_opt(if i % 2 == 1 { Some("swing") } else { None })
                        .itr_opt(if (1..=6).contains(&i) {
                            Some(small(if kicks {
                                if i % 2 == 1 {
                                    "tf"
                                } else {
                                    "tb"
                                }
                            } else if i % 2 == 1 {
                                "hf"
                            } else {
                                "hb"
                            }))
                        } else if i == 7 {
                            Some(last.clone())
                        } else {
                            None
                        })
                })
                .collect();
            b.chain(n, list, None);
        }
        // investida de ombro
        SpecialType::Charge => {
            let pp =
                |k: bool| p(36.0, [60.0, 90.0], [-40.0, 60.0], if k { [60.0, 50.0] } else { [-30.0, 30.0] }, if k { [-30.0, 30.0] } else { [60.0, 50.0] }).dx(4.0).face("shout");
            let poses = vec![
                p(20.0, [40.0, 110.0], [-20.0, 80.0], [40.0, 60.0], [-30.0, 40.0]),
                pp(true),
                pp(false),
                pp(true),
                pp(false),
                p(10.0, [40.0, 90.0], [10.0, 100.0], [30.0, 20.0], [-20.0, 20.0]),
            ];
            let hitbox = hit_at(
                "shoulder",
                30.0,
                50.0,
                8.0,
                10.0,
                Itr {
                    kind: 0,
                    injury: Some(if sp.injury > 0.0 { sp.injury } else { 50.0 }),
                    dvx: Some(14.0),
                    dvy: Some(-6.0),
                    fall: Some(70.0),
                    vrest: Some(15),
                    bdefend: Some(70.0),
                    ..Default::default()
                },
            );
            let list = poses
                .into_iter()
                .enumerate()
                .map(|(i, pz)| {
                    fs("charge", 3, pz)
                        .wait(if i == 0 {
                            3
                        } else if i == 5 {
                            4
                        } else {
                            2
                        })
                        .mp_opt(if i == 0 { Some(sp.mp) } else { None })
                        .dvx_opt(if (1..=4).contains(&i) { Some(15.0) } else { None })
                        .sound_opt(if i == 1 {
                            Some("swing")
                        } else if i == 3 {
                            Some("step")
                        } else {
                            None
                        })
                        .itr_opt(if (1..=4).contains(&i) { Some(hitbox.clone()) } else { None })
                })
                .collect();
            b.chain(n, list, None);
        }
        // pula e soca o chão: ondas de choque para os dois lados
        SpecialType::Slam => {
            let inj = if sp.injury > 0.0 { sp.injury } else { 40.0 };
            let wave = b.make_ball(BallSpec {
                id: 0,
                color: sp.color.into(),
                style: "wave".into(),
                effect: sp.effect,
                injury: (inj * 0.7).round(),
                fall: 70.0,
                speed: 9.0,
                chase: false,
                multi: false,
                broken: false,
                ground: true,
            });
            let poses = [
                p(20.0, [150.0, 30.0], [140.0, 30.0], [55.0, 95.0], [-20.0, 70.0]),
                p(0.0, [170.0, 10.0], [165.0, 10.0], [40.0, 60.0], [-10.0, 50.0]).face("shout"),
                p(30.0, [120.0, 10.0], [110.0, 10.0], [60.0, 80.0], [0.0, 70.0]),
                p(50.0, [20.0, 10.0], [10.0, 10.0], [60.0, 100.0], [-20.0, 80.0]).face("shout"),
                p(40.0, [10.0, 20.0], [0.0, 20.0], [60.0, 100.0], [-20.0, 80.0]),
                p(10.0, [40.0, 80.0], [20.0, 90.0], [30.0, 30.0], [-20.0, 30.0]),
            ];
            let ground = itr_xy(Itr {
                kind: 0,
                x: OX - 30.0,
                y: BASE - 30.0,
                w: 140.0,
                h: 30.0,
                injury: Some((inj * 0.6).round()),
                dvx: Some(6.0),
                dvy: Some(-9.0),
                fall: Some(70.0),
                vrest: Some(15),
                bdefend: Some(60.0),
                effect: Some(sp.effect),
                ..Default::default()
            });
            let list = poses
                .iter()
                .enumerate()
                .map(|(i, pz)| {
                    let mut f = fs("slam", 3, pz.clone())
                        .wait([2, 3, 30, 2, 4, 3][i])
                        .mp_opt(if i == 0 { Some(sp.mp) } else { None })
                        .dvy_opt(if i == 1 {
                            Some(-10.0)
                        } else if i == 2 {
                            Some(3.0)
                        } else {
                            None
                        })
                        .dvx_opt(if i == 1 { Some(3.0) } else { None })
                        .sound_opt(if i == 3 {
                            Some("slam")
                        } else if i == 1 {
                            Some("jump")
                        } else {
                            None
                        })
                        .itr_opt(if i == 3 { Some(ground.clone()) } else { None });
                    if i == 2 {
                        f = f.next(n + 2).land(n + 3);
                    }
                    if i == 3 {
                        f = f.ops(vec![
                            OPoint { kind: 1, x: OX + 70.0, y: BASE - 5.0, action: 0, dvx: 0.0, dvy: 0.0, oid: wave, facing: 0, dvz: None },
                            OPoint { kind: 1, x: OX + 10.0, y: BASE - 5.0, action: 0, dvx: 0.0, dvy: 0.0, oid: wave, facing: 1, dvz: None },
                        ]);
                    }
                    f
                })
                .collect();
            b.chain(n, list, None);
        }
        // some e reaparece atrás do inimigo mais próximo com um chute
        SpecialType::Teleport => {
            b.f(n, fs("vanish", 15, p(10.0, [150.0, 30.0], [140.0, 30.0], [30.0, 60.0], [-20.0, 50.0]).open()).wait(3).next(n + 1).mp(sp.mp).sound("teleport"));
            b.f(n + 1, fs("vanish", 400, po.crouch.clone()).wait(2).next(n + 2).no_bdy());
            let k = hit_at(
                "tf",
                36.0,
                22.0,
                -6.0,
                0.0,
                Itr {
                    kind: 0,
                    injury: Some(if sp.injury > 0.0 { sp.injury } else { 40.0 }),
                    dvx: Some(10.0),
                    dvy: Some(-6.0),
                    fall: Some(70.0),
                    vrest: Some(15),
                    bdefend: Some(50.0),
                    ..Default::default()
                },
            );
            let list = [&atk.jump_kick[2], &atk.jump_kick[3], &atk.jump_kick[4], &atk.jump_kick[5]]
                .iter()
                .enumerate()
                .map(|(i, pz)| {
                    fs("ghost_kick", 3, (*pz).clone())
                        .wait([1, 2, 3, 3][i])
                        .dvx_opt(if i < 2 { Some(10.0) } else { None })
                        .sound_opt(if i == 1 { Some("swing") } else { None })
                        .itr_opt(if i == 1 || i == 2 { Some(k.clone()) } else { None })
                })
                .collect();
            b.chain(n + 2, list, None);
        }
        // cura: medita e recupera vida
        SpecialType::Heal => {
            let glow = sp.color;
            let pp = |k: f64| Pose { glow: Some(glow), ..p(0.0, [100.0, 70.0 + k * 6.0], [95.0, 75.0 + k * 6.0], [30.0, 60.0], [-30.0, 60.0]).open() };
            b.f(n, fs("heal", 15, pp(0.0)).wait(3).next(n + 1).mp(sp.mp).sound("heal"));
            b.f(n + 1, fs("heal", 1700, pp(1.0)).wait(10).next(n + 2));
            b.f(n + 2, fs("heal", 15, pp(2.0)).wait(10).next(999));
        }
        // giro com chutes para os dois lados
        SpecialType::Spin => {
            let turn = |k: i32| p(-6.0, [100.0, 40.0], [80.0, 40.0], if k % 2 == 1 { [-95.0, 0.0] } else { [95.0, 0.0] }, [-10.0, 50.0]).face("shout");
            let around = itr_xy(Itr {
                kind: 0,
                x: OX - 20.0,
                y: BASE - 60.0,
                w: 120.0,
                h: 40.0,
                injury: Some(if sp.injury > 0.0 { sp.injury } else { 26.0 }),
                dvx: Some(8.0),
                dvy: Some(-7.0),
                fall: Some(50.0),
                vrest: Some(6),
                bdefend: Some(30.0),
                effect: Some(sp.effect),
                ..Default::default()
            });
            let poses = vec![po.crouch.clone(), turn(0), turn(1), turn(0), turn(1), turn(0), po.crouch.clone()];
            let list = poses
                .into_iter()
                .enumerate()
                .map(|(i, pz)| {
                    fs("spin", 3, pz)
                        .wait(if i == 0 {
                            2
                        } else if i == 6 {
                            3
                        } else {
                            2
                        })
                        .mp_opt(if i == 0 { Some(sp.mp) } else { None })
                        .dvy_opt(if i == 1 { Some(-6.0) } else { None })
                        .dvx_opt(if (1..=5).contains(&i) { Some(3.0) } else { None })
                        .sound_opt(if i % 2 == 1 { Some("swing") } else { None })
                        .itr_opt(if (1..=5).contains(&i) { Some(around.clone()) } else { None })
                })
                .collect();
            b.chain(n, list, None);
        }
        // explosão de gelo em volta (congela)
        SpecialType::Frost => {
            let ring = itr_xy(Itr {
                kind: 0,
                x: OX - 24.0,
                y: BASE - 50.0,
                w: 128.0,
                h: 50.0,
                injury: Some(if sp.injury > 0.0 { sp.injury } else { 30.0 }),
                dvx: Some(4.0),
                dvy: Some(-4.0),
                fall: Some(40.0),
                vrest: Some(20),
                bdefend: Some(40.0),
                effect: Some(30),
                ..Default::default()
            });
            let poses = [
                p(10.0, [150.0, 30.0], [140.0, 30.0], [30.0, 30.0], [-20.0, 30.0]),
                Pose { frost: 1, ..p(40.0, [20.0, 10.0], [10.0, 10.0], [60.0, 100.0], [-20.0, 80.0]).face("shout").open() },
                Pose { frost: 2, ..p(40.0, [20.0, 10.0], [10.0, 10.0], [60.0, 100.0], [-20.0, 80.0]).open() },
                p(20.0, [60.0, 60.0], [40.0, 60.0], [40.0, 60.0], [-20.0, 40.0]),
            ];
            let list = poses
                .iter()
                .enumerate()
                .map(|(i, pz)| {
                    fs("frost", 3, pz.clone())
                        .wait([3, 2, 4, 4][i])
                        .mp_opt(if i == 0 { Some(sp.mp) } else { None })
                        .sound_opt(if i == 1 { Some("freeze") } else { None })
                        .itr_opt(if i == 1 || i == 2 { Some(ring.clone()) } else { None })
                })
                .collect();
            b.chain(n, list, None);
        }
    }
    b.specials.push((sp.tag, n));
}
