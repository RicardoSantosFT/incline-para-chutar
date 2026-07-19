import { MAX_COMBO, TOTAL_ROUNDS } from '../game/constants.js'

// Camada DOM do jogo: placar, combo, mensagens e telas.
export function createHud() {
  const el = (id) => document.getElementById(id)
  const nodes = {
    screens: {
      menu: el('screen-menu'),
      duel: el('screen-duel'),
      game: el('screen-game'),
      result: el('screen-result'),
    },
    bestStriker: el('best-striker'),
    bestKeeper: el('best-keeper'),
    gameTitle: el('game-title'),
    sensorChip: el('sensor-chip'),
    score: el('hud-score'),
    best: el('hud-best'),
    combo: el('hud-combo'),
    comboFill: el('combo-fill'),
    round: el('hud-round'),
    hits: el('hud-hits'),
    flash: el('flash-msg'),
    live: el('round-live'),
    shootBtn: el('btn-shoot'),
    shootLabel: el('btn-action-label'),
    powerFill: el('power-fill'),
    specialBadge: el('special-badge'),
    actionHint: el('action-hint'),
    resultEyebrow: el('result-eyebrow'),
    resultTitle: el('result-title'),
    resultSub: el('result-sub'),
    resScore: el('res-score'),
    resHits: el('res-hits'),
    resHitsLabel: el('res-hits-label'),
    resCombo: el('res-combo'),
    newRecord: el('new-record'),
    coachTip: el('coach-tip-text'),
    overlayPermission: el('overlay-permission'),
    overlayCalibrate: el('overlay-calibrate'),
  }

  function showScreen(name) {
    for (const [key, screen] of Object.entries(nodes.screens)) {
      screen.classList.toggle('is-active', key === name)
    }
  }

  function updateScore(state) {
    nodes.score.textContent = String(state.score)
    nodes.best.textContent = `Melhor: ${Math.max(state.best, state.score)}`
    nodes.combo.textContent = `x${state.combo}`
    nodes.comboFill.style.width = `${((state.combo - 1) / (MAX_COMBO - 1)) * 100}%`
    nodes.round.textContent = `${Math.min(state.round, TOTAL_ROUNDS)}/${TOTAL_ROUNDS}`
  }

  function updateHits(state, mode) {
    const singular = mode === 'striker' ? 'gol' : 'defesa'
    const label = state.hits === 1 ? singular : `${singular}s`
    nodes.hits.textContent = `${state.hits} ${label}`
  }

  let flashTimer = null
  function flash(text, kind) {
    nodes.flash.textContent = text
    nodes.flash.className = `flash-msg flash-msg--${kind}`
    // reinicia a animação
    void nodes.flash.offsetWidth
    nodes.flash.classList.add('is-on')
    nodes.live.textContent = text
    // Com prefers-reduced-motion a animação não roda: remove a classe na mão
    clearTimeout(flashTimer)
    flashTimer = setTimeout(() => nodes.flash.classList.remove('is-on'), 1200)
  }

  function setHint(html) {
    nodes.actionHint.innerHTML = html
  }

  function setSensorChip(mode) {
    const labels = { tilt: 'Giroscópio', touch: 'Modo toque', teclado: 'Teclado' }
    nodes.sensorChip.textContent = labels[mode] ?? mode
    nodes.sensorChip.classList.toggle('is-fallback', mode !== 'tilt')
  }

  function setShootVisible(visible) {
    nodes.shootBtn.style.display = visible ? '' : 'none'
  }

  function setShootEnabled(enabled) {
    nodes.shootBtn.disabled = !enabled
  }

  function setShootLabel(text) {
    nodes.shootLabel.textContent = text
  }

  function setPower(fraction) {
    nodes.powerFill.style.width = `${Math.round(fraction * 100)}%`
  }

  function showSpecial(name) {
    if (!name) {
      nodes.specialBadge.hidden = true
      return
    }
    nodes.specialBadge.textContent = `Especial: ${name}`
    nodes.specialBadge.hidden = false
    nodes.specialBadge.classList.remove('is-pop')
    void nodes.specialBadge.offsetWidth
    nodes.specialBadge.classList.add('is-pop')
    // O selo é visual; leitores de tela recebem pela região viva
    nodes.live.textContent = `Especial armado: ${name}`
  }

  return {
    nodes,
    showScreen,
    updateScore,
    updateHits,
    flash,
    setHint,
    setSensorChip,
    setShootVisible,
    setShootEnabled,
    setShootLabel,
    setPower,
    showSpecial,
  }
}

export const COACH_TIPS = [
  'Incline devagar para ter mais controle: agora a mira é livre, dá até para isolar!',
  'O arco da retícula mostra sua estabilidade: espere ele fechar antes de chutar.',
  'Bola alta vale ×1,5 — mas cuidado para não mandar por cima do travessão.',
  'Segure o botão para dar força. Toque curtinho é cavadinha: humilha goleiro que pulou!',
  'Chacoalhe o celular antes de bater para armar um golpe especial.',
  'No modo goleiro, chacoalhe durante a corrida do rival para deixá-lo nervoso.',
  'No modo goleiro, o mergulho leva tempo: para canto longe, solte um tiquinho antes.',
  'O rival adora uma paradinha: se você voar antes do chute, já era. Segure o nervo!',
  'Bola fraca dá tempo de encaixar a defesa; bolão exige mergulho no ponto exato.',
  'Chute no máximo de força sai um foguete, mas fica mais difícil de colocar no canto.',
  'Sequência de acertos multiplica os pontos: proteja seu combo!',
]
