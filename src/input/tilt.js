import { gammaToAim, betaToAimY } from '../game/aim.js'
import { TILT_RANGE_X_DEG, AIM_LIMIT_Y } from '../game/constants.js'
import { createShakeDetector } from '../game/shake.js'

// Entrada unificada de mira 2D: giroscópio (deviceorientation) com fallback
// de arrastar (toque/mouse) e teclado (setas). Expõe sempre {x: -1..limit, y: 0..1.35}.
// Também detecta chacoalhada via devicemotion (com fallbacks: tecla X e toque duplo).
//
// modos: 'tilt' | 'touch' | 'teclado'
export function createTiltInput() {
  const state = {
    mode: 'touch',
    supported: typeof window !== 'undefined' && 'DeviceOrientationEvent' in window,
    permissionNeeded:
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function',
    hasReading: false,
    permissionError: null,
    rawX: 0,
    rawY: 0,
    baselineX: 0,
    baselineY: 0,
    aim: { x: 0, y: 0.5 },
    limitX: 1, // modo artilheiro estende para além da trave
    keyDirX: 0,
    keyDirY: 0,
    dragging: false,
    dragArea: null,
  }

  const shakeDetector = createShakeDetector()
  let shakeCallback = null
  // Toque simples pendente {t, x, y} e info do toque atual {t, x, y, aimBefore}
  let lastTap = null
  let tapInfo = null

  function readTiltDegrees(event) {
    // Em portrait: gamma = esquerda/direita, beta = frente/trás (altura).
    // Em landscape os eixos trocam. Quando beta cruza ±90° (aparelho além da
    // vertical) a decomposição de Euler troca de ramo e gamma inverte — compensamos.
    const angle = screen.orientation?.angle ?? window.orientation ?? 0
    const beta = event.beta ?? 0
    const gamma = event.gamma ?? 0
    if (angle === 90) return { x: beta, y: -gamma }
    if (angle === -90 || angle === 270) return { x: -beta, y: gamma }
    const corrected = Math.abs(beta) > 90 ? -gamma : gamma
    if (angle === 180) return { x: -corrected, y: -beta }
    return { x: corrected, y: beta }
  }

  // Espera a mão assentar (~400ms) antes de capturar a nova baseline pós-rotação
  let rebaselineAt = 0
  function onOrientationChange() {
    // Girar a tela troca os eixos lidos: a baseline antiga não vale
    rebaselineAt = performance.now() + 400
  }

  function onOrientation(event) {
    if (event.gamma === null && event.beta === null) return
    const tiltAngles = readTiltDegrees(event)
    state.rawX = tiltAngles.x
    state.rawY = tiltAngles.y
    if (!state.hasReading) {
      state.hasReading = true
      state.baselineX = state.rawX
      state.baselineY = state.rawY
      state.mode = 'tilt'
    } else if (rebaselineAt && performance.now() >= rebaselineAt) {
      rebaselineAt = 0
      state.baselineX = state.rawX
      state.baselineY = state.rawY
    }
  }

  function onMotion(event) {
    const a = event.acceleration
    let magnitude
    if (a && (a.x !== null || a.y !== null || a.z !== null)) {
      magnitude = Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0)
    } else {
      const g = event.accelerationIncludingGravity
      if (!g) return
      magnitude = Math.abs(Math.hypot(g.x ?? 0, g.y ?? 0, g.z ?? 0) - 9.81)
    }
    if (shakeDetector.sample(performance.now(), magnitude)) fireShake()
  }

  // Cooldown único para todas as origens (sensor, tecla X, toque duplo):
  // impede metralhar especial/finta segurando a tecla ou tocando sem parar
  let lastShakeT = -Infinity
  function fireShake() {
    const now = performance.now()
    if (now - lastShakeT < 1000) return
    lastShakeT = now
    shakeCallback?.()
  }

  async function requestPermission() {
    if (!state.permissionNeeded) return 'granted'
    try {
      const result = await DeviceOrientationEvent.requestPermission()
      // devicemotion tem pedido próprio no iOS — aproveita o mesmo gesto
      if (typeof DeviceMotionEvent?.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission().catch(() => {})
      }
      state.permissionError = result === 'granted' ? null : `resultado: ${result}`
      return result
    } catch (error) {
      // iOS rejeita sem mostrar prompt quando a página roda em iframe de
      // outra origem ou em webview sem suporte — guardamos o motivo real
      state.permissionError = error?.message ?? String(error)
      return 'denied'
    }
  }

  function startSensor() {
    if (!state.supported) return
    window.addEventListener('deviceorientation', onOrientation)
    window.addEventListener('devicemotion', onMotion)
    screen.orientation?.addEventListener?.('change', onOrientationChange)
    window.addEventListener('orientationchange', onOrientationChange)
  }

  function calibrate() {
    if (state.hasReading) {
      state.baselineX = state.rawX
      state.baselineY = state.rawY
    }
  }

  // Zera o estado de mira ao iniciar uma sessão (nada vaza entre modos)
  function reset() {
    state.aim = { x: 0, y: 0.5 }
    state.keyDirX = 0
    state.keyDirY = 0
    state.dragging = false
  }

  function setLimitX(limit) {
    state.limitX = limit
  }

  function onShake(callback) {
    shakeCallback = callback
  }

  // --- Fallback: arrastar o dedo/mouse na cena (2D) ---
  function attachDragArea(element) {
    state.dragArea = element
    element.addEventListener('pointerdown', onPointer)
    element.addEventListener('pointermove', onPointer)
    element.addEventListener('pointerup', onPointerEnd)
    element.addEventListener('pointercancel', onPointerEnd)
  }
  // Rastreia o dedo que mira NA CENA (pode ser o segundo dedo do toque,
  // com o primeiro segurando o botão de ação fora da cena)
  let dragPointerId = null
  function onPointer(event) {
    if (event.type === 'pointerdown') {
      if (dragPointerId !== null) return // já existe um dedo mirando
      dragPointerId = event.pointerId
      state.dragging = true
      state.dragArea.setPointerCapture?.(event.pointerId)
      tapInfo = { t: performance.now(), x: event.clientX, y: event.clientY, aimBefore: { ...state.aim } }
    } else if (event.pointerId !== dragPointerId) {
      return
    }
    if (!state.dragging) return
    const rect = state.dragArea.getBoundingClientRect()
    const relX = (event.clientX - rect.left) / rect.width
    const relY = (event.clientY - rect.top) / rect.height
    state.aim = {
      x: Math.max(-state.limitX, Math.min(state.limitX, (relX * 2 - 1) * 1.2)),
      y: Math.max(0, Math.min(AIM_LIMIT_Y, (1 - relY) * 1.5)),
    }
    // Arrastar sobrepõe temporariamente o sensor, mas não rebaixa o modo tilt
    if (state.mode !== 'tilt') state.mode = 'touch'
  }
  function onPointerEnd(event) {
    if (event && event.pointerId !== dragPointerId) return
    dragPointerId = null
    state.dragging = false
    if (!tapInfo || !event) return
    const now = performance.now()
    const moved = Math.hypot(event.clientX - tapInfo.x, event.clientY - tapInfo.y)
    // "Toque" = rápido e sem arrastar; dois toques próximos = chacoalhada.
    // Restaura a mira anterior para o toque não deslocar a colocação.
    if (now - tapInfo.t < 250 && moved < 12) {
      if (lastTap && now - lastTap.t < 350 && Math.hypot(tapInfo.x - lastTap.x, tapInfo.y - lastTap.y) < 32) {
        state.aim = tapInfo.aimBefore
        lastTap = null
        fireShake()
      } else {
        lastTap = { t: now, x: tapInfo.x, y: tapInfo.y }
      }
    }
    tapInfo = null
  }

  // --- Fallback: teclado (desktop) ---
  function onKey(event) {
    if ((event.key === 'x' || event.key === 'X') && event.type === 'keydown') {
      if (event.repeat) return
      fireShake()
      return
    }
    const dirX = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : null
    const dirY = event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : null
    if (dirX === null && dirY === null) return
    event.preventDefault()
    const pressed = event.type === 'keydown'
    if (dirX !== null) state.keyDirX = pressed ? dirX : 0
    if (dirY !== null) state.keyDirY = pressed ? dirY : 0
    if (state.mode !== 'tilt' && pressed) state.mode = 'teclado'
  }
  window.addEventListener('keydown', onKey)
  window.addEventListener('keyup', onKey)

  // Chamado a cada frame pelo loop do jogo; dt em segundos.
  // Prioridade: arrasto ativo > teclado pressionado > sensor.
  const KEY_SPEED = 2.1
  function readAim(dt) {
    if (state.dragging) return state.aim
    if (state.keyDirX !== 0 || state.keyDirY !== 0) {
      state.aim = {
        x: Math.max(-state.limitX, Math.min(state.limitX, state.aim.x + state.keyDirX * KEY_SPEED * dt)),
        y: Math.max(0, Math.min(AIM_LIMIT_Y, state.aim.y + state.keyDirY * KEY_SPEED * dt)),
      }
    } else if (state.mode === 'tilt' && state.hasReading) {
      state.aim = {
        x: gammaToAim(state.rawX, state.baselineX, TILT_RANGE_X_DEG, state.limitX),
        y: betaToAimY(state.rawY, state.baselineY),
      }
    }
    return state.aim
  }

  function destroy() {
    window.removeEventListener('deviceorientation', onOrientation)
    window.removeEventListener('devicemotion', onMotion)
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('keyup', onKey)
  }

  return {
    state,
    requestPermission,
    startSensor,
    calibrate,
    reset,
    setLimitX,
    onShake,
    attachDragArea,
    readAim,
    destroy,
  }
}
