import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from '../../api/admin'
import { hackathonsApi } from '../../api/hackathons'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import { queryKeys } from '../../lib/queryKeys'
import { hasPermission, PERMISSIONS } from '../../utils/access'
import { formatDate } from '../../utils/format'
import { getHackathonStatus } from '../../utils/hackathons'
import {
  BADGE,
  BADGE_CLOSED,
  BADGE_CLOSING,
  BADGE_OPEN,
  BTN_GHOST,
  BTN_VOLT,
  MONO,
  PANEL,
  WRAP_APP,
} from '../../components/drop/theme'
import Icon from '../../components/ui/Icon'
import Alert from '../../components/ui/Alert'
import Avatar from '../../components/ui/Avatar'
import { LoadingBlock } from '../../components/ui/Spinner'
import { useAdminPath } from '../../hooks/useAdminPath'

/** Each shortcut shows only to a role that may open its screen. */
const QUICK_ACTIONS = [
  {
    to: '/admin/users',
    label: 'Invite Users',
    icon: 'userPlus',
    permission: PERMISSIONS.STUDENT_MANAGEMENT,
  },
  {
    to: '/admin/settings',
    label: 'System Settings',
    icon: 'settings',
    permission: PERMISSIONS.APPLICATION_SETTINGS,
  },
]

function statusBadgeClass(key) {
  if (key === 'live') return BADGE_OPEN
  if (key === 'upcoming') return BADGE_CLOSING
  return BADGE_CLOSED
}

function OverviewStat({ icon, value, label }) {
  return (
    <div className={`${PANEL} p-3.5 sm:p-4`}>
      <div className="flex items-center gap-3">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-drop border border-hairline bg-raised text-muted"
          aria-hidden="true"
        >
          <Icon name={icon} size={17} />
        </span>
        <span
          className={`${MONO} text-[22px] leading-none font-semibold tracking-[-0.03em] text-ink sm:text-[24px]`}
        >
          {value}
        </span>
      </div>
      <div className="mt-3 truncate text-[12.5px] font-medium text-muted">{label}</div>
    </div>
  )
}

