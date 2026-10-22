//! Cenários desenhados por código, em camadas com paralaxe. A cena começa em
//! y = 128 do mundo; o chão (onde os lutadores andam) fica entre zboundary[0] e [1].

use std::collections::HashMap;
use web_sys::HtmlCanvasElement;

use crate::core::consts::{Random, W};
use crate::engine::data::{BgData, Layer};
use crate::gfx::*;

const SKY_Y: f64 = 128.0;
const FLOOR_Y: f64 = 322.0;
const WORLD_BOTTOM: f64 = 560.0;
const TAU: f64 = std::f64::consts::TAU;
const PI: f64 = std::f64::consts::PI;

type Images = HashMap<String, HtmlCanvasElement>;

fn vgrad(ctx: &Ctx, y0: f64, y1: f64, stops: &[(f64, &str)]) {
    let g = ctx.linear(0.0, y0, 0.0, y1, stops);
    ctx.fill_grad(&g);
}

/// silhueta de morros: pontos com ruído suave
fn ridge(ctx: &Ctx, w: f64, base: f64, amp: f64, color: &str, rng: &mut Random, step: f64) {
    ctx.fill_style(color);
    ctx.begin();
    ctx.move_to(0.0, base + 200.0);
    let mut y = base - amp * rng.next();
    ctx.line_to(0.0, y);
    let mut x = step;
    while x <= w + step {
        let ny = (base - amp * (0.3 + 0.7 * rng.next())).max(0.0);
        ctx.quad_to(x - step / 2.0, y, x, ny);
        y = ny;
        x += step;
    }
    ctx.line_to(w, base + 200.0);
    ctx.fill();
}

fn cloud(ctx: &Ctx, x: f64, y: f64, s: f64, color: &str) {
    ctx.fill_style(color);
    for (dx, dy, r) in [(0.0, 0.0, 14.0), (16.0, -6.0, 18.0), (34.0, 0.0, 13.0), (18.0, 6.0, 14.0)] {
        ctx.circle(x + dx * s, y + dy * s, r * s);
        ctx.fill();
    }
}

fn layer(images: &mut Images, key: &str, w: f64, h: f64, y: f64, draw: &mut dyn FnMut(&Ctx, f64, f64)) -> Layer {
    let c = make_canvas(w, h);
    draw(&ctx_of(&c), w, h);
    images.insert(key.to_string(), c);
    Layer { pic: key.to_string(), width: w, height: h, x: 0.0, y, front: false, alpha: 1.0, i: 0, ratio: 0.0 }
}

pub struct SceneDef {
    pub id: i32,
    pub name: &'static str,
    pub width: f64,
    pub z: [f64; 2],
}

pub fn scene_list() -> Vec<SceneDef> {
    vec![
        SceneDef { id: 1, name: "Praia", width: 2000.0, z: [342.0, 528.0] },
        SceneDef { id: 2, name: "Rua da Cidade", width: 2400.0, z: [350.0, 528.0] },
        SceneDef { id: 3, name: "Floresta", width: 2400.0, z: [345.0, 528.0] },
        SceneDef { id: 4, name: "Templo da Montanha", width: 1600.0, z: [348.0, 528.0] },
        SceneDef { id: 5, name: "Porto", width: 2400.0, z: [350.0, 528.0] },
        SceneDef { id: 6, name: "Dojô", width: 794.0, z: [350.0, 528.0] },
    ]
}

