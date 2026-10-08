import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { hackathonsApi } from '../../api/hackathons'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import { queryKeys } from '../../lib/queryKeys'
import { richTextToPlainText } from '../../lib/richText'
import { ROLES } from '../../utils/constants'
import { formatDate } from '../../utils/format'
import { getHackathonDuration, getHackathonStatus } from '../../utils/hackathons'
import {
  BADGE,
  BADGE_CLOSED,
  BADGE_CLOSING,
  BADGE_OPEN,
  BTN_GHOST,
  BTN_VOLT,
  EYEBROW,
  MONO,
  PANEL,
  WRAP_APP,
} from '../../components/drop/theme'
import Alert from '../../components/ui/Alert'
import DraftsInbox from '../../components/hackathons/DraftsInbox'
import EmptyState from '../../components/ui/EmptyState'
import Icon from '../../components/ui/Icon'
import { LoadingBlock } from '../../components/ui/Spinner'

const FILTERS = [
  { key: 'all', label: 'All events' },
  { key: 'live', label: 'Live' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Completed' },
]

function statusBadge(key) {
  if (key === 'live') return BADGE_OPEN
  if (key === 'upcoming') return BADGE_CLOSING
  return BADGE_CLOSED
}

/** Theme chips shown on a card; the rest collapse into "+N more". */
const CARD_THEME_LIMIT = 2

const THEME_CHIP =
  'rounded-full border border-volt-edge bg-volt-tint px-2.5 py-1 text-[11.5px] font-medium text-volt-ink'

/**
 * One line of theme chips, always the same height: the first two themes
 * (truncated if long) and a "+N more" chip whose tooltip lists the rest.
 * An empty row still takes its line so cards without themes stay level.
 */
function ThemeChips({ themes = [] }) {
  const shown = themes.slice(0, CARD_THEME_LIMIT)
  const hidden = themes.slice(CARD_THEME_LIMIT)
  return (
    <div className="flex min-h-[28px] min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden">
      {shown.map((theme) => (
        <span
          key={theme.id ?? theme.name}
          className={`${THEME_CHIP} min-w-0 truncate`}
          title={theme.name}
        >
          {theme.name}
        </span>
      ))}
      {hidden.length > 0 && (
        <span
          className={`${THEME_CHIP} shrink-0`}
          title={hidden.map((theme) => theme.name).join(', ')}
        >
          +{hidden.length} more
        </span>
      )}
    </div>
  )
}

/** Everything a search should match on a hackathon, lower-cased once. */
function searchText(hackathon) {
  return [
    hackathon.name,
    richTextToPlainText(hackathon.description),
    hackathon.team_mode_label,
    ...(hackathon.themes || []).map((theme) => theme.name),
    ...(hackathon.timeline || []).map((round) => round.title),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

/**
 * Pill search box in the filter row's style. "/" focuses it from anywhere on
 * the page (unless you are already typing), and Escape clears it.
 */
function HackathonSearch({ value, onChange }) {
  const inputRef = useRef(null)

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target
      const typing =
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      if (typing) return
      event.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div role="search" className="relative w-full sm:max-w-[420px] sm:flex-1">
      <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted">
        <Icon name="search" size={17} />
      </span>
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value) {
            event.preventDefault()
            onChange('')
          }
        }}
        placeholder="Search by name, theme or round"
        aria-label="Search hackathons"
        autoComplete="off"
        className="h-[42px] w-full appearance-none rounded-full border border-hairline bg-surface pr-11 pl-11 text-[14.5px] text-ink transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-muted hover:border-muted/50 focus:border-volt-edge focus:shadow-[0_0_0_4px_rgba(204,255,0,0.18)] [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange('')
            inputRef.current?.focus()
          }}
          className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted transition-colors hover:bg-raised hover:text-ink"
          aria-label="Clear search"
        >
          <Icon name="x" size={15} />
        </button>
      ) : (
        <kbd
          className="pointer-events-none absolute top-1/2 right-3.5 hidden -translate-y-1/2 rounded-md border border-hairline bg-raised px-1.5 font-mono text-[11px] leading-[18px] text-muted sm:block"
          aria-hidden="true"
        >
          /
        </kbd>
      )}
    </div>
  )
}

