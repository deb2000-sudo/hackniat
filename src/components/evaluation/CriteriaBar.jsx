import { formatScore } from '../../utils/format'

/**
 * A labelled progress bar for a single scoring criterion (out of `max`).
 * Renders an empty track and "N/A" when `value` isn't a real number, rather
 * than defaulting to a misleading zero.
 */
export default function CriteriaBar({ label, value, max = 10 }) {
  const hasValue = typeof value === 'number' && Number.isFinite(value)
  const pct = hasValue ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div className="criteria-row">
      <span className="criteria-row__label">{label}</span>
      <div className="bar">
        <div className="bar__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className={`criteria-row__score ${hasValue ? '' : 'criteria-row__score--empty'}`}>
        {hasValue ? formatScore(value) : 'N/A'}
      </span>
    </div>
  )
}
