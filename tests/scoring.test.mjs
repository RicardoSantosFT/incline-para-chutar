import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  initialScore,
  applyResult,
  advanceRound,
  isSessionOver,
  finishSession,
} from '../src/game/scoring.js'
import { MAX_COMBO, TOTAL_ROUNDS } from '../src/game/constants.js'

test('initialScore começa zerado com combo x1', () => {
  const s = initialScore(500)
  assert.equal(s.score, 0)
  assert.equal(s.combo, 1)
  assert.equal(s.round, 1)
  assert.equal(s.hits, 0)
  assert.equal(s.best, 500)
})

test('acerto soma pontos multiplicados pelo combo e sobe o combo', () => {
  const s0 = initialScore(0)
  const s1 = applyResult(s0, { success: true, points: 100 })
  assert.equal(s1.score, 100)
  assert.equal(s1.combo, 2)
  assert.equal(s1.hits, 1)
  const s2 = applyResult(s1, { success: true, points: 100 })
  assert.equal(s2.score, 300, 'segunda bola vale 100 x combo 2')
})

test('erro zera o combo e não pontua', () => {
  const s0 = applyResult(initialScore(0), { success: true, points: 100 })
  const s1 = applyResult(s0, { success: false, points: 0 })
  assert.equal(s1.score, 100)
  assert.equal(s1.combo, 1)
})

test('combo satura em MAX_COMBO', () => {
  let s = initialScore(0)
  for (let i = 0; i < MAX_COMBO + 3; i++) s = applyResult(s, { success: true, points: 10 })
  assert.equal(s.combo, MAX_COMBO)
})

test('maxCombo registra o maior combo da sessão', () => {
  let s = initialScore(0)
  for (let i = 0; i < 3; i++) s = applyResult(s, { success: true, points: 10 })
  s = applyResult(s, { success: false, points: 0 })
  assert.equal(s.maxCombo, 4)
  assert.equal(s.combo, 1)
})

test('applyResult não muta o estado anterior (imutabilidade)', () => {
  const s0 = initialScore(0)
  const frozen = Object.freeze({ ...s0 })
  applyResult(s0, { success: true, points: 100 })
  assert.deepEqual({ ...s0 }, { ...frozen })
})

test('sessão termina depois de TOTAL_ROUNDS rodadas', () => {
  let s = initialScore(0)
  assert.equal(isSessionOver(s), false)
  for (let i = 0; i < TOTAL_ROUNDS; i++) s = advanceRound(s)
  assert.equal(isSessionOver(s), true)
})

test('finishSession atualiza o recorde quando o placar supera o best', () => {
  const s = { ...initialScore(200), score: 350 }
  assert.equal(finishSession(s).best, 350)
  const s2 = { ...initialScore(200), score: 120 }
  assert.equal(finishSession(s2).best, 200)
})
