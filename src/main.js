import { smoothAim, aimStability } from './game/aim.js'
import { TOTAL_ROUNDS } from './game/constants.js'
import { resolveShot, keeperDive } from './game/shot.js'
import { aiShot, resolveSave, savePoints } from './game/keeper.js'
import { initialScore, applyResult, advanceRound, isSessionOver, finishSession } from './game/scoring.js'
import { createTiltInput } from './input/tilt.js'
import { geometry, drawStadium, drawGoalAndZones, drawVignette } from './render/scene.js'
import { drawBall, drawTrail, drawKeeper, drawStriker, drawReticle } from './render/actors.js'
import { createFx, burst, floatText, shake, ripple, updateFx, shakeOffset, drawFx } from './render/fx.js'
import { createHud, COACH_TIPS } from './ui/hud.js'
import { createAudio } from './audio.js'

const STORAGE = {
  striker: 'iprachute:best:striker',
  keeper: 'iprachute:best:keeper',
  muted: 'iprachute:muted',
}
const FLIGHT_S = 0.62
const WINDUP_S = 1.0
const OUTCOME_S = 1.25
const AIM_SMOOTH = 0.16 // fração de convergência por frame de 60 fps
const DELTA_WINDOW = 12
const KEEPER_CLAMP = 0.95 // até onde o goleiro alcança dentro do gol (lógica e render)

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const hud = createHud()
const audio = createAudio()
const tilt = createTiltInput()
const fx = createFx()

const canvas = document.getElementById('scene')
const ctx = canvas.getContext('2d')
let g = geometry(300, 300)

const game = {
  mode: null, // 'striker' | 'keeper'
  phase: 'menu', // aim | windup | flight | outcome
  phaseT: 0,
  time: 0,
  state: initialScore(0),
  aim: 0,
  aimDeltas: [],
  stability: 1,
  calibrated: false,
  shot: null, // dados da bola em jogo
  trail: [],
  highlight: null,
  spin: 0,
}

// ---------- Persistência ----------
const store = {
  get(key, fallback = 0) {
    try {
      const v = localStorage.getItem(key)
      return v === null ? fallback : Number(v) || 0
    } catch {
      return fallback
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, String(value))
    } catch {
      /* modo privado: sem persistência */
    }
  },
}

audio.setMuted(store.get(STORAGE.muted, 0) === 1)
hud.nodes && updateMuteButton()

function updateMuteButton() {
  const btn = document.getElementById('btn-mute')
  btn.classList.toggle('is-muted', audio.muted)
  btn.setAttribute('aria-pressed', String(audio.muted))
}

function refreshMenuBests() {
  hud.nodes.bestStriker.textContent = String(store.get(STORAGE.striker))
  hud.nodes.bestKeeper.textContent = String(store.get(STORAGE.keeper))
}
refreshMenuBests()

// ---------- Canvas ----------
function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(rect.width * dpr)
  canvas.height = Math.round(rect.height * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  g = geometry(rect.width, rect.height)
}
new ResizeObserver(resizeCanvas).observe(canvas.parentElement)

// ---------- Fluxo de telas / sensor ----------
function selectMode(mode) {
  audio.unlock()
  audio.tap()
  game.mode = mode
  if (tilt.state.permissionNeeded && !tilt.state.hasReading) {
    hud.nodes.overlayPermission.hidden = false
    document.getElementById('btn-grant').focus()
    return
  }
  afterPermission()
}

function afterPermission() {
  tilt.startSensor()
  if (!game.calibrated) {
    hud.nodes.overlayCalibrate.hidden = false
    document.getElementById('btn-calibrate').focus()
    return
  }
  startSession()
}

// O iOS bloqueia o pedido de sensor sem mostrar prompt quando a página roda
// embutida (iframe de outra origem, ex. visualizador de artifacts, ou webview
// de app). Nesses casos explicamos o motivo em vez de falhar em silêncio.
const isEmbedded = (() => {
  try {
    return window.top !== window
  } catch {
    return true
  }
})()

