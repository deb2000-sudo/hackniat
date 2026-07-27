import { Link } from 'react-router-dom'
import { adminApi } from '../../api/admin'
import { hackathonsApi } from '../../api/hackathons'
import { useAsync } from '../../hooks/useAsync'
import { ROLES } from '../../utils/constants'
import { formatDate } from '../../utils/format'
import { getHackathonStatus } from '../../utils/hackathons'
import PageHeader from '../../components/layout/PageHeader'
import StatCard from '../../components/ui/StatCard'
import Card, { CardBody, CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import Alert from '../../components/ui/Alert'
import { LoadingBlock } from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import Badge, { RoleBadge } from '../../components/ui/Badge'
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
  const {
    data: hackathonData,
    loading: hackathonsLoading,
    error: hackathonsError,
    reload: reloadHackathons,
  } = useAsync(() => hackathonsApi.list())

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
  const hackathons = [...(hackathonData || [])].sort((a, b) =>
    String(a.start_date || '').localeCompare(String(b.start_date || '')),
  )

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

      <div className="grid grid-4 admin-overview-stats" style={{ marginBottom: 28 }}>
        <StatCard icon="users" value={users.length} label="Total users" />
        <StatCard icon="user" value={students.length} label="Students" />
        <StatCard icon="shield" value={evaluators.length} label="Evaluators" />
        <StatCard icon="clock" value={pending.length} label="Pending approvals" />
        <StatCard icon="calendar" value={hackathonData?.length ?? '—'} label="Hackathons" />
      </div>

      <Card className="admin-hackathons-card">
        <CardHeader className="admin-hackathons-card__header">
          <div>
            <h3>Hackathons</h3>
            <p className="text-sm text-muted">All events currently available on the platform.</p>
          </div>
          <div className="row admin-hackathons-card__actions">
            <Button
              variant="ghost"
              size="sm"
              onClick={reloadHackathons}
              loading={hackathonsLoading}
              leftIcon={<Icon name="refresh" size={16} />}
            >
              Refresh
            </Button>
            <Button as={Link} to="/admin/hackathons/new" variant="accent" size="sm" leftIcon={<Icon name="plus" size={16} />}>
              Create hackathon
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {hackathonsError ? (
            <Alert variant="danger" title="Unable to load hackathons">
              <div className="stack-sm">
                <span>{hackathonsError.message}</span>
                <Button variant="secondary" size="sm" onClick={reloadHackathons}>Try again</Button>
              </div>
            </Alert>
          ) : hackathonsLoading && !hackathonData ? (
            <LoadingBlock label="Loading hackathons…" />
          ) : hackathons.length ? (
            <div className="admin-hackathon-list">
              {hackathons.map((hackathon) => {
                const eventStatus = getHackathonStatus(hackathon)
                return (
                  <div className="admin-hackathon-row" key={hackathon.id}>
                    <div className="admin-hackathon-row__icon" aria-hidden="true">
                      <Icon name="trophy" size={20} />
                    </div>
                    <div className="admin-hackathon-row__details">
                      <Link to={`/hackathons/${hackathon.id}`} className="admin-hackathon-row__name">
                        {hackathon.name}
                      </Link>
                      <span className="text-sm text-muted">
                        <Icon name="calendar" size={14} />
                        {formatDate(hackathon.start_date)} – {formatDate(hackathon.end_date)}
                      </span>
                    </div>
                    <Badge variant={eventStatus.variant} dot>{eventStatus.label}</Badge>
                    <div className="admin-hackathon-row__controls">
                      <Button as={Link} to={`/admin/hackathons/${hackathon.id}/edit`} variant="ghost" size="sm" leftIcon={<Icon name="edit" size={15} />}>
                        Edit
                      </Button>
                      <Button as={Link} to={`/hackathons/${hackathon.id}`} variant="secondary" size="sm" rightIcon={<Icon name="arrowRight" size={15} />}>
                        View
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState
              icon="calendar"
              title="No hackathons yet"
              description="Create the first hackathon and it will appear here for every authenticated role."
              action={(
                <Button as={Link} to="/admin/hackathons/new" variant="accent" leftIcon={<Icon name="plus" size={18} />}>
                  Create hackathon
                </Button>
              )}
            />
          )}
        </CardBody>
      </Card>

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
            <Button as={Link} to="/hackathons" variant="secondary" block leftIcon={<Icon name="calendar" size={18} />}>
              Manage hackathons
            </Button>
            <Button as={Link} to="/admin/themes" variant="secondary" block leftIcon={<Icon name="sparkles" size={18} />}>
              Manage themes
            </Button>
            <Button as={Link} to="/admin/users" variant="secondary" block leftIcon={<Icon name="users" size={18} />}>
              Student management
            </Button>
            <Button as={Link} to="/admin/evaluators" variant="secondary" block leftIcon={<Icon name="shield" size={18} />}>
              Evaluator management
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
