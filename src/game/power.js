// Carga do chute: segurar o botão enche a força; toque curtinho é cavadinha.
export const CAVADINHA_MS = 180
export const FULL_CHARGE_MS = 1100
export const CAVADINHA_DURATION_S = 0.95

export function isCavadinha(holdMs) {
  return holdMs < CAVADINHA_MS
}

export function powerFromHold(holdMs) {
  const value = (holdMs - CAVADINHA_MS) / (FULL_CHARGE_MS - CAVADINHA_MS)
  return Math.max(0, Math.min(1, value))
}

// Tempo de voo da bola: força máxima chega em 0,42s; fraca flutua 0,78s.
export function flightDuration(power) {
  return 0.78 - 0.36 * power
}

// Quanto mais força, mais difícil colocar: a troca potência × precisão
// existe em toda a faixa (não há um "valor ótimo" gratuito).
export function powerSpread(power) {
  return power * 0.12
}

// Bola fraca dá tempo do goleiro reagir: multiplica o alcance dele.
export function keeperReachMult(power) {
  return 1.25 - 0.45 * power
}
