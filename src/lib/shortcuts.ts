// Global keyboard shortcuts. Every action in the UI prints its shortcut;
// this is where the printed ones are actually bound.
import { useEffect } from 'react'

export type Combo = { key: string; meta?: boolean; shift?: boolean; alt?: boolean }

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/** Human label for a combo, e.g. "⌘Z" on Mac, "Ctrl+Z" elsewhere. */
export function label(c: Combo): string {
  const parts: string[] = []
  if (c.meta) parts.push(isMac ? '⌘' : 'Ctrl+')
  if (c.alt) parts.push(isMac ? '⌥' : 'Alt+')
  if (c.shift) parts.push(isMac ? '⇧' : 'Shift+')
  parts.push(c.key.length === 1 ? c.key.toUpperCase() : c.key)
  return parts.join('')
}

function matches(e: KeyboardEvent, c: Combo): boolean {
  const meta = isMac ? e.metaKey : e.ctrlKey
  return (
    e.key.toLowerCase() === c.key.toLowerCase() &&
    meta === !!c.meta &&
    e.shiftKey === !!c.shift &&
    e.altKey === !!c.alt
  )
}

function inTextField(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  if (!t) return false
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)
}

export function useShortcuts(bindings: Array<{ combo: Combo; run: () => void; inFields?: boolean }>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      for (const b of bindings) {
        if (!matches(e, b.combo)) continue
        if (inTextField(e) && !b.inFields) continue
        e.preventDefault()
        b.run()
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [bindings])
}
