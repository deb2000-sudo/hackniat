import { useEffect, useState } from 'react'
import { adminApi } from '../../api/admin'
import { useAsync } from '../../hooks/useAsync'
import { queryKeys } from '../../lib/queryKeys'
import { WRAP_APP } from '../../components/drop/theme'
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
import Pagination from '../../components/ui/Pagination'
import { formatDate } from '../../utils/format'

/** Rows per page of the Student Management table. */
const PAGE_SIZE = 15

/** How long typing pauses before the search is sent. */
const SEARCH_DELAY_MS = 300

const matchesSearch = (user, needle) =>
  [user.name, user.email, user.niat_id, user.employee_id, user.id].some((value) =>
    String(value || '').toLowerCase().includes(needle),
  )

/**
 * One page of students in a single shape, whichever backend answered.
 *
 * A paging backend returns `{ items, total }` already filtered to students and
 * searched, so it is used as is. An older one ignores the params and returns
 * every user as an array; then the students are picked out, searched and
 * sliced here, newest first like the paged response.
 */
function toStudentPage(payload, page, search) {
  if (!Array.isArray(payload)) {
    return {
      rows: Array.isArray(payload?.items) ? payload.items : [],
      total: Number(payload?.total) || 0,
    }
  }
  const needle = search.toLowerCase()
  const students = payload
    .filter((user) => user.role === 'student')
    .filter((user) => !needle || matchesSearch(user, needle))
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
  const start = (page - 1) * PAGE_SIZE
  return { rows: students.slice(start, start + PAGE_SIZE), total: students.length }
}

export default function UsersPage() {
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // Search once typing pauses, from the first page.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim())
      setPage(1)
    }, SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [query])

  // Keyed per page and search — never queryKeys.adminUsers, which the
  // dashboard prefetch fills with the full user array.
  const pageKey = queryKeys.adminStudentsPage(page, search)
  const { data, loading, error, reload } = useAsync(
    async (opts) => {
      const payload = await adminApi.getUsersPage(
        { page, page_size: PAGE_SIZE, role: 'student', q: search || undefined },
        opts,
      )
      // Tagged with its key: on a page change useAsync keeps the previous
      // rows without flagging a load, and the tag is how the table knows to dim.
      return { key: pageKey, ...toStudentPage(payload, page, search) }
    },
    { key: pageKey, staleTime: 30_000 },
  )

  const rows = data?.rows || []
  const total = data?.total || 0
  const stale = Boolean(data) && data.key !== pageKey
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  // A page that emptied out (after an edit, or a smaller search) steps back
  // to the last page that still has rows.
  if (data && !stale && !loading && page > totalPages) setPage(totalPages)

  const [editing, setEditing] = useState(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

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
      // Same page, fresh from the server — the edit may change the search match.
      reload({ force: true })
    } catch (err) {
      setSaveError(err.message || 'Failed to update user.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`${WRAP_APP} py-7 md:py-10`}>
      <PageHeader
        eyebrow="Administration"
        title="Student Management"
        description="View and manage all registered student teams."
        actions={
          <Button variant="secondary" onClick={() => reload({ force: true })} leftIcon={<Icon name="refresh" size={18} />}>
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
            aria-label="Search students"
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

      {!data && loading ? (
        <LoadingBlock label="Loading students…" />
      ) : rows.length ? (
        <>
        <div
          className={`table-wrap transition-opacity ${stale || loading ? 'opacity-60' : ''}`}
          aria-busy={stale || loading}
        >
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
              {rows.map((u) => (
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
        <Pagination
          page={page}
          total={total}
          pageSize={PAGE_SIZE}
          disabled={stale || loading}
          label="Student pages"
          onChange={setPage}
        />
        </>
      ) : !error ? (
        <Card>
          <CardBody>
            <EmptyState
              icon="users"
              title="No students found"
              description={search ? 'Try a different search.' : 'Registered students will appear here.'}
            />
          </CardBody>
        </Card>
      ) : null}

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
