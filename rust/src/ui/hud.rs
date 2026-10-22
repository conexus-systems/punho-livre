//! Painel de vida/MP, faixas, menu de pausa e resumo da luta, desenhados por código.

use crate::core::consts::*;
use crate::core::input;
use crate::engine::r#match::{Banner, Match};
use crate::gfx::*;

fn slot_color(player: i32, team: i32) -> &'static str {
    if player >= 0 {
        return UI_PLAYERS[(player % 4) as usize];
    }
    if (1..=4).contains(&team) {
        return ["#ff6b5e", "#5aa9ff", "#66d17a", "#ffc94a"][(team - 1) as usize];
    }
    "#8f93b8"
}

/// Painel no topo: até 4 lutadores por linha; com 4 ou menos, uma linha só, maior.
pub fn draw_hud(ctx: &Ctx, m: &Match) {
    let list = &m.panel;
    ctx.fill_style("rgba(5,8,20,0.92)");
    ctx.fill_rect(0.0, 0.0, W, HUD_H);
    if list.is_empty() {
        return;
    }
    let rows = if list.len() > 4 { 2.0 } else { 1.0 };
    let rh = HUD_H / rows;
    let cw = W / 4.0;
    let need = (m.rounds + 1) / 2;
    for (i, slot) in list.iter().take(8).enumerate() {
        let c = &m.objs[slot.ch];
        let h = &c.health;
        let x = (i % 4) as f64 * cw;
        let y = (i / 4) as f64 * rh;
        let pad = 3.0;
        let ph = rh - pad * 2.0;
        ctx.fill_style(UI_PANEL);
        ctx.fill_rect(x + pad, y + pad, cw - pad * 2.0, ph);
        let col = slot_color(c.ch().player, c.team);
        ctx.fill_style(col);
        ctx.fill_rect(x + pad, y + pad, 3.0, ph);
        let pw = (ph * 40.0 / 45.0).round();
        if let Some(small) = m.assets.img(&c.data.bmp.small) {
            ctx.draw_image_scaled(small, x + pad + 6.0, y + pad, pw, ph);
        }
        let bx = x + pad + 10.0 + pw;
        let bw = cw - (bx - x) - pad - 6.0;
        let fs = if rows == 1.0 { 12.0 } else { 10.0 };
        ctx.font(&format!("bold {}px Arial, sans-serif", fs));
        ctx.text_align(Align::Left);
        ctx.baseline("top");
        ctx.fill_style(col);
        ctx.fill_text_max(&slot.name, bx, y + pad + 2.0, Some(bw * 0.45));
        ctx.fill_style(UI_TEXT);
        ctx.text_align(Align::Right);
        ctx.fill_text_max(&c.name, bx + bw, y + pad + 2.0, Some(bw * 0.55));
        // barras: vida (com a parte recuperável mais escura) e MP
        let hy = y + pad + fs + 5.0;
        let hh = if rows == 1.0 { 10.0 } else { 6.0 };
        let my = hy + hh + 3.0;
        let mh = if rows == 1.0 { 6.0 } else { 4.0 };
        let f = |v: f64| v.clamp(0.0, 1.0);
        ctx.fill_style(UI_HP_LOST);
        ctx.fill_rect(bx, hy, bw, hh);
        ctx.fill_style(UI_HP_DARK);
        ctx.fill_rect(bx, hy, bw * f(h.hp_bound / h.hp_full), hh);
        let low = h.hp > 0.0 && h.hp < h.hp_full * 0.2 && (m.time / 8) % 2 == 0;
        ctx.fill_style(if h.hp > 0.0 && c.effect.heal > 0.0 && m.time % 3 == 0 {
            "#ff9a9a"
        } else if low {
            "#ff8a8a"
        } else {
            UI_HP
        });
        ctx.fill_rect(bx, hy, bw * f(h.hp / h.hp_full), hh);
        ctx.fill_style(UI_MP_DARK);
        ctx.fill_rect(bx, my, bw, mh);
        ctx.fill_style(UI_MP);
        ctx.fill_rect(bx, my, bw * f(h.mp / h.mp_full), mh);
        // rounds vencidos pelo time (bolinhas) e combo em andamento
        if rows == 1.0 && m.rounds > 1 {
            let wins = m.wins.iter().find(|w| w.0 == c.team).map(|w| w.1).unwrap_or(0);
            for k in 0..need {
                ctx.fill_style(if k < wins { UI_AMBER } else { "rgba(255,255,255,0.18)" });
                ctx.circle(bx + 4.0 + k as f64 * 11.0, y + pad + ph - 6.0, 3.5);
                ctx.fill();
            }
        }
        if h.hp <= 0.0 {
            ctx.fill_style("rgba(5,8,20,0.6)");
            ctx.fill_rect(x + pad, y + pad, cw - pad * 2.0, ph);
            title(ctx, "K.O.", x + cw / 2.0, y + rh / 2.0, if rows == 1.0 { 26.0 } else { 18.0 }, UI_AMBER, Align::Center);
        }
    }
    // relógio do round
    if let Some(left) = m.time_left() {
        if m.summary.is_none() {
            let txt = format!("{}", left);
            let col = if left <= 10 && left > 0 && (m.time / 6) % 2 == 0 { UI_BAD } else { UI_TEXT };
            ctx.fill_style("rgba(5,8,20,0.7)");
            ctx.fill_rect(W / 2.0 - 30.0, HUD_H, 60.0, 30.0);
            title(ctx, &txt, W / 2.0, HUD_H + 15.0, 24.0, col, Align::Center);
        }
    }
}

