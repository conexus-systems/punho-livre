//! Telas de Ajustes, Sobre e Como jogar. Os ajustes são salvos na hora (ver core/save.rs).

use crate::audio::sound;
use crate::core::consts::*;
use crate::core::input::{self, buzz, key_name, Key};
use crate::core::save;
use crate::engine::stage::STAGE_COUNT;
use crate::gfx::*;
use crate::ui::logo::menu_backdrop;
use crate::ui::screens::{back_hit, confirm_hit, nav_horizontal, nav_vertical, ControlsScreen, ModeScreen, Next, Screen};

/// rótulo de botão: texto escuro sobre o destaque amarelo, claro fora dele
fn btn_label(ctx: &Ctx, s: &str, x: f64, y: f64, on: bool) {
    ctx.font(&display_font(20.0));
    ctx.text_align(Align::Center);
    ctx.baseline("middle");
    ctx.fill_style(if on { "#120a1e" } else { UI_TEXT });
    ctx.fill_text(s, x, y + 1.0);
}

pub struct SettingsScreen {
    sel: usize,
    t: i32,
}

struct SItem {
    k: &'static str,
    label: &'static str,
    value: Option<String>,
}

impl Default for SettingsScreen {
    fn default() -> Self {
        Self::new()
    }
}

impl SettingsScreen {
    pub fn new() -> SettingsScreen {
        SettingsScreen { sel: 0, t: 0 }
    }

    fn items(&self) -> Vec<SItem> {
        let s = save::settings();
        let pct = |v: i32| format!("{}%", v * 10);
        let onoff = |v: i32| if v != 0 { "Ligada".to_string() } else { "Desligada".to_string() };
        vec![
            SItem { k: "sfx", label: "Efeitos sonoros", value: Some(pct(s.sfx)) },
            SItem { k: "music", label: "Música", value: Some(pct(s.music)) },
            SItem { k: "difficulty", label: "Dificuldade padrão", value: Some(DIFFICULTIES[s.difficulty as usize].to_string()) },
            SItem { k: "touchScale", label: "Tamanho dos botões do celular", value: Some(pct(s.touch_scale)) },
            SItem { k: "touchOpacity", label: "Opacidade dos botões do celular", value: Some(pct(s.touch_opacity)) },
            SItem { k: "vibrate", label: "Vibração ao apanhar", value: Some(onoff(s.vibrate)) },
            SItem { k: "shake", label: "Tremor de tela nos golpes", value: Some(onoff(s.shake)) },
            SItem { k: "hitNumbers", label: "Números de dano", value: Some(onoff(s.hit_numbers)) },
            SItem { k: "keys", label: "Teclas do teclado", value: None },
            SItem { k: "back", label: "Voltar", value: None },
        ]
    }

    pub fn update(&mut self) -> Option<Next> {
        self.t += 1;
        let items = self.items();
        self.sel = nav_vertical(items.len(), self.sel);
        let k = items[self.sel].k;
        let d = nav_horizontal();
        if d != 0 {
            sound::play("m_pass");
            let clamp = |v: i32, lo: i32, hi: i32| v.clamp(lo, hi);
            save::edit_settings(|s| match k {
                "sfx" => s.sfx = clamp(s.sfx + d, 0, 10),
                "music" => s.music = clamp(s.music + d, 0, 10),
                "touchScale" => s.touch_scale = clamp(s.touch_scale + d, 0, 10),
                "touchOpacity" => s.touch_opacity = clamp(s.touch_opacity + d, 0, 10),
                "difficulty" => s.difficulty = (s.difficulty + d + 4) % 4,
                "vibrate" => s.vibrate = 1 - s.vibrate.min(1),
                "shake" => s.shake = 1 - s.shake.min(1),
                "hitNumbers" => s.hit_numbers = 1 - s.hit_numbers.min(1),
                _ => {}
            });
            if k == "vibrate" && save::settings().vibrate != 0 {
                buzz(40);
            }
            save::save();
            save::apply();
            if k == "sfx" {
                sound::play("hit");
            }
        }
        if back_hit() {
            sound::play("m_cancel");
            return Some(Next::Screen(Screen::title()));
        }
        if confirm_hit() {
            sound::play("m_ok");
            match k {
                "keys" => return Some(Next::Screen(Screen::Controls(ControlsScreen::new(true)))),
                "back" => return Some(Next::Screen(Screen::title())),
                "vibrate" | "shake" | "hitNumbers" => {
                    save::edit_settings(|s| match k {
                        "vibrate" => s.vibrate = 1 - s.vibrate.min(1),
                        "shake" => s.shake = 1 - s.shake.min(1),
                        _ => s.hit_numbers = 1 - s.hit_numbers.min(1),
                    });
                    save::save();
                }
                _ => {}
            }
        }
        None
    }

