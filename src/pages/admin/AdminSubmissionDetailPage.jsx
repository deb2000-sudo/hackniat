import { useCallback, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { evaluationApi } from '../../api/evaluation'
import { resolveApiUrl } from '../../api/client'
import { usePolling } from '../../hooks/usePolling'
import { getScorecard } from '../../utils/scorecard'
import { formatDateTime } from '../../utils/format'
import { BTN_GHOST, EYEBROW, WRAP_APP } from '../../components/drop/theme'
import Alert from '../../components/ui/Alert'
import Badge, { AiModeBadge, ReviewStatusBadge, StatusBadge } from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card, { CardBody, CardHeader } from '../../components/ui/Card'
import Icon from '../../components/ui/Icon'
import { Textarea } from '../../components/ui/Input'
import Spinner, { LoadingBlock } from '../../components/ui/Spinner'
import AiMetricsPanel from '../../components/evaluation/AiMetricsPanel'
import ScorecardBar from '../../components/evaluation/ScorecardBar'
import SubmissionReport from '../../components/evaluation/SubmissionReport'

export default function AdminSubmissionDetailPage() {
  const { submissionId } = useParams()
  const fetcher = useCallback(
    (opts) => evaluationApi.getSubmission(submissionId, opts),
    [submissionId],
  )
  const { data: submission, loading, error, restart: restartPolling } = usePolling(fetcher, {
    isDone: (item) => ['completed', 'failed'].includes(item?.status),
    interval: 3000,
  })
  const [reviewNotes, setReviewNotes] = useState('')
  const [action, setAction] = useState('')
  const [actionError, setActionError] = useState('')
  const [publishOverride, setPublishOverride] = useState(null)
  const [publishedAtOverride, setPublishedAtOverride] = useState(undefined)
  const [reviewOverride, setReviewOverride] = useState(null)
  const [actionMessage, setActionMessage] = useState('')
  const [showDetailReport, setShowDetailReport] = useState(false)

  const reportPublished = publishOverride ?? submission?.report_published ?? false
  const reviewStatus = reviewOverride?.review_status ?? submission?.review_status ?? 'none'
  const evaluatorScore = reviewOverride?.evaluator_score ?? submission?.evaluator_score
  const evaluatorNotes = reviewOverride?.evaluator_notes ?? submission?.evaluator_notes
  const finalScore = reviewOverride?.final_score ?? submission?.final_score
  const scorecard = useMemo(
    () => reviewOverride?.scorecard || getScorecard(submission),
    [reviewOverride, submission],
  )
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
      await evaluationApi.evaluateSubmission(submission.id, null)
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
      setReviewOverride({
        ...updated,
        review_status: nextStatus,
        scorecard: updated.scorecard || getScorecard(updated) || scorecard,
      })
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
    return (
      <div className={`${WRAP_APP} py-7 md:py-10`}>
        <LoadingBlock label="Loading submission…" />
      </div>
    )
  }

  if (error && !submission) {
    return (
      <div className={`${WRAP_APP} py-7 md:py-10`}>
        <Alert variant="danger" title="Unable to load submission">
          {error.message}
        </Alert>
        <div className="mt-5">
          <Link to="/admin/submissions" className={BTN_GHOST}>
            <Icon name="arrowLeft" size={17} />
            Back to submissions
          </Link>
        </div>
      </div>
    )
  }

  const canAnalyze =
    Boolean(submission?.show_ai_evaluation_button) &&
    ['uploaded', 'failed'].includes(submission?.status)
  const processing = submission?.status === 'processing'
  const completed = submission?.status === 'completed'
  const failed = submission?.status === 'failed'

  return (
    <div className={`${WRAP_APP} py-7 md:py-10 admin-submission-detail`}>
      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 max-w-3xl">
          <span className={EYEBROW}>Submission review</span>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-ink md:text-[36px]">
            {submission?.team_name || 'Student submission'}
          </h1>
          <p className="mt-2 text-[14px] text-muted md:text-[15px]">
            {[
              submission?.hackathon_name,
              submission?.theme_name || submission?.theme_chosen,
              formatDateTime(submission?.created_at),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <Link
          to={
            submission?.hackathon_id
              ? `/admin/submissions/hackathons/${submission.hackathon_id}`
              : '/admin/submissions'
          }
          className={`${BTN_GHOST} w-full shrink-0 sm:w-auto`}
        >
          <Icon name="arrowLeft" size={17} />
          Back to hackathon
        </Link>
      </header>

      {actionError && (
        <div className="mb-4">
          <Alert variant="danger">{actionError}</Alert>
        </div>
      )}
      {actionMessage && (
        <div className="mb-4">
          <Alert variant="success">{actionMessage}</Alert>
        </div>
      )}

      {scorecard?.metrics?.length ? (
        <div className="mb-6">
          <Card>
            <CardBody>
              <ScorecardBar
                scorecard={scorecard}
                title={
                  finalScore != null
                    ? `Final score ${finalScore}/100`
                    : 'Evaluator scorecard'
                }
              />
            </CardBody>
          </Card>
        </div>
      ) : null}

      <div className="admin-submission-layout">
        <div className="stack-lg">
          {scorecard?.metrics?.length ? (
            <Card>
              <CardHeader>
                <h3>AI metrics</h3>
                <Icon name="sparkles" size={19} className="text-muted" />
              </CardHeader>
              <CardBody>
                <AiMetricsPanel scorecard={scorecard} />
              </CardBody>
            </Card>
          ) : null}

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
                <span className="text-sm text-muted">AI mode</span>
                <AiModeBadge auto={submission?.auto_ai_evaluation} />
              </div>
              <div className="row-between">
                <span className="text-sm text-muted">Analysis status</span>
                <StatusBadge status={submission?.status} />
              </div>
              <div className="row-between">
                <span className="text-sm text-muted">Evaluator review</span>
                <ReviewStatusBadge status={reviewStatus} />
              </div>

              {canAnalyze && (
                <Button
                  variant="accent"
                  block
                  loading={action === 'analyzing'}
                  onClick={analyze}
                  leftIcon={<Icon name="sparkles" size={17} />}
                >
                  {failed ? 'Retry AI Evaluation' : 'AI Evaluation'}
                </Button>
              )}

              {processing && (
                <div className="admin-analysis-processing">
                  <Spinner />
                  <div>
                    <strong>
                      {submission?.auto_ai_evaluation
                        ? 'AI evaluation running automatically'
                        : 'Analysis in progress'}
                    </strong>
                    <small>Updating automatically…</small>
                  </div>
                </div>
              )}

              {failed && !canAnalyze && (
                <Alert variant="danger">AI evaluation failed.</Alert>
              )}

              {completed && (
                <Button
                  type="button"
                  variant={showDetailReport ? 'secondary' : 'ghost'}
                  block
                  onClick={() => setShowDetailReport((value) => !value)}
                  leftIcon={<Icon name="file" size={17} />}
                >
                  {showDetailReport ? 'Hide detail report' : 'Detail report'}
                </Button>
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
          <SubmissionReport
            submissionId={submission.id}
            embeddedAnalysis={submission?.analysis || submission?.result}
            demoScore={
              submission?.analysis?.overall_score ?? submission?.result?.overall_score
            }
            showDetailReport={showDetailReport}
            onToggleDetailReport={() => setShowDetailReport((value) => !value)}
          />
        </div>
      )}
    </div>
  )
}
