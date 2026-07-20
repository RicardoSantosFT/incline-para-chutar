// Cobrança de falta: física realista simplificada em metros.
// A bola precisa passar POR CIMA da barreira (voo alto e mais lento) ou
// CONTORNÁ-LA com efeito (canto com força). Vento, chuva e neve alteram
// velocidade, curva e alcance do goleiro. Tudo puro e determinístico via rng.
import { pointsForPlacement, zoneIdForPlacement, isOffTarget2D } from './zones.js'
import { keeperDive2D } from './shot.js'

export const WALL_MIN = 1
export const WALL_MAX = 7
export const WALL_DIST_M = 9.15 // distância regulamentar da barreira
export const WALL_PLAYER_W_M = 0.55
export const WALL_HEIGHT_M = 2.1 // jogador de 1,85m saltando (mãos não valem!)
export const GOAL_HALF_M = 3.66
export const GOAL_HEIGHT_M = 2.44
export const FALTA_DIST_MIN = 17
export const FALTA_DIST_MAX = 28
export const FALTA_LAT_MAX = 12
export const FALTA_WALL_STEP = 20 // pontos por jogador na barreira (gol)
export const FALTA_BLOCK_POINTS = 30 // barreira salvou: pouco, mas mantém o combo
const GRAVITY = 9.81
const BASE_SPEED = 16 // m/s com força zero
const SPEED_RANGE = 16 // + até 16 m/s com força cheia
const FORWARD_RATIO = 0.82 // componente média para frente (voo com loft)

export function sortearFalta({ rngDist, rngLat, rngSide }) {
  const dist = FALTA_DIST_MIN + rngDist * (FALTA_DIST_MAX - FALTA_DIST_MIN)
  const side = rngSide >= 0.5 ? 1 : -1
  const lat = side * rngLat * FALTA_LAT_MAX
  return { dist, lat, d: Math.hypot(dist, lat) }
}

const CLIMA_DEFS = [
  { id: 'limpo', nome: 'Noite limpa', emoji: '🌙', aviso: 'Condições perfeitas', mult: 1, windX: 0, windZ: 0 },
  { id: 'vento-favor', nome: 'Vento a favor', emoji: '💨', aviso: 'A bola chega mais rápido', mult: 1.1, windX: 0, windZ: 6 },
  { id: 'vento-contra', nome: 'Vento contra', emoji: '🌬️', aviso: 'A bola perde força no ar', mult: 1.1, windX: 0, windZ: -6 },
  { id: 'vento-lateral', nome: 'Vento lateral', emoji: '🍃', aviso: 'A bola desvia no ar', mult: 1.2, windX: 7, windZ: 0 },
  { id: 'chuva', nome: 'Chuva', emoji: '🌧️', aviso: 'Bola escorregadia para o goleiro', mult: 1.25, windX: 0, windZ: 0 },
  { id: 'neve', nome: 'Neve', emoji: '❄️', aviso: 'Bola pesada e mais lenta', mult: 1.35, windX: 0, windZ: -3 },
]

export function sortearClima({ rngKind, rngStrength, rngSide }) {
  const def = CLIMA_DEFS[Math.min(CLIMA_DEFS.length - 1, Math.floor(rngKind * CLIMA_DEFS.length))]
  const strength = 0.6 + rngStrength * 0.4
  const side = rngSide >= 0.5 ? 1 : -1
  return { ...def, windX: def.windX * strength * side, windZ: def.windZ * strength }
}

// Dificuldade do local (0..100): longe e aberto = mais difícil marcar
export function faltaSpotBonus(spot) {
  const distPart = ((spot.dist - FALTA_DIST_MIN) / (FALTA_DIST_MAX - FALTA_DIST_MIN)) * 60
  const latPart = (Math.abs(spot.lat) / FALTA_LAT_MAX) * 40
  return Math.round(Math.min(100, distPart + latPart))
}

