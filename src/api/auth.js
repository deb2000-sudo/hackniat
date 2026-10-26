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

  /**
   * First-login profile for an account Super Admin created. Binds BOTH
   * identifiers at once and opens a fresh session each call, so a changed
   * mobile number means calling it again and re-running both checks. Signed-in
   * write: the client sends the CSRF header as usual.
   */
  profileStart: (payload) => api.post('/auth/profile/start', payload),

  /** `{ session_id, email, mobile_number, employee_id }` once both checks pass. */
  profileComplete: (payload) => api.post('/auth/profile/complete', payload),

  /**
   * Public: which registration channels need an OTP right now,
   * `{ email_verification_enabled, mobile_verification_enabled }`. A channel
   * that is off is still collected on the form, just not verified.
   */
  registrationConfig: (options) => api.get('/auth/registration-config', options),

  /**
   * Signed in, verification due (see `verification_due` on /auth/me): opens a
   * session for the account's own email and mobile. Answers with session_id,
   * email, mobile_number, email_required and mobile_required.
   */
  verificationStart: () => api.post('/auth/verification/start'),

  /** Finish once every required channel is verified. Answers with the user profile. */
  verificationComplete: (sessionId) =>
    api.post('/auth/verification/complete', { session_id: sessionId }),

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

  /**
   * Update your own profile: `{ first_name, last_name }`, plus `employee_id`
   * for Super Admin, Admin, custom roles and evaluators. Email and mobile are
   * never sent and cannot change. Answers with the same shape as GET /auth/me.
   * 409 EMPLOYEE_ID_TAKEN.
   */
  updateMe: (payload) => api.patch('/auth/me', payload),
}
