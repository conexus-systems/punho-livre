//! Desenho por código: lutadores (esqueleto em pose + roupa e cabelo), retratos,
//! armas, ataques especiais e efeitos. Tudo o que aparece no jogo sai daqui.

use std::collections::HashMap;

use crate::content::roster::{Emblem, Look};
use crate::gfx::*;

pub struct Body;
impl Body {
    pub const T: f64 = 19.0;
    pub const UA: f64 = 10.0;
    pub const LA: f64 = 10.0;
    pub const TH: f64 = 12.0;
    pub const SH: f64 = 12.0;
    pub const HEAD: f64 = 9.0;
    pub const FOOT: f64 = 6.0;
}
pub const INK: &str = "#1d1428";
pub const FIGHTER_SCALE: f64 = 1.14; // tamanho dos lutadores em relação ao esqueleto base

/// Pose: inclinação, braços (ombro, cotovelo), pernas (quadril, joelho), rotação, deslocamento,
/// expressão. af/lf são o braço e a perna da frente (mais perto de quem olha); ab/lb os de trás.
#[derive(Clone, Debug, PartialEq)]
pub struct Pose {
    pub lean: f64,
    pub af: [f64; 2],
    pub ab: [f64; 2],
    pub lf: [f64; 2],
    pub lb: [f64; 2],
    pub rot: f64,
    pub dx: f64,
    pub dy: f64,
    pub head: f64,
    pub face: &'static str,
    pub open: bool,
    pub glow: Option<&'static str>,
    pub frost: i32,
    pub fire: Option<i32>,
    pub ice: bool,
}

pub fn p(lean: f64, af: [f64; 2], ab: [f64; 2], lf: [f64; 2], lb: [f64; 2]) -> Pose {
    Pose { lean, af, ab, lf, lb, rot: 0.0, dx: 0.0, dy: 0.0, head: 0.0, face: "", open: false, glow: None, frost: 0, fire: None, ice: false }
}

impl Pose {
    pub fn key(&self) -> String {
        format!("{:?}", self)
    }
    pub fn face(mut self, f: &'static str) -> Pose {
        self.face = f;
        self
    }
    pub fn dx(mut self, v: f64) -> Pose {
        self.dx = v;
        self
    }
    pub fn dy(mut self, v: f64) -> Pose {
        self.dy = v;
        self
    }
    pub fn rot(mut self, v: f64) -> Pose {
        self.rot = v;
        self
    }
    pub fn head(mut self, v: f64) -> Pose {
        self.head = v;
        self
    }
    pub fn open(mut self) -> Pose {
        self.open = true;
        self
    }
    pub fn lf(mut self, v: [f64; 2]) -> Pose {
        self.lf = v;
        self
    }
    pub fn lb(mut self, v: [f64; 2]) -> Pose {
        self.lb = v;
        self
    }
}

/// juntas de uma pose já resolvida
#[derive(Clone, Debug, Default)]
pub struct Joints {
    pub pts: HashMap<&'static str, P>,
    pub faf: f64,
    pub fab: f64,
}

impl Joints {
    pub fn get(&self, k: &str) -> P {
        *self.pts.get(k).unwrap_or(&[0.0, 0.0])
    }
    fn set(&mut self, k: &'static str, v: P) {
        self.pts.insert(k, v);
    }
    pub fn translate(&mut self, ox: f64, oy: f64) {
        for v in self.pts.values_mut() {
            *v = [v[0] + ox, v[1] + oy];
        }
    }
}

pub fn solve_pose(p: &Pose, scale: f64) -> Joints {
    let s = scale;
    let mut j = Joints::default();
    let lean = p.lean;
    let up = 180.0 - lean;
    j.set("pelvis", [0.0, 0.0]);
    let pelvis = [0.0, 0.0];
    j.set("neck", along(pelvis, up, Body::T * s));
    j.set("chest", along(pelvis, up, Body::T * 0.65 * s));
    j.set("shoulder", along(pelvis, up, Body::T * 0.9 * s));
    let hu = up + p.head;
    let head = along(j.get("neck"), hu, (Body::HEAD + 1.5) * s);
    j.set("head", head);
    j.set("headUp", along(head, hu, 1.0));
    let shoulder = j.get("shoulder");
    let mut arm = |ek: &'static str, hk: &'static str, a: [f64; 2]| -> f64 {
        let ua = a[0] - lean;
        let fa = ua + a[1];
        let e = along(shoulder, ua, Body::UA * s);
        j.set(ek, e);
        j.set(hk, along(e, fa, Body::LA * s));
        fa
    };
    let faf = arm("ef", "hf", p.af);
    let fab = arm("eb", "hb", p.ab);
    j.faf = faf;
    j.fab = fab;
    let mut leg = |kk: &'static str, ak: &'static str, tk: &'static str, heelk: &'static str, a: [f64; 2]| {
        let th = a[0];
        let sh = th - a[1];
        let k = along(pelvis, th, Body::TH * s);
        let an = along(k, sh, Body::SH * s);
        j.set(kk, k);
        j.set(ak, an);
        j.set(tk, along(an, sh + 90.0, Body::FOOT * s));
        j.set(heelk, along(an, sh - 90.0, 1.5 * s));
    };
    leg("kf", "af", "tf", "heelf", p.lf);
    leg("kb", "ab", "tb", "heelb", p.lb);
    // rotação do corpo inteiro (em torno do quadril), positiva para a frente
    if p.rot != 0.0 {
        let r = rad(p.rot);
        let (c, sn) = (r.cos(), r.sin());
        for v in j.pts.values_mut() {
            let [x, y] = *v;
            *v = [x * c - y * sn, x * sn + y * c];
        }
        j.faf -= p.rot;
        j.fab -= p.rot;
    }
    j
}

