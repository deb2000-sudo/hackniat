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

  /** Evaluator registrations awaiting approval. */
  getPendingEvaluators: (options) => api.get('/admin/evaluators/pending', options),

  /** All evaluator accounts. */
  getEvaluators: (options) => api.get('/admin/evaluators', options),

  /** Approved evaluators available for submission assignment. */
  getApprovedEvaluators: (options) =>
    api.get('/admin/evaluators?approval_status=approved', options),

  /** Approve a pending evaluator. */
  approveEvaluator: (userId, options) =>
    api.post(`/admin/evaluators/${userId}/approve`, undefined, options),

  /** Fetch a single user's details. */
  getUser: (userId, options) => api.get(`/admin/user/${userId}`, options),

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
