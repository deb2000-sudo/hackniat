import Icon from '../ui/Icon'
import { useTheme } from '../../theme/useTheme'

/**
 * Compact light/dark control. Uses design tokens so it looks correct in both themes.
 */
export default function ThemeToggle({ className = '', compact = false }) {
  const { theme, toggleTheme, isDark } = useTheme()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-drop border border-hairline bg-raised text-ink transition-colors hover:border-volt-edge hover:text-volt-ink',
        compact ? 'size-10' : 'min-h-10 px-3 text-[13px] font-medium',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Light theme' : 'Dark theme'}
    >
      <Icon name={isDark ? 'sun' : 'moon'} size={17} />
      {!compact && <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>}
    </button>
  )
}
