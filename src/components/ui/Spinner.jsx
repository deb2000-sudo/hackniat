export default function Spinner({ size, onBrand = false, className = '' }) {
  const classes = [
    'spinner',
    size ? `spinner--${size}` : '',
    onBrand ? 'spinner--on-brand' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return <span className={classes} role="status" aria-label="Loading" />
}

/** Full-block loading state with an optional label. */
export function LoadingBlock({ label = 'Loading…' }) {
  return (
    <div className="loader-block">
      <Spinner size="lg" />
      <span>{label}</span>
    </div>
  )
}
