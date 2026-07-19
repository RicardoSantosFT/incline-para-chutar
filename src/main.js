import { smoothAim, aimStability } from './game/aim.js'
import {
  TOTAL_ROUNDS,
  PRECISION_THRESHOLD,
  AIM_LIMIT_X,
  RUNUP_S,
  PARADINHA_RUNUP_S,
  WINDUP_S,
  OUTCOME_S,
} from './game/constants.js'
import { powerFromHold, isCavadinha, flightDuration, CAVADINHA_DURATION_S } from './game/power.js'
import { pickSpecial } from './game/specials.js'
import { resolveShot2D, keeperDive2D } from './game/shot.js'
import { aiShot2D, aiKickPlan, savePoints2D, diveTravelTime, resolveKeeperDefense, DIVE_START } from './game/keeper.js'
import { initialScore, applyResult, advanceRound, isSessionOver, finishSession } from './game/scoring.js'
import { createTiltInput } from './input/tilt.js'
import { geometry, drawStadium, drawGoalAndZones, drawVignette } from './render/scene.js'
import { renderStriker, renderKeeperMode } from './render/composer.js'
import { initSprites } from './render/sprites.js'
import { createFx, resetFx, burst, floatText, shake, ripple, updateFx, shakeOffset, drawFx } from './render/fx.js'
import { createHud, COACH_TIPS } from './ui/hud.js'
import { store, STORAGE } from './ui/store.js'
import { showPermissionBlocked } from './ui/permission.js'
import { createAudio } from './audio.js'
import { createDuelController } from './net/controller.js'

const AIM_SMOOTH = 0.16 // fração de convergência por frame de 60 fps
const DELTA_WINDOW = 12
const NERVE_STEP = 0.09
const NERVE_CAP = 0.27
const NERVE_MAX = 3
const PROVOKE_MISS_POINTS = 60

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const hud = createHud()
const audio = createAudio()
const tilt = createTiltInput()
const fx = createFx()
initSprites()

const canvas = document.getElementById('scene')
const ctx = canvas.getContext('2d')
let g = geometry(300, 300)

const game = {
  mode: null, // 'striker' | 'keeper'
  phase: 'menu', // aim | runup | flight | outcome | windup
  phaseT: 0,
  time: 0,
  state: initialScore(0),
  aim: { x: 0, y: 0.5 },
  aimDeltas: [],
  aimDx: 0,
  stability: 1,
  calibrated: false,
  charge: null, // { start } — segurando o botão de chute
  special: null, // golpe armado no chacoalhão
  shot: null, // dados da bola em jogo
  defense: null, // { holding, released, releaseTime, target, diveTime }
  aiPlan: null, // { feint, windup } — plano da cobrança do rival
  kickTime: 0, // instante em que o rival bateu (detecta quem comprou finta)
  provocation: { nerve: 0, feintUntil: 0 },
  trail: [],
  highlight: null,
  spin: 0,
  // Duelo online
  duelActive: false,
  duelAwaiting: false,
  duelShot: null,
  rivalFeintUntil: 0,
}

window.__game = game // sonda de depuração (somente leitura)

audio.setMuted(store.get(STORAGE.muted, 0) === 1)
updateMuteButton()

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
// setupTarget: para onde ir depois de permissão+calibração
let setupTarget = 'session' // 'session' | 'lobby'
function proceedAfterSetup() {
  if (setupTarget === 'lobby') {
    setupTarget = 'session'
    duelCtl.openLobby()
  } else {
    startSession()
  }
}

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
  proceedAfterSetup()
}

document.getElementById('btn-grant').addEventListener('click', async () => {
  const result = await tilt.requestPermission()
  if (result === 'granted') {
    hud.nodes.overlayPermission.hidden = true
    afterPermission()
  } else {
    showPermissionBlocked(tilt.state.permissionError)
  }
})
document.getElementById('btn-skip-sensor').addEventListener('click', () => {
  hud.nodes.overlayPermission.hidden = true
  proceedAfterSetup()
})
document.getElementById('btn-calibrate').addEventListener('click', () => {
  // pequena espera para o sensor produzir leitura após a permissão
  setTimeout(() => {
    tilt.calibrate()
    game.calibrated = true
    hud.nodes.overlayCalibrate.hidden = true
    proceedAfterSetup()
  }, 120)
})

