// localStorage persistence: debounced writes, and a corrupt entry is ignored
// rather than losing the session. Versioned so a future schema change can
// migrate instead of discard.

export const STORAGE_KEY = 'praxis.plan.v1'

export interface Persisted<T> {
  v: number
  savedAt: string
  data: T
}

export function load<T>(key = STORAGE_KEY, version = 1): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Persisted<T>
    if (!parsed || typeof parsed !== 'object' || parsed.v !== version) return null
    return parsed.data
  } catch {
    return null
  }
}

export function save<T>(data: T, key = STORAGE_KEY, version = 1): boolean {
  try {
    const entry: Persisted<T> = { v: version, savedAt: new Date().toISOString(), data }
    localStorage.setItem(key, JSON.stringify(entry))
    return true
  } catch {
    return false
  }
}

export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined
  const wrapped = (...a: A) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...a), ms)
  }
  wrapped.flush = (...a: A) => {
    if (t) clearTimeout(t)
    fn(...a)
  }
  return wrapped
}
