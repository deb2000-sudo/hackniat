import { useState } from 'react'
import { ACCESS_ERROR, accessApi } from '../../../api/access'
import { authErrorCode } from '../../../api/authErrors'
import { useAsync } from '../../../hooks/useAsync'
import { queryKeys } from '../../../lib/queryKeys'
import { SUPER_ADMIN_ONLY } from '../../../utils/access'
import { WRAP_APP } from '../../../components/drop/theme'
import PageHeader from '../../../components/layout/PageHeader'
import Alert from '../../../components/ui/Alert'
import Badge from '../../../components/ui/Badge'
import Button from '../../../components/ui/Button'
import Card, { CardBody } from '../../../components/ui/Card'
import EmptyState from '../../../components/ui/EmptyState'
import Icon from '../../../components/ui/Icon'
import Input from '../../../components/ui/Input'
import Modal from '../../../components/ui/Modal'
import modalStyles from '../../../components/ui/Modal.module.css'
import { LoadingBlock } from '../../../components/ui/Spinner'
import styles from './AccessRolesPage.module.css'

/** Checkbox groups, in the order they are shown. Unknown groups follow. */
const GROUP_ORDER = ['Administration', 'General Management']

function saveErrorMessage(err, name) {
  switch (authErrorCode(err)) {
    case ACCESS_ERROR.ROLE_EXISTS:
      return `A role named “${name}” already exists.`
    case ACCESS_ERROR.ROLE_RESERVED:
      return `“${name}” is a reserved role name. Choose a different one.`
    case ACCESS_ERROR.ROLE_BUILTIN:
      return 'Built-in roles cannot be changed.'
    default:
      return err?.message || 'Unable to save this role.'
  }
}

function deleteErrorMessage(err) {
  switch (authErrorCode(err)) {
    case ACCESS_ERROR.ROLE_IN_USE:
      return 'This role is still assigned to at least one user, so it cannot be deleted.'
    case ACCESS_ERROR.ROLE_BUILTIN:
      return 'Built-in roles cannot be deleted.'
    default:
      return err?.message || 'Unable to delete this role.'
  }
}

/** Built-in rows lead, in this order; custom roles follow in API order. */
const BUILT_IN_ORDER = ['admin', 'student']

function builtInRank(role) {
  if (!role.built_in) return BUILT_IN_ORDER.length + 1
  const index = BUILT_IN_ORDER.indexOf(String(role.id))
  return index === -1 ? BUILT_IN_ORDER.length : index
}

/** The Screens cell for a read-only built-in role. */
function builtInScreens(role) {
  // Admin's screens are fixed and not listed as permissions on the row.
  if (String(role.id) === 'admin') {
    return 'Every admin screen except Application Settings and Application Access'
  }
  // Student (and any later built-in) describes itself.
  return role.summary || '—'
}

function sameSet(a, b) {
  return a.length === b.length && a.every((key) => b.includes(key))
}

/**
 * Super Admin: define roles and which admin screens each may open.
 *
 * The built-in Admin and Student roles are listed first and are read-only:
 * Admin so it is clear it exists and can be assigned, Student because it is
 * the role registration gives. Super Admin-only screens (Application Settings,
 * the Access screens) are never offered as checkboxes.
 *
 * Written without try/finally so the React Compiler can memoise the table.
 */
