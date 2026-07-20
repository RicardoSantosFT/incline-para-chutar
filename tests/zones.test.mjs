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

test('colunas de mergulho continuam três (goleiro rival mergulha por coluna)', () => {
  assert.equal(ZONES.length, 3)
  assert.deepEqual(ZONES.map((z) => z.id), ['esquerda', 'centro', 'direita'])
  assert.equal(zoneForX(0).id, 'centro')
  assert.equal(zoneForX(-0.5).id, 'esquerda')
  assert.equal(zoneCenter('direita'), 2 / 3)
})

test('o gol tem 18 áreas (6 colunas × 3 linhas) simétricas', () => {
  assert.equal(Object.keys(ZONE_GRID).length, 18)
  for (const row of ['alto', 'meio', 'baixo']) {
    for (const col of ['trave', 'meia', 'centro']) {
      assert.equal(
        ZONE_GRID[`${row}-${col}-esq`],
        ZONE_GRID[`${row}-${col}-dir`],
        `${row}-${col} deve ser simétrico`,
      )
    }
  }
})

test('pontos por dificuldade: trave > meia > centro; alto no topo', () => {
  assert.equal(ZONE_GRID['alto-trave-esq'], 250)
  assert.equal(ZONE_GRID['alto-meia-esq'], 175)
  assert.equal(ZONE_GRID['alto-centro-esq'], 150)
  assert.equal(ZONE_GRID['meio-trave-dir'], 150)
  assert.equal(ZONE_GRID['meio-meia-dir'], 100)
  assert.equal(ZONE_GRID['meio-centro-dir'], 50)
  assert.equal(ZONE_GRID['baixo-trave-esq'], 175)
  assert.equal(ZONE_GRID['baixo-meia-esq'], 125)
  assert.equal(ZONE_GRID['baixo-centro-esq'], 75)
})

test('zoneIdForPlacement mapeia as 6 colunas e 3 linhas', () => {
  assert.equal(zoneIdForPlacement(-0.9, 0.9), 'alto-trave-esq')
  assert.equal(zoneIdForPlacement(-0.5, 0.9), 'alto-meia-esq')
  assert.equal(zoneIdForPlacement(-0.2, 0.8), 'alto-centro-esq')
  assert.equal(zoneIdForPlacement(0.1, 0.5), 'meio-centro-dir')
  assert.equal(zoneIdForPlacement(0.5, 0.5), 'meio-meia-dir')
  assert.equal(zoneIdForPlacement(0.95, 0.2), 'baixo-trave-dir')
  assert.equal(zoneIdForPlacement(0, 0.05), 'baixo-centro-dir')
})

test('pontos por colocação seguem a tabela', () => {
  assert.equal(pointsForPlacement(-0.9, 0.9), 250)
  assert.equal(pointsForPlacement(0.9, 0.9), 250)
  assert.equal(pointsForPlacement(-0.5, 0.85), 175)
  assert.equal(pointsForPlacement(0.2, 0.8), 150)
  assert.equal(pointsForPlacement(0.9, 0.5), 150)
  assert.equal(pointsForPlacement(-0.5, 0.5), 100)
  assert.equal(pointsForPlacement(0, 0.5), 50)
  assert.equal(pointsForPlacement(0.95, 0.1), 175)
  assert.equal(pointsForPlacement(-0.5, 0.2), 125)
  assert.equal(pointsForPlacement(0.1, 0.2), 75)
})

test('mira fora do gol continua fora', () => {
  assert.equal(isOffTarget(1.01), true)
  assert.equal(isOffTarget2D(1.05, 0.5), true)
  assert.equal(isOffTarget2D(0, 1.05), true)
  assert.equal(isOffTarget2D(0.9, 0.99), false)
})