    pub fn draw(&self, ctx: &Ctx) {
        menu_backdrop(ctx, self.t as f64);
        title(ctx, "AJUSTES", W / 2.0, 34.0, 36.0, UI_AMBER, Align::Center);
        let items = self.items();
        let (w, y0, rh) = (560.0, 72.0, 34.0);
        let x = (W - w) / 2.0;
        panel_box(ctx, x - 14.0, y0 - 18.0, w + 28.0, items.len() as f64 * rh + 10.0, None);
        for (i, it) in items.iter().enumerate() {
            let y = y0 + i as f64 * rh + 8.0;
            let on = i == self.sel;
            if on {
                ctx.fill_style("rgba(255,176,0,0.16)");
                ctx.fill_rect(x - 8.0, y - 15.0, w + 16.0, 30.0);
            }
            match &it.value {
                None => {
                    text(ctx, it.label, x + 8.0, y, &TextOpt::default().size(16.0).color(if on { UI_AMBER } else { UI_TEXT }));
                    if it.k == "keys" {
                        text(ctx, "›", x + w - 8.0, y, &TextOpt::default().right().size(20.0).color(if on { UI_AMBER } else { UI_MUTED }));
                    }
                }
                Some(v) => {
                    text(ctx, it.label, x + 8.0, y, &TextOpt::default().size(15.0).color(if on { UI_TEXT } else { UI_MUTED }));
                    let s = if on { format!("◀  {}  ▶", v) } else { v.clone() };
                    text(ctx, &s, x + w - 8.0, y, &TextOpt::default().right().size(15.0).color(if on { UI_AMBER } else { UI_TEXT }));
                }
            }
        }
        text(ctx, "Os ajustes são salvos automaticamente.", W / 2.0, 458.0, &TextOpt::default().center().light().size(12.0).color(UI_DIM));
    }
}

// ---- Sobre: versão, números do jogador, privacidade e créditos ----

pub struct AboutScreen {
    sel: usize,
    t: i32,
    confirm: bool,
}

impl Default for AboutScreen {
    fn default() -> Self {
        Self::new()
    }
}

impl AboutScreen {
    pub fn new() -> AboutScreen {
        AboutScreen { sel: 0, t: 0, confirm: false }
    }

    pub fn update(&mut self) -> Option<Next> {
        self.t += 1;
        if back_hit() && !self.confirm {
            sound::play("m_cancel");
            return Some(Next::Screen(Screen::title()));
        }
        if self.confirm {
            if input::with(|i| i.any_hit(Key::Left) || i.any_hit(Key::Right) || i.any_hit(Key::Up) || i.any_hit(Key::Down)) {
                self.sel = 1 - self.sel;
            }
            if back_hit() {
                self.confirm = false;
                sound::play("m_cancel");
            } else if confirm_hit() {
                if self.sel == 1 {
                    save::reset_progress();
                    sound::play("m_ok");
                }
                self.confirm = false;
            }
            return None;
        }
        if input::with(|i| i.any_hit(Key::Down) || i.any_hit(Key::Up)) {
            self.sel = 1 - self.sel;
            sound::play("m_pass");
        }
        if confirm_hit() {
            sound::play("m_ok");
            if self.sel == 0 {
                return Some(Next::Screen(Screen::title()));
            }
            self.confirm = true;
            self.sel = 0;
        }
        None
    }

