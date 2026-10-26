import { Fragment, useState } from 'react'
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
import { useAsync } from '../../hooks/useAsync'
import { queryKeys } from '../../lib/queryKeys'
import { formatDate } from '../../utils/format'
import { PANEL } from '../drop/theme'
import Alert from '../ui/Alert'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import Input from '../ui/Input'
import { LoadingBlock } from '../ui/Spinner'
import { ChartLegend, ChartTooltip } from './chart'
import { useChartTheme } from './chartTheme'
import { count, DASH, hours, plotValue, rate, scoreWithRating } from './format'
import MultiPicker from './MultiPicker'
import { Num, NumHead, Section, Tile } from './parts'

/** Limits the API enforces with a 400; the pickers stop at them. */
const MAX_HACKATHONS = 12
const MAX_EVALUATORS = 50

const list = (value) => (Array.isArray(value) ? value : [])

/** "1 Oct" for a YYYY-MM-DD day on the chart axis. */
function shortDay(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return String(value || '')
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(date)
}

export default function EvaluatorSpeed({ options }) {
  const [hackathonIds, setHackathonIds] = useState([])
  const [evaluatorIds, setEvaluatorIds] = useState([])
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // Same check as the API, so an impossible window never goes out as a 400.
  const rangeError = fromDate && toDate && fromDate > toDate ? 'from_date cannot be later than to_date' : ''
  const dated = Boolean(fromDate || toDate)

  const filters = JSON.stringify({
    hackathon_ids: hackathonIds,
    evaluator_ids: evaluatorIds,
    from_date: fromDate,
    to_date: toDate,
  })
  const { data, loading, error, reload } = useAsync(
    (requestOptions) =>
      analysisApi
        .evaluators(JSON.parse(filters), requestOptions)
        .then((result) => ({ filters, result })),
    {
      key: rangeError ? null : queryKeys.analysisEvaluators(filters),
      enabled: !rangeError,
      staleTime: 0,
    },
  )
  const current = data?.filters === filters
  const result = current ? data.result : null

  const hackathonOptions = list(options?.hackathons).map((hackathon) => ({
    id: hackathon.id,
    label: hackathon.name,
    hint: `${formatDate(hackathon.start_date)} – ${formatDate(hackathon.end_date)}`,
  }))
  const evaluatorOptions = list(options?.evaluators).map((evaluator) => ({
    id: evaluator.id,
    label: evaluator.name || 'Unnamed evaluator',
    hint: evaluator.approval_status && evaluator.approval_status !== 'approved' ? evaluator.approval_status : null,
  }))

  return (
    <div>
      <div
        className={`${PANEL} mb-6 grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px_160px_auto] xl:items-end`}
      >
        <MultiPicker
          label="Hackathons"
          options={hackathonOptions}
          selected={hackathonIds}
          onChange={setHackathonIds}
          max={MAX_HACKATHONS}
          emptyLabel="All hackathons"
        />
        <MultiPicker
          label="Evaluators"
          options={evaluatorOptions}
          selected={evaluatorIds}
          onChange={setEvaluatorIds}
          max={MAX_EVALUATORS}
          emptyLabel="Every assigned evaluator"
        />
        <Input
          label="From"
          type="date"
          value={fromDate}
          max={toDate || undefined}
          onChange={(event) => setFromDate(event.target.value)}
        />
        <Input
          label="To"
          type="date"
          value={toDate}
          min={fromDate || undefined}
          onChange={(event) => setToDate(event.target.value)}
        />
        <div className="flex gap-2">
          {dated && (
            <Button
              variant="ghost"
              onClick={() => {
                setFromDate('')
                setToDate('')
              }}
            >
              Clear dates
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => reload({ force: true })}
            disabled={Boolean(rangeError) || loading}
            leftIcon={<Icon name="refresh" size={16} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {rangeError ? (
        <Alert variant="warning" title="Check the dates">
          The From date cannot be later than the To date.
        </Alert>
      ) : error && (current || !loading) ? (
        <Alert variant="danger" title="Unable to load evaluator speed">
          {error.message}
        </Alert>
      ) : !result ? (
        <LoadingBlock label="Loading evaluator speed…" />
      ) : (
        <SpeedResult result={result} dated={dated} />
      )}
    </div>
  )
}

function SpeedResult({ result, dated }) {
  const evaluators = list(result.evaluators)
  return (
    <>
      <Section
        title="Totals"
        description={
          dated
            ? 'Assignments and evaluator submits inside the window. Both dates are included.'
            : 'Every assignment and evaluator submit, with no date limit.'
        }
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Tile label="Assigned" value={count(result.assigned)} note="Still assigned now" />
          <Tile label="Completed" value={count(result.completed)} note="Evaluator submitted for review" />
          <Tile label="Pending" value={count(result.pending)} />
          <Tile label="Completion rate" value={rate(result.completion_rate)} note="Completed ÷ assigned" />
          <Tile label="Same-day rate" value={rate(result.same_day_rate)} note="Assigned and submitted on one IST day" />
          <Tile label="Rework rate" value={rate(result.rework_rate)} note="Changes requested ÷ completed" />
          <Tile label="Average time" value={hours(result.average_hours)} note="Assign to evaluator submit" />
          <Tile label="Median time" value={hours(result.median_hours)} />
          <Tile label="Fastest" value={hours(result.fastest_hours)} />
          <Tile label="Slowest" value={hours(result.slowest_hours)} />
          <Tile
            label="Average score"
            value={scoreWithRating(result.average_score, result.average_rating)}
            note="Approved completions only"
          />
          <Tile
            label="Review outcome"
            value={`${count(result.approved)} / ${count(result.pending_review)} / ${count(result.changes_requested)}`}
            note="Approved / pending review / changes requested"
          />
        </div>
        {!dated && Number(result.undated_assigned) > 0 && (
          <p className="mt-3 text-[12.5px] text-muted">
            {count(result.undated_assigned)} assigned submission
            {Number(result.undated_assigned) === 1 ? ' has' : 's have'} no assignment time. They are
            counted here, and left out whenever a date filter is set.
          </p>
        )}
      </Section>

      <DailyActivity daily={list(result.daily)} />

      <Section title="By evaluator" description="Most assigned first. Open a row to see each hackathon.">
        {!evaluators.length ? (
          <p className={`${PANEL} p-6 text-center text-[13px] text-muted`}>
            No evaluator has assigned or completed work for these filters.
          </p>
        ) : (
          <EvaluatorTable evaluators={evaluators} />
        )}
      </Section>
    </>
  )
}

/** Assigned and completed per IST day. Only days with activity are plotted. */
function DailyActivity({ daily }) {
  const { chrome, series } = useChartTheme()
  const rows = daily.map((point) => ({
    name: shortDay(point.date),
    date: point.date,
    assigned: plotValue(point.assigned),
    completed: plotValue(point.completed),
  }))

  return (
    <Section title="Daily activity" description="Days with no assignment and no completion are left out.">
      {!rows.length ? (
        <p className={`${PANEL} p-6 text-center text-[13px] text-muted`}>No activity in this window.</p>
      ) : (
        <div className={`${PANEL} p-4`}>
          <ChartLegend
            items={[
              { label: 'Assigned', color: series[0] },
              { label: 'Completed', color: series[1] },
            ]}
          />
          <div className="mt-3 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
                <CartesianGrid stroke={chrome.grid} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: chrome.muted, fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: chrome.grid }}
                  minTickGap={12}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: chrome.muted, fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip content={<ChartTooltip format={count} />} cursor={{ fill: chrome.grid, opacity: 0.35 }} />
                <Bar dataKey="assigned" name="Assigned" fill={series[0]} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
                <Bar dataKey="completed" name="Completed" fill={series[1]} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <details className="mt-3 text-[13px]">
            <summary className="cursor-pointer text-muted">Show as table</summary>
            <div className="table-wrap mt-2">
              <table className="table">
                <thead>
                  <tr>
                    <th>Day (IST)</th>
                    <NumHead>Assigned</NumHead>
                    <NumHead>Completed</NumHead>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.date}>
                      <td>{formatDate(row.date)}</td>
                      <Num>{count(row.assigned)}</Num>
                      <Num>{count(row.completed)}</Num>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
    </Section>
  )
}

function EvaluatorTable({ evaluators }) {
  const [openId, setOpenId] = useState('')
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Evaluator</th>
            <NumHead>Assigned</NumHead>
            <NumHead>Completed</NumHead>
            <NumHead>Pending</NumHead>
            <NumHead>Completion</NumHead>
            <NumHead>Average time</NumHead>
            <NumHead>Median time</NumHead>
            <NumHead>Same day</NumHead>
            <NumHead>Rework</NumHead>
            <NumHead>Average score</NumHead>
          </tr>
        </thead>
        <tbody>
          {evaluators.map((person) => {
            const byHackathon = list(person.by_hackathon)
            const open = openId === person.evaluator_id
            return (
              <Fragment key={person.evaluator_id}>
                <tr>
                  <td>
                    <button
                      type="button"
                      className="flex items-center gap-2 text-left"
                      aria-expanded={open}
                      disabled={!byHackathon.length}
                      onClick={() => setOpenId(open ? '' : person.evaluator_id)}
                    >
                      <Icon
                        name="chevronDown"
                        size={15}
                        className={`shrink-0 text-muted transition-transform ${open ? '' : '-rotate-90'} ${
                          byHackathon.length ? '' : 'opacity-0'
                        }`}
                      />
                      <span style={{ fontWeight: 600 }}>
                        {person.former ? 'Former evaluator' : person.name || 'Unnamed evaluator'}
                      </span>
                      {person.former && <Badge variant="neutral">Deleted account</Badge>}
                    </button>
                  </td>
                  <Num>{count(person.assigned)}</Num>
                  <Num>{count(person.completed)}</Num>
                  <Num>{count(person.pending)}</Num>
                  <Num>{rate(person.completion_rate)}</Num>
                  <Num>{hours(person.average_hours)}</Num>
                  <Num>{hours(person.median_hours)}</Num>
                  <Num>{rate(person.same_day_rate)}</Num>
                  <Num>{rate(person.rework_rate)}</Num>
                  <Num>{scoreWithRating(person.average_score, person.average_rating)}</Num>
                </tr>
                {open &&
                  byHackathon.map((item) => (
                    <tr key={`${person.evaluator_id}-${item.hackathon_id}`} className="bg-raised">
                      <td className="pl-10 text-[13px] text-muted">{item.name}</td>
                      <Num>{count(item.assigned)}</Num>
                      <Num>{count(item.completed)}</Num>
                      <Num>{count(item.pending)}</Num>
                      <Num>{DASH}</Num>
                      <Num>{hours(item.average_hours)}</Num>
                      <td colSpan={4} />
                    </tr>
                  ))}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
