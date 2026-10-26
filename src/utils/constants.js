export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  // A Super Admin-defined role; its screens come from `user.permissions`.
  CUSTOM: 'custom',
  EVALUATOR: 'evaluator',
  STUDENT: 'student',
}

/**
 * A university's college type, copied onto the student at registration. NIAT
 * students give a NIAT ID; Non NIAT students give a College ID. A university
 * with no type is NIAT.
 */
export const COLLEGE_TYPES = {
  NIAT: 'NIAT',
  NON_NIAT: 'Non NIAT',
}

export const APPROVAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
}

export const EVALUATION_STATUS = {
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
}

export const CRITERIA_LABELS = {
  problem_coverage: 'Problem Coverage',
  solution_demonstration: 'Solution Demonstration',
  technical_execution: 'Technical Execution',
  presentation: 'Presentation',
  impact: 'Impact',
}

// Default landing route per role after login. Admin-side roles land on the
// first screen they may open instead — use homePath() from utils/access.
export const ROLE_HOME = {
  [ROLES.ADMIN]: '/admin',
  [ROLES.EVALUATOR]: '/evaluator',
  [ROLES.STUDENT]: '/student',
}

// Dialling codes offered on the registration forms.
export const MOBILE_COUNTRY_CODES = [
  { value: '+91', label: '+91 IN' },
  { value: '+1', label: '+1 US' },
  { value: '+44', label: '+44 UK' },
  { value: '+971', label: '+971 AE' },
  { value: '+65', label: '+65 SG' },
  { value: '+61', label: '+61 AU' },
]