/// encaixa a pose na célula: quadril em x = cx + dx e o ponto mais baixo em y = base + dy
pub fn place_pose(p: &Pose, scale: f64, cx: f64, base: f64) -> Joints {
    let mut j = solve_pose(p, scale);
    let mut max_y = f64::NEG_INFINITY;
    for (k, v) in &j.pts {
        if *k == "headUp" {
            continue;
        }
        let mut y = v[1];
        if *k == "head" {
            y += Body::HEAD * scale;
        }
        if k.starts_with('h') && k.len() == 2 {
            y += 3.0 * scale;
        }
        max_y = max_y.max(y);
    }
    let ox = cx + p.dx;
    let oy = base - max_y + p.dy;
    j.translate(ox, oy);
    j
}

// luz vem de cima, um pouco da esquerda
const LIGHT: P = [-0.5, -0.85];

/// membro cônico com contorno, brilho do lado da luz e sombra do lado oposto
pub fn limb(ctx: &Ctx, a: P, b: P, w1: f64, w2: f64, hex: &str, back: bool) {
    let dx = b[0] - a[0];
    let dy = b[1] - a[1];
    let len = hypot(dx, dy).max(f64::MIN_POSITIVE);
    let len = if len == f64::MIN_POSITIVE { 1.0 } else { len };
    let mut nx = -dy / len;
    let mut ny = dx / len;
    if nx * LIGHT[0] + ny * LIGHT[1] < 0.0 {
        nx = -nx;
        ny = -ny;
    }
    let base = if back { shade(hex, 0.74) } else { hex.to_string() };
    let tau = std::f64::consts::TAU;
    let path = || {
        ctx.begin();
        ctx.move_to(a[0] + nx * w1 / 2.0, a[1] + ny * w1 / 2.0);
        ctx.line_to(b[0] + nx * w2 / 2.0, b[1] + ny * w2 / 2.0);
        ctx.line_to(b[0] - nx * w2 / 2.0, b[1] - ny * w2 / 2.0);
        ctx.line_to(a[0] - nx * w1 / 2.0, a[1] - ny * w1 / 2.0);
        ctx.close();
        ctx.move_to(a[0] + w1 / 2.0, a[1]);
        ctx.arc(a[0], a[1], w1 / 2.0, 0.0, tau);
        ctx.move_to(b[0] + w2 / 2.0, b[1]);
        ctx.arc(b[0], b[1], w2 / 2.0, 0.0, tau);
    };
    ctx.line_join("round");
    path();
    ctx.stroke_style(INK);
    ctx.line_width(2.6);
    ctx.stroke();
    // o preenchimento é feito em partes: sentidos opostos dos subcaminhos abririam buracos
    ctx.fill_style(&base);
    ctx.begin();
    ctx.move_to(a[0] + nx * w1 / 2.0, a[1] + ny * w1 / 2.0);
    ctx.line_to(b[0] + nx * w2 / 2.0, b[1] + ny * w2 / 2.0);
    ctx.line_to(b[0] - nx * w2 / 2.0, b[1] - ny * w2 / 2.0);
    ctx.line_to(a[0] - nx * w1 / 2.0, a[1] - ny * w1 / 2.0);
    ctx.close();
    ctx.fill();
    ctx.begin();
    ctx.arc(a[0], a[1], w1 / 2.0, 0.0, tau);
    ctx.fill();
    ctx.begin();
    ctx.arc(b[0], b[1], w2 / 2.0, 0.0, tau);
    ctx.fill();
    ctx.line_cap("round");
    let edge = |k: f64, w: f64, col: &str, alpha: f64| {
        ctx.alpha(alpha);
        ctx.stroke_style(col);
        ctx.line_width(w.max(0.8));
        ctx.begin();
        ctx.move_to(a[0] + nx * k * w1, a[1] + ny * k * w1);
        ctx.line_to(b[0] + nx * k * w2, b[1] + ny * k * w2);
        ctx.stroke();
        ctx.alpha(1.0);
    };
    edge(0.22, w1.min(w2) * 0.2, &shade(hex, if back { 1.1 } else { 1.4 }), 0.55);
    edge(-0.26, w1.min(w2) * 0.26, &shade(hex, 0.5), 0.35);
}

pub fn capsule(ctx: &Ctx, a: P, b: P, w: f64, fill: &str) {
    ctx.line_cap("round");
    ctx.stroke_style(INK);
    ctx.line_width(w + 2.4);
    ctx.line(a[0], a[1], b[0], b[1]);
    ctx.stroke_style(fill);
    ctx.line_width(w);
    ctx.line(a[0], a[1], b[0], b[1]);
}

pub fn blob(ctx: &Ctx, pts: &[P], fill: &str, line: f64) {
    ctx.poly(pts);
    ctx.line_join("round");
    ctx.stroke_style(INK);
    ctx.line_width(line * 2.0);
    ctx.stroke();
    ctx.fill_style(fill);
    ctx.fill();
}

