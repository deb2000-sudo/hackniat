import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { evaluationApi } from '../../api/evaluation'
import { hackathonsApi } from '../../api/hackathons'
import { useAsync } from '../../hooks/useAsync'
import { formatDate, formatDateTime } from '../../utils/format'
import PageHeader from '../../components/layout/PageHeader'
import Alert from '../../components/ui/Alert'
import Badge, { StatusBadge } from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card, { CardBody } from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Icon from '../../components/ui/Icon'
import Input, { Select } from '../../components/ui/Input'
import { LoadingBlock } from '../../components/ui/Spinner'

export default function AdminHackathonSubmissionsPage() {
  const { hackathonId } = useParams()
  const { data, loading, error, reload } = useAsync(async () => {
    const [hackathon, submissions] = await Promise.all([
      hackathonsApi.get(hackathonId),
      evaluationApi.listHackathonSubmissions(hackathonId),
    ])
    return { hackathon, submissions }
  })
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')

  const submissions = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return [...(data?.submissions || [])]
      .filter((submission) => status === 'all' || submission.status === status)
      .filter((submission) => {
        if (!needle) return true
        return [submission.team_name, submission.theme_name || submission.theme_chosen, submission.id].some((value) =>
          String(value || '').toLowerCase().includes(needle),
        )
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [data, query, status])

  const hackathon = data?.hackathon

  return (
    <div className="container page admin-submissions-page">
      <PageHeader
        eyebrow="Hackathon submissions"
        title={hackathon?.name || 'Submissions'}
        description={
          hackathon
            ? `${formatDate(hackathon.start_date)} – ${formatDate(hackathon.end_date)} · ${data.submissions.length} submissions`
            : 'Review hackathon submissions.'
        }
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
              to="/admin/submissions"
              variant="secondary"
              leftIcon={<Icon name="arrowLeft" size={17} />}
            >
              All hackathons
            </Button>
          </>
        }
      />

      {hackathon?.banner_url && (
        <div className="admin-hackathon-queue-banner">
          <img src={hackathon.banner_url} alt="" />
          <div />
          <span><Icon name="video" size={18} />{data.submissions.length} submissions</span>
        </div>
      )}

      {error && (
        <Alert variant="danger" title="Unable to load hackathon submissions">
          {error.message}
        </Alert>
      )}

      <div className="admin-submissions-toolbar">
        <div className="admin-submissions-search">
          <Icon name="search" size={17} />
          <Input
            aria-label="Search submissions"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search team, theme, or ID"
          />
        </div>
        <Select
          aria-label="Filter submission status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="uploaded">Uploaded</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </Select>
      </div>

      {loading && !data ? (
        <LoadingBlock label="Loading hackathon submissions…" />
      ) : submissions.length ? (
        <div className="table-wrap">
          <table className="table admin-submissions-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>Theme</th>
                <th>Status</th>
                <th>Report</th>
                <th>Submitted</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {submissions.map((submission) => (
                <tr key={submission.id}>
                  <td>
                    <strong>{submission.team_name || 'Unnamed team'}</strong>
                    <small className="mono">{submission.id.slice(0, 12)}…</small>
                  </td>
                  <td>{submission.theme_name || submission.theme_chosen || '—'}</td>
                  <td><StatusBadge status={submission.status} /></td>
                  <td>
                    <Badge variant={submission.report_published ? 'success' : 'neutral'} dot>
                      {submission.report_published ? 'Published' : 'Private'}
                    </Badge>
                  </td>
                  <td className="text-muted">{formatDateTime(submission.created_at)}</td>
                  <td>
                    <Button
                      as={Link}
                      to={`/admin/submissions/${submission.id}`}
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
              icon="video"
              title={data?.submissions.length ? 'No matching submissions' : 'No submissions yet'}
              description={
                data?.submissions.length
                  ? 'Try another search or status filter.'
                  : 'New student submissions for this hackathon will appear here.'
              }
            />
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}
