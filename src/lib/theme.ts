'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { THEME_STORAGE_KEY } from './theme-key'

/**
 * The app's colour theme: `data-theme` on <html>, remembered per browser.
 * The root layout applies the saved value before the first paint; this module
 * is the one place that changes it afterwards.
 */

export type Theme = 'dark' | 'light'

const listeners = new Set<() => void>()

function read(): Theme {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Private mode or blocked storage: the theme still applies for this visit.
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useTheme(): [Theme, (theme: Theme) => void, () => void] {
  const theme = useSyncExternalStore(subscribe, read, () => 'dark' as Theme)
  const toggle = useCallback(() => setTheme(read() === 'dark' ? 'light' : 'dark'), [])
  return [theme, setTheme, toggle]
}

/** A colour role's current value (for canvas drawing, which can't read CSS variables). */
export function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}
