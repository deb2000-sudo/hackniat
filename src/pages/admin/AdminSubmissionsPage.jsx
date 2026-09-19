import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { evaluationApi } from '../../api/evaluation'
import { useAsync } from '../../hooks/useAsync'
import { queryKeys } from '../../lib/queryKeys'
import { formatDate } from '../../utils/format'
import {
  BADGE,
  BADGE_CLOSED,
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
import Input from '../../components/ui/Input'
import { LoadingBlock } from '../../components/ui/Spinner'

/** Neutral stat pill. Uses text-ink, not text-muted: these are numbers to read. */
const BADGE_STAT = 'border-hairline bg-raised text-ink'

export default function AdminSubmissionsPage() {
  const { data, loading, error, reload } = useAsync(
    (options) => evaluationApi.loadSubmissionHackathonsWithCounts(options),
    { key: queryKeys.submissionsAdminHackathons, staleTime: 30_000 },
  )

  const [query, setQuery] = useState('')

  // Memoised so the fallback [] is not a fresh array on every render, which
  // would invalidate the filter/sort memo below each time.
  // Tolerate a bare array as well as the loader's payload. This cache key is
  // also warmed by the login prefetch, and when the two shapes drifted apart the
  // page rendered "No hackathons available" while data was sitting right there.
  // Rendering the rows and flagging the missing counts beats a blank screen.
  const allHackathons = useMemo(
    () => (Array.isArray(data) ? data : data?.hackathons || []),
    [data],
  )
  const countsUnavailable = Array.isArray(data) || Boolean(data?.countsUnavailable)

  const hackathons = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return [...allHackathons]
      .filter((hackathon) => !needle || hackathon.name.toLowerCase().includes(needle))
      .sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
  }, [allHackathons, query])

  return (
    <div className={`${WRAP_APP} py-7 md:py-10`}>
      <header className="mb-7 flex flex-col gap-4 sm:mb-9 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-ink md:text-[36px]">
            Submissions by hackathon
          </h1>
          <p className="mt-2 text-[15px] text-muted md:text-base">
            Choose a hackathon to review its teams, run analysis, and publish reports.
          </p>
        </div>
        <button
          type="button"
          className={`${BTN_GHOST} w-full sm:w-auto`}
          onClick={() => reload({ force: true })}
          disabled={loading && !data}
        >
          <Icon name="refresh" size={17} />
          Refresh
        </button>
      </header>

      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center">
        <div className={`${PANEL} flex min-w-[160px] items-center gap-3 px-4 py-3.5`}>
          <span className="grid size-10 place-items-center rounded-drop border border-hairline bg-raised text-volt-ink">
            <Icon name="trophy" size={18} />
          </span>
          <div>
            <div className={`${MONO} text-[22px] leading-none font-semibold tracking-[-0.03em] text-ink`}>
              {allHackathons.length}
            </div>
            <div className="mt-1 text-[12.5px] text-muted">Hackathons</div>
          </div>
        </div>
        <div className="relative min-w-0 flex-1 sm:max-w-md sm:ml-auto">
          <Icon
            name="search"
            size={17}
            className="pointer-events-none absolute top-1/2 left-3.5 z-1 -translate-y-1/2 text-muted"
          />
          <Input
            aria-label="Search hackathons"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search hackathons"
            className="pl-10"
          />
        </div>
      </div>

      {/* A failed load is presented as "nothing here" rather than a red error,
          because this screen 500s when the collection is empty. The server's
          own message is kept underneath so a genuine outage is still
          diagnosable instead of silently looking like an empty database. */}
      {error && (
        <div className="mb-6">
          <Alert variant="warning" title="No hackathon or submission is present">
            Nothing is available to review yet. Create a hackathon, or refresh once students
            have submitted.
            <span className="mt-1.5 block text-[12px] opacity-70">Server said: {error.message}</span>
          </Alert>
        </div>
      )}

      {/* Counts come from a second feed. If only that one failed, say so —
          otherwise the zeros read as real data. */}
      {!error && countsUnavailable && (
        <div className="mb-6">
          <Alert variant="warning" title="Submission counts are unavailable">
            These hackathons loaded, but the submission feed did not, so every count shows zero.
            Refresh to try again.
          </Alert>
        </div>
      )}

      {loading && !data ? (
        <LoadingBlock label="Loading hackathons and submission counts…" />
      ) : hackathons.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {hackathons.map((hackathon) => {
            return (
              <article
                key={hackathon.hackathon_id}
                className={`${PANEL} group flex flex-col overflow-hidden transition-[transform,border-color,background-color] duration-150 hover:-translate-y-[3px] hover:border-volt-edge hover:bg-raised`}
              >
                <div className="relative h-[200px] overflow-hidden bg-raised">
                  {hackathon.banner_url ? (
                    <img
                      src={hackathon.banner_url}
                      alt=""
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="grid size-full place-items-center bg-linear-to-br from-surface to-raised text-muted">
                      <Icon name="trophy" size={34} />
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-canvas/80 via-transparent to-transparent" />
                  <span className={`${BADGE} ${BADGE_CLOSED} absolute right-3.5 bottom-3 z-1`}>
                    <strong className={`${MONO} mr-1 text-[13px]`}>{hackathon.submission_count || 0}</strong>
                    submissions
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-4 p-5">
                  <div>
                    <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-ink">
                      {hackathon.name}
                    </h2>
                    <p className="mt-2 flex items-center gap-1.5 text-[13px] text-muted">
                      <Icon name="calendar" size={15} />
                      {formatDate(hackathon.start_date)} – {formatDate(hackathon.end_date)}
                    </p>
                  </div>

                  <div className="mt-auto flex flex-wrap gap-2 border-t border-hairline pt-4">
                    <span className={`${BADGE} ${BADGE_STAT}`}>
                      <strong className={`${MONO} mr-1`}>{hackathon.submission_count || 0}</strong>
                      Submissions
                    </span>
                    <span className={`${BADGE} ${BADGE_OPEN}`}>
                      <strong className={`${MONO} mr-1`}>{hackathon.evaluated_count || 0}</strong>
                      Evaluated
                    </span>
                    <span className={`${BADGE} ${BADGE_STAT}`}>
                      <strong className={`${MONO} mr-1`}>{hackathon.awaiting_count || 0}</strong>
                      Awaiting evaluation
                    </span>
                  </div>

                  <Link
                    to={`/admin/submissions/hackathons/${hackathon.hackathon_id}`}
                    className={`${BTN_VOLT} w-full`}
                  >
                    View All Submissions
                    <Icon name="arrowRight" size={16} />
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className={`${PANEL} p-8`}>
          <EmptyState
            icon="trophy"
            title={query ? 'No matching hackathons' : 'No hackathons available'}
            description={
              query
                ? 'Try another search term.'
                : 'Create a hackathon first. It will appear here with its submission count.'
            }
          />
        </div>
      )}
    </div>
  )
}
