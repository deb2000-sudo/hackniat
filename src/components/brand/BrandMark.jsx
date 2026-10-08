import './brand-mark.css'

/**
 * The Challazo mark: a rounded tile and a lime glyph.
 *
 * `variant="arrow"` is the signed-out mark — a "drop" arrow that falls
 * through the tile on a loop while the ring sweeps. `variant="c"` is the
 * signed-in mark — a C drawn as a stroked arc (not a font glyph) with a dot
 * in its opening, so it stays crisp at any size and never waits on a font.
 */
export default function BrandMark({
  variant = 'c',
  size = 32,
  animated = true,
  onDark = false,
  className = '',
  title,
}) {
  const classes = [
    'czm',
    variant === 'arrow' ? 'is-arrow' : 'is-c',
    animated && 'is-animated',
    onDark && 'is-on-dark',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <svg
      className={classes}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect className="czm-tile" width="40" height="40" rx="12" />
      {variant === 'arrow' ? (
        <>
          <circle className="czm-ring" cx="20" cy="20" r="13" fill="none" strokeWidth="1.6" />
          <circle className="czm-sweep" cx="20" cy="20" r="13" fill="none" strokeWidth="1.6" strokeLinecap="round" />
          <g className="czm-glyph czm-arrow" fill="none" strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 12.5 V25" />
            <path d="M14.6 19.8 L20 25.4 L25.4 19.8" />
          </g>
        </>
      ) : (
        // No ring here: a C inside a circle reads as ©. A 9-unit arc open 45°
        // either side of 3 o'clock, with the "drop" as a dot in the opening.
        <>
          <path
            className="czm-glyph czm-c"
            d="M25.36 13.64 A9 9 0 1 0 25.36 26.36"
            fill="none"
            strokeWidth="4.2"
            strokeLinecap="round"
          />
          <circle className="czm-dot" cx="28.2" cy="20" r="2.4" />
        </>
      )}
    </svg>
  )
}

/** Mark + "Challazo" set in the display face. */
export function BrandLockup({ variant = 'c', size = 30, fontSize = 21, onDark = false, animated = true }) {
  return (
    <>
      <BrandMark variant={variant} size={size} onDark={onDark} animated={animated} />
      <span className="czm-wordmark" style={{ fontSize }}>
        Challazo
      </span>
    </>
  )
}