function showPermissionBlocked() {
  const errorBox = document.getElementById('perm-error')
  const detail = tilt.state.permissionError ? `<br /><small>Detalhe técnico: ${tilt.state.permissionError}</small>` : ''
  errorBox.innerHTML = isEmbedded
    ? '<b>O pedido foi bloqueado pelo iPhone.</b> O jogo está rodando embutido dentro de outra página, e nesse caso o iOS não mostra o pedido de sensor. Abra o jogo direto no Safari (página própria, fora de apps) para inclinar de verdade — ou jogue aqui no modo toque.' + detail
    : '<b>O pedido foi bloqueado.</b> Se você negou antes: no Safari, toque em <b>aA</b> na barra de endereço → Configurações do Site → ative <b>Movimento e Orientação</b> e tente de novo. Se estiver usando o navegador de dentro de um app (Instagram, Claude etc.), abra o link no Safari.' + detail
  errorBox.hidden = false
  document.querySelector('#btn-grant b').textContent = 'Tentar de novo'
}

document.getElementById('btn-grant').addEventListener('click', async () => {
  const result = await tilt.requestPermission()
  if (result === 'granted') {
    hud.nodes.overlayPermission.hidden = true
    afterPermission()
  } else {
    showPermissionBlocked()
  }
})
document.getElementById('btn-skip-sensor').addEventListener('click', () => {
  hud.nodes.overlayPermission.hidden = true
  startSession()
})
document.getElementById('btn-calibrate').addEventListener('click', () => {
  // pequena espera para o sensor produzir leitura após a permissão
  setTimeout(() => {
    tilt.calibrate()
    game.calibrated = true
    hud.nodes.overlayCalibrate.hidden = true
    startSession()
  }, 120)
})

document.getElementById('btn-mode-striker').addEventListener('click', () => selectMode('striker'))
document.getElementById('btn-mode-keeper').addEventListener('click', () => selectMode('keeper'))
document.getElementById('btn-back').addEventListener('click', () => {
  audio.tap()
  goToMenu()
})
document.getElementById('btn-menu').addEventListener('click', () => {
  audio.tap()
  goToMenu()
})
document.getElementById('btn-again').addEventListener('click', () => {
  audio.tap()
  startSession()
})
document.getElementById('btn-mute').addEventListener('click', () => {
  audio.setMuted(!audio.muted)
  store.set(STORAGE.muted, audio.muted ? 1 : 0)
  updateMuteButton()
  if (!audio.muted) audio.tap()
})

hud.nodes.shootBtn.addEventListener('click', shoot)
window.addEventListener('keydown', (event) => {
  if ((event.key === ' ' || event.key === 'Enter') && game.phase === 'aim') {
    // Com outro botão focado (voltar, som), deixa a ativação nativa acontecer
    const focused = document.activeElement
    if (focused?.tagName === 'BUTTON' && focused !== hud.nodes.shootBtn) return
    event.preventDefault()
    shoot()
  }
})

// Mantém a tela acesa durante a partida (o modo goleiro é 100% sem toque)
let wakeLock = null
async function acquireWakeLock() {
  try {
    wakeLock = (await navigator.wakeLock?.request('screen')) ?? null
  } catch {
    wakeLock = null
  }
}
function releaseWakeLock() {
  wakeLock?.release().catch(() => {})
  wakeLock = null
}

tilt.attachDragArea(canvas.parentElement)

function goToMenu() {
  game.phase = 'menu'
  game.mode = null
  releaseWakeLock()
  refreshMenuBests()
  hud.showScreen('menu')
}

