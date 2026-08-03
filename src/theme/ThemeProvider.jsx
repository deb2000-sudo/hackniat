import { useEffect } from 'react'
import { applyTheme, bindThemeCrossTab, getTheme, resolveInitialTheme } from './theme'

/**
 * Ensures `data-theme` is applied after mount and stays in sync across tabs.
 * Theme values themselves live on CSS variables — this component does not
 * re-render children when the theme changes.
 */
export default function ThemeProvider({ children }) {
  useEffect(() => {
    // FOUC script usually set this already; re-apply so late navigation /
    // storage edge cases stay consistent.
    applyTheme(getTheme() || resolveInitialTheme())
    return bindThemeCrossTab()
  }, [])

  return children
}