fn layers(sc: &SceneDef, images: &mut Images, rng: &mut Random) -> Vec<Layer> {
    let k = format!("gen/bg{}/", sc.id);
    match sc.id {
        1 => vec![
            layer(images, &(k.clone() + "sky"), W, WORLD_BOTTOM - SKY_Y, SKY_Y, &mut |ctx, w, h| {
                vgrad(ctx, 0.0, 190.0, &[(0.0, "#2b1d52"), (0.55, "#c8507a"), (1.0, "#ffb070")]);
                ctx.fill_rect(0.0, 0.0, w, h);
                ctx.fill_circle(520.0, 168.0, 34.0, "#ffe2a0");
                for i in 0..5 {
                    cloud(ctx, 60.0 + i as f64 * 160.0, 40.0 + (i % 2) as f64 * 30.0, 1.0 + (i % 3) as f64 * 0.3, "rgba(255,190,200,0.35)");
                }
            }),
            layer(images, &(k.clone() + "sea"), 1000.0, 150.0, 290.0, &mut |ctx, w, _h| {
                ctx.fill_style("#5a3f78");
                for i in 0..4 {
                    ctx.begin();
                    ctx.ellipse(120.0 + i as f64 * 260.0, 12.0, 90.0 - i as f64 * 10.0, 16.0, 0.0, PI, 0.0);
                    ctx.fill();
                }
                vgrad(ctx, 10.0, 60.0, &[(0.0, "#d9708a"), (0.3, "#5a6ab8"), (1.0, "#2a4a8a")]);
                ctx.fill_rect(0.0, 10.0, w, 140.0);
                ctx.fill_style("rgba(255,230,180,0.7)");
                for _ in 0..60 {
                    let (a, b, c) = (rng.next(), rng.next(), rng.next());
                    ctx.fill_rect(a * w, 14.0 + b * 30.0, 6.0 + c * 16.0, 1.5);
                }
            }),
            layer(images, &(k.clone() + "palms"), 1500.0, 200.0, 150.0, &mut |ctx, _w, _h| {
                for i in 0..6 {
                    let x = 80.0 + i as f64 * 250.0 + rng.next() * 60.0;
                    let lean = (rng.next() - 0.5) * 40.0;
                    ctx.stroke_style("#5a3a2a");
                    ctx.line_width(9.0);
                    ctx.line_cap("round");
                    ctx.begin();
                    ctx.move_to(x, 200.0);
                    ctx.quad_to(x + lean * 0.3, 120.0, x + lean, 50.0);
                    ctx.stroke();
                    ctx.fill_style("#2f6a3a");
                    for f in 0..6 {
                        let a = (f as f64 / 6.0) * TAU;
                        ctx.begin();
                        ctx.ellipse(x + lean + a.cos() * 26.0, 50.0 + a.sin() * 10.0 + 6.0, 30.0, 7.0, a, 0.0, TAU);
                        ctx.fill();
                    }
                }
            }),
            layer(images, &(k.clone() + "sand"), 2000.0, WORLD_BOTTOM - FLOOR_Y, FLOOR_Y, &mut |ctx, w, h| {
                vgrad(ctx, 0.0, h, &[(0.0, "#f0c890"), (1.0, "#d8a868")]);
                ctx.fill_rect(0.0, 0.0, w, h);
                ctx.fill_style("rgba(255,255,255,0.75)");
                let mut x = 0.0;
                while x < w {
                    ctx.begin();
                    ctx.ellipse(x, 6.0 + (x / 50.0).sin() * 3.0, 22.0, 4.0, 0.0, 0.0, TAU);
                    ctx.fill();
                    x += 30.0;
                }
                ctx.fill_style("rgba(150,100,60,0.35)");
                for _ in 0..500 {
                    let (a, b) = (rng.next(), rng.next());
                    ctx.fill_rect(a * w, 20.0 + b * h, 2.0, 2.0);
                }
            }),
        ],
        2 => vec![
            layer(images, &(k.clone() + "sky"), W, WORLD_BOTTOM - SKY_Y, SKY_Y, &mut |ctx, w, h| {
                vgrad(ctx, 0.0, 200.0, &[(0.0, "#070a1e"), (1.0, "#2a2350")]);
                ctx.fill_rect(0.0, 0.0, w, h);
                ctx.fill_style("#fff");
                for _ in 0..80 {
                    let (a, b) = (rng.next(), rng.next());
                    ctx.fill_rect(a * w, b * 120.0, 1.5, 1.5);
                }
                ctx.fill_circle(640.0, 40.0, 18.0, "#f2ecd0");
            }),
            layer(images, &(k.clone() + "skyline"), 1100.0, 200.0, 140.0, &mut |ctx, w, _h| {
                let mut x = 0.0;
                while x < w {
                    let bw = 40.0 + rng.next() * 60.0;
                    let bh = 60.0 + rng.next() * 120.0;
                    ctx.fill_style("#1a1838");
                    ctx.fill_rect(x, 200.0 - bh, bw, bh);
                    ctx.fill_style("rgba(255,214,120,0.75)");
                    let mut wy = 200.0 - bh + 8.0;
                    while wy < 190.0 {
                        let mut wx = x + 5.0;
                        while wx < x + bw - 6.0 {
                            if rng.next() < 0.35 {
                                ctx.fill_rect(wx, wy, 4.0, 5.0);
                            }
                            wx += 9.0;
                        }
                        wy += 10.0;
                    }
                    x += bw + 4.0;
                }
            }),
            layer(images, &(k.clone() + "shops"), 1700.0, 160.0, 182.0, &mut |ctx, w, _h| {
                let cols = ["#5a2f3a", "#3a4a6a", "#4a3a2a", "#2f4a4a"];
                let mut x = 0.0;
                let mut i = 0usize;
                while x < w {
                    ctx.fill_style(cols[i % 4]);
                    ctx.fill_rect(x, 10.0, 166.0, 150.0);
                    ctx.fill_style("#20202a");
                    ctx.fill_rect(x + 12.0, 90.0, 70.0, 70.0);
                    ctx.fill_style("rgba(255,230,160,0.55)");
                    ctx.fill_rect(x + 96.0, 92.0, 58.0, 40.0);
                    let neon = ["#ff4fa0", "#4ff0ff", "#ffd23a", "#7dff6a"][i % 4];
                    ctx.stroke_style(neon);
                    ctx.line_width(3.0);
                    ctx.shadow(neon, 8.0);
                    ctx.stroke_rect(x + 20.0, 40.0, 120.0, 26.0);
                    ctx.circle(x + 80.0, 53.0, 7.0);
                    ctx.stroke();
                    ctx.shadow(neon, 0.0);
                    ctx.fill_style("rgba(0,0,0,0.25)");
                    let mut wy = 14.0;
                    while wy < 34.0 {
                        ctx.fill_rect(x + 10.0, wy, 146.0, 4.0);
                        wy += 12.0;
                    }
                    x += 170.0;
                    i += 1;
                }
            }),
            layer(images, &(k.clone() + "street"), 2400.0, WORLD_BOTTOM - FLOOR_Y, FLOOR_Y, &mut |ctx, w, h| {
                ctx.fill_style("#6a6a74");
                ctx.fill_rect(0.0, 0.0, w, 34.0);
                ctx.stroke_style("#55555e");
                ctx.line_width(2.0);
                let mut x = 0.0;
                while x < w {
                    ctx.line(x, 0.0, x - 10.0, 34.0);
                    x += 48.0;
                }
                ctx.fill_style("#8a8a92");
                ctx.fill_rect(0.0, 32.0, w, 6.0);
                vgrad(ctx, 38.0, h, &[(0.0, "#33343e"), (1.0, "#26262e")]);
                ctx.fill_rect(0.0, 38.0, w, h - 38.0);
                ctx.fill_style("#e8c23a");
                let mut x = 0.0;
                while x < w {
                    ctx.fill_rect(x, 128.0, 60.0, 6.0);
                    x += 120.0;
                }
                ctx.fill_style("rgba(255,255,255,0.05)");
                for _ in 0..400 {
                    let (a, b) = (rng.next(), rng.next());
                    ctx.fill_rect(a * w, 40.0 + b * h, 2.0, 2.0);
                }
            }),
        ],
        3 => vec![
            layer(images, &(k.clone() + "sky"), W, WORLD_BOTTOM - SKY_Y, SKY_Y, &mut |ctx, w, h| {
                vgrad(ctx, 0.0, 200.0, &[(0.0, "#5ab0f0"), (1.0, "#c8ecff")]);
                ctx.fill_rect(0.0, 0.0, w, h);
                for i in 0..6 {
                    cloud(ctx, 40.0 + i as f64 * 140.0, 30.0 + (i % 3) as f64 * 18.0, 1.1, "rgba(255,255,255,0.9)");
                }
            }),
            layer(images, &(k.clone() + "hills"), 1100.0, 200.0, 160.0, &mut |ctx, w, _h| {
                ridge(ctx, w, 120.0, 70.0, "#8ab8c8", rng, 60.0);
                ridge(ctx, w, 160.0, 50.0, "#5a9a6a", rng, 50.0);
            }),
            layer(images, &(k.clone() + "trees"), 1700.0, 190.0, 150.0, &mut |ctx, w, _h| {
                for i in 0..26 {
                    let x = i as f64 * 68.0 + rng.next() * 30.0;
                    let s = 0.8 + rng.next() * 0.5;
                    ctx.fill_style("#5a3a24");
                    ctx.fill_rect(x - 5.0 * s, 120.0, 10.0 * s, 70.0);
                    ctx.fill_style(if i % 2 == 1 { "#2f7a3a" } else { "#3a8a44" });
                    for (dx, dy, r) in [(0.0, 90.0, 34.0), (-22.0, 110.0, 26.0), (22.0, 110.0, 26.0), (0.0, 60.0, 26.0)] {
                        ctx.circle(x + dx * s, dy, r * s);
                        ctx.fill();
                    }
                }
                ctx.fill_style("rgba(30,70,30,0.6)");
                ctx.fill_rect(0.0, 178.0, w, 12.0);
            }),
            layer(images, &(k.clone() + "grass"), 2400.0, WORLD_BOTTOM - FLOOR_Y, FLOOR_Y, &mut |ctx, w, h| {
                vgrad(ctx, 0.0, h, &[(0.0, "#4f9a3c"), (1.0, "#3a7a2e")]);
                ctx.fill_rect(0.0, 0.0, w, h);
                ctx.fill_style("#b8955f");
                ctx.begin();
                ctx.move_to(0.0, 90.0);
                let mut x = 0.0;
                while x <= w {
                    ctx.line_to(x, 90.0 + (x / 300.0).sin() * 12.0);
                    x += 80.0;
                }
                let mut x = w;
                while x >= 0.0 {
                    ctx.line_to(x, 150.0 + (x / 260.0).sin() * 14.0);
                    x -= 80.0;
                }
                ctx.fill();
                ctx.stroke_style("rgba(30,80,20,0.6)");
                ctx.line_width(1.5);
                for _ in 0..700 {
                    let x = rng.next() * w;
                    let y = rng.next() * h;
                    if y > 80.0 && y < 160.0 {
                        continue;
                    }
                    ctx.line(x, y, x + 2.0, y - 5.0);
                }
            }),
        ],
        4 => vec![
            layer(images, &(k.clone() + "sky"), W, WORLD_BOTTOM - SKY_Y, SKY_Y, &mut |ctx, w, h| {
                vgrad(ctx, 0.0, 200.0, &[(0.0, "#3a2a5a"), (0.6, "#c87a6a"), (1.0, "#f2c08a")]);
                ctx.fill_rect(0.0, 0.0, w, h);
            }),
            layer(images, &(k.clone() + "mountains"), 1000.0, 210.0, 130.0, &mut |ctx, _w, _h| {
                ctx.fill_style("#6a5a8a");
                for i in 0..5 {
                    let x = i as f64 * 230.0 + rng.next() * 40.0;
                    let top = 30.0 + rng.next() * 40.0;
                    ctx.poly(&[[x - 160.0, 210.0], [x, top], [x + 160.0, 210.0]]);
                    ctx.fill();
                    ctx.fill_style("#f2eef8");
                    ctx.poly(&[[x - 30.0, top + 34.0], [x, top], [x + 30.0, top + 34.0], [x + 10.0, top + 26.0], [x - 8.0, top + 36.0]]);
                    ctx.fill();
                    ctx.fill_style("#6a5a8a");
                }
            }),
            layer(images, &(k.clone() + "temple"), 1300.0, 190.0, 150.0, &mut |ctx, w, _h| {
                let mut x = 60.0;
                while x < w {
                    ctx.fill_style("#a8302a");
                    ctx.fill_rect(x, 60.0, 14.0, 130.0);
                    ctx.fill_rect(x + 150.0, 60.0, 14.0, 130.0);
                    ctx.fill_rect(x - 20.0, 50.0, 204.0, 12.0);
                    ctx.fill_style("#2a1a1a");
                    ctx.fill_rect(x - 30.0, 36.0, 224.0, 12.0);
                    ctx.fill_style("#7a7a82");
                    ctx.fill_rect(x + 220.0, 130.0, 22.0, 60.0);
                    ctx.fill_rect(x + 212.0, 118.0, 38.0, 14.0);
                    ctx.fill_style("#ffcf6a");
                    ctx.fill_rect(x + 225.0, 140.0, 12.0, 12.0);
                    x += 300.0;
                }
            }),
            layer(images, &(k.clone() + "stones"), 1600.0, WORLD_BOTTOM - FLOOR_Y, FLOOR_Y, &mut |ctx, w, h| {
                ctx.fill_style("#9a8f8a");
                ctx.fill_rect(0.0, 0.0, w, h);
                ctx.stroke_style("#7a706c");
                ctx.line_width(2.0);
                let mut y = 0.0;
                let mut r = 0.0;
                while y < h {
                    ctx.line(0.0, y, w, y);
                    let mut x = (r as i32 % 2) as f64 * 30.0;
                    while x < w {
                        ctx.line(x, y, x, y + 26.0 + r * 4.0);
                        x += 60.0 + r * 6.0;
                    }
                    y += 26.0 + r * 4.0;
                    r += 1.0;
                }
            }),
        ],
        5 => vec![
            layer(images, &(k.clone() + "sky"), W, WORLD_BOTTOM - SKY_Y, SKY_Y, &mut |ctx, w, h| {
                vgrad(ctx, 0.0, 200.0, &[(0.0, "#7ab0d8"), (1.0, "#e8eef2")]);
                ctx.fill_rect(0.0, 0.0, w, h);
                for i in 0..4 {
                    cloud(ctx, 90.0 + i as f64 * 190.0, 40.0 + (i % 2) as f64 * 24.0, 1.3, "rgba(255,255,255,0.8)");
                }
            }),
            layer(images, &(k.clone() + "sea"), 1100.0, 200.0, 150.0, &mut |ctx, w, _h| {
                vgrad(ctx, 120.0, 200.0, &[(0.0, "#4a7aa8"), (1.0, "#2a5a88")]);
                ctx.fill_rect(0.0, 120.0, w, 80.0);
                ctx.stroke_style("#3a4250");
                ctx.line_width(5.0);
                let mut x = 80.0;
                while x < w {
                    ctx.begin();
                    ctx.move_to(x, 130.0);
                    ctx.line_to(x, 20.0);
                    ctx.line_to(x + 110.0, 20.0);
                    ctx.move_to(x - 30.0, 20.0);
                    ctx.line_to(x, 20.0);
                    ctx.move_to(x + 90.0, 20.0);
                    ctx.line_to(x + 90.0, 60.0);
                    ctx.stroke();
                    x += 360.0;
                }
            }),
            layer(images, &(k.clone() + "containers"), 1700.0, 120.0, 212.0, &mut |ctx, w, _h| {
                let cols = ["#c8402a", "#2a7ac8", "#e0a020", "#3a9a5a", "#8a4ac8"];
                let mut x = 0.0;
                while x < w {
                    for r in 0..2 {
                        if r == 1 && rng.next() < 0.4 {
                            continue;
                        }
                        let c = cols[(rng.next() * cols.len() as f64).floor() as usize % cols.len()];
                        let y = 120.0 - (r + 1) as f64 * 52.0;
                        ctx.fill_style(c);
                        ctx.fill_rect(x + 4.0, y, 124.0, 50.0);
                        ctx.fill_style("rgba(0,0,0,0.18)");
                        let mut s = x + 10.0;
                        while s < x + 124.0 {
                            ctx.fill_rect(s, y + 4.0, 3.0, 42.0);
                            s += 10.0;
                        }
                    }
                    x += 132.0;
                }
            }),
            layer(images, &(k.clone() + "pier"), 2400.0, WORLD_BOTTOM - FLOOR_Y, FLOOR_Y, &mut |ctx, w, h| {
                ctx.fill_style("#9a7048");
                ctx.fill_rect(0.0, 0.0, w, h);
                ctx.stroke_style("#6a4a2e");
                ctx.line_width(2.0);
                let mut y = 0.0;
                while y < h {
                    ctx.line(0.0, y, w, y);
                    y += 20.0;
                }
                for _ in 0..300 {
                    let x = rng.next() * w;
                    let y = (rng.next() * (h / 20.0)).floor() * 20.0;
                    ctx.line(x, y, x, y + 20.0);
                }
            }),
        ],
        _ => vec![
            layer(images, &(k.clone() + "wall"), W, WORLD_BOTTOM - SKY_Y, SKY_Y, &mut |ctx, w, h| {
                vgrad(ctx, 0.0, 200.0, &[(0.0, "#4a2e1e"), (1.0, "#7a5034")]);
                ctx.fill_rect(0.0, 0.0, w, h);
                let mut x = 30.0;
                while x < w {
                    ctx.fill_style("#f2e6c8");
                    ctx.fill_rect(x, 50.0, 130.0, 120.0);
                    ctx.stroke_style("#3a2416");
                    ctx.line_width(4.0);
                    ctx.stroke_rect(x, 50.0, 130.0, 120.0);
                    ctx.begin();
                    ctx.move_to(x + 65.0, 50.0);
                    ctx.line_to(x + 65.0, 170.0);
                    ctx.move_to(x, 110.0);
                    ctx.line_to(x + 130.0, 110.0);
                    ctx.stroke();
                    x += 190.0;
                }
                let mut x = 140.0;
                while x < w {
                    ctx.fill_style("#b8282a");
                    ctx.fill_rect(x, 20.0, 40.0, 150.0);
                    ctx.fill_circle(x + 20.0, 70.0, 12.0, "#f2d23a");
                    x += 380.0;
                }
            }),
            layer(images, &(k.clone() + "floor"), W, WORLD_BOTTOM - FLOOR_Y, FLOOR_Y, &mut |ctx, w, h| {
                ctx.fill_style("#c89a62");
                ctx.fill_rect(0.0, 0.0, w, h);
                ctx.stroke_style("#a87a48");
                ctx.line_width(2.0);
                let mut y = 0.0;
                while y < h {
                    ctx.line(0.0, y, w, y);
                    y += 22.0;
                }
                for _ in 0..120 {
                    let x = rng.next() * w;
                    let y = (rng.next() * (h / 22.0)).floor() * 22.0;
                    ctx.line(x, y, x, y + 22.0);
                }
                ctx.fill_style("rgba(255,255,255,0.12)");
                ctx.fill_rect(0.0, 0.0, w, 6.0);
            }),
        ],
    }
}

