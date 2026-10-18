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
