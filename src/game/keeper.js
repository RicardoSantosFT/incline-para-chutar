import { KEEPER_REACH_X, KEEPER_REACH_Y, CORNER_BONUS, HIGH_SAVE_BONUS } from './constants.js'

// Modo goleiro: o rival chuta; o jogador MIRA um alvo (como o batedor),
// segura o botão e voa para o alvo no instante em que solta. A física do
// mergulho (tempo de voo) contra a velocidade da bola decide a defesa.

const SHOT_MAX_X = 0.92
// Bola rápida o bastante para a leitura pré-chute (e a finta) importarem
const BASE_DURATION_S = 0.68
const DURATION_STEP_S = 0.035
const MIN_DURATION_S = 0.42
const MIN_AI_DURATION_S = 0.36
const CORNER_THRESHOLD = 0.65

// Física do mergulho
export const DIVE_START = { x: 0, y: 0.35 } // goleiro parado no centro
const DIVE_MIN_TIME_S = 0.12
const DIVE_TIME_PER_DIST_S = 0.3
export const STRETCH_WINDOW_S = 0.25 // janela "esticado" após completar o voo
const MIN_STRETCH_DIST = 0.3 // esticado exige voo de verdade (sem farmar parado)
const STANDING_MULT = 0.55
const DIVING_MULT = 1.0
export const STRETCHED_MULT = 1.15
const GROUNDED_MULT = 0.45

// Chute 2D do rival. nerveMiss é a chance extra de errar acumulada pelas
// provocações; rngPower define a força (forte = mais rápido, mais difícil).
export function aiShot2D({ round, rngX, rngY, nerveMiss = 0, rngMiss = 1, rngPower = 0.6 }) {
  const duration = Math.max(MIN_AI_DURATION_S, shotDuration(round) * (1.3 - rngPower * 0.5))
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

// Plano da cobrança do rival: com o passar das rodadas ele aprende a dar
// paradinha para fazer o goleiro pular antes da hora.
export const AI_FEINT_PAUSE_S = 0.55
export function aiKickPlan({ round, rngValue, baseWindup = 1.0 }) {
  const chance = Math.min(0.45, 0.15 + round * 0.03)
  const feint = rngValue < chance
  return { feint, windup: baseWindup + (feint ? AI_FEINT_PAUSE_S : 0) }
}

// Tempo que o goleiro leva voando do centro até o ponto de mergulho.
export function diveTravelTime(distance) {
  return DIVE_MIN_TIME_S + distance * DIVE_TIME_PER_DIST_S
}

// Bola fraca dá tempo de encaixar; bolão exige estar em cima.
export function catchSpeedMult(shotDurationS) {
  return Math.max(0.75, Math.min(1.15, 0.75 + (shotDurationS - 0.42) * 0.9))
}

// Onde o goleiro está (e em que fase) quando a bola cruza a linha.
// releaseLead = segundos entre soltar o botão e a bola cruzar.
function keeperStateAtCross({ released, releaseLead, target }) {
  if (!released || releaseLead <= 0) {
    return { pos: { ...DIVE_START }, phase: 'standing', mult: STANDING_MULT }
  }
  const dist = Math.hypot(target.x - DIVE_START.x, target.y - DIVE_START.y)
  const diveTime = diveTravelTime(dist)
  if (releaseLead <= diveTime) {
    const f = releaseLead / diveTime
    return {
      pos: {
        x: DIVE_START.x + (target.x - DIVE_START.x) * f,
        y: DIVE_START.y + (target.y - DIVE_START.y) * f,
      },
      phase: 'diving',
      mult: DIVING_MULT,
    }
  }
  if (releaseLead <= diveTime + STRETCH_WINDOW_S) {
    const stretched = dist >= MIN_STRETCH_DIST
    return { pos: { ...target }, phase: stretched ? 'stretched' : 'diving', mult: stretched ? STRETCHED_MULT : DIVING_MULT }
  }
  return { pos: { ...target }, phase: 'grounded', mult: GROUNDED_MULT }
}

// Resolve a defesa: posição do goleiro no cruzamento × alcance elíptico
// escalado pela fase do mergulho e pela velocidade da bola.
export function resolveKeeperDefense({ released, releaseLead = 0, target = DIVE_START, shot, shotDuration: durationS }) {
  const state = keeperStateAtCross({ released, releaseLead, target })
  const speedMult = catchSpeedMult(durationS)
  const rx = KEEPER_REACH_X * state.mult * speedMult
  const ry = KEEPER_REACH_Y * state.mult * speedMult
  const offTarget = Math.abs(shot.x) > 1 || shot.y > 1
  const dx = state.pos.x - shot.x
  const dy = state.pos.y - shot.y
  const saved = !offTarget && (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1
  return { saved, phase: state.phase, keeperAt: state.pos, rx, ry }
}

export function savePoints2D({ x, y }) {
  return 100 + (Math.abs(x) >= CORNER_THRESHOLD ? CORNER_BONUS : 0) + (y >= 0.6 ? HIGH_SAVE_BONUS : 0)
}
