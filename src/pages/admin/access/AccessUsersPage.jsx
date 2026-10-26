import { useState } from 'react'
import { ACCESS_ERROR, ACCESS_ERROR_MESSAGES, accessApi } from '../../../api/access'
import { authErrorCode } from '../../../api/authErrors'
import { useAsync } from '../../../hooks/useAsync'
import { useAuth } from '../../../hooks/useAuth'
import { queryKeys } from '../../../lib/queryKeys'
import { ROLES } from '../../../utils/constants'
import { isEmail } from '../../../utils/validators'
import { WRAP_APP } from '../../../components/drop/theme'
import PageHeader from '../../../components/layout/PageHeader'
import Alert from '../../../components/ui/Alert'
import { RoleBadge } from '../../../components/ui/Badge'
import Button from '../../../components/ui/Button'
import Card, { CardBody } from '../../../components/ui/Card'
import EmptyState from '../../../components/ui/EmptyState'
import Icon from '../../../components/ui/Icon'
import Input, { PasswordInput, Select } from '../../../components/ui/Input'
import Modal from '../../../components/ui/Modal'
import { LoadingBlock } from '../../../components/ui/Spinner'

const PASSWORD_MIN = 8

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  role_id: '',
}

/**
 * Field errors for the dialog. Editing skips email and password (neither is
 * sent) and, for a Super Admin, the role, which is locked.
 */
function validate(form, { editing, roleLocked }) {
  const errors = {}
  if (!form.first_name.trim()) errors.first_name = 'First name is required'
  if (!form.last_name.trim()) errors.last_name = 'Last name is required'
  if (!editing) {
    if (!isEmail(form.email.trim())) errors.email = 'Enter a valid email'
    if (form.password.length < PASSWORD_MIN) {
      errors.password = `Password must be at least ${PASSWORD_MIN} characters`
    }
  }
  if (!roleLocked && !form.role_id) errors.role_id = 'Choose a role'
  return errors
}

/** The dropdown value for an account's current role. */
function roleIdOf(account) {
  if (account.role === ROLES.ADMIN) return ROLES.ADMIN
  if (account.role === ROLES.CUSTOM)
    return account.custom_role_id ? String(account.custom_role_id) : ''
  return ''
}

/** Same person? /auth/me may not carry an id, and email cannot change here. */
function isSameAccount(me, account) {
  if (!me) return false
  if (me.id != null && account.id != null) return String(me.id) === String(account.id)
  return !!me.email && String(me.email).toLowerCase() === String(account.email || '').toLowerCase()
}

function displayName(account) {
  return (
    account.name ||
    [account.first_name, account.last_name].filter(Boolean).join(' ') ||
    account.email
  )
}

/**
 * Super Admin: admin-side logins (Super Admin, Admin, custom roles).
 *
 * Students and evaluators are not here — they stay on their own management
 * pages. Choosing the built-in Admin role makes an ordinary `role: "admin"`
 * account with today's admin screens; any other role makes `role: "custom"`.
 * Super Admin is never assignable from here, and a Super Admin's own role is
 * locked: editing one changes only the name.
 *
 * Written without try/finally so the React Compiler can memoise the table.
 */
