// Zonas do gol, como na tela de referência: 50 | 100 | 50
export const ZONES = [
  { id: 'esquerda', from: -1, to: -1 / 3, points: 50 },
  { id: 'centro', from: -1 / 3, to: 1 / 3, points: 100 },
  { id: 'direita', from: 1 / 3, to: 1, points: 50 },
]

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
