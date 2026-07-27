import { useState } from 'react'
import { adminApi } from '../../api/admin'
import { useAsync } from '../../hooks/useAsync'
import { APPROVAL_STATUS } from '../../utils/constants'
import PageHeader from '../../components/layout/PageHeader'
import Card, { CardBody, CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import Alert from '../../components/ui/Alert'
import Avatar from '../../components/ui/Avatar'
import { ApprovalBadge } from '../../components/ui/Badge'
import { LoadingBlock } from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import { formatDate } from '../../utils/format'

export default function EvaluatorsPage() {
  const { data, loading, error, reload } = useAsync(async () => {
    const [evaluators, pending] = await Promise.all([
      adminApi.getEvaluators(),
      adminApi.getPendingEvaluators(),
    ])
    return { evaluators, pending }
  }, [])

  const [approvingId, setApprovingId] = useState(null)
  const [actionError, setActionError] = useState('')

  const evaluators = data?.evaluators || []
  const pending = data?.pending || []

  const approve = async (userId) => {
    setApprovingId(userId)
    setActionError('')
    try {
      await adminApi.approveEvaluator(userId)
      await reload()
    } catch (err) {
      setActionError(err.message || 'Failed to approve evaluator.')
    } finally {
      setApprovingId(null)
    }
  }

  return (
    <div className="container page">
      <PageHeader
        eyebrow="Administration"
        title="Evaluator Management"
        description="Approve new evaluators and view all evaluator accounts."
        actions={
          <Button variant="secondary" onClick={reload} leftIcon={<Icon name="refresh" size={18} />}>
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
              <h3>Pending approvals {pending.length > 0 && <span className="badge badge--warning" style={{ marginLeft: 8 }}>{pending.length}</span>}</h3>
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
    </div>
  )
}
