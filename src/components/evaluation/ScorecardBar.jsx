import { STANDARD_SCORECARD_COLORS } from '../../utils/scorecard'

function metricColor(metric) {
  return metric.color || STANDARD_SCORECARD_COLORS[metric.field_key] || '#8a8a94'
}

/**
 * Shared weighted scorecard: stacked bar + legend + big total.
 * @param {{ scorecard: object, title?: string, compact?: boolean }} props
 */
export default function ScorecardBar({ scorecard, title = 'Scorecard', compact = false }) {
  if (!scorecard?.metrics?.length) return null

  const total = scorecard.computed_total
  const maxTotal = scorecard.max_total ?? 100

  return (
    <div className={`scorecard-bar ${compact ? 'scorecard-bar--compact' : ''}`}>
      <div className="scorecard-bar__header">
        <div>
          <span className="scorecard-bar__eyebrow">{title}</span>
          <div className="scorecard-bar__total">
            <strong>{total != null ? Number(total).toFixed(total % 1 ? 1 : 0) : '—'}</strong>
            <small>/ {maxTotal}</small>
          </div>
          <p className="scorecard-bar__subline">
            AI {scorecard.ai_total != null ? scorecard.ai_total : '—'}
            {' · '}
            Manual {scorecard.manual_total != null ? scorecard.manual_total : '—'}
            {scorecard.complete ? ' · Complete' : ' · Incomplete'}
          </p>
        </div>
      </div>

      <div
        className="scorecard-bar__track"
        role="img"
        aria-label={`Scorecard total ${total ?? 'pending'} of ${maxTotal}`}
      >
        {scorecard.metrics.map((metric) => {
          const weight = Number(metric.weight || 0)
          const width = Math.max(weight, 0)
          const color = metricColor(metric)
          const filled =
            metric.score != null && Number(metric.max_score) > 0
              ? Math.max(0, Math.min(1, Number(metric.score) / Number(metric.max_score)))
              : 0
          const pending = metric.score == null && !metric.skipped

          return (
            <div
              key={metric.field_key}
              className={`scorecard-bar__segment ${pending ? 'is-pending' : ''}`}
              style={{
                flexGrow: width,
                flexBasis: 0,
                '--metric-color': color,
              }}
              title={`${metric.field_label || metric.field_key}: ${
                metric.score != null ? `${metric.score}/${metric.max_score}` : 'pending'
              }`}
            >
              <span style={{ width: `${filled * 100}%` }} />
            </div>
          )
        })}
      </div>

      <ul className="scorecard-bar__legend">
        {scorecard.metrics.map((metric) => {
          const color = metricColor(metric)
          return (
            <li key={metric.field_key}>
              <span className="scorecard-bar__swatch" style={{ background: color }} />
              <div className="scorecard-bar__legend-copy">
                <strong>{metric.field_label || metric.field_key}</strong>
                <small>
                  {metric.score != null
                    ? `${Number(metric.score).toFixed(metric.score % 1 ? 1 : 0)} / ${metric.max_score}`
                    : 'Pending'}
                  {metric.weighted_score != null
                    ? ` · ${Number(metric.weighted_score).toFixed(1)} pts`
                    : metric.weight != null
                      ? ` · ${metric.weight}%`
                      : ''}
                </small>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
