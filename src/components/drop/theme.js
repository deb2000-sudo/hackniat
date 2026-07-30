/**
 * Drop — shared class recipes.
 *
 * Import these instead of re-typing the utility strings, so a button on the
 * landing page and a button in the auth shell can't drift apart. Pair with the
 * `.drop` wrapper (see styles/drop-theme.css) which supplies the dark surface
 * and re-skins the shared index.css primitives.
 *
 * Colour discipline: volt marks at most three things per screen — the primary
 * action, the live countdown, and one accent detail. Everything else is grey.
 */

/** Page gutter + max width. */
export const WRAP = 'mx-auto w-full max-w-[1180px] px-5'

const BTN_BASE =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-drop border px-[22px] text-[15px] leading-none transition-colors'

/** Primary action. At most one per screen. */
export const BTN_VOLT = `${BTN_BASE} border-transparent bg-volt font-semibold text-on-volt hover:bg-volt-deep`

/** Secondary action — hairline border, no fill. */
export const BTN_GHOST = `${BTN_BASE} border-hairline font-medium text-ink hover:border-[#3A3A44] hover:bg-surface`

/** For use on the volt CTA band, where a volt button would vanish. */
export const BTN_DARK = `${BTN_BASE} border-transparent bg-canvas font-semibold text-ink hover:bg-raised focus-visible:outline-on-volt`

export const BTN = BTN_BASE

/** Flat panel: hairline border, 10px radius, no shadow. */
export const PANEL = 'rounded-drop border border-hairline bg-surface'

/** Monospace, uppercase, tracked-out section label. */
export const EYEBROW =
  'block font-mono text-xs font-medium tracking-[0.12em] text-muted uppercase'

/** Status pills. State colours are for status only — never decoration. */
export const PILL_VOLT =
  'inline-flex items-center gap-[9px] rounded-full border border-volt-edge bg-volt-tint px-3.5 py-[7px] text-[13px] font-medium text-volt'

export const BADGE = 'shrink-0 rounded-full border px-2.5 py-[5px] text-[11.5px] font-medium whitespace-nowrap'
export const BADGE_OPEN = 'border-volt-edge bg-volt-tint text-volt'
export const BADGE_CLOSING = 'border-[#4A3308] bg-[#2A1E05] text-warn'
export const BADGE_CLOSED = 'border-hairline bg-raised text-muted'

/** Numbers are always monospace and tabular. */
export const MONO = 'font-mono tabular-nums'

/**
 * Inline text link. `.drop a` inherits colour by default, which is right for
 * nav and buttons but leaves a link inside a sentence invisible — these need
 * an explicit affordance.
 */
export const LINK_INLINE =
  'font-medium text-ink underline decoration-hairline underline-offset-4 transition-colors hover:text-volt hover:decoration-volt'
