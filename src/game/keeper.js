import { KEEPER_REACH_X, KEEPER_REACH_Y, CORNER_BONUS, HIGH_SAVE_BONUS } from './constants.js'

// Modo goleiro: o atacante controlado pela máquina chuta, o jogador defende.
const SHOT_MAX_X = 0.92
const BASE_DURATION_S = 0.85
const DURATION_STEP_S = 0.045
const MIN_DURATION_S = 0.42
const CORNER_THRESHOLD = 0.65
const DIVE_WINDOW_S = 0.38
const DIVE_BOOST = 0.65
const GROUNDED_MULT = 0.45
// Sem impulso o goleiro não cobre o gol só rastreando a bola: o botão importa
const NO_DIVE_MULT = 0.55

// Chute 2D do rival. nerveMiss é a chance extra de errar acumulada pelas
// provocações do goleiro (chacoalhar o celular durante a corrida).
export function aiShot2D({ round, rngX, rngY, nerveMiss = 0, rngMiss = 1 }) {
  const duration = shotDuration(round)
  if (rngMiss < nerveMiss) {
    // Nervoso: isola por cima ou manda na lateral
    const dir = rngX < 0.5 ? -1 : 1
    return rngY < 0.5
      ? { x: dir * 1.12, y: 0.4, duration, nervous: true }
      : { x: dir * 0.6, y: 1.15, duration, nervous: true }
  }
  return {
    x: (rngX * 2 - 1) * SHOT_MAX_X,
    y: 0.12 + rngY * 0.8,
    duration,
    nervous: false,
  }
}

// Tempo (s) da bola até a linha do gol — encurta a cada rodada.
export function shotDuration(round) {
  return Math.max(MIN_DURATION_S, BASE_DURATION_S - (round - 1) * DURATION_STEP_S)
}

// Defesa com alcance elíptico; reachMult vem do impulso do mergulho.
export function resolveSave2D(keeper, shot, reachMult = 1) {
  const rx = KEEPER_REACH_X * reachMult
  const ry = KEEPER_REACH_Y * reachMult
  const dx = keeper.x - shot.x
  const dy = keeper.y - shot.y
  return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1
}

// Impulso do botão DEFENDER: soltar no tempo certo amplia o alcance;
// soltar cedo demais deixa o goleiro caído quando a bola chega;
// nunca apertar deixa o alcance reduzido (rastrear não basta).
export function diveReachMult({ released, power, elapsed, window = DIVE_WINDOW_S }) {
  if (!released) return NO_DIVE_MULT
  return elapsed <= window ? 1 + DIVE_BOOST * power : GROUNDED_MULT
}

export function savePoints2D({ x, y }) {
  return 100 + (Math.abs(x) >= CORNER_THRESHOLD ? CORNER_BONUS : 0) + (y >= 0.6 ? HIGH_SAVE_BONUS : 0)
}
