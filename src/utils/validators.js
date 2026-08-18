const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isEmail(value) {
  return EMAIL_RE.test(String(value || '').trim())
}

export function required(value) {
  return String(value ?? '').trim().length > 0
}

export function minLength(value, len) {
  return String(value ?? '').length >= len
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

/**
 * Validate the student registration form (individual, verified contact).
 * @returns {Record<string,string>} field -> error message (empty when valid)
 */
export function validateStudentForm(form) {
  const errors = {}
  if (!required(form.first_name)) errors.first_name = 'First name is required'
  if (!required(form.last_name)) errors.last_name = 'Last name is required'
  if (!isEmail(form.email)) errors.email = 'Enter a valid email'
  if (!required(form.university_name)) errors.university_name = 'University is required'
  if (!required(form.niat_id)) errors.niat_id = 'NIAT ID is required'
  const phone = toE164(form.country_code, form.mobile_national)
  if (!isE164(phone)) errors.mobile_national = 'Enter a valid mobile number'
  const strength = passwordStrength(form.password)
  if (!strength.ok) {
    errors.password = 'Password must be at least 8 characters with a letter and a number'
  }
  if (form.password !== form.confirm_password) errors.confirm_password = 'Passwords do not match'
  return errors
}

export function validateEvaluatorForm(form) {
  const errors = {}
  if (!required(form.first_name)) errors.first_name = 'First name is required'
  if (!required(form.last_name)) errors.last_name = 'Last name is required'
  if (!required(form.employee_id)) errors.employee_id = 'Employee ID is required'
  if (!isEmail(form.email)) errors.email = 'Enter a valid Nxtwave email address'
  if (!minLength(form.password, 6)) errors.password = 'Password must be at least 6 characters'
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
