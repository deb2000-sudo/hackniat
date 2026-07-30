/**
 * Drop loading indicator.
 *
 * Dual-ring spinner: outer hairline track, inner volt arc. Used in buttons,
 * page blocks, and route fallbacks — keep the mark identical everywhere.
 */
export default function Spinner({ size = 'md', onBrand = false, className = '' }) {
  const classes = [
    'drop-spinner',
    `drop-spinner--${size}`,
    onBrand ? 'drop-spinner--on-brand' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={classes} role="status" aria-label="Loading">
      <span className="drop-spinner__track" aria-hidden="true" />
      <span className="drop-spinner__arc" aria-hidden="true" />
    </span>
  )
}

/** Full-block loading state with an optional label. */
export function LoadingBlock({ label = 'Loading…' }) {
  return (
    <div className="drop-loader" role="status" aria-live="polite">
      <div className="drop-loader__mark">
        <Spinner size="lg" />
      </div>
      <p className="drop-loader__label">{label}</p>
    </div>
  )
}
