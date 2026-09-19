import { APP_TIMEZONE, formatDate } from '../../utils/format'

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

/**
 * Today in the app's timezone as YYYY-MM-DD.
 *
 * Round dates are plain calendar dates entered in IST, so they must be compared
 * against an IST "today". toISOString() gives UTC, which is the previous day for
 * the first 5.5 hours of every IST day — long enough for a round to look
 * unopened on the morning it starts.
 */
function todayInAppTimezone() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** Status implied purely by the round's own dates. */
function inferStatus(round) {
  const today = todayInAppTimezone()
  if (round?.start_date && today < round.start_date) return 'scheduled'
  if (round?.end_date && today > round.end_date) return 'closed'
  return 'open'
}

/**
 * The round's lifecycle state.
 *
 * The schedule wins whenever the round carries dates: a stored `round_status`
 * is written once and then goes stale, so a round would still read "draft" on
 * the morning its start date arrived. Flags are only consulted for rounds that
 * carry no dates at all.
 */
export function roundStatusKey(round) {
  if (round?.start_date || round?.end_date) return inferStatus(round)
  return round?.round_status || 'draft'
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

/** Copy for a round the schedule says is open but the backend has not released. */
export function roundPendingReleaseText(round) {
  return round?.end_date
    ? `It is scheduled to run until ${formatDate(round.end_date)} (IST). Ask an admin to publish it.`
    : 'Ask an admin to publish this round.'
}

/** True when the round has ended. */
export function roundStatusKeyClosed(round) {
  return roundStatusKey(round) === 'closed'
}

/**
 * A round the admin has not released yet.
 *
 * Checked against `published` explicitly rather than through roundStatusKey:
 * an unpublished round can still carry a future start_date, which inferStatus
 * reads as "scheduled" — so status alone would call it open for business.
 */
export function isRoundAwaitingRelease(round) {
  if (!round) return false
  // The calendar decides. A round whose start date has arrived counts as open
  // even if the stored `published` flag has not caught up with it.
  if (round.start_date) return todayInAppTimezone() < round.start_date
  if (round.published === false) return true
  return roundStatusKey(round) === 'draft'
}

/** Inside its scheduled window right now, so submissions should be possible. */
export function isRoundLive(round) {
  if (!round?.start_date) return false
  return inferStatus(round) === 'open'
}

/**
 * When a round students cannot enter yet will open. The start date lives on the
 * round even while it is unpublished, so answer "when" rather than just "no".
 */
export function roundOpensText(round) {
  if (round?.start_date) return `Goes live on ${formatDate(round.start_date)} (IST).`
  return 'The opening date has not been announced yet.'
}

/** "Round 3", or the round's own title when it has one. */
export function roundDisplayName(round, roundIndex = 0) {
  return round?.title?.trim() || `Round ${Number(roundIndex) + 1}`
}
