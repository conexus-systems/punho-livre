//! Constantes do motor: tela, física, quedas, defesa e combos (referência: motor F.LF).

pub const W: f64 = 794.0; // largura da tela do jogo
pub const H: f64 = 470.0; // altura da tela do jogo
pub const HUD_H: f64 = 58.0; // painel de vida compacto no topo
pub const WORLD_Y: f64 = 84.0; // a cena sobe 84px (os cenários começam em y=128)
pub const FPS: i32 = 30; // a lógica roda a 30 quadros (TU) por segundo

pub const GRAVITY: f64 = 1.7;
pub const MIN_SPEED: f64 = 1.0;
pub const HP_FULL: f64 = 500.0;
pub const MP_FULL: f64 = 500.0;
pub const MP_START: f64 = 200.0;
pub const AREST: i32 = 7; // descanso padrão do atacante depois de acertar
pub const ZWIDTH: f64 = 12.0; // largura padrão de um itr no eixo z
pub const HIT_STOP: i32 = 3; // pausa ao acertar alguém
pub const THROW_INJURY: f64 = 10.0;
pub const CPOINT_VACTION: i32 = 135;
pub const FALL_VALUE: f64 = 20.0;
pub const FALL_DVY: f64 = -6.9;
pub const FALL_KO: f64 = 60.0;
pub const RECOVER_FALL: f64 = -0.45;
pub const RECOVER_BDEFEND: f64 = -0.5;
pub const EFFECT_DURATION: i32 = 3;
pub const HEAL_MAX: f64 = 100.0;
pub const DEFEND_FACTOR: f64 = 0.1;
pub const DEFEND_BREAK: f64 = 40.0;
pub const COMBO_TIMEOUT: i32 = 10;
pub const COMBO_GAP: i32 = 20; // teclas mais distantes que isso (em TU) não formam combo
pub const BOUNCE_XY: f64 = 13.4;
pub const BOUNCE_Y_LIMIT: f64 = 11.0;
pub const BOUNCE_Y: f64 = 4.25;
pub const WEAPON_BOUNCE_LIMIT: f64 = 8.0;
pub const WEAPON_BOUNCE_VY: f64 = -3.7;
pub const WEAPON_BOUNCE_VX: f64 = 3.0;
pub const WEAPON_BOUNCE_VZ: f64 = 1.5;
pub const WEAPON_SOFT_BOUNCE_VY: f64 = -2.0;
pub const WEAPON_HIT_VX: f64 = -3.0;
pub const WEAPON_REVERSE_VX: f64 = -0.4;
pub const WEAPON_REVERSE_VY: f64 = -2.0;
pub const WEAPON_REVERSE_VZ: f64 = -0.4;
pub const UNSPECIFIED: f64 = -842150451.0;
pub const DISAPPEAR_SHADOW: i32 = 120;
pub const DISAPPEAR_BODY: i32 = 150;
pub const CAMERA_SPEED: f64 = 1.0 / 18.0;
pub const INTRO: i32 = 45; // TU de "PREPARAR..." antes de cada round (teclas ignoradas)
pub const COMBO_WINDOW: i32 = 40; // TU entre golpes para continuarem contando como um combo
pub const KO_PAUSE: i32 = 60; // TU entre o fim do round e o resumo (ou o próximo round)

// tabelas de consulta: a chave é o limite superior do valor absoluto
pub const BOUNCE_ABSORB: &[(f64, f64)] = &[(9.0, 1.0), (14.0, 4.0), (20.0, 10.0), (40.0, 20.0), (60.0, 30.0)];
pub const DEFEND_ABSORB: &[(f64, f64)] = &[(5.0, 0.0), (15.0, 5.0)];
pub const FALL_WAIT180: &[(f64, f64)] = &[(7.0, 1.0), (9.0, 2.0), (11.0, 3.0), (13.0, 4.0), (15.0, 5.0), (17.0, 6.0)];
pub const FELL_FRICTION: &[(f64, f64)] = &[(2.0, 0.0), (3.0, 1.0), (5.0, 2.0), (6.0, 4.0), (9.0, 5.0), (13.0, 7.0), (25.0, 9.0)];

pub fn lookup_abs(table: &[(f64, f64)], x: f64) -> f64 {
    let x = x.abs();
    for &(k, v) in table {
        if x <= k {
            return v;
        }
    }
    table[table.len() - 1].1
}

/// Gerador pseudoaleatório com semente (para a partida ser reproduzível em todos os aparelhos).
#[derive(Clone, Debug)]
pub struct Random {
    s: u32,
}

impl Random {
    pub fn new(seed: u32) -> Random {
        Random { s: if seed == 0 { 0x9e3779b9 } else { seed } }
    }
    pub fn next(&mut self) -> f64 {
        self.s = self.s.wrapping_add(0x6d2b79f5);
        let mut t = self.s;
        t = (t ^ (t >> 15)).wrapping_mul(t | 1);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
        ((t ^ (t >> 14)) as f64) / 4294967296.0
    }
}

pub const DIFFICULTIES: [&str; 4] = ["Fácil", "Normal", "Difícil", "Maluco!"];
pub const TEAM_LABELS: [&str; 5] = ["Sem time", "Time 1", "Time 2", "Time 3", "Time 4"];
pub const TEAM_COLORS: [&str; 5] = ["#c9cbe8", "#ff6b5e", "#5aa9ff", "#66d17a", "#ffc94a"];
pub const APP_VERSION: &str = "3.0";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn random_is_deterministic_and_in_range() {
        let mut a = Random::new(12345);
        let mut b = Random::new(12345);
        for _ in 0..1000 {
            let (x, y) = (a.next(), b.next());
            assert_eq!(x, y, "a mesma semente dá a mesma sequência em todos os aparelhos");
            assert!((0.0..1.0).contains(&x));
        }
        assert_ne!(Random::new(1).next(), Random::new(2).next());
    }

    #[test]
    fn random_matches_the_reference_sequence() {
        // valores de referência do gerador mulberry32 (o mesmo do jogo em JavaScript)
        let mut r = Random::new(1);
        let first = r.next();
        assert!((first - 0.6270739405881613).abs() < 1e-12, "primeiro valor: {first}");
    }

    #[test]
    fn lookup_uses_the_upper_bound_of_each_bucket() {
        assert_eq!(lookup_abs(BOUNCE_ABSORB, 5.0), 1.0);
        assert_eq!(lookup_abs(BOUNCE_ABSORB, -12.0), 4.0);
        assert_eq!(lookup_abs(BOUNCE_ABSORB, 999.0), 30.0, "passou da tabela: vale o último");
        assert_eq!(lookup_abs(DEFEND_ABSORB, 3.0), 0.0);
    }
}
