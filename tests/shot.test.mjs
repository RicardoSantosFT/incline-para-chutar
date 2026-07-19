import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shotDispersion, resolveShot, keeperDive } from '../src/game/shot.js'
import { KEEPER_REACH, MAX_SPREAD, PRECISION_BONUS, PRECISION_THRESHOLD } from '../src/game/constants.js'

test('shotDispersion é zero com estabilidade perfeita', () => {
  assert.equal(shotDispersion(1), 0)
})

test('shotDispersion é máxima com estabilidade zero', () => {
  assert.equal(shotDispersion(0), MAX_SPREAD)
})

test('resolveShot no centro com goleiro no canto vira gol de 100', () => {
  const r = resolveShot({ aimX: 0, stability: 1, keeperX: 2 / 3, rngValue: 0.5 })
  assert.equal(r.saved, false)
  assert.equal(r.offTarget, false)
  assert.equal(r.zone.id, 'centro')
  assert.equal(r.points, 100 + PRECISION_BONUS)
  assert.equal(r.precise, true)
})

test('resolveShot sem estabilidade não ganha bônus de precisão', () => {
  const r = resolveShot({ aimX: 0, stability: PRECISION_THRESHOLD - 0.01, keeperX: 2 / 3, rngValue: 0.5 })
  assert.equal(r.precise, false)
  assert.equal(r.points, 100)
})

test('resolveShot é defendido quando a bola cruza perto do goleiro', () => {
  const r = resolveShot({ aimX: 0, stability: 1, keeperX: 0, rngValue: 0.5 })
  assert.equal(r.saved, true)
  assert.equal(r.points, 0)
})

test('resolveShot com mira instável aplica desvio do rng', () => {
  // rngValue 1 => desvio máximo para a direita
  const r = resolveShot({ aimX: 0, stability: 0, keeperX: -2 / 3, rngValue: 1 })
  assert.ok(Math.abs(r.shotX - MAX_SPREAD) < 1e-9, `esperava desvio ${MAX_SPREAD}, veio ${r.shotX}`)
})

test('resolveShot além da trave sai fora e não pontua', () => {
  const r = resolveShot({ aimX: 1.1, stability: 1, keeperX: 0, rngValue: 0.5 })
  assert.equal(r.offTarget, true)
  assert.equal(r.saved, false)
  assert.equal(r.points, 0)
})

test('bola fora nunca é defendida mesmo com goleiro em cima', () => {
  const r = resolveShot({ aimX: 1.1, stability: 1, keeperX: 1.1, rngValue: 0.5 })
  assert.equal(r.saved, false)
  assert.equal(r.offTarget, true)
})

test('keeperDive escolhe uma zona válida e devolve a posição do mergulho', () => {
  const d = keeperDive({ rngValue: 0 })
  assert.ok(['esquerda', 'centro', 'direita'].includes(d.zoneId))
  assert.ok(d.keeperX >= -1 && d.keeperX <= 1)
})

test('keeperDive cobre as três zonas conforme o rng varre 0..1', () => {
  const zones = new Set()
  for (let v = 0; v < 1; v += 0.05) zones.add(keeperDive({ rngValue: v }).zoneId)
  assert.equal(zones.size, 3)
})

test('alcance do goleiro não cobre um canto fechado a partir do centro', () => {
  assert.ok(KEEPER_REACH < 0.9, 'canto fechado (0.9) deve estar fora do alcance de quem fica no centro')
})
