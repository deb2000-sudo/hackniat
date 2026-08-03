import { useCallback, useSyncExternalStore } from 'react'
import {
  applyTheme,
  getTheme,
  subscribeTheme,
  THEMES,
  toggleTheme as toggleThemeStore,
} from './theme'

const getServerSnapshot = () => THEMES.DARK

/** Subscribe to the Drop theme without wrapping the whole tree in Context. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getServerSnapshot)

  const setTheme = useCallback((next) => applyTheme(next), [])
  const toggleTheme = useCallback(() => toggleThemeStore(), [])

  return {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === THEMES.DARK,
    isLight: theme === THEMES.LIGHT,
  }
}

export default useTheme
