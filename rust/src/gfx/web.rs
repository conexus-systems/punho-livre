//! Backend do navegador: `Ctx` embrulha o contexto do Canvas 2D.

use wasm_bindgen::JsCast;
use web_sys::{CanvasGradient, CanvasRenderingContext2d, HtmlCanvasElement};

use super::{Align, P};

pub type Canvas = HtmlCanvasElement;
pub type Gradient = CanvasGradient;

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

#[derive(Clone)]
pub struct Ctx {
    pub c: CanvasRenderingContext2d,
}

impl Ctx {
    pub fn from(c: CanvasRenderingContext2d) -> Ctx {
        Ctx { c }
    }
    pub fn fill_style(&self, s: &str) {
        self.c.set_fill_style_str(s);
    }
    pub fn fill_grad(&self, g: &Gradient) {
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
    pub fn linear(&self, x0: f64, y0: f64, x1: f64, y1: f64, stops: &[(f64, &str)]) -> Gradient {
        let g = self.c.create_linear_gradient(x0, y0, x1, y1);
        for (t, c) in stops {
            let _ = g.add_color_stop(*t as f32, c);
        }
        g
    }
    pub fn radial(&self, x0: f64, y0: f64, r0: f64, x1: f64, y1: f64, r1: f64, stops: &[(f64, &str)]) -> Gradient {
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
    pub fn draw_image(&self, img: &Canvas, x: f64, y: f64) {
        let _ = self.c.draw_image_with_html_canvas_element(img, x, y);
    }
    pub fn draw_image_scaled(&self, img: &Canvas, x: f64, y: f64, w: f64, h: f64) {
        let _ = self.c.draw_image_with_html_canvas_element_and_dw_and_dh(img, x, y, w, h);
    }
    #[allow(clippy::too_many_arguments)]
    pub fn draw_image_part(&self, img: &Canvas, sx: f64, sy: f64, sw: f64, sh: f64, dx: f64, dy: f64, dw: f64, dh: f64) {
        let _ = self.c.draw_image_with_html_canvas_element_and_sw_and_sh_and_dx_and_dy_and_dw_and_dh(img, sx, sy, sw, sh, dx, dy, dw, dh);
    }
    pub fn canvas(&self) -> Canvas {
        self.c.canvas().unwrap()
    }
}
