import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  powerFromHold,
  isCavadinha,
  flightDuration,
  powerSpread,
  keeperReachMult,
  CAVADINHA_MS,
  FULL_CHARGE_MS,
  CAVADINHA_DURATION_S,
} from '../src/game/power.js'

test('toque curtinho é cavadinha, segurada não é', () => {
  assert.equal(isCavadinha(CAVADINHA_MS - 40), true)
  assert.equal(isCavadinha(CAVADINHA_MS + 40), false)
})

test('powerFromHold começa em 0 no limiar da cavadinha e satura em 1', () => {
  assert.equal(powerFromHold(CAVADINHA_MS), 0)
  assert.equal(powerFromHold(FULL_CHARGE_MS), 1)
  assert.equal(powerFromHold(FULL_CHARGE_MS + 5000), 1)
  assert.equal(powerFromHold(0), 0)
})

test('powerFromHold cresce de forma monotônica', () => {
  const a = powerFromHold(300)
  const b = powerFromHold(600)
  const c = powerFromHold(900)
  assert.ok(a < b && b < c, `esperava crescimento, veio ${a}, ${b}, ${c}`)
})

test('quanto mais força, mais rápida a bola', () => {
  assert.ok(flightDuration(1) < flightDuration(0.5))
  assert.ok(flightDuration(0.5) < flightDuration(0))
  assert.ok(flightDuration(1) >= 0.4, 'piso de duração para continuar visível')
})

test('cavadinha é a bola mais lenta do jogo', () => {
  assert.ok(CAVADINHA_DURATION_S > flightDuration(0))
})

test('powerSpread cresce com a força: sempre há troca entre potência e precisão', () => {
  assert.equal(powerSpread(0), 0)
  assert.ok(powerSpread(0.5) > 0)
  assert.ok(powerSpread(1) > powerSpread(0.5), 'força máxima espalha mais')
  assert.ok(powerSpread(1) <= 0.15, 'punição tem teto razoável')
})

test('keeperReachMult: bola fraca é mais fácil de defender', () => {
  assert.ok(keeperReachMult(0.2) > 1)
  assert.ok(keeperReachMult(1) < 1)
})