function startSession() {
  const best = store.get(game.mode === 'striker' ? STORAGE.striker : STORAGE.keeper)
  game.state = initialScore(best)
  game.aim = 0
  game.aimDeltas = []
  game.trail = []
  game.highlight = null
  game.shot = null
  fx.particles = []
  fx.floats = []
  tilt.reset()
  if (tilt.state.mode === 'tilt') tilt.calibrate()
  acquireWakeLock()

  hud.nodes.gameTitle.textContent = game.mode === 'striker' ? 'Incline para chutar' : 'Modo goleiro'
  hud.setSensorChip(tilt.state.mode)
  hud.setShootVisible(game.mode === 'striker')
  hud.updateScore(game.state)
  hud.updateHits(game.state, game.mode)
  hud.showScreen('game')
  resizeCanvas()
  ensureLoop()
  startRound()
}

function startRound() {
  game.trail = []
  game.highlight = null
  game.spin = 0
  if (game.mode === 'striker') {
    setPhase('aim')
    hud.setShootEnabled(true)
    setAimHint()
  } else {
    setPhase('windup')
    setKeeperHint()
  }
  hud.updateScore(game.state)
  hud.updateHits(game.state, game.mode)
}

function setAimHint() {
  const hints = {
    tilt: 'Incline o celular para mirar · segure firme e <b>chute!</b>',
    touch: 'Arraste o dedo para mirar · solte e <b>chute!</b>',
    teclado: 'Use <b>← →</b> para mirar · <b>espaço</b> chuta',
  }
  hud.setHint(hints[tilt.state.mode] ?? hints.touch)
}

function setKeeperHint() {
  const hints = {
    tilt: 'Bola em jogo — incline para posicionar o goleiro!',
    touch: 'Bola em jogo — arraste o dedo para posicionar o goleiro!',
    teclado: 'Bola em jogo — use <b>← →</b> para posicionar o goleiro!',
  }
  hud.setHint(hints[tilt.state.mode] ?? hints.touch)
}

function setPhase(phase) {
  game.phase = phase
  game.phaseT = 0
}

// ---------- Ações ----------
function shoot() {
  if (game.phase !== 'aim' || game.mode !== 'striker') return
  hud.setShootEnabled(false)
  audio.kick()
  navigator.vibrate?.(18)

  const dive = keeperDive({ rngValue: Math.random() })
  const result = resolveShot({
    aimX: game.aim,
    stability: game.stability,
    keeperX: dive.keeperX,
    rngValue: Math.random(),
  })
  game.shot = { ...result, dive, from: { x: g.spotX, y: g.spotY } }
  setPhase('flight')
  hud.setHint('...')
}

function endStrikerFlight() {
  const { shot } = game
  const success = !shot.saved && !shot.offTarget
  const gained = success ? shot.points * game.state.combo : 0
  const prevCombo = game.state.combo
  game.state = applyResult(game.state, { success, points: shot.points })

  if (success) {
    game.highlight = shot.zone.id
    if (!reducedMotion) {
      ripple(fx)
      burst(fx, g.gx(shot.shotX), g.crossbarY + g.goalH * 0.55, 'goal')
      shake(fx, 8)
      floatText(fx, `+${gained}`, g.gx(shot.shotX), g.crossbarY + g.goalH * 0.35)
    }
    hud.flash(shot.precise ? 'Golaço!' : 'Goool!', 'goal')
    audio.goal()
    if (game.state.combo > prevCombo) audio.comboUp(game.state.combo)
    navigator.vibrate?.(success && shot.precise ? [30, 40, 60] : 40)
  } else if (shot.saved) {
    hud.flash('Defendeu!', 'save')
    if (!reducedMotion) burst(fx, g.gx(shot.shotX), g.crossbarY + g.goalH * 0.55, 'save')
    audio.save()
  } else {
    hud.flash('Pra fora!', 'miss')
    audio.miss()
  }
  hud.updateScore(game.state)
  hud.updateHits(game.state, game.mode)
  setPhase('outcome')
}

