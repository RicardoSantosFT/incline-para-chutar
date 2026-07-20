import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  aiShot2D,
  aiKickPlan,
  shotDuration,
  diveTravelTime,
  catchSpeedMult,
  divePlan,
  resolveKeeperDefense,
  DIVE_START,
} from '../src/game/keeper.js'

// ---------- chute do rival ----------

test('aiShot2D mira dentro do gol em X e Y quando não está nervoso', () => {
  for (const v of [0, 0.25, 0.5, 0.75, 1]) {
    const s = aiShot2D({ round: 1, rngX: v, rngY: v, nerveMiss: 0, rngMiss: 0.99 })
    assert.ok(Math.abs(s.x) <= 0.95, `x=${s.x} saiu do gol`)
    assert.ok(s.y >= 0.1 && s.y <= 0.95, `y=${s.y} fora da faixa`)
  }
})

test('provocação funciona: com nervosismo alto o rival manda pra fora', () => {
  const s = aiShot2D({ round: 1, rngX: 0.8, rngY: 0.5, nerveMiss: 0.3, rngMiss: 0.1 })
  assert.ok(Math.abs(s.x) > 1 || s.y > 1, 'chute nervoso deve sair fora')
})

test('rngPower varia a força: chute forte chega mais rápido que o fraco', () => {
  const forte = aiShot2D({ round: 1, rngX: 0.5, rngY: 0.5, rngPower: 1, rngMiss: 1 })
  const fraco = aiShot2D({ round: 1, rngX: 0.5, rngY: 0.5, rngPower: 0, rngMiss: 1 })
  assert.ok(forte.duration < fraco.duration)
  assert.ok(forte.duration >= 0.36, 'piso de duração para ser defensável')
})

test('shotDuration continua encurtando por rodada com piso', () => {
  assert.ok(shotDuration(5) < shotDuration(1))
  assert.ok(shotDuration(50) >= 0.42)
  // Bola rápida o bastante para reagir-depois-do-chute não dominar
  assert.ok(shotDuration(1) <= 0.7)
})

test('aiKickPlan: finta alonga a corrida e fica mais provável com as rodadas', () => {
  const semFinta = aiKickPlan({ round: 1, rngValue: 0.99 })
  assert.equal(semFinta.feint, false)
  const comFinta = aiKickPlan({ round: 10, rngValue: 0.25 })
  assert.equal(comFinta.feint, true)
  assert.ok(comFinta.windup > semFinta.windup, 'paradinha do rival demora mais')
  // rng igual, rodada baixa: sem finta (chance cresce com o round)
  assert.equal(aiKickPlan({ round: 1, rngValue: 0.25 }).feint, false)
})

// ---------- física do mergulho ----------

test('diveTravelTime cresce com a distância e nunca é instantâneo', () => {
  assert.ok(diveTravelTime(0) > 0)
  assert.ok(diveTravelTime(1.2) > diveTravelTime(0.5))
  assert.ok(diveTravelTime(1.3) <= 0.6, 'canto mais longe ainda é alcançável em tempo de jogo')
})

test('catchSpeedMult: bola fraca é mais fácil de segurar que bolão', () => {
  assert.ok(catchSpeedMult(0.85) > catchSpeedMult(0.42))
  assert.ok(catchSpeedMult(2) <= 1.15)
  assert.ok(catchSpeedMult(0.1) >= 0.75)
})

test('sem soltar o botão o goleiro fica no centro: pega perto, não pega canto', () => {
  const perto = resolveKeeperDefense({
    released: false,
    shot: { x: 0.1, y: 0.35 },
    shotDuration: 0.7,
  })
  assert.equal(perto.saved, true)
  assert.equal(perto.phase, 'standing')
  const canto = resolveKeeperDefense({
    released: false,
    shot: { x: 0.9, y: 0.7 },
    shotDuration: 0.7,
  })
  assert.equal(canto.saved, false)
})

test('leitura perfeita: mergulho no canto chega esticado e defende', () => {
  const target = { x: 0.9, y: 0.7 }
  const dist = Math.hypot(target.x - DIVE_START.x, target.y - DIVE_START.y)
  const r = resolveKeeperDefense({
    released: true,
    releaseLead: diveTravelTime(dist) + 0.1,
    target,
    shot: { x: 0.9, y: 0.7 },
    shotDuration: 0.85,
  })
  assert.equal(r.saved, true)
  assert.equal(r.phase, 'stretched')
})

test('esticado exige voo de verdade: mirar nos próprios pés não vira Defesaça', () => {
  // Alvo colado na posição inicial: soltar no tempo NÃO dá a fase stretched
  const r = resolveKeeperDefense({
    released: true,
    releaseLead: 0.2,
    target: { x: 0.05, y: 0.4 },
    shot: { x: 0.05, y: 0.4 },
    shotDuration: 0.6,
  })
  assert.notEqual(r.phase, 'stretched', 'sem distância mínima não há bônus de esticado')
  assert.equal(r.saved, true, 'ainda pega a bola em cima dele')
})

