import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  WALL_MIN,
  WALL_MAX,
  WALL_HEIGHT_M,
  FALTA_BLOCK_POINTS,
  sortearFalta,
  sortearClima,
  faltaSpotBonus,
  wallCoverage,
  resolveFaltaShot,
  faltaGoalPoints,
  faltaSavePoints,
  aiWallCount,
  aiFaltaShot,
} from '../src/game/freekick.js'

const CLIMA_LIMPO = sortearClima({ rngKind: 0, rngStrength: 0.5, rngSide: 0.9 })

const baseShot = {
  aim: { x: 0, y: 0.8 },
  stability: 0.95,
  power: 0.35,
  spot: { dist: 20, lat: 0, d: 20 },
  wallCount: 4,
  clima: CLIMA_LIMPO,
  rngSpreadX: 0.5,
  rngSpreadY: 0.5,
  rngDiveZone: 0.99, // goleiro voa para o canto oposto
  rngDiveHeight: 0.9,
  rngDiveX: 0.9,
}

// ---------- Sorteios ----------

test('sortearFalta fica dentro dos limites e respeita o lado', () => {
  const perto = sortearFalta({ rngDist: 0, rngLat: 0, rngSide: 0.2 })
  const longe = sortearFalta({ rngDist: 1, rngLat: 1, rngSide: 0.8 })
  assert.ok(perto.dist >= 17 && perto.dist <= 28)
  assert.ok(longe.dist >= 17 && longe.dist <= 28)
  assert.ok(longe.dist > perto.dist)
  assert.ok(Math.abs(longe.lat) <= 12)
  assert.ok(longe.lat > 0) // rngSide alto = direita
  assert.ok(perto.lat <= 0) // rngSide baixo = esquerda
  assert.ok(longe.d >= longe.dist) // hipotenusa nunca é menor que a distância
})

test('sortearClima cobre os tipos e a força escala o vento', () => {
  const ids = new Set()
  for (let k = 0; k < 1; k += 0.09) {
    ids.add(sortearClima({ rngKind: k, rngStrength: 0.5, rngSide: 0.5 }).id)
  }
  assert.ok(ids.has('limpo') && ids.has('chuva') && ids.has('neve'))
  assert.ok(ids.has('vento-favor') && ids.has('vento-contra') && ids.has('vento-lateral'))
  assert.equal(CLIMA_LIMPO.mult, 1)
  assert.equal(CLIMA_LIMPO.windX, 0)
  const fraco = sortearClima({ rngKind: 0.55, rngStrength: 0, rngSide: 0.9 })
  const forte = sortearClima({ rngKind: 0.55, rngStrength: 1, rngSide: 0.9 })
  assert.equal(fraco.id, 'vento-lateral')
  assert.ok(Math.abs(forte.windX) > Math.abs(fraco.windX))
  for (const clima of [fraco, forte]) assert.ok(clima.mult > 1)
})

test('faltaSpotBonus cresce com distância e ângulo', () => {
  const facil = faltaSpotBonus({ dist: 17, lat: 0, d: 17 })
  const longe = faltaSpotBonus({ dist: 28, lat: 0, d: 28 })
  const aberta = faltaSpotBonus({ dist: 17, lat: 12, d: Math.hypot(17, 12) })
  assert.ok(facil >= 0 && facil <= 100)
  assert.ok(longe > facil)
  assert.ok(aberta > facil)
  assert.ok(faltaSpotBonus({ dist: 28, lat: 12, d: Math.hypot(28, 12) }) <= 100)
})

// ---------- Barreira ----------

test('barreira maior cobre mais gol; falta mais perto deixa a barreira maior na tela', () => {
  const spot = { dist: 20, lat: 0, d: 20 }
  const pequena = wallCoverage({ spot, wallCount: 2 })
  const grande = wallCoverage({ spot, wallCount: 7 })
  assert.ok(grande.projHalfX > pequena.projHalfX)
  assert.ok(grande.projHalfX > 1) // 7 na barreira tapa a boca inteira do gol
  assert.ok(pequena.projHalfX < 0.5)
  const perto = wallCoverage({ spot: { dist: 17, lat: 0, d: 17 }, wallCount: 4 })
  const longe = wallCoverage({ spot: { dist: 28, lat: 0, d: 28 }, wallCount: 4 })
  assert.ok(perto.fraction > longe.fraction)
})

