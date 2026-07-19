// Chutes especiais armados ao chacoalhar o celular no modo artilheiro.
// spread: perda de precisão; reachMult: quanto o alcance do goleiro encolhe
// (bola difícil de ler); style: bônus de pontos se a bola entrar.
export const SPECIALS = [
  { id: 'chaleira', nome: 'De chaleira', spread: 0.06, reachMult: 1, style: 75 },
  { id: 'calcanhar', nome: 'De calcanhar', spread: 0.08, reachMult: 1, style: 75 },
  { id: 'curva', nome: 'Com curva', spread: 0.04, reachMult: 0.8, style: 50 },
  // reachMultRead: quando o goleiro NÃO compra a paradinha, ele fica ligado
  // e o alcance dele cresce — o golpe tem risco real
  { id: 'paradinha', nome: 'Paradinha', spread: 0.02, reachMult: 0.55, reachMultRead: 1.15, style: 60, commitChance: 0.7 },
]

// Sorteia um especial; com excludeId, garante que o re-sorteio muda o golpe.
export function pickSpecial(rngValue, excludeId = null) {
  const pool = SPECIALS.filter((s) => s.id !== excludeId)
  const index = Math.min(pool.length - 1, Math.floor(rngValue * pool.length))
  return pool[index]
}
