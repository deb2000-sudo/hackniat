import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { evaluationApi } from '../../api/evaluation'
import { resolveApiUrl } from '../../api/client'
import { usePolling } from '../../hooks/usePolling'
import { formatDateTime } from '../../utils/format'
import PageHeader from '../../components/layout/PageHeader'
import Alert from '../../components/ui/Alert'
import Badge, { ReviewStatusBadge, StatusBadge } from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card, { CardBody, CardHeader } from '../../components/ui/Card'
import Icon from '../../components/ui/Icon'
import { Textarea } from '../../components/ui/Input'
import { LoadingBlock } from '../../components/ui/Spinner'
import SubmissionReport from '../../components/evaluation/SubmissionReport'

export default function AdminSubmissionDetailPage() {
  const { submissionId } = useParams()
  const fetcher = useCallback(() => evaluationApi.getSubmission(submissionId), [submissionId])
  const { data: submission, loading, error, restart: restartPolling } = usePolling(fetcher, {
    isDone: (item) => item?.status === 'completed',
    interval: 3000,
  })
  const [criteria, setCriteria] = useState('')
  const [reviewNotes, setReviewNotes] = useState('')
  const [action, setAction] = useState('')
  const [actionError, setActionError] = useState('')
  const [publishOverride, setPublishOverride] = useState(null)
  const [publishedAtOverride, setPublishedAtOverride] = useState(undefined)
  const [reviewOverride, setReviewOverride] = useState(null)
  const [actionMessage, setActionMessage] = useState('')

  const reportPublished = publishOverride ?? submission?.report_published ?? false
  const reviewStatus = reviewOverride?.review_status ?? submission?.review_status ?? 'none'
  const evaluatorScore = reviewOverride?.evaluator_score ?? submission?.evaluator_score
  const evaluatorNotes = reviewOverride?.evaluator_notes ?? submission?.evaluator_notes
  const finalScore = reviewOverride?.final_score ?? submission?.final_score
  const videoUrl = submission
    ? resolveApiUrl(
        submission.video_url ||
          `/submissions/${encodeURIComponent(submission.id)}/video`,
      )
    : ''

  const analyze = async () => {
    setAction('analyzing')
    setActionError('')
    setActionMessage('')
    try {
      await evaluationApi.evaluateSubmission(submission.id, criteria.trim() || null)
      restartPolling()
      setActionMessage('Analysis started. This page will update automatically when it completes.')
    } catch (analyzeError) {
      setActionError(analyzeError.message || 'Unable to start analysis.')
    } finally {
      setAction('')
    }
  }

  const decideEvaluatorReview = async (decision) => {
    setAction(decision)
    setActionError('')
    setActionMessage('')
    try {
      const updated = decision === 'approving'
        ? await evaluationApi.approveEvaluatorReview(submission.id, reviewNotes.trim())
        : await evaluationApi.requestEvaluatorChanges(submission.id, reviewNotes.trim())
      const nextStatus = updated.review_status ||
        (decision === 'approving' ? 'approved' : 'changes_requested')
      setReviewOverride({ ...updated, review_status: nextStatus })
      if (decision === 'approving') {
        setPublishOverride(updated.report_published ?? true)
        setPublishedAtOverride(updated.published_at ?? new Date().toISOString())
        setActionMessage('Evaluation approved. The final score and report are now visible to the student.')
      } else {
        setPublishOverride(updated.report_published ?? false)
        setActionMessage('Changes requested. The evaluator can update and resubmit their review.')
      }
    } catch (reviewError) {
      setActionError(reviewError.message || 'Unable to update the evaluator review.')
    } finally {
      setAction('')
    }
  }

  if (loading && !submission) {
    return <div className="container page"><LoadingBlock label="Loading submission…" /></div>
  }

  if (error && !submission) {
    return (
      <div className="container container--narrow page stack-md">
        <Alert variant="danger" title="Unable to load submission">{error.message}</Alert>
        <div><Button as={Link} to="/admin/submissions" variant="secondary">Back to submissions</Button></div>
      </div>
    )
  }

  const canAnalyze = ['uploaded', 'failed'].includes(submission?.status)
  const processing = submission?.status === 'processing'
  const completed = submission?.status === 'completed'

  return (
    <div className="container page admin-submission-detail">
      <PageHeader
        eyebrow="Submission review"
        title={submission?.team_name || 'Student submission'}
        description={[
          submission?.hackathon_name,
          submission?.theme_name || submission?.theme_chosen,
          formatDateTime(submission?.created_at),
        ].filter(Boolean).join(' · ')}
        actions={
          <Button
            as={Link}
            to={
              submission?.hackathon_id
                ? `/admin/submissions/hackathons/${submission.hackathon_id}`
                : '/admin/submissions'
            }
            variant="secondary"
            leftIcon={<Icon name="arrowLeft" size={17} />}
          >
            Back to hackathon
          </Button>
        }
      />

      {actionError && <Alert variant="danger">{actionError}</Alert>}
      {actionMessage && <Alert variant="success">{actionMessage}</Alert>}

      <div className="admin-submission-layout">
        <div className="stack-lg">
          <Card>
            <CardHeader>
              <div>
                <h3>Working demo</h3>
                <p className="text-sm text-muted">
                  {submission?.video_source === 'uploaded'
                    ? 'Uploaded video · '
                    : submission?.video_source === 'recorded'
                      ? 'Screen recording · '
                      : ''}
                  {submission?.source_filename}
                </p>
              </div>
              <StatusBadge status={submission?.status} />
            </CardHeader>
            <CardBody>
              <video
                className="admin-submission-video"
                src={videoUrl}
                controls
                playsInline
                preload="metadata"
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h3>Project responses</h3><Icon name="clipboard" size={19} className="text-muted" /></CardHeader>
            <CardBody className="stack-lg">
              <div className="admin-response-block">
                <span>Problem statement</span>
                <p>{submission?.problem_statement || 'Not provided.'}</p>
              </div>
              <div className="admin-response-block">
                <span>Solution description</span>
                <p>{submission?.solution_description || 'Not provided.'}</p>
              </div>
            </CardBody>
          </Card>
        </div>

        <aside className="stack-lg">
          <Card className="admin-analysis-control">
            <CardHeader><h3>AI analysis</h3><Icon name="sparkles" size={19} className="text-muted" /></CardHeader>
            <CardBody className="stack-md">
              <div className="row-between">
                <span className="text-sm text-muted">Analysis status</span>
                <StatusBadge status={submission?.status} />
              </div>
              <div className="row-between">
                <span className="text-sm text-muted">Evaluator review</span>
                <ReviewStatusBadge status={reviewStatus} />
              </div>

              {canAnalyze && (
                <>
                  <Textarea
                    label="Evaluation criteria"
                    hint="Optional focus for this analysis."
                    rows={4}
                    maxLength={2000}
                    value={criteria}
                    onChange={(event) => setCriteria(event.target.value)}
                    disabled={action === 'analyzing'}
                  />
                  <Button
                    variant="accent"
                    block
                    loading={action === 'analyzing'}
                    onClick={analyze}
                    leftIcon={<Icon name="sparkles" size={17} />}
                  >
                    {submission?.status === 'failed' ? 'Retry analysis' : 'Analyze submission'}
                  </Button>
                </>
              )}

              {processing && (
                <div className="admin-analysis-processing">
                  <span className="spinner" />
                  <div><strong>Analysis in progress</strong><small>Updating automatically…</small></div>
                </div>
              )}

              {completed && reviewStatus !== 'pending_review' && (
                <div className="admin-publish-control">
                  <div>
                    <span>Review workflow</span>
                    <ReviewStatusBadge status={reviewStatus} />
                  </div>
                  <p>
                    {reviewStatus === 'approved'
                      ? 'Approved — the report is published to the student.'
                      : reviewStatus === 'changes_requested'
                        ? 'Waiting for the evaluator to update and resubmit their review.'
                        : 'Waiting for the assigned evaluator to submit a score and notes.'}
                  </p>
                </div>
              )}
            </CardBody>
          </Card>

          {completed && reviewStatus === 'pending_review' && (
            <Card className="admin-evaluator-review">
              <CardHeader>
                <h3>Evaluator recommendation</h3>
                <ReviewStatusBadge status={reviewStatus} />
              </CardHeader>
              <CardBody className="stack-md">
                <div className="admin-evaluator-score">
                  <span>Evaluator score</span>
                  <strong>{evaluatorScore ?? '—'}{evaluatorScore != null ? '/100' : ''}</strong>
                </div>
                <div className="evaluator-submitted-notes">
                  <span>Evaluator notes</span>
                  <p>{evaluatorNotes || 'No notes were provided.'}</p>
                </div>
                <Textarea
                  label="Admin review notes"
                  hint="Optional for approval; recommended when requesting changes."
                  rows={3}
                  maxLength={5000}
                  value={reviewNotes}
                  onChange={(event) => setReviewNotes(event.target.value)}
                  disabled={action === 'approving' || action === 'requesting_changes'}
                />
                <div className="admin-review-actions">
                  <Button
                    variant="secondary"
                    block
                    loading={action === 'requesting_changes'}
                    disabled={action === 'approving'}
                    onClick={() => decideEvaluatorReview('requesting_changes')}
                    leftIcon={<Icon name="refresh" size={17} />}
                  >
                    Request changes
                  </Button>
                  <Button
                    variant="success"
                    block
                    loading={action === 'approving'}
                    disabled={action === 'requesting_changes'}
                    onClick={() => decideEvaluatorReview('approving')}
                    leftIcon={<Icon name="check" size={17} />}
                  >
                    Approve & publish
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}

          {completed && reviewStatus === 'approved' && (
            <Card>
              <CardHeader><h3>Final decision</h3><ReviewStatusBadge status={reviewStatus} /></CardHeader>
              <CardBody className="stack-sm">
                <div className="row-between text-sm">
                  <span className="text-muted">Final score</span>
                  <strong>{finalScore ?? evaluatorScore ?? '—'}{(finalScore ?? evaluatorScore) != null ? '/100' : ''}</strong>
                </div>
                <p className="text-sm text-muted">
                  The report and final score are visible to the student.
                </p>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader><h3>Visibility</h3></CardHeader>
            <CardBody className="stack-sm">
              <div className="row-between text-sm"><span className="text-muted">Report</span><strong>{reportPublished ? 'Student-visible' : 'Admin-only'}</strong></div>
              <div className="row-between text-sm">
                <span className="text-muted">Published at</span>
                <strong>
                  {reportPublished
                    ? formatDateTime(
                        publishedAtOverride === undefined
                          ? submission?.published_at
                          : publishedAtOverride,
                      )
                    : '—'}
                </strong>
              </div>
            </CardBody>
          </Card>
        </aside>
      </div>

      {completed && (
        <div className="admin-submission-report">
          <div className="row-between wrap">
            <div><div className="eyebrow">Generated result</div><h2>Evaluation report</h2></div>
            <Badge variant={reportPublished ? 'success' : 'neutral'}>
              {reportPublished ? 'Published to student' : 'Preview — not published'}
            </Badge>
          </div>
          <SubmissionReport submissionId={submission.id} />
        </div>
      )}
    </div>
  )
}
