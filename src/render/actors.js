// Atores da cena: bola, goleiro, batedor (terceira pessoa) e retícula de mira.
// Quando os sprites da raposa estão carregados, eles substituem os vetores.
import { hasSprite, drawSprite } from './sprites.js'

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

const KEEPER_PALETTES = {
  rival: { shirt: '#ffdf1b', shirtDark: '#d3a900', glow: 'rgba(255, 223, 27, 0.45)' },
  player: { shirt: '#78f33f', shirtDark: '#3fae1d', glow: 'rgba(120, 243, 63, 0.55)' },
}

// Goleiro estilizado.
// pose: { x, diveDir -1..1, diveT 0..1, sway, reachY 0..1 (braços/salto),
//         crouch 0..1 (agachado carregando impulso), grounded (caído),
//         feint 0..1 (amplitude da finta provocativa) }
// Escolhe o sprite do goleiro pela pose. A série amarela serve para os dois
// modos: a raposa é o protagonista do jogo.
function drawKeeperSprite(ctx, g, pose) {
  const dive = pose.diveT ?? 0
  const dir = pose.diveDir ?? 0
  const feint = pose.feint ?? 0
  let name = 'goleiro-parado'
  let heightMult = 1
  if (pose.grounded) {
    name = 'goleiro-caido'
    heightMult = 0.42
  } else if (dive > 0.25 && Math.abs(dir) > 0.2) {
    name = 'goleiro-mergulho'
    heightMult = 0.55
  } else if (dive > 0.25) {
    name = 'goleiro-provocando' // salto vertical de braços esticados
    heightMult = 1.06
  } else if ((pose.crouch ?? 0) > 0.3) {
    name = 'goleiro-agachado'
    heightMult = 0.72
  } else if (feint > 0) {
    name = 'goleiro-provocando'
    heightMult = 1.02
  }
  if (!hasSprite(name)) return false

  const H = g.goalH * 0.74
  const feintShift = feint * Math.sin((pose.sway ?? 0) * 26) * g.aimHalf * 0.16
  const jump = Math.sin(dive * Math.PI) * H * (0.2 + (pose.reachY ?? 0.35) * 0.2)
  // Elevação real do voo: keeperY (0..1 na boca do gol) sobe o goleiro
  const lift = Math.max(0, (pose.keeperY ?? 0.35) - 0.35) * g.goalH * 0.9
  if (name === 'goleiro-mergulho') {
    drawSprite(ctx, name, {
      x: pose.x + dir * H * 0.32,
      y: g.goalBaseY - H * 0.34 - jump * 0.4 - lift,
      height: H * heightMult,
      flip: dir < 0, // o sprite voa para a direita da tela
      anchor: 'center',
    })
  } else {
    drawSprite(ctx, name, {
      x: pose.x + feintShift,
      y: g.goalBaseY + 2 - (dive > 0 ? jump : 0) - lift,
      height: H * heightMult,
    })
  }
  return true
}

