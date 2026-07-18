import { api } from './client'

export const authApi = {
  /** Register a new student account. */
  registerStudent: (payload) =>
    api.post('/auth/register/student', {
      ...payload,
      team_member_3_name: payload.team_member_3_name.trim() || null,
      team_member_3_email: payload.team_member_3_email.trim() || null,
      team_member_4_name: payload.team_member_4_name.trim() || null,
      team_member_4_email: payload.team_member_4_email.trim() || null,
    }),

  /** Register a new evaluator account (pending admin approval). */
  registerEvaluator: (payload) => api.post('/auth/register/evaluator', payload),

  /** Log in; backend sets an HttpOnly session cookie on success. */
  login: (payload) => api.post('/auth/login', payload),

  /** Clear the session cookie. */
  logout: () => api.post('/auth/logout'),

  /** Fetch the currently authenticated user's profile. */
  me: (options) => api.get('/auth/me', options),
}
