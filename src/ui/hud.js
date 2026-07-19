import { MAX_COMBO, TOTAL_ROUNDS } from '../game/constants.js'

// Camada DOM do jogo: placar, combo, mensagens e telas.
export function createHud() {
  const el = (id) => document.getElementById(id)
  const nodes = {
    screens: {
      menu: el('screen-menu'),
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

  function flash(text, kind) {
    nodes.flash.textContent = text
    nodes.flash.className = `flash-msg flash-msg--${kind}`
    // reinicia a animação
    void nodes.flash.offsetWidth
    nodes.flash.classList.add('is-on')
    nodes.live.textContent = text
  }

  function setHint(html) {
    nodes.actionHint.innerHTML = html
  }

  function setSensorChip(mode) {
    const labels = { tilt: 'Giroscópio', touch: 'Modo toque', teclado: 'Teclado ← →' }
    nodes.sensorChip.textContent = labels[mode] ?? mode
    nodes.sensorChip.classList.toggle('is-fallback', mode !== 'tilt')
  }

  function setShootVisible(visible) {
    nodes.shootBtn.style.display = visible ? '' : 'none'
  }

  function setShootEnabled(enabled) {
    nodes.shootBtn.disabled = !enabled
  }

  return { nodes, showScreen, updateScore, updateHits, flash, setHint, setSensorChip, setShootVisible, setShootEnabled }
}

export const COACH_TIPS = [
  'Incline devagar para ter mais controle e mire no centro para mais pontos!',
  'O arco da retícula mostra sua estabilidade: espere ele fechar antes de chutar.',
  'Chute instável desvia! Segure a mira parada por um instante antes de bater.',
  'No modo goleiro, fique no centro e reaja: incline forte na hora do chute.',
  'Cantos valem menos, mas o goleiro rival adora ficar no meio. Varie o alvo!',
  'Sequência de acertos multiplica os pontos: proteja seu combo!',
  'Errar o gol zera o combo. Melhor um chute calmo do que um chute afobado.',
]
