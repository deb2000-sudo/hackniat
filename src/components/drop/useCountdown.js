import { useEffect, useState } from 'react'

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const pad = (n) => String(n).padStart(2, '0')

/**
 * Formats a remaining duration with the precision that actually matters at
 * that range: days out you don't care about seconds, in the last hour you do.
 *   3 days  -> "02d 11h 24m"
 *   9 hours -> "09h 15m"
 *   40 min  -> "47m 12s"
 */
export function formatRemaining(ms) {
  if (ms <= 0) return 'closed'

  const days = Math.floor(ms / DAY)
  const hours = Math.floor((ms % DAY) / HOUR)
  const minutes = Math.floor((ms % HOUR) / MINUTE)
  const seconds = Math.floor((ms % MINUTE) / SECOND)

  if (days > 0) return `${pad(days)}d ${pad(hours)}h ${pad(minutes)}m`
  if (hours > 0) return `${pad(hours)}h ${pad(minutes)}m`
  return `${pad(minutes)}m ${pad(seconds)}s`
}

/** Human-readable equivalent for screen readers and <time datetime>. */
export function describeRemaining(ms) {
  if (ms <= 0) return 'Submissions closed'

  const days = Math.floor(ms / DAY)
  const hours = Math.floor((ms % DAY) / HOUR)
  const minutes = Math.floor((ms % HOUR) / MINUTE)

  const parts = []
  if (days) parts.push(`${days} day${days === 1 ? '' : 's'}`)
  if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`)
  if (minutes && !days) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`)
  return `${parts.join(' ')} left`
}

/**
 * A single shared clock, ticking once a second.
 *
 * The board drives every card's countdown off one interval so six cards don't
 * mean six timers — and so the parent can filter on "closing soon".
 */
export function useNow(intervalMs = SECOND) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}

/**
 * Time left against a fixed deadline, derived from the shared clock rather
 * than mirrored into state — one source of truth, no resync effect.
 *
 * The countdown is information rather than decoration, so it keeps running
 * under prefers-reduced-motion — that setting suppresses movement, not clocks.
 */
export function useCountdown(deadline) {
  const now = useNow()
  return Math.max(0, deadline - now)
}

export { DAY, HOUR }
