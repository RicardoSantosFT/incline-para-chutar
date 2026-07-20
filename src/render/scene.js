// Cenário: estádio noturno, torcida, placas, gramado e gol com a grade 3×3.
// Todas as funções recebem a geometria `g` calculada a partir do tamanho do canvas.
import { ZONE_GRID, GRID_COLS } from '../game/zones.js'

export function geometry(w, h) {
  const goalW = w * 0.76
  const goalCX = w / 2
  const crossbarY = h * 0.16
  const goalBaseY = h * 0.46
  const postW = Math.max(3, w * 0.013)
  const aimHalf = goalW / 2 - postW * 2.2
  return {
    w,
    h,
    goalW,
    goalCX,
    crossbarY,
    goalBaseY,
    goalH: goalBaseY - crossbarY,
    postW,
    aimHalf,
    boardTop: h * 0.28,
    horizonY: h * 0.34,
    spotX: w / 2,
    spotY: h * 0.865,
    ballR: w * 0.036,
    // Converte mira normalizada (-1..1) em x na boca do gol
    gx(n) {
      return goalCX + n * aimHalf
    },
    // Converte altura normalizada (0 = chão, 1 = travessão) em y
    gy(n) {
      return goalBaseY - n * (goalBaseY - crossbarY)
    },
  }
}

const fract = (v) => v - Math.floor(v)
const rand = (i) => fract(Math.sin(i * 127.1 + 311.7) * 43758.5453)

const CROWD_COLORS = ['#16386b', '#0f2c56', '#1f4680', '#28548f', '#123c6e']
const CROWD_ACCENTS = ['#78f33f', '#a78bfa', '#25a8ff', '#ffdf1b']

// O estádio quase todo é estático: desenhamos uma vez num canvas offscreen
// por geometria (resize) e só pintamos flashes e letreiros a cada frame.
const staticCache = { key: '', canvas: null }
const SUPERSAMPLE = 2

export function drawStadium(ctx, g, time) {
  const key = `${g.w}x${g.h}`
  if (staticCache.key !== key) {
    staticCache.key = key
    staticCache.canvas = buildStaticStadium(g)
  }
  ctx.drawImage(staticCache.canvas, 0, 0, g.w, g.h)
  drawStadiumDynamic(ctx, g, time)
}

