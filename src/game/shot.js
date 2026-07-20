import { zoneCenter, zoneIdForPlacement, pointsForPlacement, ZONES } from './zones.js'
import {
  KEEPER_REACH_X,
  KEEPER_REACH_Y,
  MAX_SPREAD,
  PRECISION_BONUS,
  PRECISION_THRESHOLD,
  CAVADINHA_STYLE,
  KEEPER_DIVE_WEIGHTS,
} from './constants.js'
import { powerSpread, keeperReachMult } from './power.js'

// Quanto menos estável a mira no momento do chute, maior o desvio possível.
export function shotDispersion(stability, maxSpread = MAX_SPREAD) {
  return (1 - stability) * maxSpread
}

const insideEllipse = (dx, dy, rx, ry) => (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1

// Onde a bola vai parar: mira + dispersão (estabilidade, força, especial).
// Separado da defesa para o duelo online (o batedor calcula a colocação,
// o goleiro remoto resolve a defesa).
export function computeShotPlacement({ aim, stability, power = 0.6, cavadinha = false, special = null, rngSpreadX, rngSpreadY }) {
  const spread = shotDispersion(stability) + powerSpread(power) + (special?.spread ?? 0)
  const shotX = aim.x + (rngSpreadX * 2 - 1) * spread
  let shotY = aim.y + (rngSpreadY * 2 - 1) * spread * 0.8
  // Cavadinha: bola lenta que morre no meio-alto do gol
  if (cavadinha) shotY = Math.max(0.5, Math.min(0.75, aim.y))
  shotY = Math.max(0.02, shotY)
  const overBar = shotY > 1
  const offTarget = Math.abs(shotX) > 1 || overBar
  return { shot: { x: shotX, y: shotY }, offTarget, overBar }
}

// Resolve um chute 2D do modo artilheiro.
// aim: {x, y} mira final · keeper: {x, y} posição do mergulho rival
// cavadinha: toque curtinho · special: golpe armado no chacoalhão
// keeperCommitted: goleiro comprou a paradinha e já está no chão
export function resolveShot2D({
  aim,
  stability,
  power = 0.6,
  cavadinha = false,
  special = null,
  keeper,
  keeperCommitted = false,
  rngSpreadX,
  rngSpreadY,
}) {
  const placement = computeShotPlacement({ aim, stability, power, cavadinha, special, rngSpreadX, rngSpreadY })
  const shotX = placement.shot.x
  const shotY = placement.shot.y
  const { overBar, offTarget } = placement

  // Comprometido: usa o MENOR fator uma vez só (nada de 0,55 × 0,55).
  // Não comprometido: paradinha lida vira vantagem do goleiro (reachMultRead).
  const specialMult = keeperCommitted
    ? Math.min(special?.reachMult ?? 1, 0.55)
    : (special?.reachMultRead ?? special?.reachMult ?? 1)
  let rx = KEEPER_REACH_X * specialMult
  let ry = KEEPER_REACH_Y * specialMult
  if (cavadinha) {
    // Lenta: goleiro perto pega fácil; goleiro que pulou não volta
    rx *= 1.5
    ry *= 1.6
  } else {
    const mult = keeperReachMult(power)
    rx *= mult
    ry *= mult
  }

  const saved = !offTarget && insideEllipse(shotX - keeper.x, shotY - keeper.y, rx, ry)
  const precise = stability >= PRECISION_THRESHOLD
  const zoneId = offTarget ? null : zoneIdForPlacement(shotX, shotY)
  const base = offTarget || saved ? 0 : pointsForPlacement(shotX, shotY)
  const points =
    base === 0 ? 0 : base + (precise ? PRECISION_BONUS : 0) + (special?.style ?? 0) + (cavadinha ? CAVADINHA_STYLE : 0)

  return { shot: { x: shotX, y: shotY }, zoneId, saved, offTarget, overBar, precise, points }
}

// Mergulho 2D do goleiro rival: zona pelos pesos + altura baixa ou alta.
// rngX espalha o mergulho dentro da zona (até o pé da trave), para que
// nenhum ponto do gol seja matematicamente indefensável.
export function keeperDive2D({ rngZone, rngHeight, rngX = 0.5 }) {
  let cumulative = 0
  for (let i = 0; i < ZONES.length; i++) {
    cumulative += KEEPER_DIVE_WEIGHTS[i]
    if (rngZone < cumulative || i === ZONES.length - 1) {
      const zoneId = ZONES[i].id
      const low = rngHeight < 0.6
      return { zoneId, x: zoneCenter(zoneId) + (rngX * 2 - 1) * 0.3, y: low ? 0.25 : 0.7, low }
    }
  }
}
