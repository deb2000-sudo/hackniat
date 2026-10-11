import { api } from './client'

export const adminApi = {
  /**
   * All non-admin users, as a plain array. The dashboard and the prefetch
   * count `users.length`, so this stays unpaged.
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
   * Overview's three lists, each settled on its own: one rejected list (a 403
   * for a role without that permission, or any other failure) costs only that
   * list. A failed or malformed list comes back as `null` so its card can be
   * hidden; this never throws.
   */
  loadOverview: async (options) => {
    const results = await Promise.allSettled([
      adminApi.getUsers(options),
      adminApi.getEvaluators(options),
      adminApi.getPendingEvaluators(options),
    ])
    const [users, evaluators, pending] = results.map((result) =>
      result.status === 'fulfilled' && Array.isArray(result.value) ? result.value : null,
    )
    return { users, evaluators, pending }
  },

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

  /** Application settings (profile password + wipeable collections). */
  getSettings: (options) => api.get('/admin/settings', options),

  /** Change the Profile Password used for destructive admin actions. */
  changeProfilePassword: (payload, options) =>
    api.post('/admin/settings/change-profile-password', payload, options),

  /** Wipe wipeable collections after Profile Password + confirm phrase. */
  resetDatabase: (payload, options) =>
    api.post('/admin/settings/reset-database', payload, options),
}
