import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { evaluationApi } from '../../api/evaluation'
import { useAsync } from '../../hooks/useAsync'
import { queryKeys } from '../../lib/queryKeys'
import { formatDate } from '../../utils/format'
import {
  BADGE,
  BADGE_CLOSED,
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

export default function EvaluatorDashboard() {
  const { data, loading, error, reload } = useAsync(
    (opts) => evaluationApi.listEvaluatorHackathons(opts),
    { key: queryKeys.submissionsEvaluatorHackathons, staleTime: 30_000 },
  )
  const [query, setQuery] = useState('')

  const hackathons = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return [...(data || [])]
      .filter((hackathon) => !needle || String(hackathon.name || '').toLowerCase().includes(needle))
      .sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
  }, [data, query])

  const totalAssigned = (data || []).reduce(
    (sum, hackathon) => sum + Number(hackathon.submission_count || 0),
    0,
  )

  return (
    <div className={`${WRAP_APP} py-7 md:py-10`}>
      <header className="mb-7 flex flex-col gap-4 sm:mb-9 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <span className={EYEBROW}>Evaluator workspace</span>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-ink md:text-[36px]">
            Assigned submissions
          </h1>
          <p className="mt-2 text-[15px] text-muted md:text-base">
            Choose a hackathon to review the teams assigned to you.
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
        <div className={`${PANEL} flex min-w-[150px] items-center gap-3 px-4 py-3.5`}>
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
        <div className={`${PANEL} flex min-w-[150px] items-center gap-3 px-4 py-3.5`}>
          <span className="grid size-10 place-items-center rounded-drop border border-hairline bg-raised text-volt">
            <Icon name="clipboard" size={18} />
          </span>
          <div>
            <div className={`${MONO} text-[22px] leading-none font-semibold tracking-[-0.03em] text-ink`}>
              {totalAssigned}
            </div>
            <div className="mt-1 text-[12.5px] text-muted">Assigned teams</div>
          </div>
        </div>
        <div className="relative min-w-0 flex-1 sm:max-w-md sm:ml-auto">
          <Icon
            name="search"
            size={17}
            className="pointer-events-none absolute top-1/2 left-3.5 z-1 -translate-y-1/2 text-muted"
          />
          <Input
            aria-label="Search assigned hackathons"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search hackathons"
            className="pl-10"
          />
        </div>
      </div>

      {error && (
        <div className="mb-6">
          <Alert variant="danger" title="Unable to load assigned hackathons">
            {error.message}
          </Alert>
        </div>
      )}

      {loading && !data ? (
        <LoadingBlock label="Loading assigned hackathons…" />
      ) : hackathons.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {hackathons.map((hackathon) => {
            const id = hackathon.hackathon_id || hackathon.id
            return (
              <article
                key={id}
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
                    assigned
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

                  <Link
                    to={`/evaluator/hackathons/${id}`}
                    className={`${BTN_VOLT} mt-auto w-full`}
                  >
                    View assignments
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
            icon="clipboard"
            title={query ? 'No matching hackathons' : 'No submissions assigned yet'}
            description={
              query
                ? 'Try another search term.'
                : 'Hackathons will appear here after an administrator assigns submissions to you.'
            }
          />
        </div>
      ) : null}
    </div>
  )
}
