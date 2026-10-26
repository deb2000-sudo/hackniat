import { api } from './client'

export const adminApi = {
  /**
   * All non-admin users, as a plain array. Overview uses GET /admin/overview
   * for its counts, so this stays for any caller that still wants the full list.
   */
  getUsers: (options) => api.get('/admin/users', options),

  /**
   * One page of users: `page` (1-based), `page_size` (max 100), `role`, `q`.
   * Sending `page` makes the backend answer `{ items, total, page, page_size }`;
   * an older backend ignores the params and still returns the full array.
   * Empty values are left out of the query string.
   */
  getUsersPage: (params, options) => {
    const search = new URLSearchParams()
    Object.entries(params).forEach(([name, value]) => {
      if (value !== undefined && value !== null && value !== '') search.set(name, String(value))
    })
    return api.get(`/admin/users?${search}`, options)
  },

  /**
   * Overview counts and the newest five pending evaluators. The hackathon
   * list is still GET /hackathons. Student and evaluator management pages
   * keep their own list calls.
   */
  getOverview: (options) => api.get('/admin/overview', options),

  /** Evaluator registrations awaiting approval. */
  getPendingEvaluators: (options) => api.get('/admin/evaluators/pending', options),

  /** All evaluator accounts. */
  getEvaluators: (options) => api.get('/admin/evaluators', options),

  /** Approved evaluators available for submission assignment. */
  getApprovedEvaluators: (options) =>
    api.get('/admin/evaluators?approval_status=approved', options),

  /**
   * One evaluator's full record (mobile number included). 404
   * EVALUATOR_NOT_FOUND for a missing id or one that is not an evaluator.
   */
  getEvaluator: (userId, options) => api.get(`/admin/evaluators/${userId}`, options),

  /**
   * Super Admin only: delete an evaluator's profile and Firebase login. Their
   * assigned submissions stay and become unassigned; they are taken off every
   * hackathon's evaluator list. 409 NOT_AN_EVALUATOR, 403 for anyone else.
   */
  deleteEvaluator: (userId, options) => api.delete(`/admin/evaluators/${userId}`, options),

  /** Approve a pending evaluator. */
  approveEvaluator: (userId, options) =>
    api.post(`/admin/evaluators/${userId}/approve`, undefined, options),

  /** Fetch a single user's details. */
  getUser: (userId, options) => api.get(`/admin/user/${userId}`, options),

  /**
   * Super Admin only: delete a student's profile and Firebase login. Their
   * enrollments and team places go with them; their submissions stay.
   * 404 USER_NOT_FOUND, 409 NOT_A_STUDENT, 403 for a normal admin.
   */
  deleteUser: (userId, options) => api.delete(`/admin/user/${userId}`, options),

  /** Update a user's profile (name only per the API). */
  updateUser: (userId, payload, options) =>
    api.patch(`/admin/user/${userId}`, payload, options),

  /** Application settings (profile password + wipeable collections). Super Admin only. */
  getSettings: (options) => api.get('/super-admin/settings', options),

  /** Change the Profile Password used for destructive actions. Does not sign the user out. */
  changeProfilePassword: (payload, options) =>
    api.post('/super-admin/settings/change-profile-password', payload, options),

  /**
   * Super Admin: registration verification switches (shared by students and
   * evaluators) plus pending_count, released_count and released_now.
   */
  getRegistrationSettings: (options) =>
    api.get('/super-admin/settings/registration', options),

  /** `{ email_verification_enabled, mobile_verification_enabled }`. Same shape back. */
  updateRegistrationSettings: (payload, options) =>
    api.put('/super-admin/settings/registration', payload, options),

  /**
   * Mark the oldest `batchSize` (1–500) waiting students and evaluators to see
   * the verification popup on their next sign-in. Sends no email itself;
   * people already marked are skipped. 400 while both switches are off.
   */
  releaseVerification: (batchSize, options) =>
    api.post('/super-admin/settings/registration/release', { batch_size: batchSize }, options),

  /** Wipe wipeable collections after Profile Password + confirm phrase. */
  resetDatabase: (payload, options) =>
    api.post('/super-admin/settings/reset-database', payload, options),

  /*
   * Delete one hackathon and everything attached to it (submissions, videos,
   * AI reports, scores, teams, enrollments). Student accounts and other
   * hackathons stay. Unlike hackathonsApi.delete, which removes only the
   * hackathon document and leaves its submissions behind.
   */

  /** `[{ hackathon_id, name }]`, sorted by name. */
  listHackathonsForDeletion: (options) => api.get('/super-admin/settings/hackathons', options),

  /** What would go: `{ hackathon_id, name, submission_count, team_count, enrollment_count }`. */
  previewHackathonDeletion: (hackathonId, options) =>
    api.get(`/super-admin/settings/hackathons/${encodeURIComponent(hackathonId)}`, options),

  /**
   * Body: `{ profile_password, confirm_name }`. Answers with message and
   * deleted_counts. 400 for a wrong password or name, 404 if already gone.
   */
  deleteHackathonData: (hackathonId, payload, options) =>
    api.post(
      `/super-admin/settings/hackathons/${encodeURIComponent(hackathonId)}/delete`,
      payload,
      options,
    ),
}
