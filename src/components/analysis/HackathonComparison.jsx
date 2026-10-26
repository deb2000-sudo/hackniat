import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { analysisApi } from '../../api/analysis'
import { authErrorCode } from '../../api/authErrors'
import { useAsync } from '../../hooks/useAsync'
import { queryKeys } from '../../lib/queryKeys'
import { formatDate } from '../../utils/format'
import { PANEL } from '../drop/theme'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import Icon from '../ui/Icon'
import { Select } from '../ui/Input'
import { LoadingBlock } from '../ui/Spinner'
import { ChartLegend, ChartTooltip } from './chart'
import { useChartTheme } from './chartTheme'
import { count, DASH, plotValue, rate, scoreWithRating } from './format'
import MultiPicker from './MultiPicker'
import { Num, NumHead, Section, Tile } from './parts'

/** The API refuses more than this many hackathons in one comparison. */
const MAX_HACKATHONS = 12
const DEFAULT_TOP_N = 5

/** Bars per hackathon in the overview chart, in fixed palette slot order. */
const FUNNEL = [
  { key: 'enrolled', label: 'Enrolled' },
  { key: 'participating', label: 'Participating' },
  { key: 'submission_count', label: 'Submissions' },
  { key: 'approved', label: 'Approved' },
]

/** What the campus-across-hackathons view can line up. */
const CAMPUS_METRICS = [
  { key: 'participating', label: 'Participating', format: count },
  { key: 'submissions', label: 'Submissions', format: count },
  { key: 'enrolled', label: 'Enrolled', format: count },
  { key: 'registered', label: 'Registered', format: count },
  { key: 'participation_rate', label: 'Participation rate', format: rate, isRate: true },
]

const list = (value) => (Array.isArray(value) ? value : [])

function dateRange(item) {
  return `${formatDate(item.start_date)} – ${formatDate(item.end_date)}`
}

/** Short label for a chart axis: long event names would collide. */
function shortName(name, length = 18) {
  const text = String(name || '')
  return text.length > length ? `${text.slice(0, length - 1)}…` : text
}

export default function HackathonComparison({ options }) {
  const hackathonOptions = list(options?.hackathons)
  const topNChoices = list(options?.top_n_choices).length ? options.top_n_choices : [3, 5, 10]

  // Starts on the newest hackathon so the screen has numbers straight away.
  const [selectedIds, setSelectedIds] = useState(() =>
    hackathonOptions[0] ? [hackathonOptions[0].id] : [],
  )
  const [topN, setTopN] = useState(DEFAULT_TOP_N)

  const filters = JSON.stringify({ hackathon_ids: selectedIds, top_n: topN })
  const { data, loading, error, reload } = useAsync(
    // Tagged with the filters it answers: while a new request is in flight the
    // hook still holds the previous result, and it must not be shown as the new one.
    (requestOptions) =>
      analysisApi
        .hackathons(JSON.parse(filters), requestOptions)
        .then((result) => ({ filters, result })),
    {
      key: selectedIds.length ? queryKeys.analysisHackathons(filters) : null,
      enabled: selectedIds.length > 0,
      staleTime: 0,
    },
  )
  const current = data?.filters === filters
  const result = current ? data.result : null

  const pickerOptions = hackathonOptions.map((hackathon) => ({
    id: hackathon.id,
    label: hackathon.name,
    hint: dateRange(hackathon),
  }))

  return (
    <div>
      <div className={`${PANEL} mb-6 grid grid-cols-1 gap-3 p-4 md:grid-cols-[minmax(0,1fr)_160px_auto] md:items-end`}>
        <MultiPicker
          label="Hackathons"
          options={pickerOptions}
          selected={selectedIds}
          onChange={setSelectedIds}
          max={MAX_HACKATHONS}
          emptyLabel="Pick at least one hackathon"
        />
        <Select label="Top projects" value={topN} onChange={(event) => setTopN(Number(event.target.value))}>
          {topNChoices.map((choice) => (
            <option key={choice} value={choice}>
              Top {choice}
            </option>
          ))}
        </Select>
        <Button
          variant="ghost"
          onClick={() => reload({ force: true })}
          disabled={!selectedIds.length || loading}
          leftIcon={<Icon name="refresh" size={16} />}
        >
          Refresh
        </Button>
      </div>

      {!selectedIds.length ? (
        <div className={`${PANEL} p-8`}>
          <EmptyState
            icon="trophy"
            title={hackathonOptions.length ? 'Pick a hackathon' : 'No hackathons yet'}
            description={
              hackathonOptions.length
                ? 'Choose one hackathon, or up to 12 to compare them side by side.'
                : 'Create a hackathon first. Its numbers will appear here.'
            }
          />
        </div>
      ) : error && (current || !loading) ? (
        <Alert variant="danger" title="Unable to load the comparison">
          {authErrorCode(error) === 'HACKATHON_NOT_FOUND'
            ? 'One of the selected hackathons no longer exists. Reload the page to refresh the list.'
            : error.message}
        </Alert>
      ) : !result ? (
        <LoadingBlock label="Loading hackathon numbers…" />
      ) : (
        <ComparisonResult result={result} />
      )}
    </div>
  )
}

