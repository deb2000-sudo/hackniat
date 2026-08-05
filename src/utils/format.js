/** Platform timezone — API datetimes are serialized with +05:30 (Asia/Kolkata). */
export const APP_TIMEZONE = 'Asia/Kolkata'

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

/** Parse an API ISO datetime (with offset) or return null. */
function parseApiInstant(value) {
  if (value == null || value === '') return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

/**
 * Format an API datetime in IST regardless of the viewer's browser timezone.
 * Accepts values like `2026-08-05T17:30:00+05:30`.
 */
export function formatDateTime(value, options = {}) {
  const date = parseApiInstant(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat(undefined, {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }).format(date)
}

/**
 * Format a calendar date (YYYY-MM-DD) or API datetime.
 * Hackathon start/end dates are calendar-only — not shifted by timezone.
 */
export function formatDate(value) {
  if (!value) return '—'
  const raw = String(value)
  const dateOnly = raw.match(DATE_ONLY)
  if (dateOnly) {
    const date = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    if (Number.isNaN(date.getTime())) return '—'
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date)
  }

  const date = parseApiInstant(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat(undefined, {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

/** Human-readable file size. */
export function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`
}

/** Initials from a full name, e.g. "Ada Lovelace" -> "AL". */
export function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Format seconds as mm:ss. */
export function formatDuration(totalSeconds) {
  const secs = Math.max(0, Math.floor(totalSeconds || 0))
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Round a score to at most one decimal place. */
export function formatScore(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return Math.round(Number(value) * 10) / 10
}
