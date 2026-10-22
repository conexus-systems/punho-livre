//! Logo do Punho Livre, desenhado por código (fonte Bangers, OFL).

use crate::gfx::*;

/// estrela de impacto atrás do nome
pub fn draw_burst(ctx: &Ctx, cx: f64, cy: f64, r: f64, points: usize, color: &str, rot: f64) {
    ctx.begin();
    for i in 0..points * 2 {
        let a = rot + (i as f64 * std::f64::consts::PI) / points as f64;
        let rr = if i % 2 == 1 { r * 0.62 } else { r * (0.9 + 0.1 * (i as f64 * 7.3).sin()) };
        ctx.line_to(cx + a.cos() * rr, cy + a.sin() * rr);
    }
    ctx.close();
    ctx.fill_style(color);
    ctx.fill();
}

pub fn draw_logo(ctx: &Ctx, cx: f64, cy: f64, s: f64, t: f64) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    // linhas de velocidade
    ctx.stroke_style("rgba(255,200,80,0.35)");
    ctx.line_width(3.0);
    for i in 0..14 {
        let y = -70.0 + i as f64 * 11.0;
        let len = 60.0 + ((i * 37) % 70) as f64;
        ctx.line(-250.0 - len, y, -215.0, y);
        ctx.line(215.0, y + 5.0, 250.0 + len, y + 5.0);
    }
    draw_burst(ctx, 0.0, -8.0, 150.0 + (t * 0.08).sin() * 4.0, 13, "#c4281c", t * 0.004);
    draw_burst(ctx, 0.0, -8.0, 122.0, 13, "#f28a1a", -t * 0.003 + 0.2);
    ctx.rotate(-0.06);
    ctx.text_align(Align::Center);
    ctx.baseline("alphabetic");
    ctx.line_join("round");
    ctx.font(&display_font(104.0));
    ctx.line_width(16.0);
    ctx.stroke_style("#120a1e");
    ctx.stroke_text("PUNHO", 0.0, 18.0);
    let g = ctx.linear(0.0, -60.0, 0.0, 18.0, &[(0.0, "#fff3a6"), (0.5, "#ffc21c"), (1.0, "#ff6a00")]);
    ctx.fill_grad(&g);
    ctx.fill_text("PUNHO", 0.0, 18.0);
    ctx.font(&display_font(62.0));
    ctx.line_width(12.0);
    ctx.stroke_style("#120a1e");
    ctx.stroke_text("LIVRE", 34.0, 74.0);
    ctx.fill_style("#ffffff");
    ctx.fill_text("LIVRE", 34.0, 74.0);
    ctx.restore();
}

/// fundo das telas de menu: noite azul-escura com faixas diagonais
pub fn menu_backdrop(ctx: &Ctx, t: f64) {
    let g = ctx.linear(0.0, 0.0, 0.0, H, &[(0.0, "#0b1030"), (1.0, "#1b0f2e")]);
    ctx.fill_grad(&g);
    ctx.fill_rect(0.0, 0.0, W, H);
    ctx.save();
    ctx.alpha(0.06);
    ctx.fill_style("#ffb000");
    for i in -8..20 {
        let x = i as f64 * 70.0 + (t * 0.5) % 70.0;
        ctx.poly(&[[x, 0.0], [x + 30.0, 0.0], [x - 140.0, H], [x - 170.0, H]]);
        ctx.fill();
    }
    ctx.restore();
}

use crate::core::consts::{H, W};
