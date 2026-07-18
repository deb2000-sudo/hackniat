import { formatScore } from '../../utils/format'

/** A labelled progress bar for a single scoring criterion (out of `max`). */
export default function CriteriaBar({ label, value, max = 10 }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="criteria-row">
      <span className="criteria-row__label">{label}</span>
      <div className="bar">
        <div className="bar__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="criteria-row__score">{formatScore(value)}</span>
    </div>
  )
}
