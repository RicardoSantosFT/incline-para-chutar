// UI de sessão fora do loop: dicas por modo de entrada, recordes do menu,
// botão de som e a tela de resultado. Extraído do main.js.
import { TOTAL_ROUNDS } from '../game/constants.js'
import { finishSession } from '../game/scoring.js'
import { COACH_TIPS } from './hud.js'
import { store, STORAGE } from './store.js'

const AIM_HINTS = {
  tilt: 'Incline para mirar · <b>segure e solte</b> · chacoalhe = especial',
  touch: 'Arraste para mirar · <b>segure e solte</b> · 2 toques = especial',
  teclado: '<b>← → ↑ ↓</b> miram · <b>espaço</b> chuta · <b>X</b> = especial',
}
const FALTA_AIM_HINTS = {
  tilt: 'Menos força passa por cima da barreira · canto com força contorna',
  touch: 'Arraste a mira · pouca força = por cima · canto forte = contorna',
  teclado: '<b>← → ↑ ↓</b> miram · <b>espaço</b> dosa a força do chute',
}
const KEEPER_HINTS = {
  tilt: '<b>Segure a tela</b> para carregar · incline a mira · <b>solte</b> = voo',
  touch: 'Arraste a mira · <b>segure Defender</b> para carregar · soltar = voo',
  teclado: '<b>← → ↑ ↓</b> miram · <b>espaço</b> carrega, soltar = voo · <b>X</b> = finta',
}

export function aimHintFor(inputMode, kind = 'penalty') {
  const table = kind === 'falta' ? FALTA_AIM_HINTS : AIM_HINTS
  return table[inputMode] ?? table.touch
}

export function keeperHintFor(inputMode) {
  return KEEPER_HINTS[inputMode] ?? KEEPER_HINTS.touch
}

export function bestStorageKey(mode, kind) {
  if (kind === 'falta') return mode === 'striker' ? STORAGE.faltaStriker : STORAGE.faltaKeeper
  return mode === 'striker' ? STORAGE.striker : STORAGE.keeper
}

export function updateMuteButton(audio) {
  const btn = document.getElementById('btn-mute')
  btn.classList.toggle('is-muted', audio.muted)
  btn.setAttribute('aria-pressed', String(audio.muted))
}

export function refreshMenuBests(hud) {
  hud.nodes.bestStriker.textContent = String(store.get(STORAGE.striker))
  hud.nodes.bestKeeper.textContent = String(store.get(STORAGE.keeper))
  const fs = document.getElementById('best-falta-striker')
  const fk = document.getElementById('best-falta-keeper')
  if (fs) fs.textContent = String(store.get(STORAGE.faltaStriker))
  if (fk) fk.textContent = String(store.get(STORAGE.faltaKeeper))
}

// Preenche e mostra a tela de resultado; devolve o placar consolidado
export function showSessionResult({ game, hud, audio }) {
  const finished = finishSession(game.state)
  const key = bestStorageKey(game.mode, game.kind)
  const isRecord = finished.score > 0 && finished.score > game.state.best
  store.set(key, finished.best)

  const striker = game.mode === 'striker'
  const falta = game.kind === 'falta'
  hud.nodes.resultEyebrow.textContent = falta
    ? striker
      ? 'Cobrança de falta'
      : 'Falta: fechou o gol'
    : striker
      ? 'Fim do treino'
      : 'Modo goleiro'
  const great = game.state.hits >= 6
  hud.nodes.resultTitle.textContent = striker
    ? great
      ? falta
        ? 'Especialista em faltas!'
        : 'Artilheiro nato!'
      : 'Treino completo!'
    : great
      ? 'Paredão!'
      : 'Fim do desafio!'
  hud.nodes.resultTitle.classList.toggle('is-loss', !great)
  hud.nodes.resultSub.textContent = striker
    ? `Você marcou ${game.state.hits} ${game.state.hits === 1 ? 'gol' : 'gols'} em ${TOTAL_ROUNDS} bolas.`
    : `Você levou a melhor em ${game.state.hits} de ${TOTAL_ROUNDS} cobranças.`
  hud.nodes.resScore.textContent = String(finished.score)
  hud.nodes.resHits.textContent = String(game.state.hits)
  hud.nodes.resHitsLabel.textContent = striker ? 'Gols' : 'Defesas'
  hud.nodes.resCombo.textContent = `x${game.state.maxCombo}`
  hud.nodes.newRecord.hidden = !isRecord
  hud.nodes.coachTip.textContent = COACH_TIPS[Math.floor(Math.random() * COACH_TIPS.length)]
  if (great) audio.whistle()
  hud.showScreen('result')
}