document.getElementById('btn-mode-striker').addEventListener('click', () => selectMode('striker'))
document.getElementById('btn-mode-keeper').addEventListener('click', () => selectMode('keeper'))
document.getElementById('btn-mode-duel').addEventListener('click', () => {
  setupTarget = 'lobby'
  selectMode(null)
})
document.getElementById('btn-back').addEventListener('click', (event) => {
  // Clique por ponteiro solta o foco (senão a barra de espaço fica presa nele)
  if (event.detail > 0) event.currentTarget.blur()
  audio.tap()
  if (game.duelActive) duelCtl.leave()
  goToMenu()
})
document.getElementById('btn-menu').addEventListener('click', () => {
  audio.tap()
  duelCtl.leave()
  goToMenu()
})
document.getElementById('btn-again').addEventListener('click', () => {
  audio.tap()
  startSession()
})
document.getElementById('btn-mute').addEventListener('click', (event) => {
  if (event.detail > 0) event.currentTarget.blur()
  audio.setMuted(!audio.muted)
  store.set(STORAGE.muted, audio.muted ? 1 : 0)
  updateMuteButton()
  if (!audio.muted) audio.tap()
})

// ---------- Botão de ação (segurar/soltar) ----------
// A carga pertence ao ponteiro que apertou o botão (pointer capture):
// o dedo que arrasta a mira na cena não solta o chute/mergulho por engano.
// actionHeld deixa "segurar atravessando a troca de fase" funcionar.
let actionPointerId = null
let actionHeld = false
let actionKeyHeld = false

hud.nodes.shootBtn.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  actionPointerId = event.pointerId
  hud.nodes.shootBtn.setPointerCapture?.(event.pointerId)
  actionHeld = true
  onActionPress()
})
hud.nodes.shootBtn.addEventListener('pointerup', (event) => {
  if (event.pointerId !== actionPointerId) return
  actionPointerId = null
  actionHeld = false
  onActionRelease()
})
hud.nodes.shootBtn.addEventListener('pointercancel', (event) => {
  if (event.pointerId !== actionPointerId) return
  actionPointerId = null
  actionHeld = false
  onActionRelease()
})
hud.nodes.shootBtn.addEventListener('contextmenu', (event) => event.preventDefault())

window.addEventListener('keydown', (event) => {
  if (event.key !== ' ' && event.key !== 'Enter') return
  if (event.repeat) return
  // Com outro botão focado (voltar, som), deixa a ativação nativa acontecer
  const focused = document.activeElement
  if (focused?.tagName === 'BUTTON' && focused !== hud.nodes.shootBtn) return
  actionHeld = true
  actionKeyHeld = true
  if (game.phase === 'aim' || game.phase === 'windup' || game.phase === 'flight') {
    event.preventDefault()
    onActionPress()
  }
})
window.addEventListener('keyup', (event) => {
  if (event.key !== ' ' && event.key !== 'Enter') return
  // keyup solto sem keydown próprio não pode largar um hold do ponteiro
  if (!actionKeyHeld) return
  actionKeyHeld = false
  if (actionPointerId !== null) return
  actionHeld = false
  onActionRelease()
})

function onActionPress() {
  if (game.mode === 'striker' && game.phase === 'aim' && !game.charge) {
    game.charge = { start: game.time, notifiedFull: false }
    hud.setShootLabel('Solte para chutar!')
  } else if (game.mode === 'keeper' && (game.phase === 'windup' || game.phase === 'flight')) {
    if (game.defense && !game.defense.released) {
      game.defense.holding = true
      hud.setShootLabel('Solte para voar!')
    }
  }
}

