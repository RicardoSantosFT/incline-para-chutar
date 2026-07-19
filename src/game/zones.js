// Zonas do gol, como na tela de referência: 50 | 100 | 50.
// Com a mira 2D, bola alta multiplica os pontos (ângulo é mais difícil).
export const ZONES = [
  { id: 'esquerda', from: -1, to: -1 / 3, points: 50 },
  { id: 'centro', from: -1 / 3, to: 1 / 3, points: 100 },
  { id: 'direita', from: 1 / 3, to: 1, points: 50 },
]

export const HIGH_ZONE_Y = 0.6
export const HIGH_MULTIPLIER = 1.5

export function zoneForX(x) {
  const clamped = Math.max(-1, Math.min(1, x))
  if (clamped < -1 / 3) return ZONES[0]
  if (clamped > 1 / 3) return ZONES[2]
  return ZONES[1]
}

export function zoneCenter(id) {
  const zone = ZONES.find((z) => z.id === id)
  return (zone.from + zone.to) / 2
}

export function isOffTarget(x) {
  return Math.abs(x) > 1
}

export function isOffTarget2D(x, y) {
  return Math.abs(x) > 1 || y > 1
}

export function heightMultiplier(y) {
  return y > HIGH_ZONE_Y ? HIGH_MULTIPLIER : 1
}

export function pointsForPlacement(x, y) {
  return Math.round(zoneForX(x).points * heightMultiplier(y))
}
