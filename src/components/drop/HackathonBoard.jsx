import { useState } from 'react'
import { Link } from 'react-router-dom'
import { IconArrow } from './icons'
import { formatDate } from '../../utils/format'
import { isAccepting } from './useHackathonCatalog'
import {
  BADGE,
  BADGE_CLOSED,
  BADGE_CLOSING,
  BADGE_NEUTRAL,
  BADGE_OPEN,
  BADGE_UPCOMING,
  BTN_GHOST,
  MONO,
  PANEL,
  WRAP,
} from './theme'

/** The board is a teaser; the rest live behind "see all". */
const PREVIEW_LIMIT = 6

/** Themes past this are collapsed into a "+n" pill so cards stay one height. */
const THEME_LIMIT = 2

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'closing_soon', label: 'Closing soon' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'closed', label: 'Closed' },
  { id: 'solo', label: 'Solo' },
  { id: 'team', label: 'Team' },
]

/** Server-computed status → badge tone. Unknown statuses stay neutral. */
const TONES = {
  open: BADGE_OPEN,
  closing_soon: BADGE_CLOSING,
  upcoming: BADGE_UPCOMING,
  closed: BADGE_CLOSED,
}

const matches = (filter, hackathon) => {
  switch (filter) {
    // "Open" is the practical question — can I still enter — so it covers the
    // last-three-days window too.
    case 'open':
      return isAccepting(hackathon)
    case 'closing_soon':
    case 'upcoming':
    case 'closed':
      return hackathon.status === filter
    case 'solo':
      return hackathon.team_mode === 'solo' || hackathon.max_team_size === 1
    case 'team':
      return hackathon.team_mode === 'team' || hackathon.max_team_size > 1
    default:
      return true
  }
}

const META_LABEL = 'text-[11.5px] tracking-[0.06em] text-muted uppercase'

const CARD_SHELL = `${PANEL} group flex flex-col overflow-hidden transition-[transform,border-color,background-color] duration-150`