pub fn blob_grad(ctx: &Ctx, pts: &[P], fill: &web_sys::CanvasGradient, line: f64) {
    ctx.poly(pts);
    ctx.line_join("round");
    ctx.stroke_style(INK);
    ctx.line_width(line * 2.0);
    ctx.stroke();
    ctx.fill_grad(fill);
    ctx.fill();
}

pub fn disc(ctx: &Ctx, c: P, r: f64, fill: &str) {
    ctx.circle(c[0], c[1], r);
    ctx.fill_style(INK);
    ctx.fill();
    ctx.circle(c[0], c[1], (r - 1.2).max(0.5));
    ctx.fill_style(fill);
    ctx.fill();
}

/// esfera com luz: cabeça, mãos
pub fn ball(ctx: &Ctx, c: P, r: f64, hex: &str, back: bool) {
    ctx.circle(c[0], c[1], r);
    ctx.fill_style(INK);
    ctx.fill();
    let mid = if back { shade(hex, 0.74) } else { hex.to_string() };
    let g = ctx.radial(
        c[0] - r * 0.35,
        c[1] - r * 0.4,
        r * 0.1,
        c[0],
        c[1],
        r,
        &[(0.0, &shade(hex, if back { 1.1 } else { 1.28 })), (0.55, &mid), (1.0, &shade(hex, if back { 0.55 } else { 0.78 }))],
    );
    ctx.circle(c[0], c[1], (r - 1.2).max(0.5));
    ctx.fill_grad(&g);
    ctx.fill();
}

/// símbolo no peito, no sistema de coordenadas do tronco (x para a frente, y para cima)
fn draw_emblem(ctx: &Ctx, e: &Emblem, at: P, ang: f64, size: f64) {
    ctx.save();
    ctx.translate(at[0], at[1]);
    ctx.rotate(ang);
    ctx.fill_style(e.color);
    ctx.stroke_style(e.color);
    ctx.line_width((size * 0.14).max(1.0));
    ctx.line_cap("round");
    ctx.line_join("round");
    let r = size;
    let pi = std::f64::consts::PI;
    match e.kind {
        "flame" => {
            ctx.begin();
            ctx.move_to(0.0, -r);
            ctx.quad_to(r * 0.9, -r * 0.1, r * 0.4, r * 0.7);
            ctx.quad_to(0.0, r * 1.1, -r * 0.5, r * 0.6);
            ctx.quad_to(-r * 0.9, 0.0, -r * 0.2, -r * 0.3);
            ctx.quad_to(-r * 0.2, -r * 0.7, 0.0, -r);
            ctx.fill();
        }
        "snow" => {
            for k in 0..3 {
                let a = k as f64 * pi / 3.0;
                ctx.line(a.cos() * r, a.sin() * r, -a.cos() * r, -a.sin() * r);
            }
        }
        "bolt" => {
            ctx.poly(&[[r * 0.3, -r], [-r * 0.5, r * 0.1], [r * 0.05, r * 0.1], [-r * 0.3, r], [r * 0.6, -r * 0.2], [0.0, -r * 0.2]]);
            ctx.fill();
        }
        "star" => {
            let mut pts = vec![];
            for k in 0..10 {
                let rr = if k % 2 == 1 { r * 0.45 } else { r };
                let a = k as f64 * pi / 5.0 - pi / 2.0;
                pts.push([a.cos() * rr, a.sin() * rr]);
            }
            ctx.poly(&pts);
            ctx.fill();
        }
        "moon" => {
            ctx.circle(0.0, 0.0, r);
            ctx.fill();
            ctx.composite("destination-out");
            ctx.circle(r * 0.45, -r * 0.2, r * 0.85);
            ctx.fill();
        }
        "ring" => {
            ctx.circle(0.0, 0.0, r * 0.8);
            ctx.stroke();
            ctx.circle(0.0, 0.0, r * 0.25);
            ctx.fill();
        }
        _ => {}
    }
    ctx.restore();
}

