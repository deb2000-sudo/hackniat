import { useId } from 'react'
import { formatScore } from '../../utils/format'

/**
 * Circular score gauge. `max` defaults to a 10-point scale. `value` is left
 * unset (not defaulted to 0) so a missing/unknown score can be told apart
 * from a genuine score of zero.
 */
export default function ScoreRing({ value, max = 10, size = 120, stroke = 10 }) {
  const gradientId = useId()
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const hasScore = typeof value === 'number' && Number.isFinite(value)
  const pct = hasScore ? Math.max(0, Math.min(1, value / max)) : 0
  const offset = circumference * (1 - pct)

  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--brand-500)" />
            <stop offset="100%" stopColor="var(--accent-500)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={hasScore ? `url(#${gradientId})` : 'transparent'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="score-ring__value">
        {hasScore ? (
          <>
            <div className="score-ring__num">{formatScore(value)}</div>
            <div className="score-ring__max">/ {max}</div>
          </>
        ) : (
          <div className="score-ring__num score-ring__num--empty">N/A</div>
        )}
      </div>
    </div>
  )
}
