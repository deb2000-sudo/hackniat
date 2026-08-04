import { APPROVAL_STATUS, EVALUATION_STATUS, ROLES } from '../../utils/constants'

export default function Badge({ variant = 'neutral', dot = false, children, className = '' }) {
  return (
    <span className={`badge badge--${variant} ${className}`}>
      {dot && <span className="badge__dot" />}
      {children}
    </span>
  )
}

const ROLE_VARIANT = {
  [ROLES.ADMIN]: 'accent',
  [ROLES.EVALUATOR]: 'info',
  [ROLES.STUDENT]: 'brand',
}

export function RoleBadge({ role }) {
  return <Badge variant={ROLE_VARIANT[role] || 'neutral'}>{role}</Badge>
}

const APPROVAL_VARIANT = {
  [APPROVAL_STATUS.APPROVED]: 'success',
  [APPROVAL_STATUS.PENDING]: 'warning',
}

export function ApprovalBadge({ status }) {
  if (!status) return null
  return (
    <Badge variant={APPROVAL_VARIANT[status] || 'neutral'} dot>
      {status}
    </Badge>
  )
}

const EVAL_VARIANT = {
  [EVALUATION_STATUS.UPLOADED]: 'neutral',
  [EVALUATION_STATUS.PROCESSING]: 'info',
  [EVALUATION_STATUS.COMPLETED]: 'success',
  [EVALUATION_STATUS.FAILED]: 'danger',
}

const EVAL_LABELS = {
  [EVALUATION_STATUS.UPLOADED]: 'Uploaded',
  [EVALUATION_STATUS.PROCESSING]: 'AI Analysis In Progress',
  [EVALUATION_STATUS.COMPLETED]: 'AI Analysis Completed',
  [EVALUATION_STATUS.FAILED]: 'AI Analysis Failed',
}

export function StatusBadge({ status }) {
  if (!status) return null
  return (
    <Badge variant={EVAL_VARIANT[status] || 'neutral'} dot>
      {EVAL_LABELS[status] || status}
    </Badge>
  )
}

const REVIEW_STATUS = {
  none: { label: 'Manual Analysis Pending', variant: 'warning' },
  pending_review: { label: 'pending admin review', variant: 'warning' },
  changes_requested: { label: 'changes requested', variant: 'danger' },
  approved: { label: 'approved', variant: 'success' },
}

export function ReviewStatusBadge({ status }) {
  const normalized = status || 'none'
  const config = REVIEW_STATUS[normalized] || {
    label: String(normalized).replaceAll('_', ' '),
    variant: 'neutral',
  }
  return (
    <Badge variant={config.variant} dot className="badge--review">
      {config.label}
    </Badge>
  )
}

/** Hackathon / submission AI mode: automatic queue vs manual trigger. */
export function AiModeBadge({ auto }) {
  return (
    <Badge variant={auto ? 'info' : 'neutral'} dot>
      {auto ? 'AI runs automatically' : 'Manual AI'}
    </Badge>
  )
}

/**
 * Evaluator queue chip for analysis readiness.
 * Auto mode: Queued while processing/uploaded, Ready when completed.
 * Manual mode: highlight when the AI Evaluation action is available.
 */
export function AiQueueBadge({ submission }) {
  if (!submission) return null
  if (submission.auto_ai_evaluation) {
    if (submission.status === 'completed') {
      return (
        <Badge variant="success" dot>
          Ready
        </Badge>
      )
    }
    if (submission.status === 'failed') {
      return (
        <Badge variant="danger" dot>
          failed
        </Badge>
      )
    }
    return (
      <Badge variant="info" dot>
        Queued
      </Badge>
    )
  }
  if (submission.show_ai_evaluation_button) {
    return (
      <Badge variant="accent" dot>
        AI Evaluation
      </Badge>
    )
  }
  return <StatusBadge status={submission.status} />
}