/// Desenha um lutador numa pose já posicionada (J de place_pose).
pub fn draw_body(ctx: &Ctx, j: &Joints, look: &Look, p: &Pose, s: f64) {
    let w = look.build;
    let skin = look.skin;
    let sleeve_up = if look.sleeves == "none" { skin } else { look.shirt };
    let sleeve_low = if look.sleeves == "long" { look.shirt } else { skin };
    let shin_color = if look.shorts { skin } else { look.pants };
    let hand_color = look.gloves.unwrap_or(skin);

    let draw_leg = |k: &str, back: bool| {
        let kk = j.get(&format!("k{}", k));
        let ak = j.get(&format!("a{}", k));
        let tk = j.get(&format!("t{}", k));
        let heel = j.get(&format!("heel{}", k));
        limb(ctx, j.get("pelvis"), kk, 10.0 * w * s, 8.0 * w * s, look.pants, back);
        limb(ctx, kk, ak, 8.0 * w * s, 6.0 * w * s, shin_color, back);
        if look.shorts {
            limb(ctx, along(ak, 0.0, -3.0 * s), ak, 6.4 * s, 6.0 * s, look.socks.unwrap_or("#f2f2f2"), back);
        }
        // pé: sapato com sola clara
        limb(ctx, heel, tk, 6.0 * s, 5.0 * s, look.shoes, back);
        ctx.alpha(if back { 0.6 } else { 0.85 });
        capsule(ctx, [heel[0] - 0.5 * s, heel[1] + 2.4 * s], [tk[0], tk[1] + 2.2 * s], 1.5 * s, "#efeae0");
        ctx.alpha(1.0);
    };
    let draw_arm = |k: &str, back: bool| {
        let e = j.get(&format!("e{}", k));
        let h = j.get(&format!("h{}", k));
        let fa = if k == "f" { j.faf } else { j.fab };
        limb(ctx, j.get("shoulder"), e, 7.4 * w * s, 6.2 * w * s, sleeve_up, back);
        limb(ctx, e, h, 6.2 * w * s, 5.0 * w * s, sleeve_low, back);
        if let Some(wr) = look.wrist {
            limb(ctx, along(h, fa + 180.0, 3.4 * s), h, 6.0 * s, 5.4 * s, wr, back);
        }
        ball(ctx, h, (if p.open { 3.4 } else { 4.3 }) * w.sqrt() * s, hand_color, back);
    };

    let head = j.get("head");
    let hu = sub(j.get("headUp"), head);
    let fw = [-hu[1], hu[0]];
    let hh = |lx: f64, ly: f64| -> P { [head[0] + fw[0] * lx * s + hu[0] * ly * s, head[1] + fw[1] * lx * s + hu[1] * ly * s] };

    // cachecol: as pontas esvoaçam para trás
    if let Some(sc) = look.scarf {
        let n = j.get("neck");
        let wob = p.lean.sin() * 2.0;
        let t1 = [n[0] - fw[0] * 9.0 * s, n[1] - fw[1] * 9.0 * s + 3.0 * s + wob];
        let t2 = [t1[0] - fw[0] * 8.0 * s, t1[1] + 3.0 * s];
        limb(ctx, n, t1, 4.4 * s, 3.4 * s, sc, true);
        limb(ctx, t1, t2, 3.4 * s, 2.0 * s, sc, true);
    }

    draw_arm("b", true);
    draw_leg("b", true);

    // tronco: quadril, cintura, peito e ombros
    let pelvis = j.get("pelvis");
    let ax = sub(j.get("neck"), pelvis);
    let len = hypot(ax[0], ax[1]);
    let len = if len == 0.0 { 1.0 } else { len };
    let n = [-ax[1] / len, ax[0] / len];
    let hw = 6.6 * w * s;
    let sw = 8.8 * w * s;
    let at = |t: f64, k: f64| -> P { [pelvis[0] + ax[0] * t + n[0] * k, pelvis[1] + ax[1] * t + n[1] * k] };
    let tp = [at(0.0, hw), at(0.42, hw * 0.9), at(0.8, sw), at(1.0, sw * 0.62), at(1.0, -sw * 0.62), at(0.8, -sw), at(0.42, -hw * 0.9), at(0.0, -hw)];
    let g0 = at(0.5, hw * 1.1);
    let g1 = at(0.5, -hw * 1.1);
    let light_front = n[0] * LIGHT[0] + n[1] * LIGHT[1] > 0.0;
    let grad = ctx.linear(
        g0[0],
        g0[1],
        g1[0],
        g1[1],
        &[(0.0, &shade(look.shirt, if light_front { 1.25 } else { 0.72 })), (0.5, look.shirt), (1.0, &shade(look.shirt, if light_front { 0.72 } else { 1.25 }))],
    );
    blob_grad(ctx, &tp, &grad, 1.3);
    // gola e barra da camisa
    ctx.alpha(0.9);
    let collar = if sleeve_up == skin && look.vest.is_none() { skin.to_string() } else { shade(look.shirt, 0.6) };
    blob(ctx, &[at(1.0, sw * 0.4), at(0.74, 0.0), at(1.0, -sw * 0.4)], &collar, 0.5);
    ctx.alpha(1.0);
    if let Some(v) = look.vest {
        let m = |a: P, b: P, t: f64| -> P { [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] };
        blob(ctx, &[m(tp[0], tp[7], 0.38), m(tp[0], tp[7], 0.62), m(tp[3], tp[4], 0.64), m(tp[3], tp[4], 0.36)], v, 0.6);
    }
    if let Some(e) = &look.emblem {
        let c = at(0.62, hw * 0.35 * 0.6);
        draw_emblem(ctx, e, c, ax[1].atan2(ax[0]) + std::f64::consts::FRAC_PI_2, 2.8 * w * s);
    }
    if let Some(b) = look.belt {
        capsule(ctx, at(0.06, hw * 1.02), at(0.06, -hw * 1.02), 2.8 * s, b);
        ctx.alpha(0.9);
        capsule(ctx, at(0.06, hw * 0.1 + 0.5 * s), at(0.06, hw * 0.1 + 0.6 * s), 3.2 * s, "#ffd54a");
        ctx.alpha(1.0);
    }
    draw_leg("f", false);

    // cabeça
    let r = (Body::HEAD + 0.6) * s;
    ball(ctx, head, r, skin, false);
    ball(ctx, hh(-1.6, -0.6), 2.3 * s, skin, true);
    draw_hair(ctx, &hh, look, s);
    draw_face(ctx, &hh, look, p.face, s);
    if let Some(sc) = look.scarf {
        let nk = j.get("neck");
        limb(ctx, nk, along(nk, 180.0 - p.lean, 1.5 * s), 7.0 * s, 7.0 * s, sc, false);
    }

    draw_arm("f", false);
}

