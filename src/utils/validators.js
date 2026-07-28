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

/**
 * Validate the student registration form.
 * @returns {Record<string,string>} field -> error message (empty when valid)
 */
export function validateStudentForm(form) {
  return {
    ...validateStudentTeamDetails(form),
    ...validateStudentTeamLeader(form),
    ...validateStudentTeamMembers(form),
    ...validateStudentSecurity(form),
  }
}

export function validateStudentTeamDetails(form) {
  const errors = {}
  if (!required(form.team_name)) errors.team_name = 'Team name is required'
  if (!required(form.university)) errors.university = 'University is required'
  if (!required(form.niat_id)) errors.niat_id = 'NIAT ID is required'
  return errors
}

export function validateStudentTeamLeader(form) {
  const errors = {}
  if (!required(form.team_leader_name)) errors.team_leader_name = 'Team leader name is required'
  if (!isEmail(form.email)) errors.email = 'Enter a valid team leader email'
  if (!isMobile(form.mobile_no)) errors.mobile_no = 'Enter a valid mobile number (10-15 digits)'
  return errors
}

export function validateStudentTeamMembers(form) {
  const errors = {}

  for (const number of [1, 2]) {
    const nameKey = `team_member_${number}_name`
    const emailKey = `team_member_${number}_email`
    if (!required(form[nameKey])) errors[nameKey] = `Team member ${number} name is required`
    if (!isEmail(form[emailKey])) errors[emailKey] = `Enter a valid team member ${number} email`
  }

  for (const number of [3, 4]) {
    const nameKey = `team_member_${number}_name`
    const emailKey = `team_member_${number}_email`
    const hasName = required(form[nameKey])
    const hasEmail = required(form[emailKey])
    if (hasEmail && !hasName) errors[nameKey] = 'Enter the member name or clear the email'
    if (hasName && !isEmail(form[emailKey])) errors[emailKey] = 'Enter a valid email or clear the name'
  }

  const emailFields = ['email', ...[1, 2, 3, 4].map((number) => `team_member_${number}_email`)]
  const seenEmails = new Map()
  emailFields.forEach((key) => {
    const email = String(form[key] || '').trim().toLowerCase()
    if (!email || !isEmail(email)) return
    if (seenEmails.has(email)) {
      errors[key] = 'This email is already used by another team member'
      errors[seenEmails.get(email)] = 'This email is already used by another team member'
    } else {
      seenEmails.set(email, key)
    }
  })

  return errors
}

export function validateStudentSecurity(form) {
  const errors = {}
  if (!minLength(form.password, 6)) errors.password = 'Password must be at least 6 characters'
  if (form.password !== form.confirm_password) errors.confirm_password = 'Passwords do not match'
  return errors
}

/** Validate the evaluator registration form. */
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
