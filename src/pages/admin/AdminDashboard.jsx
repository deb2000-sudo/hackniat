import { Link } from 'react-router-dom'
import { adminApi } from '../../api/admin'
import { useAsync } from '../../hooks/useAsync'
import { ROLES } from '../../utils/constants'
import PageHeader from '../../components/layout/PageHeader'
import StatCard from '../../components/ui/StatCard'
import Card, { CardBody, CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import Alert from '../../components/ui/Alert'
import { LoadingBlock } from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import { RoleBadge } from '../../components/ui/Badge'
import Avatar from '../../components/ui/Avatar'

export default function AdminDashboard() {
  const { data, loading, error } = useAsync(async () => {
    const [users, evaluators, pending] = await Promise.all([
      adminApi.getUsers(),
      adminApi.getEvaluators(),
      adminApi.getPendingEvaluators(),
    ])
    return { users, evaluators, pending }
  }, [])

  if (loading) {
    return (
      <div className="container page">
        <LoadingBlock label="Loading overview…" />
      </div>
    )
  }

  const users = data?.users || []
  const evaluators = data?.evaluators || []
  const pending = data?.pending || []
  const students = users.filter((u) => u.role === ROLES.STUDENT)

  return (
    <div className="container page">
      <PageHeader
        eyebrow="Administration"
        title="Overview"
        description="Manage users and evaluator approvals across HackNIAT."
      />

      {error && (
        <div style={{ marginBottom: 20 }}>
          <Alert variant="danger" title="Failed to load data">
            {error.message}
          </Alert>
        </div>
      )}

      <div className="grid grid-4" style={{ marginBottom: 28 }}>
        <StatCard icon="users" value={users.length} label="Total users" />
        <StatCard icon="user" value={students.length} label="Students" />
        <StatCard icon="shield" value={evaluators.length} label="Evaluators" />
        <StatCard icon="clock" value={pending.length} label="Pending approvals" />
      </div>

      <div className="grid grid-2">
        <Card>
          <CardHeader>
            <h3>Pending evaluator approvals</h3>
            <Button as={Link} to="/admin/evaluators" variant="ghost" size="sm" rightIcon={<Icon name="arrowRight" size={16} />}>
              Manage
            </Button>
          </CardHeader>
          <CardBody>
            {pending.length ? (
              <div className="stack-md">
                {pending.slice(0, 5).map((u) => (
                  <div className="row-between" key={u.id}>
                    <div className="row" style={{ gap: 10 }}>
                      <Avatar name={u.name} size="sm" />
                      <div>
                        <div style={{ fontWeight: 600 }}>{u.name}</div>
                        <div className="text-xs text-muted">{u.email}</div>
                      </div>
                    </div>
                    <RoleBadge role={u.role} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon="checkCircle" title="All caught up" description="No evaluators are awaiting approval." />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3>Quick actions</h3>
          </CardHeader>
          <CardBody className="stack-md">
            <Button as={Link} to="/admin/users" variant="secondary" block leftIcon={<Icon name="users" size={18} />}>
              Manage all users
            </Button>
            <Button as={Link} to="/admin/evaluators" variant="secondary" block leftIcon={<Icon name="shield" size={18} />}>
              Manage evaluators
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
