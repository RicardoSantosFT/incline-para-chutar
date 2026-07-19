import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aiShot2D, resolveSave2D, savePoints2D, shotDuration, diveReachMult } from '../src/game/keeper.js'
import { KEEPER_REACH_X, KEEPER_REACH_Y, CORNER_BONUS } from '../src/game/constants.js'

test('aiShot2D mira dentro do gol em X e Y quando não está nervoso', () => {
  for (const v of [0, 0.25, 0.5, 0.75, 1]) {
    const s = aiShot2D({ round: 1, rngX: v, rngY: v, nerveMiss: 0, rngMiss: 0.99 })
    assert.ok(Math.abs(s.x) <= 0.95, `x=${s.x} saiu do gol`)
    assert.ok(s.y >= 0.1 && s.y <= 0.95, `y=${s.y} fora da faixa`)
  }
})

test('aiShot2D varre esquerda/direita e baixo/alto', () => {
  assert.ok(aiShot2D({ round: 1, rngX: 0, rngY: 0.5, nerveMiss: 0, rngMiss: 1 }).x < -0.5)
  assert.ok(aiShot2D({ round: 1, rngX: 1, rngY: 0.5, nerveMiss: 0, rngMiss: 1 }).x > 0.5)
  assert.ok(aiShot2D({ round: 1, rngX: 0.5, rngY: 0, nerveMiss: 0, rngMiss: 1 }).y < 0.4)
  assert.ok(aiShot2D({ round: 1, rngX: 0.5, rngY: 1, nerveMiss: 0, rngMiss: 1 }).y > 0.6)
})

test('provocação funciona: com nervosismo alto o rival manda pra fora', () => {
  const s = aiShot2D({ round: 1, rngX: 0.8, rngY: 0.5, nerveMiss: 0.3, rngMiss: 0.1 })
  assert.ok(Math.abs(s.x) > 1 || s.y > 1, 'chute nervoso deve sair fora')
})

test('shotDuration continua encurtando por rodada com piso', () => {
  assert.ok(shotDuration(5) < shotDuration(1))
  assert.ok(shotDuration(50) >= 0.42)
})

test('resolveSave2D usa elipse: alcança mais na vertical que na horizontal', () => {
  const keeper = { x: 0, y: 0.3 }
  assert.equal(resolveSave2D(keeper, { x: KEEPER_REACH_X * 0.9, y: 0.3 }), true)
  assert.equal(resolveSave2D(keeper, { x: KEEPER_REACH_X * 1.1, y: 0.3 }), false)
  assert.equal(resolveSave2D(keeper, { x: 0, y: 0.3 + KEEPER_REACH_Y * 0.9 }), true)
})

test('resolveSave2D aceita multiplicador de alcance (impulso do mergulho)', () => {
  const keeper = { x: 0, y: 0.3 }
  const shot = { x: KEEPER_REACH_X * 1.3, y: 0.3 }
  assert.equal(resolveSave2D(keeper, shot), false)
  assert.equal(resolveSave2D(keeper, shot, 1.5), true)
})

test('diveReachMult: sem impulso o alcance é reduzido; na janela amplia; depois cai', () => {
  // Sem apertar o botão o goleiro não cobre o gol só de rastrear a bola
  assert.equal(diveReachMult({ released: false, power: 0.8, elapsed: 0 }), 0.55)
  assert.ok(diveReachMult({ released: true, power: 1, elapsed: 0.2 }) > 1.4)
  assert.ok(diveReachMult({ released: true, power: 1, elapsed: 0.9 }) < 0.5, 'caiu no chão cedo demais')
  const semImpulso = diveReachMult({ released: false, power: 1, elapsed: 0 })
  const caido = diveReachMult({ released: true, power: 1, elapsed: 2 })
  assert.ok(caido < semImpulso, 'cair cedo é pior do que nunca mergulhar')
})

test('savePoints2D premia canto e bola alta', () => {
  assert.equal(savePoints2D({ x: 0.2, y: 0.3 }), 100)
  assert.equal(savePoints2D({ x: 0.8, y: 0.3 }), 100 + CORNER_BONUS)
  assert.equal(savePoints2D({ x: 0.8, y: 0.8 }), 100 + CORNER_BONUS + 25)
})
