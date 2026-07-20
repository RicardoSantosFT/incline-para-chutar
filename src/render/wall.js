// Barreira da cobrança de falta: N jogadores rivais na linha bola→gol, a
// 9,15m da bola, com tamanho proporcional à perspectiva (1,85m de altura na
// escala do plano em que estão). Saltam juntos quando a bola sai.
import { WALL_DIST_M, WALL_PLAYER_W_M } from '../game/freekick.js'

const PLAYER_H_M = 1.85
const JUMP_M = 0.35
const GOAL_H_M = 2.44
const wallFract = (v) => v - Math.floor(v)
const wallRand = (i) => wallFract(Math.sin(i * 91.7 + 47.3) * 24634.6345)

// Mesma perspectiva do voo da bola: escala 1 na bola, 0,42 no gol
export function wallScreenAt(g, fraction) {
  const x = g.spotX + (g.goalCX - g.spotX) * fraction
  const y = g.spotY + (g.goalBaseY - g.spotY) * fraction
  const scale = 1 - 0.58 * fraction
  const pxPerMGoal = (2 * g.aimHalf) / 7.32
  const pxPerM = (pxPerMGoal * scale) / 0.42
  return { x, y, scale, pxPerM }
}

export function drawWall(ctx, g, falta, { jumpT = 0, time = 0 } = {}) {
  const fraction = WALL_DIST_M / falta.spot.d
  const plane = wallScreenAt(g, fraction)
  const wPx = WALL_PLAYER_W_M * plane.pxPerM
  const hPx = (PLAYER_H_M / GOAL_H_M) * GOAL_H_M * plane.pxPerM
  const lift = Math.sin(Math.PI * Math.min(1, jumpT)) * JUMP_M * plane.pxPerM
  const n = falta.wallCount
  const startX = plane.x - (n * wPx) / 2

  for (let i = 0; i < n; i++) {
    const px = startX + i * wPx + wPx / 2
    const sway = jumpT > 0 ? 0 : Math.sin(time * 1.7 + i * 1.3) * wPx * 0.03
    const baseY = plane.y
    const topY = baseY - hPx - lift
    // Sombra no gramado (fica no chão mesmo com o salto)
    ctx.fillStyle = 'rgba(2, 8, 20, 0.35)'
    ctx.beginPath()
    ctx.ellipse(px, baseY + 2, wPx * 0.42, wPx * 0.13, 0, 0, Math.PI * 2)
    ctx.fill()

    const shade = 0.85 + wallRand(i) * 0.15
    ctx.save()
    ctx.translate(px + sway, 0)
    // Pernas
    ctx.fillStyle = `rgba(16, 42, 84, ${shade})`
    ctx.fillRect(-wPx * 0.3, baseY - hPx * 0.42 - lift, wPx * 0.24, hPx * 0.42)
    ctx.fillRect(wPx * 0.06, baseY - hPx * 0.42 - lift, wPx * 0.24, hPx * 0.42)
    // Tronco (camisa azul rival)
    ctx.fillStyle = `rgba(37, 108, 190, ${shade})`
    const bodyH = hPx * 0.4
    roundRectWall(ctx, -wPx * 0.36, topY + hPx * 0.18, wPx * 0.72, bodyH, wPx * 0.16)
    ctx.fill()
    // Braços: protegendo (parado) ou esticados para cima (salto)
    ctx.strokeStyle = `rgba(37, 108, 190, ${shade})`
    ctx.lineWidth = wPx * 0.16
    ctx.lineCap = 'round'
    ctx.beginPath()
    if (jumpT > 0) {
      ctx.moveTo(-wPx * 0.3, topY + hPx * 0.22)
      ctx.lineTo(-wPx * 0.38, topY - hPx * 0.08)
      ctx.moveTo(wPx * 0.3, topY + hPx * 0.22)
      ctx.lineTo(wPx * 0.38, topY - hPx * 0.08)
    } else {
      ctx.moveTo(-wPx * 0.26, topY + hPx * 0.26)
      ctx.lineTo(0, topY + hPx * 0.5)
      ctx.moveTo(wPx * 0.26, topY + hPx * 0.26)
      ctx.lineTo(0, topY + hPx * 0.5)
    }
    ctx.stroke()
    // Cabeça
    ctx.fillStyle = `rgba(226, 190, 156, ${shade})`
    ctx.beginPath()
    ctx.arc(0, topY + hPx * 0.09, wPx * 0.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

function roundRectWall(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
