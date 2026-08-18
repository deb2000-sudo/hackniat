/**
 * Drop loading indicator.
 *
 * Dual-ring spinner: outer hairline track, inner volt arc. Used in buttons,
 * page blocks, and route fallbacks — keep the mark identical everywhere.
 *
 * Styling lives in Spinner.module.css (migrated out of index.css).
 */
import { useEffect, useState } from 'react'
import styles from './Spinner.module.css'

export default function Spinner({
  size = 'md',
  onBrand = false,
  percent,
  className = '',
}) {
  const classes = [
    styles.spinner,
    styles[size],
    onBrand ? styles.onBrand : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const hasPercent = typeof percent === 'number' && Number.isFinite(percent)
  const value = hasPercent ? Math.max(0, Math.min(100, Math.round(percent))) : null

  return (
    <span
      className={classes}
      role="status"
      aria-label={hasPercent ? `Loading ${value}%` : 'Loading'}
    >
      <span className={styles.track} aria-hidden="true" />
      <span className={styles.arc} data-spinner-arc aria-hidden="true" />
      {hasPercent && <span className={styles.value}>{value}%</span>}
    </span>
  )
}

/**
 * Centred, label-free loading state: a single spinner with a live percentage
 * inside the ring.
 *
 * There is no real progress signal behind most of these loads, so the counter
 * eases toward 95% and stops — it reads as progress without ever claiming the
 * work finished. Pass `percent` when a caller does know the real figure.
 *
 * `label` is kept for the accessible name only; it is no longer rendered.
 */
export function LoadingBlock({ label = 'Loading…', percent }) {
  const isDriven = typeof percent === 'number' && Number.isFinite(percent)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (isDriven) return undefined

    const id = setInterval(() => {
      setProgress((current) =>
        current >= 95 ? current : current + Math.max(1, Math.round((95 - current) * 0.12)),
      )
    }, 140)

    return () => clearInterval(id)
  }, [isDriven])

  return (
    <div className={styles.loader} role="status" aria-live="polite" aria-label={label}>
      <Spinner size="xl" percent={isDriven ? percent : progress} />
    </div>
  )
}
