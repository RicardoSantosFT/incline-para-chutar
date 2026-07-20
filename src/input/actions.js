// Entrada do botão de ação (segurar/soltar) nas três superfícies:
// botão físico, barra de espaço/Enter e — no modo goleiro com sensor —
// QUALQUER lugar da tela (o jogador segura a tela, mira inclinando e solta
// para voar). A carga pertence ao ponteiro que apertou (pointer capture).
import { DEFENSE_CHARGE_S } from '../game/constants.js'
import { divePlan } from '../game/keeper.js'

const QUICK_TAP_CANCEL_S = 0.12 // toque acidental na tela não desperdiça o voo

export function initActionInput({ game, hud, audio, tilt, shoot }) {
  let actionPointerId = null
  let actionHeld = false
  let actionKeyHeld = false
  let screenHoldId = null

  function onActionPress() {
    if (game.mode === 'striker' && game.phase === 'aim' && !game.charge) {
      game.charge = { start: game.time, notifiedFull: false }
      hud.setShootLabel('Solte para chutar!')
    } else if (game.mode === 'keeper' && (game.phase === 'countdown' || game.phase === 'windup' || game.phase === 'flight')) {
      if (game.defense && !game.defense.released && !game.defense.holding) {
        game.defense.holding = true
        game.defense.chargeStart = game.time
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
      (game.phase === 'countdown' || game.phase === 'windup' || game.phase === 'flight') &&
      game.defense?.holding &&
      !game.defense.released
    ) {
      const heldS = game.time - game.defense.chargeStart
      if (heldS < QUICK_TAP_CANCEL_S) {
        // Encostou sem querer: não desperdiça o mergulho
        game.defense.holding = false
        game.defense.chargeStart = null
        hud.setPower(0)
        hud.setShootLabel('Defender!')
        return
      }
      // Voa para onde a mira aponta AGORA, com a força carregada
      const target = {
        x: Math.max(-1, Math.min(1, game.aim.x)),
        y: Math.max(0.08, Math.min(1, game.aim.y)),
      }
      const power = Math.min(1, heldS / DEFENSE_CHARGE_S)
      const plan = divePlan({ target, power })
      game.defense.released = true
      game.defense.releaseTime = game.time
      game.defense.target = target
      game.defense.power = power
      game.defense.plan = plan
      game.defense.diveTime = plan.diveTime
      hud.setPower(0)
      hud.setShootLabel('Voou!')
      audio.tap()
      navigator.vibrate?.(15)
    }
  }

  // --- Botão físico (pointer capture) ---
  hud.nodes.shootBtn.addEventListener('pointerdown', (event) => {
    event.preventDefault()
    actionPointerId = event.pointerId
    hud.nodes.shootBtn.setPointerCapture?.(event.pointerId)
    actionHeld = true
    onActionPress()
  })
  const onButtonPointerEnd = (event) => {
    if (event.pointerId !== actionPointerId) return
    actionPointerId = null
    actionHeld = false
    onActionRelease()
  }
  hud.nodes.shootBtn.addEventListener('pointerup', onButtonPointerEnd)
  hud.nodes.shootBtn.addEventListener('pointercancel', onButtonPointerEnd)
  hud.nodes.shootBtn.addEventListener('contextmenu', (event) => event.preventDefault())

  // --- Goleiro com sensor: segurar em QUALQUER lugar da tela ---
  hud.nodes.screens.game.addEventListener('pointerdown', (event) => {
    if (game.mode !== 'keeper' || tilt.state.mode !== 'tilt') return
    if (event.target.closest('button')) return
    if (screenHoldId !== null || actionPointerId !== null) return
    screenHoldId = event.pointerId
    onActionPress()
  })
  const onScreenPointerEnd = (event) => {
    if (event.pointerId !== screenHoldId) return
    screenHoldId = null
    onActionRelease()
  }
  window.addEventListener('pointerup', onScreenPointerEnd)
  window.addEventListener('pointercancel', onScreenPointerEnd)

  // --- Teclado (espaço/Enter) ---
  window.addEventListener('keydown', (event) => {
    if (event.key !== ' ' && event.key !== 'Enter') return
    if (event.repeat) return
    // Com outro botão focado (voltar, som), deixa a ativação nativa acontecer
    const focused = document.activeElement
    if (focused?.tagName === 'BUTTON' && focused !== hud.nodes.shootBtn) return
    actionHeld = true
    actionKeyHeld = true
    if (['aim', 'countdown', 'windup', 'flight'].includes(game.phase)) {
      event.preventDefault()
      onActionPress()
    }
  })
  window.addEventListener('keyup', (event) => {
    if (event.key !== ' ' && event.key !== 'Enter') return
    // keyup solto sem keydown próprio não pode largar um hold do ponteiro
    if (!actionKeyHeld) return
    actionKeyHeld = false
    if (actionPointerId !== null || screenHoldId !== null) return
    actionHeld = false
    onActionRelease()
  })

  return {
    isHeld: () => actionHeld || screenHoldId !== null,
  }
}
