//! Desenho 2D com uma interface curta: o jogo inteiro é desenhado por código, então
//! quase todo arquivo usa isto. `Ctx` tem um backend para o navegador (Canvas 2D) e outro
//! nativo (tiny-skia); o resto do jogo não sabe a diferença.

#[cfg(not(target_arch = "wasm32"))]
mod native;
#[cfg(target_arch = "wasm32")]
mod web;

#[cfg(not(target_arch = "wasm32"))]
pub use native::*;
#[cfg(target_arch = "wasm32")]
pub use web::*;

pub type P = [f64; 2];

pub fn rad(d: f64) -> f64 {
    d * std::f64::consts::PI / 180.0
}
/// ângulos em graus: 0 aponta para baixo, 90 para a frente, 180 para cima
pub fn vec(a: f64) -> P {
    [rad(a).sin(), rad(a).cos()]
}
pub fn along(p: P, a: f64, len: f64) -> P {
    let v = vec(a);
    [p[0] + v[0] * len, p[1] + v[1] * len]
}
pub fn sub(a: P, b: P) -> P {
    [a[0] - b[0], a[1] - b[1]]
}
pub fn hypot(x: f64, y: f64) -> f64 {
    (x * x + y * y).sqrt()
}

/// `#rrggbb` clareado (f > 1) ou escurecido (f < 1)
pub fn shade(hex: &str, f: f64) -> String {
    let n = u32::from_str_radix(&hex[1..], 16).unwrap_or(0);
    let ch = |v: u32| -> u32 {
        let v = v as f64;
        let r = if f >= 1.0 { v + (255.0 - v) * (f - 1.0) } else { v * f };
        r.round().clamp(0.0, 255.0) as u32
    };
    format!("rgb({},{},{})", ch(n >> 16), ch((n >> 8) & 255), ch(n & 255))
}

pub fn rgba(hex: &str, a: f64) -> String {
    let n = u32::from_str_radix(&hex[1..], 16).unwrap_or(0);
    format!("rgba({},{},{},{})", n >> 16, (n >> 8) & 255, n & 255, a)
}

#[derive(Clone, Copy, PartialEq)]
pub enum Align {
    Left,
    Center,
    Right,
}

/// Folha de sprites de um objeto: cada quadro tem (w+1) x (h+1) pixels.
#[derive(Clone)]
pub struct SheetFile {
    pub img: Canvas,
    pub w: f64,
    pub h: f64,
    pub cols: usize,
    pub count: usize,
}

#[derive(Clone)]
pub struct SpriteSheet {
    pub files: Vec<SheetFile>,
    pub w: f64,
    pub h: f64,
}

thread_local! {
    static TINT: std::cell::RefCell<Option<Canvas>> = const { std::cell::RefCell::new(None) };
}

impl SpriteSheet {
    /// desenha o quadro `pic` com o canto superior esquerdo em (x, y)
    pub fn draw(&self, ctx: &Ctx, pic: usize, x: f64, y: f64, flip: bool) {
        let mut i = pic;
        let mut f = None;
        for file in &self.files {
            if i < file.count {
                f = Some(file);
                break;
            }
            i -= file.count;
        }
        let Some(f) = f else { return };
        // cada célula tem uma linha separadora de 1px à direita e embaixo, que não é desenhada
        let cw = f.w + 1.0;
        let ch = f.h + 1.0;
        let sx = (i % f.cols) as f64 * cw;
        let sy = (i / f.cols) as f64 * ch;
        let x = x.round();
        let y = y.round();
        if flip {
            ctx.save();
            ctx.translate(x + cw, y);
            ctx.scale(-1.0, 1.0);
            ctx.draw_image_part(&f.img, sx, sy, f.w, f.h, 0.0, 0.0, f.w, f.h);
            ctx.restore();
        } else {
            ctx.draw_image_part(&f.img, sx, sy, f.w, f.h, x, y, f.w, f.h);
        }
    }

    /// desenha o quadro tingido de uma cor (clarão de golpe): a cor só cobre os pixels do sprite
    pub fn draw_tinted(&self, ctx: &Ctx, pic: usize, x: f64, y: f64, flip: bool, color: &str, alpha: f64) {
        let scratch = TINT.with(|t| {
            let mut t = t.borrow_mut();
            if t.is_none() {
                *t = Some(make_canvas(160.0, 160.0));
            }
            t.as_ref().unwrap().clone()
        });
        let g = ctx_of(&scratch);
        g.clear_rect(0.0, 0.0, 160.0, 160.0);
        g.composite("source-over");
        self.draw(&g, pic, 0.0, 0.0, flip);
        g.composite("source-atop");
        g.alpha(alpha);
        g.fill_style(color);
        g.fill_rect(0.0, 0.0, 160.0, 160.0);
        g.alpha(1.0);
        g.composite("source-over");
        ctx.draw_image(&scratch, x.round(), y.round());
    }
}

