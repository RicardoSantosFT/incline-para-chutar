// Credenciais do Supabase (Settings → API do seu projeto).
// A anon key é pública por design — vai no cliente mesmo.
// Deixe vazio para o modo local (duelo entre duas abas do mesmo aparelho).
const SUPABASE_URL = ''
const SUPABASE_ANON_KEY = ''

// Override sem redeploy: cole no console do navegador
//   localStorage.setItem('iprachute:supabase:url', 'https://xxxx.supabase.co')
//   localStorage.setItem('iprachute:supabase:key', 'eyJ...')
function fromStorage(key) {
  try {
    return localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

export function getSupabaseConfig() {
  const url = fromStorage('iprachute:supabase:url') || SUPABASE_URL
  const key = fromStorage('iprachute:supabase:key') || SUPABASE_ANON_KEY
  return url && key ? { url, key } : null
}
