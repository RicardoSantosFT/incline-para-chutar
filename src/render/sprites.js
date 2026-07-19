// Carregador de sprites da raposa. Os sprites são opcionais: enquanto não
// carregam (ou se faltarem), os atores caem no desenho vetorial.
// No bundle single-file, window.__SPRITE_DATA traz os PNGs como data URI.

const NAMES = [
  'batedor-parado',
  'batedor-corrida-1',
  'batedor-corrida-2',
  'batedor-chute',
  'batedor-chaleira',
  'batedor-calcanhar',
  'batedor-comemora',
  'goleiro-parado',
  'goleiro-agachado',
  'goleiro-mergulho',
  'goleiro-caido',
  'goleiro-provocando',
]

const sprites = new Map() // name -> { img, bbox }

export function initSprites(basePath = 'assets/sprites/') {
  const embedded = typeof window !== 'undefined' ? (window.__SPRITE_DATA ?? {}) : {}
  for (const name of NAMES) {
    const img = new Image()
    img.onload = () => sprites.set(name, { img, bbox: computeBbox(img) })
    img.onerror = () => {} // segue no fallback vetorial
    img.src = embedded[name] ?? `${basePath}${name}.png`
  }
}

// Bounding box do conteúdo (ignora a borda transparente), calculada uma vez
// numa amostra reduzida — o desenho fica com escala e âncora consistentes
// mesmo que cada imagem tenha margens diferentes.
function computeBbox(img) {
  const SCAN = 96
  const scale = SCAN / Math.max(img.width, img.height)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * scale))
  canvas.height = Math.max(1, Math.round(img.height * scale))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  let minX = canvas.width
  let minY = canvas.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4 + 3] > 24) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w: img.width, h: img.height }
  const inv = 1 / scale
  return { x: minX * inv, y: minY * inv, w: (maxX - minX + 1) * inv, h: (maxY - minY + 1) * inv }
}

export function hasSprite(name) {
  return sprites.has(name)
}

// Desenha ancorado nos pés (anchor 'bottom') ou no centro; height é a altura
// visível do personagem (a bbox), não a do arquivo.
export function drawSprite(ctx, name, { x, y, height, flip = false, alpha = 1, anchor = 'bottom' }) {
  const sprite = sprites.get(name)
  if (!sprite) return false
  const { img, bbox } = sprite
  const scale = height / bbox.h
  const width = bbox.w * scale
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  if (flip) ctx.scale(-1, 1)
  const dy = anchor === 'bottom' ? -height : -height / 2
  ctx.drawImage(img, bbox.x, bbox.y, bbox.w, bbox.h, -width / 2, dy, width, height)
  ctx.restore()
  return true
}
