import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from '../../api/admin'
import { hackathonsApi } from '../../api/hackathons'
import { useAsync } from '../../hooks/useAsync'
import { queryKeys } from '../../lib/queryKeys'
import { ROLES } from '../../utils/constants'
import { formatDate } from '../../utils/format'
import { getHackathonStatus } from '../../utils/hackathons'
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
import Icon from '../../components/ui/Icon'
import Alert from '../../components/ui/Alert'
import Avatar from '../../components/ui/Avatar'
import { LoadingBlock } from '../../components/ui/Spinner'

const QUICK_ACTIONS = [
  { to: '/hackathons', label: 'Manage hackathons', icon: 'calendar' },
  { to: '/admin/themes', label: 'Manage themes', icon: 'sparkles' },
  { to: '/admin/users', label: 'Student management', icon: 'users' },
  { to: '/admin/evaluators', label: 'Evaluator management', icon: 'shield' },
]

function statusBadgeClass(key) {
  if (key === 'live') return BADGE_OPEN
  if (key === 'upcoming') return BADGE_CLOSING
  return BADGE_CLOSED
}

function OverviewStat({ icon, value, label, hint }) {
  return (
    <div className={`${PANEL} flex items-start gap-3.5 p-4 md:p-[18px]`}>
      <span
        className="grid size-10 shrink-0 place-items-center rounded-drop border border-hairline bg-raised text-muted"
        aria-hidden="true"
      >
        <Icon name={icon} size={18} />
      </span>
      <div className="min-w-0">
        <div className={`${MONO} text-[26px] leading-none font-semibold tracking-[-0.03em] text-ink`}>
          {value}
        </div>
        <div className="mt-1.5 text-[13px] font-medium text-muted">{label}</div>
        {hint ? <div className="mt-0.5 text-[12px] text-muted/80">{hint}</div> : null}
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { data, loading, error } = useAsync(
    async () => {
      const [users, evaluators, pending] = await Promise.all([
        adminApi.getUsers(),
        adminApi.getEvaluators(),
        adminApi.getPendingEvaluators(),
      ])
      return { users, evaluators, pending }
    },
    { key: queryKeys.adminOverview, staleTime: 30_000 },
  )
  const {
    data: hackathonData,
    loading: hackathonsLoading,
    error: hackathonsError,
    reload: reloadHackathons,
  } = useAsync(
    (opts) => hackathonsApi.list(opts),
    { key: queryKeys.hackathons, staleTime: 60_000 },
  )

  const users = useMemo(() => data?.users || [], [data])
  const evaluators = data?.evaluators || []
  const pending = data?.pending || []
  const students = useMemo(
    () => users.filter((u) => u.role === ROLES.STUDENT),
    [users],
  )
  const hackathons = useMemo(
    () =>
      [...(hackathonData || [])].sort((a, b) =>
        String(a.start_date || '').localeCompare(String(b.start_date || '')),
      ),
    [hackathonData],
  )

  const stats = [
    { icon: 'users', value: loading && !data ? '—' : users.length, label: 'Total users' },
    { icon: 'user', value: loading && !data ? '—' : students.length, label: 'Students' },
    { icon: 'shield', value: loading && !data ? '—' : evaluators.length, label: 'Evaluators' },
    {
      icon: 'clock',
      value: loading && !data ? '—' : pending.length,
      label: 'Pending approvals',
      hint: pending.length ? 'Needs your review' : null,
    },
    {
      icon: 'calendar',
      value: hackathonsLoading && !hackathonData ? '—' : (hackathonData?.length ?? 0),
      label: 'Hackathons',
    },
  ]

  return (
    <div className={`${WRAP_APP} py-7 md:py-10`}>
        <header className="mb-7 flex flex-col gap-4 sm:mb-9 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <span className={EYEBROW}>Administration</span>
            <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-ink md:text-[36px]">
              Overview
            </h1>
            <p className="mt-2 text-[15px] text-muted md:text-base">
              Manage users and evaluator approvals across Drop.
            </p>
          </div>
          <Link
            to="/admin/hackathons/new"
            className={`${BTN_VOLT} w-full sm:w-auto`}
          >
            <Icon name="plus" size={16} />
            Create hackathon
          </Link>
        </header>

        {error && (
          <div className="mb-6">
            <Alert variant="danger" title="Failed to load data">
              {error.message}
            </Alert>
          </div>
        )}

        <section
          aria-label="Platform metrics"
          className="mb-6 grid grid-cols-2 gap-3 md:mb-8 md:grid-cols-3 xl:grid-cols-5"
        >
          {stats.map((stat) => (
            <OverviewStat key={stat.label} {...stat} />
          ))}
        </section>

        <section className={`${PANEL} mb-6 overflow-hidden md:mb-8`} aria-labelledby="admin-hackathons-title">
          <div className="flex flex-col gap-4 border-b border-hairline px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <h2 id="admin-hackathons-title" className="text-base font-semibold tracking-[-0.02em] text-ink">
                Hackathons
              </h2>
              <p className="mt-1 text-[13px] text-muted">
                All events currently available on the platform.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={`${BTN_GHOST} min-h-10 px-3.5 text-[13px]`}
                onClick={() => reloadHackathons({ force: true })}
                disabled={hackathonsLoading && !hackathonData}
              >
                <Icon name="refresh" size={15} />
                Refresh
              </button>
              <Link
                to="/admin/hackathons/new"
                className={`${BTN_VOLT} min-h-10 px-3.5 text-[13px] sm:hidden`}
              >
                <Icon name="plus" size={15} />
                Create
              </Link>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {hackathonsError ? (
              <Alert variant="danger" title="Unable to load hackathons">
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <span>{hackathonsError.message}</span>
                  <button
                    type="button"
                    className={`${BTN_GHOST} min-h-10 w-fit px-3.5 text-[13px]`}
                    onClick={() => reloadHackathons({ force: true })}
                  >
                    Try again
                  </button>
                </div>
              </Alert>
            ) : hackathonsLoading && !hackathonData ? (
              <LoadingBlock label="Loading hackathons…" />
            ) : hackathons.length ? (
              <ul className="divide-y divide-hairline overflow-hidden rounded-drop border border-hairline">
                {hackathons.map((hackathon) => {
                  const eventStatus = getHackathonStatus(hackathon)
                  return (
                    <li
                      key={hackathon.id}
                      className="flex flex-col gap-3 bg-raised/40 px-3.5 py-3.5 transition-colors hover:bg-raised sm:flex-row sm:items-center sm:gap-4 sm:px-4"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <span
                          className="grid size-10 shrink-0 place-items-center rounded-drop border border-hairline bg-surface text-muted"
                          aria-hidden="true"
                        >
                          <Icon name="trophy" size={18} />
                        </span>
                        <div className="min-w-0">
                          <Link
                            to={`/hackathons/${hackathon.id}`}
                            className="block truncate text-[15px] font-semibold tracking-[-0.02em] text-ink transition-colors hover:text-volt"
                          >
                            {hackathon.name}
                          </Link>
                          <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-muted">
                            <Icon name="calendar" size={13} />
                            <span>
                              {formatDate(hackathon.start_date)} – {formatDate(hackathon.end_date)}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <span className={`${BADGE} ${statusBadgeClass(eventStatus.key)}`}>
                          {eventStatus.label}
                        </span>
                        <Link
                          to={`/admin/hackathons/${hackathon.id}/edit`}
                          className={`${BTN_GHOST} min-h-9 px-3 text-[12.5px]`}
                        >
                          <Icon name="edit" size={14} />
                          Edit
                        </Link>
                        <Link
                          to={`/hackathons/${hackathon.id}`}
                          className={`${BTN_GHOST} min-h-9 px-3 text-[12.5px]`}
                        >
                          View
                          <Icon name="arrowRight" size={14} />
                        </Link>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="rounded-drop border border-dashed border-hairline px-5 py-10 text-center">
                <span className="mx-auto mb-3 grid size-12 place-items-center rounded-drop border border-hairline bg-raised text-muted">
                  <Icon name="calendar" size={22} />
                </span>
                <h3 className="text-[15px] font-semibold text-ink">No hackathons yet</h3>
                <p className="mx-auto mt-1.5 max-w-md text-[13px] text-muted">
                  Create the first hackathon and it will appear here for every authenticated role.
                </p>
                <Link to="/admin/hackathons/new" className={`${BTN_VOLT} mt-5 inline-flex`}>
                  <Icon name="plus" size={16} />
                  Create hackathon
                </Link>
              </div>
            )}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
          <div className={`${PANEL} overflow-hidden`}>
            <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-4 sm:px-5">
              <div>
                <h2 className="text-base font-semibold tracking-[-0.02em] text-ink">
                  Pending evaluator approvals
                </h2>
                {pending.length > 0 && (
                  <p className={`${MONO} mt-1 text-[12px] text-muted`}>
                    {pending.length} waiting
                  </p>
                )}
              </div>
              <Link
                to="/admin/evaluators"
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-volt"
              >
                Manage
                <Icon name="arrowRight" size={14} />
              </Link>
            </div>
            <div className="p-4 sm:p-5">
              {loading && !data ? (
                <LoadingBlock label="Loading…" />
              ) : pending.length ? (
                <ul className="space-y-2.5">
                  {pending.slice(0, 5).map((u) => (
                    <li
                      key={u.id}
                      className="flex items-center justify-between gap-3 rounded-drop border border-hairline bg-raised/50 px-3 py-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={u.name} size="sm" />
                        <div className="min-w-0">
                          <div className="truncate text-[14px] font-semibold text-ink">{u.name}</div>
                          <div className="truncate text-[12px] text-muted">{u.email}</div>
                        </div>
                      </div>
                      <span className={`${BADGE} ${BADGE_CLOSED}`}>Evaluator</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-drop border border-dashed border-hairline px-4 py-8 text-center">
                  <span className="mx-auto mb-2 grid size-10 place-items-center rounded-drop border border-hairline bg-raised text-passed">
                    <Icon name="checkCircle" size={18} />
                  </span>
                  <h3 className="text-[14px] font-semibold text-ink">All caught up</h3>
                  <p className="mt-1 text-[12.5px] text-muted">
                    No evaluators are awaiting approval.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className={`${PANEL} overflow-hidden`}>
            <div className="border-b border-hairline px-4 py-4 sm:px-5">
              <h2 className="text-base font-semibold tracking-[-0.02em] text-ink">Quick actions</h2>
              <p className="mt-1 text-[13px] text-muted">Jump to the areas you manage most.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2 sm:p-5">
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  className="group flex items-center gap-3 rounded-drop border border-hairline bg-raised/40 px-3.5 py-3 transition-[border-color,background-color,transform] hover:-translate-y-px hover:border-volt-edge hover:bg-raised"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-drop border border-hairline bg-surface text-muted transition-colors group-hover:border-volt-edge group-hover:text-volt">
                    <Icon name={action.icon} size={16} />
                  </span>
                  <span className="flex-1 text-[13.5px] font-medium text-ink">{action.label}</span>
                  <Icon
                    name="arrowRight"
                    size={14}
                    className="text-muted opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
  )
}
