const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isEmail(value) {
  return EMAIL_RE.test(String(value || '').trim())
}

/**
 * Evaluator accounts are staff accounts, so the address must sit on the
 * corporate domain rather than merely look like an email.
 */
export function isNxtwaveEmail(value) {
  return /^[^\s@]+@nxtwave\.co\.in$/i.test(String(value || '').trim())
}

export function required(value) {
  return String(value ?? '').trim().length > 0
}

export function minLength(value, len) {
  return String(value ?? '').length >= len
}

/**
 * Employee ID — 9 characters: `NW` followed by seven letters or digits, as in
 * NW0003800. Shape only: catches typos at the form.
 */
const EMPLOYEE_ID_RE = /^NW[A-Z0-9]{7}$/

export function isEmployeeId(value) {
  return EMPLOYEE_ID_RE.test(String(value || '').trim().toUpperCase())
}

export function isMobile(value) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}

export function isE164(value) {
  return /^\+[1-9]\d{7,14}$/.test(String(value || '').trim())
}

export function passwordStrength(password) {
  const value = String(password || '')
  const hasLetter = /[A-Za-z]/.test(value)
  const hasNumber = /\d/.test(value)
  const longEnough = value.length >= 8
  return {
    hasLetter,
    hasNumber,
    longEnough,
    ok: hasLetter && hasNumber && longEnough,
  }
}

export function toE164(countryCode, national) {
  const cc = String(countryCode || '+91').replace(/\s/g, '')
  const digits = String(national || '').replace(/\D/g, '')
  if (cc === '+91' && digits.length === 10) return `+91${digits}`
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`
  return `${cc}${digits}`
}

/** Upper bound the backend accepts for a campus or batch student count. */
export const TOTAL_STUDENTS_MAX = 1_000_000

/**
 * Parse the "Total students" field on the university and batch forms. Commas
 * and spaces are ignored so "10,00,000" is accepted as typed.
 * @returns {{ value: number | null, error: string }}
 */
export function parseTotalStudents(raw) {
  const text = String(raw ?? '').replace(/[,\s]/g, '')
  if (!text) return { value: null, error: 'Total students is required.' }
  if (!/^\d+$/.test(text)) return { value: null, error: 'Total students must be a whole number.' }
  const value = Number(text)
  if (value < 1 || value > TOTAL_STUDENTS_MAX) {
    return { value: null, error: 'Total students must be between 1 and 10,00,000.' }
  }
  return { value, error: '' }
}

/**
 * Validate the student registration form (individual, verified contact).
 * @returns {Record<string,string>} field -> error message (empty when valid)
 */
/** A College ID is plain text (any format), up to this many characters. */
export const COLLEGE_ID_MAX_LENGTH = 50

/**
 * @param {object} form
 * @param {{ nonNiat?: boolean }} [options] `nonNiat` when the selected
 *   university is Non NIAT: a College ID is required instead of a NIAT ID.
 */
export function validateStudentForm(form, { nonNiat = false } = {}) {
  const errors = {}
  if (!required(form.first_name)) errors.first_name = 'First name is required'
  if (!required(form.last_name)) errors.last_name = 'Last name is required'
  if (!isEmail(form.email)) errors.email = 'Enter a valid email'
  if (!required(form.university_id)) errors.university_id = 'Select your university'
  else if (!required(form.batch_id)) errors.batch_id = 'Select your batch'
  if (nonNiat) {
    const collegeId = String(form.college_id || '').trim()
    if (!collegeId) errors.college_id = 'College ID is required'
    else if (collegeId.length > COLLEGE_ID_MAX_LENGTH) {
      errors.college_id = `A College ID can be up to ${COLLEGE_ID_MAX_LENGTH} characters`
    }
  } else if (!required(form.niat_id)) {
    // Any length and any mix of letters and digits: the backend only checks
    // that it is present and not already registered.
    errors.niat_id = 'NIAT ID is required'
  }
  const phone = toE164(form.country_code, form.mobile_national)
  if (!isE164(phone)) errors.mobile_national = 'Enter a valid mobile number'
  const strength = passwordStrength(form.password)
  if (!strength.ok) {
    errors.password = 'Password must be at least 8 characters with a letter and a number'
  }
  if (form.password !== form.confirm_password) errors.confirm_password = 'Passwords do not match'
  return errors
}

/**
 * Validate the evaluator registration form. Same verified-contact shape as the
 * student form, plus the employee ID and the corporate email domain.
 * @returns {Record<string,string>} field -> error message (empty when valid)
 */
export function validateEvaluatorForm(form) {
  const errors = {}
  if (!required(form.first_name)) errors.first_name = 'First name is required'
  if (!required(form.last_name)) errors.last_name = 'Last name is required'
  if (!required(form.employee_id)) errors.employee_id = 'Employee ID is required'
  else if (!isEmployeeId(form.employee_id)) {
    errors.employee_id = 'An employee ID is 9 characters starting with NW, like NW0003800'
  }
  if (!isNxtwaveEmail(form.email)) errors.email = 'Use your @nxtwave.co.in email address'
  const phone = toE164(form.country_code, form.mobile_national)
  if (!isE164(phone)) errors.mobile_national = 'Enter a valid mobile number'
  const strength = passwordStrength(form.password)
  if (!strength.ok) {
    errors.password = 'Password must be at least 8 characters with a letter and a number'
  }
  if (form.password !== form.confirm_password) errors.confirm_password = 'Passwords do not match'
  return errors
}

/**
 * Validate step one of the password reset.
 *
 * Email alone: /auth/forgot-password/start looks the account up by it, emails
 * the code itself, and hands back the mobile number already on the account, so
 * there is nothing for the user to type about their phone.
 * @returns {Record<string,string>} field -> error message (empty when valid)
 */
export function validateForgotPasswordForm(form) {
  const errors = {}
  if (!isEmail(form.email)) errors.email = 'Enter a valid email address'
  return errors
}

/**
 * Validate a new-password pair against the same rule registration uses:
 * 8+ characters with at least one letter and one number.
 * @returns {Record<string,string>} field -> error message (empty when valid)
 */
export function validateNewPasswordForm(form) {
  const errors = {}
  if (!passwordStrength(form.password).ok) {
    errors.password = 'Password must be at least 8 characters with a letter and a number'
  }
  if (form.password !== form.confirm_password) errors.confirm_password = 'Passwords do not match'
  return errors
}

/** Validate the login form. */
export function validateLoginForm(form) {
  const errors = {}
  if (!isEmail(form.email)) errors.email = 'Enter a valid email address'
  if (!minLength(form.password, 6)) errors.password = 'Password must be at least 6 characters'
  return errors
}
