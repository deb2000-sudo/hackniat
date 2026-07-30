import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { adminApi } from '../../api/admin'
import { evaluationApi } from '../../api/evaluation'
import { hackathonsApi } from '../../api/hackathons'
import { useAsync } from '../../hooks/useAsync'
import { formatDate, formatDateTime } from '../../utils/format'
import { WRAP_APP } from '../../components/drop/theme'
import PageHeader from '../../components/layout/PageHeader'
import Alert from '../../components/ui/Alert'
import Badge, { ReviewStatusBadge, StatusBadge } from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card, { CardBody } from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Icon from '../../components/ui/Icon'
import Input, { Select } from '../../components/ui/Input'
import { LoadingBlock } from '../../components/ui/Spinner'

export default function AdminHackathonSubmissionsPage() {
  const { hackathonId } = useParams()
  const { data, loading, error, reload, setData } = useAsync(async () => {
    const [hackathon, submissions, evaluators] = await Promise.all([
      hackathonsApi.get(hackathonId),
      evaluationApi.listHackathonSubmissions(hackathonId),
      adminApi.getApprovedEvaluators(),
    ])
    return { hackathon, submissions, evaluators }
  })
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [assigningId, setAssigningId] = useState('')
  const [bulkAssigning, setBulkAssigning] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')

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
  const evaluators = data?.evaluators || []
  const visibleIds = submissions.map((submission) => submission.id)
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id))

  const patchSubmission = (updated) => {
    if (!updated?.id) return
    setData((current) => ({
      ...current,
      submissions: current.submissions.map((submission) =>
        submission.id === updated.id ? { ...submission, ...updated } : submission,
      ),
    }))
  }

  const toggleSelected = (submissionId) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(submissionId)) next.delete(submissionId)
      else next.add(submissionId)
      return next
    })
  }

  const toggleAllVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id))
      else visibleIds.forEach((id) => next.add(id))
      return next
    })
  }

  const onAssign = async (submissionId, evaluatorId) => {
    setAssigningId(submissionId)
    setActionError('')
    setActionMessage('')
    try {
      const updated = await evaluationApi.assignSubmission(
        submissionId,
        evaluatorId || null,
      )
      patchSubmission(updated)
      setActionMessage(
        evaluatorId
          ? `Submission assigned to ${updated.assigned_evaluator_name || 'the selected evaluator'}.`
          : 'Submission is now unassigned.',
      )
    } catch (err) {
      setActionError(err.message || 'Unable to update the evaluator assignment.')
    } finally {
      setAssigningId('')
    }
  }

  const onDivideEqually = async () => {
    if (!selectedIds.size) return
    setBulkAssigning(true)
    setActionError('')
    setActionMessage('')
    try {
      const result = await evaluationApi.assignHackathonSubmissionsEqually(
        hackathonId,
        [...selectedIds],
      )
      const updatedSubmissions = Array.isArray(result?.submissions)
        ? result.submissions
        : []
      if (updatedSubmissions.length) {
        const byId = new Map(updatedSubmissions.map((submission) => [submission.id, submission]))
        setData((current) => ({
          ...current,
          submissions: current.submissions.map((submission) => {
            const updated = byId.get(submission.id)
            return updated ? { ...submission, ...updated } : submission
          }),
        }))
      } else {
        reload()
      }
      setSelectedIds(new Set())
      setActionMessage(
        `${result?.assigned_count ?? updatedSubmissions.length} assigned across ${
          result?.evaluator_count ?? evaluators.length
        } evaluators.`,
      )
    } catch (err) {
      setActionError(err.message || 'Unable to divide the selected submissions.')
    } finally {
      setBulkAssigning(false)
    }
  }

  return (
    <div className={`${WRAP_APP} py-7 md:py-10 admin-submissions-page`}>
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
      {actionError && <Alert variant="danger">{actionError}</Alert>}
      {actionMessage && <Alert variant="success">{actionMessage}</Alert>}

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
        <div className="admin-submissions-toolbar__actions">
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
          <Button
            variant="secondary"
            onClick={onDivideEqually}
            disabled={!selectedIds.size || !evaluators.length}
            loading={bulkAssigning}
            leftIcon={<Icon name="users" size={17} />}
          >
            Divide equally
            {selectedIds.size > 0 && <span className="admin-selection-count">{selectedIds.size}</span>}
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <LoadingBlock label="Loading hackathon submissions…" />
      ) : submissions.length ? (
        <div className="table-wrap">
          <table className="table admin-submissions-table">
            <thead>
              <tr>
                <th className="admin-select-column">
                  <input
                    type="checkbox"
                    aria-label="Select all visible submissions"
                    checked={allVisibleSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = someVisibleSelected && !allVisibleSelected
                    }}
                    onChange={toggleAllVisible}
                  />
                </th>
                <th>Team</th>
                <th>Theme</th>
                <th>Status</th>
                <th>Review</th>
                <th>Report</th>
                <th>Submitted</th>
                <th>Evaluator</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {submissions.map((submission) => (
                <tr
                  key={submission.id}
                  className={selectedIds.has(submission.id) ? 'is-selected' : ''}
                >
                  <td className="admin-select-column">
                    <input
                      type="checkbox"
                      aria-label={`Select ${submission.team_name || 'submission'}`}
                      checked={selectedIds.has(submission.id)}
                      onChange={() => toggleSelected(submission.id)}
                    />
                  </td>
                  <td>
                    <strong>{submission.team_name || 'Unnamed team'}</strong>
                  </td>
                  <td>{submission.theme_name || submission.theme_chosen || '—'}</td>
                  <td><StatusBadge status={submission.status} /></td>
                  <td><ReviewStatusBadge status={submission.review_status} /></td>
                  <td>
                    <Badge variant={submission.report_published ? 'success' : 'neutral'} dot>
                      {submission.report_published ? 'Published' : 'Private'}
                    </Badge>
                  </td>
                  <td className="text-muted">{formatDateTime(submission.created_at)}</td>
                  <td>
                    <Select
                      className="admin-evaluator-select"
                      aria-label={`Assign evaluator for ${submission.team_name || 'submission'}`}
                      value={submission.assigned_evaluator_id || ''}
                      disabled={assigningId === submission.id || bulkAssigning}
                      onChange={(event) => onAssign(submission.id, event.target.value || null)}
                    >
                      <option value="">Unassigned</option>
                      {evaluators.map((evaluator) => (
                        <option key={evaluator.id} value={evaluator.id}>
                          {evaluator.name}
                        </option>
                      ))}
                    </Select>
                  </td>
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
