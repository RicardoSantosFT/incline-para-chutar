// Vídeo do mascote com remoção de fundo (chroma key) em tempo real no canvas.
// Funciona em qualquer navegador (iOS incluso) sem codec com alpha: a cor de
// fundo é autocalibrada pelos cantos do primeiro quadro. Se o vídeo falhar,
// a imagem estática continua no lugar.

const PROCESS_MAX_PX = 360
const KEY_TOLERANCE = 72
const KEY_SOFTNESS = 64

export function initMascotVideo({ src = 'assets/video/raposa-comemora.mp4' } = {}) {
  const canvas = document.getElementById('mascot-video')
  const fallbackImg = document.getElementById('mascot-img')
  const menuScreen = document.getElementById('screen-menu')
  if (!canvas || !menuScreen) return

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const video = document.createElement('video')
  video.muted = true
  video.loop = true
  video.autoplay = true
  video.playsInline = true
  video.setAttribute('playsinline', '')
  video.preload = 'auto'
  video.src = src

  let key = null
  let ready = false
  let rafId = 0

  function sampleKeyColor() {
    const { width, height } = canvas
    const data = ctx.getImageData(0, 0, width, height).data
    const corners = [
      [2, 2],
      [width - 3, 2],
      [2, height - 3],
      [width - 3, height - 3],
    ]
    let r = 0
    let g = 0
    let b = 0
    for (const [x, y] of corners) {
      const i = (y * width + x) * 4
      r += data[i]
      g += data[i + 1]
      b += data[i + 2]
    }
    key = { r: r / corners.length, g: g / corners.length, b: b / corners.length }
  }

  function processFrame() {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    if (!key) sampleKeyColor()
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = frame.data
    for (let i = 0; i < data.length; i += 4) {
      const dr = data[i] - key.r
      const dg = data[i + 1] - key.g
      const db = data[i + 2] - key.b
      const dist = Math.sqrt(dr * dr + dg * dg + db * db)
      if (dist < KEY_TOLERANCE) {
        data[i + 3] = 0
      } else if (dist < KEY_TOLERANCE + KEY_SOFTNESS) {
        data[i + 3] = Math.min(data[i + 3], (((dist - KEY_TOLERANCE) / KEY_SOFTNESS) * 255) | 0)
      }
    }
    ctx.putImageData(frame, 0, 0)
  }

  function loop() {
    rafId = requestAnimationFrame(loop)
    const active = menuScreen.classList.contains('is-active') && !document.hidden
    if (!active) {
      if (!video.paused) video.pause()
      return
    }
    if (video.paused) video.play().catch(() => {})
    if (video.readyState >= 2) processFrame()
  }

  video.addEventListener('loadeddata', () => {
    if (ready) return
    ready = true
    const scale = Math.min(1, PROCESS_MAX_PX / Math.max(video.videoWidth || 1, video.videoHeight || 1))
    canvas.width = Math.max(1, Math.round((video.videoWidth || PROCESS_MAX_PX) * scale))
    canvas.height = Math.max(1, Math.round((video.videoHeight || PROCESS_MAX_PX) * scale))
    canvas.hidden = false
    if (fallbackImg) fallbackImg.hidden = true
    cancelAnimationFrame(rafId)
    loop()
  })

  // Vídeo indisponível (ex.: bundle single-file): fica a imagem estática
  video.addEventListener('error', () => {
    canvas.hidden = true
    if (fallbackImg) fallbackImg.hidden = false
  })

  // iOS pode segurar o autoplay até o primeiro gesto
  const unlock = () => {
    if (ready && video.paused) video.play().catch(() => {})
    window.removeEventListener('pointerdown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
}
