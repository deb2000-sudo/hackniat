import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { evaluationApi } from '../../api/evaluation'
import { resolveApiUrl } from '../../api/client'
import { usePolling } from '../../hooks/usePolling'
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
import Input, { Textarea } from '../../components/ui/Input'
import Spinner, { LoadingBlock } from '../../components/ui/Spinner'
import AnimatedScoreGauge from '../../components/evaluation/AnimatedScoreGauge'
import SubmissionReport from '../../components/evaluation/SubmissionReport'

function EvaluatorReviewForm({
  initialScore,
  initialNotes,
  reviewStatus,
  submitting,
  onSubmit,
}) {
  const [score, setScore] = useState(
    initialScore != null ? String(initialScore) : '',
  )
  const [notes, setNotes] = useState(initialNotes || '')

  return (
    <form
      className="stack-md"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(score, notes)
      }}
    >
      <Input
        label="Evaluator score"
        type="number"
        min="0"
        max="100"
        step="0.1"
        placeholder="0–100"
        value={score}
        onChange={(event) => setScore(event.target.value)}
        required
      />
      <Textarea
        label="Notes"
        hint="Optional notes for the administrator."
        rows={4}
        maxLength={2000}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />
      <Button
        type="submit"
        variant="success"
        block
        loading={submitting}
        leftIcon={<Icon name="check" size={17} />}
      >
        {reviewStatus === 'changes_requested' ? 'Resubmit for review' : 'Submit to admin'}
      </Button>
    </form>
  )
}

