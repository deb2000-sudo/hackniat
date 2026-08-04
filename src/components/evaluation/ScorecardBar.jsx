import { useMemo } from 'react'
import { STANDARD_SCORECARD_COLORS } from '../../utils/scorecard'

const RING_SIZE = 220
const RING_STROKE = 18

function metricColor(metric) {
  return metric.color || STANDARD_SCORECARD_COLORS[metric.field_key] || '#8a8a94'
}

function formatMetricScore(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0'
  return number % 1 ? number.toFixed(1) : String(number)
}

function formatTotalScore(value) {
  if (value == null) return '—'
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return number % 1 ? number.toFixed(1) : String(number)
}

function metricLegendLine(metric) {
  const score = metric.score != null ? Number(metric.score) : 0
  return `${formatMetricScore(score)} / ${metric.max_score}`
}

function buildRingSegments(metrics) {
  let start = 0
  return metrics.map((metric, index) => {
    const weight = Number(metric.weight || 0)
    const filled =
      metric.score != null && Number(metric.max_score) > 0
        ? Math.max(0, Math.min(1, Number(metric.score) / Number(metric.max_score)))
        : 0
    const segment = {
      key: metric.field_key,
      color: metricColor(metric),
      title: `${metric.field_label || metric.field_key}: ${metricLegendLine(metric)}`,
      slotPercent: weight,
      fillPercent: weight * filled,
      startPercent: start,
      index,
    }
    start += weight
    return segment
  })
}

function ScorecardRing({ metrics, total, maxTotal }) {
  const radius = (RING_SIZE - RING_STROKE) / 2
  const cx = RING_SIZE / 2
  const cy = RING_SIZE / 2
  const circumference = 2 * Math.PI * radius

  const segments = useMemo(
    () =>
      buildRingSegments(metrics).map((segment) => {
        const slotLen = (segment.slotPercent / 100) * circumference
        const fillLen = (segment.fillPercent / 100) * circumference
        const startOffset = (segment.startPercent / 100) * circumference
        return { ...segment, slotLen, fillLen, startOffset, circumference }
      }),
    [metrics, circumference],
  )

  const totalLabel = `${formatTotalScore(total)}/${maxTotal}`

  return (
    <div
      className="scorecard-ring"
      role="img"
      aria-label={`Scorecard total ${total ?? 'pending'} of ${maxTotal}`}
    >
      <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          <circle
            className="scorecard-ring__track"
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            strokeWidth={RING_STROKE}
          />
          {segments.map((segment) => (
            <circle
              key={`${segment.key}-slot`}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={RING_STROKE}
              strokeOpacity={0.2}
              strokeDasharray={`${segment.slotLen} ${circumference - segment.slotLen}`}
              strokeDashoffset={circumference - segment.startOffset}
              strokeLinecap="butt"
            />
          ))}
          {segments.map(
            (segment) =>
              segment.fillLen > 0 && (
                <circle
                  key={`${segment.key}-fill`}
                  className="scorecard-ring__fill"
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={RING_STROKE}
                  strokeDasharray={`0 ${circumference}`}
                  strokeDashoffset={circumference - segment.startOffset}
                  strokeLinecap="round"
                  style={{
                    '--ring-fill-target': segment.fillLen,
                    '--ring-gap-target': circumference - segment.fillLen,
                    '--ring-delay': `${segment.index * 0.08}s`,
                  }}
                  title={segment.title}
                />
              ),
          )}
        </g>
      </svg>
      <div className="scorecard-ring__center" aria-hidden="true">
        <span className="scorecard-bar__score-uniform scorecard-bar__score-uniform--ring">{totalLabel}</span>
      </div>
    </div>
  )
}

/**
 * Shared weighted scorecard: ring + legend + big total.
 * @param {{ scorecard: object, title?: string, compact?: boolean }} props
 */
export default function ScorecardBar({ scorecard, title = 'Scorecard', compact = false }) {
  if (!scorecard?.metrics?.length) return null

  const total = scorecard.computed_total
  const maxTotal = scorecard.max_total ?? 100
  const aiTotal = formatTotalScore(scorecard.ai_total)
  const manualTotal = formatTotalScore(scorecard.manual_total)

  return (
    <div className={`scorecard-bar ${compact ? 'scorecard-bar--compact' : ''}`}>
      <div className="scorecard-bar__top">
        <div className="scorecard-bar__header">
          <span className="scorecard-bar__eyebrow">{title}</span>
          <div className="scorecard-bar__total">
            <span className="scorecard-bar__score-uniform">
              {formatTotalScore(total)}/{maxTotal}
            </span>
          </div>
          <div className="scorecard-bar__chips">
            <span className="scorecard-bar__chip scorecard-bar__chip--ai">AI Score: {aiTotal}</span>
            <span className="scorecard-bar__chip scorecard-bar__chip--manual">
              Manual Score: {manualTotal}
            </span>
          </div>
        </div>

        <ScorecardRing metrics={scorecard.metrics} total={total} maxTotal={maxTotal} />
      </div>

      <div className="scorecard-bar__divider" aria-hidden="true" />

      <ul className="scorecard-bar__legend">
        {scorecard.metrics.map((metric) => {
          const color = metricColor(metric)
          return (
            <li key={metric.field_key}>
              <span className="scorecard-bar__swatch" style={{ background: color }} />
              <div className="scorecard-bar__legend-copy">
                <strong>{metric.field_label || metric.field_key}</strong>
                <small>{metricLegendLine(metric)}</small>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
