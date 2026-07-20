// Constantes de gameplay — mira normalizada: x em -1..1 cobre a largura do
// gol, y em 0..1 vai do chão ao travessão. Limites acima de 1 permitem errar.
export const TILT_RANGE_X_DEG = 16
export const TILT_RANGE_Y_DEG = 14
export const AIM_LIMIT_X = 1.35
export const AIM_LIMIT_Y = 1.35

// Alcance elíptico do goleiro (um pouco mais de altura que largura,
// mas baixo o bastante para a mira vertical importar)
export const KEEPER_REACH_X = 0.3
export const KEEPER_REACH_Y = 0.32

export const MAX_SPREAD = 0.35
export const PRECISION_THRESHOLD = 0.8
export const PRECISION_BONUS = 25
export const CAVADINHA_STYLE = 50
export const CORNER_BONUS = 50
export const HIGH_SAVE_BONUS = 25
export const MAX_COMBO = 5
export const TOTAL_ROUNDS = 10
// Peso de mergulho do goleiro adversário por zona (esquerda, centro, direita)
export const KEEPER_DIVE_WEIGHTS = [0.3, 0.4, 0.3]

// Tempos da encenação (segundos) e limites de movimento do goleiro do jogador
export const RUNUP_S = 0.34
export const PARADINHA_RUNUP_S = 1.05
export const WINDUP_S = 1.0
export const OUTCOME_S = 1.35
export const DEFENSE_CHARGE_S = 3.0 // tempo para encher a força do pulo do goleiro
export const SHOT_CLOCK_S = 5 // segundos para bater (e para o goleiro se organizar)
