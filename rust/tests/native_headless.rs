//! O jogo inteiro no app nativo, sem janela: carrega o conteúdo, desenha o título e uma luta
//! num `Canvas` e confere que saiu imagem. Com `PUNHO_SHOTS=pasta` também grava PNGs para olhar.

use punho_livre::game::{self, with_game};
use punho_livre::gfx::{ctx_of, make_canvas, Canvas};
use punho_livre::ui::screens;

fn shot(c: &Canvas, name: &str) {
    if let Ok(dir) = std::env::var("PUNHO_SHOTS") {
        std::fs::create_dir_all(&dir).unwrap();
        c.save_png(&format!("{dir}/{name}.png")).unwrap();
    }
}

fn lit_pixels(c: &Canvas) -> usize {
    c.with_pixels(|d, _, _| d.chunks(4).filter(|p| p[3] > 0 && (p[0] > 20 || p[1] > 20 || p[2] > 20)).count())
}

fn screen() -> String {
    with_game(|g| g.screen.name().to_string()).unwrap_or_default()
}

#[test]
fn loads_draws_and_fights() {
    let canvas = make_canvas(794.0, 470.0);
    game::init(ctx_of(&canvas));
    let mut guard = 0;
    while screen() == "LoadingScreen" {
        game::update();
        guard += 1;
        assert!(guard < 20000, "o carregamento não terminou");
    }
    assert_eq!(screen(), "TitleScreen");
    for _ in 0..40 {
        game::update();
    }
    game::draw();
    shot(&canvas, "title");
    assert!(lit_pixels(&canvas) > 50_000, "a tela de título saiu vazia");

    let json = r#"{"mode":"vs","bg":2,"players":[{"id":1,"team":1,"player":0},{"id":2,"team":2,"ai":2}]}"#;
    with_game(|g| screens::start_match_json(g, json)).unwrap().unwrap();
    for _ in 0..150 {
        game::update();
    }
    game::draw();
    shot(&canvas, "match");
    assert_eq!(screen(), "MatchScreen");
    assert!(lit_pixels(&canvas) > 100_000, "a luta saiu vazia");
    for _ in 0..600 {
        game::update();
        game::draw();
    }
    shot(&canvas, "match-later");
}