function onActionRelease() {
  if (game.mode === 'striker' && game.charge && game.phase === 'aim') {
    const holdMs = (game.time - game.charge.start) * 1000
    game.charge = null
    hud.setPower(0)
    shoot(holdMs)
  } else if (
    game.mode === 'keeper' &&
    (game.phase === 'windup' || game.phase === 'flight') &&
    game.defense?.holding &&
    !game.defense.released
  ) {
    // Voa para onde a mira aponta AGORA — soltar cedo demais é por conta própria
    const target = {
      x: Math.max(-1, Math.min(1, game.aim.x)),
      y: Math.max(0.08, Math.min(1, game.aim.y)),
    }
    game.defense.released = true
    game.defense.releaseTime = game.time
    game.defense.target = target
    game.defense.diveTime = diveTravelTime(Math.hypot(target.x - DIVE_START.x, target.y - DIVE_START.y))
    hud.setShootLabel('Voou!')
    audio.tap()
    navigator.vibrate?.(15)
  }
}

// ---------- Chacoalhada ----------
tilt.onShake(() => {
  if (game.mode === 'striker' && game.phase === 'aim') {
    game.special = pickSpecial(Math.random(), game.special?.id ?? null)
    hud.showSpecial(game.special.nome)
    audio.special()
    navigator.vibrate?.(30)
  } else if (game.mode === 'keeper' && game.phase === 'windup') {
    if (game.duelActive) {
      // Contra humano a finta é psicológica: o rival VÊ você dançando no gol
      game.provocation.feintUntil = game.time + 0.9
      duelCtl.sendFeint()
      audio.provoke()
      navigator.vibrate?.([15, 30, 15])
      return
    }
    if (game.provocation.nerve >= NERVE_MAX) return // saturou: sem feedback falso
    game.provocation.nerve += 1
    game.provocation.feintUntil = game.time + 0.9
    audio.provoke()
    hud.nodes.live.textContent = `Provocou! Nervosismo ${game.provocation.nerve} de ${NERVE_MAX}.`
    if (!reducedMotion) floatText(fx, 'Provocou!', g.gx(0), g.goalBaseY - g.goalH * 0.9, '167, 139, 250')
    navigator.vibrate?.([15, 30, 15])
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
  game.aim = { x: 0, y: 0.5 }
  game.aimDeltas = []
  game.trail = []
  game.highlight = null
  game.shot = null
  game.charge = null
  game.special = null
  game.defense = null
  game.provocation = { nerve: 0, feintUntil: 0 }
  resetFx(fx)
  tilt.reset()
  tilt.setLimitX(game.mode === 'striker' ? AIM_LIMIT_X : 1)
  if (tilt.state.mode === 'tilt') tilt.calibrate()
  acquireWakeLock()

  hud.nodes.gameTitle.textContent = game.mode === 'striker' ? 'Incline para chutar' : 'Modo goleiro'
  hud.setSensorChip(tilt.state.mode)
  hud.setShootVisible(true)
  hud.setShootLabel(game.mode === 'striker' ? 'Segure e solte!' : 'Defender!')
  hud.setPower(0)
  hud.showSpecial(null)
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
  game.shot = null
  game.charge = null
  game.special = null
  hud.showSpecial(null)
  hud.setPower(0)
  if (game.mode === 'striker') {
    setPhase('aim')
    hud.setShootEnabled(true)
    hud.setShootLabel('Segure e solte!')
    setAimHint()
    // Jogador já estava segurando desde o outcome anterior: rearma a carga
    if (actionHeld) game.charge = { start: game.time, notifiedFull: false }
  } else {
    game.defense = { holding: false, released: false, releaseTime: 0, target: null, diveTime: 0 }
    game.aiPlan = aiKickPlan({ round: game.state.round, rngValue: Math.random() })
    game.provocation = { nerve: 0, feintUntil: 0 }
    setPhase('windup')
    hud.setShootEnabled(true)
    hud.setShootLabel('Defender!')
    setKeeperHint()
    if (actionHeld) {
      game.defense.holding = true
      hud.setShootLabel('Solte para voar!')
    }
  }
  hud.updateScore(game.state)
  hud.updateHits(game.state, game.mode)
}

function setAimHint() {
  const hints = {
    tilt: 'Incline para mirar · <b>segure e solte</b> · chacoalhe = especial',
    touch: 'Arraste para mirar · <b>segure e solte</b> · 2 toques = especial',
    teclado: '<b>← → ↑ ↓</b> miram · <b>espaço</b> chuta · <b>X</b> = especial',
  }
  hud.setHint(hints[tilt.state.mode] ?? hints.touch)
}

function setKeeperHint() {
  const hints = {
    tilt: 'Incline a mira no canto · <b>solte para voar</b> até ela · chacoalhe = finta',
    touch: 'Arraste a mira · segure e <b>solte para voar</b> até ela · 2 toques = finta',
    teclado: '<b>← → ↑ ↓</b> miram · <b>espaço</b> segura, soltar = voo · <b>X</b> = finta',
  }
  hud.setHint(hints[tilt.state.mode] ?? hints.touch)
}

function setPhase(phase) {
  game.phase = phase
  game.phaseT = 0
}

// ---------- Ações ----------
function shoot(holdMs) {
  if (game.phase !== 'aim' || game.mode !== 'striker') return
  hud.setShootEnabled(false)
  hud.setShootLabel('Chutando…')

  const cavadinha = isCavadinha(holdMs)
  const power = powerFromHold(holdMs)
  // Cavadinha cancela o especial armado (sem empilhar bônus de estilo)
  const special = cavadinha ? null : game.special
  const paradinha = special?.id === 'paradinha'
  const runupDuration = paradinha ? PARADINHA_RUNUP_S : RUNUP_S
  const pose = special?.id === 'chaleira' || special?.id === 'calcanhar' ? special.id : 'normal'

  // Sem sensor (teclado/toque) a mira parada é trivial: o bônus de precisão
  // só é atingível de verdade segurando o celular
  const usingSensor = tilt.state.mode === 'tilt' && !tilt.state.dragging
  const stability = usingSensor ? game.stability : Math.min(game.stability, PRECISION_THRESHOLD - 0.05)

  if (game.duelActive) {
    // Duelo: quem defende é um humano — a colocação vai pela rede
    duelCtl.onShoot({ aim: { ...game.aim }, stability, power, cavadinha, special, pose, runupDuration })
    setPhase('runup')
    hud.setHint(paradinha ? '<b>Paradinha!</b> Ele vai pular antes?' : 'Chutando…')
    return
  }

  const committed = paradinha && Math.random() < special.commitChance
  const dive = keeperDive2D({ rngZone: Math.random(), rngHeight: Math.random(), rngX: Math.random() })
  game.shot = {
    pending: true,
    aim: { ...game.aim },
    stability,
    power,
    cavadinha,
    special,
    dive,
    committed,
    runupDuration,
    pose,
  }
  setPhase('runup')
  hud.setHint(paradinha ? '<b>Paradinha!</b> O goleiro vai comprar?' : 'Chutando…')
}

function launchStrikerShot() {
  if (game.duelActive) {
    // Colocação já calculada no momento do chute (foi pela rede)
    if (game.shot.cavadinha) audio.chip()
    else audio.kick(game.shot.power)
    navigator.vibrate?.(10 + Math.round(game.shot.power * 20))
    setPhase('flight')
    return
  }
  const s = game.shot
  const result = resolveShot2D({
    aim: s.aim,
    stability: s.stability,
    power: s.power,
    cavadinha: s.cavadinha,
    special: s.special,
    keeper: { x: s.dive.x, y: s.dive.y },
    keeperCommitted: s.committed,
    rngSpreadX: Math.random(),
    rngSpreadY: Math.random(),
  })
  game.shot = {
    ...s,
    ...result,
    pending: false,
    flightDur: s.cavadinha ? CAVADINHA_DURATION_S : flightDuration(s.power),
    curve: s.special?.id === 'curva',
    from: { x: g.spotX, y: g.spotY },
  }
  if (s.cavadinha) audio.chip()
  else audio.kick(s.power)
  navigator.vibrate?.(10 + Math.round(s.power * 20))
  setPhase('flight')
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
      burst(fx, g.gx(shot.shot.x), g.gy(shot.shot.y), 'goal')
      shake(fx, 8)
      floatText(fx, `+${gained}`, g.gx(shot.shot.x), g.gy(shot.shot.y) - 12)
    }
    const flashText = shot.cavadinha
      ? 'Cavadinha!'
      : shot.special
        ? `${shot.special.nome}!`
        : shot.precise
          ? 'Golaço!'
          : 'Goool!'
    hud.flash(flashText, 'goal')
    audio.goal()
    if (game.state.combo > prevCombo) audio.comboUp(game.state.combo)
    navigator.vibrate?.(shot.precise || shot.special ? [30, 40, 60] : 40)
  } else if (shot.saved) {
    hud.flash('Defendeu!', 'save')
    if (!reducedMotion) burst(fx, g.gx(shot.shot.x), g.gy(shot.shot.y), 'save')
    audio.save()
  } else {
    hud.flash(shot.overBar ? 'Por cima!' : 'Pra fora!', 'miss')
    audio.miss()
  }
  hud.updateScore(game.state)
  hud.updateHits(game.state, game.mode)
  setPhase('outcome')
}

