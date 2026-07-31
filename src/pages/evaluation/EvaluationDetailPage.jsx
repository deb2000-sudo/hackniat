import { useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { evaluationApi } from '../../api/evaluation'
import { usePolling } from '../../hooks/usePolling'
import { useAuth } from '../../hooks/useAuth'
import { getScorecard } from '../../utils/scorecard'
import { EVALUATION_STATUS, ROLE_HOME, ROLES } from '../../utils/constants'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import Alert from '../../components/ui/Alert'
import { LoadingBlock } from '../../components/ui/Spinner'
import SessionMeta from '../../components/evaluation/SessionMeta'
import SessionStatusPanel from '../../components/evaluation/SessionStatusPanel'
import EvaluationResultView from '../../components/evaluation/EvaluationResultView'
import ScorecardBar from '../../components/evaluation/ScorecardBar'
import SubmissionReport from '../../components/evaluation/SubmissionReport'
import Card, { CardBody } from '../../components/ui/Card'

const TERMINAL = [EVALUATION_STATUS.COMPLETED, EVALUATION_STATUS.FAILED]

export default function EvaluationDetailPage() {
  const { sessionId } = useParams()
  const { user } = useAuth()
  const isStudent = user?.role === ROLES.STUDENT

  const fetcher = useCallback(
    (opts) => evaluationApi.getSubmission(sessionId, opts),
    [sessionId],
  )

  const { data: session, error, loading } = usePolling(fetcher, {
    isDone: (s) => (isStudent ? !!s?.report_published : TERMINAL.includes(s?.status)),
    interval: isStudent ? 5000 : 3000,
    maxInterval: isStudent ? 30_000 : 3000,
  })

  const backTo = isStudent ? '/student/evaluations' : ROLE_HOME[user?.role] || '/'

  if (loading && !session) {
    return (
      <div className="container page">
        <LoadingBlock label="Loading evaluation…" />
      </div>
    )
  }

  if (error && !session) {
    return (
      <div className="container container--narrow page stack-md">
        <Alert variant="danger" title="Unable to load this evaluation">
          {error.message}
        </Alert>
        <div>
          <Button as={Link} to={backTo} variant="secondary" leftIcon={<Icon name="arrowLeft" size={18} />}>
            Back
          </Button>
        </div>
      </div>
    )
  }

  const canViewResult = isStudent
    ? !!session?.report_published
    : session?.status === EVALUATION_STATUS.COMPLETED

  // Student view: Final Score + Detailed Analysis only (no submission details sidebar).
  if (isStudent) {
    return (
      <div className="container container--narrow page student-eval-page">
        <PageHeader
          eyebrow="Evaluation"
          title={session?.team_name || session?.title || session?.source_filename || 'Your evaluation'}
          description={
            canViewResult
              ? 'Your final score and detailed analysis report.'
              : 'Results appear here once an administrator publishes your report.'
          }
          actions={
            <Button
              as={Link}
              to={backTo}
              variant="secondary"
              leftIcon={<Icon name="arrowLeft" size={18} />}
            >
              Back
            </Button>
          }
        />

        {canViewResult ? (
          <div className="stack-lg student-eval-results">
            <Card className="student-final-score student-final-score--hero">
              <CardBody>
                <div className="student-final-score__copy">
                  <span className="student-final-score__label">
                    <Icon name="trophy" size={18} />
                    Final score
                  </span>
                  <p>Approved by the hackathon administrator</p>
                </div>
                <div className="student-final-score__value">
                  {session?.final_score != null || getScorecard(session)?.computed_total != null ? (
                    <strong>
                      {session?.final_score ?? getScorecard(session)?.computed_total}
                      <small>/100</small>
                    </strong>
                  ) : (
                    <strong className="student-final-score__empty">—</strong>
                  )}
                </div>
              </CardBody>
            </Card>

            {getScorecard(session)?.metrics?.length ? (
              <Card>
                <CardBody>
                  <ScorecardBar scorecard={getScorecard(session)} title="Your scorecard" />
                </CardBody>
              </Card>
            ) : null}

            <SubmissionReport submissionId={session.id} />
          </div>
        ) : (
          <Card className="student-result-pending">
            <CardBody>
              <span><Icon name="clock" size={28} /></span>
              <h2>Submitted — results pending</h2>
              <p>
                Your submission was recorded successfully. Your final score and detailed analysis
                will appear here after the evaluator submits their review and an administrator
                publishes the report.
              </p>
            </CardBody>
          </Card>
        )}
      </div>
    )
  }

  // Evaluator / admin view keeps the full detail layout.
  return (
    <div className="container page">
      <PageHeader
        eyebrow="Evaluation"
        title={session?.team_name || session?.title || session?.source_filename || 'Submission'}
        description="AI evaluation of the submitted hackathon demo."
        actions={
          <Button
            as={Link}
            to={backTo}
            variant="secondary"
            leftIcon={<Icon name="arrowLeft" size={18} />}
          >
            Back
          </Button>
        }
      />

      <div className="detail-layout">
        <SessionMeta session={session} />
        <div className="stack-lg">
          {canViewResult ? (
            <>
              <EvaluationResultView result={session.result} />
              <SubmissionReport submissionId={session.id} />
            </>
          ) : (
            <SessionStatusPanel status={session?.status} error={session?.error} />
          )}
        </div>
      </div>
    </div>
  )
}
