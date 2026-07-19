import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gammaToAim, betaToAimY } from '../src/game/aim.js'
import { AIM_LIMIT_X, AIM_LIMIT_Y, TILT_RANGE_X_DEG, TILT_RANGE_Y_DEG } from '../src/game/constants.js'

test('mira X pode passar da trave quando o limite permite (bola pra fora)', () => {
  // inclinação além do alcance, com limite estendido do modo artilheiro
  assert.equal(gammaToAim(60, 0, TILT_RANGE_X_DEG, AIM_LIMIT_X), AIM_LIMIT_X)
  assert.equal(gammaToAim(-60, 0, TILT_RANGE_X_DEG, AIM_LIMIT_X), -AIM_LIMIT_X)
  assert.ok(AIM_LIMIT_X > 1, 'limite precisa ultrapassar a trave')
})

test('mira X sem limite explícito continua saturando em ±1 (modo goleiro)', () => {
  assert.equal(gammaToAim(80, 0, TILT_RANGE_X_DEG), 1)
})

test('alta sensibilidade: alcance X menor que os 24° antigos', () => {
  assert.ok(TILT_RANGE_X_DEG <= 18)
  assert.ok(TILT_RANGE_Y_DEG <= 16)
})

test('betaToAimY: celular na posição calibrada mira meia altura', () => {
  assert.equal(betaToAimY(50, 50), 0.5)
})

test('betaToAimY: inclinar para trás sobe a mira, para frente desce', () => {
  assert.ok(betaToAimY(56, 50) > 0.5, 'beta maior = mira mais alta')
  assert.ok(betaToAimY(44, 50) < 0.5, 'beta menor = mira mais baixa')
})

test('betaToAimY permite mirar por cima do travessão e nunca abaixo do chão', () => {
  assert.equal(betaToAimY(90, 40), AIM_LIMIT_Y)
  assert.ok(AIM_LIMIT_Y > 1, 'tem que dar para chutar por cima')
  assert.equal(betaToAimY(-60, 40), 0)
})
