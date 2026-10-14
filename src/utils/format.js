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

/** Best display name for an account row: name, then first + last, then email. */
export function accountName(account, fallback = 'this account') {
  return (
    account?.name ||
    [account?.first_name, account?.last_name].filter(Boolean).join(' ') ||
    account?.email ||
    fallback
  )
}

/** Where a mobile number may live on a user record, most likely first. */
export const MOBILE_KEYS = ['mobile_no', 'mobile_number', 'phone_number', 'mobile', 'phone']

const isBlankValue = (value) => value === undefined || value === null || String(value).trim() === ''
const firstFilled = (...values) => values.find((value) => !isBlankValue(value))

/** "+919640198259" → "+91 96401 98259". Other countries are left as entered. */
export function formatMobile(value) {
  const raw = String(value || '').replace(/\s+/g, '')
  const india = raw.match(/^\+91(\d{5})(\d{5})$/)
  return india ? `+91 ${india[1]} ${india[2]}` : String(value || '')
}

/** The account's mobile number, whichever key the endpoint used for it. */
export function mobileOf(user) {
  return firstFilled(...MOBILE_KEYS.map((key) => user?.[key]))
}

/** A student's university label, from the object or the flat fields. */
export function universityOf(user) {
  const university = user?.university
  if (university && typeof university === 'object') {
    return firstFilled(university.display_label, university.name)
  }
  return firstFilled(user?.university_name, university)
}

/** Shortest run of digits treated as part of a mobile number. */
const MIN_PHONE_DIGITS = 4

/**
 * What the search box sends. A mobile number is typed many ways ("+91 96401
 * 98259", "96401-98259", "9640198259"), so anything that looks like one is
 * sent as its digits only — "919640198259" and "9640198259" both sit inside
 * the stored "+919640198259". Everything else is sent as typed.
 */
export function normalizeSearch(raw) {
  const text = String(raw || '').trim()
  const digits = text.replace(/\D/g, '')
  const looksLikePhone = /^\+?[\d\s().-]+$/.test(text) && digits.length >= MIN_PHONE_DIGITS
  return looksLikePhone ? digits : text
}
