import { MAX_COMBO, TOTAL_ROUNDS } from '../game/constants.js'

// Camada DOM do jogo: placar, combo, mensagens e telas.
export function createHud() {
  const el = (id) => document.getElementById(id)
  const nodes = {
    screens: {
      menu: el('screen-menu'),
      duel: el('screen-duel'),
      falta: el('screen-falta'),
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
    shotClock: el('shot-clock'),
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

  // Relógio de chute: null esconde; número mostra (vermelho pulsando no fim)
  let lastClock = null
  function setClock(seconds) {
    if (seconds === lastClock) return
    lastClock = seconds
    if (seconds === null) {
      nodes.shotClock.hidden = true
      return
    }
    nodes.shotClock.hidden = false
    nodes.shotClock.textContent = String(seconds)
    nodes.shotClock.classList.toggle('is-urgent', seconds <= 2)
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
    setClock,
    showSpecial,
  }
}

export const COACH_TIPS = [
  'Incline devagar para ter mais controle: agora a mira é livre, dá até para isolar!',
  'O arco da retícula mostra sua estabilidade: espere ele fechar antes de chutar.',
  'Colado no ângulo vale 250, mas é onde mais se isola — mão firme e força na medida.',
  'Junto à trave sempre paga mais que no miolo: arrisque o canto quando a mão firmar.',
  'Meia altura no centro é altura de goleiro: vale só 50. Fuja dela!',
  'Segure o botão para dar força. Toque curtinho é cavadinha: humilha goleiro que pulou!',
  'Chacoalhe o celular antes de bater para armar um golpe especial.',
  'No modo goleiro, chacoalhe durante a corrida do rival para deixá-lo nervoso.',
  'No gol, a força do pulo tem que casar com a distância: canto longe pede carga cheia.',
  'No gol, o arco da retícula fecha quando a força está na medida da mira. Solte ali!',
  'Força demais em bola perto faz o goleiro passar direto. Menos é mais no meio do gol.',
  'O rival adora uma paradinha: se você voar antes do chute, já era. Segure o nervo!',
  'Bola fraca dá tempo de encaixar a defesa; bolão exige mergulho no ponto exato.',
  'Defender vale como chutar: segurar bola que ia no ângulo paga 250!',
  'Chute no máximo de força sai um foguete, mas fica mais difícil de colocar no canto.',
  'Sequência de acertos multiplica os pontos: proteja seu combo!',
  'Na falta, menos força faz a bola subir por cima da barreira e ainda cair no gol.',
  'Na falta, bomba rasteira no meio morre na barreira: prefira o canto ou o voo alto.',
  'Cada jogador na barreira adiciona +20 pontos ao seu gol de falta: barreira cheia paga mais!',
  'De goleiro na falta: barreira pequena deixa a defesa valer muito mais pontos.',
  'Fique de olho no clima: vento lateral desvia a bola no ar — compense a mira!',
]
