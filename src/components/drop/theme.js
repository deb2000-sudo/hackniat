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

/** Page gutter + max width (landing / marketing). */
export const WRAP = 'mx-auto w-full max-w-[1180px] px-5'

/** Wider content column for authenticated app pages beside the sidebar. */
export const WRAP_APP = 'mx-auto w-full max-w-[1480px] px-5 md:px-8'

/** Narrow reading width for forms and detail flows. */
export const WRAP_NARROW = 'mx-auto w-full max-w-[760px] px-5 md:px-8'

const BTN_BASE =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-drop border px-[22px] text-[15px] leading-none transition-colors'

/** Primary action. At most one per screen. */
export const BTN_VOLT = `${BTN_BASE} border-transparent bg-volt font-semibold text-on-volt hover:bg-volt-deep`

/** Secondary action — hairline border, no fill. */
export const BTN_GHOST = `${BTN_BASE} border-hairline font-medium text-ink hover:border-muted/50 hover:bg-raised`

/** For use on the volt CTA band, where a volt button would vanish. */
export const BTN_DARK = `${BTN_BASE} border-transparent bg-canvas font-semibold text-ink hover:bg-raised focus-visible:outline-on-volt`

export const BTN = BTN_BASE

/** Flat panel: hairline border, 10px radius, no shadow. */
export const PANEL = 'rounded-drop border border-hairline bg-surface'

/** Label type — Geist (dark) / JetBrains Mono (light) via --font-label. */
export const EYEBROW =
  'block font-label text-xs font-medium tracking-[0.12em] text-muted uppercase'

/** Status pills. State colours are for status only — never decoration. */
const PILL_BASE =
  'inline-flex items-center gap-[9px] rounded-full border px-3.5 py-[7px] text-[13px] font-medium'

export const PILL_VOLT = `${PILL_BASE} border-volt-edge bg-volt-tint text-volt-ink`

/**
 * The same pill with nothing to claim — a count of zero, or a figure that
 * hasn't loaded. Volt is reserved for something actually being live, so these
 * are a separate recipe rather than overrides tacked onto PILL_VOLT (Tailwind
 * resolves conflicts by stylesheet order, not by class-string order).
 */
export const PILL_MUTED = `${PILL_BASE} border-hairline bg-raised text-muted`

export const BADGE = 'shrink-0 rounded-full border px-2.5 py-[5px] text-[11.5px] font-medium whitespace-nowrap'
export const BADGE_OPEN = 'border-volt-edge bg-volt-tint text-volt-ink'
export const BADGE_CLOSING =
  'border-[color-mix(in_srgb,var(--color-warn)_38%,transparent)] bg-[var(--drop-warning-soft)] text-warn'

/** Not a state colour — an event that hasn't started can't be urgent. */
export const BADGE_UPCOMING = 'border-hairline bg-raised text-ink'

/** Facts that aren't a status: team mode, counts, themes. */
export const BADGE_NEUTRAL = 'border-hairline bg-raised text-muted'
export const BADGE_CLOSED = BADGE_NEUTRAL

/** Numbers are always monospace and tabular. */
export const MONO = 'font-mono tabular-nums'

/**
 * Inline text link. `.drop a` inherits colour by default, which is right for
 * nav and buttons but leaves a link inside a sentence invisible — these need
 * an explicit affordance.
 */
export const LINK_INLINE =
  'font-medium text-ink underline decoration-hairline underline-offset-4 transition-colors hover:text-volt-ink hover:decoration-volt-ink'