pub fn draw_banner(ctx: &Ctx, s: &str, sub: Option<&str>, b: Option<&Banner>) {
    let y = H / 2.0 - 10.0;
    ctx.fill_style("rgba(5,8,20,0.55)");
    ctx.fill_rect(0.0, y - 34.0, W, if sub.is_some() { 84.0 } else { 68.0 });
    let age = b.map(|b| b.total - b.t).unwrap_or(10);
    let scale = if age < 4 { 0.6 + age as f64 * 0.1 } else { 1.0 };
    ctx.save();
    ctx.translate(W / 2.0, y);
    ctx.scale(scale, scale);
    title(ctx, s, 0.0, 0.0, 44.0, UI_AMBER, Align::Center);
    ctx.restore();
    if let Some(sub) = sub {
        text(ctx, sub, W / 2.0, y + 34.0, &TextOpt::default().center().light().size(14.0).color(UI_TEXT));
    }
}

pub fn draw_summary(ctx: &Ctx, m: &Match) {
    let Some(sum) = &m.summary else { return };
    let rows = &sum.rows;
    let cols: [(&str, f64, bool); 8] = [
        ("Lutador", 150.0, true),
        ("Nocautes", 70.0, false),
        ("Ataque", 70.0, false),
        ("Vida perdida", 86.0, false),
        ("MP usado", 76.0, false),
        ("Combo", 56.0, false),
        ("Itens", 50.0, false),
        ("Resultado", 104.0, false),
    ];
    let wsum: f64 = cols.iter().map(|c| c.1).sum::<f64>() + 64.0;
    let rh = 36.0;
    let hgt = 74.0 + rows.len() as f64 * rh + 44.0;
    let x0 = ((W - wsum) / 2.0).round();
    let y0 = ((H - hgt) / 2.0).round().max(HUD_H + 6.0);
    panel_box(ctx, x0, y0, wsum, hgt, Some(UI_AMBER));
    title(ctx, sum.title.as_deref().unwrap_or("Fim da luta"), W / 2.0, y0 + 26.0, 30.0, UI_AMBER, Align::Center);
    let mut x = x0 + 58.0;
    let hy = y0 + 58.0;
    for (n, w, left) in &cols {
        let o = TextOpt::default().size(11.0).color(UI_MUTED);
        text(ctx, n, if *left { x } else { x + w / 2.0 }, hy, &if *left { o } else { o.center() });
        x += w;
    }
    for (i, r) in rows.iter().enumerate() {
        let y = y0 + 70.0 + i as f64 * rh;
        if i % 2 == 0 {
            ctx.fill_style("rgba(255,255,255,0.04)");
            ctx.fill_rect(x0 + 8.0, y, wsum - 16.0, rh);
        }
        if let Some(small) = m.assets.img(&r.small) {
            ctx.draw_image_scaled(small, x0 + 16.0, y + 2.0, 28.0, 32.0);
        }
        let mut cx = x0 + 58.0;
        let vals = [r.name.clone(), r.kill.to_string(), r.attack.to_string(), r.lost.to_string(), r.mp.to_string(), r.combo.to_string(), r.pick.to_string()];
        for (k, v) in vals.iter().enumerate() {
            let (_, w, left) = cols[k];
            let o = TextOpt::default().size(if k == 0 { 13.0 } else { 14.0 }).color(if k == 0 { UI_TEXT } else { "#ffd9a8" }).max(w - 6.0);
            text(ctx, v, if left { cx } else { cx + w / 2.0 }, y + rh / 2.0, &if left { o } else { o.center() });
            cx += w;
        }
        let res = format!("{}{}", if r.win { "Vitória" } else { "Derrota" }, if r.alive { "" } else { " · K.O." });
        text(ctx, &res, cx + cols[7].1 / 2.0, y + rh / 2.0, &TextOpt::default().center().size(13.0).color(if r.win { UI_GOOD } else { UI_BAD }));
    }
    let sec = sum.time.floor() as i64;
    let time = format!("{:02}:{:02}", sec / 60, sec % 60);
    let fy = y0 + hgt - 22.0;
    let right = match &sum.score {
        Some(s) => format!("Rounds {} · Tempo de luta {}", s, time),
        None => format!("Tempo de luta {}", time),
    };
    text(ctx, &right, x0 + wsum - 18.0, fy, &TextOpt::default().right().size(12.0).color(UI_MUTED));
    if !m.net && !m.demo {
        let blink = (m.time / 15) % 2 == 0;
        text(ctx, "Aperte ATAQUE para continuar", x0 + 18.0, fy, &TextOpt::default().size(12.0).color(if blink { UI_TEXT } else { UI_MUTED }));
    }
}

