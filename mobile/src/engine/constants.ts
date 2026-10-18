/** Coordenadas no espaço "localcoord 320x240" do MUGEN. Chão em y = 0, para cima é negativo. */
export const SCREEN_W = 320;
export const SCREEN_H = 240;
/** Altura do chão na tela (y de tela onde fica y = 0 do mundo). */
export const GROUND_Y = 200;
export const STAGE_LEFT = -380;
export const STAGE_RIGHT = 380;
/** Distância mínima do lutador até a borda da câmera. */
export const SCREEN_MARGIN = 15;
export const START_X = 70;
export const FPS = 60;
export const INTRO_FRAMES = 100;
export const KO_FRAMES = 120;
export const OVER_FRAMES = 150;
export const POWER_PER_LEVEL = 1000;

// ------------------------------------------------------- sistema SNK
/** Duração do modo MAX (A+B+C, custa 1 estoque). */
export const MAX_TICKS = 600;
/** Medidor de defesa cheio; cada golpe defendido gasta um pouco. */
export const GUARD_MAX = 120;
/** Ticks sem defender até o medidor voltar a encher. */
export const GUARD_REGEN_DELAY = 50;
/** Janela do Just Defend: apertar para trás até N frames antes do golpe. */
export const JUST_DEFEND_WINDOW = 8;
/** Janela para apertar os botões juntos (A+B, C+D, A+B+C). */
export const CHORD_WINDOW = 3;
/** Distância máxima (corpo a corpo) para arremessar. */
export const THROW_RANGE = 14;
/** Frames do arremesso até o dano; antes disso dá para escapar com C ou D. */
export const THROW_HIT_FRAME = 12;
export const THROW_TECH_WINDOW = 10;
/** Frames da câmera lenta depois de um K.O. */
export const KO_SLOWMO_FRAMES = 48;

// ---------------------------------------------------- impacto (hitstop)
/**
 * Nível do golpe, usado no hitstop e nos efeitos: fraco, médio, forte,
 * especial e super. Vem do `animtype` (light/medium/hard) e do `attr`
 * (SA/ST/SP = especial, HA/HT/HP = super) do HitDef.
 */
export const HitLevel = { LIGHT: 0, MEDIUM: 1, HEAVY: 2, SPECIAL: 3, SUPER: 4 } as const;
/**
 * Hitstop por nível [atacante, defensor] quando o HitDef não traz `pausetime`
 * (pausetime explícito, inclusive 0, é sempre respeitado). Valores iguais nos
 * dois lados: o congelamento não muda a vantagem de frames do golpe.
 */
export const HITSTOP_BY_LEVEL: readonly (readonly [number, number])[] = [
  [8, 8],
  [11, 11],
  [14, 14],
  [15, 15],
  [17, 17],
];
/** Defesa congela menos que acerto: fração do hitstop quando não há `guard.pausetime`. */
export const GUARD_HITSTOP_RATIO = 0.6;
/** Piso do hitstop na defesa (o impacto ainda precisa ser sentido). */
export const GUARD_HITSTOP_MIN = 4;
/** Contra-ataque congela mais (nos dois lados, para não mudar a vantagem). */
export const COUNTER_HITSTOP_BONUS = 5;
/**
 * Golpe que dá o K.O.: congelamento mínimo dos dois. Ele corre dentro da
 * câmera lenta do K.O. (1 quadro a cada 3), então 10 ≈ meio segundo parado.
 */
export const KO_HITSTOP_FRAMES = 10;
/** Guard crush: o defensor fica congelado pelo menos isso. */
export const GUARD_CRUSH_HITSTOP = 16;
/** Teto do hitstop do defensor no Just Defend. */
export const JUST_DEFEND_HITSTOP_MAX = 6;
/** Hitstop do arremesso (SNK) nos dois lados. */
export const THROW_HITSTOP = 8;

// ------------------------------------------------- leniência de entrada
/**
 * Buffer de entrada dos especiais e supers (quadros): o comando continua
 * valendo por esse tempo depois de completo, como nos jogos atuais. Enquanto o
 * lutador está congelado (hitstop, superpause) o buffer não envelhece.
 */
export const INPUT_BUFFER_FRAMES = 5;
/** Prioridade dos comandos quando vários casam juntos: super > especial > normal. */
export const CommandTier = { NORMAL: 0, SPECIAL: 1, SUPER: 2 } as const;
