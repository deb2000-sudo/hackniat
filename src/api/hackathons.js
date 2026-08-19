import { api, request } from './client'

const JSON_FIELDS = new Set(['prizes', 'timeline', 'theme_ids'])

function toFormData(fields) {
  const formData = new FormData()
  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    if (JSON_FIELDS.has(key)) {
      formData.append(key, JSON.stringify(value))
    } else {
      formData.append(key, value)
    }
  })
  return formData
}

/** Round-scoped base path. `roundIndex` is 0-based. */
function roundPath(hackathonId, roundIndex) {
  return `/hackathons/${encodeURIComponent(hackathonId)}/rounds/${Number(roundIndex) || 0}`
}

export const hackathonsApi = {
  list: (options) => api.get('/hackathons', options),
  get: (hackathonId, options) =>
    api.get(`/hackathons/${encodeURIComponent(hackathonId)}`, options),
  listThemes: (hackathonId, options) =>
    api.get(`/hackathons/${encodeURIComponent(hackathonId)}/themes`, options),
  create: (fields, options) => api.upload('/hackathons', toFormData(fields), options),
  update: (hackathonId, fields, options) =>
    request(
      `/hackathons/${encodeURIComponent(hackathonId)}`,
      { ...options, method: 'PATCH', formData: toFormData(fields) },
    ),
  delete: (hackathonId, options) =>
    api.delete(`/hackathons/${encodeURIComponent(hackathonId)}`, options),

  /* ---------------------- Participation / teams (per round) --------------- */
  // Enrollment is scoped to a timeline round: a student can be solo in one
  // round and a team member in another, so every call carries roundIndex.

  /** Current enrollment state for this student in one round, plus UI hints. */
  participation: (hackathonId, roundIndex, options) =>
    api.get(`${roundPath(hackathonId, roundIndex)}/participation`, options),

  /** Enroll solo. Solo rounds only (max_team_size === 1). */
  enrollSolo: (hackathonId, roundIndex, options) =>
    api.post(`${roundPath(hackathonId, roundIndex)}/enroll/solo`, undefined, options),

  /**
   * Leader creates the team and receives the first join code.
   * `teamName` is required: 1–100 characters after trimming.
   */
  createTeam: (hackathonId, roundIndex, teamName, options) =>
    api.post(
      `${roundPath(hackathonId, roundIndex)}/teams/create`,
      { team_name: String(teamName || '').trim() },
      options,
    ),

  /** Member joins with a 6-digit code. */
  joinTeam: (hackathonId, roundIndex, code, options) =>
    api.post(`${roundPath(hackathonId, roundIndex)}/teams/join`, { code }, options),

  /** Admin: publish a round so students can see and enroll in it. */
  publishRound: (hackathonId, roundIndex, options) =>
    api.post(`${roundPath(hackathonId, roundIndex)}/publish`, undefined, options),

  /** Leader refreshes the join code; the previous one is invalidated. */
  refreshJoinCode: (hackathonId, roundIndex, options) =>
    api.post(`${roundPath(hackathonId, roundIndex)}/teams/join-code`, undefined, options),
}
