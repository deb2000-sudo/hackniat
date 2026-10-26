import { useTheme } from '../../theme/useTheme'
import { SERIES } from '../../pages/admin/access/chartPalette'

/** Chart chrome per theme — the same muted ink and hairline as Application Logs. */
const CHROME = {
  dark: { muted: '#8a8a94', grid: '#333333', surface: '#1a1a1a' },
  light: { muted: '#6c757d', grid: '#dee2e6', surface: '#ffffff' },
}

/**
 * Colours and chrome for the current theme. Series take the validated slots in
 * fixed order; two light-theme slots sit under 3:1 contrast, which is why every
 * Analysis chart is paired with a table carrying the same numbers.
 */
export function useChartTheme() {
  const { isDark } = useTheme()
  const theme = isDark ? 'dark' : 'light'
  return { chrome: CHROME[theme], series: SERIES[theme] }
}
