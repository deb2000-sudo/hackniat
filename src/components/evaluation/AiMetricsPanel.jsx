import Badge from '../ui/Badge'
import { STANDARD_SCORECARD_COLORS } from '../../utils/scorecard'

export default function AiMetricsPanel({ scorecard, emptyLabel = 'AI metrics are not available yet.' }) {
  const aiMetrics = (scorecard?.metrics || []).filter(
    (metric) => metric.scoring_mode === 'ai',
  )

  if (!aiMetrics.length) {
    return <p className="text-sm text-muted">{emptyLabel}</p>
  }

  return (
    <div className="ai-metrics-panel stack-md">
      {aiMetrics.map((metric) => {
        const color =
          metric.color || STANDARD_SCORECARD_COLORS[metric.field_key] || '#2563EB'
        return (
          <article
            key={metric.field_key}
            className="ai-metric-card"
            style={{ '--metric-color': color }}
          >
            <header>
              <div>
                <span className="ai-metric-card__mode">AI</span>
                <h3>{metric.field_label || metric.field_key}</h3>
                <p>
                  Weight {metric.weight ?? 0}%
                  {metric.weighted_score != null
                    ? ` · ${Number(metric.weighted_score).toFixed(1)} pts`
                    : ''}
                </p>
              </div>
              <Badge variant={metric.score != null ? 'info' : 'neutral'}>
                {metric.skipped
                  ? 'Skipped'
                  : metric.score != null
                    ? `${metric.score} / ${metric.max_score}`
                    : 'Pending'}
              </Badge>
            </header>
            {metric.rationale ? (
              <p className="ai-metric-card__rationale">{metric.rationale}</p>
            ) : (
              <p className="ai-metric-card__rationale is-muted">No rationale returned.</p>
            )}
          </article>
        )
      })}
    </div>
  )
}
