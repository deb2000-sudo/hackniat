import { nowInAppTimezone, scheduleStatus } from './schedule'

/**
 * Where a hackathon stands now, by its IST date and clock (start minute to end
 * minute inclusive; no saved time means the whole day) — the same rule that
 * decides whether a student can submit.
 */
export function getHackathonStatus(hackathon, now = new Date()) {
  const status = scheduleStatus(hackathon, nowInAppTimezone(now))
  if (status === 'scheduled') return { key: 'upcoming', label: 'Upcoming', variant: 'info' }
  if (status === 'closed') return { key: 'past', label: 'Completed', variant: 'neutral' }
  return { key: 'live', label: 'Live now', variant: 'success' }
}

export function getHackathonDuration(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  const days = Math.round((end - start) / 86400000) + 1
  return Number.isFinite(days) && days > 0 ? days : null
}

/**
 * A round's (or participation payload's) team rule: 'single', 'multi' or
 * 'open'. Read from team_size_mode; an older payload without it is single at
 * max 1, open with no max, and a sized team otherwise.
 */
export function teamSizeMode(source) {
  if (!source) return 'single'
  if (source.team_size_mode) return source.team_size_mode
  if (source.max_team_size == null) return 'open'
  return Number(source.max_team_size) === 1 ? 'single' : 'multi'
}

/**
 * Label for a round's team rule when the API sent no team_mode_label:
 * "Single person", "3 members", "2-6 members" or "No fixed team size". An open
 * round has max_team_size null, which must never read as a one-person round.
 */
export function teamModeFallbackLabel(round) {
  if (!round) return ''
  if (round.team_size_mode === 'single') return 'Single person'
  if (round.team_size_mode === 'open' || round.max_team_size == null) return 'No fixed team size'
  if (Number(round.max_team_size) > 1) {
    return Number(round.min_team_size) === Number(round.max_team_size)
      ? `${round.max_team_size} members`
      : `${round.min_team_size || 2}-${round.max_team_size} members`
  }
  return 'Single person'
}