// ---- primeiro plano: passa na frente dos lutadores, rolando mais rápido que o chão ----

fn front(images: &mut Images, key: &str, sc: &SceneDef, h: f64, y: f64, alpha: f64, draw: &mut dyn FnMut(&Ctx, f64, f64)) -> Layer {
    let w = (sc.width * 1.2).round();
    let mut l = layer(images, key, w, h, y, draw);
    l.front = true;
    l.alpha = alpha;
    l
}

/// copa de árvore vista de perto: círculos sobrepostos com pontos de luz
fn canopy(ctx: &Ctx, x: f64, y: f64, s: f64, dark: &str, light: &str) {
    for (dx, dy, r) in [(0.0, 0.0, 40.0), (-38.0, 10.0, 32.0), (38.0, 12.0, 34.0), (-20.0, 34.0, 28.0), (24.0, 36.0, 30.0)] {
        ctx.fill_circle(x + dx * s, y + dy * s, r * s, dark);
    }
    ctx.fill_style(light);
    for i in 0..9 {
        ctx.circle(x + ((i * 37 % 90) as f64 - 45.0) * s, y + (i * 23 % 70) as f64 * s, 5.0 * s);
        ctx.fill();
    }
}

fn leaf_cluster(ctx: &Ctx, x: f64, y: f64, s: f64, a: f64, color: &str) {
    ctx.fill_style(color);
    for i in 0..6 {
        let r = a + (i as f64 - 2.5) * 0.35;
        ctx.begin();
        ctx.ellipse(x + r.cos() * 34.0 * s, y + r.sin() * 34.0 * s, 38.0 * s, 7.0 * s, r, 0.0, TAU);
        ctx.fill();
    }
}

