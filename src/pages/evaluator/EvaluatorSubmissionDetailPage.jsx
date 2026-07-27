import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { evaluationApi } from '../../api/evaluation'
import { resolveApiUrl } from '../../api/client'
import { usePolling } from '../../hooks/usePolling'
import { formatDateTime } from '../../utils/format'
import PageHeader from '../../components/layout/PageHeader'
import Alert from '../../components/ui/Alert'
import { ReviewStatusBadge, StatusBadge } from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card, { CardBody, CardHeader } from '../../components/ui/Card'
import Icon from '../../components/ui/Icon'
import Input, { Textarea } from '../../components/ui/Input'
import { LoadingBlock } from '../../components/ui/Spinner'
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

export default function EvaluatorSubmissionDetailPage() {
  const { submissionId } = useParams()
  const fetcher = useCallback(() => evaluationApi.getSubmission(submissionId), [submissionId])
  const { data: submission, loading, error, restart: restartPolling } = usePolling(fetcher, {
    isDone: (item) => ['completed', 'failed'].includes(item?.status),
    interval: 3000,
  })
  const [criteria, setCriteria] = useState('')
  const [reviewOverride, setReviewOverride] = useState(null)
  const [action, setAction] = useState('')
  const [analysisStarted, setAnalysisStarted] = useState(false)
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
      await evaluationApi.evaluateSubmission(submission.id, criteria.trim() || null)
      setAnalysisStarted(true)
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
    return <div className="container page"><LoadingBlock label="Loading assigned submission…" /></div>
  }

  if (error && !submission) {
    return (
      <div className="container container--narrow page stack-md">
        <Alert variant="danger" title="Unable to load assigned submission">{error.message}</Alert>
        <div><Button as={Link} to="/evaluator" variant="secondary">Back to assignments</Button></div>
      </div>
    )
  }

  const canAnalyze = ['uploaded', 'failed'].includes(submission?.status) && !analysisStarted
  const processing = submission?.status === 'processing' || analysisStarted
  const completed = submission?.status === 'completed'
  const displayStatus = ['completed', 'failed'].includes(submission?.status)
    ? submission.status
    : analysisStarted
      ? 'processing'
      : submission?.status
  const canSubmit = completed && ['none', 'changes_requested'].includes(reviewStatus)

  return (
    <div className="container page admin-submission-detail">
      <PageHeader
        eyebrow="Assigned submission"
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
                ? `/evaluator/hackathons/${submission.hackathon_id}`
                : '/evaluator'
            }
            variant="secondary"
            leftIcon={<Icon name="arrowLeft" size={17} />}
          >
            Back to queue
          </Button>
        }
      />

      {actionError && <Alert variant="danger">{actionError}</Alert>}
      {actionMessage && <Alert variant="success">{actionMessage}</Alert>}
      {reviewStatus === 'changes_requested' && (
        <Alert variant="warning" title="Changes requested">
          {submission?.review_notes ||
            'Review the submission and analysis, then update your score or notes and resubmit it.'}
        </Alert>
      )}

      <div className="admin-submission-layout">
        <div className="stack-lg">
          <Card>
            <CardHeader>
              <div><h3>Working demo</h3><p className="text-sm text-muted">{submission?.source_filename}</p></div>
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
            <CardHeader><h3>Project details</h3><Icon name="clipboard" size={19} className="text-muted" /></CardHeader>
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
                <StatusBadge status={displayStatus} />
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
                    {submission?.status === 'failed' ? 'Retry AI analysis' : 'Run AI analysis'}
                  </Button>
                </>
              )}

              {processing && !completed && (
                <div className="admin-analysis-processing">
                  <span className="spinner" />
                  <div><strong>Analysis in progress</strong><small>Updating automatically…</small></div>
                </div>
              )}

              {completed && (
                <div className="evaluator-review-status">
                  <span className="text-sm text-muted">Admin review</span>
                  <ReviewStatusBadge status={reviewStatus} />
                </div>
              )}
            </CardBody>
          </Card>

          {completed && (
            <Card>
              <CardHeader><h3>Submit to admin</h3></CardHeader>
              <CardBody>
                {canSubmit ? (
                  <EvaluatorReviewForm
                    initialScore={currentScore}
                    initialNotes={currentNotes}
                    reviewStatus={reviewStatus}
                    submitting={action === 'submitting'}
                    onSubmit={submitForReview}
                  />
                ) : (
                  <div className="stack-sm">
                    <div className="row-between text-sm">
                      <span className="text-muted">Score</span>
                      <strong>{currentScore ?? '—'}{currentScore != null ? '/100' : ''}</strong>
                    </div>
                    {currentNotes && (
                      <div className="evaluator-submitted-notes">
                        <span>Evaluator notes</span>
                        <p>{currentNotes}</p>
                      </div>
                    )}
                    <ReviewStatusBadge status={reviewStatus} />
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </aside>
      </div>

      {completed && (
        <div className="admin-submission-report">
          <div className="row-between wrap">
            <div><div className="eyebrow">Generated result</div><h2>Evaluation report</h2></div>
            <ReviewStatusBadge status={reviewStatus} />
          </div>
          <SubmissionReport submissionId={submission.id} />
        </div>
      )}
    </div>
  )
}
