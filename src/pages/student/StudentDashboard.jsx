import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useAsync } from '../../hooks/useAsync'
import { evaluationApi } from '../../api/evaluation'
import { EVALUATION_STATUS } from '../../utils/constants'
import { formatScore } from '../../utils/format'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import Card, { CardBody } from '../../components/ui/Card'
import StatCard from '../../components/ui/StatCard'
import EmptyState from '../../components/ui/EmptyState'
import SessionTable from '../../components/evaluation/SessionTable'
import Alert from '../../components/ui/Alert'
import { LoadingBlock } from '../../components/ui/Spinner'

export default function StudentDashboard() {
  const { user } = useAuth()
  const { data, loading, error, reload } = useAsync(() => evaluationApi.listSubmissions())
  const sessions = useMemo(() => data || [], [data])

  const stats = useMemo(() => {
    const total = sessions.length
    const completed = sessions.filter((s) => s.status === EVALUATION_STATUS.COMPLETED)
    const inProgress = sessions.filter(
      (s) => s.status === EVALUATION_STATUS.PROCESSING || s.status === EVALUATION_STATUS.UPLOADED,
    ).length
    const scored = completed.filter((s) => s.overall_score != null)
    const avg = scored.length
      ? scored.reduce((sum, s) => sum + Number(s.overall_score), 0) / scored.length
      : null
    return { total, completed: completed.length, inProgress, avg }
  }, [sessions])

  return (
    <div className="container page">
      <PageHeader
        eyebrow={`Welcome, ${user?.name?.split(' ')[0] || 'there'}`}
        title="Your submissions"
        description="Upload demo videos and track their AI evaluations."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={reload}
              loading={loading}
              leftIcon={<Icon name="refresh" size={18} />}
            >
              Refresh
            </Button>
            <Button as={Link} to="/student/submission" variant="accent" leftIcon={<Icon name="upload" size={18} />}>
              New submission
            </Button>
          </>
        }
      />

      {error && (
        <div style={{ marginBottom: 24 }}>
          <Alert variant="danger" title="Unable to load submissions">
            {error.message}
          </Alert>
        </div>
      )}

      <div className="grid grid-4" style={{ marginBottom: 28 }}>
        <StatCard icon="video" value={stats.total} label="Total submissions" />
        <StatCard icon="checkCircle" value={stats.completed} label="Completed" />
        <StatCard icon="clock" value={stats.inProgress} label="In progress" />
        <StatCard icon="trophy" value={stats.avg != null ? formatScore(stats.avg) : '—'} label="Average score" />
      </div>

      <div className="row-between" style={{ marginBottom: 14 }}>
        <h3>Recent submissions</h3>
      </div>
      {loading && !data ? (
        <LoadingBlock label="Loading submissions…" />
      ) : sessions.length ? (
        <SessionTable
          sessions={sessions}
          detailPath={(s) => `/student/submissions/${s.id}`}
          actionLabel="View video"
        />
      ) : (
        <Card>
          <CardBody>
            <EmptyState
              icon="upload"
              title="No submissions yet"
              description="Upload your first hackathon demo video to get an AI evaluation."
              action={
                <Button as={Link} to="/student/submission" variant="accent" leftIcon={<Icon name="upload" size={18} />}>
                  New submission
                </Button>
              }
            />
          </CardBody>
        </Card>
      )}
    </div>
  )
}
