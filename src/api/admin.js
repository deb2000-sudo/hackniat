import { api } from './client'

export const adminApi = {
  /** All non-admin users. */
  getUsers: (options) => api.get('/admin/users', options),

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
}
