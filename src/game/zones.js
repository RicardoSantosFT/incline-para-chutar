// Colunas do gol (o mergulho do goleiro rival é sorteado por coluna) e a
// grade de pontuação 3×3. Os pontos seguem a dificuldade estatística medida
// no próprio motor (Monte Carlo): ângulos são difíceis de executar (risco de
// isolar) e de defender; meia altura no centro é a zona de conforto do goleiro.
export const ZONES = [
  { id: 'esquerda', from: -1, to: -1 / 3 },
  { id: 'centro', from: -1 / 3, to: 1 / 3 },
  { id: 'direita', from: 1 / 3, to: 1 },
]

// 6 colunas: trave-esq | meia-esq | centro-esq | centro-dir | meia-dir | trave-dir
export const GRID_COLS = ['trave-esq', 'meia-esq', 'centro-esq', 'centro-dir', 'meia-dir', 'trave-dir']
const ROW_POINTS = {
  alto: { trave: 250, meia: 175, centro: 150 },
  meio: { trave: 150, meia: 100, centro: 50 },
  baixo: { trave: 175, meia: 125, centro: 75 },
}
export const ZONE_GRID = {}
for (const [row, byCol] of Object.entries(ROW_POINTS)) {
  for (const col of GRID_COLS) {
    ZONE_GRID[`${row}-${col}`] = byCol[col.replace(/-esq|-dir/, '')]
  }
}

const gridColFor = (x) => {
  const clamped = Math.max(-1, Math.min(1, x))
  const index = Math.min(GRID_COLS.length - 1, Math.max(0, Math.floor((clamped + 1) * 3)))
  return GRID_COLS[index]
}

const colFor = (x) => {
  const clamped = Math.max(-1, Math.min(1, x))
  if (clamped < -1 / 3) return 'esquerda'
  if (clamped > 1 / 3) return 'direita'
  return 'centro'
}

const rowFor = (y) => {
  const clamped = Math.max(0, Math.min(1, y))
  if (clamped < 1 / 3) return 'baixo'
  if (clamped > 2 / 3) return 'alto'
  return 'meio'
}

export function zoneForX(x) {
  return ZONES.find((z) => z.id === colFor(x))
}

export function zoneCenter(id) {
  const zone = ZONES.find((z) => z.id === id)
  return (zone.from + zone.to) / 2
}

export function zoneIdForPlacement(x, y) {
  return `${rowFor(y)}-${gridColFor(x)}`
}

export function pointsForPlacement(x, y) {
  return ZONE_GRID[zoneIdForPlacement(x, y)]
}

export function isOffTarget(x) {
  return Math.abs(x) > 1
}

export function isOffTarget2D(x, y) {
  return Math.abs(x) > 1 || y > 1
}