function endKeeperFlight() {
  const { shot } = game
  const keeperX = Math.max(-KEEPER_CLAMP, Math.min(KEEPER_CLAMP, game.aim))
  const saved = resolveSave(keeperX, shot.targetX)
  const points = saved ? savePoints({ shotX: shot.targetX }) : 0
  const gained = saved ? points * game.state.combo : 0
  const prevCombo = game.state.combo
  game.state = applyResult(game.state, { success: saved, points })
  game.shot.saved = saved
  game.shot.keeperXAtCross = keeperX

  if (saved) {
    hud.flash('Defendeu!', 'save')
    if (!reducedMotion) {
      burst(fx, g.gx(shot.targetX), g.crossbarY + g.goalH * 0.5, 'save')
      shake(fx, 6)
      floatText(fx, `+${gained}`, g.gx(shot.targetX), g.crossbarY + g.goalH * 0.3, '255, 223, 27')
    }
    audio.save()
    if (game.state.combo > prevCombo) audio.comboUp(game.state.combo)
    navigator.vibrate?.(40)
  } else {
    hud.flash('Gol sofrido', 'miss')
    if (!reducedMotion) ripple(fx)
    audio.miss()
    navigator.vibrate?.([24, 40, 24])
  }
  hud.updateScore(game.state)
  hud.updateHits(game.state, game.mode)
  setPhase('outcome')
}

function nextRoundOrFinish() {
  game.state = advanceRound(game.state)
  if (isSessionOver(game.state)) {
    finishAndShowResult()
  } else {
    startRound()
  }
}

function finishAndShowResult() {
  const finished = finishSession(game.state)
  const key = game.mode === 'striker' ? STORAGE.striker : STORAGE.keeper
  const isRecord = finished.score > 0 && finished.score > game.state.best
  store.set(key, finished.best)

  const striker = game.mode === 'striker'
  hud.nodes.resultEyebrow.textContent = striker ? 'Fim do treino' : 'Modo goleiro'
  const great = game.state.hits >= 6
  hud.nodes.resultTitle.textContent = striker
    ? great
      ? 'Artilheiro nato!'
      : 'Treino completo!'
    : great
      ? 'Paredão!'
      : 'Fim do desafio!'
  hud.nodes.resultTitle.classList.toggle('is-loss', !great)
  hud.nodes.resultSub.textContent = striker
    ? `Você marcou ${game.state.hits} ${game.state.hits === 1 ? 'gol' : 'gols'} em ${TOTAL_ROUNDS} bolas.`
    : `Você defendeu ${game.state.hits} de ${TOTAL_ROUNDS} chutes.`
  hud.nodes.resScore.textContent = String(finished.score)
  hud.nodes.resHits.textContent = String(game.state.hits)
  hud.nodes.resHitsLabel.textContent = striker ? 'Gols' : 'Defesas'
  hud.nodes.resCombo.textContent = `x${game.state.maxCombo}`
  hud.nodes.newRecord.hidden = !isRecord
  hud.nodes.coachTip.textContent = COACH_TIPS[Math.floor(Math.random() * COACH_TIPS.length)]
  if (great) audio.whistle()
  releaseWakeLock()
  hud.showScreen('result')
  game.phase = 'menu'
}

// ---------- Loop ----------
// O RAF só roda com a tela de jogo ativa; ensureLoop religa ao entrar nela.
let lastTs = 0
let rafId = 0
function frame(ts) {
  if (!hud.nodes.screens.game.classList.contains('is-active')) {
    rafId = 0
    return
  }
  rafId = requestAnimationFrame(frame)
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016)
  lastTs = ts
  game.time += dt

  if (g.w < 10) resizeCanvas()

  updateGame(dt)
  updateFx(fx, dt)
  render()
}
function ensureLoop() {
  if (rafId) return
  lastTs = performance.now()
  rafId = requestAnimationFrame(frame)
}