fn fronts(sc: &SceneDef, images: &mut Images, rng: &mut Random) -> Vec<Layer> {
    match sc.id {
        1 => vec![front(images, "gen/bg1/fg-leaves", sc, 110.0, 150.0, 1.0, &mut |ctx, w, _h| {
            let mut x = 140.0;
            while x < w {
                leaf_cluster(ctx, x, 6.0, 1.5, PI / 2.0 + (rng.next() - 0.5), "#1f4a2c");
                x += 520.0 + rng.next() * 260.0;
            }
        })],
        2 => vec![front(images, "gen/bg2/fg-poles", sc, 440.0, 128.0, 0.55, &mut |ctx, w, h| {
            let mut x = 300.0;
            while x < w {
                ctx.fill_style("#16141f");
                ctx.fill_rect(x - 3.0, 30.0, 6.0, h - 30.0);
                ctx.fill_rect(x - 5.0, 30.0, 46.0, 8.0);
                let g = ctx.radial(x + 38.0, 44.0, 2.0, x + 38.0, 44.0, 70.0, &[(0.0, "rgba(255,230,160,0.9)"), (1.0, "rgba(255,200,100,0)")]);
                ctx.fill_grad(&g);
                ctx.circle(x + 38.0, 44.0, 70.0);
                ctx.fill();
                ctx.fill_style("#fff2c0");
                ctx.fill_rect(x + 28.0, 40.0, 20.0, 6.0);
                x += 900.0;
            }
            ctx.stroke_style("rgba(10,10,20,0.8)");
            ctx.line_width(2.0);
            ctx.begin();
            ctx.move_to(0.0, 20.0);
            let mut x = 0.0;
            while x <= w {
                ctx.line_to(x, 22.0 + (x / 90.0).sin() * 8.0);
                x += 60.0;
            }
            ctx.stroke();
        })],
        3 => vec![
            front(images, "gen/bg3/fg-leaves", sc, 110.0, 150.0, 1.0, &mut |ctx, w, _h| {
                let mut x = 90.0;
                while x < w {
                    let dark = if rng.next() < 0.5 { "#1c5226" } else { "#256a2e" };
                    canopy(ctx, x, -14.0, 1.1, dark, "#3f8f45");
                    x += 420.0 + rng.next() * 260.0;
                }
            }),
            front(images, "gen/bg3/fg-bush", sc, 50.0, 530.0, 1.0, &mut |ctx, w, _h| {
                let mut x = 0.0;
                while x < w {
                    let c = if rng.next() < 0.5 { "#1f5a2a" } else { "#2a7035" };
                    ctx.fill_style(c);
                    let (a, b) = (rng.next(), rng.next());
                    ctx.begin();
                    ctx.arc(x + a * 40.0, 56.0, 26.0 + b * 20.0, PI, 0.0);
                    ctx.fill();
                    x += 110.0;
                }
            }),
        ],
        4 => vec![front(images, "gen/bg4/fg-pillars", sc, 440.0, 128.0, 0.5, &mut |ctx, w, h| {
            let mut x = 140.0;
            while x < w {
                ctx.fill_style("#8a2a26");
                ctx.fill_rect(x - 14.0, 0.0, 28.0, h);
                ctx.fill_style("#a8352f");
                ctx.fill_rect(x - 14.0, 0.0, 8.0, h);
                ctx.fill_style("#2a1a1a");
                ctx.fill_rect(x - 20.0, 0.0, 40.0, 10.0);
                x += 700.0;
            }
            let mut x = 420.0;
            while x < w {
                ctx.stroke_style("#2a1a1a");
                ctx.line_width(2.0);
                ctx.line(x, 0.0, x, 34.0);
                let g = ctx.radial(x, 52.0, 3.0, x, 52.0, 44.0, &[(0.0, "rgba(255,190,80,0.9)"), (1.0, "rgba(255,120,40,0)")]);
                ctx.fill_grad(&g);
                ctx.circle(x, 52.0, 44.0);
                ctx.fill();
                ctx.fill_style("#d83a2a");
                ctx.begin();
                ctx.ellipse(x, 52.0, 13.0, 17.0, 0.0, 0.0, TAU);
                ctx.fill();
                x += 700.0;
            }
        })],
        5 => vec![front(images, "gen/bg5/fg-crane", sc, 200.0, 128.0, 0.7, &mut |ctx, w, _h| {
            let mut x = 260.0;
            while x < w {
                ctx.fill_style("#c8402a");
                ctx.fill_rect(x - 6.0, 0.0, 12.0, 200.0);
                ctx.fill_rect(x - 6.0, 0.0, 150.0, 10.0);
                ctx.stroke_style("#2a2a30");
                ctx.line_width(2.0);
                ctx.line(x + 140.0, 10.0, x + 140.0, 110.0);
                ctx.fill_style("#2a2a30");
                ctx.begin();
                ctx.arc(x + 140.0, 116.0, 8.0, 0.0, PI);
                ctx.fill();
                x += 1000.0;
            }
        })],
        _ => vec![],
    }
}

