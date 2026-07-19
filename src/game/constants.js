// Constantes de gameplay — mira normalizada: -1..1 cobre a largura do gol
export const TILT_RANGE_DEG = 24
export const KEEPER_REACH = 0.3
export const MAX_SPREAD = 0.35
export const PRECISION_THRESHOLD = 0.8
export const PRECISION_BONUS = 25
export const CORNER_BONUS = 50
export const MAX_COMBO = 5
export const TOTAL_ROUNDS = 10
// Peso de mergulho do goleiro adversário por zona (esquerda, centro, direita):
// o centro vale mais pontos, então ele fica lá com mais frequência
export const KEEPER_DIVE_WEIGHTS = [0.3, 0.4, 0.3]
