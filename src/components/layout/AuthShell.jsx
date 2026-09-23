import { Link } from 'react-router-dom'
import { hackathonsApi } from '../../api/hackathons'
import { useAsync } from '../../hooks/useAsync'
import { queryKeys } from '../../lib/queryKeys'
import { IconPassed } from '../drop/icons'
import ThemeToggle from '../drop/ThemeToggle'
import { isAccepting } from '../drop/useHackathonCatalog'
import { useDropSurface } from '../drop/useDropSurface'
import { MONO, PILL_VOLT } from '../drop/theme'

const HIGHLIGHTS = [
  'Browse live hackathons and filter by what fits',
  'Run the readiness check before the deadline, as often as you want',
  'Written feedback on every submission. No exceptions.',
]

/** Two-column authentication layout on the Drop surface. */
export default function AuthShell({ children, wide = false }) {
  useDropSurface()

  // Same catalog entry the landing page fills, so arriving from there costs no
  // request — and no poll here, because a login screen is not a live board.
  // A number on this panel is a claim, so it is only made once the real count
  // is in and it is not zero.
  const { data: catalog } = useAsync(
    (options) => hackathonsApi.catalog({ includeClosed: true, ...options }),
    { key: queryKeys.hackathonCatalog(true), staleTime: 60_000 },
  )
  const liveCount = (Array.isArray(catalog) ? catalog : []).filter(isAccepting).length

  return (
    <div className="drop grid min-h-screen lg:grid-cols-2">
      {/* Promo aside — hidden on small screens so the form leads on a phone. */}
      <aside className="hidden flex-col justify-between border-r border-hairline bg-surface p-14 lg:flex">
        <Link to="/" className="text-[19px] font-semibold tracking-[-0.03em] text-ink">
          Drop
        </Link>

        <div>
          {liveCount > 0 && (
            <p className={PILL_VOLT}>
              <span className="size-1.5 shrink-0 rounded-full bg-volt" aria-hidden="true" />
              <span>
                <span className={MONO}>{liveCount}</span> hackathon{liveCount === 1 ? '' : 's'} live
                right now
              </span>
            </p>
          )}

          {/* Without the pill the heading leads the panel, so it drops the gap
              that only existed to sit under it. */}
          <h2
            className={`${
              liveCount > 0 ? 'mt-7 ' : ''
            }max-w-[16ch] text-[40px] leading-[1.05] font-semibold tracking-[-0.03em] text-ink`}
          >
            Build. Ship. Drop.
          </h2>
          <p className="mt-4 max-w-[44ch] text-[17px] text-muted">
            Most hackathons hand back a number. Drop tells you what&rsquo;s wrong before the
            deadline, and why afterwards.
          </p>

          <ul className="mt-9 flex flex-col gap-4">
            {HIGHLIGHTS.map((text) => (
              <li key={text} className="flex items-start gap-3 text-[15px] text-muted">
                {/* Muted, not green: state colours are reserved for the
                    readiness check and status badges, never decoration. */}
                <IconPassed width={18} height={18} className="mt-0.5 shrink-0 text-muted" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-muted">© {new Date().getFullYear()} Drop</p>
      </aside>

      <div className="relative flex items-center justify-center px-6 py-12">
        <div className="absolute top-5 right-5">
          <ThemeToggle compact />
        </div>
        <div className={`drop-auth-card w-full ${wide ? 'max-w-[560px]' : 'max-w-[440px]'}`}>
          {/* Wordmark for the single-column view, where the aside is hidden. */}
          <Link
            to="/"
            className="mb-8 inline-block text-[19px] font-semibold tracking-[-0.03em] text-ink lg:hidden"
          >
            Drop
          </Link>
          {children}
        </div>
      </div>
    </div>
  )
}