fn draw_hair(ctx: &Ctx, h: &dyn Fn(f64, f64) -> P, look: &Look, s: f64) {
    let c = look.hair;
    let poly = |pts: &[[f64; 2]], col: &str| {
        let v: Vec<P> = pts.iter().map(|q| h(q[0] * 1.12, q[1] * 1.12)).collect();
        blob(ctx, &v, col, 1.1);
    };
    let shine = |a: [f64; 2], ctl: [f64; 2], b: [f64; 2], col: &str| {
        ctx.save();
        ctx.alpha(0.55);
        ctx.stroke_style(col);
        ctx.line_width(1.5 * s);
        ctx.line_cap("round");
        ctx.begin();
        let pa = h(a[0] * 1.12, a[1] * 1.12);
        let pc = h(ctl[0] * 1.12, ctl[1] * 1.12);
        let pb = h(b[0] * 1.12, b[1] * 1.12);
        ctx.move_to(pa[0], pa[1]);
        ctx.quad_to(pc[0], pc[1], pb[0], pb[1]);
        ctx.stroke();
        ctx.restore();
    };
    let bright = shade(c, 1.7);
    match look.hair_style {
        "spiky" => {
            poly(
                &[
                    [6.0, 5.0],
                    [4.0, 12.0],
                    [1.0, 8.0],
                    [-2.0, 14.0],
                    [-4.0, 8.0],
                    [-9.0, 12.0],
                    [-8.0, 5.0],
                    [-13.0, 4.0],
                    [-9.0, 0.0],
                    [-10.0, -4.0],
                    [-7.0, -2.0],
                    [-5.0, 3.0],
                    [0.0, 5.0],
                    [4.0, 3.0],
                ],
                c,
            );
            shine([-5.0, 7.0], [-1.0, 10.0], [3.0, 7.0], &bright);
        }
        "short" => {
            poly(&[[7.0, 3.0], [6.0, 7.0], [2.0, 9.6], [-3.0, 9.4], [-7.5, 6.5], [-9.4, 1.5], [-8.8, -3.0], [-6.5, -2.0], [-5.0, 3.0], [0.0, 5.0], [5.0, 5.2]], c);
            shine([-5.0, 7.5], [-1.0, 9.5], [3.0, 8.0], &bright);
        }
        "flat" => {
            poly(&[[7.5, 4.0], [7.5, 9.0], [-8.5, 9.0], [-9.5, 0.0], [-8.5, -3.0], [-6.0, 2.0], [0.0, 5.5]], c);
            shine([-5.0, 7.5], [-1.0, 8.5], [4.0, 8.0], &bright);
        }
        "long" => {
            poly(
                &[[7.0, 3.0], [6.0, 8.0], [1.0, 10.0], [-5.0, 9.0], [-9.0, 5.0], [-11.0, -3.0], [-10.0, -11.0], [-6.0, -12.0], [-5.0, -4.0], [-4.0, 2.0], [0.0, 5.0], [5.0, 5.0]],
                c,
            );
            shine([-5.0, 8.0], [-1.0, 10.0], [4.0, 8.0], &bright);
            shine([-9.0, -2.0], [-9.5, -6.0], [-8.0, -9.0], &bright);
        }
        "bun" => {
            poly(&[[7.0, 3.0], [5.5, 8.0], [0.0, 9.8], [-6.0, 8.0], [-9.0, 3.0], [-8.5, -2.0], [-6.0, 2.0], [0.0, 5.0], [5.0, 5.0]], c);
            ball(ctx, h(-7.0, 9.0), 3.8 * s, c, false);
        }
        "ponytail" => {
            poly(&[[7.0, 3.0], [6.0, 8.0], [1.0, 10.0], [-5.0, 9.0], [-9.0, 5.0], [-9.0, 0.0], [-6.0, 2.0], [0.0, 5.0], [5.0, 5.0]], c);
            poly(&[[-7.0, 7.0], [-14.0, 5.0], [-17.0, -2.0], [-15.0, -9.0], [-12.0, -3.0], [-9.0, 2.0]], c);
            shine([-4.0, 8.0], [0.0, 9.5], [4.0, 7.5], &bright);
        }
        "mohawk" => {
            poly(&[[5.0, 7.0], [3.0, 13.0], [-1.0, 12.0], [-5.0, 13.0], [-8.0, 9.0], [-9.0, 4.0], [-6.0, 7.0], [0.0, 8.0]], c);
            shine([-6.0, 10.0], [-2.0, 12.0], [2.0, 11.0], &bright);
        }
        "hood" => {
            poly(&[[7.5, 2.0], [7.0, 8.0], [1.0, 11.0], [-6.0, 10.0], [-10.0, 4.0], [-11.0, -6.0], [-7.0, -9.0], [-5.0, -3.0], [-3.0, 2.0], [3.0, 3.5]], c);
            shine([-6.0, 9.0], [-1.0, 10.5], [4.0, 8.5], "#7a7a94");
        }
        "bandana" => {
            poly(&[[7.5, 2.5], [6.5, 7.5], [1.0, 9.8], [-5.0, 9.0], [-8.5, 5.0], [-9.0, 1.0], [-3.0, 2.5], [3.0, 3.0]], look.accent);
            poly(&[[-8.0, 3.0], [-15.0, 1.0], [-16.0, -4.0], [-10.0, -1.0]], look.accent);
            shine([-5.0, 7.5], [-1.0, 9.0], [3.0, 8.0], &shade(look.accent, 1.6));
        }
        _ => {} // careca
    }
    if let Some(hb) = look.headband {
        capsule(ctx, h(7.8, 3.2), h(-8.6, 3.6), 2.8 * s, hb);
        capsule(ctx, h(-8.6, 3.6), h(-15.0, 1.0), 2.2 * s, hb);
        capsule(ctx, h(-8.6, 3.6), h(-14.0, -2.5), 2.2 * s, hb);
    }
}

