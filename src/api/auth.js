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

  /** Log in; backend sets an HttpOnly session cookie and returns csrf_token. */
  login: (payload) => api.post('/auth/login', payload),

  /**
   * CSRF token for cross-origin clients (Vercel → Cloud Run).
   * document.cookie cannot read the API-domain csrf_token cookie.
   */
  csrf: (options) => api.get('/auth/csrf', options),

  /** Clear the session cookie. */
  logout: () => api.post('/auth/logout'),

  /** Change the authenticated user's password; the backend clears the session cookie. */
  changePassword: (payload) => api.post('/auth/change-password', payload),

  /** Fetch the currently authenticated user's profile. */
  me: (options) => api.get('/auth/me', options),
}
