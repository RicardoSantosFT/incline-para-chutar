import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aiShot, resolveSave, savePoints, shotDuration } from '../src/game/keeper.js'
import { KEEPER_REACH, CORNER_BONUS } from '../src/game/constants.js'

test('aiShot mira dentro do gol', () => {
  for (const v of [0, 0.25, 0.5, 0.75, 1]) {
    const s = aiShot({ round: 1, rngValue: v })
    assert.ok(Math.abs(s.targetX) <= 0.95, `alvo ${s.targetX} saiu do gol`)
  }
})

test('aiShot varre esquerda e direita conforme o rng', () => {
  assert.ok(aiShot({ round: 1, rngValue: 0 }).targetX < -0.5)
  assert.ok(aiShot({ round: 1, rngValue: 1 }).targetX > 0.5)
})

test('shotDuration diminui conforme as rodadas avançam (bola mais rápida)', () => {
  assert.ok(shotDuration(5) < shotDuration(1))
})

test('shotDuration tem um piso para continuar defensável', () => {
  assert.ok(shotDuration(50) >= 0.42)
})

test('resolveSave defende quando o goleiro está no caminho', () => {
  assert.equal(resolveSave(0.6, 0.6), true)
  assert.equal(resolveSave(0.6, 0.6 + KEEPER_REACH), true)
})

test('resolveSave sofre gol quando o goleiro fica longe', () => {
  assert.equal(resolveSave(-0.8, 0.8), false)
  assert.equal(resolveSave(0, 0.8), false)
})

test('savePoints premia defesa comum com 100', () => {
  assert.equal(savePoints({ shotX: 0.2 }), 100)
})

test('savePoints premia defesa no canto com bônus', () => {
  assert.equal(savePoints({ shotX: 0.8 }), 100 + CORNER_BONUS)
  assert.equal(savePoints({ shotX: -0.7 }), 100 + CORNER_BONUS)
})
