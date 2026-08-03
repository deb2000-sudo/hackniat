/**
 * Drop theme store — CSS-variable themes driven by `html[data-theme]`.
 *
 * Uses a tiny external store so only components that call `useTheme()`
 * re-render when the theme changes (no app-wide Context cascade).
 */

export const THEME_STORAGE_KEY = 'drop-theme'
export const THEMES = Object.freeze({ LIGHT: 'light', DARK: 'dark' })

const listeners = new Set()

function isTheme(value) {
  return value === THEMES.LIGHT || value === THEMES.DARK
}

/** Resolve initial theme: saved preference → system → dark. */
export function resolveInitialTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (isTheme(saved)) return saved
  } catch {
    /* private mode / blocked storage */
  }
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: light)').matches
      ? THEMES.LIGHT
      : THEMES.DARK
  }
  return THEMES.DARK
}

export function getTheme() {
  if (typeof document === 'undefined') return THEMES.DARK
  const current = document.documentElement.getAttribute('data-theme')
  return isTheme(current) ? current : THEMES.DARK
}

export function applyTheme(theme) {
  const next = isTheme(theme) ? theme : THEMES.DARK
  document.documentElement.setAttribute('data-theme', next)
  document.documentElement.style.colorScheme = next
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next)
  } catch {
    /* ignore */
  }
  listeners.forEach((listener) => listener())
  return next
}

export function toggleTheme() {
  return applyTheme(getTheme() === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK)
}

export function subscribeTheme(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Keep theme in sync if another tab changes localStorage. */
export function bindThemeCrossTab() {
  const onStorage = (event) => {
    if (event.key !== THEME_STORAGE_KEY) return
    if (isTheme(event.newValue)) applyTheme(event.newValue)
  }
  window.addEventListener('storage', onStorage)
  return () => window.removeEventListener('storage', onStorage)
}