    pub fn draw(&self, ctx: &Ctx) {
        menu_backdrop(ctx, self.t as f64);
        title(ctx, "SOBRE", W / 2.0, 34.0, 36.0, UI_AMBER, Align::Center);
        let p = save::progress();
        let min = p.seconds / 60;
        let lines = [
            (format!("Punho Livre {}", APP_VERSION), 18.0, UI_TEXT),
            ("Lutadores, golpes, cenários, efeitos e sons criados para este jogo.".to_string(), 13.0, UI_MUTED),
            ("Este app não coleta dados pessoais e não tem anúncios.".to_string(), 13.0, UI_MUTED),
            ("No jogo em rede, só o seu apelido e as teclas vão ao servidor escolhido.".to_string(), 13.0, UI_MUTED),
        ];
        for (i, (s, size, color)) in lines.iter().enumerate() {
            let o = TextOpt::default().center().size(*size).color(color);
            text(ctx, s, W / 2.0, 78.0 + i as f64 * 22.0, &if i == 0 { o } else { o.light() });
        }
        panel_box(ctx, 150.0, 176.0, 494.0, 176.0, Some(UI_AMBER));
        title(ctx, "SEU PROGRESSO", W / 2.0, 200.0, 22.0, UI_TEXT, Align::Center);
        let stats = [
            ("Lutas", p.fights.to_string()),
            ("Vitórias", p.wins.to_string()),
            ("Nocautes", p.kos.to_string()),
            ("Tempo de jogo", format!("{} min", min)),
            ("Fase mais avançada", format!("{} de {}", (p.story_best + 1).min(STAGE_COUNT as i32), STAGE_COUNT)),
            ("História concluída", format!("{}×", p.story_clears)),
            ("Recorde na Sobrevivência", format!("{} onda{}", p.survival_best, if p.survival_best == 1 { "" } else { "s" })),
        ];
        for (i, (k, v)) in stats.iter().enumerate() {
            let (col, row) = (i % 2, i / 2);
            let xx = 176.0 + col as f64 * 240.0;
            let yy = 234.0 + row as f64 * 28.0;
            text(ctx, k, xx, yy, &TextOpt::default().size(13.0).color(UI_MUTED));
            text(ctx, v, xx + 220.0 - if col == 1 { 20.0 } else { 0.0 }, yy, &TextOpt::default().right().size(14.0).color(UI_TEXT));
        }
        for (i, o) in ["Voltar", "Apagar progresso"].iter().enumerate() {
            let on = !self.confirm && i == self.sel;
            let y = 384.0 + i as f64 * 38.0;
            if on {
                ctx.fill_style(UI_AMBER);
                ctx.fill_rect(W / 2.0 - 120.0, y - 15.0, 240.0, 30.0);
            }
            btn_label(ctx, o, W / 2.0, y, on);
        }
        if self.confirm {
            ctx.fill_style("rgba(5,8,20,0.82)");
            ctx.fill_rect(0.0, 0.0, W, H);
            panel_box(ctx, 200.0, 150.0, 394.0, 150.0, Some(UI_BAD));
            text(ctx, "Apagar todo o progresso?", W / 2.0, 190.0, &TextOpt::default().center().size(18.0));
            text(ctx, "Lutas, vitórias e fases liberadas voltam a zero.", W / 2.0, 216.0, &TextOpt::default().center().light().size(13.0).color(UI_MUTED));
            for (i, o) in ["Não", "Sim, apagar"].iter().enumerate() {
                let on = i == self.sel;
                let x = W / 2.0 + if i == 1 { 80.0 } else { -80.0 };
                if on {
                    ctx.fill_style(if i == 1 { UI_BAD } else { UI_AMBER });
                    ctx.fill_rect(x - 70.0, 250.0 - 15.0, 140.0, 30.0);
                }
                btn_label(ctx, o, x, 250.0, on);
            }
        }
    }
}

// ---- Como jogar: quatro páginas curtas ----

pub struct HowToScreen {
    page: usize,
    t: i32,
}

impl Default for HowToScreen {
    fn default() -> Self {
        Self::new()
    }
}

impl HowToScreen {
    pub fn new() -> HowToScreen {
        HowToScreen { page: 0, t: 0 }
    }

