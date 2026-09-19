import { api } from './client'

/**
 * Body for POST /auth/register/start.
 *
 * The endpoint merges ONE identifier at a time into a registration session, and
 * requires at least one of email / mobile_number on every call. Passing a field
 * the user has not filled in yet would bind a placeholder onto the session, so
 * callers pass only the identifier they are verifying and let `session_id`
 * carry the rest.
 *
 * @throws {Error} when neither identifier is supplied — the backend rejects it.
 */
export function registerStartPayload({ role, sessionId, email, mobile }) {
  if (!email && !mobile) {
    throw new Error('Enter an email or a mobile number before starting registration.')
  }
  const payload = {}
  if (role) payload.role = role
  if (sessionId) payload.session_id = sessionId
  if (email) payload.email = email
  if (mobile) payload.mobile_number = mobile
  return payload
}

export const authApi = {
  registerStart: (payload) => api.post('/auth/register/start', payload),
  sendEmailOtp: (payload) => api.post('/auth/email/send-otp', payload),
  verifyEmailOtp: (payload) => api.post('/auth/email/verify-otp', payload),
  verifyPhoneToken: (payload) => api.post('/auth/verify-phone-token', payload),
  registerComplete: (payload) => api.post('/auth/register/complete', payload),

  /**
   * Finish evaluator registration on a session whose email and mobile are both
   * verified. The account lands pending admin approval.
   */
  registerEvaluatorComplete: (payload) =>
    api.post('/auth/register/evaluator/complete', payload),

  /**
   * Open a password-reset session for an existing account.
   *
   * Unlike register/start, this takes BOTH identifiers in one call and binds
   * them together — the session it returns has purpose "password_reset", and
   * the register endpoints reject it with PURPOSE_MISMATCH. 30-minute TTL.
   */
  forgotPasswordStart: (payload) => api.post('/auth/forgot-password/start', payload),

  /**
   * Set the new password on a reset session whose email and mobile are both
   * verified. Sets no login cookies and revokes existing sessions, so the
   * caller must clear local auth state and send the user to sign in.
   */
  forgotPasswordReset: (payload) => api.post('/auth/forgot-password/reset', payload),

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
