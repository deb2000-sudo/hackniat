/**
 * Round team-size rules for the hackathon form: the three modes, mapping a
 * saved round to form fields and back, the hint under the control, and the
 * API's own validation wording.
 */

// Who may take part in a round. `multi` carries a minimum and maximum (2–6,
// equal for an exact size); `open` has no cap at all. team_size_mode is always
// sent: sizes alone are ambiguous to the API.
export const TEAM_SIZE_MODES = [
  { value: 'single', label: 'Single person' },
  { value: 'multi', label: 'More than one person' },
  { value: 'open', label: 'No fixed team size' },
]
export const TEAM_MIN = 2
export const TEAM_MAX = 6
/** 2, 3, 4, 5, 6 — the sizes a multi round can use. */
export const TEAM_SIZES = Array.from({ length: TEAM_MAX - TEAM_MIN + 1 }, (_, i) => TEAM_MIN + i)
/** What switching into "More than one person" starts from: the old team round. */
export const DEFAULT_MULTI = { min_team_size: '2', max_team_size: '5' }

/**
 * The form's team fields for a saved round. A missing max_team_size means "no
 * fixed size" only when the mode says open (or the mode is missing and it is
 * not a single-person round); a missing mode with max 1 stays Single person.
 * An older team round never re-saved arrives as multi 2–5.
 */
export function teamSizeFromRound(round) {
  if (
    round.team_size_mode === 'open' ||
    (round.max_team_size == null && round.team_size_mode && round.team_size_mode !== 'single')
  ) {
    return { team_size_mode: 'open', min_team_size: '1', max_team_size: '' }
  }
  if (round.team_size_mode === 'multi' || Number(round.max_team_size) > 1) {
    return {
      team_size_mode: 'multi',
      min_team_size: String(round.min_team_size || 2),
      max_team_size: String(round.max_team_size || 5),
    }
  }
  return { team_size_mode: 'single', min_team_size: '1', max_team_size: '1' }
}

/** The team fields to send for one round. */
export function teamSizePayload(round) {
  if (round.team_size_mode === 'multi') {
    return {
      team_size_mode: 'multi',
      min_team_size: Number(round.min_team_size),
      max_team_size: Number(round.max_team_size),
    }
  }
  if (round.team_size_mode === 'open') {
    return { team_size_mode: 'open', min_team_size: 1, max_team_size: null }
  }
  return { team_size_mode: 'single', min_team_size: 1, max_team_size: 1 }
}

/** The hint under a round's team size, worded for its current choice. */
export function teamSizeHint(round) {
  if (round.team_size_mode === 'open') {
    return 'A student can submit alone, or any number of students can form a team.'
  }
  if (round.team_size_mode === 'multi') {
    const min = Number(round.min_team_size)
    const max = Number(round.max_team_size)
    if (min === max) return `Only a team of exactly ${min} can take part.`
    return `A team can have ${min} to ${max} members, including the leader. The leader can submit once the team is inside that range.`
  }
  return 'Only one student can submit for this round.'
}

/**
 * The API's own wording for an invalid multi round, so a rejection from the
 * server and a check here read the same.
 */
export function teamSizeError(round) {
  if (round.team_size_mode !== 'multi') return ''
  const min = Number(round.min_team_size)
  const max = Number(round.max_team_size)
  if (!Number.isInteger(min) || min < TEAM_MIN || min > TEAM_MAX) {
    return 'Minimum participants must be from 2 to 6'
  }
  if (!Number.isInteger(max) || max < TEAM_MIN || max > TEAM_MAX) {
    return 'Maximum participants must be from 2 to 6'
  }
  if (min > max) return 'Minimum participants cannot be greater than the maximum'
  return ''
}

/**
 * Round-level errors from a FastAPI validation response — a detail entry whose
 * loc names timeline, a round index and one of the team-size fields — keyed
 * the way this form keys its own errors. Empty when the error names no round.
 */
export function roundTeamSizeErrors(err) {
  const detail = err?.data?.detail
  if (!Array.isArray(detail)) return {}
  const errors = {}
  detail.forEach((entry) => {
    const loc = Array.isArray(entry?.loc) ? entry.loc : []
    const at = loc.indexOf('timeline')
    const index = at === -1 ? NaN : Number(loc[at + 1])
    const field = loc[loc.length - 1]
    if (
      Number.isInteger(index) &&
      ['team_size_mode', 'min_team_size', 'max_team_size'].includes(field)
    ) {
      errors[`timeline.${index}.team_size`] = String(entry.msg || '').replace(/^Value error, /, '')
    }
  })
  return errors
}
