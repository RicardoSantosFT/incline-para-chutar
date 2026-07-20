// Build single-file: embute CSS, módulos JS (em ordem de dependência) e o
// mascote em data URI. Gera:
//   dist/index.html    — página completa (funciona até via file://)
//   dist/artifact.html — mesmo conteúdo sem <html>/<head>/<body>, para publicar como Artifact
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const ROOT = new URL('.', import.meta.url).pathname

const SPRITE_NAMES = [
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

// Ordem topológica dos módulos (sem ciclos)
const MODULES = [
  'src/game/constants.js',
  'src/game/aim.js',
  'src/game/power.js',
  'src/game/specials.js',
  'src/game/shake.js',
  'src/game/zones.js',
  'src/game/shot.js',
  'src/game/keeper.js',
  'src/game/scoring.js',
  'src/net/config.js',
  'src/net/duel.js',
  'src/net/transport.js',
  'src/net/controller.js',
  'src/input/tilt.js',
  'src/input/actions.js',
  'src/render/scene.js',
  'src/render/sprites.js',
  'src/render/actors.js',
  'src/render/fx.js',
  'src/render/composer.js',
  'src/ui/hud.js',
  'src/ui/chroma.js',
  'src/ui/store.js',
  'src/ui/permission.js',
  'src/audio.js',
  'src/main.js',
]
const STYLES = ['styles/tokens.css', 'styles/base.css', 'styles/game.css']

function stripModuleSyntax(code) {
  return code
    .replace(/^import\s[\s\S]*?from\s*['"][^'"]+['"]\s*\n/gm, '')
    .replace(/^export\s+(?=(const|let|function|class)\b)/gm, '')
}

const css = (await Promise.all(STYLES.map((f) => readFile(ROOT + f, 'utf8')))).join('\n')
const js = (await Promise.all(MODULES.map((f) => readFile(ROOT + f, 'utf8'))))
  .map(stripModuleSyntax)
  .join('\n')

// Mascote reduzido para o bundle não ficar pesado
await mkdir(ROOT + 'dist', { recursive: true })
await exec('sips', ['-Z', '256', ROOT + 'assets/mascot.png', '--out', ROOT + 'dist/mascot-small.png'])
const mascotB64 = (await readFile(ROOT + 'dist/mascot-small.png')).toString('base64')
const mascotUri = `data:image/png;base64,${mascotB64}`

// Sprites da raposa embutidos (256px) — o jogo cai no vetor se faltarem
const spriteData = {}
for (const name of SPRITE_NAMES) {
  const src = ROOT + `assets/sprites/full/${name}.png`
  if (!existsSync(src)) continue
  const out = ROOT + `dist/sprite-${name}.png`
  await exec('sips', ['-Z', '256', src, '--out', out])
  spriteData[name] = `data:image/png;base64,${(await readFile(out)).toString('base64')}`
}
const spritePreamble = `window.__SPRITE_DATA=${JSON.stringify(spriteData)};`

const html = await readFile(ROOT + 'index.html', 'utf8')

// Garante viewport correto mesmo quando o wrapper da página não definir um
const viewportGuard = `(function(){if(!document.querySelector('meta[name="viewport"]')){const m=document.createElement('meta');m.name='viewport';m.content='width=device-width, initial-scale=1, viewport-fit=cover';document.head.appendChild(m)}})();`

const body = html
  .replace(/^[\s\S]*?<body>/, '')
  .replace(/<\/body>[\s\S]*$/, '')
  .replace(/<script type="module"[^<]*<\/script>/, '')
  .replaceAll('src="assets/mascot.png"', `src="${mascotUri}"`)

const inlinePage = `<title>Radar FC — Incline para Chutar</title>
<style>\n${css}\n</style>
${body}
<script>\n${viewportGuard}\n${spritePreamble}\n${js}\n</script>`

const fullPage = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#020c25" />
<title>Radar FC — Incline para Chutar</title>
<style>
${css}
</style>
</head>
<body>
${body}
<script>
${spritePreamble}
${js}
</script>
</body>
</html>`

await writeFile(ROOT + 'dist/index.html', fullPage)
await writeFile(ROOT + 'dist/artifact.html', inlinePage)
console.log('dist/index.html e dist/artifact.html gerados')
console.log('tamanhos (KB):', {
  css: Math.round(css.length / 1024),
  js: Math.round(js.length / 1024),
  mascote: Math.round(mascotUri.length / 1024),
  total: Math.round(fullPage.length / 1024),
})
