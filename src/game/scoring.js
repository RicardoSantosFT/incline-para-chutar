import { MAX_COMBO, TOTAL_ROUNDS } from './constants.js'

export function initialScore(best = 0) {
  return { score: 0, combo: 1, maxCombo: 1, hits: 0, round: 1, best }
}

// Aplica o resultado de uma bola. Os pontos são multiplicados pelo combo
// vigente ANTES do acerto; o combo sobe depois, saturando em MAX_COMBO.
export function applyResult(state, { success, points }) {
  if (!success) return { ...state, combo: 1 }
  const combo = Math.min(state.combo + 1, MAX_COMBO)
  return {
    ...state,
    score: state.score + points * state.combo,
    combo,
    maxCombo: Math.max(state.maxCombo, combo),
    hits: state.hits + 1,
  }
}

export function advanceRound(state) {
  return { ...state, round: state.round + 1 }
}

export function isSessionOver(state, total = TOTAL_ROUNDS) {
  return state.round > total
}

export function finishSession(state) {
  return { ...state, best: Math.max(state.best, state.score) }
}
