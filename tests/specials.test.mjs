import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SPECIALS, pickSpecial } from '../src/game/specials.js'

test('existem os quatro especiais pedidos', () => {
  const ids = SPECIALS.map((s) => s.id)
  for (const id of ['chaleira', 'calcanhar', 'curva', 'paradinha']) {
    assert.ok(ids.includes(id), `faltou especial ${id}`)
  }
})

test('todo especial tem nome em PT, bônus de estilo e modificadores', () => {
  for (const s of SPECIALS) {
    assert.ok(s.nome.length > 3)
    assert.ok(s.style > 0)
    assert.ok(typeof s.spread === 'number')
    assert.ok(s.reachMult > 0 && s.reachMult <= 1)
  }
})

test('pickSpecial varre todos conforme o rng', () => {
  const seen = new Set()
  for (let v = 0; v < 1; v += 0.03) seen.add(pickSpecial(v).id)
  assert.equal(seen.size, SPECIALS.length)
})

test('pickSpecial com exclusão nunca repete o anterior (re-sorteio ao chacoalhar de novo)', () => {
  for (let v = 0; v < 1; v += 0.03) {
    assert.notEqual(pickSpecial(v, 'curva').id, 'curva')
  }
})

test('paradinha tem chance de comprometer o goleiro', () => {
  const paradinha = SPECIALS.find((s) => s.id === 'paradinha')
  assert.ok(paradinha.commitChance > 0.5 && paradinha.commitChance < 1)
})
