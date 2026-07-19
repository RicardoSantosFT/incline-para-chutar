import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gammaToAim, smoothAim, aimStability } from '../src/game/aim.js'

test('gammaToAim devolve 0 quando o celular está na posição calibrada', () => {
  assert.equal(gammaToAim(12, 12, 24), 0)
})

test('gammaToAim devolve 1 na inclinação máxima à direita', () => {
  assert.equal(gammaToAim(36, 12, 24), 1)
})

test('gammaToAim devolve -1 na inclinação máxima à esquerda', () => {
  assert.equal(gammaToAim(-12, 12, 24), -1)
})

test('gammaToAim satura além do alcance configurado', () => {
  assert.equal(gammaToAim(80, 0, 24), 1)
  assert.equal(gammaToAim(-80, 0, 24), -1)
})

test('gammaToAim é proporcional dentro do alcance', () => {
  assert.equal(gammaToAim(12, 0, 24), 0.5)
  assert.equal(gammaToAim(-6, 0, 24), -0.25)
})

test('smoothAim aproxima o valor anterior do alvo pela fração alpha', () => {
  assert.equal(smoothAim(0, 1, 0.2), 0.2)
  assert.equal(smoothAim(0.5, 0.5, 0.3), 0.5)
})

test('aimStability é 1 com a mira parada', () => {
  assert.equal(aimStability([0, 0, 0, 0]), 1)
})

test('aimStability cai a 0 com a mira sacudindo forte', () => {
  assert.equal(aimStability([0.2, -0.2, 0.2, -0.2]), 0)
})

test('aimStability fica entre 0 e 1 com tremida leve', () => {
  const s = aimStability([0.01, -0.01, 0.01, -0.01])
  assert.ok(s > 0 && s < 1, `esperava 0 < s < 1, veio ${s}`)
})

test('aimStability devolve 1 para lista vazia', () => {
  assert.equal(aimStability([]), 1)
})
