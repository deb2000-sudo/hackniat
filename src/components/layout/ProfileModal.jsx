import { useEffect, useState } from 'react'
import { authApi } from '../../api/auth'
import { AUTH_ERROR, authErrorCode, authErrorMessage } from '../../api/authErrors'
import { useAuth } from '../../hooks/useAuth'
import { roleLabel } from '../../utils/access'
import { COLLEGE_TYPES, ROLES } from '../../utils/constants'
import { formatMobile, mobileOf, universityOf } from '../../utils/format'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Modal from '../ui/Modal'
import { LoadingBlock } from '../ui/Spinner'

/** Roles whose profile carries an employee ID they can edit. */
const EMPLOYEE_ID_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.CUSTOM, ROLES.EVALUATOR]

const blankToEmpty = (value) => (value === undefined || value === null ? '' : String(value))

/** Display value for a read-only field: the value, or a muted dash. */
const shown = (value) => (blankToEmpty(value).trim() ? String(value) : '—')

/** A student's team: its name, or who leads it when that is all we have. */
function teamOf(user) {
  const name = user?.team_name || user?.team?.name
  if (name) return name
  return user?.team_leader_name ? `Led by ${user.team_leader_name}` : ''
}

const batchOf = (user) => user?.batch_name || user?.batch?.name || ''

/** Shown, never edited: muted so it does not read as a field to type in. */
function ReadOnlyField({ label, value }) {
  return (
    <Input
      label={label}
      value={shown(value)}
      disabled
      readOnly
      className="cursor-not-allowed bg-raised text-muted"
    />
  )
}

/**
 * Your own profile, for every role. Loads GET /auth/me when it opens (the
 * login response has no first name, mobile or employee ID), and saves first
 * and last name — plus employee ID where the role has one — with
 * PATCH /auth/me. Email, mobile, role and a student's academic details are
 * shown but cannot be changed here. On save, the signed-in user is replaced
 * with the response, so the name in the sidebar updates.
 *
 * Mounted only while open, so each opening starts from a fresh fetch.
 */
export default function ProfileModal({ onClose }) {
  const { setUser } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState({ first_name: '', last_name: '', employee_id: '' })
  const [errors, setErrors] = useState({})
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    authApi
      .me({ signal: controller.signal })
      .then((me) => {
        if (!active) return
        setProfile(me)
        setForm({
          first_name: blankToEmpty(me?.first_name),
          last_name: blankToEmpty(me?.last_name),
          employee_id: blankToEmpty(me?.employee_id),
        })
        setLoadError('')
      })
      .catch((err) => {
        if (!active || err?.name === 'AbortError') return
        setLoadError(err?.message || 'Could not load your profile.')
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [nonce])

  const hasEmployeeId = EMPLOYEE_ID_ROLES.includes(profile?.role)
  const isStudent = profile?.role === ROLES.STUDENT

  const update = (key) => (event) => {
    const value = event.target.value
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    setSaveError('')
  }

  const save = async () => {
    const payload = { first_name: form.first_name.trim(), last_name: form.last_name.trim() }
    const nextErrors = {}
    if (!payload.first_name) nextErrors.first_name = 'First name is required'
    if (!payload.last_name) nextErrors.last_name = 'Last name is required'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    // Only on the form for roles that have one; students never send it.
    if (hasEmployeeId) payload.employee_id = form.employee_id.trim()

    setSaving(true)
    setSaveError('')
    const saved = await authApi.updateMe(payload).catch((err) => {
      if (authErrorCode(err) === AUTH_ERROR.EMPLOYEE_ID_TAKEN) {
        setErrors((current) => ({ ...current, employee_id: authErrorMessage(err) }))
      } else {
        setSaveError(err?.message || 'Could not save your profile.')
      }
      return null
    })
    setSaving(false)
    if (!saved) return

    // Same shape as /auth/me: merge so nothing the shell relies on is lost.
    setUser((current) => (current ? { ...current, ...saved } : saved))
    onClose()
  }

  return (
    <Modal
      open
      onClose={() => !saving && onClose()}
      title="Profile"
      footer={
        <>
          <Button variant="ghost" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" loading={saving} disabled={!profile} onClick={save}>
            Save changes
          </Button>
        </>
      }
    >
      {loadError ? (
        <Alert variant="danger" title="Unable to load your profile">
          {loadError}{' '}
          <button type="button" className="link-btn" onClick={() => setNonce((value) => value + 1)}>
            Try again
          </button>
        </Alert>
      ) : !profile ? (
        <LoadingBlock label="Loading your profile…" />
      ) : (
        <div className="stack-md">
          {saveError && <Alert variant="danger">{saveError}</Alert>}

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="First name"
              required
              autoComplete="given-name"
              maxLength={100}
              value={form.first_name}
              onChange={update('first_name')}
              error={errors.first_name}
            />
            <Input
              label="Last name"
              required
              autoComplete="family-name"
              maxLength={100}
              value={form.last_name}
              onChange={update('last_name')}
              error={errors.last_name}
            />
          </div>

          {hasEmployeeId && (
            <Input
              label="Employee ID"
              autoComplete="off"
              spellCheck={false}
              maxLength={40}
              value={form.employee_id}
              onChange={update('employee_id')}
              error={errors.employee_id}
            />
          )}

          <ReadOnlyField label="Email" value={profile.email} />
          <div className="grid gap-3 sm:grid-cols-2">
            <ReadOnlyField
              label="Mobile"
              value={mobileOf(profile) ? formatMobile(mobileOf(profile)) : ''}
            />
            <ReadOnlyField label="Role" value={roleLabel(profile)} />
          </div>

          {isStudent && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {profile.college_type === COLLEGE_TYPES.NON_NIAT ? (
                  <ReadOnlyField label="College ID" value={profile.college_id} />
                ) : (
                  <ReadOnlyField label="NIAT ID" value={profile.niat_id} />
                )}
                <ReadOnlyField label="Team" value={teamOf(profile)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <ReadOnlyField label="University" value={universityOf(profile)} />
                <ReadOnlyField label="Batch" value={batchOf(profile)} />
              </div>
            </>
          )}

          <p className="text-[12.5px] text-muted">
            Email and mobile are verified and cannot be changed here.
          </p>
        </div>
      )}
    </Modal>
  )
}
