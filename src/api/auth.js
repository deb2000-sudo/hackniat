import { api } from './client'

export const authApi = {
  registerStart: (payload) => api.post('/auth/register/start', payload),
  sendEmailOtp: (payload) => api.post('/auth/email/send-otp', payload),
  verifyEmailOtp: (payload) => api.post('/auth/email/verify-otp', payload),
  verifyPhoneToken: (payload) => api.post('/auth/verify-phone-token', payload),
  registerComplete: (payload) => api.post('/auth/register/complete', payload),

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
