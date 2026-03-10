import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Validation email simple (format raisonnable). */
export function isValidEmail(value: string): boolean {
  if (!value || typeof value !== "string") return false
  const s = value.trim()
  if (s.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}
