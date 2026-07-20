// Clima na tela: chuva riscando, neve dançando ou rajadas de vento.
// Determinístico por tempo (nenhum Math.random no render) e barato: contagem
// fixa de partículas, tudo em transform/alpha.
const wxFract = (v) => v - Math.floor(v)
const wxRand = (i) => wxFract(Math.sin(i * 113.9 + 271.1) * 43141.59)

const RAIN_DROPS = 70
const SNOW_FLAKES = 46
const GUST_LINES = 14

export function drawWeather(ctx, g, clima, time, reduced = false) {
  if (!clima || clima.id === 'limpo') return
  const { w, h } = g
  if (reduced) {
    // Sem animação: só um véu que comunica o clima
    ctx.fillStyle = clima.id === 'neve' ? 'rgba(220, 232, 255, 0.08)' : 'rgba(120, 160, 220, 0.07)'
    ctx.fillRect(0, 0, w, h)
    return
  }

  if (clima.id === 'chuva') {
    const slant = 0.18 + (clima.windX ?? 0) * 0.03
    ctx.strokeStyle = 'rgba(170, 205, 255, 0.34)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 0; i < RAIN_DROPS; i++) {
      const speed = 460 + wxRand(i) * 260
      const len = 9 + wxRand(i + 31) * 10
      const x = wxFract(wxRand(i) + time * slant * 0.5) * (w + 60) - 30
      const y = wxFract(wxRand(i + 7) + (time * speed) / h) * (h + 40) - 20
      ctx.moveTo(x, y)
      ctx.lineTo(x - len * slant, y - len)
    }
    ctx.stroke()
    return
  }

  if (clima.id === 'neve') {
    ctx.fillStyle = 'rgba(235, 243, 255, 0.75)'
    for (let i = 0; i < SNOW_FLAKES; i++) {
      const speed = 34 + wxRand(i) * 40
      const r = 1 + wxRand(i + 13) * 1.9
      const sway = Math.sin(time * (0.7 + wxRand(i + 3)) + i) * 14
      const x = wxFract(wxRand(i) + time * 0.012) * (w + 24) - 12 + sway
      const y = wxFract(wxRand(i + 7) + (time * speed) / h) * (h + 16) - 8
      ctx.globalAlpha = 0.4 + wxRand(i + 23) * 0.5
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    return
  }

  // Ventos: rajadas translúcidas correndo na direção do vento
  const dirX = Math.sign(clima.windX || 0)
  const alongZ = dirX === 0 // favor/contra: linhas "fugindo" na vertical da cena
  ctx.strokeStyle = 'rgba(200, 225, 255, 0.2)'
  ctx.lineWidth = 1.4
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (let i = 0; i < GUST_LINES; i++) {
    const speed = 260 + wxRand(i) * 200
    const len = 26 + wxRand(i + 11) * 40
    if (alongZ) {
      const up = (clima.windZ ?? 0) > 0 ? -1 : 1 // a favor sobe a tela (vai com a bola)
      const x = wxRand(i) * w
      const y = wxFract(wxRand(i + 7) + (time * speed * up) / h) * (h + 60) - 30
      const wobble = Math.sin(time * 2 + i) * 6
      ctx.moveTo(x + wobble, y)
      ctx.quadraticCurveTo(x + wobble + 8, y + (len / 2) * up, x + wobble, y + len * up)
    } else {
      const x = wxFract(wxRand(i) + (time * speed * dirX) / w) * (w + 80) - 40
      const y = wxRand(i + 7) * h
      const wobble = Math.sin(time * 2 + i) * 5
      ctx.moveTo(x, y + wobble)
      ctx.quadraticCurveTo(x + (len / 2) * dirX, y + wobble - 4, x + len * dirX, y + wobble)
    }
  }
  ctx.stroke()
  ctx.lineCap = 'butt'
}
