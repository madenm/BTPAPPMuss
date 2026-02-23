import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://hvnjlxxcxfxvuwlmnwtw.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2bmpseHhjeGZ4dnV3bG1ud3R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NzA3ODIsImV4cCI6MjA3OTU0Njc4Mn0.SmL4eqGq8XLfbLOolxGdafLhS6eeTgYGGn1w9gcrWdU'

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
    msg.includes("404") ||
    msg.includes("does not exist") ||
    msg.includes("relation") ||
    msg.includes("not found")
  )
}
