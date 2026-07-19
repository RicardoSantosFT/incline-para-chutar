import { zoneForX, zoneCenter, isOffTarget, ZONES } from './zones.js'
import {
  KEEPER_REACH,
  MAX_SPREAD,
  PRECISION_BONUS,
  PRECISION_THRESHOLD,
  KEEPER_DIVE_WEIGHTS,
} from './constants.js'

// Quanto menos estável a mira no momento do chute, maior o desvio possível.
export function shotDispersion(stability, maxSpread = MAX_SPREAD) {
  return (1 - stability) * maxSpread
}

// Resolve um chute do modo artilheiro. rngValue em 0..1 decide o desvio.
export function resolveShot({ aimX, stability, keeperX, rngValue }) {
  const spread = shotDispersion(stability)
  const shotX = aimX + (rngValue * 2 - 1) * spread
  const offTarget = isOffTarget(shotX)
  const zone = offTarget ? null : zoneForX(shotX)
  const saved = !offTarget && Math.abs(shotX - keeperX) <= KEEPER_REACH
  const precise = stability >= PRECISION_THRESHOLD
  const points = offTarget || saved ? 0 : zone.points + (precise ? PRECISION_BONUS : 0)
  return { shotX, zone, saved, offTarget, precise, points }
}

// Mergulho do goleiro adversário: sorteia uma zona pelos pesos configurados.
export function keeperDive({ rngValue }) {
  let cumulative = 0
  for (let i = 0; i < ZONES.length; i++) {
    cumulative += KEEPER_DIVE_WEIGHTS[i]
    if (rngValue < cumulative || i === ZONES.length - 1) {
      const zoneId = ZONES[i].id
      return { zoneId, keeperX: zoneCenter(zoneId) }
    }
  }
}
