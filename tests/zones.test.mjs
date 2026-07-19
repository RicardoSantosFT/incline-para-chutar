import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  zoneForX,
  zoneCenter,
  isOffTarget,
  isOffTarget2D,
  heightMultiplier,
  pointsForPlacement,
  ZONES,
} from '../src/game/zones.js'

test('gol tem três zonas: esquerda 50, centro 100, direita 50', () => {
  assert.equal(ZONES.length, 3)
  assert.deepEqual(ZONES.map((z) => z.points), [50, 100, 50])
  assert.deepEqual(ZONES.map((z) => z.id), ['esquerda', 'centro', 'direita'])
})

test('zoneForX devolve o centro para a mira no meio', () => {
  assert.equal(zoneForX(0).id, 'centro')
  assert.equal(zoneForX(0).points, 100)
})

test('zoneForX devolve zonas laterais além de um terço', () => {
  assert.equal(zoneForX(-0.5).id, 'esquerda')
  assert.equal(zoneForX(0.5).id, 'direita')
  assert.equal(zoneForX(0.5).points, 50)
})

test('zoneCenter aponta para o meio de cada zona', () => {
  assert.equal(zoneCenter('centro'), 0)
  assert.ok(Math.abs(zoneCenter('esquerda') - -2 / 3) < 1e-9)
  assert.ok(Math.abs(zoneCenter('direita') - 2 / 3) < 1e-9)
})

test('isOffTarget detecta bola fora na horizontal', () => {
  assert.equal(isOffTarget(1.01), true)
  assert.equal(isOffTarget(0.99), false)
})

test('isOffTarget2D detecta fora pela lateral e por cima do travessão', () => {
  assert.equal(isOffTarget2D(1.05, 0.5), true)
  assert.equal(isOffTarget2D(0, 1.05), true)
  assert.equal(isOffTarget2D(0.9, 0.99), false)
})

test('chute alto vale mais: multiplicador 1,5 acima da linha alta', () => {
  assert.equal(heightMultiplier(0.7), 1.5)
  assert.equal(heightMultiplier(0.3), 1)
})

test('pontos por colocação: ângulo alto do centro vale 150, canto baixo 50', () => {
  assert.equal(pointsForPlacement(0, 0.8), 150)
  assert.equal(pointsForPlacement(0, 0.3), 100)
  assert.equal(pointsForPlacement(0.8, 0.8), 75)
  assert.equal(pointsForPlacement(0.8, 0.2), 50)
})
