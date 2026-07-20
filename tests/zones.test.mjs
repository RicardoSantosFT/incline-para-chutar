import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  zoneForX,
  zoneCenter,
  isOffTarget,
  isOffTarget2D,
  zoneIdForPlacement,
  pointsForPlacement,
  ZONES,
  ZONE_GRID,
} from '../src/game/zones.js'

test('colunas continuam três (goleiro rival mergulha por coluna)', () => {
  assert.equal(ZONES.length, 3)
  assert.deepEqual(ZONES.map((z) => z.id), ['esquerda', 'centro', 'direita'])
  assert.equal(zoneForX(0).id, 'centro')
  assert.equal(zoneForX(-0.5).id, 'esquerda')
  assert.equal(zoneCenter('direita'), 2 / 3)
})

test('o gol tem 9 áreas com pontos por dificuldade estatística', () => {
  assert.equal(Object.keys(ZONE_GRID).length, 9)
  // ângulos são os mais valiosos; altura de goleiro (meio-centro) a menor
  assert.equal(ZONE_GRID['alto-esquerda'], 200)
  assert.equal(ZONE_GRID['alto-direita'], 200)
  assert.equal(ZONE_GRID['alto-centro'], 150)
  assert.equal(ZONE_GRID['meio-esquerda'], 100)
  assert.equal(ZONE_GRID['meio-direita'], 100)
  assert.equal(ZONE_GRID['meio-centro'], 50)
  assert.equal(ZONE_GRID['baixo-esquerda'], 125)
  assert.equal(ZONE_GRID['baixo-direita'], 125)
  assert.equal(ZONE_GRID['baixo-centro'], 75)
})

test('zoneIdForPlacement mapeia linha e coluna por terços', () => {
  assert.equal(zoneIdForPlacement(-0.8, 0.9), 'alto-esquerda')
  assert.equal(zoneIdForPlacement(0, 0.9), 'alto-centro')
  assert.equal(zoneIdForPlacement(0.8, 0.75), 'alto-direita')
  assert.equal(zoneIdForPlacement(-0.5, 0.5), 'meio-esquerda')
  assert.equal(zoneIdForPlacement(0.1, 0.4), 'meio-centro')
  assert.equal(zoneIdForPlacement(0.9, 0.2), 'baixo-direita')
  assert.equal(zoneIdForPlacement(0, 0.05), 'baixo-centro')
})

test('pontos por colocação seguem a tabela das 9 áreas', () => {
  assert.equal(pointsForPlacement(-0.8, 0.9), 200)
  assert.equal(pointsForPlacement(0, 0.8), 150)
  assert.equal(pointsForPlacement(0.8, 0.5), 100)
  assert.equal(pointsForPlacement(0, 0.5), 50)
  assert.equal(pointsForPlacement(-0.9, 0.1), 125)
  assert.equal(pointsForPlacement(0, 0.2), 75)
})

test('mira fora do gol continua fora', () => {
  assert.equal(isOffTarget(1.01), true)
  assert.equal(isOffTarget2D(1.05, 0.5), true)
  assert.equal(isOffTarget2D(0, 1.05), true)
  assert.equal(isOffTarget2D(0.9, 0.99), false)
})
