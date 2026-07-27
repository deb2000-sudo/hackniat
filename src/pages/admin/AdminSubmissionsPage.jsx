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

export default function AdminSubmissionsPage() {
  const { data, loading, error, reload } = useAsync(async () => {
    const [hackathons, submissions] = await Promise.all([
      evaluationApi.listSubmissionHackathons(),
      evaluationApi.listAllSubmissions(),
    ])
    const evaluatedByHackathon = submissions.reduce((counts, submission) => {
      if (submission.status !== 'completed' || !submission.hackathon_id) return counts
      counts.set(
        submission.hackathon_id,
        (counts.get(submission.hackathon_id) || 0) + 1,
      )
      return counts
    }, new Map())
    return hackathons.map((hackathon) => ({
      ...hackathon,
      evaluated_count: evaluatedByHackathon.get(hackathon.hackathon_id) || 0,
    }))
  })
  const [query, setQuery] = useState('')

  const hackathons = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return [...(data || [])]
      .filter((hackathon) => !needle || hackathon.name.toLowerCase().includes(needle))
      .sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
  }, [data, query])

  return (
    <div className="container page admin-submissions-page">
      <PageHeader
        eyebrow="Admin review"
        title="Submissions by hackathon"
        description="Choose a hackathon to review its teams, run analysis, and publish reports."
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
        <div className="admin-submission-overview__search">
          <Icon name="search" size={17} />
          <Input
            aria-label="Search hackathons"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search hackathons"
          />
        </div>
      </div>

      {error && (
        <Alert variant="danger" title="Unable to load submission hackathons">
          {error.message}
        </Alert>
      )}

      {loading && !data ? (
        <LoadingBlock label="Loading hackathons and submission counts…" />
      ) : hackathons.length ? (
        <div className="admin-submission-hackathons">
          {hackathons.map((hackathon) => (
            <Card className="admin-submission-hackathon-card" key={hackathon.hackathon_id}>
              <div className="admin-submission-hackathon-card__media">
                {hackathon.banner_url ? (
                  <img src={hackathon.banner_url} alt="" />
                ) : (
                  <div><Icon name="trophy" size={34} /></div>
                )}
                <span>
                  <strong>{hackathon.submission_count || 0}</strong>
                  submissions
                </span>
              </div>
              <CardBody>
                <div className="admin-submission-hackathon-card__title">
                  <h2>{hackathon.name}</h2>
                  <p>
                    <Icon name="calendar" size={15} />
                    {formatDate(hackathon.start_date)} – {formatDate(hackathon.end_date)}
                  </p>
                </div>
                <div className="admin-submission-hackathon-card__metrics">
                  <span>
                    <strong>{hackathon.evaluated_count || 0}</strong>
                    Evaluated
                  </span>
                  <span>
                    <strong>
                      {Math.max(
                        0,
                        Number(hackathon.submission_count || 0) -
                          Number(hackathon.evaluated_count || 0),
                      )}
                    </strong>
                    Awaiting evaluation
                  </span>
                </div>
                <Button
                  as={Link}
                  to={`/admin/submissions/hackathons/${hackathon.hackathon_id}`}
                  variant="accent"
                  rightIcon={<Icon name="arrowRight" size={17} />}
                >
                  View submissions
                  <span className="admin-submission-count">{hackathon.submission_count || 0}</span>
                </Button>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : !error ? (
        <Card>
          <CardBody>
            <EmptyState
              icon="trophy"
              title={query ? 'No matching hackathons' : 'No hackathons available'}
              description={
                query
                  ? 'Try another search term.'
                  : 'Create a hackathon first. It will appear here with its submission count.'
              }
            />
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}