pub const LOGO_FONT: &str = "\"Bangers\", Impact, \"Arial Black\", sans-serif";

pub fn display_font(size: f64) -> String {
    format!("{}px {}", size, LOGO_FONT)
}

/// Opções do texto comum dos menus (Arial)
#[derive(Clone)]
pub struct TextOpt {
    pub size: f64,
    pub bold: bool,
    pub color: String,
    pub align: Align,
    pub base: &'static str,
    pub shadow: Option<String>,
    pub max: Option<f64>,
}

impl Default for TextOpt {
    fn default() -> Self {
        TextOpt { size: 13.0, bold: true, color: "#fff".into(), align: Align::Left, base: "middle", shadow: None, max: None }
    }
}

impl TextOpt {
    pub fn size(mut self, s: f64) -> Self {
        self.size = s;
        self
    }
    pub fn light(mut self) -> Self {
        self.bold = false;
        self
    }
    pub fn color(mut self, c: &str) -> Self {
        self.color = c.into();
        self
    }
    pub fn center(mut self) -> Self {
        self.align = Align::Center;
        self
    }
    pub fn right(mut self) -> Self {
        self.align = Align::Right;
        self
    }
    pub fn shadow(mut self, c: &str) -> Self {
        self.shadow = Some(c.into());
        self
    }
    pub fn max(mut self, m: f64) -> Self {
        self.max = Some(m);
        self
    }
    pub fn base(mut self, b: &'static str) -> Self {
        self.base = b;
        self
    }
}

pub fn text(ctx: &Ctx, s: &str, x: f64, y: f64, o: &TextOpt) {
    ctx.font(&format!("{}{}px Arial, Helvetica, sans-serif", if o.bold { "bold " } else { "" }, o.size));
    ctx.text_align(o.align);
    ctx.baseline(o.base);
    if let Some(sh) = &o.shadow {
        ctx.fill_style(sh);
        ctx.fill_text_max(s, x + 1.0, y + 1.0, o.max);
    }
    ctx.fill_style(&o.color);
    ctx.fill_text_max(s, x, y, o.max);
}

/// texto quebrado em linhas de até `w` px
pub fn wrap_text(ctx: &Ctx, s: &str, x: f64, y: f64, w: f64, lh: f64, o: &TextOpt) {
    ctx.font(&format!("{}{}px Arial, Helvetica, sans-serif", if o.bold { "bold " } else { "" }, o.size));
    let mut line = String::new();
    let mut yy = y;
    for word in s.split(' ') {
        let t = if line.is_empty() { word.to_string() } else { format!("{} {}", line, word) };
        if ctx.measure(&t) > w && !line.is_empty() {
            text(ctx, &line, x, yy, o);
            line = word.to_string();
            yy += lh;
        } else {
            line = t;
        }
    }
    if !line.is_empty() {
        text(ctx, &line, x, yy, o);
    }
}

/// título na fonte do logo, com contorno escuro
pub fn title(ctx: &Ctx, s: &str, x: f64, y: f64, size: f64, color: &str, align: Align) {
    ctx.font(&display_font(size));
    ctx.text_align(align);
    ctx.baseline("middle");
    ctx.line_join("round");
    ctx.line_width((size / 7.0).max(3.0));
    ctx.stroke_style("#120a1e");
    ctx.stroke_text(s, x, y);
    ctx.fill_style(color);
    ctx.fill_text(s, x, y);
}

pub fn panel_box(ctx: &Ctx, x: f64, y: f64, w: f64, h: f64, accent: Option<&str>) {
    ctx.fill_style("rgba(13,18,46,0.94)");
    ctx.fill_rect(x, y, w, h);
    ctx.stroke_style(UI_LINE);
    ctx.line_width(1.0);
    ctx.stroke_rect(x + 0.5, y + 0.5, w - 1.0, h - 1.0);
    if let Some(a) = accent {
        ctx.fill_style(a);
        ctx.fill_rect(x, y, w, 3.0);
    }
}

pub const UI_INK: &str = "#0b1030";
pub const UI_PANEL: &str = "#141a3d";
pub const UI_PANEL2: &str = "#1c2452";
pub const UI_LINE: &str = "rgba(233,235,255,0.18)";
pub const UI_TEXT: &str = "#e9ebff";
pub const UI_MUTED: &str = "#9aa3d8";
pub const UI_DIM: &str = "#5b5f86";
pub const UI_AMBER: &str = "#ffb000";
pub const UI_HP: &str = "#e8414a";
pub const UI_HP_DARK: &str = "#5c1420";
pub const UI_HP_LOST: &str = "#2a0b12";
pub const UI_MP: &str = "#3e8ef0";
pub const UI_MP_DARK: &str = "#122452";
pub const UI_GOOD: &str = "#66d17a";
pub const UI_BAD: &str = "#ff6b5e";
pub const UI_PLAYERS: [&str; 4] = ["#ff5a4e", "#4fb0ff", "#66d17a", "#ffc94a"];