fn draw_face(ctx: &Ctx, h: &dyn Fn(f64, f64) -> P, look: &Look, face: &str, s: f64) {
    ctx.line_cap("round");
    ctx.stroke_style(INK);
    ctx.fill_style(INK);
    let k = 1.12;
    let q = |x: f64, y: f64| -> P { h(x * k, y * k) };
    let line = |a: [f64; 2], b: [f64; 2], w: f64| {
        ctx.line_width(w * s);
        let pa = q(a[0], a[1]);
        let pb = q(b[0], b[1]);
        ctx.line(pa[0], pa[1], pb[0], pb[1]);
    };
    let oval = |c: [f64; 2], rx: f64, ry: f64, fill: &str| {
        let pc = q(c[0], c[1]);
        ctx.begin();
        ctx.ellipse(pc[0], pc[1], rx * s, ry * s, 0.0, 0.0, std::f64::consts::TAU);
        ctx.fill_style(fill);
        ctx.fill();
    };
    if let Some(m) = look.mask {
        blob(ctx, &[q(8.4, -0.4), q(7.0, -6.0), q(1.0, -8.4), q(-4.0, -6.0), q(-2.0, -0.4)], m, 0.8);
        ctx.alpha(0.35);
        ctx.stroke_style(INK);
        line([-1.0, -3.0], [6.0, -2.0], 1.2);
        ctx.alpha(1.0);
    } else if face != "ko" {
        ctx.alpha(0.28);
        oval([3.6, -2.6], 2.2, 1.3, "#ff6b6b"); // bochecha
        ctx.alpha(1.0);
    }
    if face == "ko" {
        ctx.stroke_style(INK);
        line([3.4, 2.8], [6.8, -0.4], 1.5);
        line([3.4, -0.4], [6.8, 2.8], 1.5);
    } else if face == "hurt" {
        ctx.stroke_style(INK);
        line([3.4, 2.6], [7.0, 0.6], 1.5);
        line([3.4, -0.4], [7.0, 0.6], 1.5);
        if look.mask.is_none() {
            oval([5.8, -4.6], 1.5, 1.1, "#3a1010");
        }
        ctx.stroke_style(INK);
        line([3.0, 4.6], [7.2, 3.4], 1.4);
    } else {
        let shout = face == "shout";
        // olho: branco, íris e brilho
        let ey = if shout { 1.9 } else { 2.6 };
        oval([5.7, 1.2], 1.9, ey, "#ffffff");
        ctx.line_width(0.9 * s);
        ctx.stroke_style(INK);
        let pc = q(5.7, 1.2);
        ctx.begin();
        ctx.ellipse(pc[0], pc[1], 1.9 * s, ey * s, 0.0, 0.0, std::f64::consts::TAU);
        ctx.stroke();
        oval([6.3, 1.1], 1.45, ey - 0.35, look.eye.unwrap_or("#3a2418"));
        oval([6.5, 1.1], 0.8, ey - 1.0, "#0c0810");
        oval([6.8, 1.9], 0.55, 0.55, "#ffffff");
        // sobrancelha (brava se gritando)
        ctx.stroke_style(INK);
        line(if shout { [3.0, 5.8] } else { [3.4, 5.4] }, if shout { [8.0, 3.6] } else { [8.0, 5.2] }, if shout { 1.9 } else { 1.3 });
        if look.mask.is_none() {
            if shout {
                oval([6.2, -4.6], 1.8, 1.4, "#4a0f18");
                oval([6.2, -5.2], 1.0, 0.5, "#e86a7a");
            } else {
                ctx.stroke_style(INK);
                line([4.6, -4.4], [7.4, -4.1], 1.2);
            }
            ctx.stroke_style(INK);
            line([8.6, -1.4], [9.2, -2.2], 1.0);
        }
    }
    if look.beard {
        blob(ctx, &[q(7.8, -2.5), q(6.0, -7.6), q(1.0, -9.0), q(-3.0, -6.0), q(-1.0, -3.0), q(4.0, -4.5)], look.hair, 0.8);
    }
}

/// desenha uma pose numa célula de w x h com o pé em `base`
pub fn draw_pose_cell(ctx: &Ctx, look: &Look, pose: &Pose, x0: f64, y0: f64, w: f64, base: f64) -> Joints {
    let s = look.scale * FIGHTER_SCALE;
    let j = place_pose(pose, s, x0 + w / 2.0, y0 + base);
    draw_body(ctx, &j, look, pose, s);
    j
}