function launchAiShot() {
  const nerveMiss = Math.min(NERVE_CAP, game.provocation.nerve * NERVE_STEP)
  // Duelo: a bola veio do batedor humano; solo: rival controlado pela máquina
  const shotInfo =
    game.duelShot ??
    aiShot2D({
      round: game.state.round,
      rngX: Math.random(),
      rngY: Math.random(),
      nerveMiss,
      rngMiss: Math.random(),
      rngPower: Math.random(),
    })
  game.duelShot = null
  game.shot = { ...shotInfo, from: { x: g.spotX, y: g.spotY } }
  game.kickTime = game.time
  // Bolão sai com som mais seco; bola colocada, mais macio
  audio.kick(1.3 - shotInfo.duration)
  setPhase('flight')
}

function endKeeperFlight() {
  const { shot, defense } = game
  const result = resolveKeeperDefense({
    released: defense.released,
    // Instante determinístico do cruzamento (sem o overshoot do frame)
    releaseLead: defense.released ? game.kickTime + shot.duration - defense.releaseTime : 0,
    target: defense.target ?? undefined,
    shot: { x: shot.x, y: shot.y },
    shotDuration: shot.duration,
  })
  const rivalMissed = Math.abs(shot.x) > 1 || shot.y > 1
  const saved = result.saved
  const boughtFeint =
    Boolean(game.aiPlan?.feint) && !saved && !rivalMissed && defense.released && defense.releaseTime < game.kickTime
  const success = saved || rivalMissed
  const perfect = saved && result.phase === 'stretched'
  const points = saved
    ? savePoints2D({ x: shot.x, y: shot.y }) + (perfect ? 25 : 0)
    : rivalMissed
      ? PROVOKE_MISS_POINTS
      : 0
  const gained = success ? points * game.state.combo : 0
  const prevCombo = game.state.combo
  // No duelo o que conta é o placar de gols, não a pontuação solo
  if (!game.duelActive) game.state = applyResult(game.state, { success, points })
  game.shot.saved = saved
  game.shot.rivalMissed = rivalMissed
  game.shot.defenseResult = result
  if (game.duelActive) duelCtl.keeperResolved(result, game.defense.target)

  if (saved) {
    hud.flash(perfect ? 'Defesaça!' : 'Defendeu!', 'save')
    if (!reducedMotion) {
      burst(fx, g.gx(shot.x), g.gy(shot.y), 'save')
      shake(fx, 6)
      floatText(fx, `+${gained}`, g.gx(shot.x), g.gy(shot.y) - 10, '255, 223, 27')
    }
    audio.save()
    if (game.state.combo > prevCombo) audio.comboUp(game.state.combo)
    navigator.vibrate?.(perfect ? [30, 40, 60] : 40)
  } else if (rivalMissed) {
    hud.flash('Isolou!', 'save')
    if (!reducedMotion) floatText(fx, `+${gained}`, g.gx(0), g.gy(0.8), '167, 139, 250')
    audio.whistle()
    if (game.state.combo > prevCombo) audio.comboUp(game.state.combo)
  } else {
    // Conta o que aconteceu: plantado, tarde, canto errado ou cedo demais
    const phaseMsg = {
      standing: 'Ficou plantado!',
      diving: 'Pulou tarde!',
      stretched: 'Canto errado!',
      grounded: 'Pulou cedo!',
    }
    hud.flash(boughtFeint ? 'Comprou a finta!' : (phaseMsg[result.phase] ?? 'Gol sofrido'), 'miss')
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
    : `Você levou a melhor em ${game.state.hits} de ${TOTAL_ROUNDS} chutes.`
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
  game.frameDt = dt

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

  // Mira 2D suavizada + janela de estabilidade, independentes do frame rate
  const rawAim = tilt.readAim(dt)
  const prev = { ...game.aim }
  const frames = Math.max(dt * 60, 1e-3)
  const alpha = 1 - Math.pow(1 - AIM_SMOOTH, frames)
  game.aim = {
    x: smoothAim(prev.x, rawAim.x, alpha),
    y: smoothAim(prev.y, rawAim.y, alpha),
  }
  game.aimDx = game.aim.x - prev.x
  const delta = Math.hypot(game.aim.x - prev.x, game.aim.y - prev.y)
  game.aimDeltas.push(delta / frames)
  if (game.aimDeltas.length > DELTA_WINDOW) game.aimDeltas.shift()
  game.stability = aimStability(game.aimDeltas)

  // Barra de força enquanto segura + aviso não-visual de carga cheia
  if (game.charge) {
    const power = powerFromHold((game.time - game.charge.start) * 1000)
    hud.setPower(power)
    if (power >= 1 && !game.charge.notifiedFull) {
      game.charge.notifiedFull = true
      audio.tap()
      navigator.vibrate?.(20)
    }
  }

  game.phaseT += dt

  if (game.mode === 'striker') {
    if (game.phase === 'runup' && game.phaseT >= game.shot.runupDuration) launchStrikerShot()
    else if (game.phase === 'flight' && game.phaseT >= game.shot.flightDur) {
      if (game.duelActive) duelCtl.onShooterFlightEnd()
      else endStrikerFlight()
    } else if (game.phase === 'outcome' && game.phaseT >= OUTCOME_S) {
      if (game.duelActive) duelCtl.onOutcomeEnd()
      else nextRoundOrFinish()
    }
  } else if (game.mode === 'keeper') {
    if (game.phase === 'windup' && game.phaseT >= (game.aiPlan?.windup ?? WINDUP_S)) launchAiShot()
    else if (game.phase === 'flight' && game.phaseT >= game.shot.duration) endKeeperFlight()
    else if (game.phase === 'outcome' && game.phaseT >= OUTCOME_S) {
      if (game.duelActive) duelCtl.onOutcomeEnd()
      else nextRoundOrFinish()
    }
  }
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

  if (game.mode === 'striker') renderStriker(ctx, g, game)
  else renderKeeperMode(ctx, g, game)

  drawFx(ctx, fx)
  drawVignette(ctx, g)
  ctx.restore()
}

// ---------- Duelo online ----------
const duelCtl = createDuelController({
  game,
  hud,
  audio,
  reducedMotion,
  fx: {
    rippleGoal(shotPos) {
      ripple(fx)
      burst(fx, g.gx(shotPos.x), g.gy(shotPos.y), 'goal')
      shake(fx, 8)
    },
  },
  startRound: () => startRound(),
  setPhase: (p) => setPhase(p),
  goToMenu: () => goToMenu(),
  ensureLoop: () => {
    resizeCanvas()
    ensureLoop()
    acquireWakeLock()
  },
})
duelCtl.init()

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
