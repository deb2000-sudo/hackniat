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
    // Only the hackathon itself is essential — without it the page has no
    // subject. An empty (or failing) submissions or evaluators feed should
    // render as "nothing to review yet", not take the whole screen down.
    const [hackathonResult, submissionsResult, evaluatorsResult] = await Promise.allSettled([
      hackathonsApi.get(hackathonId),
      evaluationApi.listHackathonSubmissions(hackathonId),
      adminApi.getApprovedEvaluators(),
    ])
    if (hackathonResult.status === 'rejected') throw hackathonResult.reason
    return {
      hackathon: hackathonResult.value,
      submissions:
        submissionsResult.status === 'fulfilled' ? submissionsResult.value : [],
      evaluators: evaluatorsResult.status === 'fulfilled' ? evaluatorsResult.value : [],
    }
  })
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [assigningId, setAssigningId] = useState('')
  const [bulkAssigning, setBulkAssigning] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [sheetUrl, setSheetUrl] = useState('')
  const [popupBlocked, setPopupBlocked] = useState(false)

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

  const isUnassigned = (submission) => !submission?.assigned_evaluator_id
  const selectableVisibleIds = useMemo(
    () => submissions.filter(isUnassigned).map((submission) => submission.id),
    [submissions],
  )
  const allVisibleSelected =
    selectableVisibleIds.length > 0 &&
    selectableVisibleIds.every((id) => selectedIds.has(id))
  const someVisibleSelected = selectableVisibleIds.some((id) => selectedIds.has(id))

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
    const submission = submissions.find((item) => item.id === submissionId)
    if (submission && !isUnassigned(submission)) return
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
      if (allVisibleSelected) selectableVisibleIds.forEach((id) => next.delete(id))
      else selectableVisibleIds.forEach((id) => next.add(id))
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
      setSelectedIds((current) => {
        if (!current.has(submissionId)) return current
        const next = new Set(current)
        next.delete(submissionId)
        return next
      })
      if (!evaluatorId) {
        setActionMessage('Submission is now unassigned.')
      } else if (updated.status === 'processing' || updated.auto_ai_evaluation) {
        setActionMessage(
          `Assigned to ${updated.assigned_evaluator_name || 'the selected evaluator'}. AI evaluation queued.`,
        )
      } else {
        setActionMessage(
          `Submission assigned to ${updated.assigned_evaluator_name || 'the selected evaluator'}.`,
        )
      }
    } catch (err) {
      setActionError(err.message || 'Unable to update the evaluator assignment.')
    } finally {
      setAssigningId('')
    }
  }

  const onDivideEqually = async () => {
    const idsToAssign = [...selectedIds].filter((id) => {
      const submission = data?.submissions?.find((item) => item.id === id)
      return submission && isUnassigned(submission)
    })
    if (!idsToAssign.length) return
    setBulkAssigning(true)
    setActionError('')
    setActionMessage('')
    try {
      const result = await evaluationApi.assignHackathonSubmissionsEqually(
        hackathonId,
        idsToAssign,
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
      const queued = Number(result?.auto_ai_evaluation_queued || 0)
      setActionMessage(
        `${result?.assigned_count ?? updatedSubmissions.length} assigned across ${
          result?.evaluator_count ?? evaluators.length
        } evaluators${queued ? ` · ${queued} AI evaluation${queued === 1 ? '' : 's'} queued` : ''}.`,
      )
    } catch (err) {
      setActionError(err.message || 'Unable to divide the selected submissions.')
    } finally {
      setBulkAssigning(false)
    }
  }

  const selectedUnassignedCount = useMemo(
    () =>
      [...selectedIds].filter((id) => {
        const submission = data?.submissions?.find((item) => item.id === id)
        return submission && isUnassigned(submission)
      }).length,
    [selectedIds, data?.submissions],
  )

  const linkedSheetUrl = sheetUrl || hackathon?.export_spreadsheet_url || ''

  /**
   * Push this hackathon's submissions into its linked Google Sheet and open it.
   *
   * The tab is opened after an await, so it is outside the user-gesture window
   * and browsers may block it. `window.open` returns null when that happens —
   * we keep the URL and render a link rather than leaving the admin thinking
   * the sync silently failed.
   */
  const syncToGoogleSheet = async () => {
    setExporting(true)
    setExportError('')
    setPopupBlocked(false)
    try {
      const result = await evaluationApi.syncHackathonToGoogleSheet(hackathonId)
      const url = result?.spreadsheet_url || ''
      setSheetUrl(url)
      if (!url) {
        setExportError('The sync finished but did not return a spreadsheet link.')
        return
      }
      const opened = window.open(url, '_blank', 'noopener,noreferrer')
      if (!opened) setPopupBlocked(true)
      // Pick up export_spreadsheet_url / _synced_at for the header line.
      reload({ force: true })
    } catch (err) {
      setExportError(err.message || 'Could not sync submissions to Google Sheets.')
    } finally {
      setExporting(false)
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
              variant="secondary"
              onClick={syncToGoogleSheet}
              loading={exporting}
              disabled={exporting}
              leftIcon={<Icon name="upload" size={17} />}
            >
              {exporting ? 'Syncing…' : 'Sync to Google Sheets'}
            </Button>
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

      {/* Once a sheet exists the admin can reach it without re-syncing. */}
      {linkedSheetUrl && (
        <p className="-mt-3 mb-5 flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
          <Icon name="clipboard" size={14} />
          <a href={linkedSheetUrl} target="_blank" rel="noopener noreferrer" className="underline">
            Google Sheet
          </a>
          <span>
            {hackathon?.export_spreadsheet_synced_at
              ? `· last synced ${formatDateTime(hackathon.export_spreadsheet_synced_at)}`
              : '· not synced yet'}
          </span>
        </p>
      )}

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
      {/* This app has no toast layer, so sync feedback lands beside the other
          action results rather than floating over the page. */}
      {exportError && <Alert variant="danger">{exportError}</Alert>}
      {popupBlocked && sheetUrl && (
        <Alert variant="warning" title="Sheet updated — your browser blocked the new tab">
          <a href={sheetUrl} target="_blank" rel="noopener noreferrer" className="underline">
            Open the Google Sheet
          </a>
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
            disabled={!selectedUnassignedCount || !evaluators.length}
            loading={bulkAssigning}
            leftIcon={<Icon name="users" size={17} />}
          >
            Divide equally
            {selectedUnassignedCount > 0 && (
              <span className="admin-selection-count">{selectedUnassignedCount}</span>
            )}
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
                    aria-label="Select all unassigned visible submissions"
                    checked={allVisibleSelected}
                    disabled={!selectableVisibleIds.length}
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
              {submissions.map((submission) => {
                const canSelect = isUnassigned(submission)
                return (
                <tr
                  key={submission.id}
                  className={selectedIds.has(submission.id) ? 'is-selected' : ''}
                >
                  <td className="admin-select-column">
                    <input
                      type="checkbox"
                      aria-label={`Select ${submission.team_name || 'submission'}`}
                      checked={selectedIds.has(submission.id)}
                      disabled={!canSelect || bulkAssigning}
                      title={
                        canSelect
                          ? undefined
                          : 'Already assigned to an evaluator'
                      }
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
                )
              })}
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
