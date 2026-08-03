import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { hackathonsApi } from '../../api/hackathons'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import { queryKeys } from '../../lib/queryKeys'
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

export default function HackathonsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === ROLES.ADMIN
  const { data, loading, error, reload } = useAsync(
    (opts) => hackathonsApi.list(opts),
    { key: queryKeys.hackathons, staleTime: 60_000 },
  )
  const [filter, setFilter] = useState('all')
  const hackathons = useMemo(
    () =>
      (data || [])
        .map((hackathon) => ({ ...hackathon, eventStatus: getHackathonStatus(hackathon) }))
        .filter((hackathon) => filter === 'all' || hackathon.eventStatus.key === filter)
        .sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [data, filter],
  )

  return (
    <div className={`${WRAP_APP} py-7 md:py-10`}>
      <header className="mb-7 flex flex-col gap-5 rounded-drop border border-hairline bg-surface p-5 sm:mb-9 sm:flex-row sm:items-end sm:justify-between sm:p-7 md:p-8">
        <div className="flex max-w-3xl items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-drop border border-volt-edge bg-volt-tint text-volt-ink">
            <Icon name="trophy" size={22} />
          </span>
          <div>
            <span className={EYEBROW}>Drop events</span>
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
            <Link to="/admin/hackathons/new" className={`${BTN_VOLT} w-full sm:w-auto`}>
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

      <div className="mb-5 flex flex-col gap-4 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-ink md:text-[24px]">
            Explore hackathons
          </h2>
          <p className="mt-1 text-[13.5px] text-muted">
            <span className={MONO}>{data?.length || 0}</span> event
            {data?.length === 1 ? '' : 's'} available
          </p>
        </div>
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
                  ? 'border-[#3A3A44] bg-raised text-ink'
                  : 'border-hairline text-muted hover:border-[#3A3A44] hover:text-ink',
              ].join(' ')}
              aria-pressed={filter === item.key}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
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
                    <div className="grid size-full place-items-center bg-linear-to-br from-[#141418] via-[#1c1c22] to-[#24242c] text-muted">
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
                    <h3 className="text-[18px] font-semibold tracking-[-0.02em] text-ink">
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
                    </div>
                  </div>

                  {hackathon.description ? (
                    <p className="line-clamp-2 text-[13.5px] leading-relaxed text-muted">
                      {hackathon.description}
                    </p>
                  ) : null}

                  {!!hackathon.themes?.length && (
                    <div className="flex flex-wrap gap-1.5">
                      {hackathon.themes.map((theme) => (
                        <span
                          key={theme.id}
                          className="rounded-full border border-volt-edge bg-volt-tint px-2.5 py-1 text-[11.5px] font-medium text-volt-ink"
                        >
                          {theme.name}
                        </span>
                      ))}
                    </div>
                  )}

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
                <Link to="/admin/hackathons/new" className={BTN_VOLT}>
                  <Icon name="plus" size={17} />
                  Create hackathon
                </Link>
              ) : undefined
            }
          />
        </div>
      )}
    </div>
  )
}