// ---------- Física do chute ----------

test('bomba rasteira de longe morre na barreira; cobrança com menos força passa por cima', () => {
  const bomba = resolveFaltaShot({ ...baseShot, power: 0.95, aim: { x: 0, y: 0.55 } })
  assert.equal(bomba.hitWall, true)
  const colocada = resolveFaltaShot({ ...baseShot, power: 0.3, aim: { x: 0, y: 0.85 } })
  assert.equal(colocada.hitWall, false)
  assert.equal(colocada.offTarget, false)
})

test('chute forte no canto contorna barreira pequena', () => {
  const shot = resolveFaltaShot({ ...baseShot, wallCount: 2, power: 0.85, aim: { x: 0.9, y: 0.3 } })
  assert.equal(shot.hitWall, false)
})

test('mais força = voo mais curto; vento contra segura a bola', () => {
  const fraco = resolveFaltaShot({ ...baseShot, power: 0.25, aim: { x: 0, y: 0.9 } })
  const forte = resolveFaltaShot({ ...baseShot, power: 0.9, aim: { x: 0.9, y: 0.3 }, wallCount: 1 })
  assert.ok(forte.flightDur < fraco.flightDur)
  const contra = sortearClima({ rngKind: 0.4, rngStrength: 1, rngSide: 0.5 })
  assert.equal(contra.id, 'vento-contra')
  const segurada = resolveFaltaShot({ ...baseShot, power: 0.25, aim: { x: 0, y: 0.9 }, clima: contra })
  assert.ok(segurada.flightDur > fraco.flightDur)
})

test('vento lateral empurra a colocação na direção do vento', () => {
  const vento = { ...sortearClima({ rngKind: 0.55, rngStrength: 1, rngSide: 0.9 }) }
  assert.ok(vento.windX > 0)
  const semVento = resolveFaltaShot({ ...baseShot, aim: { x: 0, y: 0.85 }, power: 0.3 })
  const comVento = resolveFaltaShot({ ...baseShot, aim: { x: 0, y: 0.85 }, power: 0.3, clima: vento })
  assert.ok(comVento.shot.x > semVento.shot.x)
})

test('resolveFaltaShot é determinístico com os mesmos rngs', () => {
  const a = resolveFaltaShot({ ...baseShot })
  const b = resolveFaltaShot({ ...baseShot })
  assert.deepEqual(a.shot, b.shot)
  assert.equal(a.points, b.points)
})

test('goleiro alcança bola lenta no meio; não alcança bomba no canto com barreira baixa', () => {
  // Mira no meio, voo alto e lento, goleiro mergulhando perto do centro
  const lenta = resolveFaltaShot({
    ...baseShot,
    power: 0.2,
    aim: { x: 0.1, y: 0.75 },
    rngDiveZone: 0.5,
    rngDiveHeight: 0.85,
    rngDiveX: 0.5,
  })
  assert.equal(lenta.hitWall, false)
  assert.equal(lenta.saved, true)
  const bomba = resolveFaltaShot({ ...baseShot, wallCount: 1, power: 0.9, aim: { x: 0.9, y: 0.25 }, rngDiveZone: 0.01 })
  assert.equal(bomba.saved, false)
})

// ---------- Pontuação ----------

test('cada jogador na barreira vale mais pontos para o gol', () => {
  const shot = { x: 0.9, y: 0.85 }
  const spot = { dist: 20, lat: 0, d: 20 }
  const uma = faltaGoalPoints({ shot, spot, wallCount: 1, clima: CLIMA_LIMPO })
  const sete = faltaGoalPoints({ shot, spot, wallCount: 7, clima: CLIMA_LIMPO })
  assert.ok(sete > uma)
  assert.equal(sete - uma, 6 * 20)
})

