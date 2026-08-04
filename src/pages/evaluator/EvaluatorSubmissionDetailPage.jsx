import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { evaluationApi } from '../../api/evaluation'
import { hackathonsApi } from '../../api/hackathons'
import { resolveApiUrl } from '../../api/client'
import { useAsync } from '../../hooks/useAsync'
import { usePolling } from '../../hooks/usePolling'
import {
  buildManualMetricsPayload,
  draftFromScorecard,
  getScorecard,
  isManualScoringComplete,
  previewScorecard,
} from '../../utils/scorecard'
import { formatDateTime } from '../../utils/format'
import {
  BTN_GHOST,
  EYEBROW,
  WRAP_APP,
} from '../../components/drop/theme'
import Alert from '../../components/ui/Alert'
import Accordion from '../../components/ui/Accordion'
import { AiModeBadge, ReviewStatusBadge, StatusBadge } from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card, { CardBody, CardHeader } from '../../components/ui/Card'
import Icon from '../../components/ui/Icon'
import { Textarea } from '../../components/ui/Input'
import Spinner, { LoadingBlock } from '../../components/ui/Spinner'
import AiMetricsPanel from '../../components/evaluation/AiMetricsPanel'
import ManualScoreForms from '../../components/evaluation/ManualScoreForms'
import ScorecardBar from '../../components/evaluation/ScorecardBar'
import SubmissionReport from '../../components/evaluation/SubmissionReport'

