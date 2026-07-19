import { test } from 'node:test'
import assert from 'node:assert/strict'
import { zoneForX, zoneCenter, isOffTarget, ZONES } from '../src/game/zones.js'

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

test('zoneForX trata as bordas exatas como zona lateral', () => {
  assert.equal(zoneForX(1).id, 'direita')
  assert.equal(zoneForX(-1).id, 'esquerda')
})

test('zoneCenter aponta para o meio de cada zona', () => {
  assert.equal(zoneCenter('centro'), 0)
  assert.ok(Math.abs(zoneCenter('esquerda') - -2 / 3) < 1e-9)
  assert.ok(Math.abs(zoneCenter('direita') - 2 / 3) < 1e-9)
})

test('isOffTarget detecta bola fora do gol', () => {
  assert.equal(isOffTarget(1.01), true)
  assert.equal(isOffTarget(-1.2), true)
  assert.equal(isOffTarget(0.99), false)
  assert.equal(isOffTarget(1), false)
})
