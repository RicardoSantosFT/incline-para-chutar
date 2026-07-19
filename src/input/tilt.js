import { gammaToAim } from '../game/aim.js'
import { TILT_RANGE_DEG } from '../game/constants.js'

// Entrada unificada de mira: giroscópio (deviceorientation) com fallback
// de arrastar (toque/mouse) e teclado (setas). Expõe sempre um aim -1..1.
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
    rawGamma: 0,
    baseline: 0,
    aim: 0,
    keyDirection: 0,
    dragging: false,
    dragArea: null,
  }

  function readTiltDegrees(event) {
    // Em portrait, gamma é a inclinação esquerda/direita. Em landscape o
    // eixo útil vira beta; usamos a orientação da tela para escolher.
    // Quando beta cruza ±90° (aparelho além da vertical) a decomposição de
    // Euler troca de ramo e gamma inverte de sinal — compensamos aqui.
    const angle = screen.orientation?.angle ?? window.orientation ?? 0
    const beta = event.beta ?? 0
    const gamma = event.gamma ?? 0
    if (angle === 90) return beta
    if (angle === -90 || angle === 270) return -beta
    const corrected = Math.abs(beta) > 90 ? -gamma : gamma
    return angle === 180 ? -corrected : corrected
  }

  let rebaseline = false
  function onOrientationChange() {
    // Girar a tela troca o eixo lido (gamma↔beta): a baseline antiga não vale
    rebaseline = true
  }

  function onOrientation(event) {
    if (event.gamma === null && event.beta === null) return
    state.rawGamma = readTiltDegrees(event)
    if (!state.hasReading) {
      state.hasReading = true
      state.baseline = state.rawGamma
      state.mode = 'tilt'
    } else if (rebaseline) {
      rebaseline = false
      state.baseline = state.rawGamma
    }
  }

  async function requestPermission() {
    if (!state.permissionNeeded) return 'granted'
    try {
      const result = await DeviceOrientationEvent.requestPermission()
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
    screen.orientation?.addEventListener?.('change', onOrientationChange)
    window.addEventListener('orientationchange', onOrientationChange)
  }

  function calibrate() {
    if (state.hasReading) state.baseline = state.rawGamma
  }

  // Zera o estado de mira ao iniciar uma sessão (nada vaza entre modos)
  function reset() {
    state.aim = 0
    state.keyDirection = 0
    state.dragging = false
  }

  // --- Fallback: arrastar o dedo/mouse na cena ---
  function attachDragArea(element) {
    state.dragArea = element
    element.addEventListener('pointerdown', onPointer)
    element.addEventListener('pointermove', onPointer)
    element.addEventListener('pointerup', onPointerEnd)
    element.addEventListener('pointercancel', onPointerEnd)
  }
  function onPointer(event) {
    if (event.type === 'pointerdown') {
      state.dragging = true
      state.dragArea.setPointerCapture?.(event.pointerId)
    }
    if (!state.dragging) return
    const rect = state.dragArea.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width
    state.aim = Math.max(-1, Math.min(1, x * 2 - 1))
    // Arrastar sobrepõe temporariamente o sensor, mas não rebaixa o modo tilt
    if (state.mode !== 'tilt') state.mode = 'touch'
  }
  function onPointerEnd() {
    state.dragging = false
  }

  // --- Fallback: teclado (desktop) ---
  function onKey(event) {
    const dir = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : null
    if (dir === null) return
    event.preventDefault()
    state.keyDirection = event.type === 'keydown' ? dir : 0
    if (state.mode !== 'tilt' && event.type === 'keydown') state.mode = 'teclado'
  }
  window.addEventListener('keydown', onKey)
  window.addEventListener('keyup', onKey)

  // Chamado a cada frame pelo loop do jogo; dt em segundos.
  // Prioridade: arrasto ativo > teclado pressionado > sensor.
  const KEY_SPEED = 1.9
  function readAim(dt) {
    if (state.dragging) return state.aim
    if (state.keyDirection !== 0) {
      state.aim = Math.max(-1, Math.min(1, state.aim + state.keyDirection * KEY_SPEED * dt))
    } else if (state.mode === 'tilt' && state.hasReading) {
      state.aim = gammaToAim(state.rawGamma, state.baseline, TILT_RANGE_DEG)
    }
    return state.aim
  }

  function destroy() {
    window.removeEventListener('deviceorientation', onOrientation)
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('keyup', onKey)
  }

  return {
    state,
    requestPermission,
    startSensor,
    calibrate,
    reset,
    attachDragArea,
    readAim,
    destroy,
  }
}