export default function EvaluatorSubmissionDetailPage() {
  const { submissionId } = useParams()
  const fetcher = useCallback(
    (opts) => evaluationApi.getSubmission(submissionId, opts),
    [submissionId],
  )
  const { data: submission, loading, error, restart: restartPolling } = usePolling(fetcher, {
    isDone: (item) => ['completed', 'failed'].includes(item?.status),
    interval: 3000,
  })
  const { data: hackathon } = useAsync(
    () => hackathonsApi.get(submission.hackathon_id),
    { enabled: Boolean(submission?.hackathon_id) },
  )
  const evaluatorGuidelines = String(hackathon?.evaluator_guidelines || '').trim()
  const [reviewOverride, setReviewOverride] = useState(null)
  const [action, setAction] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [showDetailReport, setShowDetailReport] = useState(false)
  const [notes, setNotes] = useState('')
  const [draftByFieldKey, setDraftByFieldKey] = useState({})

  const reviewStatus = reviewOverride?.review_status ?? submission?.review_status ?? 'none'
  const scorecardBase = useMemo(
    () => reviewOverride?.scorecard || getScorecard(submission),
    [reviewOverride, submission],
  )

  useEffect(() => {
    if (!scorecardBase) return
    setDraftByFieldKey((current) =>
      Object.keys(current).length ? current : draftFromScorecard(scorecardBase),
    )
    if (!notes && (submission?.evaluator_notes || reviewOverride?.evaluator_notes)) {
      setNotes(submission?.evaluator_notes || reviewOverride?.evaluator_notes || '')
    }
  }, [scorecardBase, submission, reviewOverride, notes])

  const preview = useMemo(
    () => previewScorecard(scorecardBase, draftByFieldKey),
    [scorecardBase, draftByFieldKey],
  )
  const manualComplete = useMemo(
    () => isManualScoringComplete(scorecardBase, draftByFieldKey),
    [scorecardBase, draftByFieldKey],
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
      setActionMessage('AI evaluation started. This page will update automatically.')
    } catch (analyzeError) {
      setActionError(analyzeError.message || 'Unable to start AI evaluation.')
    } finally {
      setAction('')
    }
  }

  const submitForReview = async () => {
    if (!manualComplete) {
      setActionError('Complete all manual metrics before submitting for review.')
      return
    }
    setAction('submitting')
    setActionError('')
    setActionMessage('')
    try {
      const updated = await evaluationApi.submitForAdminReview(submission.id, {
        manual_metrics: buildManualMetricsPayload(scorecardBase, draftByFieldKey),
        evaluator_notes: notes.trim() || null,
      })
      setReviewOverride({
        ...updated,
        review_status: updated.review_status || 'pending_review',
        scorecard: updated.scorecard || getScorecard(updated),
      })
      setActionMessage('Scorecard submitted for admin review.')
    } catch (submitError) {
      setActionError(submitError.message || 'Unable to submit this evaluation for review.')
    } finally {
      setAction('')
    }
  }

  if (loading && !submission) {
    return (
      <div className={`${WRAP_APP} py-7 md:py-10`}>
        <LoadingBlock label="Loading assigned submission…" />
      </div>
    )
  }

  if (error && !submission) {
    return (
      <div className={`${WRAP_APP} py-7 md:py-10`}>
        <Alert variant="danger" title="Unable to load assigned submission">
          {error.message}
        </Alert>
        <div className="mt-5">
          <Link to="/evaluator" className={BTN_GHOST}>
            <Icon name="arrowLeft" size={17} />
            Back to assignments
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
  const readOnlyReview = ['pending_review', 'approved'].includes(reviewStatus)
  const canEditManual =
    completed && ['none', 'changes_requested'].includes(reviewStatus) && !processing
  const canSubmit = canEditManual && manualComplete

  return (
    <div className={`${WRAP_APP} py-7 md:py-10 admin-submission-detail`}>
      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 max-w-3xl">
          <span className={EYEBROW}>Assigned submission</span>
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
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge status={submission?.status} />
            <ReviewStatusBadge status={reviewStatus} />
            <AiModeBadge auto={submission?.auto_ai_evaluation} />
          </div>
        </div>
        <Link
          to={
            submission?.hackathon_id
              ? `/evaluator/hackathons/${submission.hackathon_id}`
              : '/evaluator'
          }
          className={`${BTN_GHOST} w-full shrink-0 sm:w-auto`}
        >
          <Icon name="arrowLeft" size={17} />
          Back to queue
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
      {reviewStatus === 'changes_requested' && (
        <div className="mb-4">
          <Alert variant="warning" title="Changes requested">
            {submission?.review_notes ||
              'Update the manual scores as needed, then resubmit for admin review.'}
          </Alert>
        </div>
      )}
      {reviewStatus === 'pending_review' && (
        <div className="mb-4">
          <Alert variant="info" title="Waiting for admin">
            Your scorecard was submitted and is waiting for administrator approval.
          </Alert>
        </div>
      )}

      {evaluatorGuidelines ? (
        <div className="mb-6">
          <Accordion
            title="Evaluator guidelines"
            description="Review criteria for this hackathon."
            icon="shield"
            defaultOpen
          >
            <div className="markdown-body hackathon-guidelines text-ink">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{evaluatorGuidelines}</ReactMarkdown>
            </div>
          </Accordion>
        </div>
      ) : null}

      {preview?.metrics?.length ? (
        <div className="mb-6">
          <Card>
            <CardBody>
              <ScorecardBar
                scorecard={preview}
                title={readOnlyReview ? 'Submitted scorecard' : 'Live scorecard preview'}
              />
            </CardBody>
          </Card>
        </div>
      ) : null}

      <div className="admin-submission-layout">
        <div className="stack-lg min-w-0">
          <Accordion
            title="Project details"
            description="Problem statement, solution description, links, and working demo."
            icon="clipboard"
            badge={<StatusBadge status={submission?.status} />}
          >
            <div className="stack-lg">
              <div className="admin-response-block">
                <span>Problem statement</span>
                <p>{submission?.problem_statement || 'Not provided.'}</p>
              </div>
              <div className="admin-response-block">
                <span>Solution description</span>
                <p>{submission?.solution_description || 'Not provided.'}</p>
              </div>
              <div className="grid grid-2">
                <div className="admin-response-block">
                  <span>GitHub</span>
                  <p>
                    {submission?.github_link ? (
                      <a href={submission.github_link} target="_blank" rel="noreferrer">
                        {submission.github_link}
                      </a>
                    ) : (
                      'Not provided.'
                    )}
                  </p>
                </div>
                <div className="admin-response-block">
                  <span>MVP</span>
                  <p>
                    {submission?.mvp_link ? (
                      <a href={submission.mvp_link} target="_blank" rel="noreferrer">
                        {submission.mvp_link}
                      </a>
                    ) : (
                      'Not provided.'
                    )}
                  </p>
                </div>
              </div>
              {videoUrl && (
                <div className="evaluation-demo-block">
                  <div>
                    <span>Demo video</span>
                    <small>{submission?.source_filename || 'Working demo'}</small>
                  </div>
                  <video
                    className="admin-submission-video"
                    src={videoUrl}
                    controls
                    playsInline
                    preload="metadata"
                  />
                </div>
              )}
            </div>
          </Accordion>

          {(completed || processing) && (
            <Card>
              <CardHeader>
                <div>
                  <h3>AI metrics</h3>
                  <p className="text-sm text-muted">
                    Read-only scores filled by AI evaluation.
                  </p>
                </div>
                <Icon name="sparkles" size={19} className="text-muted" />
              </CardHeader>
              <CardBody>
                {processing ? (
                  <div className="admin-analysis-processing">
                    <Spinner />
                    <div>
                      <strong>AI evaluating…</strong>
                      <small>Scorecard updates automatically when complete.</small>
                    </div>
                  </div>
                ) : (
                  <AiMetricsPanel scorecard={preview} />
                )}
              </CardBody>
            </Card>
          )}

          {completed && scorecardBase && (
            <Card>
              <CardHeader>
                <div>
                  <h3>Manual metrics</h3>
                  <p className="text-sm text-muted">
                    Score GitHub and MVP features. Total updates live above.
                  </p>
                </div>
              </CardHeader>
              <CardBody>
                <ManualScoreForms
                  scorecard={preview}
                  draftByFieldKey={draftByFieldKey}
                  githubLink={submission?.github_link}
                  mvpLink={submission?.mvp_link}
                  disabled={!canEditManual || action === 'submitting'}
                  onDraftChange={(fieldKey, next) =>
                    setDraftByFieldKey((current) => ({ ...current, [fieldKey]: next }))
                  }
                />
              </CardBody>
            </Card>
          )}

          {completed && (
            <SubmissionReport
              submissionId={submission.id}
              collapsible
              recommendation={submission?.result?.recommendation}
              embeddedAnalysis={submission?.analysis || submission?.result}
              showDetailReport={showDetailReport}
              onToggleDetailReport={() => setShowDetailReport((value) => !value)}
            />
          )}
        </div>

        <aside className="stack-lg evaluator-review-sidebar min-w-0">
          <Card className="admin-analysis-control">
            <CardHeader>
              <h3>AI analysis</h3>
              <Icon name="sparkles" size={19} className="text-muted" />
            </CardHeader>
            <CardBody className="stack-md">
              <div className="row-between">
                <span className="text-sm text-muted">AI mode</span>
                <AiModeBadge auto={submission?.auto_ai_evaluation} />
              </div>
              <div className="row-between">
                <span className="text-sm text-muted">Status</span>
                <StatusBadge status={submission?.status} />
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
                        ? 'AI evaluating…'
                        : 'Analysis in progress'}
                    </strong>
                    <small>Updating automatically…</small>
                  </div>
                </div>
              )}

              {failed && !canAnalyze && (
                <Alert variant="danger">
                  AI evaluation failed. Ask an administrator if you need it re-run.
                </Alert>
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
            </CardBody>
          </Card>

          {completed && (
            <Card>
              <CardHeader>
                <h3>{readOnlyReview ? 'Review status' : 'Submit for review'}</h3>
              </CardHeader>
              <CardBody className="stack-md">
                <div className="row-between">
                  <span className="text-sm text-muted">Preview total</span>
                  <strong>
                    {preview?.computed_total != null ? preview.computed_total : '—'} / 100
                  </strong>
                </div>
                <ReviewStatusBadge status={reviewStatus} />
                {canEditManual && (
                  <>
                    <Textarea
                      label="Notes for admin"
                      hint="Optional"
                      rows={3}
                      maxLength={2000}
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                    />
                    <Button
                      variant="success"
                      block
                      disabled={!canSubmit}
                      loading={action === 'submitting'}
                      onClick={submitForReview}
                      leftIcon={<Icon name="check" size={17} />}
                    >
                      {reviewStatus === 'changes_requested'
                        ? 'Resubmit for review'
                        : 'Submit for review'}
                    </Button>
                    {!manualComplete && (
                      <p className="text-sm text-muted">
                        Finish GitHub and MVP scoring to enable submit.
                      </p>
                    )}
                  </>
                )}
                {reviewStatus === 'approved' && (
                  <p className="text-sm text-muted">
                    Approved final score:{' '}
                    <strong>{submission?.final_score ?? preview?.computed_total ?? '—'}/100</strong>
                  </p>
                )}
              </CardBody>
            </Card>
          )}
        </aside>
      </div>
    </div>
  )
}
