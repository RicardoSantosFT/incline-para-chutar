// Efeitos: partículas, textos flutuantes e tremida de tela.
// O estado vive em um objeto criado por createFx(); o jogo chama update/draw.

export function createFx() {
  return { particles: [], floats: [], shakeT: 0, shakeMag: 0, shakePhase: 0, ripple: 0 }
}

export function resetFx(fx) {
  fx.particles = []
  fx.floats = []
  fx.shakeT = 0
  fx.shakeMag = 0
  fx.shakePhase = 0
  fx.ripple = 0
}

const GOAL_COLORS = ['120, 243, 63', '167, 139, 250', '248, 250, 255', '255, 223, 27']
const SAVE_COLORS = ['255, 223, 27', '248, 250, 255', '37, 168, 255']

export function burst(fx, x, y, kind = 'goal') {
  const colors = kind === 'save' ? SAVE_COLORS : GOAL_COLORS
  const count = kind === 'goal' ? 42 : 26
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const speed = 60 + Math.random() * 260
    fx.particles.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - 80,
      life: 0.6 + Math.random() * 0.6,
      age: 0,
      size: 1.5 + Math.random() * 3,
      color: colors[Math.floor(Math.random() * colors.length)],
    })
  }
}

export function floatText(fx, text, x, y, color = '120, 243, 63') {
  fx.floats.push({ text, x, y, age: 0, life: 1.1, color })
}

export function shake(fx, magnitude = 7) {
  fx.shakeT = 0.4
  fx.shakeMag = magnitude
}

export function ripple(fx) {
  fx.ripple = 1
}

export function updateFx(fx, dt) {
  for (const p of fx.particles) {
    p.age += dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vy += 420 * dt
  }
  fx.particles = fx.particles.filter((p) => p.age < p.life)

  for (const f of fx.floats) f.age += dt
  fx.floats = fx.floats.filter((f) => f.age < f.life)

  fx.shakeT = Math.max(0, fx.shakeT - dt)
  fx.shakePhase += dt * 62
  fx.ripple = Math.max(0, fx.ripple - dt * 1.6)
}

// Deslocamento de tremida a aplicar no ctx antes de desenhar o frame.
// Determinístico (fase senoidal): render não consome Math.random.
export function shakeOffset(fx) {
  if (fx.shakeT <= 0) return { x: 0, y: 0 }
  const decay = fx.shakeT / 0.4
  return {
    x: Math.sin(fx.shakePhase) * fx.shakeMag * decay,
    y: Math.cos(fx.shakePhase * 1.31) * fx.shakeMag * decay,
  }
}

export function drawFx(ctx, fx) {
  for (const p of fx.particles) {
    const a = 1 - p.age / p.life
    ctx.fillStyle = `rgba(${p.color}, ${a})`
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fill()
  }
  for (const f of fx.floats) {
    const t = f.age / f.life
    const a = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85
    ctx.save()
    ctx.globalAlpha = Math.max(0, a)
    ctx.fillStyle = `rgb(${f.color})`
    ctx.shadowColor = `rgba(${f.color}, 0.8)`
    ctx.shadowBlur = 14
    ctx.font = `italic 900 ${22 + 6 * (1 - t)}px Inter, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(f.text, f.x, f.y - t * 46)
    ctx.restore()
  }
}