function buildStaticStadium(g) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(g.w * SUPERSAMPLE))
  canvas.height = Math.max(1, Math.round(g.h * SUPERSAMPLE))
  const ctx = canvas.getContext('2d')
  ctx.scale(SUPERSAMPLE, SUPERSAMPLE)
  const { w, h } = g

  // Céu / fundo alto
  const sky = ctx.createLinearGradient(0, 0, 0, g.horizonY)
  sky.addColorStop(0, '#02081c')
  sky.addColorStop(1, '#062252')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, g.horizonY)

  // Torcida: pontos em fileiras, alguns com cores de bandeira
  const spacing = Math.max(6, w / 58)
  const rows = Math.floor(g.boardTop / spacing)
  for (let r = 0; r < rows; r++) {
    const y = r * spacing + spacing * 0.6
    const shade = 0.35 + 0.65 * (r / rows)
    for (let c = 0; c <= Math.ceil(w / spacing); c++) {
      const i = r * 97 + c
      const jx = (rand(i) - 0.5) * spacing * 0.5
      const jy = (rand(i + 51) - 0.5) * spacing * 0.4
      const accent = rand(i + 13) > 0.965
      ctx.fillStyle = accent
        ? CROWD_ACCENTS[Math.floor(rand(i + 7) * CROWD_ACCENTS.length)]
        : CROWD_COLORS[Math.floor(rand(i + 29) * CROWD_COLORS.length)]
      ctx.globalAlpha = shade * (accent ? 0.9 : 0.8)
      ctx.beginPath()
      ctx.arc(c * spacing + jx, y + jy, spacing * 0.22, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1

  // Halo do holofote sobre o gol
  const glow = ctx.createRadialGradient(w / 2, g.crossbarY, 10, w / 2, g.crossbarY, w * 0.7)
  glow.addColorStop(0, 'rgba(37, 168, 255, 0.14)')
  glow.addColorStop(1, 'rgba(37, 168, 255, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, g.horizonY + 40)

  // Placas de publicidade (o letreiro pulsante é desenhado por frame)
  const boardH = g.horizonY - g.boardTop
  const boards = ctx.createLinearGradient(0, g.boardTop, 0, g.horizonY)
  boards.addColorStop(0, '#04122c')
  boards.addColorStop(1, '#071e42')
  ctx.fillStyle = boards
  ctx.fillRect(0, g.boardTop, w, boardH)
  ctx.strokeStyle = 'rgba(82, 132, 223, 0.35)'
  ctx.lineWidth = 1
  ctx.strokeRect(-2, g.boardTop, w + 4, boardH)

  // Gramado com faixas em perspectiva
  const grass = ctx.createLinearGradient(0, g.horizonY, 0, h)
  grass.addColorStop(0, '#0e4126')
  grass.addColorStop(0.5, '#0a3520')
  grass.addColorStop(1, '#052312')
  ctx.fillStyle = grass
  ctx.fillRect(0, g.horizonY, w, h - g.horizonY)

  const bands = 7
  for (let i = 0; i < bands; i++) {
    // Faixas horizontais que encolhem em direção ao horizonte
    const t0 = i / bands
    const t1 = (i + 0.5) / bands
    const y0 = g.horizonY + (h - g.horizonY) * t0 * t0 * 0.92
    const y1 = g.horizonY + (h - g.horizonY) * t1 * t1 * 0.92
    ctx.fillStyle = 'rgba(150, 255, 140, 0.045)'
    ctx.fillRect(0, y0, w, Math.max(1.5, y1 - y0))
  }

  // Corredor iluminado do pênalti até o gol (como na referência)
  const lane = ctx.createLinearGradient(0, g.goalBaseY, 0, g.spotY)
  lane.addColorStop(0, 'rgba(120, 243, 63, 0.16)')
  lane.addColorStop(1, 'rgba(120, 243, 63, 0.03)')
  ctx.fillStyle = lane
  ctx.beginPath()
  ctx.moveTo(g.goalCX - g.goalW * 0.2, g.goalBaseY)
  ctx.lineTo(g.goalCX + g.goalW * 0.2, g.goalBaseY)
  ctx.lineTo(g.goalCX + g.goalW * 0.34, g.spotY + 30)
  ctx.lineTo(g.goalCX - g.goalW * 0.34, g.spotY + 30)
  ctx.closePath()
  ctx.fill()

  // Linhas da pequena e grande área
  ctx.strokeStyle = 'rgba(220, 240, 255, 0.28)'
  ctx.lineWidth = Math.max(1.5, w * 0.005)
  areaRect(ctx, g, 1.28, 0.16)
  areaRect(ctx, g, 2.05, 0.34)

  // Marca do pênalti
  ctx.fillStyle = 'rgba(230, 245, 255, 0.5)'
  ctx.beginPath()
  ctx.ellipse(g.spotX, g.spotY + g.ballR * 1.5, g.ballR * 0.5, g.ballR * 0.2, 0, 0, Math.PI * 2)
  ctx.fill()

  return canvas
}

// Partes vivas do estádio: flashes de fotógrafos + letreiros pulsantes
function drawStadiumDynamic(ctx, g, time) {
  const { w } = g
  for (let i = 0; i < 14; i++) {
    const fx = rand(i * 3.7) * w
    const fy = rand(i * 9.1) * g.boardTop * 0.9
    const phase = fract(time * (0.35 + rand(i) * 0.5) + rand(i * 5.3))
    if (phase < 0.06) {
      const alpha = 1 - phase / 0.06
      ctx.fillStyle = `rgba(240, 250, 255, ${alpha * 0.9})`
      ctx.beginPath()
      ctx.arc(fx, fy, 1.6 + alpha * 2.4, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const boardH = g.horizonY - g.boardTop
  const boardY = g.boardTop + boardH / 2
  ctx.font = `italic 900 ${boardH * 0.5}px Inter, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const glowPulse = 0.5 + 0.2 * Math.sin(time * 1.8)
  ctx.fillStyle = `rgba(120, 243, 63, ${glowPulse})`
  ctx.fillText('RADAR FC', w * 0.16, boardY)
  ctx.fillText('RADAR FC', w * 0.84, boardY)
  ctx.fillStyle = `rgba(167, 139, 250, ${glowPulse * 0.9})`
  ctx.fillText('⟡', w * 0.5, boardY)
}

// Retângulo de área com perspectiva simples (mais largo na frente)
function areaRect(ctx, g, widthFactor, depthFactor) {
  const backY = g.goalBaseY + 2
  const frontY = g.goalBaseY + (g.h - g.goalBaseY) * depthFactor
  const backHalf = (g.goalW / 2) * widthFactor * 0.82
  const frontHalf = (g.goalW / 2) * widthFactor
  ctx.beginPath()
  ctx.moveTo(g.goalCX - backHalf, backY)
  ctx.lineTo(g.goalCX - frontHalf, frontY)
  ctx.lineTo(g.goalCX + frontHalf, frontY)
  ctx.lineTo(g.goalCX + backHalf, backY)
  ctx.stroke()
}

// Gradientes que dependem só da geometria: recriados apenas no resize
const gradCache = new WeakMap()
function gradientsFor(ctx, g) {
  let grads = gradCache.get(g)
  if (!grads) {
    const inner = ctx.createLinearGradient(0, g.crossbarY, 0, g.goalBaseY)
    inner.addColorStop(0, 'rgba(2, 10, 28, 0.72)')
    inner.addColorStop(1, 'rgba(4, 16, 40, 0.35)')
    const vignette = ctx.createRadialGradient(g.w / 2, g.h * 0.45, g.w * 0.3, g.w / 2, g.h * 0.55, g.w * 0.85)
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
    vignette.addColorStop(1, 'rgba(1, 5, 15, 0.55)')
    grads = { inner, vignette }
    gradCache.set(g, grads)
  }
  return grads
}

// Zonas de pontuação + rede + traves. `ripple` (0..1) balança a rede,
// `highlight` destaca uma zona ('esquerda'|'centro'|'direita'|null).
export function drawGoalAndZones(ctx, g, { time = 0, ripple = 0, highlight = null, showZones = true } = {}) {
  const left = g.goalCX - g.goalW / 2
  const right = g.goalCX + g.goalW / 2
  const innerLeft = g.gx(-1)
  const innerRight = g.gx(1)
  const innerW = innerRight - innerLeft

  // Sombra interna do gol
  ctx.fillStyle = gradientsFor(ctx, g).inner
  ctx.fillRect(innerLeft, g.crossbarY, innerW, g.goalH)

  // Grade 6×3 de pontuação: cor e brilho por valor (dificuldade estatística)
  if (showZones) {
    const rows = [
      ['alto', 2 / 3, 1],
      ['meio', 1 / 3, 2 / 3],
      ['baixo', 0, 1 / 3],
    ]
    const TIER_COLORS = {
      250: ['120, 243, 63', 0.32],
      175: ['120, 243, 63', 0.17],
      150: ['167, 139, 250', 0.26],
      125: ['167, 139, 250', 0.18],
      100: ['167, 139, 250', 0.12],
      75: ['37, 168, 255', 0.14],
      50: ['37, 168, 255', 0.08],
    }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const pad = innerW * 0.005
    for (const [rowId, y0, y1] of rows) {
      for (let c = 0; c < GRID_COLS.length; c++) {
        const x0 = -1 + c / 3
        const x1 = x0 + 1 / 3
        const id = `${rowId}-${GRID_COLS[c]}`
        const points = ZONE_GRID[id]
        const [color, baseAlpha] = TIER_COLORS[points]
        const zx = g.gx(x0)
        const zw = g.gx(x1) - zx
        const zy = g.gy(y1)
        const zh = g.gy(y0) - zy
        const isHot = highlight === id
        ctx.fillStyle = `rgba(${color}, ${isHot ? 0.5 : baseAlpha})`
        ctx.fillRect(zx + pad, zy + pad, zw - pad * 2, zh - pad * 2)
        ctx.strokeStyle = `rgba(${color}, ${isHot ? 0.95 : 0.35})`
        ctx.lineWidth = isHot ? 2.5 : 1
        ctx.strokeRect(zx + pad, zy + pad, zw - pad * 2, zh - pad * 2)
        ctx.font = `italic 900 ${g.goalH * 0.085}px Inter, sans-serif`
        ctx.fillStyle = `rgba(${color}, ${isHot ? 1 : 0.8})`
        if (isHot) {
          ctx.shadowColor = `rgba(${color}, 0.8)`
          ctx.shadowBlur = 16
        }
        ctx.fillText(String(points), zx + zw / 2, zy + zh / 2)
        ctx.shadowBlur = 0
      }
    }
  }

  // Rede (com ondulação quando toma gol)
  ctx.strokeStyle = 'rgba(214, 230, 255, 0.22)'
  ctx.lineWidth = 1
  const cols = 12
  const rowsN = 7
  for (let i = 0; i <= cols; i++) {
    const nx = innerLeft + (innerW / cols) * i
    ctx.beginPath()
    for (let r = 0; r <= rowsN; r++) {
      const ny = g.crossbarY + (g.goalH / rowsN) * r
      const wob = ripple * Math.sin(r * 1.4 + time * 22 + i) * 6 * (r / rowsN)
      if (r === 0) ctx.moveTo(nx + wob, ny)
      else ctx.lineTo(nx + wob, ny)
    }
    ctx.stroke()
  }
  for (let r = 1; r <= rowsN; r++) {
    const ny = g.crossbarY + (g.goalH / rowsN) * r
    ctx.beginPath()
    for (let i = 0; i <= cols; i++) {
      const nx = innerLeft + (innerW / cols) * i
      const wob = ripple * Math.sin(r * 1.4 + time * 22 + i) * 6 * (r / rowsN)
      if (i === 0) ctx.moveTo(nx + wob, ny)
      else ctx.lineTo(nx + wob, ny)
    }
    ctx.stroke()
  }

  // Traves: brilho via passe largo translúcido + passe nítido (sem shadowBlur)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(left + g.postW / 2, g.goalBaseY + g.postW)
  ctx.lineTo(left + g.postW / 2, g.crossbarY)
  ctx.lineTo(right - g.postW / 2, g.crossbarY)
  ctx.lineTo(right - g.postW / 2, g.goalBaseY + g.postW)
  ctx.strokeStyle = 'rgba(180, 220, 255, 0.28)'
  ctx.lineWidth = g.postW * 2.4
  ctx.stroke()
  ctx.strokeStyle = '#e8f2ff'
  ctx.lineWidth = g.postW
  ctx.stroke()
  ctx.lineCap = 'butt'
}

export function drawVignette(ctx, g) {
  ctx.fillStyle = gradientsFor(ctx, g).vignette
  ctx.fillRect(0, 0, g.w, g.h)
}