/// Retrato (cabeça e ombros) num quadrado de `size`
pub fn draw_portrait(ctx: &Ctx, look: &Look, x: f64, y: f64, size: f64, bg: Option<&str>) {
    let s = size / 29.0;
    ctx.save();
    ctx.begin();
    ctx.rect(x, y, size, size);
    ctx.clip();
    if let Some(bg) = bg {
        let g = ctx.linear(x, y, x, y + size, &[(0.0, &shade(bg, 1.35)), (1.0, &shade(bg, 0.55))]);
        ctx.fill_grad(&g);
        ctx.fill_rect(x, y, size, size);
    }
    let pose = p(4.0, [8.0, 30.0], [-8.0, 30.0], [6.0, 2.0], [-6.0, 2.0]).head(2.0);
    let mut j = solve_pose(&pose, s);
    let head = j.get("head");
    let ox = x + size * 0.5 - head[0];
    let oy = y + size * 0.47 - head[1];
    j.translate(ox, oy);
    draw_body(ctx, &j, look, &pose, s);
    ctx.restore();
}

// ---- armas ----

/// arma leve: 16 ângulos (k = 0 para cima, girando para a frente)
pub fn weapon_angle(k: usize) -> f64 {
    180.0 - k as f64 * 22.5
}

pub fn draw_weapon(ctx: &Ctx, kind: &str, cx: f64, cy: f64, angle: f64, s: f64) {
    let tip = along([cx, cy], angle, 19.0 * s);
    let butt = along([cx, cy], angle + 180.0, 5.0 * s);
    match kind {
        "bat" => {
            capsule(ctx, butt, along([cx, cy], angle, 6.0 * s), 3.0 * s, "#8a5a2b");
            capsule(ctx, along([cx, cy], angle, 5.0 * s), tip, 5.2 * s, "#c88a4a");
        }
        "pipe" => {
            capsule(ctx, butt, tip, 3.6 * s, "#9aa4b2");
            capsule(ctx, along([cx, cy], angle, 16.0 * s), tip, 5.0 * s, "#6c7682");
        }
        "stone" => {
            let raw = [
                [cx - 15.0, cy + 2.0],
                [cx - 12.0, cy - 11.0],
                [cx - 2.0, cy - 16.0],
                [cx + 11.0, cy - 12.0],
                [cx + 16.0, cy - 1.0],
                [cx + 12.0, cy + 12.0],
                [cx - 3.0, cy + 15.0],
                [cx - 13.0, cy + 11.0],
            ];
            let pts: Vec<P> = raw.iter().map(|q| [cx + (q[0] - cx) * s, cy + (q[1] - cy) * s]).collect();
            blob(ctx, &pts, "#8d8d94", 1.3);
            blob(ctx, &[[cx - 8.0, cy - 8.0], [cx + 2.0, cy - 12.0], [cx + 8.0, cy - 7.0], [cx - 1.0, cy - 4.0]], "#b3b3ba", 0.6);
        }
        "crate" => {
            let r = 15.0 * s;
            blob(ctx, &[[cx - r, cy - r], [cx + r, cy - r], [cx + r, cy + r], [cx - r, cy + r]], "#b9803f", 1.3);
            ctx.stroke_style("#7a4f22");
            ctx.line_width(2.4 * s);
            ctx.begin();
            ctx.move_to(cx - r, cy - r);
            ctx.line_to(cx + r, cy + r);
            ctx.move_to(cx - r, cy + r);
            ctx.line_to(cx + r, cy - r);
            ctx.stroke_rect(cx - r + 3.0, cy - r + 3.0, 2.0 * r - 6.0, 2.0 * r - 6.0);
            ctx.stroke();
        }
        _ => {}
    }
}

// ---- ataques especiais e efeitos ----

pub fn glow(ctx: &Ctx, x: f64, y: f64, r: f64, color: &str, a: f64) {
    let g = ctx.radial(x, y, 0.0, x, y, r, &[(0.0, &format!("rgba(255,255,255,{})", a)), (0.35, color), (1.0, "rgba(0,0,0,0)")]);
    ctx.fill_grad(&g);
    ctx.circle(x, y, r);
    ctx.fill();
}