function HackathonCard({ hackathon }) {
  // Banners are time-limited signed GCS URLs. The poll refreshes them long
  // before they expire, but a stale one must not leave a broken-image icon.
  const [bannerBroken, setBannerBroken] = useState(false)

  const themes = hackathon.themes || []
  const extraThemes = Math.max(0, themes.length - THEME_LIMIT)
  const teamSize = hackathon.featured_round?.team_mode_label || hackathon.team_mode_label
  const endsIn = hackathon.days_until_end
  const showEndsIn = hackathon.status === 'closing_soon' && endsIn != null

  return (
    <Link
      to={`/hackathons/${hackathon.id}`}
      className={`${CARD_SHELL} hover:-translate-y-[3px] hover:border-volt-edge hover:bg-raised`}
    >
      <div className="relative h-[168px] shrink-0 overflow-hidden bg-raised">
        {hackathon.banner_url && !bannerBroken ? (
          <img
            src={hackathon.banner_url}
            alt=""
            loading="lazy"
            onError={() => setBannerBroken(true)}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid size-full place-items-center bg-linear-to-br from-surface to-raised">
            <span className="font-mono text-[22px] tracking-[0.12em] text-muted uppercase">
              {hackathon.name?.slice(0, 2) || '—'}
            </span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-canvas/70 via-transparent to-transparent" />

        <div className="absolute top-3.5 left-3.5 flex flex-wrap gap-2">
          <span className={`${BADGE} ${TONES[hackathon.status] || BADGE_NEUTRAL}`}>
            {hackathon.status_label}
          </span>
          {hackathon.team_mode_label && (
            <span className={`${BADGE} ${BADGE_NEUTRAL}`}>{hackathon.team_mode_label}</span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-[22px]">
        <h3 className="text-[18px] font-semibold tracking-[-0.015em] text-ink">{hackathon.name}</h3>
        {hackathon.featured_round?.title && (
          <p className="mt-[5px] truncate text-[13.5px] text-muted">
            {hackathon.featured_round.title}
          </p>
        )}

        <div className="my-5 border-y border-hairline py-3.5">
          <p className="font-mono text-[15px] tracking-[-0.01em] text-ink tabular-nums">
            <time dateTime={hackathon.start_date}>{formatDate(hackathon.start_date)}</time>
            <span className="mx-2 text-muted" aria-hidden="true">
              –
            </span>
            <time dateTime={hackathon.end_date}>{formatDate(hackathon.end_date)}</time>
          </p>
          {showEndsIn && (
            <p className="mt-2 text-[13.5px] font-medium text-volt-ink">
              Ends in <span className={MONO}>{endsIn}</span> day{endsIn === 1 ? '' : 's'}
            </p>
          )}
        </div>

        <dl className="mb-[18px] grid grid-cols-2 gap-3.5">
          <div>
            <dt className={META_LABEL}>Team size</dt>
            <dd className="mt-[5px] text-[14.5px] text-ink">{teamSize || 'Not set'}</dd>
          </div>
          <div>
            <dt className={META_LABEL}>Top prize</dt>
            <dd className="mt-[5px] truncate font-mono text-[15px] text-ink tabular-nums">
              {hackathon.prizes?.winner || 'TBA'}
            </dd>
          </div>
        </dl>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-hairline pt-4">
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {themes.slice(0, THEME_LIMIT).map((theme) => (
              <span
                key={theme.id ?? theme.name}
                className={`${BADGE} ${BADGE_NEUTRAL} max-w-[15ch] overflow-hidden text-ellipsis`}
              >
                {theme.name}
              </span>
            ))}
            {extraThemes > 0 && (
              <span className={`${BADGE} ${BADGE_NEUTRAL}`}>+{extraThemes}</span>
            )}
          </div>
          <IconArrow
            width={16}
            height={16}
            className="shrink-0 text-muted transition-transform duration-150 group-hover:translate-x-[3px] group-hover:text-ink"
          />
        </div>
      </div>
    </Link>
  )
}

/** Placeholder cards at the real card's height, so nothing jumps on arrival. */
function CardSkeleton() {
  return (
    <div className={`${CARD_SHELL} animate-pulse`} aria-hidden="true">
      <div className="h-[168px] bg-raised" />
      <div className="flex flex-col gap-3 p-[22px]">
        <div className="h-[18px] w-1/2 rounded bg-raised" />
        <div className="h-[13px] w-1/3 rounded bg-raised" />
        <div className="my-2 h-[15px] w-2/3 rounded bg-raised" />
        <div className="h-[36px] rounded bg-raised" />
      </div>
    </div>
  )
}

function BoardNotice({ children }) {
  return (
    <div className="rounded-drop border border-dashed border-hairline px-6 py-14 text-center text-muted">
      {children}
    </div>
  )
}

export default function HackathonBoard({ hackathons = [], loading = false, error = null, onRetry }) {
  const [filter, setFilter] = useState('all')

  const filtered = hackathons.filter((hackathon) => matches(filter, hackathon))
  const visible = filtered.slice(0, PREVIEW_LIMIT)

  // The board keeps showing finished events so there is something to browse
  // between hackathons — but it can't call a wall of Closed cards "live".
  const anyLive = hackathons.some(isAccepting)

  return (
    <section className="pt-2 pb-11 md:py-18" id="hackathons" aria-labelledby="drop-board-title">
      <div className={WRAP}>
        <div className="mb-4 flex items-end justify-between gap-6 md:mb-6">
          <h2
            id="drop-board-title"
            className="text-2xl font-semibold tracking-[-0.025em] text-ink md:text-[32px]"
          >
            {anyLive || loading ? 'Live right now' : 'Hackathons on Drop'}
          </h2>
          {!loading && !error && hackathons.length > 0 && (
            <p className="font-mono text-[13px] text-muted tabular-nums" aria-live="polite">
              {visible.length} of {filtered.length}
            </p>
          )}
        </div>

        <div
          className="drop-no-scrollbar -mx-5 mb-4 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] md:mx-0 md:mb-6 md:px-0"
          role="group"
          aria-label="Filter hackathons"
        >
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={[
                'shrink-0 rounded-full border px-4 py-[9px] text-sm whitespace-nowrap transition-colors',
                filter === option.id
                  ? 'border-muted/50 bg-raised text-ink'
                  : 'border-hairline text-muted hover:border-muted/50 hover:text-ink',
                'disabled:pointer-events-none disabled:opacity-50',
              ].join(' ')}
              aria-pressed={filter === option.id}
              disabled={loading || Boolean(error)}
              onClick={() => setFilter(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : error ? (
          <BoardNotice>
            <p className="text-ink">We couldn&rsquo;t load the hackathon board.</p>
            <p className="mt-2 text-[14px]">{error.message}</p>
            {onRetry && (
              <button type="button" className={`${BTN_GHOST} mt-6`} onClick={onRetry}>
                Try again
              </button>
            )}
          </BoardNotice>
        ) : hackathons.length === 0 ? (
          <BoardNotice>No hackathons are open yet.</BoardNotice>
        ) : visible.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((hackathon) => (
              <HackathonCard key={hackathon.id} hackathon={hackathon} />
            ))}
          </div>
        ) : (
          <BoardNotice>Nothing matches that filter. Try another.</BoardNotice>
        )}

        <p className="mt-8">
          <Link
            to="/hackathons"
            className="group/link inline-flex items-center gap-2 text-[15px] font-medium text-ink transition-colors hover:text-volt-ink"
          >
            See all hackathons
            <IconArrow
              width={16}
              height={16}
              className="transition-transform duration-150 group-hover/link:translate-x-[3px]"
            />
          </Link>
        </p>
      </div>
    </section>
  )
}
