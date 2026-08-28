import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { evaluationApi } from '../../api/evaluation'
import { hackathonsApi } from '../../api/hackathons'
import { resolveApiUrl } from '../../api/client'
import { useAsync } from '../../hooks/useAsync'
import { usePolling } from '../../hooks/usePolling'
import {
  draftFromScorecard,
  getGithubMetric,
  getScorecard,
  previewScorecard,
  submissionLinkForGroup,
} from '../../utils/scorecard'
import { formatDateTime } from '../../utils/format'
import { BTN_GHOST, EYEBROW, WRAP_APP } from '../../components/drop/theme'
import Alert from '../../components/ui/Alert'
import Accordion from '../../components/ui/Accordion'
import Badge, { ReviewStatusBadge, StatusBadge } from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card, { CardBody, CardHeader } from '../../components/ui/Card'
import Icon from '../../components/ui/Icon'
import Spinner, { LoadingBlock } from '../../components/ui/Spinner'
import AdminReviewCard from '../../components/evaluation/AdminReviewCard'
import AiMetricsPanel from '../../components/evaluation/AiMetricsPanel'
import GithubAiPanel from '../../components/evaluation/GithubAiPanel'
import ManualScoreForms from '../../components/evaluation/ManualScoreForms'
import ScorecardBar from '../../components/evaluation/ScorecardBar'
import SubmissionReport from '../../components/evaluation/SubmissionReport'