// Quanto do gol a barreira tapa, visto da bola (projeção no plano do gol)
export function wallCoverage({ spot, wallCount }) {
  const halfM = (wallCount * WALL_PLAYER_W_M) / 2
  const fraction = WALL_DIST_M / spot.d
  const projHalfX = (halfM * (spot.d / WALL_DIST_M)) / GOAL_HALF_M
  return { halfM, fraction, projHalfX }
}

// Voo balístico: T pela distância e velocidade; vy escolhido para chegar na
// altura da mira; a altura na barreira decide se passa por cima
function faltaPhysics({ power, spot, clima, targetYm }) {
  const snowDrag = clima.id === 'neve' ? 0.9 : 1
  const v = (BASE_SPEED + power * SPEED_RANGE) * snowDrag
  const vEff = Math.max(8, v + clima.windZ * 0.55)
  const T = Math.min(1.5, Math.max(0.55, spot.d / (vEff * FORWARD_RATIO)))
  const fraction = WALL_DIST_M / spot.d
  const tw = T * fraction
  const vy = (targetYm + 0.5 * GRAVITY * T * T) / T
  const yWall = vy * tw - 0.5 * GRAVITY * tw * tw
  return { v, T, tw, vy, yWall, fraction }
}

// Curva natural do chute: contorna por fora e fecha no alvo
const curveBow = (power) => 0.3 + power * 0.45

export function resolveFaltaShot({
  aim,
  stability,
  power,
  spot,
  wallCount,
  clima,
  rngSpreadX,
  rngSpreadY,
  rngDiveZone,
  rngDiveHeight,
  rngDiveX = 0.5,
}) {
  const targetYm = Math.max(0.05, aim.y * GOAL_HEIGHT_M)
  const phys = faltaPhysics({ power, spot, clima, targetYm })

  // Dispersão: instabilidade + força + chuva; em metros no plano do gol
  const spreadM = (1 - stability) * 1.1 + power * 0.5 + (clima.id === 'chuva' ? 0.25 : 0)
  const driftM = clima.windX * 0.18 * phys.T * phys.T
  const finalXm = aim.x * GOAL_HALF_M + (rngSpreadX - 0.5) * spreadM + driftM
  const finalYm = targetYm + (rngSpreadY - 0.5) * spreadM * 0.8

  // Posição lateral na barreira: reta bola→alvo + curva por fora + vento parcial
  const { halfM, fraction } = wallCoverage({ spot, wallCount })
  const dir = Math.sign(finalXm - spot.lat) || Math.sign(finalXm) || 1
  const xAtWall =
    spot.lat +
    (finalXm - spot.lat) * fraction +
    dir * curveBow(power) * Math.sin(Math.PI * fraction) +
    clima.windX * 0.18 * phys.tw * phys.tw
  const wallCenter = spot.lat * (1 - fraction)
  const hitWall = Math.abs(xAtWall - wallCenter) < halfM && phys.yWall < WALL_HEIGHT_M

  const x = finalXm / GOAL_HALF_M
  const y = finalYm / GOAL_HEIGHT_M
  const offTarget = !hitWall && isOffTarget2D(x, y)
  const overBar = !hitWall && y > 1.02

  // Goleiro: voo lento dá tempo de reagir; chuva/neve atrapalham a pegada
  const dive = keeperDive2D({ rngZone: rngDiveZone, rngHeight: rngDiveHeight, rngX: rngDiveX })
  let reach = Math.min(0.66, Math.max(0.22, 0.3 + (phys.T - 0.7) * 0.55))
  if (clima.id === 'chuva') reach -= 0.06
  if (clima.id === 'neve') reach -= 0.03
  const gap = Math.hypot((x - dive.x) * 1.15, (y - dive.y) * 0.9)
  const saved = !hitWall && !offTarget && gap < reach

  const success = !hitWall && !offTarget && !saved
  const points = success ? faltaGoalPoints({ shot: { x, y }, spot, wallCount, clima }) : 0
  return {
    shot: { x, y },
    hitWall,
    wallY: Math.min(1, Math.max(0, phys.yWall / GOAL_HEIGHT_M)),
    offTarget,
    overBar,
    saved,
    dive,
    precise: success && pointsForPlacement(x, y) >= 175,
    zoneId: zoneIdForPlacement(x, y),
    points,
    flightDur: phys.T,
    wallT: phys.tw,
    loft: phys.vy / phys.v,
  }
}

