// Persistência local (recordes e preferências) com tolerância a modo privado.
export const STORAGE = {
  striker: 'iprachute:best:striker',
  keeper: 'iprachute:best:keeper',
  muted: 'iprachute:muted',
}

export const store = {
  get(key, fallback = 0) {
    try {
      const value = localStorage.getItem(key)
      return value === null ? fallback : Number(value) || 0
    } catch {
      return fallback
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, String(value))
    } catch {
      /* modo privado: sem persistência */
    }
  },
}
