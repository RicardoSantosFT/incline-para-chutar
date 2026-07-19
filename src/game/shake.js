// Detector de chacoalhada: picos de aceleração próximos disparam o evento.
// Depois de disparar, só rearma quando o aparelho fica quieto por cooldownMs —
// assim uma sacudida contínua vale um evento só. minGapMs impede que amostras
// consecutivas de 60Hz do mesmo tranco contem como picos distintos.
export function createShakeDetector({ threshold = 12, minSpikes = 3, windowMs = 900, cooldownMs = 1000, minGapMs = 80 } = {}) {
  let spikes = []
  let armed = true
  let lastSpikeT = -Infinity

  return {
    sample(tMs, magnitude) {
      const isSpike = magnitude >= threshold
      if (!armed && tMs - lastSpikeT > cooldownMs) armed = true
      if (!armed) {
        if (isSpike) lastSpikeT = tMs
        return false
      }
      if (!isSpike) return false
      lastSpikeT = tMs
      const lastCounted = spikes[spikes.length - 1]
      if (lastCounted !== undefined && tMs - lastCounted < minGapMs) return false
      spikes = spikes.filter((s) => tMs - s <= windowMs)
      spikes.push(tMs)
      if (spikes.length >= minSpikes) {
        armed = false
        spikes = []
        return true
      }
      return false
    },
  }
}