    fn pages(&self) -> Vec<(&'static str, Vec<(String, String)>)> {
        let k = input::with(|i| i.keys[0].clone());
        let touch = input::with(|i| i.touch_active);
        let r = |a: &str, b: &str| (a.to_string(), b.to_string());
        let controls = if touch {
            vec![
                r("Direcional", "move (8 direções). Levar o dedo até a borda faz correr."),
                r("A", "ataca. Toques seguidos fazem combos."),
                r("J", "pula. Segure uma direção para pular para o lado."),
                r("D", "defende. Com o direcional e A/J faz os golpes especiais."),
                r("Botões laranja", "fazem o golpe especial inteiro com um toque."),
                r("Controle bluetooth", "A ataca, B pula, X defende, Start pausa."),
            ]
        } else {
            vec![
                ("Mover".to_string(), format!("{} {} {} {}. Toque duplo para frente corre.", key_name(&k[0]), key_name(&k[2]), key_name(&k[1]), key_name(&k[3]))),
                ("Ataque".into(), format!("{}. Toques seguidos fazem combos.", key_name(&k[4]))),
                ("Pulo".into(), format!("{}. Segure uma direção para pular para o lado.", key_name(&k[5]))),
                ("Defesa".into(), format!("{}. Com direção e Ataque/Pulo faz especiais.", key_name(&k[6]))),
                r("Pausa", "Esc (ou Start no controle). O menu de pausa tem Reiniciar."),
                r("Controle bluetooth", "A ataca, B pula, X defende, Start pausa."),
            ]
        };
        vec![
            ("Controles", controls),
            (
                "Golpes",
                vec![
                    r("Especiais", "Defesa + direção + Ataque ou Pulo, em sequência rápida. Gastam MP."),
                    r("Correndo", "Ataque durante a corrida dá um golpe longo; Defesa rola para o lado."),
                    r("No ar", "Ataque durante o pulo ou o avanço acerta com um chute."),
                    r("Agarrar", "Ande até um inimigo tonto: soque com Ataque, arremesse com direção + Ataque."),
                    r("Armas", "Ataque perto de uma arma a pega. Bastões batem; pedra e caixa se arremessam."),
                    r("Defender", "Defesa reduz o dano, mas golpes fortes quebram a guarda."),
                ],
            ),
            (
                "Modos",
                vec![
                    r("Versus", "Até 8 lutadores. Escolha luta única ou melhor de 3/5 rounds, e um tempo por round."),
                    r("História", "5 fases com chefes. Cada fase vencida libera a próxima."),
                    r("Sobrevivência", "Ondas sem fim, mais fortes a cada rodada. Seu recorde fica salvo."),
                    r("Treino", "Boneco que não cai, com MP infinito, para aprender os especiais."),
                    r("Rede", "Crie uma sala, passe o código de 4 letras e lute com amigos."),
                    r("Combos", "Emende golpes sem deixar o rival respirar: o contador de HITS aparece."),
                ],
            ),
            (
                "Dicas",
                vec![
                    r("Vida escura", "A parte escura da barra volta aos poucos se você não apanhar mais."),
                    r("MP", "Recupera sozinho e mais rápido quanto mais vida você perdeu."),
                    r("Quedas", "Aperte Pulo no ar ao cair para rolar e se levantar sem apanhar."),
                    r("Times", "No Versus, jogadores do mesmo time não se machucam."),
                    r("Tempo", "Quando o relógio zera, vence quem tiver mais vida."),
                    r("Ajustes", "Tremor de tela e números de dano podem ser desligados em Ajustes."),
                ],
            ),
        ]
    }

    pub fn update(&mut self) -> Option<Next> {
        self.t += 1;
        let n = self.pages().len();
        let (right, att, enter, left) = input::with(|i| (i.any_hit(Key::Right), i.any_hit(Key::Att), i.code("Enter"), i.any_hit(Key::Left)));
        if right || att || enter {
            if self.page < n - 1 {
                self.page += 1;
                sound::play("m_pass");
            } else {
                sound::play("m_ok");
                return Some(Next::Screen(Screen::Mode(ModeScreen { sel: 0, t: 0 })));
            }
        }
        if left {
            self.page = self.page.saturating_sub(1);
            sound::play("m_pass");
        }
        if back_hit() {
            sound::play("m_cancel");
            return Some(Next::Screen(Screen::Mode(ModeScreen { sel: 0, t: 0 })));
        }
        None
    }

    pub fn draw(&self, ctx: &Ctx) {
        menu_backdrop(ctx, self.t as f64);
        let pages = self.pages();
        let (name, rows) = &pages[self.page];
        title(ctx, &format!("COMO JOGAR · {}", name.to_uppercase()), W / 2.0, 36.0, 32.0, UI_AMBER, Align::Center);
        let (x, w) = (70.0, W - 140.0);
        panel_box(ctx, x - 14.0, 70.0, w + 28.0, 330.0, None);
        for (i, (k, v)) in rows.iter().enumerate() {
            let y = 100.0 + i as f64 * 50.0;
            text(ctx, k, x, y, &TextOpt::default().size(15.0).color(UI_AMBER));
            wrap_text(ctx, v, x + 160.0, y - 8.0, w - 170.0, 17.0, &TextOpt::default().light().size(14.0).color(UI_TEXT));
        }
        let n = pages.len();
        for i in 0..n {
            ctx.fill_style(if i == self.page { UI_AMBER } else { UI_DIM });
            ctx.begin();
            ctx.arc(W / 2.0 + (i as f64 - (n as f64 - 1.0) / 2.0) * 20.0, 424.0, 5.0, 0.0, std::f64::consts::TAU);
            ctx.fill();
        }
        text(
            ctx,
            if self.page < n - 1 { "▶ próxima página · Esc volta" } else { "Esc ou ▶ voltam ao menu" },
            W / 2.0,
            450.0,
            &TextOpt::default().center().light().size(12.0).color(UI_MUTED),
        );
    }
}
