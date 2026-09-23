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

/** Admin-only per-round submission cap for one hackathon. */
function submissionLimitPath(hackathonId) {
  return `/hackathons/${encodeURIComponent(hackathonId)}/submission-limit`
}

/** Admin-only report auto-publishing settings for one hackathon. */
function reportPublishingPath(hackathonId) {
  return `/hackathons/${encodeURIComponent(hackathonId)}/report-publishing`
}

/** Admin-only Video Analysis prompt overrides for one hackathon. */
function promptsPath(hackathonId) {
  return `/hackathons/${encodeURIComponent(hackathonId)}/video-analysis-prompts`
}

export const hackathonsApi = {
  list: (options) => api.get('/hackathons', options),

  /**
   * Public home catalog — hackathons with at least one published round, each
   * carrying a status computed in IST at request time (open / closing_soon /
   * upcoming / closed) plus solo-or-team labels. No auth, no cookies needed.
   *
   * Deliberately not `list()`: that is the full authenticated document list,
   * it includes round-less events and it carries no status badges.
   *
   * Status is recomputed per request and there is no websocket behind it, so
   * callers that care about "closing soon" have to poll.
   */
  catalog: ({ includeClosed = true, ...options } = {}) =>
    api.get(
      includeClosed ? '/hackathons/catalog' : '/hackathons/catalog?include_closed=false',
      options,
    ),

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

  /* --------------------------- Round leaderboard -------------------------- */
  // Ranking is derived from approved evaluations only, and stays hidden from
  // students until an admin publishes that round's board.

  /**
   * Ranked standings for one round. Admins and evaluators can always read this
   * as a preview; students get 403 LEADERBOARD_NOT_PUBLISHED until publish.
   */
  roundLeaderboard: (hackathonId, roundIndex, options) =>
    api.get(`${roundPath(hackathonId, roundIndex)}/leaderboard`, options),

  /**
   * Publish or hide a round's leaderboard.
   *
   * `notify` controls the ranked-candidate emails: the backend defaults it to
   * true on a first publish and false on re-publish, so it is only sent when
   * the caller explicitly wants to mail again. Unpublishing never notifies.
   */
  publishRoundLeaderboard: (hackathonId, roundIndex, { publish = true, notify } = {}, options) =>
    api.post(
      `${roundPath(hackathonId, roundIndex)}/leaderboard/publish`,
      notify === undefined ? { publish } : { publish, notify },
      options,
    ),

  /** Leader refreshes the join code; the previous one is invalidated. */
  refreshJoinCode: (hackathonId, roundIndex, options) =>
    api.post(`${roundPath(hackathonId, roundIndex)}/teams/join-code`, undefined, options),

  /* ------------------------ Submission limit (admin) ---------------------- */
  // How many times one student or team may submit, 1–3. The cap is per round,
  // so spending round 1's attempts leaves round 2 untouched.

  submissionLimit: (hackathonId, options) =>
    api.get(submissionLimitPath(hackathonId), options),

  updateSubmissionLimit: (hackathonId, maxSubmissions, options) =>
    api.put(submissionLimitPath(hackathonId), { max_submissions: maxSubmissions }, options),

  /* ----------------------- Report publishing (admin) ---------------------- */
  // Approval and publishing are separate: approving records the decision,
  // publishing is what students can actually see. With auto-publish on, an
  // approval releases the report straight away.

  /** Auto-publish state plus approved / hidden / published counts. */
  reportPublishing: (hackathonId, options) =>
    api.get(`${reportPublishingPath(hackathonId)}`, options),

  /**
   * Flip auto-publishing. Turning it ON releases every approved-but-hidden
   * report in the same request — the response's `published_now_count` says how
   * many — and turning it off leaves already-visible reports alone.
   */
  updateReportPublishing: (hackathonId, autoPublishReports, options) =>
    api.put(
      reportPublishingPath(hackathonId),
      { auto_publish_reports: autoPublishReports },
      options,
    ),

  /* --------------------- Video Analysis prompts (admin) ------------------- */
  // Per-hackathon copies of the Application → Video Analysis templates. A
  // hackathon runs on the global prompts until an admin saves one here, so
  // these endpoints — never /ai-evaluation-prompts — are what the hackathon
  // Settings page writes to.
  //
  // All three return the same payload: every prompt with its effective
  // `template`, the `global_template` a reset restores, and `is_overridden`.

  /** Both prompts for one hackathon, each resolved to what evaluation will use. */
  videoAnalysisPrompts: (hackathonId, options) =>
    api.get(promptsPath(hackathonId), options),

  /** Save one or both prompts. `prompts` is `[{ key, template }]`. */
  saveVideoAnalysisPrompts: (hackathonId, prompts, options) =>
    api.put(promptsPath(hackathonId), { prompts }, options),

  /** Drop one override (`checklist` / `analyze_video`) back to the global template. */
  resetVideoAnalysisPrompt: (hackathonId, key, options) =>
    api.delete(`${promptsPath(hackathonId)}/${encodeURIComponent(key)}`, options),
}