/// cor de ambiente e vinheta de cada cenário
fn tone(id: i32) -> (&'static str, f64) {
    match id {
        1 => ("rgba(255,140,70,0.10)", 0.35),
        2 => ("rgba(40,60,170,0.12)", 0.5),
        3 => ("rgba(255,255,200,0.05)", 0.32),
        4 => ("rgba(255,110,60,0.10)", 0.42),
        5 => ("rgba(120,170,220,0.06)", 0.32),
        _ => ("rgba(255,170,80,0.10)", 0.45),
    }
}

pub fn build_scene(sc: &SceneDef, images: &mut Images) -> BgData {
    let mut rng = Random::new((sc.id * 7919) as u32);
    if !images.contains_key("gen/shadow") {
        let s = make_canvas(40.0, 10.0);
        let ctx = ctx_of(&s);
        ctx.fill_style("rgba(0,0,0,0.35)");
        ctx.begin();
        ctx.ellipse(20.0, 5.0, 19.0, 4.5, 0.0, 0.0, TAU);
        ctx.fill();
        images.insert("gen/shadow".into(), s);
    }
    let mut ls = layers(sc, images, &mut rng);
    ls.extend(fronts(sc, images, &mut rng));
    let (t, v) = tone(sc.id);
    BgData { id: sc.id, name: sc.name.to_string(), width: sc.width, zboundary: sc.z, shadow: "gen/shadow".into(), layers: ls, tone: Some(t.to_string()), vignette: v }
}