/** Empty / placeholder area inside a panel body. */
function PanelEmpty({ children, className = '' }) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-drop border border-hairline px-4 text-center ${className}`}
    >
      {children}
    </div>
  )
}

/**
 * Overview. Shown to any role with `overview` (the route sends everyone else to
 * their first allowed screen).
 *
 * Counts come from GET /admin/overview. The hackathon list is separate.
 * Links into other screens appear only with that screen's permission.
 */
export default function AdminDashboard() {
  const toAdminPath = useAdminPath()
  const { user } = useAuth()
  const canEvaluators = hasPermission(user, PERMISSIONS.EVALUATOR_MANAGEMENT)
  const canHackathons = hasPermission(user, PERMISSIONS.HACKATHONS)
  const quickActions = QUICK_ACTIONS.filter((action) => hasPermission(user, action.permission)).map(
    (action) => ({ ...action, to: toAdminPath(action.to) }),
  )

  const { data, loading, error, reload } = useAsync((options) => adminApi.getOverview(options), {
    key: queryKeys.adminOverview,
    staleTime: 30_000,
  })
  const {
    data: hackathonData,
    loading: hackathonsLoading,
    error: hackathonsError,
    reload: reloadHackathons,
  } = useAsync((opts) => hackathonsApi.list(opts), { key: queryKeys.hackathons, staleTime: 60_000 })

  const firstLoad = loading && !data
  const usersOk = firstLoad || Number.isInteger(data?.total_users)
  const evaluatorsOk = firstLoad || Number.isInteger(data?.evaluator_count)
  const pendingOk = firstLoad || Number.isInteger(data?.pending_count)
  const hackathonsOk = !hackathonsError

  const pending = data?.pending_evaluators || []
  const hackathons = useMemo(
    () =>
      [...(hackathonData || [])].sort((a, b) =>
        String(a.start_date || '').localeCompare(String(b.start_date || '')),
      ),
    [hackathonData],
  )

  const stats = [
    { show: usersOk, icon: 'users', value: firstLoad ? '—' : data.total_users, label: 'Total users' },
    { show: usersOk, icon: 'user', value: firstLoad ? '—' : data.student_count, label: 'Students' },
    {
      show: evaluatorsOk,
      icon: 'shield',
      value: firstLoad ? '—' : data.evaluator_count,
      label: 'Evaluators',
    },
    {
      show: pendingOk,
      icon: 'clock',
      value: firstLoad ? '—' : data.pending_count,
      label: 'Pending approvals',
    },
    {
      show: hackathonsOk,
      icon: 'calendar',
      value: hackathonsLoading && !hackathonData ? '—' : (hackathonData?.length ?? 0),
      label: 'Hackathons',
    },
  ].filter((stat) => stat.show)
  const showPanels = pendingOk || quickActions.length > 0

  return (
    <div className={`${WRAP_APP} py-6 md:py-8`}>
      <header className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-ink md:text-[30px]">
            Overview
          </h1>
          <p className="mt-1.5 text-[13.5px] text-muted md:text-[14px]">
            Manage Everything at your fingertip
          </p>
        </div>
        {canHackathons && (
          <Link
            to={toAdminPath('/admin/hackathons/create')}
            className={`${BTN_VOLT} min-h-11 w-full px-4 text-[14px] sm:w-auto`}
          >
            <Icon name="plus" size={16} />
            Create hackathon
          </Link>
        )}
      </header>

      {error && (
        <div className="mb-4">
          <Alert variant="danger" title="Unable to load overview">
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
              <span>{error.message}</span>
              <button
                type="button"
                className={`${BTN_GHOST} min-h-10 w-fit px-3.5 text-[13px]`}
                onClick={() => reload({ force: true })}
              >
                Try again
              </button>
            </div>
          </Alert>
        </div>
      )}

      <section
        aria-label="Platform metrics"
        className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:mb-5 xl:grid-cols-5"
      >
        {stats.map((stat) => (
          <OverviewStat key={stat.label} icon={stat.icon} value={stat.value} label={stat.label} />
        ))}
      </section>

      {showPanels && (
        <section
          className={`mb-4 grid grid-cols-1 gap-4 lg:mb-5 ${
            pendingOk && quickActions.length ? 'lg:grid-cols-2' : ''
          }`}
        >
          {pendingOk && (
            <div className={`${PANEL} flex flex-col overflow-hidden`}>
              <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                <h2 className="truncate text-[15px] font-semibold tracking-[-0.02em] text-ink">
                  Pending evaluator approvals
                </h2>
                {/* Approving needs evaluator_management; Overview alone only reads. */}
                {canEvaluators && (
                  <Link
                    to={toAdminPath('/admin/evaluators')}
                    className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-volt-ink"
                  >
                    Manage
                    <Icon name="arrowRight" size={14} />
                  </Link>
                )}
              </div>

              <div className="flex flex-1 flex-col px-4 pb-4 sm:px-5 sm:pb-5">
                {firstLoad ? (
                  <PanelEmpty className="min-h-[120px] flex-1 py-6">
                    <LoadingBlock label="Loading…" />
                  </PanelEmpty>
                ) : pending.length ? (
                  <ul className="flex flex-col gap-2.5">
                    {pending.slice(0, 5).map((u) => (
                      <li
                        key={u.id}
                        className="flex items-center justify-between gap-3 rounded-drop border border-hairline bg-raised/50 px-3 py-2.5"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Avatar name={u.name} size="sm" />
                          <div className="min-w-0">
                            <div className="truncate text-[14px] font-semibold text-ink">
                              {u.name}
                            </div>
                            <div className="truncate text-[12px] text-muted">{u.email}</div>
                          </div>
                        </div>
                        <span className={`${BADGE} ${BADGE_CLOSED}`}>Evaluator</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <PanelEmpty className="min-h-[120px] flex-1 py-8">
                    <p className="text-[13px] text-muted">No pending approvals.</p>
                  </PanelEmpty>
                )}
              </div>
            </div>
          )}

          {quickActions.length > 0 && (
            <div className={`${PANEL} flex flex-col overflow-hidden`}>
              <div className="px-4 py-3.5 sm:px-5">
                <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-ink">
                  Quick actions
                </h2>
                <p className="mt-1 text-[12.5px] text-muted">Jump to the areas you manage most.</p>
              </div>

              <div className="grid grid-cols-1 gap-3 px-4 pb-4 sm:grid-cols-2 sm:px-5 sm:pb-5">
                {quickActions.map((action) => (
                  <Link
                    key={action.to}
                    to={action.to}
                    className="group flex min-h-[52px] items-center gap-2.5 rounded-drop border border-hairline px-3.5 py-3 text-[13.5px] font-medium text-ink transition-colors hover:border-volt-edge hover:bg-raised"
                  >
                    <Icon
                      name={action.icon}
                      size={17}
                      className="shrink-0 text-muted transition-colors group-hover:text-volt-ink"
                    />
                    <span className="truncate">{action.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <section className={`${PANEL} overflow-hidden`} aria-labelledby="admin-hackathons-title">
        <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:px-5">
          <div className="min-w-0">
            <h2
              id="admin-hackathons-title"
              className="text-[15px] font-semibold tracking-[-0.02em] text-ink"
            >
              Hackathons
            </h2>
            <p className="mt-1 text-[12.5px] text-muted">
              All events currently available on the platform.
            </p>
          </div>
          <button
            type="button"
            className={`${BTN_GHOST} min-h-9 w-full shrink-0 px-3 text-[12.5px] sm:w-auto`}
            onClick={() => reloadHackathons({ force: true })}
            disabled={hackathonsLoading && !hackathonData}
          >
            <Icon name="refresh" size={15} />
            Refresh
          </button>
        </div>

        <div className="px-4 pb-4 sm:px-5 sm:pb-5">
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
            <PanelEmpty className="min-h-[200px] py-10">
              <LoadingBlock label="Loading hackathons…" />
            </PanelEmpty>
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
                          className="block truncate text-[15px] font-semibold tracking-[-0.02em] text-ink transition-colors hover:text-volt-ink"
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
                      {canHackathons && (
                        <Link
                          to={toAdminPath(`/admin/hackathons/${hackathon.id}/edit`)}
                          className={`${BTN_GHOST} min-h-9 px-3 text-[12.5px]`}
                        >
                          <Icon name="edit" size={14} />
                          Edit
                        </Link>
                      )}
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
            <PanelEmpty className="min-h-[200px] py-12 sm:py-16">
              <span
                className="mb-4 grid size-12 place-items-center rounded-full border border-hairline bg-raised text-muted"
                aria-hidden="true"
              >
                <Icon name="calendar" size={20} />
              </span>
              <h3 className="text-[15px] font-semibold text-ink">No hackathons yet</h3>
              <p className="mt-1.5 max-w-[38ch] text-[12.5px] text-muted">
                Create the first hackathon and it will appear here for every authenticated role.
              </p>
              {canHackathons && (
                <Link
                  to={toAdminPath('/admin/hackathons/create')}
                  className={`${BTN_VOLT} mt-5 min-h-11 px-4 text-[14px]`}
                >
                  <Icon name="plus" size={16} />
                  Create hackathon
                </Link>
              )}
            </PanelEmpty>
          )}
        </div>
      </section>
    </div>
  )
}
