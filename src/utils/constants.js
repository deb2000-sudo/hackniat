export const ROLES = {
  ADMIN: 'admin',
  EVALUATOR: 'evaluator',
  STUDENT: 'student',
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

// Default landing route per role after login.
export const ROLE_HOME = {
  [ROLES.ADMIN]: '/admin',
  [ROLES.EVALUATOR]: '/evaluator',
  [ROLES.STUDENT]: '/student',
}
