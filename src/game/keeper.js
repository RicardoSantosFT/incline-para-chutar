import { KEEPER_REACH, CORNER_BONUS } from './constants.js'

// Modo goleiro: o atacante controlado pela máquina chuta, o jogador defende.
const SHOT_MAX_X = 0.92
const BASE_DURATION_S = 0.85
const DURATION_STEP_S = 0.045
const MIN_DURATION_S = 0.42
const CORNER_THRESHOLD = 0.65

export function aiShot({ round, rngValue }) {
  const targetX = (rngValue * 2 - 1) * SHOT_MAX_X
  return { targetX, duration: shotDuration(round) }
}

// Tempo (s) da bola até a linha do gol — encurta a cada rodada.
export function shotDuration(round) {
  return Math.max(MIN_DURATION_S, BASE_DURATION_S - (round - 1) * DURATION_STEP_S)
}

export function resolveSave(keeperX, shotX, reach = KEEPER_REACH) {
  return Math.abs(keeperX - shotX) <= reach
}

export function savePoints({ shotX }) {
  return 100 + (Math.abs(shotX) >= CORNER_THRESHOLD ? CORNER_BONUS : 0)
}
