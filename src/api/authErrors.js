/**
 * Backend registration error codes → what the UI should say and do.
 *
 * Errors arrive as { detail: { code, message } }; ApiError parses the code onto
 * `.code` and keeps the raw body on `.data`, so the code is read from there
 * rather than the message, which is free text and may change.
 */

export const AUTH_ERROR = {
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  PHONE_TAKEN: 'PHONE_TAKEN',
  EMPLOYEE_ID_TAKEN: 'EMPLOYEE_ID_TAKEN',
  EMAIL_MISMATCH: 'EMAIL_MISMATCH',
  PHONE_MISMATCH: 'PHONE_MISMATCH',
  INVALID_CODE: 'INVALID_CODE',
  EXPIRED: 'EXPIRED',
  RESEND_COOLDOWN: 'RESEND_COOLDOWN',
  TOO_MANY_ATTEMPTS: 'TOO_MANY_ATTEMPTS',
  NOT_VERIFIED: 'NOT_VERIFIED',
  RATE_LIMITED: 'RATE_LIMITED',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  // Password reset only.
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  PHONE_NOT_ON_FILE: 'PHONE_NOT_ON_FILE',
  IDENTIFIER_MISMATCH: 'IDENTIFIER_MISMATCH',
  PURPOSE_MISMATCH: 'PURPOSE_MISMATCH',
}

/**
 * Codes meaning the session no longer agrees with the value on screen. The
 * channel has to be re-bound and re-sent from scratch, not merely retried.
 */
export const SESSION_MISMATCH_CODES = [AUTH_ERROR.EMAIL_MISMATCH, AUTH_ERROR.PHONE_MISMATCH]

/** Machine-readable failure code, or '' when the backend did not send one. */
export function authErrorCode(err) {
  if (err?.code) return err.code
  const detail = err?.data?.detail
  return detail && typeof detail === 'object' && !Array.isArray(detail) ? detail.code || '' : ''
}

const MESSAGES = {
  [AUTH_ERROR.EMAIL_TAKEN]: 'That email is already registered. Sign in instead.',
  [AUTH_ERROR.PHONE_TAKEN]: 'That mobile number is already registered.',
  [AUTH_ERROR.EMPLOYEE_ID_TAKEN]: 'That employee ID is already registered.',
  [AUTH_ERROR.EMAIL_MISMATCH]:
    'This email no longer matches your registration session. Verify it again.',
  [AUTH_ERROR.PHONE_MISMATCH]:
    'This mobile number no longer matches your registration session. Verify it again.',
  [AUTH_ERROR.TOO_MANY_ATTEMPTS]:
    'Too many incorrect attempts. Request a new code to continue.',
  [AUTH_ERROR.INVALID_CODE]: 'That code is not correct. Check it and try again, or resend.',
  [AUTH_ERROR.EXPIRED]: 'That code has expired. Resend to get a new one.',
  [AUTH_ERROR.RESEND_COOLDOWN]:
    'A code was sent a moment ago. Wait for the timer before requesting another.',
  [AUTH_ERROR.NOT_VERIFIED]:
    'Verify your email and mobile number before creating your account.',
  [AUTH_ERROR.RATE_LIMITED]: 'Too many requests. Wait a few minutes and try again.',
  [AUTH_ERROR.SESSION_NOT_FOUND]: 'That session is no longer available. Start again.',
  [AUTH_ERROR.SESSION_EXPIRED]: 'That session has expired. Start again.',
}

/** Human-readable text for a registration failure. */
export function authErrorMessage(err, fallback = 'Something went wrong. Try again.') {
  return MESSAGES[authErrorCode(err)] || err?.message || fallback
}

/**
 * Codes that belong under a specific input rather than in the form-level alert.
 * Keys match the field names used by both registration forms.
 */
const FIELD_BY_CODE = {
  [AUTH_ERROR.EMAIL_TAKEN]: 'email',
  [AUTH_ERROR.PHONE_TAKEN]: 'mobile_national',
  [AUTH_ERROR.EMPLOYEE_ID_TAKEN]: 'employee_id',
  [AUTH_ERROR.EMAIL_MISMATCH]: 'email',
  [AUTH_ERROR.PHONE_MISMATCH]: 'mobile_national',
}

/** Form field a failure should be reported against, or '' for form-level. */
export function authErrorField(err) {
  return FIELD_BY_CODE[authErrorCode(err)] || ''
}

/**
 * Password reset says some of these differently.
 *
 * The shared copy talks about "your registration session" and "creating your
 * account", which is wrong for someone who already has one. Only the codes
 * that need different words appear here; everything else falls through to the
 * shared map.
 */
const RESET_MESSAGES = {
  [AUTH_ERROR.ACCOUNT_NOT_FOUND]: 'No account found with this email address.',
  [AUTH_ERROR.PHONE_NOT_ON_FILE]:
    'This account has no mobile number on file, so it cannot be reset here. Contact support.',
  [AUTH_ERROR.NOT_VERIFIED]:
    'Verify your email and mobile number before setting a new password.',
  [AUTH_ERROR.IDENTIFIER_MISMATCH]:
    'These details do not match the ones you verified. Start again.',
  [AUTH_ERROR.PURPOSE_MISMATCH]: 'That link is for a different flow. Start again.',
  [AUTH_ERROR.EMAIL_MISMATCH]:
    'This email no longer matches your reset session. Start again.',
  [AUTH_ERROR.PHONE_MISMATCH]:
    'This mobile number no longer matches your reset session. Start again.',
  [AUTH_ERROR.SESSION_NOT_FOUND]: 'Your reset session is no longer available. Start again.',
  [AUTH_ERROR.SESSION_EXPIRED]:
    'Your reset session has expired. Reset sessions last 30 minutes — start again.',
}

/** Human-readable text for a password-reset failure. */
export function passwordResetErrorMessage(err, fallback = 'Something went wrong. Try again.') {
  return RESET_MESSAGES[authErrorCode(err)] || authErrorMessage(err, fallback)
}

/**
 * Codes meaning the reset session itself is gone or was never the right kind.
 * Nothing can be retried against it, so the flow has to go back to step one.
 */
const DEAD_SESSION_CODES = [
  AUTH_ERROR.SESSION_EXPIRED,
  AUTH_ERROR.SESSION_NOT_FOUND,
  AUTH_ERROR.PURPOSE_MISMATCH,
  AUTH_ERROR.IDENTIFIER_MISMATCH,
]

/** Should the reset flow throw this session away and restart from step one? */
export function isDeadSessionError(err) {
  return DEAD_SESSION_CODES.includes(authErrorCode(err))
}

/**
 * Seconds left on a RESEND_COOLDOWN. The backend may name the window several
 * ways; fall back to the standard 60s window when it sends none.
 */
export function resendCooldownSeconds(err, fallback = 60) {
  const detail = err?.data?.detail
  const source = detail && typeof detail === 'object' && !Array.isArray(detail) ? detail : {}
  const raw =
    source.retry_after ??
    source.retry_after_seconds ??
    source.cooldown_seconds ??
    source.seconds ??
    err?.data?.retry_after
  const seconds = Number(raw)
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : fallback
}
