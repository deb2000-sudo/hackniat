import { api } from './client'

export const adminApi = {
  /** All non-admin users. */
  getUsers: () => api.get('/admin/users'),

  /** Evaluator registrations awaiting approval. */
  getPendingEvaluators: () => api.get('/admin/evaluators/pending'),

  /** All evaluator accounts. */
  getEvaluators: () => api.get('/admin/evaluators'),

  /** Approved evaluators available for submission assignment. */
  getApprovedEvaluators: () =>
    api.get('/admin/evaluators?approval_status=approved'),

  /** Approve a pending evaluator. */
  approveEvaluator: (userId) => api.post(`/admin/evaluators/${userId}/approve`),

  /** Fetch a single user's details. */
  getUser: (userId) => api.get(`/admin/user/${userId}`),

  /** Update a user's profile (name only per the API). */
  updateUser: (userId, payload) => api.patch(`/admin/user/${userId}`, payload),
}
