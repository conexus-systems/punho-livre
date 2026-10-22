//! Efeitos visuais de curta duração: faíscas de golpe, sangue, fogo, pedaços de
//! objetos quebrados, poeira e números de dano. Não interagem com nada.

use std::rc::Rc;

use crate::core::consts::*;
use crate::engine::data::ObjData;
use crate::gfx::{display_font, Ctx, SpriteSheet};

pub struct VisualEffect {
    pub dat: Rc<ObjData>,
    pub sheet: Rc<SpriteSheet>,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub vx: f64,
    pub vy: f64,
    pub with_sound: bool,
    pub mass: f64,
    pub dead: bool,
    pub n: i32,
    pub wait: i32,
    pub next: i32,
    pub fresh: bool,
}

impl VisualEffect {
    pub fn tu(&mut self) {
        self.x += self.vx;
        self.y += self.vy;
        if self.y < 0.0 {
            self.vy += self.mass * GRAVITY;
        }
        if self.y > 0.0 {
            self.dead = true;
            return;
        }
        let Some(d) = self.dat.frame(self.n) else {
            self.dead = true;
            return;
        };
        if self.fresh {
            self.fresh = false;
            self.wait = d.wait;
            self.next = d.next;
            if self.with_sound {
                if let Some(s) = d.sound {
                    crate::audio::sound::play(s);
                }
            }
        }
        if self.wait == 0 || d.state == 9998 {
            if self.next == 999 {
                self.next = 0;
            } else if self.next == 1000 || d.state == 9998 {
                self.dead = true;
                return;
            }
            self.n = self.next;
            if self.dat.frame(self.n).is_none() {
                self.dead = true;
                return;
            }
            self.fresh = true;
        } else {
            self.wait -= 1;
        }
    }
    pub fn depth(&self) -> f64 {
        self.z + 1.0
    }
    pub fn draw(&self, ctx: &Ctx, cam_x: f64) {
        if self.dead {
            return;
        }
        let Some(d) = self.dat.frame(self.n) else { return };
        self.sheet.draw(ctx, d.pic, self.x - d.centerx - cam_x, self.y - d.centery + self.z, false);
    }
}

/// poeira e fagulhas simples (só visual, não afetam a partida)
pub struct Puff {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub vx: f64,
    pub vy: f64,
    pub size: f64,
    pub color: String,
    pub life: i32,
    pub max: i32,
    pub dead: bool,
}

impl Puff {
    pub fn tu(&mut self) {
        self.x += self.vx;
        self.y += self.vy;
        self.vx *= 0.92;
        self.vy *= 0.92;
        self.life -= 1;
        if self.life <= 0 {
            self.dead = true;
        }
    }
    pub fn depth(&self) -> f64 {
        self.z + 2.0
    }
    pub fn draw(&self, ctx: &Ctx, cam_x: f64) {
        let t = self.life as f64 / self.max as f64;
        ctx.alpha(t.min(0.7));
        ctx.fill_style(&self.color);
        ctx.circle(self.x - cam_x, self.y + self.z, self.size * (1.6 - t * 0.7));
        ctx.fill();
        ctx.alpha(1.0);
    }
}

/// número de dano ou aviso curto que sobe e some (só visual)
pub struct FloatText {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub text: String,
    pub color: String,
    pub size: f64,
    pub life: i32,
    pub max: i32,
    pub vy: f64,
    pub dead: bool,
}

impl FloatText {
    pub fn new(x: f64, y: f64, z: f64, text: String, color: &str, size: f64) -> FloatText {
        FloatText { x, y, z, text, color: color.into(), size, life: 26, max: 26, vy: -2.2, dead: false }
    }
    pub fn tu(&mut self) {
        self.y += self.vy;
        self.vy *= 0.88;
        self.life -= 1;
        if self.life <= 0 {
            self.dead = true;
        }
    }
    pub fn depth(&self) -> f64 {
        self.z + 3.0
    }
    pub fn draw(&self, ctx: &Ctx, cam_x: f64) {
        let t = self.life as f64 / self.max as f64;
        let pop = if self.max - self.life < 3 { 1.35 } else { 1.0 };
        ctx.save();
        ctx.alpha((t * 2.5).min(1.0));
        ctx.font(&display_font((self.size * pop).round()));
        ctx.text_align(crate::gfx::Align::Center);
        ctx.baseline("middle");
        ctx.line_join("round");
        ctx.line_width(4.0);
        ctx.stroke_style("#120a1e");
        ctx.stroke_text(&self.text, self.x - cam_x, self.y + self.z);
        ctx.fill_style(&self.color);
        ctx.fill_text(&self.text, self.x - cam_x, self.y + self.z);
        ctx.restore();
    }
}

pub enum Fx {
    Visual(VisualEffect),
    Puff(Puff),
    Float(FloatText),
}

impl Fx {
    pub fn tu(&mut self) {
        match self {
            Fx::Visual(e) => e.tu(),
            Fx::Puff(e) => e.tu(),
            Fx::Float(e) => e.tu(),
        }
    }
    pub fn dead(&self) -> bool {
        match self {
            Fx::Visual(e) => e.dead,
            Fx::Puff(e) => e.dead,
            Fx::Float(e) => e.dead,
        }
    }
    pub fn depth(&self) -> f64 {
        match self {
            Fx::Visual(e) => e.depth(),
            Fx::Puff(e) => e.depth(),
            Fx::Float(e) => e.depth(),
        }
    }
    pub fn draw(&self, ctx: &Ctx, cam_x: f64) {
        match self {
            Fx::Visual(e) => e.draw(ctx, cam_x),
            Fx::Puff(e) => e.draw(ctx, cam_x),
            Fx::Float(e) => e.draw(ctx, cam_x),
        }
    }
}
