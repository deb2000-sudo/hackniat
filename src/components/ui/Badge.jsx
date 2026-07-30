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

export function StatusBadge({ status }) {
  if (!status) return null
  return (
    <Badge variant={EVAL_VARIANT[status] || 'neutral'} dot>
      {status}
    </Badge>
  )
}

const REVIEW_STATUS = {
  none: { label: 'not submitted', variant: 'neutral' },
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
