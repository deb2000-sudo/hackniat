import { useState } from 'react'
import { adminApi } from '../../api/admin'
import { authErrorCode } from '../../api/authErrors'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import { queryKeys } from '../../lib/queryKeys'
import { invalidateQueries } from '../../lib/queryCache'
import { APPROVAL_STATUS, ROLES } from '../../utils/constants'
import { WRAP_APP } from '../../components/drop/theme'
import PageHeader from '../../components/layout/PageHeader'
import Card, { CardBody, CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import Alert from '../../components/ui/Alert'
import Avatar from '../../components/ui/Avatar'
import Badge, { ApprovalBadge } from '../../components/ui/Badge'
import { LoadingBlock } from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import DeleteUserModal from '../../components/admin/DeleteUserModal'
import UserDetailsModal from '../../components/admin/UserDetailsModal'
import { formatDate } from '../../utils/format'

/** What deleting an evaluator does, shown in the confirmation. */
const EVALUATOR_DELETE_CONSEQUENCES = [
  'Their profile and login are removed — this email can no longer sign in to this account.',
  'Submissions assigned to them stay on the hackathon and become unassigned. No submission is deleted.',
  'They are taken off every hackathon’s evaluator list.',
]

function deleteErrorMessage(err) {
  switch (authErrorCode(err)) {
    case 'EVALUATOR_NOT_FOUND':
    case 'USER_NOT_FOUND':
      return 'This evaluator no longer exists. The list has been refreshed.'
    case 'NOT_AN_EVALUATOR':
      return 'Only evaluator accounts can be deleted here.'
    default:
      return err?.status === 403
        ? 'Only a Super Admin can delete evaluators.'
        : err?.message || 'Unable to delete this evaluator.'
  }
}

/** Drop one evaluator from both lists on the page. */
const withoutEvaluator = (data, id) =>
  data
    ? {
        ...data,
        evaluators: (data.evaluators || []).filter((u) => u.id !== id),
        pending: (data.pending || []).filter((u) => u.id !== id),
      }
    : data

/**
 * Hackathon and submission views that may name this evaluator: their
 * assignments are cleared and they leave each hackathon's evaluator list.
 */
const touchesEvaluator = (key) =>
  /^(hackathon|hackathons|submission|submissions)[:]/.test(key) || key === 'admin:evaluators'

export default function EvaluatorsPage() {
  const { user: me } = useAuth()
  // Deleting an evaluator is Super Admin only; the API refuses anyone else (403).
  const canDelete = me?.role === ROLES.SUPER_ADMIN

  const { data, loading, error, reload, setData } = useAsync(
    async () => {
      const [evaluators, pending] = await Promise.all([
        adminApi.getEvaluators(),
        adminApi.getPendingEvaluators(),
      ])
      return { evaluators, pending }
    },
    { key: queryKeys.adminPendingEvaluators, staleTime: 30_000 },
  )

  const [approvingId, setApprovingId] = useState(null)
  const [actionError, setActionError] = useState('')

  const evaluators = data?.evaluators || []
  const pending = data?.pending || []

  // The evaluator whose details are open, and the one awaiting delete confirmation.
  const [viewing, setViewing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [removing, setRemoving] = useState(false)

  const askDelete = (user) => {
    setDeleting(user)
    setDeleteError('')
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setRemoving(true)
    setDeleteError('')

    const result = await adminApi.deleteEvaluator(deleting.id).then(
      () => 'deleted',
      (err) => {
        setDeleteError(deleteErrorMessage(err))
        const code = authErrorCode(err)
        // Already gone: drop the stale row the same way a delete would.
        return code === 'EVALUATOR_NOT_FOUND' || code === 'USER_NOT_FOUND' ? 'missing' : null
      },
    )

    setRemoving(false)
    if (!result) return
    if (result === 'deleted') setDeleting(null)

    // Overview counts and any cached hackathon / submission view that named
    // this evaluator are now stale.
    invalidateQueries(queryKeys.adminOverview)
    invalidateQueries(touchesEvaluator)

    if (result === 'missing') reload({ force: true })
    else setData((current) => withoutEvaluator(current, deleting.id))
  }

  const approve = async (userId) => {
    setApprovingId(userId)
    setActionError('')
    try {
      await adminApi.approveEvaluator(userId)
      invalidateQueries(queryKeys.adminOverview)
      invalidateQueries(queryKeys.adminPendingEvaluators)
      await reload({ force: true })
    } catch (err) {
      setActionError(err.message || 'Failed to approve evaluator.')
    } finally {
      setApprovingId(null)
    }
  }

  return (
    <div className={`${WRAP_APP} py-7 md:py-10`}>
      <PageHeader
        eyebrow="Administration"
        title="Evaluator Management"
        description="Approve new evaluators and view all evaluator accounts."
        actions={
          <Button variant="secondary" onClick={() => reload({ force: true })} leftIcon={<Icon name="refresh" size={18} />}>
            Refresh
          </Button>
        }
      />

      {error && (
        <div style={{ marginBottom: 20 }}>
          <Alert variant="danger" title="Failed to load evaluators">
            {error.message}
          </Alert>
        </div>
      )}
      {actionError && (
        <div style={{ marginBottom: 20 }}>
          <Alert variant="danger">{actionError}</Alert>
        </div>
      )}

      {loading ? (
        <LoadingBlock label="Loading evaluators…" />
      ) : (
        <div className="stack-lg">
          <Card>
            <CardHeader>
              <h3>Pending approvals {pending.length > 0 && <Badge variant="warning" style={{ marginLeft: 8 }}>{pending.length}</Badge>}</h3>
            </CardHeader>
            <CardBody>
              {pending.length ? (
                <div className="stack-md">
                  {pending.map((u) => (
                    <div className="row-between wrap" key={u.id} style={{ gap: 12 }}>
                      <div className="row" style={{ gap: 12 }}>
                        <Avatar name={u.name} />
                        <div>
                          <div style={{ fontWeight: 600 }}>{u.name}</div>
                          <div className="text-sm text-muted">{u.email}</div>
                          {u.employee_id && (
                            <div className="text-xs text-subtle mono">ID: {u.employee_id}</div>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => approve(u.id)}
                        loading={approvingId === u.id}
                        leftIcon={<Icon name="check" size={16} />}
                      >
                        Approve
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon="checkCircle"
                  title="No pending approvals"
                  description="New evaluator registrations will appear here for review."
                />
              )}
            </CardBody>
          </Card>

          <div>
            <div className="row-between" style={{ marginBottom: 14 }}>
              <h3>All evaluators</h3>
            </div>
            {evaluators.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Evaluator</th>
                      <th>Employee ID</th>
                      <th>Status</th>
                      <th>Joined</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {evaluators.map((u) => (
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
                        <td className="mono text-sm">{u.employee_id || '—'}</td>
                        <td>
                          <ApprovalBadge status={u.approval_status || APPROVAL_STATUS.APPROVED} />
                        </td>
                        <td className="text-sm text-muted">{formatDate(u.created_at)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setViewing(u)}
                              leftIcon={<Icon name="eye" size={16} />}
                            >
                              View details
                            </Button>
                            {canDelete && (
                              <button
                                type="button"
                                className="icon-btn icon-btn--danger"
                                onClick={() => askDelete(u)}
                                aria-label={`Delete ${u.name || u.email}`}
                                title="Delete evaluator"
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
            ) : (
              <Card>
                <CardBody>
                  <EmptyState icon="shield" title="No evaluators yet" />
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      )}

      {viewing && (
        <UserDetailsModal
          key={viewing.id}
          variant="evaluator"
          user={viewing}
          onClose={() => setViewing(null)}
          onDelete={
            canDelete
              ? (user) => {
                  setViewing(null)
                  askDelete(user)
                }
              : undefined
          }
        />
      )}

      <DeleteUserModal
        account={deleting}
        title="Delete evaluator"
        consequences={EVALUATOR_DELETE_CONSEQUENCES}
        error={deleteError}
        deleting={removing}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
