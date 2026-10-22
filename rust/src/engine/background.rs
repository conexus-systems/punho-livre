//! Cenário com camadas em paralaxe. Cada camada rola na proporção
//! (largura_da_camada - largura_da_tela) / (largura_do_cenário - largura_da_tela).

use std::rc::Rc;
use web_sys::HtmlCanvasElement;

use crate::core::consts::*;
use crate::engine::data::{Assets, BgData, Layer};
use crate::gfx::Ctx;

pub struct BgLayer {
    pub l: Layer,
    pub img: Option<HtmlCanvasElement>,
}

pub struct Background {
    pub id: i32,
    pub name: String,
    pub width: f64,
    pub zboundary: [f64; 2],
    pub shadow: Option<HtmlCanvasElement>,
    pub timer: i32,
    pub cam_x: f64,
    pub layers: Vec<BgLayer>,
    pub tone: Option<String>,
    pub vignette: f64,
}

impl Background {
    pub fn new(assets: &Rc<Assets>, d: &BgData) -> Background {
        let mut layers: Vec<BgLayer> = d.layers.iter().enumerate().map(|(i, l)| BgLayer { l: Layer { i, ..l.clone() }, img: assets.img(&l.pic).cloned() }).collect();
        layers.sort_by(|a, b| a.l.width.partial_cmp(&b.l.width).unwrap().then(a.l.i.cmp(&b.l.i)));
        let span = d.width - W;
        for l in &mut layers {
            l.l.ratio = if span > 0.0 { (l.l.width - W) / span } else { 0.0 };
        }
        Background {
            id: d.id,
            name: d.name.clone(),
            width: d.width,
            zboundary: d.zboundary,
            shadow: assets.img(&d.shadow).cloned(),
            timer: 0,
            cam_x: 0.0,
            layers,
            tone: d.tone.clone(),
            vignette: d.vignette,
        }
    }

    /// atualiza a câmera seguindo os personagens (segue a média dos lutadores, adiantada para onde olham)
    pub fn update_camera(&mut self, chars: &[(f64, i32)], bound: Option<(f64, f64)>) {
        let mut avg = 0.0;
        let mut facing = 0.0;
        for (x, d) in chars {
            avg += x;
            facing += *d as f64;
        }
        if !chars.is_empty() {
            avg /= chars.len() as f64;
        }
        let mut lim = (facing * W) / 24.0 + (avg - W / 2.0);
        lim = lim.clamp(0.0, (self.width - W).max(0.0));
        if let Some((mn, mx)) = bound {
            lim = lim.clamp(mn, mx.max(mn));
        }
        let spd = (lim - self.cam_x) * CAMERA_SPEED;
        if spd > -0.05 && spd < 0.05 {
            self.cam_x = lim;
        } else {
            self.cam_x += spd;
        }
        self.timer += 1;
    }

    /// borda de baixo do cenário (abaixo dela a tela ficaria preta)
    pub fn bottom(&self) -> f64 {
        let mut b: f64 = 0.0;
        for l in &self.layers {
            if !l.l.front {
                b = b.max(l.l.y + l.l.height);
            }
        }
        b
    }

    /// front = true desenha só as camadas de primeiro plano (passam na frente dos lutadores)
    pub fn draw(&self, ctx: &Ctx, front: bool) {
        for l in &self.layers {
            if l.l.front != front {
                continue;
            }
            let Some(img) = &l.img else { continue };
            if l.l.alpha < 1.0 {
                ctx.alpha(l.l.alpha);
            }
            let off = -self.cam_x * l.l.ratio;
            let sx = (l.l.x + off).round();
            if !(sx > W || sx + l.l.width < 0.0) {
                ctx.draw_image(img, sx, l.l.y);
            }
            ctx.alpha(1.0);
        }
    }

    pub fn draw_shadow(&self, ctx: &Ctx, x: f64, y: f64, z: f64) {
        let Some(s) = &self.shadow else { return };
        let h = (-y / 220.0).clamp(0.0, 1.0);
        let k = 1.0 - 0.45 * h;
        let w = s.width() as f64 * k;
        let hh = s.height() as f64 * k;
        ctx.alpha(1.0 - 0.5 * h);
        ctx.draw_image_scaled(s, (x - w / 2.0 - self.cam_x).floor(), (z - hh / 2.0).floor(), w, hh);
        ctx.alpha(1.0);
    }

    pub fn pos(&self, rx: f64, rz: f64) -> (f64, f64) {
        (self.width * rx, self.zboundary[0] + (self.zboundary[1] - self.zboundary[0]) * rz)
    }
}