let shownInputMode = null
function updateGame(dt) {
  // O sensor pode "chegar" depois da sessão começar (1a leitura tardia):
  // mantém o chip e a dica sempre coerentes com o modo de entrada real
  if (tilt.state.mode !== shownInputMode) {
    shownInputMode = tilt.state.mode
    hud.setSensorChip(shownInputMode)
    if (game.phase === 'aim') setAimHint()
    else if (game.mode === 'keeper' && game.phase !== 'outcome') setKeeperHint()
  }

  // Mira suavizada + janela de estabilidade, independentes do frame rate:
  // alpha corrigido por tempo e deltas normalizados para o equivalente a 60 fps
  const rawAim = tilt.readAim(dt)
  const prev = game.aim
  const frames = Math.max(dt * 60, 1e-3)
  const alpha = 1 - Math.pow(1 - AIM_SMOOTH, frames)
  game.aim = smoothAim(prev, rawAim, alpha)
  game.aimDeltas.push((game.aim - prev) / frames)
  if (game.aimDeltas.length > DELTA_WINDOW) game.aimDeltas.shift()
  game.stability = aimStability(game.aimDeltas)

  game.phaseT += dt

  if (game.mode === 'striker') {
    if (game.phase === 'flight' && game.phaseT >= FLIGHT_S) endStrikerFlight()
    else if (game.phase === 'outcome' && game.phaseT >= OUTCOME_S) nextRoundOrFinish()
  } else if (game.mode === 'keeper') {
    if (game.phase === 'windup' && game.phaseT >= WINDUP_S) {
      const shotInfo = aiShot({ round: game.state.round, rngValue: Math.random() })
      game.shot = { ...shotInfo, from: { x: g.spotX, y: g.spotY } }
      audio.kick()
      setPhase('flight')
    } else if (game.phase === 'flight' && game.phaseT >= game.shot.duration) {
      endKeeperFlight()
    } else if (game.phase === 'outcome' && game.phaseT >= OUTCOME_S) {
      nextRoundOrFinish()
    }
  }
}

const easeOutQuad = (t) => 1 - (1 - t) * (1 - t)

function ballFlightPos(t, targetX) {
  const x = g.spotX + (g.gx(targetX) - g.spotX) * easeOutQuad(t)
  const hitY = g.goalBaseY - g.goalH * 0.42
  const y = g.spotY + (hitY - g.spotY) * t - Math.sin(Math.PI * t) * g.h * 0.07
  const scale = 1 - 0.58 * t
  return { x, y, scale }
}

function render() {
  const off = reducedMotion ? { x: 0, y: 0 } : shakeOffset(fx)
  ctx.save()
  ctx.clearRect(0, 0, g.w, g.h)
  ctx.translate(off.x, off.y)

  drawStadium(ctx, g, game.time)
  drawGoalAndZones(ctx, g, {
    time: game.time,
    ripple: fx.ripple,
    highlight: game.highlight,
    showZones: game.mode === 'striker',
  })

  if (game.mode === 'striker') renderStriker()
  else renderKeeperMode()

  drawFx(ctx, fx)
  drawVignette(ctx, g)
  ctx.restore()
}

