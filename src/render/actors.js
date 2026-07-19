// Atores da cena: bola, goleiro, atacante (modo goleiro) e retícula de mira.

export function drawBall(ctx, { x, y, scale = 1, spin = 0, alpha = 1 }, g) {
  const r = g.ballR * scale
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)

  // Sombra no chão só quando a bola está "no chão" (escala cheia)
  if (scale > 0.85) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
    ctx.beginPath()
    ctx.ellipse(0, r * 1.18, r * 0.85, r * 0.3, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.rotate(spin)
  const shade = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.15, 0, 0, r * 1.05)
  shade.addColorStop(0, '#ffffff')
  shade.addColorStop(0.55, '#dbe4f2')
  shade.addColorStop(1, '#77839c')
  ctx.fillStyle = shade
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()

  // Gomos
  ctx.fillStyle = '#16213a'
  pent(ctx, 0, -r * 0.1, r * 0.34)
  ctx.globalAlpha = alpha * 0.85
  pent(ctx, -r * 0.62, r * 0.42, r * 0.22)
  pent(ctx, r * 0.62, r * 0.42, r * 0.22)
  pent(ctx, -r * 0.55, -r * 0.62, r * 0.2)
  pent(ctx, r * 0.55, -r * 0.62, r * 0.2)
  ctx.restore()
}

function pent(ctx, cx, cy, r) {
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5
    const px = cx + Math.cos(a) * r
    const py = cy + Math.sin(a) * r
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
}

// Rastro pontilhado da bola (verde neon, como a referência)
export function drawTrail(ctx, points, g) {
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    const a = (i / points.length) * 0.75
    ctx.fillStyle = `rgba(120, 243, 63, ${a})`
    ctx.beginPath()
    ctx.arc(p.x, p.y, Math.max(1.5, g.ballR * 0.22 * (i / points.length + 0.3)), 0, Math.PI * 2)
    ctx.fill()
  }
}

