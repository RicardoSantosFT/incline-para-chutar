import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createShakeDetector } from '../src/game/shake.js'

function feed(detector, samples) {
  let fired = 0
  for (const [t, mag] of samples) if (detector.sample(t, mag)) fired++
  return fired
}

test('um único tranco (amostras de 60Hz coladas) não dispara', () => {
  const d = createShakeDetector()
  const fired = feed(d, [
    [0, 20],
    [16, 20],
    [32, 20],
    [48, 20],
  ])
  assert.equal(fired, 0, 'amostras a 16ms são o mesmo pico, não três')
})

test('três picos rápidos disparam o shake', () => {
  const d = createShakeDetector()
  const fired = feed(d, [
    [0, 18],
    [120, 16],
    [240, 20],
  ])
  assert.equal(fired, 1)
})

test('movimento suave nunca dispara', () => {
  const d = createShakeDetector()
  const fired = feed(d, [
    [0, 3],
    [100, 4],
    [200, 5],
    [300, 4],
    [400, 6],
  ])
  assert.equal(fired, 0)
})

test('picos espaçados demais não somam (fora da janela)', () => {
  const d = createShakeDetector()
  const fired = feed(d, [
    [0, 18],
    [600, 18],
    [1200, 18],
  ])
  assert.equal(fired, 0)
})

test('cooldown impede disparo em rajada contínua', () => {
  const d = createShakeDetector()
  const samples = []
  for (let t = 0; t <= 1500; t += 100) samples.push([t, 20])
  const fired = feed(d, samples)
  assert.equal(fired, 1, 'segunda detecção só depois do cooldown')
})

test('depois do cooldown pode disparar de novo', () => {
  const d = createShakeDetector({ cooldownMs: 1000 })
  const fired = feed(d, [
    [0, 18],
    [120, 18],
    [240, 18],
    // pausa maior que o cooldown
    [1500, 18],
    [1620, 18],
    [1740, 18],
  ])
  assert.equal(fired, 2)
})
