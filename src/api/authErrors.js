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
  INVALID_CODE: 'INVALID_CODE',
  EXPIRED: 'EXPIRED',
  RESEND_COOLDOWN: 'RESEND_COOLDOWN',
  NOT_VERIFIED: 'NOT_VERIFIED',
}

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
  [AUTH_ERROR.INVALID_CODE]: 'That code is not correct. Check it and try again, or resend.',
  [AUTH_ERROR.EXPIRED]: 'That code has expired. Resend to get a new one.',
  [AUTH_ERROR.RESEND_COOLDOWN]:
    'A code was sent a moment ago. Wait for the timer before requesting another.',
  [AUTH_ERROR.NOT_VERIFIED]:
    'Verify your email and mobile number before creating your account.',
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
}

/** Form field a failure should be reported against, or '' for form-level. */
export function authErrorField(err) {
  return FIELD_BY_CODE[authErrorCode(err)] || ''
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