function renderStriker() {
  const { phase, phaseT, shot } = game

  // Goleiro rival
  if (phase === 'flight' || phase === 'outcome') {
    const diveT = phase === 'flight' ? Math.max(0, Math.min(1, (phaseT / FLIGHT_S - 0.15) / 0.6)) : 1
    const dir = Math.sign(shot.dive.keeperX) || 0
    const x = g.gx(0) + (g.gx(shot.dive.keeperX) - g.gx(0)) * diveT
    drawKeeper(ctx, g, { x, diveDir: dir, diveT: dir === 0 ? diveT * 0.25 : diveT }, 'rival')
  } else {
    drawKeeper(ctx, g, { x: g.gx(0), diveDir: 0, diveT: 0, sway: game.time }, 'rival')
  }

  // Bola
  if (phase === 'aim') {
    drawBall(ctx, { x: g.spotX, y: g.spotY, scale: 1, spin: 0 }, g)
    const reticleY = g.crossbarY + g.goalH * 0.56
    drawReticle(ctx, g, { x: g.gx(Math.max(-1, Math.min(1, game.aim))), y: reticleY, stability: game.stability, time: game.time })
  } else if (phase === 'flight') {
    const t = Math.min(1, phaseT / FLIGHT_S)
    const pos = ballFlightPos(t, shot.shotX)
    game.spin += 0.3
    game.trail.push({ x: pos.x, y: pos.y })
    if (game.trail.length > 14) game.trail.shift()
    drawTrail(ctx, game.trail, g)
    drawBall(ctx, { ...pos, spin: game.spin }, g)
  } else if (phase === 'outcome') {
    const pos = ballFlightPos(1, shot.shotX)
    const settle = Math.min(1, phaseT / 0.4)
    drawTrail(ctx, game.trail, g)
    drawBall(ctx, { x: pos.x, y: pos.y + settle * g.goalH * 0.3, scale: pos.scale, spin: game.spin, alpha: 1 - settle * 0.4 }, g)
  }
}

function renderKeeperMode() {
  const { phase, phaseT, shot } = game

  // Goleiro do jogador segue a mira
  const aimClamped = Math.max(-KEEPER_CLAMP, Math.min(KEEPER_CLAMP, game.aim))
  let pose = { x: g.gx(aimClamped), diveDir: 0, diveT: 0, sway: game.time }
  if (phase === 'outcome' && shot) {
    const dir = Math.sign(shot.targetX - (shot.keeperXAtCross ?? 0)) || (shot.saved ? 0 : 1)
    const diveT = Math.min(1, phaseT / 0.35)
    pose = { x: g.gx(shot.keeperXAtCross ?? aimClamped), diveDir: shot.saved ? dir * 0.5 : dir, diveT }
  }
  drawKeeper(ctx, g, pose, 'player')

  if (phase === 'windup') {
    const progress = Math.min(1, phaseT / WINDUP_S)
    drawStriker(ctx, g, { progress, kicking: progress > 0.82 })
    drawBall(ctx, { x: g.spotX, y: g.spotY, scale: 1, spin: 0 }, g)
  } else if (phase === 'flight') {
    drawStriker(ctx, g, { progress: 1, kicking: true })
    const t = Math.min(1, phaseT / shot.duration)
    const pos = ballFlightPos(t, shot.targetX)
    game.spin += 0.34
    game.trail.push({ x: pos.x, y: pos.y })
    if (game.trail.length > 14) game.trail.shift()
    drawTrail(ctx, game.trail, g)
    drawBall(ctx, { ...pos, spin: game.spin }, g)
  } else if (phase === 'outcome') {
    drawStriker(ctx, g, { progress: 1, kicking: false })
    const pos = ballFlightPos(1, shot.targetX)
    const settle = Math.min(1, phaseT / 0.4)
    const bounceX = shot.saved ? (Math.sign(shot.targetX) || 1) * settle * g.w * 0.12 : 0
    drawBall(
      ctx,
      {
        x: pos.x + bounceX,
        y: pos.y + settle * g.goalH * (shot.saved ? 0.5 : 0.3),
        scale: pos.scale + (shot.saved ? settle * 0.2 : 0),
        spin: game.spin,
        alpha: 1 - settle * 0.3,
      },
      g,
    )
  }
}

// Ao voltar para a aba: recalibra (o usuário pode ter mudado de posição) e
// readquire o wake lock, que o navegador libera quando a aba fica oculta
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return
  const inSession = game.mode !== null && game.phase !== 'menu'
  if (inSession) {
    if (tilt.state.mode === 'tilt') tilt.calibrate()
    acquireWakeLock()
    ensureLoop()
  }
})
