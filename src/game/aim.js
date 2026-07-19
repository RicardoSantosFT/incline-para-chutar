import { TILT_RANGE_DEG } from './constants.js'

// Converte o ângulo gamma do sensor (graus) em mira normalizada -1..1,
// relativa à posição em que o jogador calibrou o aparelho.
export function gammaToAim(gamma, baseline, range = TILT_RANGE_DEG) {
  const value = (gamma - baseline) / range
  return Math.max(-1, Math.min(1, value))
}

// Suavização exponencial: evita que a mira trema junto com o ruído do sensor.
export function smoothAim(prev, target, alpha) {
  return prev + (target - prev) * alpha
}

// Estabilidade da mira a partir dos deltas recentes: 1 = parada, 0 = sacudindo.
// fullSwing é o delta médio que já conta como instabilidade total.
export function aimStability(recentDeltas, fullSwing = 0.08) {
  if (recentDeltas.length === 0) return 1
  const avg = recentDeltas.reduce((sum, d) => sum + Math.abs(d), 0) / recentDeltas.length
  return Math.max(0, Math.min(1, 1 - avg / fullSwing))
}