test('comprou a paradinha: pulou muito antes e está caído quando a bola chega', () => {
  const target = { x: 0.9, y: 0.7 }
  const r = resolveKeeperDefense({
    released: true,
    releaseLead: 1.4,
    target,
    shot: { x: -0.9, y: 0.2 },
    shotDuration: 0.5,
  })
  assert.equal(r.phase, 'grounded')
  assert.equal(r.saved, false)
})

test('soltou tarde demais: mergulho incompleto não alcança o canto', () => {
  const target = { x: 0.9, y: 0.7 }
  const r = resolveKeeperDefense({
    released: true,
    releaseLead: 0.05,
    target,
    shot: { x: 0.9, y: 0.7 },
    shotDuration: 0.42,
  })
  assert.equal(r.phase, 'diving')
  assert.equal(r.saved, false)
})

test('a velocidade da bola decide defesas na margem', () => {
  // Goleiro parado, bola passando um pouco além do alcance de pé firme
  const shot = { x: 0.17, y: 0.35 }
  const lenta = resolveKeeperDefense({ released: false, shot, shotDuration: 0.85 })
  const rapida = resolveKeeperDefense({ released: false, shot, shotDuration: 0.42 })
  assert.equal(lenta.saved, true, 'bola fraca dá tempo de encaixar')
  assert.equal(rapida.saved, false, 'bolão no mesmo lugar entra')
})

test('bola fora continua fora mesmo com goleiro em cima', () => {
  const r = resolveKeeperDefense({
    released: false,
    shot: { x: 1.1, y: 0.3 },
    shotDuration: 0.7,
  })
  assert.equal(r.saved, false)
})


// ---------- força do pulo ----------

test('divePlan: força na medida chega exatamente no alvo', () => {
  const target = { x: 0.9, y: 0.7 }
  const exact = divePlan({ target, power: divePlan({ target, power: 1 }).needed })
  assert.ok(Math.abs(exact.point.x - target.x) < 1e-9)
  assert.ok(Math.abs(exact.point.y - target.y) < 1e-9)
  assert.equal(exact.short, false)
})

test('divePlan: pouca força cai no meio do caminho', () => {
  const target = { x: 0.9, y: 0.7 }
  const weak = divePlan({ target, power: 0.3 })
  assert.equal(weak.short, true)
  assert.ok(Math.abs(weak.point.x) < Math.abs(target.x), 'não chega no canto')
  assert.ok(weak.point.x > 0, 'mas voa na direção certa')
})

test('divePlan: força demais passa do alvo (overshoot)', () => {
  const target = { x: 0.25, y: 0.4 } // alvo perto exige pouco impulso
  const over = divePlan({ target, power: 1 })
  assert.equal(over.short, false)
  assert.ok(over.point.x > target.x + 0.1, 'passa direto do ponto')
})

test('divePlan: tempo de voo cresce com a distância real percorrida', () => {
  const far = divePlan({ target: { x: 0.9, y: 0.7 }, power: 1 })
  const near = divePlan({ target: { x: 0.9, y: 0.7 }, power: 0.3 })
  assert.ok(near.diveTime < far.diveTime)
})

test('defesa com força certa e timing certo segura o chute no canto', () => {
  const target = { x: 0.9, y: 0.7 }
  const needed = divePlan({ target, power: 1 }).needed
  const plan = divePlan({ target, power: needed })
  const r = resolveKeeperDefense({
    released: true,
    releaseLead: plan.diveTime + 0.1,
    target,
    power: needed,
    shot: { x: 0.9, y: 0.7 },
    shotDuration: 0.7,
  })
  assert.equal(r.saved, true)
  assert.equal(r.phase, 'stretched')
})

test('sem força suficiente a bola no canto passa por cima do goleiro caído no caminho', () => {
  const target = { x: 0.9, y: 0.7 }
  const r = resolveKeeperDefense({
    released: true,
    releaseLead: 0.6,
    target,
    power: 0.25,
    shot: { x: 0.9, y: 0.7 },
    shotDuration: 0.45,
  })
  assert.equal(r.saved, false)
})

test('força demais em alvo perto: o goleiro passa direto pela bola', () => {
  const target = { x: 0.2, y: 0.35 }
  const plan = divePlan({ target, power: 1 })
  const r = resolveKeeperDefense({
    released: true,
    releaseLead: plan.diveTime + 0.05,
    target,
    power: 1,
    shot: { x: 0.2, y: 0.35 },
    shotDuration: 0.42,
  })
  assert.equal(r.saved, false, 'overshoot leva o goleiro para longe da bola')
})

test('sem power informado o plano assume força exata (compatibilidade)', () => {
  const r = resolveKeeperDefense({
    released: true,
    releaseLead: 0.55,
    target: { x: 0.9, y: 0.7 },
    shot: { x: 0.9, y: 0.7 },
    shotDuration: 0.85,
  })
  assert.equal(r.saved, true)
})
