// Controlador do duelo online: sala, handshake, orquestração de cada bola,
// placar, W.O. e revanche. O batedor calcula a colocação da bola e envia;
// o goleiro resolve a defesa localmente e devolve o resultado — os dois lados
// aplicam os mesmos eventos no protocolo puro (duel.js).
import { createTransport } from './transport.js'
import { createDuel, applyDuelEvent, makeRoomCode, validateDuelMsg, BALLS_PER_SIDE } from './duel.js'
import { computeShotPlacement } from '../game/shot.js'
import { flightDuration, CAVADINHA_DURATION_S } from '../game/power.js'
import { SPECIALS } from '../game/specials.js'

const PING_MS = 4000
const PEER_TIMEOUT_MS = 12000
const RESULT_TIMEOUT_MS = 8000

export function createDuelController(ctx) {
  // ctx: { game, hud, audio, fx: {ripple, burst, floatText}, reducedMotion,
  //        getG, startRound, setPhase, goToMenu }
  const { game, hud, audio } = ctx
  const el = (id) => document.getElementById(id)

  let transport = null
  let duel = null
  let role = null
  let roomCode = null
  let peerSeen = 0
  let pingTimer = null
  let watchdogTimer = null
  let awaitTimer = null
  let pendingKick = null // chute recebido (pode chegar antes do beginBall local)
  let pendingResult = null // resultado recebido antes da animação local acabar
  let rematch = { me: false, peer: false }

  const other = (r) => (r === 'host' ? 'guest' : 'host')
  const iShoot = () => duel && duel.shooter === role

  // ---------- Sala ----------
  function openLobby(prefillCode = '') {
    hud.showScreen('duel')
    el('duel-transport-note').textContent = ''
    if (prefillCode) {
      el('duel-code-input').value = prefillCode
      joinRoom(prefillCode)
    }
  }

  function transportNote(kind) {
    el('duel-transport-note').textContent =
      kind === 'local'
        ? 'Sem Supabase configurado: duelo local entre duas abas deste aparelho.'
        : 'Conectado via Supabase Realtime.'
  }

  function createRoom() {
    cleanup()
    role = 'host'
    roomCode = makeRoomCode()
    duel = createDuel(role)
    el('duel-room-info').hidden = false
    el('duel-code').textContent = roomCode
    el('duel-status-host').textContent = 'Aguardando adversário…'
    connect()
  }

  function joinRoom(codeRaw) {
    const code = String(codeRaw ?? el('duel-code-input').value).trim().toUpperCase()
    if (!/^[A-Z2-9]{4}$/.test(code)) {
      el('duel-status-join').textContent = 'Código inválido — são 4 letras/números.'
      return
    }
    cleanup()
    role = 'guest'
    roomCode = code
    duel = createDuel(role)
    el('duel-status-join').textContent = 'Entrando na sala…'
    connect()
    send({ type: 'hello', role })
  }

  function connect() {
    transport = createTransport(roomCode)
    transportNote(transport.kind)
    transport.onStatus((status) => {
      if (status === 'error') {
        statusLine('Conexão falhou. Verifique a internet e tente de novo.')
      } else if (status === 'reconnecting') {
        statusLine('Reconectando…')
      }
    })
    transport.onMessage((raw) => {
      const msg = validateDuelMsg(raw)
      if (!msg) return
      peerSeen = performance.now()
      handleMessage(msg)
    })
    peerSeen = performance.now()
    clearInterval(pingTimer)
    pingTimer = setInterval(() => send({ type: 'ping' }), PING_MS)
    clearInterval(watchdogTimer)
    watchdogTimer = setInterval(checkPeer, 3000)
  }

  function statusLine(text) {
    if (role === 'host') el('duel-status-host').textContent = text
    else el('duel-status-join').textContent = text
  }

  function send(msg) {
    transport?.send(msg)
  }

  function checkPeer() {
    if (!duel || duel.phase !== 'playing') return
    if (performance.now() - peerSeen > PEER_TIMEOUT_MS) {
      duel = applyDuelEvent(duel, { type: 'forfeit', by: other(role) })
      showDuelResult()
    }
  }

  // ---------- Mensagens ----------
  function handleMessage(msg) {
    switch (msg.type) {
      case 'hello': {
        if (role === 'host' && duel.phase === 'lobby') {
          send({ type: 'hello', role })
          el('duel-status-host').textContent = 'Adversário conectado! Sorteando…'
          const firstShooter = Math.random() < 0.5 ? 'host' : 'guest'
          setTimeout(() => {
            send({ type: 'start', firstShooter })
            duel = applyDuelEvent(duel, { type: 'start', firstShooter })
            beginBall()
          }, 700)
        } else if (role === 'guest') {
          el('duel-status-join').textContent = 'Conectado! Sorteando quem bate…'
        }
        break
      }
      case 'start': {
        if (duel.phase === 'done') duel = createDuel(role) // revanche
        if (duel.phase !== 'lobby') return
        rematch = { me: false, peer: false }
        duel = applyDuelEvent(duel, msg)
        beginBall()
        break
      }
      case 'kick': {
        if (!duel || duel.phase !== 'playing' || iShoot() || msg.ball !== duel.ball) return
        pendingKick = msg
        applyPendingKick()
        break
      }
      case 'ball-result': {
        if (!duel) return
        // O resultado pode chegar ANTES da animação local do batedor acabar:
        // guarda e resolve quando o voo terminar
        if (game.duelAwaiting) resolveShooterOutcome(msg)
        else if (iShoot()) pendingResult = msg
        duel = applyDuelEvent(duel, msg)
        updateBoard()
        break
      }
      case 'feint': {
        game.rivalFeintUntil = game.time + 0.9
        break
      }
      case 'rematch': {
        rematch.peer = true
        maybeStartRematch()
        break
      }
      case 'forfeit': {
        duel = applyDuelEvent(duel, msg)
        if (duel.phase === 'done') showDuelResult()
        break
      }
    }
  }

  // Aplica o chute pendente quando a rodada do goleiro estiver pronta
  function applyPendingKick() {
    if (!pendingKick || !duel) return
    if (iShoot() || game.mode !== 'keeper' || !game.duelActive) return
    if (pendingKick.ball !== duel.ball) return
    const msg = pendingKick
    game.duelShot = { x: msg.shot.x, y: msg.shot.y, duration: msg.flightDur }
    game.aiPlan = { feint: msg.specialId === 'paradinha', windup: msg.runupDuration }
    ctx.setPhase('windup')
  }

  // ---------- Rodadas ----------
  function beginBall() {
    game.duelActive = true
    game.duelAwaiting = false
    game.rivalFeintUntil = 0
    pendingResult = null
    // pendingKick de bola antiga não vale; da bola atual será aplicado abaixo
    if (pendingKick && pendingKick.ball !== duel.ball) pendingKick = null
    game.mode = iShoot() ? 'striker' : 'keeper'
    el('screen-game').classList.add('is-duel')
    el('duel-bar').hidden = false
    hud.showScreen('game')
    ctx.ensureLoop()
    ctx.startRound()
    if (iShoot()) {
      hud.flash('Você bate!', 'save')
      hud.setHint('Sua vez: mire, <b>segure e solte</b> · chacoalhe = especial')
    } else {
      // Goleiro espera o chute real — nada de rival automático
      game.aiPlan = { feint: false, windup: Infinity }
      hud.flash('Defenda!', 'save')
      hud.setHint('O rival prepara o chute… mire o canto e <b>solte para voar</b>')
      applyPendingKick()
    }
    updateBoard()
  }

  // Batedor soltou o botão: calcula a colocação, avisa o rival e anima
  function onShoot({ aim, stability, power, cavadinha, special, pose, runupDuration }) {
    const placement = computeShotPlacement({
      aim,
      stability,
      power,
      cavadinha,
      special,
      rngSpreadX: Math.random(),
      rngSpreadY: Math.random(),
    })
    const flightDur = cavadinha ? CAVADINHA_DURATION_S : flightDuration(power)
    game.shot = {
      pending: true,
      ...placement,
      power,
      cavadinha,
      special,
      pose,
      runupDuration,
      flightDur,
      curve: special?.id === 'curva',
      dive: { x: 0, y: 0.35 },
      committed: false,
      saved: false,
    }
    send({
      type: 'kick',
      ball: duel.ball,
      shot: placement.shot,
      power,
      cavadinha,
      specialId: special?.id ?? null,
      runupDuration,
      flightDur,
      offTarget: placement.offTarget,
      overBar: placement.overBar,
      pose,
    })
  }

  function onShooterFlightEnd() {
    if (pendingResult) {
      // O veredito já chegou enquanto a bola voava: resolve na hora
      const msg = pendingResult
      pendingResult = null
      resolveShooterOutcome(msg)
      return
    }
    game.duelAwaiting = true
    ctx.setPhase('await')
    hud.setHint('O goleiro rival se joga…')
    clearTimeout(awaitTimer)
    awaitTimer = setTimeout(() => {
      if (game.duelAwaiting) {
        duel = applyDuelEvent(duel, { type: 'forfeit', by: other(role) })
        showDuelResult()
      }
    }, RESULT_TIMEOUT_MS)
  }

  function resolveShooterOutcome(msg) {
    clearTimeout(awaitTimer)
    game.duelAwaiting = false
    const shot = game.shot
    shot.saved = Boolean(msg.saved)
    shot.dive = { x: msg.keeper?.x ?? 0, y: msg.keeper?.y ?? 0.35 }
    shot.committed = msg.keeper?.phase === 'grounded'
    if (msg.scored) {
      const flashText = shot.cavadinha ? 'Cavadinha!' : shot.special ? `${shot.special.nome}!` : 'Goool!'
      hud.flash(flashText, 'goal')
      if (!ctx.reducedMotion) ctx.fx.rippleGoal(shot.shot)
      audio.goal()
    } else if (shot.saved) {
      hud.flash('Defendeu o rival!', 'save')
      audio.save()
    } else {
      hud.flash(shot.overBar ? 'Por cima!' : 'Pra fora!', 'miss')
      audio.miss()
    }
    ctx.setPhase('outcome')
  }

  // Goleiro resolveu a defesa localmente: publica o resultado da bola
  function keeperResolved(result, defenseTarget) {
    if (!duel || duel.phase !== 'playing' || iShoot()) return
    const scored = !result.saved && !pendingKick?.offTarget
    const msg = {
      type: 'ball-result',
      ball: duel.ball,
      shooter: duel.shooter,
      scored,
      saved: result.saved,
      keeper: { x: defenseTarget?.x ?? 0, y: defenseTarget?.y ?? 0.35, phase: result.phase },
    }
    send(msg)
    duel = applyDuelEvent(duel, msg)
    updateBoard()
  }

  // Fim da janela de outcome: próxima bola ou fim de jogo
  function onOutcomeEnd() {
    if (!duel) return
    if (duel.phase === 'done') showDuelResult()
    else beginBall()
  }

  function sendFeint() {
    send({ type: 'feint' })
  }

  // ---------- Placar ----------
  function updateBoard() {
    if (!duel) return
    window.__duelDbg = { ball: duel.ball, shooter: duel.shooter, phase: duel.phase, score: duel.score }
    const me = role
    const rival = other(role)
    el('duel-score-me').textContent = String(duel.score[me])
    el('duel-score-rival').textContent = String(duel.score[rival])
    renderBalls(el('duel-balls-me'), me)
    renderBalls(el('duel-balls-rival'), rival)
  }

  function renderBalls(container, side) {
    const mine = duel.balls.filter((b) => b.shooter === side)
    const total = Math.max(BALLS_PER_SIDE, mine.length)
    let html = ''
    for (let i = 0; i < total; i++) {
      const b = mine[i]
      html += `<i class="${b ? (b.scored ? 'is-goal' : 'is-miss') : ''}"></i>`
    }
    container.innerHTML = html
  }

  // ---------- Fim / revanche ----------
  function showDuelResult() {
    clearTimeout(awaitTimer)
    game.duelActive = false
    game.duelAwaiting = false
    game.phase = 'menu'
    const me = duel.score[role]
    const rival = duel.score[other(role)]
    const won = duel.winner === role
    hud.nodes.resultEyebrow.textContent = 'Duelo online'
    hud.nodes.resultTitle.textContent = duel.winner === null ? 'Empate!' : won ? 'Vitória!' : 'Derrota'
    hud.nodes.resultTitle.classList.toggle('is-loss', !won && duel.winner !== null)
    hud.nodes.resultSub.textContent = duel.byForfeit
      ? won
        ? 'O rival abandonou a partida. Vitória por W.O.!'
        : 'Você abandonou a partida.'
      : `Placar final: ${me} × ${rival}`
    hud.nodes.resScore.textContent = String(me)
    hud.nodes.resHits.textContent = String(rival)
    hud.nodes.resHitsLabel.textContent = 'Rival'
    hud.nodes.resCombo.textContent = `${duel.balls.length}`
    hud.nodes.newRecord.hidden = true
    el('btn-rematch').hidden = duel.byForfeit
    el('btn-rematch').disabled = false
    el('btn-again').hidden = true
    hud.showScreen('result')
    if (won) audio.whistle()
  }

  function requestRematch() {
    rematch.me = true
    send({ type: 'rematch' })
    el('btn-rematch').disabled = true
    hud.nodes.resultSub.textContent = 'Aguardando o rival aceitar a revanche…'
    maybeStartRematch()
  }

  function maybeStartRematch() {
    if (!rematch.me || !rematch.peer) return
    if (role === 'host') {
      const firstShooter = other(duel.firstShooter ?? 'host')
      duel = createDuel(role)
      send({ type: 'start', firstShooter })
      duel = applyDuelEvent(duel, { type: 'start', firstShooter })
      rematch = { me: false, peer: false }
      beginBall()
    }
    // guest espera o start do host (handleMessage cuida)
  }

  function leave() {
    if (duel && duel.phase === 'playing') send({ type: 'forfeit', by: role })
    cleanup()
    el('screen-game').classList.remove('is-duel')
    el('duel-bar').hidden = true
    el('btn-again').hidden = false
    el('btn-rematch').hidden = true
    game.duelActive = false
    game.duelAwaiting = false
  }

  function cleanup() {
    clearInterval(pingTimer)
    clearInterval(watchdogTimer)
    clearTimeout(awaitTimer)
    transport?.close()
    transport = null
    duel = null
    pendingKick = null
    rematch = { me: false, peer: false }
    el('duel-room-info').hidden = true
    el('duel-status-join').textContent = ''
  }

  // ---------- Ligações de DOM ----------
  function init() {
    el('btn-duel-create').addEventListener('click', () => {
      audio.tap()
      createRoom()
    })
    el('btn-duel-join').addEventListener('click', () => {
      audio.tap()
      joinRoom()
    })
    el('duel-code-input').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') joinRoom()
    })
    el('btn-duel-copy').addEventListener('click', async () => {
      const link = `${location.origin}${location.pathname}?sala=${roomCode}`
      try {
        await navigator.clipboard.writeText(`Duelo de pênaltis no Radar FC! ⚽ Entra aí: ${link}`)
        el('btn-duel-copy').textContent = 'Convite copiado!'
        setTimeout(() => (el('btn-duel-copy').textContent = 'Copiar convite'), 1800)
      } catch {
        prompt('Copie o convite:', link)
      }
    })
    el('btn-duel-back').addEventListener('click', () => {
      audio.tap()
      leave()
      ctx.goToMenu()
    })
    el('btn-rematch').addEventListener('click', () => {
      audio.tap()
      requestRematch()
    })

    const params = new URLSearchParams(location.search)
    const sala = params.get('sala')
    if (sala) {
      audio.unlock()
      openLobby(sala.toUpperCase())
    }
  }

  return { init, openLobby, onShoot, onShooterFlightEnd, keeperResolved, onOutcomeEnd, sendFeint, leave }
}
