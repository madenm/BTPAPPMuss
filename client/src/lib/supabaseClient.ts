import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

// En local, pas de fallback : utiliser .env.local avec les clés du projet (ex. Staging).
// Sans clés, les appels Supabase échouent et la page Planning peut bugger.
if (import.meta.env.DEV) {
  const urlPlaceholder = 'https://your-project-ref.supabase.co'
  const keyPlaceholder = 'your_anon_or_publishable_key'
  const urlMissing = !SUPABASE_URL || SUPABASE_URL === urlPlaceholder
  const keyMissing = !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === keyPlaceholder
  if (urlMissing || keyMissing) {
    console.warn(
      '[Supabase] Clés manquantes ou placeholder en local. Copie .env.example en .env.local et remplis :\n' +
      '  VITE_SUPABASE_URL=https://iaadzfvqmjqhalfybxok.supabase.co  (ou ton projet)\n' +
      '  VITE_SUPABASE_ANON_KEY=<ta clé anon/publishable>\n' +
      'Voir Supabase > projet > Settings > API.'
    )
  }
}

let useSessionStorage = false

export function setRememberMe(remember: boolean) {
  useSessionStorage = !remember
}

const authStorageAdapter = {
  getItem(key: string): string | null {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key)
  },
  setItem(key: string, value: string): void {
    ;(useSessionStorage ? sessionStorage : localStorage).setItem(key, value)
  },
  removeItem(key: string): void {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  },
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: authStorageAdapter,
  },
})

/** True if the error indicates the table/schema is missing (404 or relation does not exist). */
export function isSupabaseTableMissing(error: { code?: string; message?: string; status?: number } | null): boolean {
  if (!error) return false
  const msg = (error.message ?? "").toLowerCase()
  const code = String((error as any).code ?? "")
  const status = (error as any).status
  return (
    status === 404 ||
    code === "42P01" ||
    code === "PGRST116" ||
    code === "PGRST205" ||
    msg.includes("404") ||
    msg.includes("does not exist") ||
    msg.includes("relation") ||
    msg.includes("not found") ||
    msg.includes("schema cache")
  )
}
