import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shotDispersion, resolveShot2D, keeperDive2D, computeShotPlacement } from '../src/game/shot.js'
import { SPECIALS } from '../src/game/specials.js'
import { KEEPER_REACH_X, MAX_SPREAD, PRECISION_BONUS } from '../src/game/constants.js'

const NO_SPREAD = { rngSpreadX: 0.5, rngSpreadY: 0.5 }
const KEEPER_FAR = { x: -2 / 3, y: 0.25 }

test('shotDispersion continua zero com estabilidade perfeita', () => {
  assert.equal(shotDispersion(1), 0)
  assert.equal(shotDispersion(0), MAX_SPREAD)
})

test('chute preciso no ângulo com goleiro longe: gol de 150 + bônus', () => {
  const r = resolveShot2D({
    aim: { x: 0, y: 0.8 },
    stability: 1,
    power: 0.6,
    keeper: KEEPER_FAR,
    ...NO_SPREAD,
  })
  assert.equal(r.saved, false)
  assert.equal(r.offTarget, false)
  assert.equal(r.points, 150 + PRECISION_BONUS)
})

test('bola no meio da posição do goleiro é defendida', () => {
  const r = resolveShot2D({
    aim: { x: 0, y: 0.3 },
    stability: 1,
    power: 0.6,
    keeper: { x: 0, y: 0.3 },
    ...NO_SPREAD,
  })
  assert.equal(r.saved, true)
  assert.equal(r.points, 0)
})

test('alcance é elíptico: mesma distância vale diferente em X e Y', () => {
  const dist = KEEPER_REACH_X
  const savedWide = resolveShot2D({
    aim: { x: dist, y: 0.3 },
    stability: 1,
    power: 0.6,
    keeper: { x: 0, y: 0.3 },
    ...NO_SPREAD,
  }).saved
  const savedTall = resolveShot2D({
    aim: { x: 0, y: 0.3 + dist },
    stability: 1,
    power: 0.6,
    keeper: { x: 0, y: 0.3 },
    ...NO_SPREAD,
  }).saved
  assert.equal(savedWide, false, 'na horizontal a mesma distância escapa')
  assert.equal(savedTall, true, 'alcance vertical é um pouco maior que o horizontal')
})

test('mira além da trave sai fora; por cima do travessão também', () => {
  const fora = resolveShot2D({ aim: { x: 1.2, y: 0.5 }, stability: 1, power: 0.6, keeper: KEEPER_FAR, ...NO_SPREAD })
  assert.equal(fora.offTarget, true)
  assert.equal(fora.points, 0)
  const porCima = resolveShot2D({ aim: { x: 0, y: 1.2 }, stability: 1, power: 0.6, keeper: KEEPER_FAR, ...NO_SPREAD })
  assert.equal(porCima.offTarget, true)
  assert.equal(porCima.overBar, true)
})

test('chute com força máxima ganha desvio extra', () => {
  const fraco = resolveShot2D({ aim: { x: 0.5, y: 0.5 }, stability: 0.5, power: 0.5, keeper: KEEPER_FAR, rngSpreadX: 1, rngSpreadY: 0.5 })
  const forte = resolveShot2D({ aim: { x: 0.5, y: 0.5 }, stability: 0.5, power: 1, keeper: KEEPER_FAR, rngSpreadX: 1, rngSpreadY: 0.5 })
  assert.ok(forte.shot.x > fraco.shot.x, 'força máxima espalha mais')
})

test('cavadinha morre nas mãos de goleiro parado no centro', () => {
  const r = resolveShot2D({
    aim: { x: 0, y: 0.6 },
    stability: 1,
    power: 0,
    cavadinha: true,
    keeper: { x: 0, y: 0.3 },
    ...NO_SPREAD,
  })
  assert.equal(r.saved, true, 'goleiro no centro pega a cavadinha lenta')
})

test('cavadinha humilha goleiro que mergulhou no canto', () => {
  const r = resolveShot2D({
    aim: { x: 0, y: 0.6 },
    stability: 1,
    power: 0,
    cavadinha: true,
    keeper: { x: 2 / 3, y: 0.25 },
    ...NO_SPREAD,
  })
  assert.equal(r.saved, false)
  assert.ok(r.points > 0)
})

test('curva encolhe o alcance do goleiro', () => {
  const curva = SPECIALS.find((s) => s.id === 'curva')
  const semEspecial = resolveShot2D({
    aim: { x: KEEPER_REACH_X * 0.9, y: 0.3 },
    stability: 1,
    power: 0.6,
    keeper: { x: 0, y: 0.3 },
    ...NO_SPREAD,
  })
  const comCurva = resolveShot2D({
    aim: { x: KEEPER_REACH_X * 0.9, y: 0.3 },
    stability: 1,
    power: 0.6,
    special: curva,
    keeper: { x: 0, y: 0.3 },
    ...NO_SPREAD,
  })
  assert.equal(semEspecial.saved, true)
  assert.equal(comCurva.saved, false, 'com curva o goleiro não alcança')
})