export function drawKeeper(ctx, g, pose, palette = 'rival') {
  if (drawKeeperSprite(ctx, g, pose)) return
  const colors = KEEPER_PALETTES[palette] ?? KEEPER_PALETTES.rival
  const H = g.goalH * 0.62
  const feetY = g.goalBaseY - 2
  const dive = pose.diveT ?? 0
  const dir = pose.diveDir ?? 0
  const crouch = pose.crouch ?? 0
  const reachY = pose.reachY ?? 0.35
  const lean = dive * dir * (Math.PI / 3.1)
  const jump = Math.sin(dive * Math.PI) * H * (0.22 + reachY * 0.2)
  const feintShift = (pose.feint ?? 0) * Math.sin((pose.sway ?? 0) * 26) * g.aimHalf * 0.16
  const lift = Math.max(0, (pose.keeperY ?? 0.35) - 0.35) * g.goalH * 0.9

  ctx.save()
  ctx.translate(pose.x + feintShift, feetY - jump - lift + (pose.grounded ? H * 0.34 : 0))
  ctx.rotate(pose.grounded ? (dir || 1) * (Math.PI / 2.3) : lean)
  ctx.translate(0, -H * 0.5)
  ctx.scale(1, 1 - crouch * 0.16)

  const sway = dive === 0 && !pose.grounded ? Math.sin((pose.sway ?? 0) * 2.1) * 0.05 : 0
  ctx.rotate(sway)

  // Halo único e barato no lugar de shadowBlur em cada parte do corpo
  const halo = ctx.createRadialGradient(0, -H * 0.1, H * 0.1, 0, -H * 0.1, H * 0.75)
  halo.addColorStop(0, colors.glow)
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(0, -H * 0.1, H * 0.75, 0, Math.PI * 2)
  ctx.fill()

  // Pernas (dobradas quando agachado)
  ctx.strokeStyle = '#0b1d3d'
  ctx.lineWidth = H * 0.13
  ctx.lineCap = 'round'
  const legSpread = dive > 0 ? 0.34 : 0.16 + crouch * 0.14
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

  // Braços: sobem conforme a mira/salto é alto; esticam no mergulho
  ctx.strokeStyle = colors.shirt
  ctx.lineWidth = H * 0.11
  const reach = 0.4 + dive * 0.45
  const armLift = 0.18 + reachY * 0.5
  ctx.beginPath()
  ctx.moveTo(-H * 0.12, -H * 0.18)
  ctx.lineTo(-H * reach * (dir < 0 ? 1.15 : 0.8), -H * (armLift + dive * 0.45))
  ctx.moveTo(H * 0.12, -H * 0.18)
  ctx.lineTo(H * reach * (dir > 0 ? 1.15 : 0.8), -H * (armLift + dive * 0.45))
  ctx.stroke()

  // Luvas
  ctx.fillStyle = '#f2f6ff'
  ctx.beginPath()
  ctx.arc(-H * reach * (dir < 0 ? 1.15 : 0.8), -H * (armLift + dive * 0.45), H * 0.075, 0, Math.PI * 2)
  ctx.arc(H * reach * (dir > 0 ? 1.15 : 0.8), -H * (armLift + dive * 0.45), H * 0.075, 0, Math.PI * 2)
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

const STRIKER_PALETTES = {
  rival: { shirt: '#25a8ff', shirtDark: '#123058', glow: 'rgba(37, 168, 255, 0.28)' },
  player: { shirt: '#78f33f', shirtDark: '#1c5a2e', glow: 'rgba(120, 243, 63, 0.3)' },
}

// Sprite do batedor: só existe a série verde (o jogador); o rival azul
// continua vetorial até a série 4 ser gerada.
function drawStrikerSprite(ctx, g, { progress, kicking, pose, palette }) {
  if (palette !== 'player') return false
  let name
  if (pose === 'comemora') name = 'batedor-comemora'
  else if (kicking) {
    name = pose === 'chaleira' ? 'batedor-chaleira' : pose === 'calcanhar' ? 'batedor-calcanhar' : 'batedor-chute'
  } else if (progress > 0.02 && progress < 0.98) {
    name = Math.floor(progress * 8) % 2 ? 'batedor-corrida-2' : 'batedor-corrida-1'
  } else {
    name = 'batedor-parado'
  }
  if (!hasSprite(name)) return false

  const H = g.h * 0.2
  const startX = g.spotX - g.w * 0.24
  const startY = g.spotY + g.h * 0.04
  const x = startX + (g.spotX - g.ballR * 1.7 - startX) * progress
  const y = startY + (g.spotY - startY) * progress
  drawSprite(ctx, name, { x, y: y + g.ballR * 0.6, height: H })
  return true
}

// Batedor em terceira pessoa.
// opts: { progress 0..1 (corrida), kicking, pose: 'normal'|'chaleira'|'calcanhar'|'comemora',
//         palette: 'rival'|'player', scale }
export function drawStriker(ctx, g, opts) {
  if (drawStrikerSprite(ctx, g, { progress: 0, kicking: false, pose: 'normal', palette: 'rival', ...opts })) return
  const { progress = 0, kicking = false, pose = 'normal', palette = 'rival', scale = 1 } = opts
  const colors = STRIKER_PALETTES[palette] ?? STRIKER_PALETTES.rival
  const H = g.h * 0.17 * scale
  const startX = g.spotX - g.w * 0.24
  const startY = g.spotY + g.h * 0.04
  const x = startX + (g.spotX - g.ballR * 1.7 - startX) * progress
  const y = startY + (g.spotY - startY) * progress

  ctx.save()
  ctx.translate(x, y)
  const stride = kicking ? 0 : Math.sin(progress * Math.PI * 6) * 0.22

  const halo = ctx.createRadialGradient(0, -H * 0.4, H * 0.08, 0, -H * 0.4, H * 0.7)
  halo.addColorStop(0, colors.glow)
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(0, -H * 0.4, H * 0.7, 0, Math.PI * 2)
  ctx.fill()

  // Leve inclinação do corpo por golpe
  if (kicking && pose === 'chaleira') ctx.rotate(-0.18)
  if (kicking && pose === 'calcanhar') ctx.rotate(0.1)

  // Pernas
  ctx.strokeStyle = '#0a1830'
  ctx.lineWidth = H * 0.13
  ctx.lineCap = 'round'
  ctx.beginPath()
  if (kicking && pose === 'chaleira') {
    // Perna de apoio + chute cruzando por trás da outra perna
    ctx.moveTo(0, -H * 0.32)
    ctx.lineTo(-H * 0.1, 0)
    ctx.moveTo(0, -H * 0.32)
    ctx.lineTo(-H * 0.38, -H * 0.06)
  } else if (kicking && pose === 'calcanhar') {
    // De costas para a bola: calcanhar vai para trás e para cima
    ctx.moveTo(0, -H * 0.32)
    ctx.lineTo(-H * 0.12, 0)
    ctx.moveTo(0, -H * 0.32)
    ctx.lineTo(H * 0.3, -H * 0.42)
  } else if (kicking) {
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
  ctx.fillStyle = colors.shirtDark
  roundRect(ctx, -H * 0.15, -H * 0.74, H * 0.3, H * 0.45, H * 0.1)
  ctx.fill()
  ctx.fillStyle = colors.shirt
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
