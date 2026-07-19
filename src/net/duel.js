// Protocolo puro do duelo online: disputa de pênaltis alternada (5 para cada),
// decisão antecipada, morte súbita com teto e W.O. Os dois clientes aplicam os
// mesmos eventos na mesma ordem e chegam ao mesmo estado (event-sourced).

export const BALLS_PER_SIDE = 5
export const MAX_SUDDEN_PAIRS = 5

const ROLES = ['host', 'guest']
const other = (role) => (role === 'host' ? 'guest' : 'host')

// Código de sala sem caracteres ambíguos (nada de I/O/0/1)
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function makeRoomCode(rng = Math.random) {
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += CODE_ALPHABET[Math.min(CODE_ALPHABET.length - 1, Math.floor(rng() * CODE_ALPHABET.length))]
  }
  return code
}

export function createDuel(myRole) {
  return {
    phase: 'lobby', // lobby | playing | done
    stage: 'regular', // regular | sudden
    myRole,
    firstShooter: null,
    shooter: null,
    ball: 0,
    score: { host: 0, guest: 0 },
    balls: [],
    winner: null,
    byForfeit: false,
  }
}

const takenBy = (balls, side) => balls.filter((b) => b.shooter === side).length

function advance(state) {
  const { score, balls } = state
  const regularTotal = BALLS_PER_SIDE * 2

  if (state.stage === 'regular') {
    // Decisão antecipada: quem não alcança mais, perdeu
    const leftHost = BALLS_PER_SIDE - takenBy(balls, 'host')
    const leftGuest = BALLS_PER_SIDE - takenBy(balls, 'guest')
    if (score.host > score.guest + leftGuest) return { ...state, phase: 'done', winner: 'host' }
    if (score.guest > score.host + leftHost) return { ...state, phase: 'done', winner: 'guest' }
    if (balls.length === regularTotal) {
      if (score.host !== score.guest) {
        return { ...state, phase: 'done', winner: score.host > score.guest ? 'host' : 'guest' }
      }
      return { ...state, stage: 'sudden', shooter: other(state.shooter), ball: state.ball + 1 }
    }
    return { ...state, shooter: other(state.shooter), ball: state.ball + 1 }
  }

  // Morte súbita: cada par completo decide; teto encerra em empate honesto
  const suddenCount = balls.length - regularTotal
  if (suddenCount % 2 === 0) {
    if (score.host !== score.guest) {
      return { ...state, phase: 'done', winner: score.host > score.guest ? 'host' : 'guest' }
    }
    if (suddenCount / 2 >= MAX_SUDDEN_PAIRS) return { ...state, phase: 'done', winner: null }
  }
  return { ...state, shooter: other(state.shooter), ball: state.ball + 1 }
}

export function applyDuelEvent(state, event) {
  if (!event || state.phase === 'done') {
    if (event?.type === 'forfeit' && state.phase !== 'done') {
      return { ...state, phase: 'done', winner: other(event.by), byForfeit: true }
    }
    return state
  }
  switch (event.type) {
    case 'start': {
      if (state.phase !== 'lobby' || !ROLES.includes(event.firstShooter)) return state
      return { ...state, phase: 'playing', firstShooter: event.firstShooter, shooter: event.firstShooter, ball: 1 }
    }
    case 'ball-result': {
      if (state.phase !== 'playing') return state
      if (event.ball !== state.ball || event.shooter !== state.shooter) return state
      if (typeof event.scored !== 'boolean') return state
      const scored = event.scored
      const next = {
        ...state,
        balls: [...state.balls, { shooter: state.shooter, scored }],
        score: scored ? { ...state.score, [state.shooter]: state.score[state.shooter] + 1 } : state.score,
      }
      return advance(next)
    }
    case 'forfeit': {
      if (!ROLES.includes(event.by)) return state
      return { ...state, phase: 'done', winner: other(event.by), byForfeit: true }
    }
    default:
      return state
  }
}

// Validação das mensagens que chegam pela rede (nunca confiar no outro lado)
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
export function validateDuelMsg(msg) {
  if (!msg || typeof msg !== 'object') return null
  switch (msg.type) {
    case 'hello':
      return ROLES.includes(msg.role) ? msg : null
    case 'start':
      return ROLES.includes(msg.firstShooter) ? msg : null
    case 'kick':
      return Number.isInteger(msg.ball) &&
        msg.shot && isNum(msg.shot.x) && isNum(msg.shot.y) &&
        isNum(msg.power) && typeof msg.cavadinha === 'boolean' &&
        (msg.specialId === null || typeof msg.specialId === 'string') &&
        isNum(msg.runupDuration) && isNum(msg.flightDur) &&
        typeof msg.offTarget === 'boolean' && typeof msg.overBar === 'boolean' &&
        typeof msg.pose === 'string'
        ? msg
        : null
    case 'ball-result':
      return Number.isInteger(msg.ball) && ROLES.includes(msg.shooter) && typeof msg.scored === 'boolean' ? msg : null
    case 'feint':
    case 'ping':
    case 'rematch':
      return msg
    case 'forfeit':
      return ROLES.includes(msg.by) ? msg : null
    default:
      return null
  }
}