export default function HackathonsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === ROLES.ADMIN
  const { data, loading, error, reload } = useAsync(
    (opts) => hackathonsApi.list(opts),
    { key: queryKeys.hackathons, staleTime: 60_000 },
  )
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  // Keeps typing responsive while a long grid of cards re-filters.
  const needle = useDeferredValue(query.trim().toLowerCase())

  // Admin-only: unfinished hackathon drafts, listed above the live events so an
  // abandoned wizard is visible rather than silently stranded.
  const {
    data: drafts,
    error: draftsError,
    reload: reloadDrafts,
  } = useAsync(
    (opts) => (isAdmin ? hackathonsApi.listDrafts(opts) : Promise.resolve([])),
    { key: `${queryKeys.hackathons}:drafts:${isAdmin}`, staleTime: 30_000 },
  )
  const [discardingId, setDiscardingId] = useState('')
  const [discardError, setDiscardError] = useState('')

  const discardDraft = async (draft) => {
    setDiscardingId(draft.id)
    setDiscardError('')
    try {
      await hackathonsApi.deleteDraft(draft.id)
      await reloadDrafts({ force: true })
    } catch (err) {
      setDiscardError(err.message || 'Could not discard that draft.')
    } finally {
      setDiscardingId('')
    }
  }
  const hackathons = useMemo(
    () =>
      (data || [])
        .map((hackathon) => ({ ...hackathon, eventStatus: getHackathonStatus(hackathon) }))
        .filter((hackathon) => filter === 'all' || hackathon.eventStatus.key === filter)
        .filter((hackathon) => !needle || searchText(hackathon).includes(needle))
        .sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [data, filter, needle],
  )
  const totalCount = data?.length || 0
  const narrowed = Boolean(needle) || filter !== 'all'
  const filterLabel = FILTERS.find((item) => item.key === filter)?.label

  return (
    <div className={`${WRAP_APP} py-7 md:py-10`}>
      <header className="mb-7 flex flex-col gap-5 rounded-drop border border-hairline bg-surface p-5 sm:mb-9 sm:flex-row sm:items-end sm:justify-between sm:p-7 md:p-8">
        <div className="flex max-w-3xl items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-drop border border-volt-edge bg-volt-tint text-volt-ink">
            <Icon name="trophy" size={22} />
          </span>
          <div>
            <span className={EYEBROW}>Challazo events</span>
            <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-ink md:text-[36px]">
              Build. Compete. Make an impact.
            </h1>
            <p className="mt-2 text-[15px] text-muted md:text-base">
              Discover active and upcoming hackathons, timelines, rewards, and participation guidelines.
            </p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            className={`${BTN_GHOST} w-full sm:w-auto`}
            onClick={() => reload({ force: true })}
            disabled={loading && !data}
          >
            <Icon name="refresh" size={17} />
            Refresh
          </button>
          {isAdmin && (
            <Link to="/admin/hackathons/create" className={`${BTN_VOLT} w-full sm:w-auto`}>
              <Icon name="plus" size={17} />
              Create hackathon
            </Link>
          )}
        </div>
      </header>

      {error && (
        <div className="mb-6">
          <Alert variant="danger" title="Unable to load hackathons">{error.message}</Alert>
        </div>
      )}

      {isAdmin && discardError && (
        <div className="mb-6">
          <Alert variant="danger">{discardError}</Alert>
        </div>
      )}

      {isAdmin && !draftsError && (
        <DraftsInbox drafts={drafts} onDiscard={discardDraft} discardingId={discardingId} />
      )}

      <div className="mb-5 sm:mb-7">
        <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-ink md:text-[24px]">
          Explore hackathons
        </h2>
        <p className="mt-1 text-[13.5px] text-muted" aria-live="polite">
          {narrowed ? (
            <>
              <span className={MONO}>{hackathons.length}</span> of{' '}
              <span className={MONO}>{totalCount}</span> event{totalCount === 1 ? '' : 's'}
            </>
          ) : (
            <>
              <span className={MONO}>{totalCount}</span> event{totalCount === 1 ? '' : 's'} available
            </>
          )}
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <HackathonSearch value={query} onChange={setQuery} />
          <div
            className="drop-no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:px-0"
            role="group"
            aria-label="Filter hackathons"
          >
            {FILTERS.map((item) => (
              <button
                type="button"
                key={item.key}
                className={[
                  'shrink-0 rounded-full border px-4 py-[9px] text-sm whitespace-nowrap transition-colors',
                  filter === item.key
                    ? 'border-muted/50 bg-raised text-ink'
                    : 'border-hairline text-muted hover:border-muted/50 hover:text-ink',
                ].join(' ')}
                aria-pressed={filter === item.key}
                onClick={() => setFilter(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && !data ? (
        <LoadingBlock label="Loading hackathons…" />
      ) : hackathons.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {hackathons.map((hackathon) => {
            const duration = getHackathonDuration(hackathon.start_date, hackathon.end_date)
            return (
              <article
                key={hackathon.id}
                className={`${PANEL} group flex flex-col overflow-hidden transition-[transform,border-color,background-color] duration-150 hover:-translate-y-[3px] hover:border-volt-edge hover:bg-raised`}
              >
                <div className="relative h-[210px] overflow-hidden bg-raised">
                  {hackathon.banner_url ? (
                    <img
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      src={hackathon.banner_url}
                      alt={`${hackathon.name} banner`}
                    />
                  ) : (
                    <div className="grid size-full place-items-center bg-linear-to-br from-surface to-raised text-muted">
                      <Icon name="sparkles" size={40} />
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-canvas/75 via-transparent to-transparent" />
                  <span
                    className={`${BADGE} ${statusBadge(hackathon.eventStatus.key)} absolute top-3.5 left-3.5 z-1`}
                  >
                    {hackathon.eventStatus.label}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-4 p-5">
                  <div>
                    {/* Two lines reserved, so a short name and a long one end at the same height. */}
                    <h3
                      className="line-clamp-2 min-h-[2lh] text-[18px] leading-snug font-semibold tracking-[-0.02em] text-ink"
                      title={hackathon.name}
                    >
                      {hackathon.name}
                    </h3>
                    <div className="mt-2.5 flex flex-col gap-1.5 text-[13px] text-muted">
                      <span className="flex items-center gap-1.5">
                        <Icon name="calendar" size={15} />
                        {formatDate(hackathon.start_date)} – {formatDate(hackathon.end_date)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Icon name="clock" size={15} />
                        {duration ? `${duration} days` : 'Dates announced'}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Icon name="chart" size={15} />
                        {hackathon.timeline?.length || 0} rounds
                      </span>
                      {/* Always takes its line, so cards without a team mode stay level. */}
                      <span
                        className={`flex items-center gap-1.5 ${hackathon.team_mode_label ? '' : 'invisible'}`}
                        aria-hidden={!hackathon.team_mode_label}
                      >
                        <Icon name="users" size={15} />
                        {hackathon.team_mode_label || 'Team mode'}
                      </span>
                    </div>
                  </div>

                  <p className="line-clamp-2 min-h-[2lh] text-[13.5px] leading-relaxed text-muted">
                    {/* Plain words only: a two-line preview has no room for formatting. */}
                    {richTextToPlainText(hackathon.description)}
                  </p>

                  <ThemeChips themes={hackathon.themes} />

                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-hairline pt-4">
                    <div className="min-w-0">
                      <div className="text-[11px] tracking-[0.06em] text-muted uppercase">Top prize</div>
                      <div className="mt-0.5 truncate text-[14px] font-medium text-ink">
                        {hackathon.prizes?.winner || 'To be announced'}
                      </div>
                    </div>
                    <Link
                      to={`/hackathons/${hackathon.id}`}
                      className="inline-flex items-center gap-1.5 text-[14px] font-medium text-ink transition-colors hover:text-volt-ink"
                    >
                      Explore
                      <Icon name="arrowRight" size={15} />
                    </Link>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className={`${PANEL} border-dashed p-8`}>
          {needle ? (
            <EmptyState
              icon="search"
              title={`No hackathons match “${query.trim()}”`}
              description={
                filter === 'all'
                  ? 'Try another name, theme or round.'
                  : `Nothing under ${filterLabel} matches. Try another word, or search all events.`
              }
              action={
                <button
                  type="button"
                  className={BTN_GHOST}
                  onClick={() => {
                    setQuery('')
                    setFilter('all')
                  }}
                >
                  <Icon name="x" size={17} />
                  Clear search
                </button>
              }
            />
          ) : (
          <EmptyState
            icon="calendar"
            title={filter === 'all' ? 'No hackathons yet' : `No ${filter} hackathons`}
            description={
              filter === 'all'
                ? 'New hackathons will appear here when published.'
                : 'Choose a different filter to explore other events.'
            }
            action={
              isAdmin && filter === 'all' ? (
                <Link to="/admin/hackathons/create" className={BTN_VOLT}>
                  <Icon name="plus" size={17} />
                  Create hackathon
                </Link>
              ) : undefined
            }
          />
          )}
        </div>
      )}
    </div>
  )
}
