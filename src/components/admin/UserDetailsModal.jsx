import { useEffect, useState } from 'react'
import { adminApi } from '../../api/admin'
import { COLLEGE_TYPES } from '../../utils/constants'
import { authErrorCode } from '../../api/authErrors'
import { formatDate, formatDateTime, formatMobile, MOBILE_KEYS, universityOf } from '../../utils/format'
import Alert from '../ui/Alert'
import Avatar from '../ui/Avatar'
import { ApprovalBadge, RoleBadge } from '../ui/Badge'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'
import { modalScrollable } from '../ui/uiClasses'

/** Fields placed in their own rows, so "Other details" never repeats them. */
const KNOWN_KEYS = new Set([
  ...MOBILE_KEYS,
  'id', 'uid', 'name', 'first_name', 'last_name', 'email', 'role', 'approval_status',
  'mobile_national', 'country_code', 'email_verified', 'phone_verified',
  'niat_id', 'college_id', 'college_type', 'employee_id', 'university', 'university_id', 'university_name', 'university_location',
  'created_at', 'updated_at',
])

/** Never shown, even if an endpoint ever returns them. */
const HIDDEN_KEY = /password|hash|token|secret|otp|session|csrf|salt/i

const isBlank = (value) => value === undefined || value === null || String(value).trim() === ''
const firstOf = (...values) => values.find((value) => !isBlank(value))


const humanise = (key) => key.replace(/_/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase())

/** Anything else on the record that is a plain value, labelled from its key. */
function otherDetails(user) {
  return Object.entries(user)
    .filter(([key, value]) => {
      if (KNOWN_KEYS.has(key) || HIDDEN_KEY.test(key) || isBlank(value)) return false
      return ['string', 'number', 'boolean'].includes(typeof value)
    })
    .map(([key, value]) => ({
      label: humanise(key),
      value:
        typeof value === 'boolean'
          ? value ? 'Yes' : 'No'
          : /_at$/.test(key) ? formatDateTime(value) : String(value),
    }))
}

function CopyButton({ value, label }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return undefined
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  if (isBlank(value) || !navigator.clipboard) return null
  return (
    <button
      type="button"
      className={`grid size-7 shrink-0 place-items-center rounded-md transition-colors hover:bg-raised ${
        copied ? 'text-passed' : 'text-muted hover:text-ink'
      }`}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      title={copied ? 'Copied' : `Copy ${label}`}
      onClick={() =>
        navigator.clipboard
          .writeText(String(value))
          .then(() => setCopied(true))
          .catch(() => {})
      }
    >
      <Icon name={copied ? 'check' : 'clipboard'} size={15} />
    </button>
  )
}

/** Small "Verified" / "Not verified" marker beside a contact value. */
function VerifiedChip({ verified }) {
  if (verified === undefined || verified === null) return null
  return verified ? (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-passed/30 bg-passed/10 px-2 py-0.5 text-[11px] font-medium text-passed">
      <Icon name="checkCircle" size={12} />
      Verified
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center rounded-full border border-hairline px-2 py-0.5 text-[11px] font-medium text-muted">
      Not verified
    </span>
  )
}

/**
 * One label/value line. While the full profile is still loading, a value the
 * list row did not carry shows a placeholder bar instead of "Not provided" —
 * otherwise the mobile number reads as missing and then pops in.
 */
function Row({ label, value, href, mono = false, copy, extra, pending = false }) {
  const blank = isBlank(value)
  return (
    <div className="grid grid-cols-[minmax(96px,132px)_minmax(0,1fr)] items-center gap-3 px-4 py-2.5">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="flex min-w-0 items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          {blank ? (
            pending ? (
              <span className="h-3.5 w-32 animate-pulse rounded bg-raised" aria-label="Loading" />
            ) : (
              <span className="text-[14px] text-muted">Not provided</span>
            )
          ) : href ? (
            <a
              href={href}
              className={`truncate text-[14px] text-ink underline-offset-2 hover:underline ${mono ? 'font-mono' : ''}`}
            >
              {value}
            </a>
          ) : (
            <span className={`truncate text-[14px] text-ink ${mono ? 'font-mono' : ''}`} title={String(value)}>
              {value}
            </span>
          )}
          {!blank && extra}
        </span>
        {!blank && copy !== undefined && <CopyButton value={copy} label={label.toLowerCase()} />}
      </dd>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section>
      <h4 className="mb-1.5 text-[11px] font-medium tracking-[0.08em] text-muted uppercase">{title}</h4>
      <dl className="divide-y divide-hairline rounded-drop border border-hairline">{children}</dl>
    </section>
  )
}

/**
 * What differs between a student's panel and an evaluator's: where the full
 * record comes from, and the words. The rows themselves are shared.
 */
const VARIANTS = {
  student: {
    title: 'Student details',
    unnamed: 'Unnamed student',
    load: (id, options) => adminApi.getUser(id, options),
    deleteLabel: 'Delete student',
  },
  evaluator: {
    title: 'Evaluator details',
    unnamed: 'Unnamed evaluator',
    load: (id, options) => adminApi.getEvaluator(id, options),
    deleteLabel: 'Delete evaluator',
  },
}

const configFor = (variant) => VARIANTS[variant] || VARIANTS.student

/** Codes meaning the account is gone, not that the fetch failed. */
const GONE_CODES = ['USER_NOT_FOUND', 'EVALUATOR_NOT_FOUND']

