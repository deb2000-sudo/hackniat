import { formatScore } from '../../utils/format'
import styles from './ScoreRing.module.css'

/**
 * Circular score gauge. `value` and `max` default to a 10-point scale.
 */
export default function ScoreRing({ value = 0, max = 10, size = 120, stroke = 10 }) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const pct = Math.max(0, Math.min(1, value / max))
  const offset = circumference * (1 - pct)

  let color = 'var(--danger-500)'
  if (pct >= 0.75) color = 'var(--success-500)'
  else if (pct >= 0.5) color = 'var(--warning-500)'
  else if (pct >= 0.35) color = 'var(--brand-500)'

  return (
    <div className={styles.ring} style={{ width: size, height: size }}>
      <svg width={size} height={size}>
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
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className={styles.value}>
        <div className={styles.num}>{formatScore(value)}</div>
        <div className={styles.max}>/ {max}</div>
      </div>
    </div>
  )
}
