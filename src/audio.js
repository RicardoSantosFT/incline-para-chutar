// Efeitos sonoros sintetizados com WebAudio — nenhum arquivo externo.
// O contexto só é criado após o primeiro gesto do usuário (exigência dos navegadores).

export function createAudio() {
  let ctx = null
  let muted = false

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return null
      ctx = new AC()
    }
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  }

  function tone({ freq = 440, to = freq, time = 0.15, type = 'sine', gain = 0.2, delay = 0 }) {
    const ac = ensure()
    if (!ac || muted) return
    const t0 = ac.currentTime + delay
    const osc = ac.createOscillator()
    const g = ac.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, to), t0 + time)
    g.gain.setValueAtTime(gain, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + time)
    osc.connect(g).connect(ac.destination)
    osc.start(t0)
    osc.stop(t0 + time + 0.02)
  }

  function noise({ time = 0.4, gain = 0.18, delay = 0, filterFrom = 400, filterTo = 2200 }) {
    const ac = ensure()
    if (!ac || muted) return
    const t0 = ac.currentTime + delay
    const frames = Math.floor(ac.sampleRate * time)
    const buffer = ac.createBuffer(1, frames, ac.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1
    const src = ac.createBufferSource()
    src.buffer = buffer
    const filter = ac.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(filterFrom, t0)
    filter.frequency.linearRampToValueAtTime(filterTo, t0 + time)
    const g = ac.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.linearRampToValueAtTime(gain, t0 + time * 0.25)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + time)
    src.connect(filter).connect(g).connect(ac.destination)
    src.start(t0)
  }

  return {
    unlock: ensure,
    get muted() {
      return muted
    },
    setMuted(value) {
      muted = value
    },
    kick() {
      tone({ freq: 160, to: 42, time: 0.16, type: 'sine', gain: 0.5 })
      noise({ time: 0.08, gain: 0.1, filterFrom: 900, filterTo: 500 })
    },
    goal() {
      // Torcida explodindo + acorde
      noise({ time: 1.2, gain: 0.3, filterFrom: 500, filterTo: 3200 })
      tone({ freq: 523, time: 0.5, type: 'triangle', gain: 0.16 })
      tone({ freq: 659, time: 0.5, type: 'triangle', gain: 0.14, delay: 0.09 })
      tone({ freq: 784, time: 0.7, type: 'triangle', gain: 0.14, delay: 0.18 })
    },
    save() {
      noise({ time: 0.5, gain: 0.2, filterFrom: 700, filterTo: 1800 })
      tone({ freq: 392, to: 490, time: 0.3, type: 'square', gain: 0.08 })
    },
    miss() {
      tone({ freq: 220, to: 110, time: 0.5, type: 'sawtooth', gain: 0.12 })
      noise({ time: 0.5, gain: 0.1, filterFrom: 300, filterTo: 150 })
    },
    whistle() {
      tone({ freq: 2200, to: 2100, time: 0.14, type: 'square', gain: 0.06 })
      tone({ freq: 2200, to: 2350, time: 0.3, type: 'square', gain: 0.06, delay: 0.18 })
    },
    comboUp(level) {
      const base = 440 + level * 80
      tone({ freq: base, time: 0.09, type: 'triangle', gain: 0.12 })
      tone({ freq: base * 1.35, time: 0.12, type: 'triangle', gain: 0.12, delay: 0.07 })
    },
    tap() {
      tone({ freq: 660, to: 620, time: 0.05, type: 'sine', gain: 0.08 })
    },
  }
}
