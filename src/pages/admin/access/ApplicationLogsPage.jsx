import { useEffect, useState } from 'react'
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { accessApi } from '../../../api/access'
import { useTheme } from '../../../theme/useTheme'
import { roleLabel } from '../../../utils/access'
import { formatDateTime } from '../../../utils/format'
import { WRAP_APP } from '../../../components/drop/theme'
import PageHeader from '../../../components/layout/PageHeader'
import Alert from '../../../components/ui/Alert'
import Badge from '../../../components/ui/Badge'
import Button from '../../../components/ui/Button'
import Card, { CardBody, CardHeader } from '../../../components/ui/Card'
import EmptyState from '../../../components/ui/EmptyState'
import Icon from '../../../components/ui/Icon'
import Pagination from '../../../components/ui/Pagination'
import { LoadingBlock } from '../../../components/ui/Spinner'
import { AREA_SLOTS, OTHER, ROLE_SLOTS, SERIES } from './chartPalette'

/** The Show control: rows per page. The API accepts exactly these. */
const PAGE_SIZES = [25, 50, 100]

const TIME_WINDOWS = [
  { value: '15m', label: 'Last 15 min' },
  { value: '1h', label: 'Last hour' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
]
const DEFAULT_WINDOW = '7d'

const METHODS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']

/** Used until facets arrive; the API always returns these three. */
const OUTCOME_FALLBACK = [
  { value: 'success', label: 'Success' },
  { value: 'client_error', label: 'Client error' },
  { value: 'server_error', label: 'Server error' },
]

/** The role pie shows display names; the filter takes the role key. */
const ROLE_VALUE_BY_LABEL = {
  'super admin': 'super_admin',
  admin: 'admin',
  custom: 'custom',
  evaluator: 'evaluator',
  student: 'student',
}

/** "Slower than 1s". */
const SLOW_MS = 1000

/** How long typing pauses before the search is sent. */
const SEARCH_DELAY_MS = 300

/** Used when the snapshot does not say how long to wait. */
const DEFAULT_POLL_SECONDS = 15

/** Everything Reset clears. Page size is the viewer's choice and is kept. */
const EMPTY_FILTERS = {
  role: '',
  area: '',
  method: '',
  outcome: '',
  window: DEFAULT_WINDOW,
  user: null,
  slow: false,
}

/** Chart chrome per theme — the app's own muted ink and hairline tokens. */
const CHROME = {
  dark: { muted: '#8a8a94', grid: '#333333', surface: '#1a1a1a' },
  light: { muted: '#6c757d', grid: '#dee2e6', surface: '#ffffff' },
}

const list = (value) =>
  Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : value?.logs || []

const toNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

/** "742 ms", "1.4 s". */
function formatDuration(ms) {
  const value = toNumber(ms)
  return value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${Math.round(value)} ms`
}

/**
 * Errors as a percentage of requests. Computed from the two counts when both
 * are present, so a 0–1 fraction and a 0–100 percentage cannot be confused.
 */
function errorRatePercent(observation) {
  const requests = toNumber(observation?.requests_24h)
  if (requests > 0) return (toNumber(observation?.errors_24h) / requests) * 100
  const rate = toNumber(observation?.error_rate)
  return rate <= 1 ? rate * 100 : rate
}

/** Share of a total as a whole percent; a slice too small to round up reads "<1%", never "0%". */
function sharePercent(value, total) {
  const percent = (value / total) * 100
  return percent > 0 && percent < 1 ? '<1%' : `${Math.round(percent)}%`
}

function statusVariant(code) {
  const status = toNumber(code)
  if (status >= 500) return 'danger'
  if (status >= 400) return 'warning'
  if (status >= 200 && status < 300) return 'success'
  return 'neutral'
}

/**
 * Pie slices with a colour per category that never changes: known categories
 * take their fixed slot, up to two unlisted ones take the spare slots (largest
 * first), and anything past that folds into a neutral "Other". Slices stay in
 * slot order so neighbouring colours are the pairs the palette was checked on.
 */
function toSlices(items, knownOrder, theme) {
  const palette = SERIES[theme]
  const rows = list(items)
    .map((item) => ({
      name: String(item?.label ?? item?.name ?? 'Unknown'),
      value: toNumber(item?.value ?? item?.count),
    }))
    .filter((row) => row.value > 0)

  const slotOf = (name) => knownOrder.findIndex((known) => known.toLowerCase() === name.toLowerCase())
  const known = rows
    .filter((row) => slotOf(row.name) !== -1)
    .sort((a, b) => slotOf(a.name) - slotOf(b.name))
    .map((row) => ({ ...row, color: palette[slotOf(row.name)] }))

  const spare = palette.slice(knownOrder.length)
  const rest = rows
    .filter((row) => slotOf(row.name) === -1 && row.name.toLowerCase() !== 'other')
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
  const extra = rest.slice(0, spare.length).map((row, index) => ({ ...row, color: spare[index] }))

  const otherValue =
    rest.slice(spare.length).reduce((sum, row) => sum + row.value, 0) +
    rows.filter((row) => row.name.toLowerCase() === 'other').reduce((sum, row) => sum + row.value, 0)

  const slices = [...known, ...extra]
  if (otherValue > 0) slices.push({ name: 'Other', value: otherValue, color: OTHER[theme] })
  return slices
}

/**
 * One page of the logs response in a single shape. An older backend answered
 * with a bare array; treat that as one unfiltered page.
 */
function normalizeLogs(value) {
  if (Array.isArray(value)) {
    return { items: value, total: value.length, page: 1, page_size: value.length, summary: null, facets: null }
  }
  return { ...value, items: list(value?.items), total: toNumber(value?.total) }
}

/**
 * Facet options for a filter dropdown: `{ value, label, count }`. The current
 * selection is always kept as an option, even when it has dropped out of the
 * facets (or came from a pie slice), so the control never silently blanks.
 */
function facetOptions(facet, selected, fallback = []) {
  const source = list(facet).length ? list(facet) : fallback
  const options = source.map((option) => ({
    value: String(option.value),
    label: option.label ?? String(option.value),
    count: option.count,
  }))
  if (selected && !options.some((option) => option.value === selected)) {
    options.push({ value: selected, label: selected })
  }
  return options
}

/**
 * The filtered logs page and the observation snapshot, refetched together
 * every `poll_after_seconds`. Logs use the current query (page included);
 * observation never takes table filters — the charts always show the whole
 * application. Each settles on its own, so one failing keeps the other's last
 * good data. Polling pauses while the tab is hidden and fetches straight away
 * when it is shown again. A new query fetches immediately.
 *
 * `queryKey` is the JSON of the logs params: the effect re-runs when it
 * changes, and the stored logs carry it so the page knows which query the
 * rows on screen belong to.
 */
function useLiveLogs(queryKey) {
  const [state, setState] = useState({
    logs: null,
    observation: null,
    logsError: null,
    observationError: null,
    updatedAt: null,
    pollSeconds: DEFAULT_POLL_SECONDS,
  })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    const params = JSON.parse(queryKey)
    let active = true
    let timer = null
    let controller = null

    const run = async () => {
      clearTimeout(timer)
      if (document.visibilityState === 'hidden') return

      controller?.abort()
      controller = new AbortController()
      const { signal } = controller

      const [logsResult, observationResult] = await Promise.allSettled([
        accessApi.logs(params, { signal }),
        accessApi.observation({ signal }),
      ])
      if (!active || signal.aborted) return

      const observation =
        observationResult.status === 'fulfilled' ? observationResult.value : null
      const requested = toNumber(observation?.poll_after_seconds)
      const pollSeconds = requested >= 5 ? Math.min(requested, 300) : DEFAULT_POLL_SECONDS

      setState((previous) => ({
        logs:
          logsResult.status === 'fulfilled'
            ? { ...normalizeLogs(logsResult.value), key: queryKey }
            : previous.logs,
        logsError: logsResult.status === 'rejected' ? logsResult.reason : null,
        observation: observation || previous.observation,
        observationError:
          observationResult.status === 'rejected' ? observationResult.reason : null,
        updatedAt: observation?.generated_at || new Date().toISOString(),
        pollSeconds,
      }))

      timer = setTimeout(run, pollSeconds * 1000)
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') run()
    }

    document.addEventListener('visibilitychange', onVisibility)
    run()

    return () => {
      active = false
      clearTimeout(timer)
      controller?.abort()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [queryKey, nonce])

  const loading =
    !state.logs && !state.observation && !state.logsError && !state.observationError

  return { ...state, loading, refresh: () => setNonce((value) => value + 1) }
}

function Metric({ label, value, hint, live = false }) {
  return (
    <div className="rounded-drop border border-hairline bg-surface p-4">
      <div className="flex items-center gap-2 text-[12.5px] font-medium text-muted">
        {live && (
          <span className="relative flex size-2" aria-hidden="true">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-passed opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-passed" />
          </span>
        )}
        {label}
      </div>
      <div className="mt-2 text-[26px] leading-none font-semibold tracking-[-0.03em] text-ink">
        {value}
      </div>
      {hint && <div className="mt-2 text-[12px] text-muted">{hint}</div>}
    </div>
  )
}

function ChartTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="rounded-drop border border-hairline bg-surface px-3 py-2 text-[12.5px] shadow-lg">
      <div className="text-muted">{label ?? item.name}</div>
      <div className="mt-0.5 font-semibold text-ink">
        {toNumber(item.value).toLocaleString()} {unit}
      </div>
    </div>
  )
}

/**
 * Donut plus a list of every slice with its count and share — the table view.
 *
 * With `onSelect`, a slice (on the donut or in the list) filters the Activity
 * table; `isSelectable` decides which slices can (never "Other", which is not
 * a real category). The selected slice is marked in the list. The list rows
 * are buttons, so the filter works from the keyboard too.
 */
function PieCard({ title, description, slices, unit, chrome, onSelect, isSelectable, selectedName }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  const canSelect = (slice) => Boolean(onSelect) && (!isSelectable || isSelectable(slice))
  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
          <p className="mt-1 text-[12.5px] text-muted">{description}</p>
        </div>
      </CardHeader>
      <CardBody>
        {total > 0 ? (
          <div className="grid items-center gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
            <div
              className="mx-auto h-[180px] w-full max-w-[180px]"
              role="img"
              aria-label={`${title}: ${slices.map((s) => `${s.name} ${s.value}`).join(', ')}`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="58%"
                    outerRadius="100%"
                    startAngle={90}
                    endAngle={-270}
                    stroke={chrome.surface}
                    strokeWidth={2}
                    isAnimationActive={false}
                    onClick={(_, index) => {
                      const slice = slices[index]
                      if (slice && canSelect(slice)) onSelect(slice)
                    }}
                  >
                    {slices.map((slice) => (
                      <Cell
                        key={slice.name}
                        fill={slice.color}
                        style={{ cursor: canSelect(slice) ? 'pointer' : 'default', outline: 'none' }}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip unit={unit} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex flex-col gap-1">
              {slices.map((slice) => {
                const selected = selectedName === slice.name
                const content = (
                  <>
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-sm"
                        style={{ background: slice.color }}
                        aria-hidden="true"
                      />
                      <span className={`truncate text-ink ${selected ? 'font-semibold' : ''}`}>
                        {slice.name}
                      </span>
                    </span>
                    <span className="shrink-0 text-muted tabular-nums">
                      {slice.value.toLocaleString()} · {sharePercent(slice.value, total)}
                    </span>
                  </>
                )
                const rowClass =
                  'flex w-full items-center justify-between gap-3 rounded-md px-2 py-1 text-left text-[13px]'
                return (
                  <li key={slice.name}>
                    {canSelect(slice) ? (
                      <button
                        type="button"
                        className={`${rowClass} transition-colors hover:bg-raised ${selected ? 'bg-raised' : ''}`}
                        aria-pressed={selected}
                        title={`Show ${slice.name} in Activity`}
                        onClick={() => onSelect(slice)}
                      >
                        {content}
                      </button>
                    ) : (
                      <div className={rowClass}>{content}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ) : (
          <p className="py-8 text-center text-[13px] text-muted">Nothing recorded yet.</p>
        )}
      </CardBody>
    </Card>
  )
}

/** A compact labelled dropdown for the filter bar. Counts sit beside labels. */
function FilterSelect({ label, value, onChange, allLabel, options }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[12px] font-medium text-muted">
      {label}
      <select className="select" value={value} onChange={(event) => onChange(event.target.value)}>
        {allLabel && <option value="">{allLabel}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
            {option.count !== undefined && option.count !== null ? ` (${option.count})` : ''}
          </option>
        ))}
      </select>
    </label>
  )
}

/**
 * Super Admin: Application Logs. Two parts on one poll:
 *
 * - Performance — live active users, the 24-hour active-user line, accounts by
 *   role, operations by area, request / error / duration numbers. Always the
 *   whole application; table filters never reach it.
 * - Activity — a paged, searchable feed of signed-in actions (IST). Filters
 *   come from the API's facets; clicking a pie slice or a user's name filters
 *   it. The current page keeps refreshing with the same query.
 *
 * Opening this page writes no log row of its own.
 */
export default function ApplicationLogsPage() {
  const { isDark } = useTheme()
  const theme = isDark ? 'dark' : 'light'
  const chrome = CHROME[theme]
  const lineColor = SERIES[theme][0]

  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])

  // Search once typing pauses, from the first page.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim())
      setPage(1)
    }, SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [query])

  const queryKey = JSON.stringify({
    page,
    page_size: pageSize,
    q: search,
    role: filters.role,
    area: filters.area,
    method: filters.method,
    outcome: filters.outcome,
    window: filters.window,
    user_id: filters.user?.id || '',
    min_duration_ms: filters.slow ? SLOW_MS : '',
  })

  const live = useLiveLogs(queryKey)
  const { observation, logs } = live

  // Rows on screen belong to an older query until the new page arrives: dim them.
  const stale = Boolean(logs) && logs.key !== queryKey
  // A page past the end comes back as the last page; follow it.
  if (logs && !stale && logs.page && logs.page !== page) setPage(logs.page)

  const setFilter = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }))
    setPage(1)
  }

  const reset = () => {
    setQuery('')
    setSearch('')
    setFilters(EMPTY_FILTERS)
    setPage(1)
  }

  const filtered =
    Boolean(search) ||
    Object.keys(EMPTY_FILTERS).some((name) => filters[name] !== EMPTY_FILTERS[name])

  /** From a chart: filter the table and bring it into view. */
  const filterFromChart = (name, value) => {
    setFilter(name, value)
    document.getElementById('activity-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const activeSeries = list(observation?.active_users_24h).map((point) => ({
    label: point?.label ?? '',
    active_users: toNumber(point?.active_users),
  }))
  const peak = activeSeries.reduce(
    (best, point) => (point.active_users > best.active_users ? point : best),
    { label: '', active_users: 0 },
  )
  const roleSlices = toSlices(observation?.users_by_role, ROLE_SLOTS, theme)
  const areaSlices = toSlices(observation?.operations_by_area, AREA_SLOTS, theme)
  const roleValueOf = (slice) => ROLE_VALUE_BY_LABEL[slice.name.toLowerCase()]
  const selectedRoleName = roleSlices.find((slice) => roleValueOf(slice) === filters.role)?.name

  const rows = logs?.items || []
  const total = logs?.total || 0
  const facets = logs?.facets || {}
  const summary = logs?.summary

  return (
    <div className={`${WRAP_APP} py-7 md:py-10`}>
      <PageHeader
        eyebrow="Application Access"
        title="Application Logs"
        description="Who is doing what, and how the application is holding up. Times are IST; logs are kept for 7 days."
        actions={
          <Button
            variant="secondary"
            onClick={live.refresh}
            leftIcon={<Icon name="refresh" size={18} />}
          >
            Refresh
          </Button>
        }
      />

      <p className="mb-5 flex items-center gap-2 text-[12.5px] text-muted" aria-live="polite">
        <Icon name="clock" size={14} />
        {live.updatedAt
          ? `Updated ${formatDateTime(live.updatedAt, { second: '2-digit' })} IST · refreshes every ${live.pollSeconds}s`
          : 'Loading…'}
      </p>

      {live.loading ? (
        <LoadingBlock label="Loading application logs…" />
      ) : (
        <div className="stack-lg">
          <section aria-labelledby="performance-title" className="stack-md min-w-0">
            <h2 id="performance-title" className="text-[17px] font-semibold text-ink">
              Performance
            </h2>
            {live.observationError && (
              <Alert variant="danger" title="Unable to load performance">
                {live.observationError.message}
                {observation ? ' Showing the last snapshot.' : ''}
              </Alert>
            )}

            {observation && (
              <>
                <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
                  <Metric
                    live
                    label="Active now"
                    value={toNumber(observation.active_now).toLocaleString()}
                    hint="Users with an action in the last 15 minutes"
                  />
                  <Metric
                    label="Requests (24h)"
                    value={toNumber(observation.requests_24h).toLocaleString()}
                  />
                  <Metric
                    label="Error rate (24h)"
                    value={`${errorRatePercent(observation).toFixed(1)}%`}
                    hint={`${toNumber(observation.errors_24h).toLocaleString()} errors`}
                  />
                  <Metric
                    label="Average duration (24h)"
                    value={formatDuration(observation.average_duration_ms)}
                  />
                </div>

                <Card className="min-w-0">
                  <CardHeader>
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-semibold text-ink">
                        Active users, last 24 hours
                      </h3>
                      <p className="mt-1 text-[12.5px] text-muted">
                        Distinct users per hour (IST).
                        {peak.active_users > 0 && ` Peak ${peak.active_users} at ${peak.label}.`}
                      </p>
                    </div>
                  </CardHeader>
                  <CardBody>
                    {activeSeries.length ? (
                      <div
                        className="h-[240px] min-w-0"
                        role="img"
                        aria-label={`Active users over the last 24 hours. Peak ${peak.active_users} at ${peak.label}.`}
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={activeSeries} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                            <CartesianGrid stroke={chrome.grid} vertical={false} />
                            <XAxis
                              dataKey="label"
                              tick={{ fill: chrome.muted, fontSize: 12 }}
                              tickLine={false}
                              axisLine={{ stroke: chrome.grid }}
                              interval="preserveStartEnd"
                              minTickGap={24}
                            />
                            <YAxis
                              allowDecimals={false}
                              tick={{ fill: chrome.muted, fontSize: 12 }}
                              tickLine={false}
                              axisLine={false}
                              width={36}
                            />
                            <Tooltip
                              content={<ChartTooltip unit="active users" />}
                              cursor={{ stroke: chrome.muted, strokeDasharray: '3 3' }}
                            />
                            <Line
                              type="monotone"
                              dataKey="active_users"
                              name="Active users"
                              stroke={lineColor}
                              strokeWidth={2}
                              dot={false}
                              activeDot={{ r: 4, stroke: chrome.surface, strokeWidth: 2 }}
                              isAnimationActive={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="py-8 text-center text-[13px] text-muted">No activity yet.</p>
                    )}
                  </CardBody>
                </Card>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <PieCard
                    title="Accounts by role"
                    description="Every account on the platform. Pick a role to filter Activity."
                    slices={roleSlices}
                    unit="accounts"
                    chrome={chrome}
                    isSelectable={(slice) => Boolean(roleValueOf(slice))}
                    onSelect={(slice) => filterFromChart('role', roleValueOf(slice))}
                    selectedName={selectedRoleName}
                  />
                  <PieCard
                    title="Operations by area (24h)"
                    description="Where signed-in actions happened. Pick an area to filter Activity."
                    slices={areaSlices}
                    unit="operations"
                    chrome={chrome}
                    isSelectable={(slice) => slice.name !== 'Other'}
                    onSelect={(slice) => filterFromChart('area', slice.name)}
                    selectedName={filters.area}
                  />
                </div>
              </>
            )}
          </section>

          <section aria-labelledby="activity-title" className="stack-md min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 id="activity-title" className="scroll-mt-6 text-[17px] font-semibold text-ink">
                Activity
              </h2>
              {logs && (
                <p className="text-[13px] text-muted tabular-nums" aria-live="polite">
                  {total.toLocaleString()} action{total === 1 ? '' : 's'}
                  {summary && (
                    <>
                      {' · '}
                      {toNumber(summary.errors).toLocaleString()} failed
                      {' · '}
                      {formatDuration(summary.average_duration_ms)} avg
                    </>
                  )}
                </p>
              )}
            </div>

            <div className="stack-sm rounded-drop border border-hairline bg-surface p-3 sm:p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
                <label className="flex min-w-0 flex-col gap-1 text-[12px] font-medium text-muted md:col-span-2">
                  Search
                  <div className="input-group">
                    <input
                      className="input"
                      type="search"
                      placeholder="Name, email, operation, path or area"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      style={{ paddingLeft: 38 }}
                    />
                    <span
                      className="input-group__addon"
                      style={{ left: 4, right: 'auto', pointerEvents: 'none' }}
                    >
                      <Icon name="search" size={18} />
                    </span>
                  </div>
                </label>
                <FilterSelect
                  label="Time"
                  value={filters.window}
                  onChange={(value) => setFilter('window', value)}
                  options={TIME_WINDOWS}
                />
                <FilterSelect
                  label="Role"
                  value={filters.role}
                  onChange={(value) => setFilter('role', value)}
                  allLabel="All roles"
                  options={facetOptions(facets.roles, filters.role)}
                />
                <FilterSelect
                  label="Area"
                  value={filters.area}
                  onChange={(value) => setFilter('area', value)}
                  allLabel="All areas"
                  options={facetOptions(facets.areas, filters.area)}
                />
                <FilterSelect
                  label="Outcome"
                  value={filters.outcome}
                  onChange={(value) => setFilter('outcome', value)}
                  allLabel="All outcomes"
                  options={facetOptions(facets.outcomes, filters.outcome, OUTCOME_FALLBACK)}
                />
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="w-[150px]">
                  <FilterSelect
                    label="Method"
                    value={filters.method}
                    onChange={(value) => setFilter('method', value)}
                    allLabel="All methods"
                    options={facetOptions(
                      facets.methods,
                      filters.method,
                      METHODS.map((method) => ({ value: method, label: method })),
                    )}
                  />
                </div>
                <label className="flex h-10 cursor-pointer items-center gap-2 text-[13px] text-ink">
                  <input
                    type="checkbox"
                    checked={filters.slow}
                    onChange={(event) => setFilter('slow', event.target.checked)}
                  />
                  Slower than 1s
                </label>
                {filters.user && (
                  <span className="inline-flex h-8 items-center gap-1.5 self-center rounded-full border border-hairline bg-raised pr-1 pl-3 text-[13px] text-ink">
                    <Icon name="user" size={14} />
                    {filters.user.name}
                    <button
                      type="button"
                      className="grid size-6 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink"
                      aria-label={`Clear user filter ${filters.user.name}`}
                      onClick={() => setFilter('user', null)}
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </span>
                )}
                <div className="ml-auto flex items-end gap-3">
                  <Button variant="ghost" size="sm" onClick={reset} disabled={!filtered}>
                    Reset
                  </Button>
                  <div className="w-[110px]">
                    <FilterSelect
                      label="Show"
                      value={String(pageSize)}
                      onChange={(value) => {
                        setPageSize(Number(value))
                        setPage(1)
                      }}
                      options={PAGE_SIZES.map((size) => ({ value: String(size), label: `${size} rows` }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            {live.logsError && (
              <Alert variant="danger" title="Unable to load activity">
                {live.logsError.message}
                {logs ? ' Showing the last rows loaded.' : ''}
              </Alert>
            )}

            {rows.length ? (
              <>
                <div
                  className={`table-wrap transition-opacity ${stale ? 'opacity-60' : ''}`}
                  aria-busy={stale}
                >
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Time (IST)</th>
                        <th>User</th>
                        <th>Role</th>
                        <th>Operation</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => (
                        <tr key={row.id || `${row.created_at}-${row.path}-${index}`}>
                          <td className="text-sm whitespace-nowrap text-muted tabular-nums">
                            {formatDateTime(row.created_at, { second: '2-digit' })}
                          </td>
                          <td>
                            {row.user_id ? (
                              <button
                                type="button"
                                className="text-left font-semibold text-ink underline-offset-2 hover:underline"
                                title="Show only this person's activity"
                                onClick={() =>
                                  setFilter('user', { id: row.user_id, name: row.name || row.email })
                                }
                              >
                                {row.name || '—'}
                              </button>
                            ) : (
                              <div style={{ fontWeight: 600 }}>{row.name || '—'}</div>
                            )}
                            <div className="text-xs text-muted">{row.email}</div>
                          </td>
                          <td>
                            <Badge variant="neutral">{roleLabel(row) || '—'}</Badge>
                          </td>
                          <td>
                            <div>{row.operation || '—'}</div>
                            <div className="text-xs text-muted">
                              {[row.area, row.method && row.path ? `${row.method} ${row.path}` : row.path]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          </td>
                          <td>
                            <Badge variant={statusVariant(row.status_code)}>
                              {row.status_code ?? '—'}
                            </Badge>
                          </td>
                          <td
                            className="text-sm whitespace-nowrap text-muted tabular-nums"
                            style={{ textAlign: 'right' }}
                          >
                            {row.duration_ms == null ? '—' : formatDuration(row.duration_ms)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={page}
                  total={total}
                  pageSize={pageSize}
                  disabled={stale}
                  label="Activity pages"
                  onChange={setPage}
                />
              </>
            ) : logs ? (
              <Card>
                <CardBody>
                  <EmptyState
                    icon="clipboard"
                    title="No activity matches these filters."
                    description={
                      filtered
                        ? 'Try a wider time window, or reset the filters.'
                        : 'Signed-in actions from the last 7 days appear here.'
                    }
                    action={
                      filtered ? (
                        <Button variant="secondary" onClick={reset}>
                          Reset filters
                        </Button>
                      ) : undefined
                    }
                  />
                </CardBody>
              </Card>
            ) : null}
          </section>
        </div>
      )}
    </div>
  )
}