function ComparisonResult({ result }) {
  const hackathons = list(result.hackathons)
  const [detailId, setDetailId] = useState('')
  // Falls back to the first hackathon when the picked one left the selection.
  const detail = hackathons.find((item) => item.hackathon_id === detailId) || hackathons[0]

  return (
    <>
      <Section title="Across the selection">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Tile label="Students in the portal" value={count(result.portal_students)} />
          <Tile
            label="Distinct submitters"
            value={count(result.unique_submitters)}
            note="Students who submitted in any selected hackathon"
          />
          <Tile label="Submissions" value={count(result.submission_total)} />
          <Tile
            label="Enrollments"
            value={count(result.enrollment_total)}
            note="One student in two hackathons or rounds counts twice"
          />
          <Tile
            label="Average top score"
            value={scoreWithRating(result.average_top_score, result.average_top_rating)}
            note="Hackathons with no approved score are left out"
          />
        </div>
      </Section>

      <Section
        title="By hackathon"
        description="Coverage is assigned ÷ submissions. Approval rate is approved ÷ submissions."
      >
        <FunnelChart hackathons={hackathons} />
        <div className="table-wrap mt-4">
          <table className="table">
            <thead>
              <tr>
                <th>Hackathon</th>
                <NumHead>Eligible</NumHead>
                <NumHead>Enrolled</NumHead>
                <NumHead>Participating</NumHead>
                <NumHead>Submissions</NumHead>
                <NumHead>Assigned</NumHead>
                <NumHead>Review submitted</NumHead>
                <NumHead>Approved</NumHead>
                <NumHead>Pending review</NumHead>
                <NumHead>Changes requested</NumHead>
                <NumHead>Approval rate</NumHead>
              </tr>
            </thead>
            <tbody>
              {hackathons.map((item) => (
                <tr key={item.hackathon_id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    <div className="text-xs text-muted">{dateRange(item)}</div>
                  </td>
                  <Num
                    sub={
                      item.students_without_campus
                        ? `${count(item.students_without_campus)} without campus`
                        : null
                    }
                  >
                    {count(item.eligible_students)}
                  </Num>
                  <Num>{count(item.enrolled)}</Num>
                  <Num>{count(item.participating)}</Num>
                  <Num>{count(item.submission_count)}</Num>
                  <Num sub={`${rate(item.coverage)} coverage`}>{count(item.assigned)}</Num>
                  <Num>{count(item.review_submitted)}</Num>
                  <Num>{count(item.approved)}</Num>
                  <Num>{count(item.pending_review)}</Num>
                  <Num>{count(item.changes_requested)}</Num>
                  <Num>{rate(item.approval_rate)}</Num>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {hackathons.length > 1 && <CampusAcrossHackathons result={result} />}

      {detail && (
        <Section
          title={`Inside ${detail.name}`}
          description="Campuses, college types and the top projects for one hackathon."
          actions={
            hackathons.length > 1 && (
              <div style={{ minWidth: 240 }}>
                <Select
                  aria-label="Hackathon to show"
                  value={detail.hackathon_id}
                  onChange={(event) => setDetailId(event.target.value)}
                >
                  {hackathons.map((item) => (
                    <option key={item.hackathon_id} value={item.hackathon_id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </div>
            )
          }
        >
          <HackathonDetail hackathon={detail} />
        </Section>
      )}
    </>
  )
}

/** Enrolled → participating → submissions → approved, one group of bars per hackathon. */
function FunnelChart({ hackathons }) {
  const { chrome, series } = useChartTheme()
  const rows = hackathons.map((item) => ({
    name: shortName(item.name),
    ...Object.fromEntries(FUNNEL.map((bar) => [bar.key, plotValue(item[bar.key])])),
  }))
  return (
    <div className={`${PANEL} p-4`}>
      <ChartLegend items={FUNNEL.map((bar, index) => ({ label: bar.label, color: series[index] }))} />
      <div className="mt-3 h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="22%">
            <CartesianGrid stroke={chrome.grid} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: chrome.muted, fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: chrome.grid }}
              interval={0}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: chrome.muted, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip content={<ChartTooltip format={count} />} cursor={{ fill: chrome.grid, opacity: 0.35 }} />
            {FUNNEL.map((bar, index) => (
              <Bar
                key={bar.key}
                dataKey={bar.key}
                name={bar.label}
                fill={series[index]}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/**
 * One campus over the selected hackathons. The table lines every campus up;
 * the chart follows a single campus so it never needs more than one colour.
 */
function CampusAcrossHackathons({ result }) {
  const { chrome, series } = useChartTheme()
  const [level, setLevel] = useState('universities')
  const [metricKey, setMetricKey] = useState(CAMPUS_METRICS[0].key)
  const [campusId, setCampusId] = useState('')

  const campuses = list(level === 'universities' ? result.university_comparison : result.batch_comparison)
  const hackathons = list(result.hackathons)
  const metric = CAMPUS_METRICS.find((entry) => entry.key === metricKey) || CAMPUS_METRICS[0]
  const campus = campuses.find((entry) => String(entry.id) === campusId) || campuses[0]

  const campusLabel = (entry) =>
    level === 'universities'
      ? [entry.name, entry.location].filter(Boolean).join(', ')
      : `${entry.name}${entry.university_name ? ` · ${entry.university_name}` : ''}`

  const rows = list(campus?.hackathons).map((point) => ({
    name: shortName(point.hackathon_name),
    // Rates are plotted as percentages so the axis reads 0–100.
    value: metric.isRate
      ? plotValue(point[metric.key]) == null
        ? null
        : plotValue(point[metric.key]) * 100
      : plotValue(point[metric.key]),
  }))

  return (
    <Section
      title="Campuses across hackathons"
      description="The same campus lined up over every selected hackathon, sorted by campus name."
      actions={
        <div className="flex flex-wrap gap-2">
          <Select aria-label="Campus level" value={level} onChange={(event) => setLevel(event.target.value)}>
            <option value="universities">Universities</option>
            <option value="batches">Batches</option>
          </Select>
          <Select aria-label="Metric" value={metricKey} onChange={(event) => setMetricKey(event.target.value)}>
            {CAMPUS_METRICS.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {entry.label}
              </option>
            ))}
          </Select>
        </div>
      }
    >
      {!campuses.length ? (
        <p className={`${PANEL} p-6 text-center text-[13px] text-muted`}>
          No campuses are in scope for these hackathons.
        </p>
      ) : (
        <>
          <div className={`${PANEL} p-4`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13px] text-muted">
                {metric.label} for <strong className="text-ink">{campus ? campusLabel(campus) : DASH}</strong>
              </p>
              <div style={{ minWidth: 240 }}>
                <Select
                  aria-label="Campus to chart"
                  value={campus ? String(campus.id) : ''}
                  onChange={(event) => setCampusId(event.target.value)}
                >
                  {campuses.map((entry) => (
                    <option key={entry.id} value={String(entry.id)}>
                      {campusLabel(entry)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="mt-3 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={chrome.grid} vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: chrome.muted, fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: chrome.grid }}
                    interval={0}
                  />
                  <YAxis
                    allowDecimals={metric.isRate}
                    domain={metric.isRate ? [0, 100] : [0, 'auto']}
                    tickFormatter={metric.isRate ? (value) => `${value}%` : undefined}
                    tick={{ fill: chrome.muted, fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                  />
                  <Tooltip
                    content={
                      <ChartTooltip
                        format={(value) => (metric.isRate ? rate(value == null ? null : value / 100) : count(value))}
                      />
                    }
                    cursor={{ fill: chrome.grid, opacity: 0.35 }}
                  />
                  <Bar
                    dataKey="value"
                    name={metric.label}
                    fill={series[0]}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="table-wrap mt-4">
            <table className="table">
              <thead>
                <tr>
                  <th>{level === 'universities' ? 'University' : 'Batch'}</th>
                  {hackathons.map((item) => (
                    <NumHead key={item.hackathon_id}>{item.name}</NumHead>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campuses.map((entry) => {
                  const byHackathon = new Map(list(entry.hackathons).map((point) => [point.hackathon_id, point]))
                  return (
                    <tr key={entry.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{entry.name}</div>
                        <div className="text-xs text-muted">
                          {level === 'universities' ? entry.location : entry.university_name}
                        </div>
                      </td>
                      {hackathons.map((item) => (
                        <Num key={item.hackathon_id}>
                          {metric.format(byHackathon.get(item.hackathon_id)?.[metric.key])}
                        </Num>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Section>
  )
}

function HackathonDetail({ hackathon }) {
  const collegeTypes = list(hackathon.college_types)
  const universities = list(hackathon.universities)
  const batches = list(hackathon.batches)

  return (
    <div className="stack-lg">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {collegeTypes.map((type) => (
          <div key={type.college_type} className={`${PANEL} p-4`}>
            <h3 className="text-[15px] font-semibold text-ink">{type.college_type}</h3>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-3">
              <Fact label="Campuses" value={count(type.campuses)} />
              <Fact
                label="Headcount"
                value={count(type.headcount)}
                note={
                  type.campuses_missing_headcount
                    ? `${count(type.campuses_missing_headcount)} campus${
                        type.campuses_missing_headcount === 1 ? '' : 'es'
                      } missing a total`
                    : null
                }
              />
              <Fact label="Students" value={count(type.students)} />
              <Fact label="Enrollments" value={count(type.enrollments)} />
              <Fact label="Participants" value={count(type.participants)} />
              <Fact label="Submissions" value={count(type.submissions)} />
            </dl>
          </div>
        ))}
      </div>

      <CampusTable
        title="Universities"
        rows={universities}
        sub={(row) => row.location}
        headcountLabel="Headcount"
      />
      <CampusTable
        title="Batches"
        rows={batches}
        sub={(row) => row.university_name}
        headcountLabel="Batch strength"
      />

      <ProjectQuality quality={hackathon.project_quality} />
    </div>
  )
}

function Fact({ label, value, note }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="font-mono font-semibold text-ink tabular-nums">{value}</dd>
      {note && <dd className="text-[11.5px] text-muted">{note}</dd>}
    </div>
  )
}

function CampusTable({ title, rows, sub, headcountLabel }) {
  return (
    <div>
      <h3 className="mb-2 text-[15px] font-semibold text-ink">{title}</h3>
      {!rows.length ? (
        <p className={`${PANEL} p-5 text-center text-[13px] text-muted`}>
          No {title.toLowerCase()} are in scope for this hackathon.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{title === 'Batches' ? 'Batch' : 'University'}</th>
                <NumHead>Registered</NumHead>
                <NumHead>Enrolled</NumHead>
                <NumHead>Participating</NumHead>
                <NumHead>Submissions</NumHead>
                <NumHead>{headcountLabel}</NumHead>
                <NumHead>Participation rate</NumHead>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{row.name}</div>
                    <div className="text-xs text-muted">{sub(row)}</div>
                  </td>
                  <Num>{count(row.registered)}</Num>
                  <Num>{count(row.enrolled)}</Num>
                  <Num>{count(row.participating)}</Num>
                  <Num>{count(row.submissions)}</Num>
                  <Num>{count(row.headcount)}</Num>
                  <Num>{rate(row.participation_rate)}</Num>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ProjectQuality({ quality }) {
  const { chrome, series } = useChartTheme()

  if (!quality) {
    return (
      <div>
        <h3 className="mb-2 text-[15px] font-semibold text-ink">Project quality</h3>
        <p className={`${PANEL} p-5 text-center text-[13px] text-muted`}>
          No round in this hackathon has an approved score yet.
        </p>
      </div>
    )
  }

  const bands = list(quality.score_bands).map((band) => ({ name: band.label, value: plotValue(band.count) }))
  const winners = list(quality.winners)
  const roundName = quality.round_title || `Round ${Number(quality.round_index) + 1}`

  return (
    <div>
      <h3 className="text-[15px] font-semibold text-ink">Project quality · {roundName}</h3>
      <p className="mt-0.5 mb-3 text-[13px] text-muted">
        The latest round with an approved score. Only approved submissions with a final score count.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Approved scored submissions" value={count(quality.approved_count)} />
        <Tile
          label="Average, every approved score"
          value={scoreWithRating(quality.field_average_score, quality.field_average_rating)}
        />
        <Tile
          label={`Average of the top ${quality.top_n}`}
          value={scoreWithRating(quality.average_score, quality.average_rating)}
          note={quality.top_count !== quality.top_n ? `${count(quality.top_count)} projects in the group` : null}
        />
        <Tile
          label="Winners announced"
          value={quality.announced_count == null ? 'Not yet' : count(quality.announced_count)}
          note={quality.announced_top_n == null ? null : `Announcement for the top ${quality.announced_top_n}`}
        />
      </div>

      {quality.tie_at_cutoff && (
        <div className="mb-4">
          <Alert variant="info">
            The cutoff included tied scores, so {count(quality.top_count)} projects are listed for a top{' '}
            {quality.top_n}.
          </Alert>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className={`${PANEL} p-4`}>
          <p className="text-[13px] font-medium text-ink">Score bands</p>
          <div className="mt-2 h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bands} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={chrome.grid} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: chrome.muted, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: chrome.grid }}
                  interval={0}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: chrome.muted, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                />
                <Tooltip content={<ChartTooltip format={count} />} cursor={{ fill: chrome.grid, opacity: 0.35 }} />
                <Bar
                  dataKey="value"
                  name="Projects"
                  fill={series[0]}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 grid grid-cols-5 gap-1 text-center text-[11.5px] text-muted">
            {bands.map((band) => (
              <li key={band.name}>
                <span className="block font-mono font-semibold text-ink">{count(band.value)}</span>
                {band.name}
              </li>
            ))}
          </ul>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Student</th>
                <th>University · Batch</th>
                <th>College type</th>
                <NumHead>Score</NumHead>
              </tr>
            </thead>
            <tbody>
              {winners.length ? (
                winners.map((winner) => (
                  <tr key={`${winner.student_id}-${winner.rank}`}>
                    <td style={{ fontWeight: 600 }}>{winner.rank_label}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{winner.student_name}</div>
                      {winner.team_name && <div className="text-xs text-muted">{winner.team_name}</div>}
                    </td>
                    <td>
                      <div>{winner.university_name || DASH}</div>
                      <div className="text-xs text-muted">{winner.batch_name}</div>
                    </td>
                    <td>{winner.college_type}</td>
                    <Num>{scoreWithRating(winner.score, winner.rating)}</Num>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center text-muted">
                    No winners in this round yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