// Goleiro estilizado. pose: { x (px), diveDir -1..1, diveT 0..1, sway }
// palette: 'rival' (amarelo) | 'player' (verde)
export function drawKeeper(ctx, g, pose, palette = 'rival') {
  const colors =
    palette === 'player'
      ? { shirt: '#78f33f', shirtDark: '#3fae1d', glow: 'rgba(120, 243, 63, 0.55)' }
      : { shirt: '#ffdf1b', shirtDark: '#d3a900', glow: 'rgba(255, 223, 27, 0.45)' }

  const H = g.goalH * 0.62
  const feetY = g.goalBaseY - 2
  const dive = pose.diveT ?? 0
  const dir = pose.diveDir ?? 0
  const lean = dive * dir * (Math.PI / 3.1)
  const jump = Math.sin(dive * Math.PI) * H * 0.22

  ctx.save()
  ctx.translate(pose.x, feetY - jump)
  ctx.rotate(lean)
  ctx.translate(0, -H * 0.5)

  const sway = dive === 0 ? Math.sin((pose.sway ?? 0) * 2.1) * 0.05 : 0
  ctx.rotate(sway)

  // Halo único e barato no lugar de shadowBlur em cada parte do corpo
  const halo = ctx.createRadialGradient(0, -H * 0.1, H * 0.1, 0, -H * 0.1, H * 0.75)
  halo.addColorStop(0, colors.glow)
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(0, -H * 0.1, H * 0.75, 0, Math.PI * 2)
  ctx.fill()

  // Pernas
  ctx.strokeStyle = '#0b1d3d'
  ctx.lineWidth = H * 0.13
  ctx.lineCap = 'round'
  const legSpread = dive > 0 ? 0.34 : 0.16
  ctx.beginPath()
  ctx.moveTo(0, H * 0.12)
  ctx.lineTo(-H * legSpread * 0.6, H * 0.5)
  ctx.moveTo(0, H * 0.12)
  ctx.lineTo(H * legSpread, H * 0.48)
  ctx.stroke()

  // Tronco
  ctx.fillStyle = colors.shirt
  roundRect(ctx, -H * 0.16, -H * 0.28, H * 0.32, H * 0.46, H * 0.12)
  ctx.fill()
  ctx.fillStyle = colors.shirtDark
  roundRect(ctx, -H * 0.16, -H * 0.02, H * 0.32, H * 0.2, H * 0.08)
  ctx.fill()

  // Braços: abertos, esticam na direção do mergulho
  ctx.strokeStyle = colors.shirt
  ctx.lineWidth = H * 0.11
  const reach = 0.4 + dive * 0.45
  ctx.beginPath()
  ctx.moveTo(-H * 0.12, -H * 0.18)
  ctx.lineTo(-H * reach * (dir < 0 ? 1.15 : 0.8), -H * (0.3 + dive * 0.45))
  ctx.moveTo(H * 0.12, -H * 0.18)
  ctx.lineTo(H * reach * (dir > 0 ? 1.15 : 0.8), -H * (0.3 + dive * 0.45))
  ctx.stroke()

  // Luvas
  ctx.fillStyle = '#f2f6ff'
  ctx.beginPath()
  ctx.arc(-H * reach * (dir < 0 ? 1.15 : 0.8), -H * (0.3 + dive * 0.45), H * 0.075, 0, Math.PI * 2)
  ctx.arc(H * reach * (dir > 0 ? 1.15 : 0.8), -H * (0.3 + dive * 0.45), H * 0.075, 0, Math.PI * 2)
  ctx.fill()

  // Cabeça
  ctx.fillStyle = '#e8b98a'
  ctx.beginPath()
  ctx.arc(0, -H * 0.4, H * 0.12, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#132c52'
  ctx.beginPath()
  ctx.arc(0, -H * 0.445, H * 0.115, Math.PI, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

// Atacante rival (modo goleiro): silhueta escura se aproximando da bola
export function drawStriker(ctx, g, { progress = 0, kicking = false }) {
  const H = g.h * 0.17
  const startX = g.spotX - g.w * 0.24
  const startY = g.spotY + g.h * 0.04
  const x = startX + (g.spotX - g.ballR * 1.7 - startX) * progress
  const y = startY + (g.spotY - startY) * progress

  ctx.save()
  ctx.translate(x, y)
  const stride = kicking ? 0 : Math.sin(progress * Math.PI * 6) * 0.22

  const halo = ctx.createRadialGradient(0, -H * 0.4, H * 0.08, 0, -H * 0.4, H * 0.7)
  halo.addColorStop(0, 'rgba(37, 168, 255, 0.28)')
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(0, -H * 0.4, H * 0.7, 0, Math.PI * 2)
  ctx.fill()

  // Pernas
  ctx.strokeStyle = '#0a1830'
  ctx.lineWidth = H * 0.13
  ctx.lineCap = 'round'
  ctx.beginPath()
  if (kicking) {
    ctx.moveTo(0, -H * 0.32)
    ctx.lineTo(-H * 0.14, 0)
    ctx.moveTo(0, -H * 0.32)
    ctx.lineTo(H * 0.42, -H * 0.18)
  } else {
    ctx.moveTo(0, -H * 0.32)
    ctx.lineTo(-H * (0.12 + stride), 0)
    ctx.moveTo(0, -H * 0.32)
    ctx.lineTo(H * (0.12 - stride), 0)
  }
  ctx.stroke()

  // Tronco + cabeça
  ctx.fillStyle = '#123058'
  roundRect(ctx, -H * 0.15, -H * 0.74, H * 0.3, H * 0.45, H * 0.1)
  ctx.fill()
  ctx.fillStyle = '#25a8ff'
  roundRect(ctx, -H * 0.15, -H * 0.74, H * 0.3, H * 0.12, H * 0.06)
  ctx.fill()
  ctx.fillStyle = '#c8935f'
  ctx.beginPath()
  ctx.arc(0, -H * 0.85, H * 0.11, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// Retícula de mira estilo radar. stability 0..1 muda a cor (verde = estável).
export function drawReticle(ctx, g, { x, y, stability, time }) {
  const r = g.w * 0.052
  const green = { r: 120, g: 243, b: 63 }
  const yellow = { r: 255, g: 223, b: 27 }
  const mix = (a, b, t) => Math.round(a + (b - a) * t)
  const t = 1 - stability
  const col = `${mix(green.r, yellow.r, t)}, ${mix(green.g, yellow.g, t)}, ${mix(green.b, yellow.b, t)}`

  ctx.save()
  ctx.translate(x, y)

  // Disco escuro atrás da retícula: garante contraste sobre qualquer fundo
  // (inclusive o goleiro amarelo) sem precisar de shadowBlur
  ctx.fillStyle = 'rgba(2, 12, 37, 0.45)'
  ctx.beginPath()
  ctx.arc(0, 0, r * 1.14, 0, Math.PI * 2)
  ctx.fill()

  // Brilho suave: anel largo de baixa opacidade por trás dos traços
  ctx.strokeStyle = `rgba(${col}, 0.25)`
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.stroke()

  ctx.strokeStyle = `rgba(${col}, 0.9)`

  // Anel externo pontilhado girando
  ctx.lineWidth = 2
  ctx.setLineDash([6, 7])
  ctx.lineDashOffset = -time * 26
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  // Arco de estabilidade (fecha conforme a mira firma)
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.68, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * stability)
  ctx.stroke()

  // Cruz + ponto central
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(-r * 0.45, 0)
  ctx.lineTo(-r * 0.2, 0)
  ctx.moveTo(r * 0.2, 0)
  ctx.lineTo(r * 0.45, 0)
  ctx.moveTo(0, -r * 0.45)
  ctx.lineTo(0, -r * 0.2)
  ctx.moveTo(0, r * 0.2)
  ctx.lineTo(0, r * 0.45)
  ctx.stroke()
  ctx.fillStyle = `rgba(${col}, 1)`
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.11, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
