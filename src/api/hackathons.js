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

  /* ------------------------- Creation drafts ------------------------------ */
  // A hackathon is built up as a server-side draft: each wizard section PATCHes
  // its own fields, so a half-finished event survives a reload or a change of
  // machine. Strict validation only runs on publish, so partial payloads are
  // expected here.

  /** Every unpublished draft, newest activity first. */
  listDrafts: (options) => api.get('/hackathons/drafts', options),

  /** Open a blank draft and return its id. */
  createDraft: (options) => api.post('/hackathons/drafts', undefined, options),

  getDraft: (draftId, options) =>
    api.get(`/hackathons/drafts/${encodeURIComponent(draftId)}`, options),

  /** Merge one section's fields, plus the wizard's own position markers. */
  patchDraft: (draftId, patch, options) =>
    api.patch(`/hackathons/drafts/${encodeURIComponent(draftId)}`, patch, options),

  /** Banner is multipart, so it cannot ride along with the JSON patch. */
  uploadDraftBanner: (draftId, file, options) => {
    const formData = new FormData()
    formData.append('banner', file)
    return api.upload(
      `/hackathons/drafts/${encodeURIComponent(draftId)}/banner`,
      formData,
      options,
    )
  },

  /** Validate everything and turn the draft into a real hackathon. */
  publishDraft: (draftId, options) =>
    api.post(`/hackathons/drafts/${encodeURIComponent(draftId)}/publish`, undefined, options),

  deleteDraft: (draftId, options) =>
    api.delete(`/hackathons/drafts/${encodeURIComponent(draftId)}`, options),

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