export function faltaGoalPoints({ shot, spot, wallCount, clima }) {
  const base = pointsForPlacement(shot.x, shot.y) + wallCount * FALTA_WALL_STEP + faltaSpotBonus(spot)
  return Math.round(base * clima.mult)
}

// Defesa: barreira pequena = goleiro exposto = paga mais; falta perto e
// central é a mais difícil de defender (inverso do bônus do batedor)
export function faltaSavePoints({ shot, spot, wallCount, clima, perfect }) {
  const base =
    pointsForPlacement(shot.x, shot.y) + (WALL_MAX + 1 - wallCount) * FALTA_WALL_STEP + (100 - faltaSpotBonus(spot))
  return Math.round(base * clima.mult) + (perfect ? 25 : 0)
}

// IA goleira (modo batedor): barreira maior quanto mais perigosa a falta
export function aiWallCount({ spot, rng }) {
  const danger = 1 - faltaSpotBonus(spot) / 100
  const count = Math.round(2 + danger * 4 + (rng - 0.5) * 2)
  return Math.min(WALL_MAX, Math.max(WALL_MIN, count))
}

// IA batedora (modo goleiro): por cima da barreira ou colocada no canto
export function aiFaltaShot({ spot, wallCount, clima, round, rngKind, rngX, rngY, rngPower, rngWall }) {
  const overWall = wallCount >= 5 ? rngKind < 0.82 : rngKind < 0.58
  const skill = Math.min(0.25, round * 0.02)
  let x, y, power, blockChance
  if (overWall) {
    x = (rngX - 0.5) * (1.5 + skill)
    y = 0.6 + rngY * 0.36
    power = 0.32 + rngPower * 0.3
    blockChance = 0.05 * wallCount + (clima.id === 'neve' ? 0.05 : 0)
  } else {
    const side = rngX >= 0.5 ? 1 : -1
    x = side * (0.74 + rngY * 0.3)
    y = 0.12 + rngX * 0.45
    power = 0.6 + rngPower * 0.35
    blockChance = 0.02 * wallCount
  }
  const targetYm = Math.max(0.05, y * GOAL_HEIGHT_M)
  const phys = faltaPhysics({ power, spot, clima, targetYm })
  const hitWall = rngWall < blockChance
  return { x, y, duration: phys.T, hitWall, wallT: phys.tw, loft: phys.vy / phys.v }
}

// Invólucros de rodada (rng injetado): menos cola no orquestrador
export function faltaStrikerResolve({ aim, stability, power, falta, rng }) {
  const result = resolveFaltaShot({
    aim,
    stability,
    power,
    spot: falta.spot,
    wallCount: falta.wallCount,
    clima: falta.clima,
    rngSpreadX: rng(),
    rngSpreadY: rng(),
    rngDiveZone: rng(),
    rngDiveHeight: rng(),
    rngDiveX: rng(),
  })
  return {
    ...result,
    flightDur: result.hitWall ? result.wallT : result.flightDur,
    trajClamp: result.hitWall ? result.wallT / result.flightDur : 1,
    curve: Math.abs(result.shot.x) > 0.3,
  }
}

export function faltaAiKick({ falta, round, nerveMiss, rng }) {
  const fk = aiFaltaShot({
    spot: falta.spot,
    wallCount: falta.wallCount,
    clima: falta.clima,
    round,
    rngKind: rng(),
    rngX: rng(),
    rngY: rng(),
    rngPower: rng(),
    rngWall: Math.min(1, rng() + nerveMiss),
  })
  // Bola na barreira: o voo termina (e a bola morre) na fração até ela
  return fk.hitWall ? { ...fk, duration: fk.wallT, trajClamp: fk.wallT / fk.duration } : { ...fk, trajClamp: 1 }
}
