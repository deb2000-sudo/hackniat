import { formatDate } from '../../utils/format'

/**
 * Presentation for a round's lifecycle.
 *
 * `round_status` from the backend is authoritative. Rounds saved before it
 * existed fall back to a date comparison so old hackathons still read sensibly.
 */
const LABELS = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  open: 'Open now',
  closed: 'Closed',
}

const TONES = {
  draft: 'border-hairline bg-raised text-muted',
  scheduled: 'border-hairline bg-raised text-ink',
  open: 'border-volt-edge bg-volt-tint text-volt-ink',
  closed: 'border-hairline bg-raised text-muted',
}

/** Derive a status key when the backend did not send one. */
function inferStatus(round) {
  const today = new Date().toISOString().slice(0, 10)
  if (round?.start_date && today < round.start_date) return 'scheduled'
  if (round?.end_date && today > round.end_date) return 'closed'
  return 'open'
}

export function roundStatusKey(round) {
  return round?.round_status || inferStatus(round)
}

export function roundStatusBadge(round) {
  const key = roundStatusKey(round)
  return { key, label: LABELS[key] || key, tone: TONES[key] || TONES.draft }
}

/**
 * One line of student-facing timing copy. Dates render in IST (see
 * APP_TIMEZONE) regardless of the viewer's browser timezone.
 */
export function roundTimingText(round) {
  const key = roundStatusKey(round)
  if (key === 'scheduled' && round?.start_date) return `Opens ${formatDate(round.start_date)} (IST)`
  if (key === 'open') return round?.end_date ? `Open now · closes ${formatDate(round.end_date)} (IST)` : 'Open now'
  if (key === 'closed') return round?.end_date ? `Closed ${formatDate(round.end_date)} (IST)` : 'Closed'
  return 'Not published yet'
}

/** Team formation is allowed before the round opens; submitting is not. */
export function canParticipateInRound(round) {
  return ['scheduled', 'open'].includes(roundStatusKey(round))
}

/** True when the round has ended. */
export function roundStatusKeyClosed(round) {
  return roundStatusKey(round) === 'closed'
}