/// bola de energia indo para a direita, quadro i de uma animação
pub fn draw_orb(ctx: &Ctx, cx: f64, cy: f64, color: &str, i: usize, style: &str) {
    ctx.save();
    let pi = std::f64::consts::PI;
    match style {
        "shard" => {
            for k in 0..3 {
                let x = cx - k as f64 * 13.0 - (i % 2) as f64 * 3.0;
                ctx.alpha(1.0 - k as f64 * 0.3);
                let fill = if k > 0 { rgba(color, 0.7) } else { "#e8fbff".to_string() };
                blob(ctx, &[[x + 14.0, cy], [x - 2.0, cy - 6.0], [x - 8.0, cy], [x - 2.0, cy + 6.0]], &fill, 0.8);
            }
        }
        "star" => {
            ctx.translate(cx, cy);
            ctx.rotate(i as f64 * pi / 4.0);
            let mut pts = vec![];
            for k in 0..8 {
                let r = if k % 2 == 1 { 3.0 } else { 10.0 };
                pts.push([(k as f64 * pi / 4.0).cos() * r, (k as f64 * pi / 4.0).sin() * r]);
            }
            blob(ctx, &pts, "#c9d2dc", 0.9);
            disc(ctx, [0.0, 0.0], 2.4, "#3a4250");
        }
        "wave" => {
            let h = 26.0 + (i % 2) as f64 * 4.0;
            let g = ctx.linear(cx - 30.0, 0.0, cx + 12.0, 0.0, &[(0.0, "rgba(0,0,0,0)"), (1.0, &rgba(color, 0.9))]);
            ctx.fill_grad(&g);
            ctx.begin();
            ctx.move_to(cx - 30.0, cy + 10.0);
            ctx.quad_to(cx + 4.0, cy + 10.0, cx + 12.0, cy + 10.0 - h);
            ctx.quad_to(cx + 2.0, cy + 4.0, cx - 30.0, cy + 4.0);
            ctx.fill();
            glow(ctx, cx + 6.0, cy + 2.0, 10.0, &rgba(color, 0.8), 0.8);
        }
        _ => {
            // rastro
            for k in (1..=4).rev() {
                ctx.alpha(0.18 * (5 - k) as f64);
                glow(ctx, cx - k as f64 * 7.0 - (i % 2) as f64 * 2.0, cy + ((i + k) as f64).sin() * 1.5, 11.0 - k as f64, &rgba(color, 0.8), 1.0);
            }
            ctx.alpha(1.0);
            glow(ctx, cx, cy, 16.0 + (i % 2) as f64 * 2.0, &rgba(color, 0.95), 1.0);
            if style == "fire" {
                // línguas de fogo para trás
                for k in 0..3 {
                    ctx.save();
                    ctx.translate(cx - 14.0 - k as f64 * 9.0, cy + (k as f64 - 1.0) * 5.0);
                    ctx.rotate(-pi / 2.0);
                    draw_flame(ctx, 0.0, 0.0, i + k, 1.1 - k as f64 * 0.2);
                    ctx.restore();
                }
                ctx.fill_style(&rgba("#ffe066", 0.9));
                for k in 0..5 {
                    let a = (k as f64 / 5.0) * pi * 2.0 + i as f64;
                    ctx.circle(cx + a.cos() * 6.0 - 3.0, cy + a.sin() * 5.0, 3.0);
                    ctx.fill();
                }
            }
        }
    }
    ctx.restore();
}

/// explosão de energia (quadro k de 4)
pub fn draw_energy_burst(ctx: &Ctx, cx: f64, cy: f64, color: &str, k: usize, size: f64) {
    ctx.save();
    let r = (8.0 + k as f64 * 7.0) * size;
    ctx.alpha(1.0 - k as f64 * 0.22);
    glow(ctx, cx, cy, r, &rgba(color, 0.9), 1.0);
    ctx.stroke_style(&rgba(color, 0.9));
    ctx.line_width(2.0);
    for i in 0..8 {
        let a = (i as f64 / 8.0) * std::f64::consts::TAU + k as f64 * 0.3;
        ctx.line(cx + a.cos() * r * 0.5, cy + a.sin() * r * 0.5, cx + a.cos() * r * 1.1, cy + a.sin() * r * 1.1);
    }
    ctx.restore();
}

/// faísca de golpe em estrela
pub fn draw_spark(ctx: &Ctx, cx: f64, cy: f64, k: usize, big: bool, color: &str) {
    ctx.save();
    let rr0 = (if big { 32.0 } else { 19.0 }) * (0.6 + k as f64 * 0.25);
    let r = rr0 * 0.38;
    ctx.alpha(1.0 - k as f64 * 0.2);
    let mut pts = vec![];
    for i in 0..16 {
        let a = (i as f64 / 16.0) * std::f64::consts::TAU + k as f64 * 0.2;
        let rr = if i % 2 == 1 { r } else { rr0 * if i % 4 == 0 { 1.0 } else { 0.7 } };
        pts.push([cx + a.cos() * rr, cy + a.sin() * rr]);
    }
    blob(ctx, &pts, color, 0.9);
    disc(ctx, [cx, cy], r * 0.8, "#ffffff");
    ctx.restore();
}

pub fn draw_flame(ctx: &Ctx, cx: f64, cy: f64, k: usize, s: f64) {
    ctx.save();
    let h = (16.0 + (k % 3) as f64 * 4.0) * s;
    let g = ctx.linear(0.0, cy, 0.0, cy - h, &[(0.0, "#ff5a1f"), (0.6, "#ffb43a"), (1.0, "rgba(255,240,150,0)")]);
    ctx.fill_grad(&g);
    ctx.begin();
    ctx.move_to(cx - 7.0 * s, cy);
    ctx.quad_to(cx - 9.0 * s, cy - h * 0.5, cx + (if k % 2 == 1 { 2.0 } else { -2.0 }) * s, cy - h);
    ctx.quad_to(cx + 9.0 * s, cy - h * 0.45, cx + 7.0 * s, cy);
    ctx.fill();
    ctx.restore();
}

pub fn draw_ice_block(ctx: &Ctx, x: f64, y: f64, w: f64, h: f64) {
    ctx.save();
    ctx.alpha(0.62);
    blob(ctx, &[[x + 4.0, y + h], [x, y + 18.0], [x + 8.0, y + 2.0], [x + w - 10.0, y], [x + w, y + 14.0], [x + w - 3.0, y + h]], "#9fe3ff", 1.0);
    ctx.alpha(0.9);
    ctx.stroke_style("#ffffff");
    ctx.line_width(2.0);
    ctx.begin();
    ctx.move_to(x + 10.0, y + 10.0);
    ctx.line_to(x + 16.0, y + 30.0);
    ctx.move_to(x + w - 14.0, y + 8.0);
    ctx.line_to(x + w - 10.0, y + 22.0);
    ctx.stroke();
    ctx.restore();
}
