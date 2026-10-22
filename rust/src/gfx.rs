//! Canvas 2D com uma interface curta: o jogo inteiro é desenhado por código, então
//! quase todo arquivo usa isto. `Ctx` embrulha o contexto do navegador.

use wasm_bindgen::JsCast;
use web_sys::{CanvasGradient, CanvasRenderingContext2d, HtmlCanvasElement};

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

pub fn document() -> web_sys::Document {
    web_sys::window().unwrap().document().unwrap()
}

pub fn make_canvas(w: f64, h: f64) -> HtmlCanvasElement {
    let c: HtmlCanvasElement = document().create_element("canvas").unwrap().dyn_into().unwrap();
    c.set_width(w.ceil().max(1.0) as u32);
    c.set_height(h.ceil().max(1.0) as u32);
    c
}

pub fn ctx_of(c: &HtmlCanvasElement) -> Ctx {
    let ctx: CanvasRenderingContext2d = c.get_context("2d").unwrap().unwrap().dyn_into().unwrap();
    Ctx { c: ctx }
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

#[derive(Clone)]
pub struct Ctx {
    pub c: CanvasRenderingContext2d,
}

#[derive(Clone, Copy, PartialEq)]
pub enum Align {
    Left,
    Center,
    Right,
}

impl Ctx {
    pub fn from(c: CanvasRenderingContext2d) -> Ctx {
        Ctx { c }
    }
    pub fn fill_style(&self, s: &str) {
        self.c.set_fill_style_str(s);
    }
    pub fn fill_grad(&self, g: &CanvasGradient) {
        self.c.set_fill_style_canvas_gradient(g);
    }
    pub fn stroke_style(&self, s: &str) {
        self.c.set_stroke_style_str(s);
    }
    pub fn line_width(&self, w: f64) {
        self.c.set_line_width(w);
    }
    pub fn line_cap(&self, s: &str) {
        self.c.set_line_cap(s);
    }
    pub fn line_join(&self, s: &str) {
        self.c.set_line_join(s);
    }
    pub fn alpha(&self, a: f64) {
        self.c.set_global_alpha(a);
    }
    pub fn composite(&self, op: &str) {
        let _ = self.c.set_global_composite_operation(op);
    }
    pub fn save(&self) {
        self.c.save();
    }
    pub fn restore(&self) {
        self.c.restore();
    }
    pub fn translate(&self, x: f64, y: f64) {
        let _ = self.c.translate(x, y);
    }
    pub fn rotate(&self, a: f64) {
        let _ = self.c.rotate(a);
    }
    pub fn scale(&self, x: f64, y: f64) {
        let _ = self.c.scale(x, y);
    }
    pub fn reset_transform(&self) {
        let _ = self.c.set_transform(1.0, 0.0, 0.0, 1.0, 0.0, 0.0);
    }
    pub fn begin(&self) {
        self.c.begin_path();
    }
    pub fn close(&self) {
        self.c.close_path();
    }
    pub fn move_to(&self, x: f64, y: f64) {
        self.c.move_to(x, y);
    }
    pub fn line_to(&self, x: f64, y: f64) {
        self.c.line_to(x, y);
    }
    pub fn quad_to(&self, cx: f64, cy: f64, x: f64, y: f64) {
        self.c.quadratic_curve_to(cx, cy, x, y);
    }
    pub fn arc(&self, x: f64, y: f64, r: f64, a0: f64, a1: f64) {
        let _ = self.c.arc(x, y, r.max(0.0), a0, a1);
    }
    pub fn arc_dir(&self, x: f64, y: f64, r: f64, a0: f64, a1: f64, ccw: bool) {
        let _ = self.c.arc_with_anticlockwise(x, y, r.max(0.0), a0, a1, ccw);
    }
    pub fn circle(&self, x: f64, y: f64, r: f64) {
        self.begin();
        self.arc(x, y, r, 0.0, std::f64::consts::TAU);
    }
    pub fn ellipse(&self, x: f64, y: f64, rx: f64, ry: f64, rot: f64, a0: f64, a1: f64) {
        let _ = self.c.ellipse(x, y, rx.max(0.0), ry.max(0.0), rot, a0, a1);
    }
    pub fn rect(&self, x: f64, y: f64, w: f64, h: f64) {
        self.c.rect(x, y, w, h);
    }
    pub fn fill(&self) {
        self.c.fill();
    }
    pub fn stroke(&self) {
        self.c.stroke();
    }
    pub fn clip(&self) {
        self.c.clip();
    }
    pub fn fill_rect(&self, x: f64, y: f64, w: f64, h: f64) {
        self.c.fill_rect(x, y, w, h);
    }
    pub fn stroke_rect(&self, x: f64, y: f64, w: f64, h: f64) {
        self.c.stroke_rect(x, y, w, h);
    }
    pub fn clear_rect(&self, x: f64, y: f64, w: f64, h: f64) {
        self.c.clear_rect(x, y, w, h);
    }
    pub fn fill_circle(&self, x: f64, y: f64, r: f64, color: &str) {
        self.fill_style(color);
        self.circle(x, y, r);
        self.fill();
    }
    pub fn line(&self, x0: f64, y0: f64, x1: f64, y1: f64) {
        self.begin();
        self.move_to(x0, y0);
        self.line_to(x1, y1);
        self.stroke();
    }
    pub fn poly(&self, pts: &[P]) {
        self.begin();
        for (i, p) in pts.iter().enumerate() {
            if i == 0 {
                self.move_to(p[0], p[1]);
            } else {
                self.line_to(p[0], p[1]);
            }
        }
        self.close();
    }
    pub fn linear(&self, x0: f64, y0: f64, x1: f64, y1: f64, stops: &[(f64, &str)]) -> CanvasGradient {
        let g = self.c.create_linear_gradient(x0, y0, x1, y1);
        for (t, c) in stops {
            let _ = g.add_color_stop(*t as f32, c);
        }
        g
    }
    pub fn radial(&self, x0: f64, y0: f64, r0: f64, x1: f64, y1: f64, r1: f64, stops: &[(f64, &str)]) -> CanvasGradient {
        let g = self.c.create_radial_gradient(x0, y0, r0.max(0.0), x1, y1, r1.max(0.0)).unwrap();
        for (t, c) in stops {
            let _ = g.add_color_stop(*t as f32, c);
        }
        g
    }
    pub fn shadow(&self, color: &str, blur: f64) {
        self.c.set_shadow_color(color);
        self.c.set_shadow_blur(blur);
    }
    pub fn font(&self, f: &str) {
        self.c.set_font(f);
    }
    pub fn text_align(&self, a: Align) {
        self.c.set_text_align(match a {
            Align::Left => "left",
            Align::Center => "center",
            Align::Right => "right",
        });
    }
    pub fn baseline(&self, b: &str) {
        self.c.set_text_baseline(b);
    }
    pub fn fill_text(&self, s: &str, x: f64, y: f64) {
        let _ = self.c.fill_text(s, x, y);
    }
    pub fn fill_text_max(&self, s: &str, x: f64, y: f64, max: Option<f64>) {
        match max {
            Some(m) => {
                let _ = self.c.fill_text_with_max_width(s, x, y, m);
            }
            None => {
                let _ = self.c.fill_text(s, x, y);
            }
        }
    }
    pub fn stroke_text(&self, s: &str, x: f64, y: f64) {
        let _ = self.c.stroke_text(s, x, y);
    }
    pub fn measure(&self, s: &str) -> f64 {
        self.c.measure_text(s).map(|m| m.width()).unwrap_or(0.0)
    }
    pub fn smoothing(&self, on: bool) {
        self.c.set_image_smoothing_enabled(on);
    }
    pub fn draw_image(&self, img: &HtmlCanvasElement, x: f64, y: f64) {
        let _ = self.c.draw_image_with_html_canvas_element(img, x, y);
    }
    pub fn draw_image_scaled(&self, img: &HtmlCanvasElement, x: f64, y: f64, w: f64, h: f64) {
        let _ = self.c.draw_image_with_html_canvas_element_and_dw_and_dh(img, x, y, w, h);
    }
    #[allow(clippy::too_many_arguments)]
    pub fn draw_image_part(&self, img: &HtmlCanvasElement, sx: f64, sy: f64, sw: f64, sh: f64, dx: f64, dy: f64, dw: f64, dh: f64) {
        let _ = self.c.draw_image_with_html_canvas_element_and_sw_and_sh_and_dx_and_dy_and_dw_and_dh(img, sx, sy, sw, sh, dx, dy, dw, dh);
    }
    pub fn canvas(&self) -> HtmlCanvasElement {
        self.c.canvas().unwrap()
    }
}

/// Folha de sprites de um objeto: cada quadro tem (w+1) x (h+1) pixels.
#[derive(Clone)]
pub struct SheetFile {
    pub img: HtmlCanvasElement,
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
    static TINT: std::cell::RefCell<Option<HtmlCanvasElement>> = const { std::cell::RefCell::new(None) };
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
