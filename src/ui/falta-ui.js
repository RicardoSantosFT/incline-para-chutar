// UI da cobrança de falta: tela de escolha de papel, faixa de condições na
// cena (local, barreira e clima) e o overlay onde o goleiro monta a barreira.
import { WALL_MIN, WALL_MAX, faltaSpotBonus, sortearFalta, sortearClima, aiWallCount } from '../game/freekick.js'

// Sorteia local + clima da rodada, arma a câmera e anuncia as condições.
// No modo goleiro a barreira fica pendente (o jogador monta no overlay).
export function beginFaltaRound({ game, hud, resize }) {
  const spot = sortearFalta({ rngDist: Math.random(), rngLat: Math.random(), rngSide: Math.random() })
  const clima = sortearClima({ rngKind: Math.random(), rngStrength: Math.random(), rngSide: Math.random() })
  const wallCount = game.mode === 'striker' ? aiWallCount({ spot, rng: Math.random() }) : null
  game.falta = { spot, clima, wallCount, view: faltaCameraView(spot) }
  resize()
  updateFaltaBanner(game.falta)
  if (clima.id !== 'limpo') hud.flash(`${clima.emoji} ${clima.nome}!`, 'save')
}

// Câmera do sorteio: mais longe = gol menor; falta lateral desloca o gol
export function faltaCameraView(spot) {
  const scale = Math.max(0.72, Math.min(0.95, 1 - (spot.dist - 11) * 0.014))
  const shiftX = Math.max(-0.14, Math.min(0.14, -spot.lat * 0.011))
  return { scale, shiftX }
}

export function faltaSpotLabel(spot) {
  const lado = Math.abs(spot.lat) < 2 ? 'frontal' : spot.lat > 0 ? 'pela direita' : 'pela esquerda'
  return `${Math.round(spot.dist)}m ${lado}`
}

export function updateFaltaBanner(falta) {
  const banner = document.getElementById('falta-banner')
  if (!falta) {
    banner.hidden = true
    return
  }
  const wall = falta.wallCount ? `🧱 ${falta.wallCount} na barreira` : '🧱 barreira…'
  banner.innerHTML = `<b>📍 ${faltaSpotLabel(falta.spot)}</b> · ${wall} · <b>${falta.clima.emoji} ${falta.clima.nome}</b>`
  banner.hidden = false
}

export function showWallPicker(falta, onChoose) {
  const overlay = document.getElementById('overlay-wall')
  document.getElementById('wall-spot-info').innerHTML =
    `Falta <b>${faltaSpotLabel(falta.spot)}</b> · ${falta.clima.emoji} ${falta.clima.nome} — <i>${falta.clima.aviso}</i>` +
    `<br /><small>Perigo do local: ${100 - faltaSpotBonus(falta.spot)}%. Barreira grande bloqueia mais, mas a sua defesa vale menos pontos.</small>`
  const row = document.getElementById('wall-buttons')
  if (!row.childElementCount) {
    for (let n = WALL_MIN; n <= WALL_MAX; n++) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'wall-btn'
      btn.textContent = String(n)
      btn.setAttribute('aria-label', `${n} ${n === 1 ? 'jogador' : 'jogadores'} na barreira`)
      btn.addEventListener('click', () => {
        overlay.hidden = true
        row.dataset.chosen = String(n)
        onChooseRef?.(n)
      })
      row.appendChild(btn)
    }
  }
  onChooseRef = onChoose
  overlay.hidden = false
}
let onChooseRef = null

export function hideWallPicker() {
  const overlay = document.getElementById('overlay-wall')
  if (overlay) overlay.hidden = true
  onChooseRef = null
}

// Liga a navegação da tela de falta; devolve nada — main injeta os callbacks
export function initFaltaScreen({ hud, audio, onStart }) {
  document.getElementById('btn-mode-falta').addEventListener('click', () => {
    audio.unlock()
    audio.tap()
    hud.showScreen('falta')
  })
  document.getElementById('btn-falta-back').addEventListener('click', () => {
    audio.tap()
    hud.showScreen('menu')
  })
  document.getElementById('btn-falta-striker').addEventListener('click', () => onStart('striker'))
  document.getElementById('btn-falta-keeper').addEventListener('click', () => onStart('keeper'))
}