/** "pending" → "Pending". An evaluator with no status is approved, as in the table. */
const approvalLabel = (status) => humanise(String(status || 'approved'))

/**
 * Read-only profile of one student or evaluator. Opens straight away with the
 * table row, then fills in from the full record (GET /admin/user/{id} or
 * GET /admin/evaluators/{id}), which carries fields the list does not, such as
 * the mobile number. If that fetch fails, the row is still shown.
 *
 * Students get the Academic section (NIAT ID, university); evaluators get Work
 * (employee ID, approval status) and never the student-only fields.
 * `onEdit` and `onDelete` are optional: each button shows only when passed.
 */
export default function UserDetailsModal({
  user: row,
  variant = 'student',
  onClose,
  onEdit,
  onDelete,
}) {
  const config = configFor(variant)
  const isEvaluator = variant === 'evaluator'
  // Keyed per user by the caller, so this state never carries between people.
  const [full, setFull] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    configFor(variant)
      .load(row.id, { signal: controller.signal })
      .then((payload) => {
        if (!active) return
        setFull(payload?.user || payload || null)
        setLoading(false)
      })
      .catch((err) => {
        if (!active || err?.name === 'AbortError') return
        setLoadError(
          GONE_CODES.includes(authErrorCode(err))
            ? `This ${variant} no longer exists.`
            : err?.message || 'Could not load the full profile.',
        )
        setLoading(false)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [row.id, variant])

  const user = { ...row, ...(full || {}) }
  const name = firstOf(user.name, [user.first_name, user.last_name].filter(Boolean).join(' '), config.unnamed)
  const mobileRaw = firstOf(...MOBILE_KEYS.map((key) => user[key]))
  const mobileDial = mobileRaw ? String(mobileRaw).replace(/\s+/g, '') : ''
  const university = universityOf(user)
  // Students registered before college types existed are NIAT.
  const collegeType = user.college_type || COLLEGE_TYPES.NIAT
  const isNonNiat = collegeType === COLLEGE_TYPES.NON_NIAT
  const others = otherDetails(user)

  return (
    <Modal
      open
      onClose={onClose}
      title={config.title}
      className={modalScrollable}
      footer={
        <>
          {/* Passed only for a Super Admin — nobody else may delete. */}
          {onDelete && (
            <Button
              variant="danger"
              onClick={() => onDelete(user)}
              leftIcon={<Icon name="trash" size={16} />}
              className="mr-auto"
            >
              {config.deleteLabel}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {onEdit && (
            <Button variant="secondary" onClick={() => onEdit(user)} leftIcon={<Icon name="edit" size={16} />}>
              Edit name
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3.5">
          <Avatar name={name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-semibold tracking-[-0.01em] text-ink">{name}</p>
            <p className="truncate text-[13.5px] text-muted">
              {(isEvaluator ? user.employee_id : isNonNiat ? user.college_id : user.niat_id) ||
                user.email}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <RoleBadge role={user.role} />
            {user.approval_status && <ApprovalBadge status={user.approval_status} />}
          </div>
        </div>

        {loadError && (
          <Alert variant="warning">{loadError} Showing the details from the list instead.</Alert>
        )}

        <Section title="Contact">
          <Row
            label="Mobile"
            value={mobileRaw ? formatMobile(mobileRaw) : ''}
            href={mobileDial ? `tel:${mobileDial}` : undefined}
            copy={mobileDial}
            mono
            pending={loading}
            extra={<VerifiedChip verified={user.phone_verified} />}
          />
          <Row
            label="Email"
            value={user.email}
            href={user.email ? `mailto:${user.email}` : undefined}
            copy={user.email}
            pending={loading}
            extra={<VerifiedChip verified={user.email_verified} />}
          />
        </Section>

        {isEvaluator ? (
          <Section title="Work">
            <Row label="Employee ID" value={user.employee_id} copy={user.employee_id} mono pending={loading} />
            <Row label="Approval status" value={approvalLabel(user.approval_status)} />
          </Section>
        ) : (
          <Section title="Academic">
            <Row label="College type" value={collegeType} />
            {isNonNiat ? (
              <Row label="College ID" value={user.college_id} copy={user.college_id} mono pending={loading} />
            ) : (
              <Row label="NIAT ID" value={user.niat_id} copy={user.niat_id} mono pending={loading} />
            )}
            {user.employee_id && <Row label="Employee ID" value={user.employee_id} copy={user.employee_id} mono />}
            <Row label="University" value={university} pending={loading} />
            <Row label="Location" value={user.university_location} pending={loading} />
          </Section>
        )}

        <Section title="Account">
          <Row label="First name" value={user.first_name} pending={loading} />
          <Row label="Last name" value={user.last_name} pending={loading} />
          <Row label="Joined" value={user.created_at ? formatDate(user.created_at) : ''} pending={loading} />
          {(user.updated_at || loading) && (
            <Row
              label="Last updated"
              value={user.updated_at ? formatDateTime(user.updated_at) : ''}
              pending={loading}
            />
          )}
          <Row label="User ID" value={user.id} copy={user.id} mono />
        </Section>

        {others.length > 0 && (
          <Section title="Other details">
            {others.map(({ label, value }) => (
              <Row key={label} label={label} value={value} />
            ))}
          </Section>
        )}
      </div>
    </Modal>
  )
}
