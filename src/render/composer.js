import { AIM_LIMIT_X, AIM_LIMIT_Y, KEEPER_CLAMP, WINDUP_S, DIVE_ANIM_S, DEFENSE_CHARGE_S } from '../game/constants.js'
import { drawBall, drawTrail, drawKeeper, drawStriker, drawReticle } from './actors.js'

// Composição das cenas dos dois modos. Recebe o estado do jogo e desenha;
// muta apenas game.spin e game.trail (efeitos visuais do voo).

const easeOutQuad = (t) => 1 - (1 - t) * (1 - t)

// Posição da bola no voo em direção a (targetX, targetY) normalizados.
// curve entorta a trajetória (chute com curva); arcBoost aumenta a parábola.
export function ballFlightPos(g, t, targetX, targetY, { curve = false, arcBoost = 0 } = {}) {
  const targetPx = g.gx(targetX)
  const targetPy = g.gy(Math.min(targetY, 1.3))
  let x
  if (curve) {
    // Bézier: sai para o lado oposto e fecha no alvo
    const ctrlX = g.spotX - (targetPx - g.spotX) * 0.55
    const tt = easeOutQuad(t)
    x = (1 - tt) * (1 - tt) * g.spotX + 2 * (1 - tt) * tt * ctrlX + tt * tt * targetPx
  } else {
    x = g.spotX + (targetPx - g.spotX) * easeOutQuad(t)
  }
  const y = g.spotY + (targetPy - g.spotY) * t - Math.sin(Math.PI * t) * g.h * (0.05 + arcBoost)
  const scale = 1 - 0.58 * t
  return { x, y, scale }
}

function pushTrail(game, pos) {
  game.trail.push({ x: pos.x, y: pos.y })
  if (game.trail.length > 14) game.trail.shift()
}

export function renderStriker(ctx, g, game) {
  const { phase, phaseT, shot } = game
  const dt = game.frameDt ?? 0.016

  // Goleiro rival (pose calculada primeiro; a ordem de desenho depende da bola)
  let keeperPose
  if (phase === 'runup' && shot.committed) {
    // Comprou a paradinha: mergulha antes de a bola sair
    const diveT = Math.max(0, Math.min(1, (phaseT / shot.runupDuration - 0.3) / 0.45))
    const dir = Math.sign(shot.dive.x) || 0
    const x = g.gx(0) + (g.gx(shot.dive.x) - g.gx(0)) * diveT
    keeperPose = { x, diveDir: dir, diveT, reachY: shot.dive.y, grounded: diveT >= 1 }
  } else if (phase === 'flight' || phase === 'outcome') {
    const grounded = shot.committed
    const diveT = grounded ? 1 : phase === 'flight' ? Math.max(0, Math.min(1, (phaseT / shot.flightDur - 0.12) / 0.55)) : 1
    const dir = Math.sign(shot.dive.x) || 0
    const x = grounded ? g.gx(shot.dive.x) : g.gx(0) + (g.gx(shot.dive.x) - g.gx(0)) * diveT
    keeperPose = { x, diveDir: dir, diveT: dir === 0 ? diveT * 0.25 : diveT, reachY: shot.dive.y, grounded }
  } else {
    keeperPose = { x: g.gx(0), diveDir: 0, diveT: 0, sway: game.time, reachY: 0.35 }
  }

  // Gol marcado: no outcome a bola está na rede, atrás do goleiro
  const ballInNet = phase === 'outcome' && shot && !shot.saved && !shot.offTarget

  if (phase === 'aim') {
    drawKeeper(ctx, g, keeperPose, 'rival')
    drawStriker(ctx, g, { progress: 0, kicking: false, palette: 'player' })
    drawBall(ctx, { x: g.spotX, y: g.spotY, scale: 1, spin: 0 }, g)
    const rx = Math.max(-AIM_LIMIT_X, Math.min(AIM_LIMIT_X, game.aim.x))
    const ry = Math.max(0, Math.min(AIM_LIMIT_Y, game.aim.y))
    drawReticle(ctx, g, { x: g.gx(rx), y: g.gy(ry), stability: game.stability, time: game.time })
  } else if (phase === 'runup') {
    drawKeeper(ctx, g, keeperPose, 'rival')
    const paradinha = shot.special?.id === 'paradinha'
    const t = phaseT / shot.runupDuration
    // Paradinha: corre, para de repente, e conclui
    const progress = paradinha ? (t < 0.42 ? (t / 0.42) * 0.72 : t < 0.62 ? 0.72 : 0.72 + ((t - 0.62) / 0.38) * 0.28) : t
    drawStriker(ctx, g, { progress, kicking: progress > 0.93, pose: shot.pose, palette: 'player' })
    drawBall(ctx, { x: g.spotX, y: g.spotY, scale: 1, spin: 0 }, g)
  } else if (phase === 'flight') {
    drawKeeper(ctx, g, keeperPose, 'rival')
    drawStriker(ctx, g, { progress: 1, kicking: true, pose: shot.pose, palette: 'player' })
    const t = Math.min(1, phaseT / shot.flightDur)
    const pos = ballFlightPos(g, t, shot.shot.x, shot.shot.y, {
      curve: shot.curve,
      arcBoost: shot.cavadinha ? 0.12 : (1 - shot.power) * 0.05,
    })
    game.spin += (shot.cavadinha ? 7.2 : 18) * dt
    pushTrail(game, pos)
    drawTrail(ctx, game.trail, g)
    drawBall(ctx, { ...pos, spin: game.spin }, g)
  } else if (phase === 'outcome') {
    const pos = ballFlightPos(g, 1, shot.shot.x, shot.shot.y, { curve: shot.curve })
    const settle = Math.min(1, phaseT / 0.4)
    ctx.save()
    ctx.globalAlpha = 1 - settle
    drawTrail(ctx, game.trail, g)
    ctx.restore()
    // Bola por cima do travessão some ao fundo; na rede fica atrás do goleiro
    const ballProps = shot.overBar
      ? { x: pos.x, y: pos.y - settle * g.goalH * 0.12, scale: pos.scale * (1 - settle * 0.5), spin: game.spin, alpha: 1 - settle }
      : { x: pos.x, y: pos.y + settle * g.goalH * 0.3, scale: pos.scale, spin: game.spin, alpha: 1 - settle * 0.4 }
    if (ballInNet) {
      drawBall(ctx, ballProps, g)
      drawKeeper(ctx, g, keeperPose, 'rival')
    } else {
      drawKeeper(ctx, g, keeperPose, 'rival')
      drawBall(ctx, ballProps, g)
    }
    drawStriker(ctx, g, { progress: 1, kicking: false, palette: 'player' })
  }
}