function WorkflowTracking({ analysisCompleted, reviewStatus }) {
  const wasSubmitted = ['pending_review', 'changes_requested', 'approved'].includes(reviewStatus)
  const approved = reviewStatus === 'approved'

  const steps = [
    {
      label: 'AI evaluation completed',
      description: analysisCompleted
        ? 'The submission has been evaluated.'
        : 'Run the AI analysis to begin.',
      state: analysisCompleted ? 'done' : 'current',
    },
    {
      label: 'Submitted to admin',
      description: wasSubmitted
        ? 'Your score and notes were sent for review.'
        : 'Submit your evaluation when it is ready.',
      state: wasSubmitted ? 'done' : analysisCompleted ? 'current' : 'pending',
    },
    {
      label: 'Admin approval',
      description: approved
        ? 'Approved and published to the student.'
        : reviewStatus === 'changes_requested'
          ? 'The admin requested changes.'
          : 'Waiting for the admin’s final decision.',
      state: approved
        ? 'done'
        : reviewStatus === 'changes_requested'
          ? 'changes'
          : reviewStatus === 'pending_review'
            ? 'current'
            : 'pending',
    },
  ]

  return (
    <Card className="workflow-tracking-card">
      <CardHeader>
        <div>
          <h3>Workflow tracking</h3>
          <p className="text-sm text-muted">Follow this evaluation through approval.</p>
        </div>
        <ReviewStatusBadge status={reviewStatus} />
      </CardHeader>
      <CardBody>
        <ol className="workflow-tracking">
          {steps.map((step) => (
            <li className={`workflow-tracking__step is-${step.state}`} key={step.label}>
              <span className="workflow-tracking__marker">
                <Icon
                  name={
                    step.state === 'done'
                      ? 'check'
                      : step.state === 'changes'
                        ? 'alert'
                        : 'clock'
                  }
                  size={16}
                />
              </span>
              <div>
                <strong>{step.label}</strong>
                <small>{step.description}</small>
              </div>
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  )
}

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
  const [reviewOverride, setReviewOverride] = useState(null)
  const [action, setAction] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')

  const reviewStatus = reviewOverride?.review_status ?? submission?.review_status ?? 'none'
  const currentScore = reviewOverride?.evaluator_score ?? submission?.evaluator_score
  const currentNotes = reviewOverride?.evaluator_notes ?? submission?.evaluator_notes
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
      setActionMessage('AI analysis started. This page will update automatically.')
    } catch (analyzeError) {
      setActionError(analyzeError.message || 'Unable to start AI analysis.')
    } finally {
      setAction('')
    }
  }

  const submitForReview = async (score, notes) => {
    const numericScore = Number(score)
    if (score === '' || !Number.isFinite(numericScore) || numericScore < 0 || numericScore > 100) {
      setActionError('Enter a score between 0 and 100.')
      return
    }
    setAction('submitting')
    setActionError('')
    setActionMessage('')
    try {
      const updated = await evaluationApi.submitForAdminReview(
        submission.id,
        numericScore,
        notes.trim() || null,
      )
      setReviewOverride({
        ...updated,
        review_status: updated.review_status || 'pending_review',
        evaluator_score: updated.evaluator_score ?? numericScore,
        evaluator_notes: updated.evaluator_notes ?? (notes.trim() || null),
      })
      setActionMessage('Your score and analysis were submitted for admin review.')
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
  const canSubmit = completed && ['none', 'changes_requested'].includes(reviewStatus)
  const rawAnalysisScore = submission?.result?.overall_score
  const dashboardScore = currentScore ?? (
    rawAnalysisScore != null && rawAnalysisScore <= 10
      ? rawAnalysisScore * 10
      : rawAnalysisScore
  ) ?? 0

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
              'Review the submission and analysis, then update your score or notes and resubmit it.'}
          </Alert>
        </div>
      )}

      <div className="admin-submission-layout">
        <div className="stack-lg min-w-0">
          <Accordion
            title="Project details"
            description="Problem statement, solution description, and working demo."
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
              <div className="evaluation-demo-block">
                <div>
                  <span>Demo video</span>
                  <small>
                    {submission?.video_source === 'uploaded'
                      ? 'Uploaded video · '
                      : submission?.video_source === 'recorded'
                        ? 'Screen recording · '
                        : ''}
                    {submission?.source_filename || 'Working demo'}
                  </small>
                </div>
                <video
                  className="admin-submission-video"
                  src={videoUrl}
                  controls
                  playsInline
                  preload="metadata"
                />
              </div>
            </div>
          </Accordion>

          {completed && (
            <SubmissionReport
              submissionId={submission.id}
              collapsible
              recommendation={submission?.result?.recommendation}
              embeddedAnalysis={submission?.analysis || submission?.result}
            />
          )}

          {completed && (
            <Card className="evaluator-score-card evaluator-score-card--wide">
              <CardBody>
                <AnimatedScoreGauge
                  value={dashboardScore}
                  label={currentScore != null ? 'Evaluator score' : 'AI score'}
                />
                <div className="evaluator-score-card__status">
                  <span className="eyebrow">Score summary</span>
                  <h3>{Math.round(dashboardScore)} out of 100</h3>
                  <ReviewStatusBadge status={reviewStatus} />
                  <p>
                    {reviewStatus === 'approved'
                      ? 'Approved and visible to the student.'
                      : reviewStatus === 'pending_review'
                        ? 'Submitted and waiting for admin approval.'
                        : 'Review the AI result and submit your score.'}
                  </p>
                </div>
              </CardBody>
            </Card>
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
                <span className="text-sm text-muted">Analysis status</span>
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
                        ? 'AI evaluation running automatically'
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
                <div className="evaluator-review-status">
                  <span className="text-sm text-muted">Admin review</span>
                  <ReviewStatusBadge status={reviewStatus} />
                </div>
              )}
            </CardBody>
          </Card>

          {completed && canSubmit && (
            <Card>
              <CardHeader>
                <h3>Submit to admin</h3>
              </CardHeader>
              <CardBody>
                <EvaluatorReviewForm
                  initialScore={currentScore}
                  initialNotes={currentNotes}
                  reviewStatus={reviewStatus}
                  submitting={action === 'submitting'}
                  onSubmit={submitForReview}
                />
              </CardBody>
            </Card>
          )}

          {completed && (
            <WorkflowTracking
              analysisCompleted={completed}
              reviewStatus={reviewStatus}
            />
          )}
        </aside>
      </div>
    </div>
  )
}
