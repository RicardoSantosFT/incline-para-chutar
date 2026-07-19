import { TILT_RANGE_X_DEG, TILT_RANGE_Y_DEG, AIM_LIMIT_Y } from './constants.js'

// Converte o ângulo gamma do sensor (graus) em mira horizontal, relativa à
// posição calibrada. `limit` acima de 1 deixa a mira passar da trave
// (modo artilheiro); o padrão 1 satura dentro do gol (modo goleiro).
export function gammaToAim(gamma, baseline, range = TILT_RANGE_X_DEG, limit = 1) {
  const value = (gamma - baseline) / range
  return Math.max(-limit, Math.min(limit, value))
}

// Converte o ângulo beta (inclinar para frente/trás) em altura da mira:
// 0 = rente ao chão, 1 = travessão, acima de 1 = por cima do gol.
export function betaToAimY(beta, baseline, range = TILT_RANGE_Y_DEG) {
  const value = 0.5 + (beta - baseline) / range
  return Math.max(0, Math.min(AIM_LIMIT_Y, value))
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
