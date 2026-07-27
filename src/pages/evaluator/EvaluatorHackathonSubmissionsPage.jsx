import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { evaluationApi } from '../../api/evaluation'
import { useAsync } from '../../hooks/useAsync'
import { formatDateTime } from '../../utils/format'
import PageHeader from '../../components/layout/PageHeader'
import Alert from '../../components/ui/Alert'
import { ReviewStatusBadge, StatusBadge } from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card, { CardBody } from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Icon from '../../components/ui/Icon'
import Input, { Select } from '../../components/ui/Input'
import { LoadingBlock } from '../../components/ui/Spinner'

export default function EvaluatorHackathonSubmissionsPage() {
  const { hackathonId } = useParams()
  const { data, loading, error, reload } = useAsync(() =>
    evaluationApi.listEvaluatorHackathonSubmissions(hackathonId),
  )
  const [query, setQuery] = useState('')
  const [reviewStatus, setReviewStatus] = useState('all')

  const submissions = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return [...(data || [])]
      .filter((submission) =>
        reviewStatus === 'all' || (submission.review_status || 'none') === reviewStatus,
      )
      .filter((submission) =>
        !needle ||
        [submission.team_name, submission.theme_name || submission.theme_chosen, submission.id]
          .some((value) => String(value || '').toLowerCase().includes(needle)),
      )
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [data, query, reviewStatus])

  const hackathonName = data?.[0]?.hackathon_name || 'Assigned submissions'

  return (
    <div className="container page admin-submissions-page">
      <PageHeader
        eyebrow="Evaluator queue"
        title={hackathonName}
        description={`${data?.length || 0} team${data?.length === 1 ? '' : 's'} assigned to you.`}
        actions={
          <>
            <Button
              variant="ghost"
              onClick={reload}
              loading={loading}
              leftIcon={<Icon name="refresh" size={17} />}
            >
              Refresh
            </Button>
            <Button
              as={Link}
              to="/evaluator"
              variant="secondary"
              leftIcon={<Icon name="arrowLeft" size={17} />}
            >
              All hackathons
            </Button>
          </>
        }
      />

      {error && (
        <Alert variant="danger" title="Unable to load assigned submissions">
          {error.message}
        </Alert>
      )}

      <div className="admin-submissions-toolbar">
        <div className="admin-submissions-search">
          <Icon name="search" size={17} />
          <Input
            aria-label="Search assigned submissions"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search team, theme, or ID"
          />
        </div>
        <Select
          aria-label="Filter review status"
          value={reviewStatus}
          onChange={(event) => setReviewStatus(event.target.value)}
        >
          <option value="all">All review statuses</option>
          <option value="none">Not submitted</option>
          <option value="pending_review">Pending admin review</option>
          <option value="changes_requested">Changes requested</option>
          <option value="approved">Approved</option>
        </Select>
      </div>

      {loading && !data ? (
        <LoadingBlock label="Loading your assigned teams…" />
      ) : submissions.length ? (
        <div className="table-wrap">
          <table className="table evaluator-submissions-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>Theme</th>
                <th>Analysis</th>
                <th>Review status</th>
                <th>Submitted</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {submissions.map((submission) => (
                <tr key={submission.id}>
                  <td>
                    <strong>{submission.team_name || 'Unnamed team'}</strong>
                  </td>
                  <td>{submission.theme_name || submission.theme_chosen || '—'}</td>
                  <td><StatusBadge status={submission.status} /></td>
                  <td><ReviewStatusBadge status={submission.review_status} /></td>
                  <td className="text-muted">{formatDateTime(submission.created_at)}</td>
                  <td>
                    <Button
                      as={Link}
                      to={`/evaluator/submissions/${submission.id}`}
                      variant="ghost"
                      size="sm"
                      rightIcon={<Icon name="arrowRight" size={15} />}
                    >
                      Review
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !error && !loading ? (
        <Card>
          <CardBody>
            <EmptyState
              icon="clipboard"
              title={data?.length ? 'No matching submissions' : 'No assigned teams'}
              description={
                data?.length
                  ? 'Try another search or review-status filter.'
                  : 'There are currently no submissions assigned to you for this hackathon.'
              }
            />
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}
