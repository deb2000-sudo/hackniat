import { useMemo, useState } from 'react'
import { adminApi } from '../../api/admin'
import { useAsync } from '../../hooks/useAsync'
import PageHeader from '../../components/layout/PageHeader'
import Card, { CardBody } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Alert from '../../components/ui/Alert'
import Avatar from '../../components/ui/Avatar'
import { RoleBadge, ApprovalBadge } from '../../components/ui/Badge'
import { LoadingBlock } from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import { formatDate } from '../../utils/format'

export default function UsersPage() {
  const { data, loading, error, reload } = useAsync(() => adminApi.getUsers(), [])
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const filtered = useMemo(() => {
    const users = (data || []).filter((user) => user.role === 'student')
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.niat_id?.toLowerCase().includes(q) ||
        u.employee_id?.toLowerCase().includes(q),
    )
  }, [data, query])

  const openEdit = (user) => {
    setEditing(user)
    setName(user.name || '')
    setSaveError('')
  }

  const save = async () => {
    if (!name.trim()) {
      setSaveError('Name cannot be empty.')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      await adminApi.updateUser(editing.id, { name: name.trim() })
      setEditing(null)
      await reload()
    } catch (err) {
      setSaveError(err.message || 'Failed to update user.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container page">
      <PageHeader
        eyebrow="Administration"
        title="Student Management"
        description="View and manage all registered student teams."
        actions={
          <Button variant="secondary" onClick={reload} leftIcon={<Icon name="refresh" size={18} />}>
            Refresh
          </Button>
        }
      />

      <div style={{ maxWidth: 360, marginBottom: 20 }}>
        <div className="input-group">
          <input
            className="input"
            placeholder="Search by name, email or ID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ paddingLeft: 38 }}
          />
          <span
            className="input-group__addon"
            style={{ left: 4, right: 'auto', pointerEvents: 'none' }}
          >
            <Icon name="search" size={18} />
          </span>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 20 }}>
          <Alert variant="danger" title="Failed to load users">
            {error.message}
          </Alert>
        </div>
      )}

      {loading ? (
        <LoadingBlock label="Loading users…" />
      ) : filtered.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Identifier</th>
                <th>Status</th>
                <th>Joined</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="row" style={{ gap: 10 }}>
                      <Avatar name={u.name} size="sm" />
                      <div>
                        <div style={{ fontWeight: 600 }}>{u.name}</div>
                        <div className="text-xs text-muted">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="text-sm mono">{u.niat_id || u.employee_id || '—'}</td>
                  <td>{u.approval_status ? <ApprovalBadge status={u.approval_status} /> : '—'}</td>
                  <td className="text-sm text-muted">{formatDate(u.created_at)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(u)}
                      leftIcon={<Icon name="edit" size={16} />}
                    >
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Card>
          <CardBody>
            <EmptyState icon="users" title="No students found" description="Try a different search." />
          </CardBody>
        </Card>
      )}

      <Modal
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        title="Edit user"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} loading={saving}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="stack-md">
          {saveError && <Alert variant="danger">{saveError}</Alert>}
          <div className="row" style={{ gap: 12 }}>
            <Avatar name={name || editing?.name} />
            <div>
              <div style={{ fontWeight: 600 }}>{editing?.email}</div>
              <div className="text-xs text-muted">{editing?.role}</div>
            </div>
          </div>
          <Input
            label="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
          />
        </div>
      </Modal>
    </div>
  )
}
