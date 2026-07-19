import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createDuel,
  applyDuelEvent,
  makeRoomCode,
  validateDuelMsg,
  BALLS_PER_SIDE,
  MAX_SUDDEN_PAIRS,
} from '../src/net/duel.js'

const start = (first = 'host') => applyDuelEvent(createDuel('host'), { type: 'start', firstShooter: first })
const ball = (state, scored) => applyDuelEvent(state, { type: 'ball-result', ball: state.ball, shooter: state.shooter, scored })

test('sala: código de 4 letras sem caracteres ambíguos', () => {
  for (let v = 0; v < 1; v += 0.013) {
    const code = makeRoomCode(() => v)
    assert.match(code, /^[A-HJ-NP-Z2-9]{4}$/)
  }
  assert.notEqual(makeRoomCode(() => 0.1), makeRoomCode(() => 0.9))
})

test('início: quem começa vem do evento start e o duelo fica em jogo', () => {
  const s = start('guest')
  assert.equal(s.phase, 'playing')
  assert.equal(s.shooter, 'guest')
  assert.equal(s.ball, 1)
})

test('cobradores alternam a cada bola, como numa disputa real', () => {
  let s = start('host')
  assert.equal(s.shooter, 'host')
  s = ball(s, true)
  assert.equal(s.shooter, 'guest')
  s = ball(s, false)
  assert.equal(s.shooter, 'host')
  assert.equal(s.ball, 3)
})

test('placar conta gols por lado', () => {
  let s = start('host')
  s = ball(s, true) // host marca
  s = ball(s, true) // guest marca
  s = ball(s, false) // host perde
  assert.deepEqual(s.score, { host: 1, guest: 1 })
})

test('decisão antecipada: impossível alcançar encerra o duelo', () => {
  let s = start('host')
  // host converte 3, guest perde 3 → depois da 6ª bola: 3 x 0 com 2 restantes → decidido
  for (let i = 0; i < 3; i++) {
    s = ball(s, true) // host
    s = ball(s, false) // guest
  }
  assert.equal(s.phase, 'done')
  assert.equal(s.winner, 'host')
})

test('5 bolas para cada um; empate leva à morte súbita', () => {
  let s = start('host')
  for (let i = 0; i < BALLS_PER_SIDE * 2; i++) s = ball(s, true) // todos marcam
  assert.equal(s.phase, 'playing')
  assert.equal(s.stage, 'sudden')
  assert.equal(s.score.host, BALLS_PER_SIDE)
})

test('morte súbita: par desigual decide na hora', () => {
  let s = start('host')
  for (let i = 0; i < BALLS_PER_SIDE * 2; i++) s = ball(s, true)
  s = ball(s, true) // host marca no par extra
  s = ball(s, false) // guest perde
  assert.equal(s.phase, 'done')
  assert.equal(s.winner, 'host')
})

test('morte súbita tem teto de pares e pode terminar empatada', () => {
  let s = start('host')
  for (let i = 0; i < (BALLS_PER_SIDE + MAX_SUDDEN_PAIRS) * 2; i++) s = ball(s, true)
  assert.equal(s.phase, 'done')
  assert.equal(s.winner, null, 'empate honesto após o teto')
})

test('eventos de bola repetidos ou fora de ordem são ignorados (idempotência)', () => {
  let s = start('host')
  const evt = { type: 'ball-result', ball: 1, shooter: 'host', scored: true }
  s = applyDuelEvent(s, evt)
  const again = applyDuelEvent(s, evt)
  assert.deepEqual(again, s, 'duplicata não muda nada')
  const stale = applyDuelEvent(s, { type: 'ball-result', ball: 99, shooter: 'guest', scored: true })
  assert.deepEqual(stale, s, 'bola de índice errado não aplica')
})

test('abandono dá vitória por W.O. ao outro lado', () => {
  let s = start('host')
  s = ball(s, true)
  s = applyDuelEvent(s, { type: 'forfeit', by: 'guest' })
  assert.equal(s.phase, 'done')
  assert.equal(s.winner, 'host')
  assert.equal(s.byForfeit, true)
})

test('applyDuelEvent é imutável', () => {
  const s0 = start('host')
  const frozen = JSON.stringify(s0)
  ball(s0, true)
  assert.equal(JSON.stringify(s0), frozen)
})

test('validateDuelMsg aceita mensagens bem formadas e rejeita lixo', () => {
  assert.ok(validateDuelMsg({ type: 'start', firstShooter: 'host' }))
  assert.ok(validateDuelMsg({ type: 'ball-result', ball: 1, shooter: 'guest', scored: false }))
  assert.ok(validateDuelMsg({ type: 'kick', ball: 1, shot: { x: 0.5, y: 0.5 }, power: 0.7, cavadinha: false, specialId: null, runupDuration: 0.34, flightDur: 0.5, offTarget: false, overBar: false, pose: 'normal' }))
  assert.ok(validateDuelMsg({ type: 'feint' }))
  assert.ok(validateDuelMsg({ type: 'hello', role: 'guest' }))
  assert.ok(validateDuelMsg({ type: 'ping' }))
  assert.equal(validateDuelMsg(null), null)
  assert.equal(validateDuelMsg({ type: 'hack' }), null)
  assert.equal(validateDuelMsg({ type: 'ball-result', ball: 'x' }), null)
})