test('gol de especial soma o bônus de estilo (baixo-centro vale 75)', () => {
  const chaleira = SPECIALS.find((s) => s.id === 'chaleira')
  const r = resolveShot2D({
    aim: { x: 0, y: 0.3 },
    stability: 1,
    power: 0.6,
    special: chaleira,
    keeper: KEEPER_FAR,
    ...NO_SPREAD,
  })
  assert.equal(r.zoneId, 'baixo-centro')
  assert.equal(r.points, 75 + PRECISION_BONUS + chaleira.style)
})

test('gol no ângulo informa a área e paga 200', () => {
  const r = resolveShot2D({
    aim: { x: 0.85, y: 0.88 },
    stability: 1,
    power: 0.6,
    keeper: { x: -2 / 3, y: 0.25 },
    ...NO_SPREAD,
  })
  assert.equal(r.zoneId, 'alto-direita')
  assert.equal(r.points, 200 + PRECISION_BONUS)
})

test('goleiro comprometido pela paradinha quase não alcança', () => {
  const r = resolveShot2D({
    aim: { x: KEEPER_REACH_X * 0.8, y: 0.3 },
    stability: 1,
    power: 0.6,
    keeperCommitted: true,
    keeper: { x: 0, y: 0.3 },
    ...NO_SPREAD,
  })
  assert.equal(r.saved, false)
})

test('paradinha comprada não empilha multiplicadores (0,55 uma vez só)', () => {
  const paradinha = SPECIALS.find((s) => s.id === 'paradinha')
  // Com o goleiro comprometido, o alcance mínimo é 0,55x — não 0,55 x 0,55
  const naBorda = resolveShot2D({
    aim: { x: KEEPER_REACH_X * 0.5, y: 0.3 },
    stability: 1,
    power: 0.6,
    special: paradinha,
    keeperCommitted: true,
    keeper: { x: 0, y: 0.3 },
    ...NO_SPREAD,
  })
  assert.equal(naBorda.saved, true, 'dentro de 0,55x o goleiro comprometido ainda alcança')
})

test('paradinha não comprada deixa o goleiro maior (risco real)', () => {
  const paradinha = SPECIALS.find((s) => s.id === 'paradinha')
  const alvo = { x: KEEPER_REACH_X * 1.05, y: 0.3 }
  const semEspecial = resolveShot2D({ aim: alvo, stability: 1, power: 0.6, keeper: { x: 0, y: 0.3 }, ...NO_SPREAD })
  const naoComprou = resolveShot2D({
    aim: alvo,
    stability: 1,
    power: 0.6,
    special: paradinha,
    keeperCommitted: false,
    keeper: { x: 0, y: 0.3 },
    ...NO_SPREAD,
  })
  assert.equal(semEspecial.saved, false)
  assert.equal(naoComprou.saved, true, 'goleiro que não comprou fica ligado e alcança mais')
})

test('computeShotPlacement (duelo) bate com a colocação do resolveShot2D', () => {
  const params = { aim: { x: 0.7, y: 0.9 }, stability: 0.6, power: 0.9, rngSpreadX: 0.8, rngSpreadY: 0.2 }
  const placement = computeShotPlacement(params)
  const full = resolveShot2D({ ...params, keeper: { x: -0.5, y: 0.3 } })
  assert.deepEqual(placement.shot, full.shot)
  assert.equal(placement.offTarget, full.offTarget)
  assert.equal(placement.overBar, full.overBar)
})

test('keeperDive2D espalha o mergulho dentro da zona com rngX', () => {
  const centro = keeperDive2D({ rngZone: 0.5, rngHeight: 0.5, rngX: 0.5 })
  const desviado = keeperDive2D({ rngZone: 0.5, rngHeight: 0.5, rngX: 1 })
  assert.equal(centro.x, 0)
  assert.ok(Math.abs(desviado.x) > 0.2, 'rngX desloca o mergulho dentro da zona')
})

test('keeperDive2D sorteia zona e altura válidas', () => {
  const zones = new Set()
  const heights = new Set()
  for (let v = 0; v < 1; v += 0.05) {
    const d = keeperDive2D({ rngZone: v, rngHeight: v })
    zones.add(d.zoneId)
    heights.add(d.y)
    assert.ok(d.x >= -1 && d.x <= 1)
    assert.ok(d.y > 0 && d.y < 1)
  }
  assert.equal(zones.size, 3)
  assert.ok(heights.size >= 2, 'mergulha baixo e alto')
})
