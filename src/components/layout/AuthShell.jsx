import { Link } from 'react-router-dom'
import { hackathonsApi } from '../../api/hackathons'
import { useAsync } from '../../hooks/useAsync'
import { queryKeys } from '../../lib/queryKeys'
import { useTheme } from '../../theme/useTheme'
import { BrandLockup } from '../brand/BrandMark'
import { isAccepting } from '../drop/useHackathonCatalog'
import { useDropSurface } from '../drop/useDropSurface'
import './auth-shell.css'

const HIGHLIGHTS = [
  'Browse live hackathons and filter by what fits',
  'Run the readiness check before the deadline, as often as you want',
  'Written feedback on every submission. No exceptions.',
]

function ThemeButton() {
  const { isDark, toggleTheme } = useTheme()
  return (
    <button
      type="button"
      className="cza-toggle"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  )
}

/**
 * Two-column authentication layout: brand column left, form column right.
 *
 * Keeps the `drop` class so the shared UI inputs on the register and reset
 * forms still pick up their themed styles inside it.
 */
export default function AuthShell({ children, wide = false }) {
  useDropSurface()

  // Same catalog entry the landing page fills, so arriving from there costs no
  // request — and no poll here, because a login screen is not a live board.
  // A number on this panel is a claim, so it only shows once the real count
  // is in and it is not zero.
  const { data: catalog } = useAsync(
    (options) => hackathonsApi.catalog({ includeClosed: true, ...options }),
    { key: queryKeys.hackathonCatalog(true), staleTime: 60_000 },
  )
  const liveCount = (Array.isArray(catalog) ? catalog : []).filter(isAccepting).length

  return (
    <div className="drop cza">
      <aside className="cza-brandside">
        <Link className="cza-lockup cza-up" to="/" aria-label="Challazo home">
          <BrandLockup variant="arrow" size={30} fontSize={21} />
        </Link>

        <div className="cza-bmid">
          {liveCount > 0 && (
            <p className="cza-pill cza-up" style={{ animationDelay: '.08s' }}>
              <span className="cza-pdot" aria-hidden="true" />
              {liveCount} hackathon{liveCount === 1 ? '' : 's'} live right now
            </p>
          )}
          {/* Not a heading: each auth page owns its own h1. */}
          <p className="cza-display cza-up" style={{ animationDelay: '.16s' }}>
            Build. Ship. Drop.
          </p>
          <p className="cza-bsub cza-up" style={{ animationDelay: '.24s' }}>
            Most hackathons hand back a number. Challazo tells you what&rsquo;s wrong before the
            deadline, and why afterwards.
          </p>

          <ul className="cza-points">
            {HIGHLIGHTS.map((text, index) => (
              <li key={text} className="cza-up" style={{ animationDelay: `${0.34 + index * 0.08}s` }}>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M7.5 12.5 L10.6 15.5 L16.5 9" style={{ animationDelay: `${0.6 + index * 0.16}s` }} />
                </svg>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="cza-bfoot cza-up" style={{ animationDelay: '.58s' }}>
          © {new Date().getFullYear()} Challazo
        </p>
      </aside>

      <main className="cza-formside">
        <ThemeButton />
        <div className={`cza-formwrap${wide ? ' is-wide' : ''}`}>{children}</div>
      </main>
    </div>
  )
}