export function renderKeeperMode(ctx, g, game) {
  const { phase, phaseT, shot, defense } = game
  const dt = game.frameDt ?? 0.016

  // Goleiro do jogador segue a mira 2D
  const aimX = Math.max(-KEEPER_CLAMP, Math.min(KEEPER_CLAMP, game.aim.x))
  const reachY = Math.max(0, Math.min(1, game.aim.y))
  const charging = defense && defense.chargeStart !== null && !defense.released
  const crouch = charging ? Math.min(1, (game.time - defense.chargeStart) / DEFENSE_CHARGE_S) : 0
  const feint = game.time < game.provocation.feintUntil ? 1 : 0
  let pose = { x: g.gx(aimX), diveDir: 0, diveT: 0, sway: game.time, reachY, crouch, feint }
  if (defense?.released) {
    const sinceDive = game.time - defense.releaseTime
    const diveT = Math.min(1, sinceDive / DIVE_ANIM_S)
    const grounded = sinceDive > 0.55
    pose = { x: g.gx(aimX), diveDir: defense.diveDir, diveT, reachY, grounded, sway: game.time }
  }

  const ballInNet = phase === 'outcome' && shot && !shot.saved && !shot.rivalMissed

  if (phase === 'windup') {
    drawKeeper(ctx, g, pose, 'player')
    const progress = Math.min(1, phaseT / WINDUP_S)
    drawStriker(ctx, g, { progress, kicking: progress > 0.82, palette: 'rival' })
    drawBall(ctx, { x: g.spotX, y: g.spotY, scale: 1, spin: 0 }, g)
  } else if (phase === 'flight') {
    drawKeeper(ctx, g, pose, 'player')
    drawStriker(ctx, g, { progress: 1, kicking: true, palette: 'rival' })
    const t = Math.min(1, phaseT / shot.duration)
    const pos = ballFlightPos(g, t, shot.x, shot.y, {})
    game.spin += 20.4 * dt
    pushTrail(game, pos)
    drawTrail(ctx, game.trail, g)
    drawBall(ctx, { ...pos, spin: game.spin }, g)
  } else if (phase === 'outcome') {
    const pos = ballFlightPos(g, 1, shot.x, shot.y, {})
    const settle = Math.min(1, phaseT / 0.4)
    ctx.save()
    ctx.globalAlpha = 1 - settle
    drawTrail(ctx, game.trail, g)
    ctx.restore()
    const bounceX = shot.saved ? (Math.sign(shot.x) || 1) * settle * g.w * 0.12 : 0
    const ballProps = {
      x: pos.x + bounceX,
      y: pos.y + settle * g.goalH * (shot.saved ? 0.5 : 0.3),
      scale: pos.scale + (shot.saved ? settle * 0.2 : 0),
      spin: game.spin,
      alpha: 1 - settle * 0.3,
    }
    if (ballInNet) {
      drawBall(ctx, ballProps, g)
      drawKeeper(ctx, g, pose, 'player')
    } else {
      drawKeeper(ctx, g, pose, 'player')
      drawBall(ctx, ballProps, g)
    }
    drawStriker(ctx, g, { progress: 1, kicking: false, palette: 'rival' })
  }
}