export default function AccessRolesPage() {
  const {
    data: permissionData,
    loading: permissionsLoading,
    error: permissionsError,
  } = useAsync((options) => accessApi.permissions(options), {
    key: queryKeys.accessPermissions,
    staleTime: 5 * 60_000,
  })
  const { data, loading, error, reload } = useAsync((options) => accessApi.roles(options), {
    key: queryKeys.accessRoles,
    staleTime: 30_000,
  })

  const permissions = (Array.isArray(permissionData) ? permissionData : []).filter(
    // The API no longer lists Super Admin-only screens; this only guards
    // against an older backend that still does. Never add them back.
    (permission) => !SUPER_ADMIN_ONLY.includes(permission.key),
  )
  const labelFor = Object.fromEntries(permissions.map((permission) => [permission.key, permission.label]))
  const groups = [
    ...GROUP_ORDER,
    ...new Set(permissions.map((permission) => permission.group).filter((g) => !GROUP_ORDER.includes(g))),
  ]
    .map((group) => ({ group, items: permissions.filter((permission) => permission.group === group) }))
    .filter(({ items }) => items.length)

  // Array.sort is stable, so custom roles keep the order the API sent.
  const roles = (Array.isArray(data) ? [...data] : []).sort(
    (a, b) => builtInRank(a) - builtInRank(b),
  )
  const customCount = roles.filter((role) => !role.built_in).length

  const [editing, setEditing] = useState(null)
  const [name, setName] = useState('')
  const [selected, setSelected] = useState([])
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const openCreate = () => {
    setEditing({})
    setName('')
    setSelected([])
    setFormError('')
  }

  const openEdit = (role) => {
    setEditing(role)
    setName(role.name || '')
    setSelected(
      (Array.isArray(role.permissions) ? role.permissions : []).filter(
        (key) => !SUPER_ADMIN_ONLY.includes(key),
      ),
    )
    setFormError('')
  }

  const toggle = (key) => {
    setSelected((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key],
    )
  }

  /** Tick every screen in a group, or clear the group if all are ticked. */
  const toggleGroup = (items) => {
    const keys = items.map((permission) => permission.key)
    const allOn = keys.every((key) => selected.includes(key))
    setSelected((current) =>
      allOn ? current.filter((key) => !keys.includes(key)) : [...new Set([...current, ...keys])],
    )
  }

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setFormError('Role name is required.')
      return
    }
    if (!selected.length) {
      setFormError('Choose at least one screen this role can open.')
      return
    }

    // On edit, send only what changed.
    let request
    if (editing?.id) {
      const payload = {}
      if (trimmed !== editing.name) payload.name = trimmed
      if (!sameSet(selected, editing.permissions || [])) payload.permissions = selected
      if (!Object.keys(payload).length) {
        setEditing(null)
        return
      }
      request = accessApi.updateRole(editing.id, payload)
    } else {
      request = accessApi.createRole({ name: trimmed, permissions: selected })
    }

    setSaving(true)
    setFormError('')
    const saved = await request.catch((err) => {
      setFormError(saveErrorMessage(err, trimmed))
      return null
    })
    setSaving(false)
    if (!saved) return

    setEditing(null)
    reload({ force: true })
  }

  const remove = async () => {
    if (!deleting) return
    setSaving(true)
    setFormError('')

    const done = await accessApi.deleteRole(deleting.id).then(
      () => true,
      (err) => {
        setFormError(deleteErrorMessage(err))
        return false
      },
    )

    setSaving(false)
    if (!done) return

    setDeleting(null)
    reload({ force: true })
  }

  const addButton = (
    <Button variant="accent" onClick={openCreate} leftIcon={<Icon name="plus" size={17} />}>
      Add role
    </Button>
  )

  return (
    <div className={`${WRAP_APP} py-7 md:py-10`}>
      <PageHeader
        eyebrow="Application Access"
        title="Application Managed Roles"
        description="Choose which admin screens each role can open. Assign roles to people under Application Managed Users."
        actions={addButton}
      />

      {(error || permissionsError) && (
        <div className="mb-6">
          <Alert variant="danger" title="Unable to load roles">
            {(error || permissionsError).message}
          </Alert>
        </div>
      )}

      {loading && !data ? (
        <LoadingBlock label="Loading roles…" />
      ) : roles.length ? (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Screens</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id}>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        <span style={{ fontWeight: 600 }}>{role.name}</span>
                        {role.built_in && <Badge variant="neutral">Built-in</Badge>}
                      </div>
                    </td>
                    <td className="text-sm text-muted">
                      {role.built_in
                        ? builtInScreens(role)
                        : (role.permissions || [])
                            .filter((key) => !SUPER_ADMIN_ONLY.includes(key))
                            .map((key) => labelFor[key] || key)
                            .join(', ') || '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {/* Built-in roles (Admin, Student) are fixed: the API
                          refuses edits and deletes with ROLE_BUILTIN. */}
                      {!role.built_in && (
                        <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => openEdit(role)}
                            disabled={permissionsLoading && !permissionData}
                            aria-label={`Edit ${role.name}`}
                          >
                            <Icon name="edit" size={17} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn icon-btn--danger"
                            onClick={() => {
                              setFormError('')
                              setDeleting(role)
                            }}
                            aria-label={`Delete ${role.name}`}
                          >
                            <Icon name="trash" size={17} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!customCount && (
            <p className="mt-3 text-sm text-muted">
              No custom roles yet. Add one to give someone access to only some admin screens.
            </p>
          )}
        </>
      ) : !error ? (
        <Card>
          <CardBody>
            <EmptyState
              icon="shield"
              title="No roles yet"
              description="Add a role to give someone access to only some admin screens."
              action={addButton}
            />
          </CardBody>
        </Card>
      ) : null}

      <Modal
        open={!!editing}
        className={modalStyles.wide}
        onClose={() => !saving && setEditing(null)}
        title={editing?.id ? 'Edit role' : 'Add role'}
        footer={
          <>
            <Button variant="ghost" disabled={saving} onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button variant="accent" loading={saving} onClick={save}>
              {editing?.id ? 'Save changes' : 'Add role'}
            </Button>
          </>
        }
      >
        <div className="stack-md">
          {formError && <Alert variant="danger">{formError}</Alert>}
          <Input
            label="Role name"
            required
            maxLength={100}
            autoComplete="off"
            value={name}
            onChange={(event) => setName(event.target.value)}
            hint="Cannot be Super Admin, Admin, Evaluator, Student or Custom."
            placeholder="Content Manager"
          />
          {permissionsLoading && !permissionData ? (
            <LoadingBlock label="Loading screens…" />
          ) : (
            <>
              <div className={styles.summary} aria-live="polite">
                <span>
                  <strong>{selected.length}</strong> of {permissions.length} screens selected
                </span>
                <span>People with this role see only these screens in the sidebar.</span>
              </div>
              {groups.map(({ group, items }) => {
                const count = items.filter((permission) => selected.includes(permission.key)).length
                const headingId = `role-group-${group.replace(/\W+/g, '-').toLowerCase()}`
                return (
                  <fieldset key={group} className={styles.group} aria-labelledby={headingId}>
                    <div className={styles.groupHeader}>
                      <span id={headingId} className={styles.groupTitle}>
                        {group}
                        <span className={styles.groupCount}>
                          {count}/{items.length}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="link-btn text-sm"
                        disabled={saving}
                        onClick={() => toggleGroup(items)}
                      >
                        {count === items.length ? 'Clear all' : 'Select all'}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                      {items.map((permission) => {
                        const checked = selected.includes(permission.key)
                        return (
                          <label
                            key={permission.key}
                            className={styles.option}
                            data-checked={checked}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={saving}
                              onChange={() => toggle(permission.key)}
                            />
                            <span className="min-w-0">{permission.label}</span>
                          </label>
                        )
                      })}
                    </div>
                  </fieldset>
                )
              })}
            </>
          )}
        </div>
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => !saving && setDeleting(null)}
        title="Delete role"
        footer={
          <>
            <Button variant="ghost" disabled={saving} onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={saving} onClick={remove}>
              Delete role
            </Button>
          </>
        }
      >
        <div className="stack-md">
          {formError && <Alert variant="danger">{formError}</Alert>}
          <p>
            Delete <strong>{deleting?.name}</strong>? A role that is still assigned to someone
            cannot be deleted.
          </p>
        </div>
      </Modal>
    </div>
  )
}
