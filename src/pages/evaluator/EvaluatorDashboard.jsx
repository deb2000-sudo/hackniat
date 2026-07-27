import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { evaluationApi } from '../../api/evaluation'
import { useAsync } from '../../hooks/useAsync'
import { formatDate } from '../../utils/format'
import PageHeader from '../../components/layout/PageHeader'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Card, { CardBody } from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Icon from '../../components/ui/Icon'
import Input from '../../components/ui/Input'
import { LoadingBlock } from '../../components/ui/Spinner'

export default function EvaluatorDashboard() {
  const { data, loading, error, reload } = useAsync(() =>
    evaluationApi.listEvaluatorHackathons(),
  )
  const [query, setQuery] = useState('')

  const hackathons = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return [...(data || [])]
      .filter((hackathon) => !needle || String(hackathon.name || '').toLowerCase().includes(needle))
      .sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
  }, [data, query])

  const totalAssigned = (data || []).reduce(
    (sum, hackathon) => sum + Number(hackathon.submission_count || 0),
    0,
  )

  return (
    <div className="container page admin-submissions-page">
      <PageHeader
        eyebrow="Evaluator workspace"
        title="Assigned submissions"
        description="Choose a hackathon to review the teams assigned to you."
        actions={
          <Button
            variant="secondary"
            onClick={reload}
            loading={loading}
            leftIcon={<Icon name="refresh" size={17} />}
          >
            Refresh
          </Button>
        }
      />

      <div className="admin-submission-overview">
        <div>
          <span><Icon name="trophy" size={20} /></span>
          <div><strong>{data?.length || 0}</strong><small>Hackathons</small></div>
        </div>
        <div>
          <span><Icon name="clipboard" size={20} /></span>
          <div><strong>{totalAssigned}</strong><small>Assigned teams</small></div>
        </div>
        <div className="admin-submission-overview__search">
          <Icon name="search" size={17} />
          <Input
            aria-label="Search assigned hackathons"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search hackathons"
          />
        </div>
      </div>

      {error && (
        <Alert variant="danger" title="Unable to load assigned hackathons">
          {error.message}
        </Alert>
      )}

      {loading && !data ? (
        <LoadingBlock label="Loading assigned hackathons…" />
      ) : hackathons.length ? (
        <div className="admin-submission-hackathons">
          {hackathons.map((hackathon) => {
            const id = hackathon.hackathon_id || hackathon.id
            return (
              <Card className="admin-submission-hackathon-card" key={id}>
                <div className="admin-submission-hackathon-card__media">
                  {hackathon.banner_url ? (
                    <img src={hackathon.banner_url} alt="" />
                  ) : (
                    <div><Icon name="trophy" size={34} /></div>
                  )}
                  <span>
                    <strong>{hackathon.submission_count || 0}</strong>
                    assigned
                  </span>
                </div>
                <CardBody>
                  <div>
                    <h2>{hackathon.name}</h2>
                    <p>
                      <Icon name="calendar" size={15} />
                      {formatDate(hackathon.start_date)} – {formatDate(hackathon.end_date)}
                    </p>
                  </div>
                  <Button
                    as={Link}
                    to={`/evaluator/hackathons/${id}`}
                    variant="accent"
                    rightIcon={<Icon name="arrowRight" size={17} />}
                  >
                    View assignments
                    <span className="admin-submission-count">{hackathon.submission_count || 0}</span>
                  </Button>
                </CardBody>
              </Card>
            )
          })}
        </div>
      ) : !error ? (
        <Card>
          <CardBody>
            <EmptyState
              icon="clipboard"
              title={query ? 'No matching hackathons' : 'No submissions assigned yet'}
              description={
                query
                  ? 'Try another search term.'
                  : 'Hackathons will appear here after an administrator assigns submissions to you.'
              }
            />
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}