test('barreira menor paga mais na defesa; clima ruim multiplica os dois', () => {
  const shot = { x: 0.9, y: 0.85 }
  const spot = { dist: 20, lat: 0, d: 20 }
  const neve = sortearClima({ rngKind: 0.99, rngStrength: 0.5, rngSide: 0.5 })
  assert.equal(neve.id, 'neve')
  const poucos = faltaSavePoints({ shot, spot, wallCount: 1, clima: CLIMA_LIMPO, perfect: false })
  const muitos = faltaSavePoints({ shot, spot, wallCount: 7, clima: CLIMA_LIMPO, perfect: false })
  assert.ok(poucos > muitos)
  assert.ok(faltaGoalPoints({ shot, spot, wallCount: 4, clima: neve }) > faltaGoalPoints({ shot, spot, wallCount: 4, clima: CLIMA_LIMPO }))
  assert.ok(faltaSavePoints({ shot, spot, wallCount: 4, clima: neve, perfect: false }) > poucos * 0) // neve multiplica
  assert.ok(faltaSavePoints({ shot, spot, wallCount: 4, clima: CLIMA_LIMPO, perfect: true }) > faltaSavePoints({ shot, spot, wallCount: 4, clima: CLIMA_LIMPO, perfect: false }))
})

test('falta longe paga mais gol; falta perto paga mais defesa', () => {
  const shot = { x: 0, y: 0.5 }
  const perto = { dist: 17, lat: 0, d: 17 }
  const longe = { dist: 28, lat: 0, d: 28 }
  assert.ok(faltaGoalPoints({ shot, spot: longe, wallCount: 3, clima: CLIMA_LIMPO }) > faltaGoalPoints({ shot, spot: perto, wallCount: 3, clima: CLIMA_LIMPO }))
  assert.ok(faltaSavePoints({ shot, spot: perto, wallCount: 3, clima: CLIMA_LIMPO, perfect: false }) > faltaSavePoints({ shot, spot: longe, wallCount: 3, clima: CLIMA_LIMPO, perfect: false }))
})

// ---------- IA ----------

test('aiWallCount fica entre 1 e 7 e cresce em falta perigosa', () => {
  const perto = aiWallCount({ spot: { dist: 17, lat: 0, d: 17 }, rng: 0.5 })
  const longe = aiWallCount({ spot: { dist: 28, lat: 11, d: Math.hypot(28, 11) }, rng: 0.5 })
  assert.ok(perto >= WALL_MIN && perto <= WALL_MAX)
  assert.ok(longe >= WALL_MIN && longe <= WALL_MAX)
  assert.ok(perto > longe)
})

test('aiFaltaShot produz cobrança jogável e barreira grande bloqueia mais', () => {
  const spot = { dist: 20, lat: 3, d: Math.hypot(20, 3) }
  const shot = aiFaltaShot({ spot, wallCount: 3, clima: CLIMA_LIMPO, round: 2, rngKind: 0.9, rngX: 0.7, rngY: 0.5, rngPower: 0.5, rngWall: 0.9 })
  assert.ok(Math.abs(shot.x) <= 1.15)
  assert.ok(shot.y >= 0 && shot.y <= 1.1)
  assert.ok(shot.duration > 0.5 && shot.duration < 1.6)
  assert.equal(shot.hitWall, false)
  const bloqueada = aiFaltaShot({ spot, wallCount: 7, clima: CLIMA_LIMPO, round: 2, rngKind: 0.9, rngX: 0.7, rngY: 0.5, rngPower: 0.5, rngWall: 0.01 })
  assert.equal(bloqueada.hitWall, true)
  assert.ok(bloqueada.wallT > 0 && bloqueada.wallT < bloqueada.duration)
  assert.ok(FALTA_BLOCK_POINTS > 0)
})

test('altura da barreira é constante conhecida (física dos jogadores)', () => {
  assert.ok(WALL_HEIGHT_M > 1.8 && WALL_HEIGHT_M < 2.4)
})