export default function AccessUsersPage() {
  const { user: me, setUser } = useAuth()
  const { data, loading, error, reload, setData } = useAsync(
    (options) => accessApi.users(options),
    {
      key: queryKeys.accessUsers,
      staleTime: 30_000,
    },
  )
  const {
    data: roleData,
    loading: rolesLoading,
    error: rolesError,
    reload: reloadRoles,
  } = useAsync((options) => accessApi.roles(options), {
    key: queryKeys.accessRoles,
    staleTime: 30_000,
  })

  const users = Array.isArray(data) ? data : []
  // assignable === true is Admin plus custom roles. Super Admin and the
  // built-in Student role are never offered; the extra checks only guard
  // against a backend that mislabels them.
  const assignable = (Array.isArray(roleData) ? roleData : []).filter(
    (role) =>
      role.assignable === true && role.id !== ROLES.SUPER_ADMIN && role.id !== ROLES.STUDENT,
  )

  // null = closed, {} = adding, an account row = editing that row.
  const [dialog, setDialog] = useState(null)
  const editing = dialog?.id != null ? dialog : null
  const roleLocked = editing?.role === ROLES.SUPER_ADMIN
  // The account awaiting delete confirmation.
  const [removing, setRemoving] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const askDelete = (account) => {
    setRemoving(account)
    setDeleteError('')
  }

  /** Delete, then drop the row from the list — no refetch. */
  const confirmDelete = async () => {
    if (!removing) return
    setDeleting(true)
    setDeleteError('')

    const outcome = await accessApi.deleteUser(removing.id).then(
      () => 'deleted',
      (err) => {
        const code = authErrorCode(err)
        // Already gone: the row is stale, so it goes too.
        if (err?.status === 404 || code === ACCESS_ERROR.USER_NOT_FOUND) return 'missing'
        setDeleteError(ACCESS_ERROR_MESSAGES[code] || err?.message || 'Unable to delete this user.')
        return null
      },
    )

    setDeleting(false)
    if (!outcome) return

    const id = removing.id
    setData((rows) => (Array.isArray(rows) ? rows.filter((row) => row.id !== id) : rows))
    setRemoving(null)
  }

  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const openCreate = () => {
    setDialog({})
    setForm(EMPTY_FORM)
    setErrors({})
    setFormError('')
    // Roles may have been added on the Roles screen since this list loaded.
    reloadRoles()
  }

  const openEdit = (account) => {
    setDialog(account)
    setForm({
      ...EMPTY_FORM,
      first_name: account.first_name || '',
      last_name: account.last_name || '',
      email: account.email || '',
      role_id: roleIdOf(account),
    })
    setErrors({})
    setFormError('')
    reloadRoles()
  }

  const close = () => {
    if (!saving) setDialog(null)
  }

  const update = (key) => (event) => {
    const value = event.target.value
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    setFormError('')
  }

  const save = async () => {
    const validation = validate(form, { editing: !!editing, roleLocked })
    setErrors(validation)
    if (Object.keys(validation).length) return

    setSaving(true)
    setFormError('')

    const names = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
    }
    const request = editing
      ? // A Super Admin's role is locked: sending one is a 409, so leave it out.
        accessApi.updateUser(editing.id, roleLocked ? names : { ...names, role_id: form.role_id })
      : accessApi.createUser({
          ...names,
          email: form.email.trim(),
          password: form.password,
          role_id: form.role_id,
        })

    const saved = await request.catch((err) => {
      const code = authErrorCode(err)
      if (code === ACCESS_ERROR.USER_NOT_FOUND) {
        setFormError('This user no longer exists. The list has been refreshed.')
        reload({ force: true })
      } else if (code === ACCESS_ERROR.SUPER_ADMIN_ROLE_LOCKED) {
        setFormError('A Super Admin’s role cannot be changed.')
      } else if (code === ACCESS_ERROR.EMAIL_TAKEN) {
        setErrors((current) => ({
          ...current,
          email: 'That email is already registered.',
        }))
      } else if (code === ACCESS_ERROR.ROLE_NOT_FOUND) {
        // Deleted since the dropdown loaded: drop it and refetch the list.
        setForm((current) => ({ ...current, role_id: '' }))
        setErrors((current) => ({
          ...current,
          role_id: 'That role no longer exists. Choose another.',
        }))
        reloadRoles({ force: true })
      } else {
        setFormError(
          err?.message || (editing ? 'Unable to save this user.' : 'Unable to create this user.'),
        )
      }
      return null
    })

    setSaving(false)
    if (!saved) return

    setDialog(null)
    if (!editing) {
      reload({ force: true })
      return
    }

    // Swap in the row the server returned, so the badge reflects the new role
    // (Admin, or the custom role's name) without refetching the whole list.
    setData((rows) =>
      Array.isArray(rows)
        ? rows.map((row) => (row.id === editing.id ? { ...row, ...saved } : row))
        : rows,
    )
    // Renaming yourself: the sidebar shows the name from /auth/me.
    if (isSameAccount(me, editing)) {
      setUser((current) =>
        current
          ? {
              ...current,
              name: saved.name ?? current.name,
              first_name: saved.first_name ?? current.first_name,
              last_name: saved.last_name ?? current.last_name,
            }
          : current,
      )
    }
  }

  const addButton = (
    <Button variant="accent" onClick={openCreate} leftIcon={<Icon name="plus" size={17} />}>
      Add user
    </Button>
  )

  return (
    <div className={`${WRAP_APP} py-7 md:py-10`}>
      <PageHeader
        eyebrow="Application Access"
        title="Application Managed Users"
        description="Super Admin, Admin and custom-role logins. Students and evaluators are managed on their own pages."
        actions={addButton}
      />

      {error && (
        <div className="mb-6">
          <Alert variant="danger" title="Unable to load users">
            {error.message}
          </Alert>
        </div>
      )}

      {loading && !data ? (
        <LoadingBlock label="Loading users…" />
      ) : users.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {users.map((account) => (
                <tr key={account.id || account.email}>
                  <td style={{ fontWeight: 600 }}>{displayName(account)}</td>
                  <td className="break-all">{account.email}</td>
                  <td>
                    <RoleBadge account={account} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => openEdit(account)}
                        aria-label={`Edit ${displayName(account)}`}
                      >
                        <Icon name="edit" size={17} />
                      </button>
                      {/* A Super Admin (including you) cannot be deleted. */}
                      {account.role !== ROLES.SUPER_ADMIN && (
                        <button
                          type="button"
                          className="icon-btn icon-btn--danger"
                          onClick={() => askDelete(account)}
                          aria-label={`Delete ${displayName(account)}`}
                          title="Delete user"
                        >
                          <Icon name="trash" size={17} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !error ? (
        <Card>
          <CardBody>
            <EmptyState
              icon="users"
              title="No users yet"
              description="Add a login and choose the role it signs in with."
              action={addButton}
            />
          </CardBody>
        </Card>
      ) : null}

      <Modal
        open={!!dialog}
        onClose={close}
        title={editing ? 'Edit user' : 'Add user'}
        footer={
          <>
            <Button variant="ghost" disabled={saving} onClick={close}>
              Cancel
            </Button>
            <Button variant="accent" loading={saving} onClick={save}>
              {editing ? 'Save changes' : 'Add user'}
            </Button>
          </>
        }
      >
        <div className="stack-md">
          {formError && <Alert variant="danger">{formError}</Alert>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="First name"
              required
              autoComplete="off"
              value={form.first_name}
              onChange={update('first_name')}
              error={errors.first_name}
            />
            <Input
              label="Last name"
              required
              autoComplete="off"
              value={form.last_name}
              onChange={update('last_name')}
              error={errors.last_name}
            />
          </div>
          <Input
            label="Email"
            type="email"
            required={!editing}
            autoComplete="off"
            value={form.email}
            onChange={update('email')}
            error={errors.email}
            readOnly={!!editing}
            disabled={!!editing}
            hint={editing ? 'Email cannot be changed.' : undefined}
          />
          {!editing && (
            <PasswordInput
              label="Password"
              required
              autoComplete="new-password"
              value={form.password}
              onChange={update('password')}
              error={errors.password}
              hint={`At least ${PASSWORD_MIN} characters. Share it with the person securely.`}
            />
          )}
          {roleLocked ? (
            // Shown, not offered: Super Admin is never in the assignable list.
            <Select
              label="Role"
              value={ROLES.SUPER_ADMIN}
              disabled
              hint="A Super Admin’s role cannot be changed."
            >
              <option value={ROLES.SUPER_ADMIN}>Super Admin</option>
            </Select>
          ) : (
            <Select
              label="Role"
              required
              value={form.role_id}
              onChange={update('role_id')}
              error={errors.role_id}
              disabled={rolesLoading && !roleData}
              hint="Admin gets every admin screen except Application Settings and Application Access. Other roles get only their screens."
            >
              <option value="" disabled>
                {rolesLoading && !roleData ? 'Loading roles…' : 'Select role'}
              </option>
              {assignable.map((role) => (
                <option key={role.id} value={String(role.id)}>
                  {role.name}
                </option>
              ))}
            </Select>
          )}
          {rolesError && (
            <Alert variant="warning">
              The role list could not be loaded.{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => reloadRoles({ force: true })}
              >
                Try again
              </button>
            </Alert>
          )}
        </div>
      </Modal>

      <Modal
        open={!!removing}
        onClose={() => !deleting && setRemoving(null)}
        title="Delete user"
        footer={
          <>
            <Button variant="ghost" disabled={deleting} onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={confirmDelete}>
              Delete user
            </Button>
          </>
        }
      >
        <div className="stack-md">
          {deleteError && <Alert variant="danger">{deleteError}</Alert>}
          <p>
            Delete <strong>{removing ? displayName(removing) : ''}</strong>? Their login is removed
            and they cannot sign in again.
          </p>
        </div>
      </Modal>
    </div>
  )
}