export default function AdminSubmissionDetailPage() {
  const { submissionId } = useParams()
  const fetcher = useCallback(
    (opts) => evaluationApi.getSubmission(submissionId, opts),
    [submissionId],
  )
  const { data: submission, loading, error, restart: restartPolling } = usePolling(fetcher, {
    isDone: (item) =>
      ['completed', 'failed'].includes(item?.status) &&
      item?.github_ai_status !== 'processing',
    interval: 3000,
  })
  const { data: hackathon } = useAsync(
    () => hackathonsApi.get(submission.hackathon_id),
    { enabled: Boolean(submission?.hackathon_id) },
  )
  const evaluatorGuidelines = String(hackathon?.evaluator_guidelines || '').trim()

  const [reviewNotes, setReviewNotes] = useState('')
  const [action, setAction] = useState('')
  const [actionError, setActionError] = useState('')
  const [publishOverride, setPublishOverride] = useState(null)
  const [publishedAtOverride, setPublishedAtOverride] = useState(undefined)
  const [reviewOverride, setReviewOverride] = useState(null)
  const [actionMessage, setActionMessage] = useState('')
  const [showDetailReport, setShowDetailReport] = useState(false)
  const [githubAiStarting, setGithubAiStarting] = useState(false)
  const [githubAiError, setGithubAiError] = useState('')
  const [draftByFieldKey, setDraftByFieldKey] = useState({})

  const reportPublished = publishOverride ?? submission?.report_published ?? false
  const reviewStatus = reviewOverride?.review_status ?? submission?.review_status ?? 'none'
  const evaluatorNotes = reviewOverride?.evaluator_notes ?? submission?.evaluator_notes
  const finalScore = reviewOverride?.final_score ?? submission?.final_score
  const scorecardBase = useMemo(
    () => reviewOverride?.scorecard || getScorecard(submission),
    [reviewOverride, submission],
  )


  // Re-seed the GitHub metric when an analysis completes.
  //
  // The effect above seeds the draft once, on first load. A GitHub AI run
  // finishes later, so without this the panel would show a score the scorecard
  // form below never picked up. Only this one field_key is replaced — any edits
  // in progress on other metrics survive — and the evaluator can still change
  // it afterwards, so a manual value always wins.
  const lastGithubAiStatus = useRef(null)
  useEffect(() => {
    const status = submission?.github_ai_status
    const previous = lastGithubAiStatus.current
    lastGithubAiStatus.current = status
    if (status !== 'completed' || previous === 'completed' || previous == null) return
    if (!scorecardBase) return
    const metric = getGithubMetric(scorecardBase)
    const seeded = metric ? draftFromScorecard(scorecardBase)[metric.field_key] : null
    if (!seeded) return
    setDraftByFieldKey((current) => ({ ...current, [metric.field_key]: seeded }))
  }, [submission?.github_ai_status, scorecardBase])

  const preview = useMemo(
    () => previewScorecard(scorecardBase, draftByFieldKey),
    [scorecardBase, draftByFieldKey],
  )

  useEffect(() => {
    if (!scorecardBase) return
    setDraftByFieldKey((current) =>
      Object.keys(current).length ? current : draftFromScorecard(scorecardBase),
    )
  }, [scorecardBase])

  const manualComplete = useMemo(() => {
    const manual = (scorecardBase?.metrics || []).filter((metric) => metric.scoring_mode === 'manual')
    if (!manual.length) return true
    return manual.every((metric) => metric.score != null)
  }, [scorecardBase])

  const videoUrl = submission
    ? resolveApiUrl(
        submission.video_url ||
          `/submissions/${encodeURIComponent(submission.id)}/video`,
      )
    : ''

  const githubLink = submissionLinkForGroup(submission, 'github')

  /** Same trigger as the evaluator view; the existing poll reports progress. */
  const runGithubAi = async () => {
    setGithubAiStarting(true)
    setGithubAiError('')
    try {
      await evaluationApi.evaluateGithubWithAi(submissionId)
      restartPolling()
    } catch (err) {
      // 409 means it is already running — start watching, do not report it.
      if (err?.status === 409) {
        restartPolling()
        return
      }
      setGithubAiError(err?.message || 'Could not start the GitHub AI evaluation.')
    } finally {
      setGithubAiStarting(false)
    }
  }
  const mvpLink = submissionLinkForGroup(submission, 'mvp')
  const publishedAt =
    publishedAtOverride === undefined ? submission?.published_at : publishedAtOverride

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
        scorecard: updated.scorecard || getScorecard(updated) || scorecardBase,
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
  const scorecardTitle =
    reviewStatus === 'approved'
      ? 'Final scorecard'
      : ['pending_review', 'changes_requested'].includes(reviewStatus)
        ? 'Submitted scorecard'
        : 'Evaluator scorecard'

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
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge status={submission?.status} />
            <ReviewStatusBadge status={reviewStatus} />
          </div>
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
      {reviewStatus === 'pending_review' && (
        <div className="mb-4">
          <Alert variant="info" title="Evaluator submission ready">
            Review the scorecard below, then approve or request changes from the sidebar.
          </Alert>
        </div>
      )}
      {reviewStatus === 'changes_requested' && (
        <div className="mb-4">
          <Alert variant="warning" title="Changes requested">
            Waiting for the evaluator to update and resubmit their review.
          </Alert>
        </div>
      )}

      {evaluatorGuidelines ? (
        <div className="mb-6">
          <Accordion
            title="Evaluator guidelines"
            description="Follow these when reviewing submissions for this hackathon."
            icon="shield"
            defaultOpen={false}
          >
            <div className="markdown-body hackathon-guidelines text-ink">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{evaluatorGuidelines}</ReactMarkdown>
            </div>
          </Accordion>
        </div>
      ) : null}

      <div className="admin-submission-layout">
        <div className="stack-lg min-w-0">
          {preview?.metrics?.length ? (
            <Card className="scorecard-preview-card">
              <CardBody>
                <ScorecardBar scorecard={preview} title={scorecardTitle} />
              </CardBody>
            </Card>
          ) : null}

          <Accordion
            title="Submission details"
            description="Problem statement, solution description, links, and working demo."
            icon="clipboard"
            badge={
              completed ? (
                <Badge variant="success" dot>
                  Completed
                </Badge>
              ) : (
                <Badge variant="neutral" dot>
                  Pending
                </Badge>
              )
            }
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
                    {githubLink ? (
                      <a href={githubLink} target="_blank" rel="noreferrer">
                        {githubLink}
                      </a>
                    ) : (
                      'Not provided.'
                    )}
                  </p>
                </div>
                <div className="admin-response-block">
                  <span>MVP</span>
                  <p>
                    {mvpLink ? (
                      <a href={mvpLink} target="_blank" rel="noreferrer">
                        {mvpLink}
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
            <Accordion
              title="AI metrics"
              description="Read-only scores filled by AI evaluation."
              icon="sparkles"
              badge={
                completed ? (
                  <Badge variant="success" dot>
                    Completed
                  </Badge>
                ) : (
                  <Badge variant="info" dot>
                    In progress
                  </Badge>
                )
              }
            >
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
            </Accordion>
          )}

          {(submission?.github_ai_evaluation ||
            submission?.show_github_ai_evaluation_button ||
            submission?.github_ai_status !== 'none') && (
            <GithubAiPanel
              githubLink={githubLink}
              status={submission?.github_ai_status}
              result={submission?.github_ai_result}
              error={submission?.github_ai_error}
              canStart={Boolean(submission?.show_github_ai_evaluation_button)}
              starting={githubAiStarting}
              actionError={githubAiError}
              onStart={runGithubAi}
            />
          )}

          {completed && scorecardBase && (
            <Accordion
              title="Manual metrics"
              description="GitHub and MVP scores submitted by the evaluator."
              icon="edit"
              badge={
                manualComplete ? (
                  <Badge variant="success" dot>
                    Completed
                  </Badge>
                ) : (
                  <Badge variant="neutral" dot>
                    Pending
                  </Badge>
                )
              }
            >
              <ManualScoreForms
                scorecard={preview}
                draftByFieldKey={draftByFieldKey}
                githubLink={githubLink}
                mvpLink={mvpLink}
                disabled
              />
            </Accordion>
          )}

          {completed && (
            <SubmissionReport
              submissionId={submission.id}
              collapsible
              recommendation={submission?.result?.recommendation}
              embeddedAnalysis={submission?.analysis || submission?.result}
              demoScore={
                submission?.analysis?.overall_score ?? submission?.result?.overall_score
              }
              scoresOnly
              detailModalOpen={showDetailReport}
              onDetailModalClose={() => setShowDetailReport(false)}
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
                  variant="secondary"
                  block
                  className="detail-report-btn"
                  onClick={() => setShowDetailReport(true)}
                  leftIcon={<Icon name="file" size={17} />}
                >
                  Detail report
                </Button>
              )}
            </CardBody>
          </Card>

          {completed && (
            <AdminReviewCard
              preview={preview}
              scorecard={scorecardBase}
              reviewStatus={reviewStatus}
              evaluatorName={submission?.assigned_evaluator_name}
              evaluatorNotes={evaluatorNotes}
              finalScore={finalScore}
              reportPublished={reportPublished}
              publishedAt={publishedAt}
              reviewNotes={reviewNotes}
              onReviewNotesChange={setReviewNotes}
              onApprove={() => decideEvaluatorReview('approving')}
              onRequestChanges={() => decideEvaluatorReview('requesting_changes')}
              approving={action === 'approving'}
              requestingChanges={action === 'requesting_changes'}
            />
          )}
        </aside>
      </div>
    </div>
  )
}