pub fn draw_pause_overlay(ctx: &Ctx, m: &Match) {
    ctx.fill_style("rgba(5,8,20,0.7)");
    ctx.fill_rect(0.0, 0.0, W, H);
    title(ctx, "PAUSA", W / 2.0, 118.0, 56.0, UI_AMBER, Align::Center);
    let items: Vec<String> = m.pause_items().iter().map(|i| i.1.to_string()).collect();
    draw_menu_list(ctx, &items, m.pause_sel, 200.0, 46.0);
}

/// lista de opções com destaque em faixa inclinada
pub fn draw_menu_list(ctx: &Ctx, items: &[String], sel: usize, y0: f64, gap: f64) {
    for (i, it) in items.iter().enumerate() {
        let y = y0 + i as f64 * gap;
        let on = i == sel;
        if on {
            ctx.fill_style(UI_AMBER);
            ctx.poly(&[[W / 2.0 - 150.0, y - 17.0], [W / 2.0 + 160.0, y - 17.0], [W / 2.0 + 150.0, y + 17.0], [W / 2.0 - 160.0, y + 17.0]]);
            ctx.fill();
        }
        ctx.font(&display_font(28.0));
        ctx.text_align(Align::Center);
        ctx.baseline("middle");
        ctx.fill_style(if on { "#120a1e" } else { UI_TEXT });
        ctx.fill_text(it, W / 2.0, y + 1.0);
    }
}

/// treino: lista de golpes do lutador e a dica de como sair
pub fn draw_training_hud(ctx: &Ctx, m: &Match) {
    title(ctx, "TREINO", W / 2.0, HUD_H + 22.0, 26.0, UI_AMBER, Align::Center);
    let Some(me) = m.characters().into_iter().find(|&c| m.objs[c].ch().player >= 0) else { return };
    let id = m.objs[me].id;
    let list = crate::content::roster::fighter_def(id).map(|d| d.specials).unwrap_or_default();
    let h = 20.0 + list.len() as f64 * 18.0;
    ctx.fill_style("rgba(5,8,20,0.6)");
    ctx.fill_rect(8.0, H - h - 8.0, 230.0, h);
    for (i, s) in list.iter().enumerate() {
        text(ctx, crate::ui::select::cmd_label(s.tag), 18.0, H - h + 12.0 + i as f64 * 18.0, &TextOpt::default().size(12.0).color(UI_AMBER));
        text(ctx, s.label, 80.0, H - h + 12.0 + i as f64 * 18.0, &TextOpt::default().size(12.0).color(UI_TEXT));
    }
    let touch = input::with(|i| i.touch_active);
    text(ctx, if touch { "Esc: menu" } else { "Esc: menu de pausa" }, W - 12.0, H - 14.0, &TextOpt::default().right().light().size(11.0).color(UI_MUTED));
}
