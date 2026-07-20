import { test } from 'node:test'
import assert from 'node:assert/strict'
import { geometry, backPoint, backX, backTopY, backBaseY } from '../src/render/scene.js'

// Plano do fundo da rede: recuado (menor) e sempre dentro da boca do gol

const g = geometry(400, 700)

test('fundo da rede é mais estreito que a boca do gol', () => {
  assert.ok(backX(g, -1) > g.gx(-1))
  assert.ok(backX(g, 1) < g.gx(1))
})

test('fundo da rede fica entre o travessão e a linha do gol', () => {
  assert.ok(backTopY(g) > g.crossbarY)
  assert.ok(backBaseY(g) < g.goalBaseY)
  assert.ok(backTopY(g) < backBaseY(g))
})

test('backPoint mapeia o alvo para dentro do plano do fundo', () => {
  const p = backPoint(g, 0.5, 0.8)
  assert.ok(p.x > g.goalCX && p.x < backX(g, 1) + 1e-9)
  assert.ok(p.y > backTopY(g) - 1e-9 && p.y < backBaseY(g) + 1e-9)
})

test('backPoint limita chutes fora do alvo à moldura do fundo', () => {
  const wide = backPoint(g, 3, 2)
  assert.equal(wide.x, backX(g, 1))
  assert.equal(wide.y, backTopY(g))
  const low = backPoint(g, -3, -1)
  assert.equal(low.x, backX(g, -1))
  assert.equal(low.y, backBaseY(g))
})
