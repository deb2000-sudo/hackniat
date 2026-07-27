import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useAsync } from '../../hooks/useAsync'
import { evaluationApi } from '../../api/evaluation'
import { hackathonsApi } from '../../api/hackathons'
import { formatDate, formatScore } from '../../utils/format'
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
  const { data: hackathons } = useAsync(() => hackathonsApi.list())
  const sessions = useMemo(() => data || [], [data])

  const stats = useMemo(() => {
    const total = sessions.length
    const published = sessions.filter((s) => s.report_published)
    const pending = sessions.filter((s) => !s.report_published).length
    const scored = published.filter((s) => s.overall_score != null)
    const avg = scored.length
      ? scored.reduce((sum, s) => sum + Number(s.overall_score), 0) / scored.length
      : null
    return { total, published: published.length, pending, avg }
  }, [sessions])

  return (
    <div className="container page">
      <PageHeader
        eyebrow={`Welcome, ${user?.name?.split(' ')[0] || 'there'}`}
        title="Your submissions"
        description="Submit demo videos and view reports after they are published."
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
        <StatCard icon="clock" value={stats.pending} label="Results pending" />
        <StatCard icon="checkCircle" value={stats.published} label="Reports published" />
        <StatCard icon="trophy" value={stats.avg != null ? formatScore(stats.avg) : '—'} label="Published average" />
      </div>

      {!!hackathons?.length && (
        <section className="student-released-themes">
          <div className="row-between wrap">
            <div><h2>Released themes</h2><p>Choose one of these themes when creating your submission.</p></div>
            <Button as={Link} to="/hackathons" variant="ghost" size="sm" rightIcon={<Icon name="arrowRight" size={15} />}>View hackathons</Button>
          </div>
          <div className="student-theme-hackathons">
            {hackathons.map((hackathon) => (
              <Card className="student-hackathon-theme-card" key={hackathon.id}>
                <div className="student-hackathon-theme-card__media">
                  {hackathon.banner_url ? (
                    <img src={hackathon.banner_url} alt={`${hackathon.name} banner`} />
                  ) : (
                    <span><Icon name="trophy" size={28} /></span>
                  )}
                </div>
                <CardBody>
                  <div className="student-hackathon-theme-card__title">
                    <div>
                      <strong>{hackathon.name}</strong>
                      <small>
                        <Icon name="calendar" size={13} />
                        {formatDate(hackathon.start_date)} – {formatDate(hackathon.end_date)}
                      </small>
                    </div>
                    {hackathon.hackathon_url && (
                      <a
                        href={hackathon.hackathon_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Official site
                        <Icon name="arrowRight" size={13} />
                      </a>
                    )}
                  </div>
                  <div className="student-hackathon-theme-card__themes">
                    {hackathon.themes?.length ? hackathon.themes.map((theme) => (
                      <span key={theme.id}>{theme.name}</span>
                    )) : <small>No themes released</small>}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      )}

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
          publicationGated
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
