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

export default function AdminSubmissionsPage() {
  const { data, loading, error, reload } = useAsync(
    async () => {
      const [hackathons, submissions] = await Promise.all([
        evaluationApi.listSubmissionHackathons(),
        evaluationApi.listAllSubmissions(),
      ])
      const evaluatedByHackathon = submissions.reduce((counts, submission) => {
        if (submission.status !== 'completed' || !submission.hackathon_id) return counts
        counts.set(
          submission.hackathon_id,
          (counts.get(submission.hackathon_id) || 0) + 1,
        )
        return counts
      }, new Map())
      return hackathons.map((hackathon) => ({
        ...hackathon,
        evaluated_count: evaluatedByHackathon.get(hackathon.hackathon_id) || 0,
      }))
    },
    { key: queryKeys.submissionsAdminHackathons, staleTime: 30_000 },
  )
  const [query, setQuery] = useState('')

  const hackathons = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return [...(data || [])]
      .filter((hackathon) => !needle || hackathon.name.toLowerCase().includes(needle))
      .sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
  }, [data, query])

  return (
    <div className={`${WRAP_APP} py-7 md:py-10`}>
      <header className="mb-7 flex flex-col gap-4 sm:mb-9 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <span className={EYEBROW}>Admin review</span>
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
          <span className="grid size-10 place-items-center rounded-drop border border-hairline bg-raised text-volt">
            <Icon name="trophy" size={18} />
          </span>
          <div>
            <div className={`${MONO} text-[22px] leading-none font-semibold tracking-[-0.03em] text-ink`}>
              {data?.length || 0}
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

      {error && (
        <div className="mb-6">
          <Alert variant="danger" title="Unable to load submission hackathons">
            {error.message}
          </Alert>
        </div>
      )}

      {loading && !data ? (
        <LoadingBlock label="Loading hackathons and submission counts…" />
      ) : hackathons.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {hackathons.map((hackathon) => {
            const awaiting = Math.max(
              0,
              Number(hackathon.submission_count || 0) - Number(hackathon.evaluated_count || 0),
            )
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
                    <div className="grid size-full place-items-center bg-linear-to-br from-[#141418] via-[#1c1c22] to-[#24242c] text-muted">
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
                    <span className={`${BADGE} ${BADGE_OPEN}`}>
                      <strong className={`${MONO} mr-1`}>{hackathon.evaluated_count || 0}</strong>
                      Evaluated
                    </span>
                    <span className={`${BADGE} ${BADGE_CLOSED}`}>
                      <strong className={`${MONO} mr-1`}>{awaiting}</strong>
                      Awaiting evaluation
                    </span>
                  </div>

                  <Link
                    to={`/admin/submissions/hackathons/${hackathon.hackathon_id}`}
                    className={`${BTN_VOLT} w-full`}
                  >
                    View submissions
                    <Icon name="arrowRight" size={16} />
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      ) : !error ? (
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
      ) : null}
    </div>
  )
}
